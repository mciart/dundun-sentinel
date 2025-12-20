import { floorToMinute } from './utils.js';
import { getMonitorForSite } from './monitors/index.js';
import * as db from './core/storage.js';
import { sendNotifications } from './notifications/index.js';
import { getPushHeartbeatCache, clearPushHeartbeatCache } from './api/controllers/push.js';

/**
 * 执行监控检测 - D1 版本
 * @param {Object} env - 环境变量
 * @param {Object} ctx - 上下文
 */
export async function handleMonitor(env, ctx) {
  const startTime = Date.now();
  console.log('=== 开始监控检测 (D1) ===');

  // 确保数据库已初始化
  await db.initDatabase(env);

  const now = Date.now();
  const sites = await db.getAllSites(env);
  const settings = await db.getSettings(env);
  
  if (!sites || sites.length === 0) {
    console.log('暂无监控站点');
    return;
  }

  const debounceMinutes = settings.statusChangeDebounceMinutes || 3;
  const checkInterval = settings.checkInterval || 10;
  
  console.log(`📋 配置: 检测间隔=${checkInterval}分钟, 防抖时间=${debounceMinutes}分钟`);

  // 处理缓存的 Push 心跳数据（同一实例内的快速读取）
  const pushCache = getPushHeartbeatCache();
  if (pushCache.size > 0) {
    console.log(`📡 处理 ${pushCache.size} 个 Push 心跳缓存...`);
    clearPushHeartbeatCache();
  }

  // 根据监控类型分别检测（排除 Push 类型，Push 通过心跳上报）
  const sitesToCheck = sites.filter(s => s.monitorType !== 'push');
  const checkPromises = sitesToCheck.map(site => {
    const checker = getMonitorForSite(site);
    return checker(site, now);
  });
  const results = await Promise.all(checkPromises);

  // 准备批量更新
  const statusUpdates = [];
  const historyRecords = [];
  let onlineCount = 0;

  for (let i = 0; i < sitesToCheck.length; i++) {
    const site = sitesToCheck[i];
    const result = results[i];

    const previousStatus = site.status;
    const { statusChanged, newStatus, pendingChanged } = checkWithDebounce(site, result, debounceMinutes);

    // 处理状态变化通知
    if (statusChanged && previousStatus !== newStatus) {
      await handleStatusChange(env, ctx, site, previousStatus, newStatus, result, settings);
    }

    // 收集更新
    statusUpdates.push({
      siteId: site.id,
      status: newStatus,
      responseTime: result.responseTime,
      lastCheck: now,
      message: result.message || null
    });

    // 只有状态确认后才写入历史记录
    if (!pendingChanged) {
      historyRecords.push({
        siteId: site.id,
        timestamp: now,
        status: newStatus,
        statusCode: result.statusCode,
        responseTime: result.responseTime,
        message: result.message
      });
    }

    if (newStatus === 'online') {
      onlineCount++;
    }
  }

  // 统计 Push 站点
  const pushSites = sites.filter(s => s.monitorType === 'push');
  for (const site of pushSites) {
    if (site.status === 'online') {
      onlineCount++;
    }
    // 检查 Push 站点超时
    const pushTimeout = (site.pushInterval || 60) * 2 * 1000; // 超时时间为间隔的2倍
    if (site.lastHeartbeat && now - site.lastHeartbeat > pushTimeout) {
      if (site.status !== 'offline') {
        statusUpdates.push({
          siteId: site.id,
          status: 'offline',
          responseTime: 0,
          lastCheck: now,
          message: '心跳超时'
        });
        console.log(`⚠️ Push 站点 ${site.name} 心跳超时`);
      }
    }
  }

  // 批量更新站点状态
  if (statusUpdates.length > 0) {
    await db.batchUpdateSiteStatus(env, statusUpdates);
  }

  // 批量添加历史记录
  if (historyRecords.length > 0) {
    await db.batchAddHistory(env, historyRecords);
  }

  // 增加检测统计
  await db.incrementStats(env, 'checks', sites.length);

  // 每小时清理一次旧数据
  const retentionHours = settings.retentionHours || 720;
  const lastCleanup = await db.getConfig(env, 'lastCleanup') || 0;
  if (now - lastCleanup >= 60 * 60 * 1000) {
    console.log('🧹 清理旧历史记录...');
    await db.cleanupOldHistory(env, retentionHours);
    await db.setConfig(env, 'lastCleanup', now);
  }

  // SSL 证书检测 - 每小时检测一次
  const lastSslCheck = await db.getConfig(env, 'lastSslCheck') || 0;
  if (now - lastSslCheck >= 60 * 60 * 1000) {
    const httpSites = sites.filter(s => s.monitorType !== 'dns' && s.monitorType !== 'tcp' && s.monitorType !== 'push');
    if (httpSites.length > 0) {
      console.log('🔒 开始检测SSL证书...');
      await checkSSLCertificates(env, ctx, httpSites, settings);
      await db.setConfig(env, 'lastSslCheck', now);
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`=== 监控完成，耗时 ${elapsed}ms，检查了 ${sites.length} 个站点 ===`);
}

/**
 * SSL 证书检测任务
 */
export async function handleCertCheck(env, ctx) {
  console.log('开始执行SSL证书检测任务...');
  
  await db.initDatabase(env);
  
  const sites = await db.getAllSites(env);
  const settings = await db.getSettings(env);
  
  const httpSites = sites.filter(s => s.monitorType !== 'dns' && s.monitorType !== 'tcp' && s.monitorType !== 'push');
  
  if (httpSites.length > 0) {
    await checkSSLCertificates(env, ctx, httpSites, settings);
  }
  
  console.log('SSL证书检测完成');
}

/**
 * 检测 SSL 证书
 */
async function checkSSLCertificates(env, ctx, sites, settings) {
  try {
    const certResults = await batchCheckSSLCertificates(sites);
    
    for (const site of sites) {
      if (site.url) {
        try {
          const domain = new URL(site.url).hostname;
          const certInfo = certResults[domain];
          
          if (certInfo) {
            // 检查是否需要告警
            await handleCertAlert(env, ctx, site, certInfo, settings);
            
            // 更新站点的证书信息
            await db.updateSite(env, site.id, {
              sslCert: certInfo,
              sslCertLastCheck: Date.now()
            });
          }
        } catch (e) {
          console.log(`SSL检测 ${site.name} 失败:`, e.message);
        }
      }
    }
    
    console.log(`SSL证书检测完成，共 ${Object.keys(certResults).length} 个站点`);
  } catch (error) {
    console.error('SSL证书检测失败:', error);
  }
}

/**
 * 状态变化处理
 */
async function handleStatusChange(env, ctx, site, previousStatus, newStatus, result, settings) {
  const now = Date.now();
  
  if (previousStatus !== 'offline' && newStatus === 'offline') {
    // 站点离线
    const incident = {
      id: `${site.id}_${now}_down`,
      siteId: site.id,
      siteName: site.name,
      startTime: now,
      status: 'ongoing',
      reason: result.message || '站点离线'
    };
    
    await db.createIncident(env, incident);
    
    // 发送通知
    if (settings.notifications?.enabled) {
      const cfg = settings.notifications;
      if (cfg.events?.includes('down')) {
        ctx && ctx.waitUntil(sendNotifications(env, {
          type: 'down',
          title: '站点离线',
          message: result.message || '站点离线',
          siteName: site.name,
          siteId: site.id
        }, site, cfg));
      }
    }
    
    console.log(`🔴 ${site.name} 离线: ${result.message}`);
    
  } else if (previousStatus === 'offline' && (newStatus === 'online' || newStatus === 'slow')) {
    // 站点恢复
    const ongoingIncident = await db.getOngoingIncident(env, site.id);
    
    if (ongoingIncident) {
      const duration = now - ongoingIncident.startTime;
      await db.updateIncident(env, ongoingIncident.id, {
        endTime: now,
        status: 'resolved',
        resolvedReason: '自动恢复',
        duration
      });
    }
    
    // 发送通知
    if (settings.notifications?.enabled) {
      const cfg = settings.notifications;
      if (cfg.events?.includes('recovered')) {
        ctx && ctx.waitUntil(sendNotifications(env, {
          type: 'recovered',
          title: '站点恢复',
          message: '站点已恢复正常',
          siteName: site.name,
          siteId: site.id
        }, site, cfg));
      }
    }
    
    console.log(`🟢 ${site.name} 恢复`);
  }
}

/**
 * 证书告警处理
 */
async function handleCertAlert(env, ctx, site, certInfo, settings) {
  if (!certInfo || typeof certInfo.daysLeft !== 'number') return;
  
  const thresholds = [30, 7, 1];
  const daysLeft = certInfo.daysLeft;
  
  const existingAlert = await db.getCertificateAlert(env, site.id);
  const lastAlertType = existingAlert?.alertType;
  
  for (const threshold of thresholds) {
    if (daysLeft <= threshold && lastAlertType !== `${threshold}days`) {
      // 发送告警
      if (settings.notifications?.enabled) {
        const cfg = settings.notifications;
        if (cfg.events?.includes('cert_warning')) {
          ctx && ctx.waitUntil(sendNotifications(env, {
            type: 'cert_warning',
            title: '证书到期提醒',
            message: daysLeft < 0 
              ? `证书已过期 ${Math.abs(daysLeft)} 天`
              : `证书剩余 ${daysLeft} 天`,
            siteName: site.name,
            siteId: site.id,
            daysLeft
          }, site, cfg));
        }
      }
      
      await db.setCertificateAlert(env, site.id, Date.now(), `${threshold}days`);
      console.log(`⚠️ ${site.name} 证书告警: 剩余 ${daysLeft} 天`);
      break;
    }
  }
}

/**
 * 状态防抖检测
 */
function checkWithDebounce(site, result, debounceMinutes) {
  const detectedStatus = result.status;
  const now = Date.now();
  let statusChanged = false;
  let pendingChanged = false;

  const validDebounceMinutes = (typeof debounceMinutes === 'number' && debounceMinutes > 0) ? debounceMinutes : 3;
  
  // 初始化防抖状态
  if (!site.statusPending) site.statusPending = null;
  if (!site.statusPendingStartTime) site.statusPendingStartTime = null;

  // 首次检测，直接确认
  if (site.status === 'unknown') {
    return { statusChanged: true, newStatus: detectedStatus, pendingChanged: false };
  }

  // 状态相同，清除 pending
  if (detectedStatus === site.status) {
    if (site.statusPending !== null) {
      pendingChanged = true;
    }
    site.statusPending = null;
    site.statusPendingStartTime = null;
    return { statusChanged: false, newStatus: site.status, pendingChanged };
  }

  // 检查是否已经在 pending 状态
  if (detectedStatus === site.statusPending && site.statusPendingStartTime) {
    const elapsedMs = now - site.statusPendingStartTime;
    const elapsedMinutes = elapsedMs / 60000;

    if (elapsedMinutes >= validDebounceMinutes) {
      console.log(`✅ ${site.name} 持续异常 ${elapsedMinutes.toFixed(1)} 分钟，确认: ${site.status} → ${detectedStatus}`);
      site.statusPending = null;
      site.statusPendingStartTime = null;
      return { statusChanged: true, newStatus: detectedStatus, pendingChanged: false };
    } else {
      console.log(`⏳ ${site.name} 等待确认: ${detectedStatus} (${elapsedMinutes.toFixed(1)}/${validDebounceMinutes} 分钟)`);
      return { statusChanged: false, newStatus: site.status, pendingChanged: true };
    }
  }

  // 新的状态变化，开始计时
  console.log(`🔄 ${site.name} 检测到状态变化: ${site.status} → ${detectedStatus}，开始计时`);
  site.statusPending = detectedStatus;
  site.statusPendingStartTime = now;
  return { statusChanged: false, newStatus: site.status, pendingChanged: true };
}

/**
 * 批量检测 SSL 证书
 */
async function batchCheckSSLCertificates(sites) {
  try {
    const validUrls = sites.filter(site => site.url && site.url.startsWith('https'));
    
    if (validUrls.length === 0) {
      return {};
    }
    
    const domains = validUrls.map(site => new URL(site.url).hostname);
    console.log(`批量检测 ${domains.length} 个域名的SSL证书...`);
    
    const response = await fetch('https://zssl.com/api/ssl/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains, IPVersion: 'default' })
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
    
    return certMap;
  } catch (error) {
    console.error('批量证书检测失败:', error.message);
    return {};
  }
}
