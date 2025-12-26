import { floorToMinute } from './utils.js';
import { getMonitorForSite } from './monitors/index.js';
import * as db from './core/storage.js';
import { sendNotifications } from './notifications/index.js';

/**
 * 执行监控检测 - D1 版本
 * @param {Object} env - 环境变量
 * @param {Object} ctx - 上下文
 * @param {Object} options - 选项
 * @param {boolean} options.forceSSL - 强制检测SSL证书
 */
export async function handleMonitor(env, ctx, options = {}) {
  const { forceSSL = false } = options;
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

  console.log(`📋 配置: 检测间隔=1分钟, 防抖时间=${debounceMinutes}分钟`);

  // 根据监控类型分别检测（排除 Push 类型，Push 通过心跳上报直接写入 D1）
  const sitesToCheck = sites.filter(s => s.monitorType !== 'push');
  const checkPromises = sitesToCheck.map(site => {
    const checker = getMonitorForSite(site);
    return checker(site, now);
  });
  const results = await Promise.all(checkPromises);

  // 处理反转模式：交换 online 和 offline 状态
  for (let i = 0; i < sitesToCheck.length; i++) {
    const site = sitesToCheck[i];
    if (site.inverted && results[i]) {
      const result = results[i];
      if (result.status === 'online' || result.status === 'slow') {
        result.status = 'offline';
        result.message = `[反转] ${result.message || '服务可访问'}`;
      } else if (result.status === 'offline') {
        result.status = 'online';
        result.message = `[反转] ${result.message || '服务不可访问'}`;
      }
    }
  }

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

    // 收集更新 - 使用实际检测状态，防抖只影响通知
    statusUpdates.push({
      siteId: site.id,
      status: result.status,  // 使用实际检测状态，而非防抖后的状态
      responseTime: result.responseTime,
      lastCheck: now,
      message: result.message || null
    });

    // 始终写入历史记录（实时反映检测结果，防抖只影响通知）
    historyRecords.push({
      siteId: site.id,
      timestamp: now,
      status: result.status,  // 使用实际检测状态，而非防抖后的状态
      statusCode: result.statusCode,
      responseTime: result.responseTime,
      message: result.message
    });

    if (result.status === 'online') {
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
        const previousStatus = site.status;
        statusUpdates.push({
          siteId: site.id,
          status: 'offline',
          responseTime: 0,
          lastCheck: now,
          message: '心跳超时'
        });
        console.log(`⚠️ Push 站点 ${site.name} 心跳超时`);

        // 发送离线通知
        await handleStatusChange(env, ctx, site, previousStatus, 'offline', {
          status: 'offline',
          message: '心跳超时',
          responseTime: 0
        }, settings);
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

  // 每小时清理一次旧数据（异步执行，不阻塞主流程）
  const retentionHours = settings.retentionHours || 720;
  const lastCleanup = await db.getConfig(env, 'lastCleanup') || 0;
  const cleanupInterval = 60 * 60 * 1000; // 1 小时
  if (now - lastCleanup >= cleanupInterval) {
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

  // 每小时检测一次 SSL 证书（异步执行，不阻塞主流程）
  const lastSslCheck = await db.getConfig(env, 'lastSslCheck') || 0;
  const sslCheckInterval = 60 * 60 * 1000; // 1 小时
  if (now - lastSslCheck >= sslCheckInterval) {
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
 * 状态防抖检测
 * 
 * 防抖逻辑改进：
 * - 恢复（offline → online/slow）：立即确认，不防抖（用户希望尽快看到恢复）
 * - 故障（online/slow → offline）：需要持续异常达到防抖时间才确认（避免短暂波动触发告警）
 * 
 * 注意：由于防抖状态不持久化到数据库，每次监控运行时 pending 状态会重置。
 * 这意味着实际上只有同一次监控周期内的多次检测才会累积防抖时间。
 * 对于恢复场景，立即确认是更好的用户体验。
 */
function checkWithDebounce(site, result, debounceMinutes) {
  const detectedStatus = result.status;
  const currentStatus = site.status;

  // 首次检测（status 为 unknown），直接确认
  if (currentStatus === 'unknown') {
    return { statusChanged: true, newStatus: detectedStatus, pendingChanged: false };
  }

  // 状态相同，无变化
  if (detectedStatus === currentStatus) {
    return { statusChanged: false, newStatus: currentStatus, pendingChanged: false };
  }

  // ===== 恢复场景：立即确认 =====
  // offline → online 或 offline → slow
  // 用户希望站点恢复时立即看到，没必要防抖
  if (currentStatus === 'offline' && (detectedStatus === 'online' || detectedStatus === 'slow')) {
    console.log(`🔄 ${site.name} 恢复检测: ${currentStatus} → ${detectedStatus}，立即确认`);
    return { statusChanged: true, newStatus: detectedStatus, pendingChanged: false };
  }

  // ===== 故障场景：需要防抖 =====
  // online/slow → offline
  // 为了避免短暂网络波动触发告警，需要持续异常一段时间
  // 但由于防抖状态不持久化，我们无法跨监控周期累积时间
  // 这里简化处理：直接确认状态变化，依赖通知层面的防抖（如果有）
  // 
  // TODO: 如果需要真正的防抖，应该将 statusPending 和 statusPendingStartTime 存入数据库

  console.log(`🔄 ${site.name} 状态变化: ${currentStatus} → ${detectedStatus}，确认更新`);
  return { statusChanged: true, newStatus: detectedStatus, pendingChanged: false };
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
