import { dnsResolveStatus } from './dns.js';

function getCharsetFromContentType(contentType) {
  if (!contentType || typeof contentType !== 'string') return 'utf-8';
  const match = contentType.match(/charset\s*=\s*([^;\s]+)/i);
  if (!match) return 'utf-8';
  let cs = match[1].replace(/"/g, '').trim().toLowerCase();

  if (cs === 'gb2312' || cs === 'gb-2312') cs = 'gbk';
  if (cs === 'x-gbk') cs = 'gbk';
  if (cs === 'windows-1252') cs = 'iso-8859-1';
  return cs || 'utf-8';
}

async function readTextWithCharset(response) {
  try {
    const ct = response.headers.get('content-type') || '';
    const charset = getCharsetFromContentType(ct);
    const buf = await response.arrayBuffer();
    try {
      return new TextDecoder(charset).decode(buf);
    } catch (_) {
      try {
        return new TextDecoder('utf-8').decode(buf);
      } catch {
        try {
          return new TextDecoder('gb18030').decode(buf);
        } catch {
          return '';
        }
      }
    }
  } catch (_) {
    return '';
  }
}

export async function checkSite(site, checkTime) {
  const startTime = Date.now();

  // Mock mode: if site.mock is provided, return simulated result for local testing
  if (site && site.mock && typeof site.mock === 'object' && site.mock.forceStatus) {
    return {
      timestamp: checkTime,
      status: site.mock.forceStatus,
      statusCode: site.mock.statusCode || 0,
      responseTime: site.mock.responseTime || 0,
      message: site.mock.message || '模拟'
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const method = (site.method || 'GET').toString().toUpperCase();
    const allowedMethods = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
    const finalMethod = allowedMethods.includes(method) ? method : 'GET';

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      ...(site.headers && typeof site.headers === 'object' ? Object.fromEntries(Object.entries(site.headers).map(([k, v]) => [k, String(v)])) : {})
    };

    const body = finalMethod === 'GET' || finalMethod === 'HEAD' ? undefined : (typeof site.body === 'string' ? site.body : undefined);

    const response = await fetch(site.url, {
      method: finalMethod,
      signal: controller.signal,
      headers,
      body
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    let isUp;
    const expected = Array.isArray(site.expectedCodes) ? site.expectedCodes.map(n => Number(n)).filter(c => Number.isFinite(c) && c > 0) : null;
    if (expected && expected.length > 0) {
      isUp = expected.includes(response.status);
    } else {
      isUp = response.ok;
    }

    let message = isUp ? 'OK' : `HTTP ${response.status}`;

    const needKeywordCheck = (typeof site.responseKeyword === 'string' && site.responseKeyword.length > 0) || (typeof site.responseForbiddenKeyword === 'string' && site.responseForbiddenKeyword.length > 0);
    if (needKeywordCheck && finalMethod !== 'HEAD') {
      try {
        const text = await readTextWithCharset(response);
        if (typeof site.responseKeyword === 'string' && site.responseKeyword.length > 0) {
          if (!text.includes(site.responseKeyword)) {
            isUp = false;
            message = `缺少关键字: ${site.responseKeyword}`;
          }
        }
        if (typeof site.responseForbiddenKeyword === 'string' && site.responseForbiddenKeyword.length > 0) {
          if (text.includes(site.responseForbiddenKeyword)) {
            isUp = false;
            message = `包含禁用关键字: ${site.responseForbiddenKeyword}`;
          }
        }
      } catch (e) {
        message = isUp ? 'OK' : message;
      }
    }

    let finalStatus = isUp ? 'online' : 'offline';
    let finalMessage = message;

    if (isUp) {
      if (responseTime > 15000) {
        finalStatus = 'slow';
        finalMessage = '响应非常缓慢';
      } else if (responseTime > 5000) {
        finalStatus = 'slow';
        finalMessage = '响应缓慢';
      } else if (responseTime > 1500) {
        finalStatus = 'online';
        finalMessage = 'OK';
      } else {
        finalStatus = 'online';
        finalMessage = 'OK';
      }
    }

    return {
      timestamp: checkTime,
      status: finalStatus,
      statusCode: response.status,
      responseTime,
      message: finalMessage
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errMsg = (error && (error.message || String(error))) || '';
    let message = errMsg;
    const msgLower = errMsg.toLowerCase();
    const hasCertIssue = msgLower.includes('certificate') || msgLower.includes('tls') || msgLower.includes('ssl') || msgLower.includes('cert') || msgLower.includes('handshake');

    const isRealTimeout = msgLower.includes('etimedout') || msgLower.includes('err_connection_timed_out') || msgLower.includes('connection timeout');
    const isAbort = (error && error.name === 'AbortError') || msgLower.includes('aborted');

    if (isRealTimeout) {
      message = '连接超时';
    } else if (isAbort && responseTime >= 30000) {
      message = '网络错误';
    } else if (isAbort) {
      message = '网络错误';
    } else {
      let hostname = '';
      try { hostname = new URL(site.url).hostname; } catch {}
      const dns = await dnsResolveStatus(hostname, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36');
      if (!(dns === 'nxdomain' || dns === 'dns_error' || dns === 'nodata')) {
        if (hasCertIssue) {
          message = '证书错误';
        } else if (msgLower.includes('refused') || msgLower.includes('econnrefused')) {
          message = '连接被拒绝';
        } else if (msgLower.includes('reset') || msgLower.includes('econnreset')) {
          message = '连接被重置';
        } else if (msgLower.includes('unreachable') || msgLower.includes('ehostunreach') || msgLower.includes('enetunreach')) {
          message = '网络不可达';
        } else if (msgLower.includes('handshake')) {
          message = 'TLS握手失败';
        } else if (!message || msgLower.includes('internal error') || msgLower.includes('fetch failed')) {
          message = '网络错误';
        }
      } else {
        // DNS 解析失败
        if (dns === 'nxdomain') {
          message = '域名不存在';
        } else if (dns === 'dns_error') {
          message = 'DNS服务器错误';
        } else if (dns === 'nodata') {
          message = '域名无A/AAAA记录';
        } else {
          message = '域名解析失败';
        }
      }
    }

    return {
      timestamp: checkTime,
      status: 'offline',
      statusCode: 0,
      responseTime,
      message
    };
  }
}
