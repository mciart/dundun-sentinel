import { floorToMinute } from './utils.js';
import { getMonitorForSite } from './monitors/index.js';
import * as db from './core/storage.js';
import { sendNotifications } from './notifications/index.js';

/**
 * 执行监控检测 - D1 版本（轮流检测模式）
 * 每次 Cron 只检测一个站点，轮流进行，减少 CPU 消耗
 * @param {Object} env - 环境变量
 * @param {Object} ctx - 上下文
 * @param {Object} options - 选项
 * @param {boolean} options.forceSSL - 强制检测SSL证书
 */
export async function handleMonitor(env, ctx, options = {}) {
  const { forceSSL = false } = options;
  const startTime = Date.now();
  console.log('=== 开始监控检测 (轮流模式) ===');

  // 确保数据库已初始化
  await db.initDatabase(env);

  const now = Date.now();
  const sites = await db.getAllSites(env);
  const settings = await db.getSettings(env);

  if (!sites || sites.length === 0) {
    console.log('暂无监控站点');
    return;
  }

  // 根据监控类型筛选需要主动检测的站点（排除 Push 类型）
  const sitesToCheck = sites.filter(s => s.monitorType !== 'push');

  if (sitesToCheck.length === 0) {
    console.log('没有需要主动检测的站点');
    // 仍然需要处理 Push 站点超时
    await handlePushSitesTimeout(env, ctx, sites, settings, now);
    return;
  }

  // 获取当前检测索引
  let checkIndex = await db.getConfig(env, 'checkIndex') || 0;
  // 确保索引在有效范围内
  checkIndex = checkIndex % sitesToCheck.length;

  // 只检测当前索引对应的站点
  const site = sitesToCheck[checkIndex];
  console.log(`📋 轮流检测: 站点 ${checkIndex + 1}/${sitesToCheck.length} - ${site.name}`);

  // 执行检测
  const checker = getMonitorForSite(site);
  const result = await checker(site, now);

  // 处理反转模式
  if (site.inverted && result) {
    if (result.status === 'online' || result.status === 'slow') {
      result.status = 'offline';
      result.message = `[反转] ${result.message || '服务可访问'}`;
    } else if (result.status === 'offline') {
      result.status = 'online';
      result.message = `[反转] ${result.message || '服务不可访问'}`;
    }
  }

  const previousStatus = site.status;
  const statusChanged = previousStatus !== result.status;

  // 处理状态变化通知（立即发送，无防抖）
  if (statusChanged) {
    console.log(`🔄 ${site.name} 状态变化: ${previousStatus} → ${result.status}`);
    await handleStatusChange(env, ctx, site, previousStatus, result.status, result, settings);
  }

  // 更新站点状态
  await db.batchUpdateSiteStatus(env, [{
    siteId: site.id,
    status: result.status,
    responseTime: result.responseTime,
    lastCheck: now,
    message: result.message || null
  }]);

  // 写入历史记录
  await db.batchAddHistory(env, [{
    siteId: site.id,
    timestamp: now,
    status: result.status,
    statusCode: result.statusCode,
    responseTime: result.responseTime,
    message: result.message
  }]);

  // 更新检测索引（下次检测下一个站点）
  const nextIndex = (checkIndex + 1) % sitesToCheck.length;
  await db.setConfig(env, 'checkIndex', nextIndex);

  // 统计在线站点数（基于数据库中的状态）
  let onlineCount = sites.filter(s => s.status === 'online').length;
  if (result.status === 'online' && previousStatus !== 'online') onlineCount++;
  if (result.status !== 'online' && previousStatus === 'online') onlineCount--;

  // 处理 Push 站点超时
  const pushSites = sites.filter(s => s.monitorType === 'push');
  for (const pushSite of pushSites) {
    // 检查 Push 站点超时
    const pushTimeout = (pushSite.pushInterval || 60) * 2 * 1000; // 超时时间为间隔的2倍
    if (pushSite.lastHeartbeat && now - pushSite.lastHeartbeat > pushTimeout) {
      if (pushSite.status !== 'offline') {
        const prevStatus = pushSite.status;
        console.log(`⚠️ Push 站点 ${pushSite.name} 心跳超时`);

        // 更新状态
        await db.batchUpdateSiteStatus(env, [{
          siteId: pushSite.id,
          status: 'offline',
          responseTime: 0,
          lastCheck: now,
          message: '心跳超时'
        }]);

        // 发送离线通知
        await handleStatusChange(env, ctx, pushSite, prevStatus, 'offline', {
          status: 'offline',
          message: '心跳超时',
          responseTime: 0
        }, settings);
      }
    }
  }

  // 增加检测统计（只计算当前检测的这一个站点）
  await db.incrementStats(env, 'checks', 1);

  // 每小时清理一次旧数据（在整点执行，与 SSL 检测错开）
  const retentionHours = settings.retentionHours || 720;
  const lastCleanup = await db.getConfig(env, 'lastCleanup') || 0;
  const cleanupInterval = 60 * 60 * 1000; // 1 小时
  const minuteNow = new Date(now).getMinutes();
  // 在整点附近执行（0-2 分钟窗口）
  const isTopOfHour = minuteNow >= 0 && minuteNow <= 2;
  if (isTopOfHour && now - lastCleanup >= cleanupInterval) {
    console.log('🧹 触发异步清理旧历史记录...');
    await db.setConfig(env, 'lastCleanup', now);
    ctx && ctx.waitUntil((async () => {
      try {
        await db.cleanupOldHistory(env, retentionHours);
        await db.cleanupOldPushHistory(env, 168);
        console.log('✅ 异步清理完成');
      } catch (error) {
        console.error('❌ 异步清理失败:', error.message);
      }
    })());
  }

  // 每小时检测一次 SSL 证书（错开 30 分钟执行，避免与清理操作同时触发）
  const lastSslCheck = await db.getConfig(env, 'lastSslCheck') || 0;
  const sslCheckInterval = 60 * 60 * 1000; // 1 小时
  const currentMinute = new Date(now).getMinutes();
  // 在 30 分左右执行（29-31 分钟窗口）
  const isHalfHour = currentMinute >= 29 && currentMinute <= 31;
  if (isHalfHour && now - lastSslCheck >= sslCheckInterval) {
    const httpSites = sites.filter(s => s.monitorType !== 'dns' && s.monitorType !== 'tcp' && s.monitorType !== 'push');
    if (httpSites.length > 0) {
      console.log('🔒 触发异步SSL证书检测...');
      await db.setConfig(env, 'lastSslCheck', now);
      ctx && ctx.waitUntil((async () => {
        try {
          await checkSSLCertificates(env, ctx, httpSites, settings);
          console.log('✅ 异步SSL检测完成');
        } catch (error) {
          console.error('❌ 异步SSL检测失败:', error.message);
        }
      })());
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`=== 监控完成，耗时 ${elapsed}ms，检查了 ${sites.length} 个站点 ===`);
}

/**
 * SSL 证书检测任务 + 历史数据清理（每天凌晨 4 点执行）
 */
export async function handleCertCheck(env, ctx) {
  console.log('=== 开始执行每日维护任务 (凌晨 4 点) ===');

  await db.initDatabase(env);

  const sites = await db.getAllSites(env);
  const settings = await db.getSettings(env);

  // 1. 清理旧历史数据
  console.log('🧹 清理旧历史记录...');
  const retentionHours = settings.retentionHours || 720;
  try {
    await db.cleanupOldHistory(env, retentionHours);
    await db.cleanupOldPushHistory(env, 168);
    console.log('✅ 历史数据清理完成');
  } catch (error) {
    console.error('❌ 历史数据清理失败:', error.message);
  }

  // 2. SSL 证书检测
  const httpSites = sites.filter(s => s.monitorType !== 'dns' && s.monitorType !== 'tcp' && s.monitorType !== 'push');
  if (httpSites.length > 0) {
    console.log('🔒 检测SSL证书...');
    await checkSSLCertificates(env, ctx, httpSites, settings);
    console.log('✅ SSL证书检测完成');
  }

  console.log('=== 每日维护任务完成 ===');
}

/**
 * 处理 Push 站点超时（当没有主动检测站点时使用）
 */
async function handlePushSitesTimeout(env, ctx, sites, settings, now) {
  const pushSites = sites.filter(s => s.monitorType === 'push');
  for (const pushSite of pushSites) {
    const pushTimeout = (pushSite.pushInterval || 60) * 2 * 1000;
    if (pushSite.lastHeartbeat && now - pushSite.lastHeartbeat > pushTimeout) {
      if (pushSite.status !== 'offline') {
        const prevStatus = pushSite.status;
        console.log(`⚠️ Push 站点 ${pushSite.name} 心跳超时`);

        await db.batchUpdateSiteStatus(env, [{
          siteId: pushSite.id,
          status: 'offline',
          responseTime: 0,
          lastCheck: now,
          message: '心跳超时'
        }]);

        await handleStatusChange(env, ctx, pushSite, prevStatus, 'offline', {
          status: 'offline',
          message: '心跳超时',
          responseTime: 0
        }, settings);
      }
    }
  }
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
      type: 'down',
      startTime: now,
      status: 'ongoing',
      reason: result.message || '站点离线',
      createdAt: now
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

      // 创建恢复事件记录
      const recoveredIncident = {
        id: `${site.id}_${now}_recovered`,
        siteId: site.id,
        siteName: site.name,
        type: 'recovered',
        startTime: now,
        status: 'resolved',
        reason: `站点恢复，故障时长 ${Math.round(duration / 1000 / 60)} 分钟`,
        duration,
        createdAt: now
      };
      await db.createIncident(env, recoveredIncident);
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
      const now = Date.now();
      const message = daysLeft < 0
        ? `证书已过期 ${Math.abs(daysLeft)} 天`
        : `证书剩余 ${daysLeft} 天`;

      // 创建证书告警事件记录
      const certIncident = {
        id: `${site.id}_${now}_cert`,
        siteId: site.id,
        siteName: site.name,
        type: 'cert_warning',
        startTime: now,
        status: 'resolved',
        reason: message,
        createdAt: now
      };
      await db.createIncident(env, certIncident);

      // 发送告警
      if (settings.notifications?.enabled) {
        const cfg = settings.notifications;
        if (cfg.events?.includes('cert_warning')) {
          ctx && ctx.waitUntil(sendNotifications(env, {
            type: 'cert_warning',
            title: '证书到期提醒',
            message,
            siteName: site.name,
            siteId: site.id,
            daysLeft
          }, site, cfg));
        }
      }

      await db.setCertificateAlert(env, site.id, now, `${threshold}days`);
      console.log(`⚠️ ${site.name} 证书告警: 剩余 ${daysLeft} 天`);
      break;
    }
  }
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

    // 安全解析域名，过滤掉格式异常的 URL
    const domains = validUrls
      .map(site => {
        try {
          return new URL(site.url).hostname;
        } catch {
          console.warn(`SSL检测: 跳过无效URL - ${site.url}`);
          return null;
        }
      })
      .filter(Boolean);
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
