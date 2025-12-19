

import { formatTime, floorToMinute } from './utils';
import { calculateStats } from './core/stats.js';
import { getMonitorForSite } from './monitors/index.js';
export { sendNotifications } from './notifications/index.js';

export async function handleMonitor(env, ctx, forceWrite = false) {
  const startTime = Date.now();
  console.log(forceWrite ? '=== 开始监控检测（强制写入）===' : '=== 开始监控检测 ===');

  let state = await env.MONITOR_DATA.get('monitor_state', { type: 'json' });
  
  if (!state) {
    console.log('首次运行，初始化状态...');
    state = initializeState();
    await env.MONITOR_DATA.put('monitor_state', JSON.stringify(state));
    console.log('状态初始化完成');
    return;
  }

  const now = Date.now();

  if (!state.incidents) state.incidents = {};
  if (!Array.isArray(state.incidentIndex)) state.incidentIndex = [];
  if (!state.certificateAlerts) state.certificateAlerts = {};
  if (!state.history) state.history = {};
  if (!state.sites) state.sites = [];

  // 确保 stats 对象存在
  if (!state.stats) {
    state.stats = {
      checks: { total: 0, today: 0 },
      writes: { total: 0, today: 0, forced: 0, statusChange: 0 },
      sites: { total: 0, online: 0, offline: 0 }
    };
  }
  if (!state.stats.checks) state.stats.checks = { total: 0, today: 0 };
  if (!state.stats.writes) state.stats.writes = { total: 0, today: 0, forced: 0, statusChange: 0 };
  if (!state.stats.sites) state.stats.sites = { total: 0, online: 0, offline: 0 };

  if (!state.config) state.config = {};
  

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
          

          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth();
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
    await env.MONITOR_DATA.put('monitor_state', JSON.stringify(state));
  } else {
    const minutesRemain = Math.max(0, Math.ceil((state.monitorNextDueAt - now) / 60000));
    console.log(`⏭️ 跳过写入，距下次 ${minutesRemain} 分钟 (间隔 ${state.config.checkInterval} 分钟)`);
  }

  const elapsed = Date.now() - startTime;
  console.log(`=== 监控完成，耗时 ${elapsed}ms，检查了 ${state.sites.length} 个站点 ===`);
}

export async function handleCertCheck(env, ctx) {
  console.log('开始执行SSL证书检测任务...');

  const state = await env.MONITOR_DATA.get('monitor_state', { type: 'json' });
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
  await env.MONITOR_DATA.put('monitor_state', JSON.stringify(state));

  const checkedCount = Object.keys(certResults).length;
  console.log(`SSL证书检测完成，检查了 ${checkedCount} 个HTTPS站点`);
}

function initializeState() {
  return {
    version: 1,
    lastUpdate: Date.now(),
    
    config: {
      historyHours: 24,              
      retentionHours: 720,           
      checkInterval: 10,             
      statusChangeDebounceMinutes: 3, 
      siteName: '炖炖守望',
      siteSubtitle: '慢慢炖，网站不"糊锅"',
      pageTitle: '网站监控',
      
      notifications: {
        enabled: false,
        events: ['down', 'recovered', 'cert_warning'],
        channels: {
          email: {
            enabled: false,
            to: '',
            from: '' 
          },
          wecom: {
            enabled: false,
            webhook: ''
          }
        }
      },
      groups: [
        {
          id: 'default',
          name: '默认分类',
          order: 0,
          createdAt: Date.now()
        }
      ]
    },
    
    sites: [],
    
    history: {},
    
    incidents: {},
    incidentIndex: [],
    certificateAlerts: {},
    
    stats: {
      writes: {
        total: 0,
        today: 0,
        yesterday: 0,
        forced: 0,
        statusChange: 0,
        lastResetDate: getBeijingDate()
      },
      checks: {
        total: 0,
        today: 0,
        yesterday: 0
      },
      sites: {
        total: 0,
        online: 0,
        offline: 0
      }
    }
  };
}


function getBeijingDate() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return beijingTime.toISOString().split('T')[0];
}

function shouldResetStats(state) {
  const today = getBeijingDate();
  return state.stats.writes.lastResetDate !== today;
}

function resetDailyStats(state) {
  const yesterday = state.stats.writes.lastResetDate;
  const yesterdayWrites = state.stats.writes.today;
  const yesterdayChecks = state.stats.checks.today;
  
  console.log(`📊 日期变更，重置统计: ${yesterday} 写入 ${yesterdayWrites} 次，检测 ${yesterdayChecks} 次`);
  

  state.stats.writes.yesterday = yesterdayWrites;
  state.stats.checks.yesterday = yesterdayChecks;
  

  state.stats.writes.today = 0;
  state.stats.writes.forced = 0;
  state.stats.writes.statusChange = 0;
  state.stats.checks.today = 0;
  state.stats.writes.lastResetDate = getBeijingDate();
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

export function getLatestIncidents(state, limit) {
  if (!state || !Array.isArray(state.incidentIndex)) return [];
  const list = [...state.incidentIndex];
  const sliceLimit = (typeof limit === 'number' && Number.isFinite(limit) && limit > 0)
    ? limit
    : list.length;
  return list.slice(0, sliceLimit).map(item => ({
    id: item.id,
    siteId: item.siteId,
    siteName: item.siteName,
    type: item.type,
    title: item.title,
    message: item.message,
    createdAt: item.createdAt,
    status: item.status,
    previousStatus: item.previousStatus,
    responseTime: item.responseTime,
    daysLeft: item.daysLeft
  }));
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


function shouldNotifyEvent(cfg, type) {
  if (!cfg || cfg.enabled !== true) return false;
  if (Array.isArray(cfg.events)) return cfg.events.includes(type);
  return true;
}

// `sendWeComNotification` moved to `src/notifications/wecom.js`.


function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}天${hours % 24}小时${minutes % 60}分钟`;
  } else if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

/* sendEmailNotification moved to src/notifications/email.js */
async function _sendEmailNotification_moved() {
  const emailCfg = cfg?.channels?.email || {};
  if (!emailCfg.enabled || !emailCfg.to) return;
  

  const resendApiKey = emailCfg.resendApiKey;
  if (!resendApiKey) {
    console.warn('邮件通知已启用但未配置 Resend API Key');
    return;
  }
  
  const fromEmail = emailCfg.from && emailCfg.from.includes('@') ? emailCfg.from : 'onboarding@resend.dev';
  const siteName = stateSiteName(cfg);

  let prefix, headerBg, headerIcon, headerTitle, siteTitle, message, boxBg, boxBorder, labelColor;
  const dataRows = [];
  
  const notifyTime = new Date(incident.createdAt).toLocaleString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai'
  });

  if (incident.type === 'down') {
    prefix = '异常了';
    headerBg = '#fb7185';
    headerIcon = '😵';
    headerTitle = '哎呀，出问题了！';
    siteTitle = `${site.name} 挂掉了`;
    message = `看起来你的网站刚刚由于 <b>${incident.message || '未知错误'}</b> 倒下了。<br>希望能尽快修复它！`;
    boxBg = '#fffbeb';
    boxBorder = '#d97706';
    labelColor = '#b45309';
    dataRows.push(['⏰ 通知时间', notifyTime]);
    if (incident.responseTime) {
      dataRows.push(['🐢 响应时间', `${incident.responseTime}ms`]);
    }
    dataRows.push(['🔍 错误详情', incident.message || '服务异常']);
  } else if (incident.type === 'recovered') {
    prefix = '恢复了';
    headerBg = '#4ade80';
    headerIcon = '🎉';
    headerTitle = '好耶，复活了！';
    siteTitle = `${site.name} 恢复正常`;
    message = '经过一番折腾，你的网站终于重新上线了！<br>一切看起来都很完美';
    boxBg = '#f0fdf4';
    boxBorder = '#16a34a';
    labelColor = '#15803d';
    if (incident.downDuration) {
      dataRows.push(['⏱️ 异常时长', formatDuration(incident.downDuration)]);
    }
    if (incident.responseTime) {
      dataRows.push(['⚡ 当前响应', `${incident.responseTime}ms`]);
    }
    if (typeof incident.monthlyDownCount === 'number') {
      dataRows.push(['📉 本月异常', `${incident.monthlyDownCount}次`]);
    }
    dataRows.push(['⏰ 恢复时间', notifyTime]);
  } else if (incident.type === 'cert_warning') {
    prefix = '证书快到期';
    headerBg = '#fbbf24';
    headerIcon = '📜';
    headerTitle = '证书快过期啦！';
    siteTitle = site.name;
    const daysLeft = incident.daysLeft ?? 0;
    message = `你的 SSL 证书即将在 <b>${daysLeft}天</b> 后过期。<br>别忘了及时续费哦，不然会有大红锁！`;
    boxBg = '#fff7ed';
    boxBorder = '#ea580c';
    labelColor = '#c2410c';
    if (incident.certIssuer) {
      dataRows.push(['🏢 颁发者', incident.certIssuer]);
    }
    if (incident.certValidTo) {
      const validToDate = new Date(incident.certValidTo);
      const dateStr = validToDate.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Shanghai'
      });
      dataRows.push(['📅 到期时间', dateStr]);
    }
    dataRows.push(['⏳ 剩余天数', `${daysLeft}天`]);
    let nextAlert = '已是最后提醒';
    if (daysLeft > 30) nextAlert = `${daysLeft - 30}天后`;
    else if (daysLeft > 7) nextAlert = `${daysLeft - 7}天后`;
    else if (daysLeft > 1) nextAlert = `${daysLeft - 1}天后`;
    dataRows.push(['🔔 下次提醒', nextAlert]);
  } else {
    return;
  }

  const subject = `炖炖守望 - ${site.name} ${prefix}`;
  

  let dataRowsHtml = '';
  dataRows.forEach((row, i) => {
    const borderBottom = i < dataRows.length - 1 ? 'border-bottom: 1px dashed #e5e7eb;' : '';
    dataRowsHtml += `
      <tr>
        <td style="padding: 10px 0; ${borderBottom} font-weight: bold; color: ${labelColor}; font-size: 14px; white-space: nowrap;">${row[0]}</td>
        <td style="padding: 10px 0; ${borderBottom} font-family: Consolas, monospace; color: #000; font-weight: bold; font-size: 14px; text-align: right;">${row[1]}</td>
      </tr>
    `;
  });

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; background: #f0f2f5; font-family: 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 500px; margin: 0 auto;">
        <tr>
            <td>
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #ffffff; border-radius: 20px; border: 3px solid #000; box-shadow: 8px 8px 0 #000; overflow: hidden;">
                    <tr>
                        <td style="background: ${headerBg}; padding: 25px; text-align: center; border-bottom: 3px solid #000;">
                            <div style="font-size: 48px; line-height: 1.2;">${headerIcon}</div>
                            <h1 style="font-size: 22px; margin: 12px 0 0 0; color: #000; font-weight: 900;">${headerTitle}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 25px; text-align: center;">
                            <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 15px; color: #000;">${siteTitle}</h2>
                            <p style="font-size: 15px; line-height: 1.6; margin: 0 0 25px; color: #4b5563;">${message}</p>
                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: ${boxBg}; border: 2px dashed ${boxBorder}; border-radius: 12px;">
                                <tr>
                                    <td style="padding: 15px 20px;">
                                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                            ${dataRowsHtml}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 3px solid #000;">
                            <p style="margin: 4px 0;">此邮件由 <b>${siteName}</b> 自动发送</p>
                            <p style="margin: 4px 0;">请勿直接回复本邮件</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendApiKey}`
    },
    body: JSON.stringify({
      from: fromEmail,
      to: emailCfg.to,
      subject,
      html
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Resend 邮件发送失败:', response.status, errorText);
  }
}

// `stateSiteName` moved to `src/notifications/email.js`.

// `sendNotifications` implementation moved to `src/notifications/index.js` and is re-exported by this module.

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

// Text decoding helper functions and HTTP monitor implementation were moved to `src/monitors/http.js` to keep encoding and content checks together.


// DNS/TCP monitor implementations moved to `src/monitors/` (see `src/monitors/dns.js` and `src/monitors/tcp.js`).
// They were extracted as part of the refactor to keep protocol implementation isolated and testable.




// `dnsResolveStatus` moved to `src/monitors/dns.js`.

// HTTP monitor implementation moved to `src/monitors/http.js`.
// The function `checkSite` now lives in that module.



export async function getHistory(env, siteId, hours = 24) {
  const state = await env.MONITOR_DATA.get('monitor_state', { type: 'json' });
  
  if (!state || !state.history || !state.history[siteId]) {
    return [];
  }

  const history = state.history[siteId];
  const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
  

  return history
    .filter(record => record.timestamp >= cutoffTime)
    .sort((a, b) => b.timestamp - a.timestamp);
}

// ...calculateStats 已迁移至 core/stats.js...

export async function getState(env) {
  const state = await env.MONITOR_DATA.get('monitor_state', { type: 'json' });
  if (!state) {
    return initializeState();
  }
  return state;
}

export async function updateState(env, state) {
  try {
    if (!state.stats) state.stats = {};
    if (!state.stats.writes) state.stats.writes = {};
    state.stats.writes.total = (state.stats.writes.total || 0) + 1;
    state.stats.writes.today = (state.stats.writes.today || 0) + 1;
    state.stats.writes.admin = (state.stats.writes.admin || 0) + 1;
  } catch {}

  state.lastUpdate = Date.now();
  await env.MONITOR_DATA.put('monitor_state', JSON.stringify(state));
}
