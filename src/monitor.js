import { floorToMinute } from './utils.js';
import { getMonitorForSite } from './monitors/index.js';
import { shouldResetStats, resetDailyStats, getState, updateState } from './core/state.js';
import { sendNotifications } from './notifications/index.js';

export async function handleMonitor(env, ctx, forceWrite = false) {
  const startTime = Date.now();
  console.log(forceWrite ? '=== 开始监控检测（强制写入）===' : '=== 开始监控检测 ===');

  let state = await getState(env);

  const now = Date.now();

  if (state.config.statusChangeDebounceCount !== undefined && state.config.statusChangeDebounceMinutes === undefined) {
    state.config.statusChangeDebounceMinutes = state.config.statusChangeDebounceCount;
    delete state.config.statusChangeDebounceCount;
    console.log(`⚙️ 配置迁移: debounceCount ${state.config.statusChangeDebounceCount} → debounceMinutes ${state.config.statusChangeDebounceMinutes}`);
  }
  
  if (!state.config.statusChangeDebounceMinutes || state.config.statusChangeDebounceMinutes <= 0) {
    state.config.statusChangeDebounceMinutes = 3;
    console.log('⚙️ 防抖时间未设置，使用默认值 3 分钟');
  }
  
  console.log(`📋 当前配置: 强制写入间隔=${state.config.checkInterval}分钟, 防抖时间=${state.config.statusChangeDebounceMinutes}分钟`);

  if (shouldResetStats(state)) {
    resetDailyStats(state);
  }

  // 根据监控类型分别检测
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

    if (pendingChanged) {
      pendingStateChanged = true;
    }

    if (statusChanged) {
      confirmedChanges.push({
        name: site.name,
        from: previousStatus,
        to: result.status
      });

      if (previousStatus !== result.status) {
        const statusPair = `${previousStatus}->${result.status}`;
        if (previousStatus !== 'offline' && result.status === 'offline') {
          const inc = recordIncident(state, site, {
            type: 'down',
            title: '站点离线',
            message: result.message || '站点离线',
            responseTime: result.responseTime || 0,
            previousStatus,
            status: result.status
          });
          try {
            const cfg = state.config?.notifications;
            if (cfg?.enabled) {
              ctx && ctx.waitUntil(sendNotifications(env, inc, site, cfg));
            }
          } catch {}
        } else if (previousStatus === 'offline' && (result.status === 'online' || result.status === 'slow')) {

          let downDuration = null;
          const siteIncidents = state.incidents[site.id] || [];
          const lastDownIncident = siteIncidents.find(i => i?.type === 'down');
          if (lastDownIncident?.createdAt) {
            downDuration = Date.now() - lastDownIncident.createdAt;
          }
          

          const nowDate = new Date();
          const currentYear = nowDate.getFullYear();
          const currentMonth = nowDate.getMonth();
          const monthlyDownCount = siteIncidents.filter(i => {
            if (i?.type !== 'down') return false;
            const incidentDate = new Date(i.createdAt);
            return incidentDate.getFullYear() === currentYear && incidentDate.getMonth() === currentMonth;
          }).length;
          
          const inc = recordIncident(state, site, {
            type: 'recovered',
            title: '站点恢复',
            message: '站点已恢复',
            responseTime: result.responseTime || 0,
            previousStatus,
            status: result.status,
            downDuration,
            monthlyDownCount
          });
          try {
            const cfg = state.config?.notifications;
            if (cfg?.enabled && !shouldThrottleAndMark(state, inc, cfg)) {
              ctx && ctx.waitUntil(sendNotifications(env, inc, site, cfg));
            }
          } catch {}
        }
        console.log(`🛈 记录事件: ${site.name} 状态切换 ${statusPair}`);
      }
    }

    site.responseTime = result.responseTime;
    site.lastCheck = now;

    if (!site.statusPending) {

      updateHistory(state, site.id, {
        ...result,
        status: site.status  
      });
    } else {
      console.log(`⏸️  ${site.name} 处于pending状态，暂不写入历史记录`);
    }

    if (site.status === 'online') {
      onlineCount++;
    }
  }

  // 批量清理旧数据（每小时执行一次，而不是每个站点每次都清理）
  const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1小时
  const lastCleanup = state.lastCleanup || 0;
  if (now - lastCleanup >= CLEANUP_INTERVAL) {
    console.log('🧹 开始清理历史数据...');
    for (const site of state.sites) {
      cleanupOldData(state, site.id);
    }
    state.lastCleanup = now;
    console.log('🧹 历史数据清理完成');
  }

  // SSL 证书检测 - 每小时检测一次（证书变化很慢，无需频繁检测）
  // 只检测 HTTP 类型的站点，DNS 类型跳过
  const SSL_CHECK_INTERVAL = 60 * 60 * 1000; // 1小时
  const lastSslCheck = state.lastSslCheck || 0;
  const shouldCheckSsl = forceWrite || (now - lastSslCheck >= SSL_CHECK_INTERVAL);
  const httpSites = state.sites.filter(s => s.monitorType !== 'dns');
  
  if (shouldCheckSsl && httpSites.length > 0) {
    console.log('开始检测SSL证书...');
    const certResults = await batchCheckSSLCertificates(httpSites);
    for (const site of httpSites) {
      if (site.url) {
        try {
          const domain = new URL(site.url).hostname;
          if (certResults[domain]) {
            const previousCert = site.sslCert;
            const nextCert = certResults[domain];
            site.sslCert = nextCert;
            site.sslCertLastCheck = Date.now();
            const inc = handleCertAlert(state, site, previousCert, nextCert);
            try {
              const cfg = state.config?.notifications;
              if (inc && cfg?.enabled && !shouldThrottleAndMark(state, inc, cfg)) {
                ctx && ctx.waitUntil(sendNotifications(env, inc, site, cfg));
              }
            } catch {}
          } else {
            // 检测失败或无证书，标记为已检测
            site.sslCert = null;
            site.sslCertLastCheck = Date.now();
          }
        } catch (e) {
          console.log(`SSL检测 ${site.name} URL解析失败:`, e.message);
        }
      }
    }
    state.lastSslCheck = now;
    console.log(`SSL证书检测完成，共 ${Object.keys(certResults).length} 个站点`);
  } else {
    const minutesUntilNext = Math.ceil((SSL_CHECK_INTERVAL - (now - lastSslCheck)) / 60000);
    console.log(`⏭️ 跳过SSL检测，距下次检测 ${minutesUntilNext} 分钟`);
  }

  // 清理孤立数据（每次监控都执行，保持数据同步）
  cleanupOrphanedData(state);

  const retentionMs = state.config.retentionHours * 60 * 60 * 1000;
  cleanupIncidentIndex(state, retentionMs);

  state.stats.checks.total++;
  state.stats.checks.today++;
  state.stats.sites.total = state.sites.length;
  state.stats.sites.online = onlineCount;
  state.stats.sites.offline = state.sites.length - onlineCount;

  const statusChanged = confirmedChanges.length > 0;
  const intervalMs = state.config.checkInterval * 60 * 1000;
  if (typeof state.monitorNextDueAt !== 'number' || !Number.isFinite(state.monitorNextDueAt)) {
    const baseline = ((typeof state.lastUpdate === 'number' && Number.isFinite(state.lastUpdate)) ? state.lastUpdate : now) + intervalMs;
    state.monitorNextDueAt = floorToMinute(baseline);
  }
  const shouldWriteByTime = now >= state.monitorNextDueAt;
  const shouldWrite = forceWrite || statusChanged || shouldWriteByTime || pendingStateChanged;

  if (shouldWrite) {
    state.stats.writes.total++;
    state.stats.writes.today++;

    let writeReason;
    if (forceWrite) {
      state.stats.writes.forced++;
      writeReason = `手动强制写入`;
    } else if (statusChanged) {
      state.stats.writes.statusChange++;
      writeReason = `状态变化 (${confirmedChanges.map(c => `${c.name}: ${c.from}→${c.to}`).join(', ')})`;
    } else {
      state.stats.writes.forced++;
      if (shouldWriteByTime) {
        writeReason = `定时强制写入 (到达计划写入时刻，间隔 ${state.config.checkInterval} 分钟)`;
      } else if (pendingStateChanged) {
        writeReason = `保存状态确认过程 (${state.sites.filter(s => s.statusPending).length} 个站点仍在确认中)`;
      } else {
        writeReason = `定时写入`;
      }
    }

    console.log(`✅ 写入 KV，原因: ${writeReason}`);

    state.lastUpdate = now;
    state.monitorNextDueAt = floorToMinute(now + intervalMs);
    await updateState(env, state);
  } else {
    const minutesRemain = Math.max(0, Math.ceil((state.monitorNextDueAt - now) / 60000));
    console.log(`⏭️ 跳过写入，距下次 ${minutesRemain} 分钟 (间隔 ${state.config.checkInterval} 分钟)`);
  }

  const elapsed = Date.now() - startTime;
  console.log(`=== 监控完成，耗时 ${elapsed}ms，检查了 ${state.sites.length} 个站点 ===`);
}

export async function handleCertCheck(env, ctx) {
  console.log('开始执行SSL证书检测任务...');

  const state = await getState(env);
  if (!state || !state.sites || state.sites.length === 0) {
    console.log('暂无监控站点');
    return;
  }
  
  const certResults = await batchCheckSSLCertificates(state.sites);

  for (const site of state.sites) {
    if (site.url) {
      const domain = new URL(site.url).hostname;
      if (certResults[domain]) {
        const previousCert = site.sslCert;
        const nextCert = certResults[domain];
        site.sslCert = nextCert;
        site.sslCertLastCheck = Date.now();
        const inc = handleCertAlert(state, site, previousCert, nextCert);
        try {
          const cfg = state.config?.notifications;
          if (inc && cfg?.enabled && !shouldThrottleAndMark(state, inc, cfg)) {
            ctx && ctx.waitUntil(sendNotifications(env, inc, site, cfg));
          }
        } catch {}
      } else {
        site.sslCert = null;
        site.sslCertLastCheck = Date.now();
      }
    }
  }

  state.lastUpdate = Date.now();
  await updateState(env, state);

  const checkedCount = Object.keys(certResults).length;
  console.log(`SSL证书检测完成，检查了 ${checkedCount} 个HTTPS站点`);
}



function checkWithDebounce(site, result, debounceMinutes) {
  const detectedStatus = result.status;
  const now = Date.now();
  let statusChanged = false;
  let pendingChanged = false;

  const validDebounceMinutes = (typeof debounceMinutes === 'number' && debounceMinutes > 0) ? debounceMinutes : 3;
  
  if (!site.statusRaw) site.statusRaw = site.status;
  if (!site.statusPending) site.statusPending = null;
  if (!site.statusPendingStartTime) site.statusPendingStartTime = null;

  site.statusRaw = detectedStatus;

  if (site.status === 'unknown') {
    console.log(`🆕 ${site.name} 首次检测，立即确认状态: ${detectedStatus}`);
    site.status = detectedStatus;
    site.statusPending = null;
    site.statusPendingStartTime = null;
    return { statusChanged: true, pendingChanged: false };
  }

 
  if (detectedStatus === site.status) {
    if (site.statusPending !== null) {
      pendingChanged = true;
    }
    site.statusPending = null;
    site.statusPendingStartTime = null;
    return { statusChanged, pendingChanged };
  }

 
  if (detectedStatus === site.statusPending && site.statusPendingStartTime) {
    const elapsedMs = now - site.statusPendingStartTime;
    const elapsedMinutes = elapsedMs / 60000;


    if (elapsedMinutes >= validDebounceMinutes) {
      console.log(`✅ ${site.name} 持续异常 ${elapsedMinutes.toFixed(1)} 分钟，确认: ${site.status} → ${detectedStatus}`);
      site.status = detectedStatus;
      site.statusPending = null;
      site.statusPendingStartTime = null;
      statusChanged = true;
    } else {
      console.log(`⏳ ${site.name} 等待确认: ${detectedStatus} (${elapsedMinutes.toFixed(1)}/${validDebounceMinutes} 分钟)`);

    }
    return { statusChanged, pendingChanged };
  }

 
  console.log(`🔄 ${site.name} 检测到状态变化: ${site.status} → ${detectedStatus}，开始计时`);
  site.statusPending = detectedStatus;
  site.statusPendingStartTime = now;
  pendingChanged = true;
  return { statusChanged, pendingChanged };
}

function updateHistory(state, siteId, result) {
  if (!state.history[siteId]) {
    state.history[siteId] = [];
  }
  
  state.history[siteId].push({
    timestamp: result.timestamp,
    status: result.status,
    statusCode: result.statusCode,
    responseTime: result.responseTime,
    message: result.message
  });
}

function cleanupOldData(state, siteId) {
  const now = Date.now();
  
  const retentionMs = state.config.retentionHours * 60 * 60 * 1000;
  
  if (state.history[siteId]) {
    state.history[siteId] = state.history[siteId].filter(
      record => now - record.timestamp <= retentionMs
    );
  }
  
  if (state.incidents[siteId]) {
    state.incidents[siteId] = state.incidents[siteId].filter(incident => {
      if (!incident) return false;
      const timestamp = typeof incident.createdAt === 'number'
        ? incident.createdAt
        : (typeof incident.end === 'number' ? incident.end : null);
      if (!timestamp) return true;
      return now - timestamp <= retentionMs;
    });
  }
}

/**
 * 清理孤立数据 - 清除已删除站点的残留数据
 */
function cleanupOrphanedData(state) {
  const validSiteIds = new Set(state.sites.map(s => s.id));
  let cleanedCount = 0;
  
  // 清理孤立的历史记录
  if (state.history) {
    Object.keys(state.history).forEach(siteId => {
      if (!validSiteIds.has(siteId)) {
        delete state.history[siteId];
        cleanedCount++;
      }
    });
  }
  
  // 清理孤立的站点事件
  if (state.incidents) {
    Object.keys(state.incidents).forEach(siteId => {
      if (!validSiteIds.has(siteId)) {
        delete state.incidents[siteId];
        cleanedCount++;
      }
    });
  }
  
  // 清理孤立的证书告警
  if (state.certificateAlerts) {
    Object.keys(state.certificateAlerts).forEach(siteId => {
      if (!validSiteIds.has(siteId)) {
        delete state.certificateAlerts[siteId];
        cleanedCount++;
      }
    });
  }
  
  // 清理全局事件索引中的孤立事件
  if (Array.isArray(state.incidentIndex)) {
    const beforeCount = state.incidentIndex.length;
    state.incidentIndex = state.incidentIndex.filter(inc => {
      if (!inc || !inc.siteId) return false;
      return validSiteIds.has(inc.siteId);
    });
    cleanedCount += beforeCount - state.incidentIndex.length;
  }
  
  // 清理孤立的通知冷却记录
  if (state.lastNotifications) {
    Object.keys(state.lastNotifications).forEach(key => {
      const siteId = key.split(':')[0];
      if (!validSiteIds.has(siteId)) {
        delete state.lastNotifications[key];
        cleanedCount++;
      }
    });
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 清理了 ${cleanedCount} 条孤立数据`);
  }
}

function recordIncident(state, site, payload) {
  const siteId = site.id;
  const now = Date.now();
  const incident = {
    id: `${siteId}_${now}_${payload.type}`,
    siteId,
    siteName: site.name,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    createdAt: now,
    status: payload.status ?? site.status,
    previousStatus: payload.previousStatus ?? null,
    responseTime: payload.responseTime ?? null,
    daysLeft: payload.daysLeft ?? null,
    downDuration: payload.downDuration ?? null,
    monthlyDownCount: payload.monthlyDownCount ?? null,
    certIssuer: payload.certIssuer ?? null,
    certValidTo: payload.certValidTo ?? null
  };

  if (!state.incidents[siteId]) {
    state.incidents[siteId] = [];
  }

  const existingIndex = state.incidents[siteId].findIndex(item => item?.id === incident.id);
  if (existingIndex !== -1) {
    state.incidents[siteId].splice(existingIndex, 1);
  }
  state.incidents[siteId].unshift(incident);

  const globalExistingIndex = state.incidentIndex.findIndex(item => item?.id === incident.id);
  if (globalExistingIndex !== -1) {
    state.incidentIndex.splice(globalExistingIndex, 1);
  }
  state.incidentIndex.unshift(incident);
  return incident;
}

function handleCertAlert(state, site, previousCert, nextCert) {
  if (!nextCert || typeof nextCert.daysLeft !== 'number') {
    return null;
  }

  const thresholds = [30, 7, 1];
  const daysLeft = nextCert.daysLeft;

  if (!state.certificateAlerts[site.id]) {
    state.certificateAlerts[site.id] = {};
  }
  const alerts = state.certificateAlerts[site.id];

  let created = null;
  for (const threshold of thresholds) {
    const alreadyNotified = alerts[threshold];
    if (daysLeft <= threshold && !alreadyNotified) {
      alerts[threshold] = true;
      const inc = recordIncident(state, site, {
        type: 'cert_warning',
        title: '证书到期提醒',
        message: daysLeft < 0
          ? `证书已过期 ${Math.abs(daysLeft)} 天`
          : `证书剩余 ${daysLeft} 天`,
        daysLeft,
        certIssuer: nextCert.issuer,
        certValidTo: nextCert.validTo
      });
      created = inc;
    } else if (daysLeft > threshold) {

      alerts[threshold] = false;
    }
  }
  return created;
}
function shouldThrottleAndMark(state, incident, cfg) {
  const cd = Number(cfg?.cooldown || 0);
  if (!cd || cd <= 0) return false;
  if (!state.lastNotifications) state.lastNotifications = {};
  const key = `${incident.siteId}:${incident.type}`;
  const now = Date.now();
  const last = state.lastNotifications[key] || 0;
  if (now - last < cd) return true;
  state.lastNotifications[key] = now;
  return false;
}

function cleanupIncidentIndex(state, retentionMs) {
  if (!Array.isArray(state.incidentIndex) || state.incidentIndex.length === 0) return;
  const now = Date.now();
  state.incidentIndex = state.incidentIndex.filter(incident => {
    if (!incident) return false;
    const timestamp = typeof incident.createdAt === 'number'
      ? incident.createdAt
      : (typeof incident.end === 'number' ? incident.end : null);
    if (!timestamp) return true;
    const withinRetention = now - timestamp <= retentionMs;
    if (!withinRetention) {
      const list = state.incidents[incident.siteId];
      if (Array.isArray(list)) {
        state.incidents[incident.siteId] = list.filter(item => item?.id !== incident.id);
      }
    }
    return withinRetention;
  });
}

async function batchCheckSSLCertificates(sites) {
  try {
    const validUrls = sites.filter(site => site.url);
    
    if (validUrls.length === 0) {
      console.log('没有站点需要检测证书');
      return {};
    }
    
    const domains = validUrls.map(site => new URL(site.url).hostname);
    console.log(`批量检测 ${domains.length} 个域名的SSL证书...`);
    
    const response = await fetch('https://zssl.com/api/ssl/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        domains: domains,
        IPVersion: 'default'
      })
    });
    
    const data = await response.json();
    
    const certMap = {};
    
    if (data.results && Array.isArray(data.results)) {
      data.results.forEach(result => {
        if (result.data && result.result === 'success') {
          const certData = result.data;
          certMap[result.domain] = {
            valid: true,
            daysLeft: certData.DaysLeft,
            issuer: certData.Issuer,
            validFrom: certData.ValidFrom,
            validTo: certData.ValidTo,
            algorithm: certData.Algorithm
          };
        }
      });
    }
    
    console.log(`成功获取 ${Object.keys(certMap).length} 个证书信息`);
    return certMap;
    
  } catch (error) {
    console.error('批量证书检测失败:', error.message);
    return {};
  }
}
