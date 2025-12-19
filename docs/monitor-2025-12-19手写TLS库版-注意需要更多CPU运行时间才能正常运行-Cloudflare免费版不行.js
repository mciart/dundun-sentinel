import { connect } from 'cloudflare:sockets';
import { floorToMinute } from './utils.js';
import { getMonitorForSite } from './monitors/index.js';
import { shouldResetStats, resetDailyStats, getState, updateState } from './core/state.js';
import { sendNotifications } from './notifications/index.js';

const crypto = globalThis.crypto;

export async function handleMonitor(env, ctx, forceWrite = false) {
  const startTime = Date.now();
  console.log(forceWrite ? '=== 开始监控检测（强制写入）===' : '=== 开始监控检测 ===');

  let state = await getState(env);
  const now = Date.now();

  // 配置迁移
  if (state.config.statusChangeDebounceCount !== undefined && state.config.statusChangeDebounceMinutes === undefined) {
    state.config.statusChangeDebounceMinutes = state.config.statusChangeDebounceCount;
    delete state.config.statusChangeDebounceCount;
  }
  if (!state.config.statusChangeDebounceMinutes || state.config.statusChangeDebounceMinutes <= 0) {
    state.config.statusChangeDebounceMinutes = 3;
  }
  
  if (shouldResetStats(state)) {
    resetDailyStats(state);
  }

  // 1. 常规监控
  const checkPromises = state.sites.map(site => {
    const checker = getMonitorForSite(site);
    return checker(site, now);
  });
  const results = await Promise.all(checkPromises);

  let confirmedChanges = [];
  let onlineCount = 0;
  let pendingStateChanged = false;

  for (let i = 0; i < state.sites.length; i++) {
    const site = state.sites[i];
    const result = results[i];
    const previousStatus = site.status;
    const { statusChanged, pendingChanged } = checkWithDebounce(site, result, state.config.statusChangeDebounceMinutes);

    if (pendingChanged) pendingStateChanged = true;

    if (statusChanged) {
      confirmedChanges.push({ name: site.name, from: previousStatus, to: result.status });
      handleStatusChange(env, ctx, state, site, result, previousStatus);
    }

    site.responseTime = result.responseTime;
    site.lastCheck = now;
    if (!site.statusPending) {
      updateHistory(state, site.id, { ...result, status: site.status });
    }
    if (site.status === 'online') onlineCount++;
  }

  // 2. 清理数据
  const CLEANUP_INTERVAL = 60 * 60 * 1000;
  if (now - (state.lastCleanup || 0) >= CLEANUP_INTERVAL) {
    state.sites.forEach(site => cleanupOldData(state, site.id));
    cleanupOrphanedData(state);
    cleanupIncidentIndex(state, state.config.retentionHours * 3600000);
    state.lastCleanup = now;
  }

  // 3. SSL 终极检测
  const SSL_CHECK_INTERVAL = 60 * 60 * 1000;
  const shouldCheckSsl = forceWrite || (now - (state.lastSslCheck || 0) >= SSL_CHECK_INTERVAL);
  
  if (shouldCheckSsl) {
    await runUltimateSSLCheck(env, ctx, state);
  }

  // 4. 保存状态
  state.stats.checks.total++;
  state.stats.checks.today++;
  state.stats.sites.total = state.sites.length;
  state.stats.sites.online = onlineCount;
  state.stats.sites.offline = state.sites.length - onlineCount;

  const intervalMs = state.config.checkInterval * 60 * 1000;
  if (!state.monitorNextDueAt) state.monitorNextDueAt = floorToMinute(now + intervalMs);
  const shouldWrite = forceWrite || confirmedChanges.length > 0 || pendingStateChanged || now >= state.monitorNextDueAt;

  if (shouldWrite) {
    state.stats.writes.total++;
    state.lastUpdate = now;
    state.monitorNextDueAt = floorToMinute(now + intervalMs);
    await updateState(env, state);
    console.log(`✅ 状态已保存`);
  }
}

export async function handleCertCheck(env, ctx) {
  const state = await getState(env);
  if (state && state.sites.length > 0) {
    await runUltimateSSLCheck(env, ctx, state);
    state.lastUpdate = Date.now();
    await updateState(env, state);
  }
}

// === 核心 SSL 逻辑 ===

async function runUltimateSSLCheck(env, ctx, state) {
  const httpSites = state.sites.filter(s => s.monitorType !== 'dns' && s.url?.startsWith('https:'));
  if (httpSites.length === 0) return;

  console.log(`🔒 开始 SSL 终极检测 (Target: ${httpSites.length})`);
  
  const certMap = {};
  
  for (const site of httpSites) {
    try {
      const hostname = new URL(site.url).hostname;
      if (certMap[hostname]) continue;

      let info = null;
      let engine = 'TLS 1.2 (Raw)';

      // 1. 优先尝试 TLS 1.3 (Native X25519)
      try {
        info = await checkTLS13(hostname);
        engine = 'TLS 1.3 (Native)';
      } catch (e13) {
      console.log(`[${site.name}] TLS 1.3 失败: ${e13.message}`);
        // 2. 失败则降级到 TLS 1.2 (Raw TCP)
        try {
          info = await checkTLS12(hostname);
        } catch (e12) {
          throw new Error(`TLS 1.3: ${e13.message} | TLS 1.2: ${e12.message}`);
        }
      }

      if (info) {
        console.log(`✅ [${engine}] ${hostname} 剩余 ${info.daysLeft} 天`);
        certMap[hostname] = info;
        
        const prevCert = site.sslCert;
        site.sslCert = info;
        site.sslCertLastCheck = Date.now();
        
        const inc = handleCertAlert(state, site, prevCert, info);
        if (inc && state.config?.notifications?.enabled) {
           ctx && ctx.waitUntil(sendNotifications(env, inc, site, state.config.notifications));
        }
      }
    } catch (e) {
      console.error(`❌ [${site.name}] SSL 握手全线失败:`, e.message);
    }
  }
  state.lastSslCheck = Date.now();
}

// --------------------------------------------------------------------------
// 🔥 引擎 1: TLS 1.3 (Native WebCrypto) - Mini-SubTLS 版
// --------------------------------------------------------------------------

class ReadQueue {
  constructor(reader) {
    this.reader = reader;
    this.buffer = new Uint8Array(0);
    this.ended = false;
  }

  async readBytes(n) {
    while (this.buffer.length < n) {
      if (this.ended) throw new Error('Unexpected EOF');
      const { done, value } = await this.reader.read();
      if (done) {
        this.ended = true;
        if (this.buffer.length < n) throw new Error('Unexpected EOF');
      }
      if (value) {
        const newBuf = new Uint8Array(this.buffer.length + value.length);
        newBuf.set(this.buffer);
        newBuf.set(value, this.buffer.length);
        this.buffer = newBuf;
      }
    }
    const res = this.buffer.slice(0, n);
    this.buffer = this.buffer.slice(n);
    return res;
  }
}

async function checkTLS13(hostname) {
  let socket;
  try {
    // 使用 X25519 (主流标准)
    const keyPair = await crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveBits"]);
    const rawPublicKey = await crypto.subtle.exportKey("raw", keyPair.publicKey);
    const keyShareData = new Uint8Array(rawPublicKey);

    const clientHello = buildTLS13ClientHello(hostname, keyShareData);
    
    socket = connect({ hostname, port: 443 });
    const writer = socket.writable.getWriter();
    const reader = socket.readable.getReader();
    const rq = new ReadQueue(reader);

    await writer.write(clientHello);

    // 1. 解析 ServerHello (明文)
    // Record Header (5 bytes)
    const shHeader = await rq.readBytes(5);
    
    // 检查是否为 Alert
    if (shHeader[0] === 0x15) {
      const alertLen = (shHeader[3] << 8) | shHeader[4];
      const alertBody = await rq.readBytes(alertLen);
      throw new Error(`TLS Alert: level=${alertBody[0]}, desc=${alertBody[1]}`);
    }
    
    if (shHeader[0] !== 0x16) throw new Error(`Invalid ServerHello header: 0x${shHeader[0].toString(16)}`);
    const shLen = (shHeader[3] << 8) | shHeader[4];
    const shBody = await rq.readBytes(shLen);

    const shResult = parseServerHello(shBody);
    if (!shResult) throw new Error('Invalid ServerHello body');
    
    if (shResult.random[0] === 0xCF && shResult.random[2] === 0xAD) {
       throw new Error('HelloRetryRequest (Not Implemented)');
    }

    // 2. 密钥派生 (HKDF)
    const serverPubKeyRaw = shResult.keyShare;
    if (!serverPubKeyRaw) throw new Error('No KeyShare in ServerHello');

    // Transcript: ClientHello (body) + ServerHello (body)
    // 注意：Header 5字节不参与 Hash，只 Hash 内容
    const rawTranscript = concat(clientHello.slice(5), shBody);
    const transcriptHash = await crypto.subtle.digest("SHA-256", rawTranscript);

    // 正确的 ECDH：用客户端私钥 + 服务器公钥
    const serverKeyImported = await crypto.subtle.importKey("raw", serverPubKeyRaw, { name: "X25519" }, false, []);
    const sharedSecretBits = await crypto.subtle.deriveBits({ name: "X25519", public: serverKeyImported }, keyPair.privateKey, 256);
    const sharedSecret = new Uint8Array(sharedSecretBits);

    // 计算 SHA-256("") - 空字符串的哈希
    const emptyHash = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(0)));

    const earlySecret = await hkdfExtract(new Uint8Array(32), new Uint8Array(32)); 
    const derivedSecret = await hkdfExpandLabel(earlySecret, "derived", emptyHash, 32);
    const handshakeSecret = await hkdfExtract(derivedSecret, sharedSecret);

    const serverHandshakeTrafficSecret = await hkdfExpandLabel(handshakeSecret, "s hs traffic", new Uint8Array(transcriptHash), 32);
    const serverKey = await hkdfExpandLabel(serverHandshakeTrafficSecret, "key", new Uint8Array(0), 16);
    const serverIV = await hkdfExpandLabel(serverHandshakeTrafficSecret, "iv", new Uint8Array(0), 12);

    const keyObj = await crypto.subtle.importKey("raw", serverKey, "AES-GCM", false, ["decrypt"]);
    let seq = 0;

    // 3. 读取加密记录 (Loop) - 累积所有 handshake 消息
    let handshakeBuffer = new Uint8Array(0);
    let maxRecords = 20; // 防止无限循环
    let recordCount = 0;
    
    while (recordCount < maxRecords) {
      recordCount++;
      let header;
      try {
        header = await rq.readBytes(5);
      } catch (e) {
        break; // EOF or error
      }
      
      const recType = header[0];
      const recLen = (header[3] << 8) | header[4];
      
      if (recLen > 16384) throw new Error('Record too large');
      
      const body = await rq.readBytes(recLen);

      if (recType === 0x14) continue; // Skip CCS
      if (recType !== 0x17) continue; // Skip non-application data

      // 解密
      const nonce = new Uint8Array(serverIV);
      xorSeq(nonce, seq++); 
      
      let plaintextBuf;
      try {
        plaintextBuf = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: nonce, additionalData: header },
          keyObj,
          body
        );
      } catch (e) {
        continue; // 解密失败，跳过这条记录
      }

      const plaintext = new Uint8Array(plaintextBuf);
      
      // 去除 Padding (TLS 1.3 关键步骤)
      let i = plaintext.length - 1;
      while (i >= 0 && plaintext[i] === 0) i--;
      if (i < 0) continue; // All padding
      
      const contentType = plaintext[i]; // 真实的 Inner Type
      const content = plaintext.slice(0, i);

      if (contentType === 0x16) { // Handshake Message
        // 累积 handshake 消息
        handshakeBuffer = concat(handshakeBuffer, content);
        
        // 尝试从累积的 buffer 中解析证书
        const certInfo = scanHandshakeStream(handshakeBuffer);
        if (certInfo) {
          try { socket.close(); } catch {}
          return certInfo;
        }
        
        // 检查是否收到 Finished 消息 (type 20)
        if (hasFinishedMessage(handshakeBuffer)) {
          break;
        }
      }
    }
    
    // 最后再尝试一次从累积的 buffer 中扫描
    if (handshakeBuffer.length > 0) {
      const certInfo = scanHandshakeStream(handshakeBuffer);
      if (certInfo) {
        try { socket.close(); } catch {}
        return certInfo;
      }
    }
    
    throw new Error('TLS 1.3 handshake finished without finding certificate');

  } catch (e) {
    try { socket?.close(); } catch {}
    throw e;
  }
}

// --------------------------------------------------------------------------
// 🔥 引擎 2: TLS 1.2 (Raw TCP)
// --------------------------------------------------------------------------

async function checkTLS12(hostname) {
  let socket;
  try {
    socket = connect({ hostname, port: 443 });
    const writer = socket.writable.getWriter();
    const reader = socket.readable.getReader();
    const rq = new ReadQueue(reader);

    const clientHello = buildTLS12ClientHello(hostname);
    await writer.write(clientHello);

    const maxBytes = 32768;
    let totalRead = 0;
    let buffer = new Uint8Array(0);
    
    // 按 TLS record 结构读取
    while (totalRead < maxBytes) {
      // 读取 record header (5 bytes)
      let header;
      try {
        header = await rq.readBytes(5);
      } catch {
        break; // EOF
      }
      
      const recType = header[0];
      const recVersion = (header[1] << 8) | header[2];
      const recLen = (header[3] << 8) | header[4];
      
      // 检查协议版本 (允许 TLS 1.0/1.1/1.2)
      if (recVersion < 0x0301 || recVersion > 0x0303) {
        throw new Error('Unsupported protocol version');
      }
      
      if (recLen > 16384) {
        throw new Error('Record too large');
      }
      
      // 读取 record body
      let body;
      try {
        body = await rq.readBytes(recLen);
      } catch {
        break;
      }
      
      totalRead += 5 + recLen;
      
      // 只处理 Handshake 记录 (0x16)
      if (recType === 0x16) {
        // 累积 handshake 数据
        buffer = concat(buffer, body);
        
        // 尝试解析证书
        const info = parseTLS12Certificate(buffer);
        if (info) {
          try { socket.close(); } catch {}
          return info;
        }
        
        // 也尝试直接扫描字节
        const scanInfo = scanCertFromBytes(buffer);
        if (scanInfo) {
          try { socket.close(); } catch {}
          return scanInfo;
        }
      } else if (recType === 0x15) {
        // Alert 记录
        if (body.length >= 2) {
          const alertLevel = body[0];
          const alertDesc = body[1];
          if (alertLevel === 2) { // Fatal alert
            throw new Error(`TLS Alert: ${alertDesc}`);
          }
        }
      }
    }
    
    // 最后尝试一次
    if (buffer.length > 0) {
      const info = scanCertFromBytes(buffer);
      if (info) {
        try { socket.close(); } catch {}
        return info;
      }
    }
    
    throw new Error('No certificate found in TLS 1.2 handshake');

  } catch (e) {
    try { socket?.close(); } catch {}
    throw e;
  }
}

// 解析 TLS 1.2 Certificate 消息
function parseTLS12Certificate(buffer) {
  let offset = 0;
  
  while (offset + 4 <= buffer.length) {
    const msgType = buffer[offset];
    const msgLen = (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | buffer[offset + 3];
    
    if (offset + 4 + msgLen > buffer.length) break; // 消息不完整
    
    if (msgType === 11) { // Certificate 消息
      const certData = buffer.slice(offset + 4, offset + 4 + msgLen);
      
      // TLS 1.2 Certificate 结构: CertsLen(3) + [CertLen(3) + Cert]...
      if (certData.length < 3) break;
      
      const certsLen = (certData[0] << 16) | (certData[1] << 8) | certData[2];
      let p = 3;
      
      if (p + 3 <= certData.length) {
        const firstCertLen = (certData[p] << 16) | (certData[p + 1] << 8) | certData[p + 2];
        p += 3;
        
        if (p + firstCertLen <= certData.length) {
          const firstCert = certData.slice(p, p + firstCertLen);
          const info = scanCertFromBytes(firstCert);
          if (info) return info;
        }
      }
    }
    
    offset += 4 + msgLen;
  }
  
  return null;
}

// === 核心工具 ===

function scanHandshakeStream(content) {
  let offset = 0;
  while (offset + 4 <= content.length) {
    const type = content[offset];
    const len = (content[offset+1] << 16) | (content[offset+2] << 8) | content[offset+3];
    
    if (offset + 4 + len > content.length) break; // Incomplete message
    
    if (type === 11) { // Certificate
      const certBytes = content.slice(offset + 4, offset + 4 + len);
      return parseTLS13Cert(certBytes);
    }
    
    offset += 4 + len;
  }
  return null;
}

function parseTLS13Cert(buf) {
  // TLS 1.3 Cert Msg: ReqCtxLen(1) + ReqCtx + CertsLen(3) + [CertLen(3) + Cert + ExtLen(2) + Ext]...
  let p = 0;
  const ctxLen = buf[p]; p += 1 + ctxLen;
  const listLen = (buf[p] << 16) | (buf[p+1] << 8) | buf[p+2]; p += 3;
  
  if (p + 3 > buf.length) return null;
  // First cert
  const certLen = (buf[p] << 16) | (buf[p+1] << 8) | buf[p+2]; p += 3;
  const rawCert = buf.slice(p, p + certLen);
  
  // 扫描 ASN.1
  return scanCertFromBytes(rawCert); 
}

function scanCertFromBytes(buffer) {
  const dates = [];
  const minYear = 2024;
  
  for (let i = 0; i < buffer.length - 15; i++) {
    const tag = buffer[i];
    const len = buffer[i+1];
    
    if ((tag === 0x17 && len >= 11) || (tag === 0x18 && len >= 13)) {
      let str = '';
      for (let j = 0; j < len; j++) str += String.fromCharCode(buffer[i + 2 + j]);
      if (str.endsWith('Z') && /^\d+Z$/.test(str)) {
        let year = parseInt(str.substring(0, 2));
        if (tag === 0x17) year += 2000;
        else year = parseInt(str.substring(0, 4));
        if (year >= minYear && year < 2050) dates.push(str);
      }
    }
  }

  const now = Date.now();
  let minValidDate = 0;
  let validStr = '';
  
  for (const d of dates) {
    const isGen = d.length >= 15; 
    const year = isGen ? d.substring(0, 4) : '20' + d.substring(0, 2);
    const mo = isGen ? d.substring(4, 6) : d.substring(2, 4);
    const dy = isGen ? d.substring(6, 8) : d.substring(4, 6);
    
    const ts = new Date(Date.UTC(year, parseInt(mo) - 1, dy)).getTime();
    if (ts > now) {
      if (minValidDate === 0 || ts < minValidDate) {
        minValidDate = ts;
        validStr = new Date(ts).toISOString();
      }
    }
  }

  if (minValidDate > 0) {
    const daysLeft = Math.floor((minValidDate - now) / 86400000);
    return {
      valid: daysLeft > 0,
      daysLeft,
      issuer: 'Detected (Raw)', 
      validFrom: new Date().toISOString(), 
      validTo: validStr,
      algorithm: 'unknown'
    };
  }
  return null;
}

// === 协议构建 ===

function buildTLS12ClientHello(hostname) {
  const sniBytes = new TextEncoder().encode(hostname);
  const sniLen = sniBytes.length;
  // TLS 1.2 兼容的密码套件
  const ciphers = [
    0xc02f, // TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
    0xc030, // TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
    0xc02b, // TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
    0xc02c, // TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
    0xc013, // TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA
    0xc014, // TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA
    0x009c, // TLS_RSA_WITH_AES_128_GCM_SHA256
    0x009d, // TLS_RSA_WITH_AES_256_GCM_SHA384
    0x002f, // TLS_RSA_WITH_AES_128_CBC_SHA
    0x0035, // TLS_RSA_WITH_AES_256_CBC_SHA
  ];

  // 构建扩展
  const extensions = [];
  
  // SNI 扩展 (0x0000)
  const sniExt = [];
  sniExt.push(0x00, 0x00); // Extension type: SNI
  const sniListLen = sniLen + 3; // type(1) + len(2) + name
  const sniExtDataLen = sniListLen + 2; // listLen(2) + list
  sniExt.push((sniExtDataLen >> 8) & 0xFF, sniExtDataLen & 0xFF);
  sniExt.push((sniListLen >> 8) & 0xFF, sniListLen & 0xFF);
  sniExt.push(0x00); // Host name type
  sniExt.push((sniLen >> 8) & 0xFF, sniLen & 0xFF);
  for (let i = 0; i < sniLen; i++) sniExt.push(sniBytes[i]);
  extensions.push(...sniExt);
  
  // Supported Groups 扩展 (0x000a) - 对 ECDHE 必需
  const groupsExt = [0x00, 0x0a, 0x00, 0x06, 0x00, 0x04, 0x00, 0x17, 0x00, 0x18]; // secp256r1, secp384r1
  extensions.push(...groupsExt);
  
  // EC Point Formats 扩展 (0x000b) - 对 ECDHE 必需
  const ecPointExt = [0x00, 0x0b, 0x00, 0x02, 0x01, 0x00]; // uncompressed
  extensions.push(...ecPointExt);
  
  // Signature Algorithms 扩展 (0x000d) - TLS 1.2 必需
  const sigAlgExt = [
    0x00, 0x0d, 0x00, 0x10, 0x00, 0x0e,
    0x04, 0x03, // ECDSA-SHA256
    0x05, 0x03, // ECDSA-SHA384
    0x04, 0x01, // RSA-SHA256
    0x05, 0x01, // RSA-SHA384
    0x02, 0x01, // RSA-SHA1
    0x02, 0x03, // ECDSA-SHA1
    0x06, 0x01, // RSA-SHA512
  ];
  extensions.push(...sigAlgExt);

  // 构建 ClientHello 消息体
  const p = [];
  p.push(0x01); // Handshake type: ClientHello
  p.push(0x00, 0x00, 0x00); // Length placeholder (填充后更新)
  
  p.push(0x03, 0x03); // Version: TLS 1.2
  
  // Random (32 bytes)
  const ts = Math.floor(Date.now() / 1000);
  p.push((ts >> 24) & 0xFF, (ts >> 16) & 0xFF, (ts >> 8) & 0xFF, ts & 0xFF);
  for (let i = 0; i < 28; i++) p.push(Math.floor(Math.random() * 256));
  
  p.push(0x00); // Session ID length: 0
  
  // Cipher suites
  const cipherLen = ciphers.length * 2;
  p.push((cipherLen >> 8) & 0xFF, cipherLen & 0xFF);
  ciphers.forEach(c => p.push((c >> 8) & 0xFF, c & 0xFF));
  
  p.push(0x01, 0x00); // Compression methods: null
  
  // Extensions
  p.push((extensions.length >> 8) & 0xFF, extensions.length & 0xFF);
  p.push(...extensions);

  // 更新 handshake 长度
  const handshakeLen = p.length - 4;
  p[1] = (handshakeLen >> 16) & 0xFF;
  p[2] = (handshakeLen >> 8) & 0xFF;
  p[3] = handshakeLen & 0xFF;
  
  // 构建 TLS record
  const record = [0x16, 0x03, 0x01]; // Handshake, TLS 1.0 (兼容性)
  record.push((p.length >> 8) & 0xFF, p.length & 0xFF);
  
  return new Uint8Array([...record, ...p]);
}

function buildTLS13ClientHello(hostname, keyShare) {
  const sni = new TextEncoder().encode(hostname);
  
  // 构建扩展
  const extP = [];
  
  // 1. SNI 扩展 (0x0000)
  const sniListLen = 1 + 2 + sni.length; // type(1) + len(2) + name
  const sniExtLen = 2 + sniListLen; // listLen(2) + list
  extP.push(0x00, 0x00); // Extension type
  extP.push((sniExtLen >> 8) & 0xFF, sniExtLen & 0xFF);
  extP.push((sniListLen >> 8) & 0xFF, sniListLen & 0xFF);
  extP.push(0x00); // Host name type
  extP.push((sni.length >> 8) & 0xFF, sni.length & 0xFF);
  for (let b of sni) extP.push(b);

  // 2. Supported Groups 扩展 (0x000a)
  extP.push(0x00, 0x0a, 0x00, 0x04, 0x00, 0x02, 0x00, 0x1d); // X25519 only

  // 3. Signature Algorithms 扩展 (0x000d)
  extP.push(0x00, 0x0d, 0x00, 0x08, 0x00, 0x06, 
    0x04, 0x03, // ECDSA-SECP256r1-SHA256
    0x05, 0x03, // ECDSA-SECP384r1-SHA384
    0x08, 0x04  // RSA-PSS-RSAE-SHA256
  );

  // 4. Supported Versions 扩展 (0x002b) - 必须声明支持 TLS 1.3
  extP.push(0x00, 0x2b, 0x00, 0x03, 0x02, 0x03, 0x04); // TLS 1.3

  // 5. Key Share 扩展 (0x0033)
  // 结构: ExtType(2) + ExtLen(2) + ClientKeyShareLen(2) + [Group(2) + KeyLen(2) + Key]
  const keyShareEntryLen = 2 + 2 + keyShare.length; // group + keyLen + key
  const keyShareExtLen = 2 + keyShareEntryLen; // clientKeyShareLen + entry
  extP.push(0x00, 0x33);
  extP.push((keyShareExtLen >> 8) & 0xFF, keyShareExtLen & 0xFF);
  extP.push((keyShareEntryLen >> 8) & 0xFF, keyShareEntryLen & 0xFF);
  extP.push(0x00, 0x1d); // X25519
  extP.push((keyShare.length >> 8) & 0xFF, keyShare.length & 0xFF);
  for (let b of keyShare) extP.push(b);

  // 构建 ClientHello 消息体
  const p = [];
  p.push(0x03, 0x03); // Legacy version: TLS 1.2
  
  // Random (32 bytes)
  for (let i = 0; i < 32; i++) p.push(Math.floor(Math.random() * 256));
  
  // Legacy Session ID (32 bytes for middlebox compatibility)
  p.push(0x20);
  for (let i = 0; i < 32; i++) p.push(Math.floor(Math.random() * 256));

  // Cipher Suites
  p.push(0x00, 0x02, 0x13, 0x01); // TLS_AES_128_GCM_SHA256
  
  // Legacy Compression Methods
  p.push(0x01, 0x00);
  
  // Extensions
  p.push((extP.length >> 8) & 0xFF, extP.length & 0xFF);
  p.push(...extP);

  // 构建 TLS Record
  const totalLen = p.length + 4; // handshake header
  const rec = [0x16, 0x03, 0x01]; // Handshake, TLS 1.0 legacy
  rec.push((totalLen >> 8) & 0xFF, totalLen & 0xFF);
  rec.push(0x01); // ClientHello
  rec.push(0x00, ((p.length >> 8) & 0xFF), (p.length & 0xFF));
  
  return new Uint8Array([...rec, ...p]);
}

// === WebCrypto Helpers ===

async function hkdfExtract(salt, ikm) {
  const key = await crypto.subtle.importKey("raw", salt, {name: "HMAC", hash: "SHA-256"}, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, ikm);
  return new Uint8Array(signature);
}

async function hkdfExpandLabel(secret, label, context, length) {
  const labelBuf = new TextEncoder().encode("tls13 " + label);
  const hkdfLabel = new Uint8Array(2 + 1 + labelBuf.length + 1 + context.length);
  let p = 0;
  hkdfLabel[p++] = (length >> 8) & 0xFF;
  hkdfLabel[p++] = length & 0xFF;
  hkdfLabel[p++] = labelBuf.length;
  hkdfLabel.set(labelBuf, p); p += labelBuf.length;
  hkdfLabel[p++] = context.length;
  hkdfLabel.set(context, p);

  const key = await crypto.subtle.importKey("raw", secret, {name: "HMAC", hash: "SHA-256"}, false, ["sign"]);
  const info = new Uint8Array(hkdfLabel.length + 1);
  info.set(hkdfLabel);
  info[info.length-1] = 0x01; 
  
  const rawKey = await crypto.subtle.sign("HMAC", key, info);
  return new Uint8Array(rawKey).slice(0, length);
}

function parseServerHello(buf) {
  let p = 0;
  // Type(1) + Len(3) + Ver(2) + Rand(32)
  if (buf[p] !== 2) return null;
  p += 1 + 3 + 2;
  const random = buf.slice(p, p+32);
  p += 32;
  const sessIDLen = buf[p]; p += 1 + sessIDLen;
  p += 2 + 1; // Cipher + Comp
  const extTotalLen = (buf[p]<<8)|buf[p+1]; p += 2;
  const end = p + extTotalLen;
  
  while(p < end) {
    const type = (buf[p]<<8)|buf[p+1];
    const len = (buf[p+2]<<8)|buf[p+3];
    p += 4;
    if (type === 0x0033) { 
      const kLen = (buf[p+2]<<8)|buf[p+3];
      return { keyShare: buf.slice(p+4, p+4+kLen), random }; 
    }
    p += len;
  }
  return null;
}

function xorSeq(iv, seq) {
  for (let i = 0; i < 8; i++) iv[iv.length - 1 - i] ^= (seq >> (i * 8)) & 0xFF;
}

function concat(a, b) {
  const c = new Uint8Array(a.length + b.length);
  c.set(a); c.set(b, a.length);
  return c;
}

function hasFinishedMessage(buffer) {
  // 扫描 handshake buffer 检查是否有 Finished 消息 (type 20)
  let offset = 0;
  while (offset + 4 <= buffer.length) {
    const type = buffer[offset];
    const len = (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | buffer[offset + 3];
    if (type === 20) return true; // Finished message found
    if (offset + 4 + len > buffer.length) break;
    offset += 4 + len;
  }
  return false;
}

// ... CheckWithDebounce ...
function checkWithDebounce(site, result, debounceMinutes) { 
  const detected = result.status;
  const now = Date.now();
  if (!site.statusRaw) site.statusRaw = site.status;
  site.statusRaw = detected;
  if (site.status === 'unknown') {
    site.status = detected;
    return { statusChanged: true, pendingChanged: false };
  }
  if (detected === site.status) {
    const pendingChanged = site.statusPending !== null;
    site.statusPending = null;
    site.statusPendingStartTime = null;
    return { statusChanged: false, pendingChanged };
  }
  if (site.statusPending !== detected) {
    site.statusPending = detected;
    site.statusPendingStartTime = now;
    return { statusChanged: false, pendingChanged: true };
  }
  const elapsedMinutes = (now - site.statusPendingStartTime) / 60000;
  if (elapsedMinutes >= debounceMinutes) {
    site.status = detected;
    site.statusPending = null;
    site.statusPendingStartTime = null;
    return { statusChanged: true, pendingChanged: false };
  }
  return { statusChanged: false, pendingChanged: true };
}
function handleStatusChange(env, ctx, state, site, result, previousStatus) { 
  const isDown = result.status === 'offline';
  const isRecovered = previousStatus === 'offline' && (result.status === 'online' || result.status === 'slow');
  const cfg = state.config?.notifications;
  if (isDown) {
    const inc = recordIncident(state, site, { type: 'down', title: '站点离线', message: result.message, status: result.status });
    if (cfg?.enabled) ctx && ctx.waitUntil(sendNotifications(env, inc, site, cfg));
  } else if (isRecovered) {
    const lastDown = state.incidents[site.id]?.find(i => i.type === 'down');
    const downDuration = lastDown ? Date.now() - lastDown.createdAt : 0;
    const inc = recordIncident(state, site, { type: 'recovered', title: '站点恢复', message: '服务恢复', status: result.status, downDuration });
    if (cfg?.enabled && !shouldThrottleAndMark(state, inc, cfg)) ctx && ctx.waitUntil(sendNotifications(env, inc, site, cfg));
  }
}
function updateHistory(state, siteId, result) {
  if (!state.history[siteId]) state.history[siteId] = [];
  state.history[siteId].push({ timestamp: result.timestamp, status: result.status, statusCode: result.statusCode, responseTime: result.responseTime });
}
function cleanupOldData(state, siteId) { 
  const retention = state.config.retentionHours * 3600000;
  const threshold = Date.now() - retention;
  if (state.history[siteId]) state.history[siteId] = state.history[siteId].filter(r => r.timestamp > threshold);
  if (state.incidents[siteId]) state.incidents[siteId] = state.incidents[siteId].filter(i => i.createdAt > threshold);
}
function cleanupOrphanedData(state) { 
  const ids = new Set(state.sites.map(s => s.id));
  ['history', 'incidents', 'certificateAlerts'].forEach(key => {
    if (state[key]) Object.keys(state[key]).forEach(id => { if (!ids.has(id)) delete state[key][id]; });
  });
}
function cleanupIncidentIndex(state, ms) { 
  if (!state.incidentIndex) return;
  const threshold = Date.now() - ms;
  state.incidentIndex = state.incidentIndex.filter(i => i.createdAt > threshold);
}
function recordIncident(state, site, payload) { 
  if (!state.incidents[site.id]) state.incidents[site.id] = [];
  const incident = { id: `${site.id}_${Date.now()}_${payload.type}`, siteId: site.id, siteName: site.name, createdAt: Date.now(), ...payload };
  state.incidents[site.id].unshift(incident);
  if (!state.incidentIndex) state.incidentIndex = [];
  state.incidentIndex.unshift(incident);
  return incident;
}
function shouldThrottleAndMark(state, incident, cfg) { 
  if (!cfg?.cooldown) return false;
  const key = `${incident.siteId}:${incident.type}`;
  const now = Date.now();
  const last = state.lastNotifications?.[key] || 0;
  if (now - last < cfg.cooldown) return true;
  if (!state.lastNotifications) state.lastNotifications = {};
  state.lastNotifications[key] = now;
  return false;
}
function handleCertAlert(state, site, prev, next) { 
  if (!next?.daysLeft) return null;
  const thresholds = [30, 7, 1];
  const days = next.daysLeft;
  if (!state.certificateAlerts[site.id]) state.certificateAlerts[site.id] = {};
  const alerts = state.certificateAlerts[site.id];
  for (const t of thresholds) {
    if (days <= t && !alerts[t]) {
      alerts[t] = true;
      return recordIncident(state, site, { type: 'cert_warning', title: '证书即将过期', message: `剩余 ${days} 天`, daysLeft: days });
    } else if (days > t) alerts[t] = false;
  }
  return null;
}