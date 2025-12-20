// Dashboard controllers: public data, stats, history batch, and incidents - D1 版本
import { jsonResponse, errorResponse } from '../../utils.js';
import * as db from '../../core/storage.js';
import { calculateStats } from '../../core/stats.js';
import { getPushHeartbeatCache } from './push.js';

export async function getDashboardData(request, env) {
  try {
    // 确保数据库已初始化
    await db.initDatabase(env);
    
    const sites = await db.getAllSites(env);
    const groups = await db.getAllGroups(env);
    const settings = await db.getSettings(env);
    const incidents = await db.getAllIncidents(env, 50);
    
    // 获取内存缓存中的心跳数据（Push 类型，同一实例内）
    const heartbeatCache = getPushHeartbeatCache();

    const publicSites = sites.map(site => {
      const siteData = {
        id: site.id,
        name: site.name,
        status: site.status || 'unknown',
        responseTime: site.responseTime || 0,
        lastCheck: site.lastCheck || 0,
        groupId: site.groupId || 'default',
        showUrl: site.showUrl || false,
        url: site.showUrl ? site.url : undefined,
        sslCert: site.sslCert || null,
        sslCertLastCheck: site.sslCertLastCheck || 0,
        sortOrder: site.sortOrder || 0,
        createdAt: site.createdAt || 0,
        monitorType: site.monitorType || 'http',
        lastHeartbeat: site.lastHeartbeat || 0,
        pushData: site.pushData || null,
        showInHostPanel: site.showInHostPanel !== false,
        dnsRecordType: site.dnsRecordType || 'A'
      };
      
      // 如果是 Push 类型且内存缓存中有更新的数据，使用缓存数据
      if (site.monitorType === 'push' && heartbeatCache.has(site.id)) {
        const cached = heartbeatCache.get(site.id);
        siteData.status = cached.status || siteData.status;
        siteData.lastHeartbeat = cached.lastHeartbeat || siteData.lastHeartbeat;
        siteData.pushData = cached.pushData || siteData.pushData;
        siteData.responseTime = cached.pushData?.latency || siteData.responseTime;
      }
      
      return siteData;
    });

    const formattedGroups = groups.map(g => ({
      id: g.id,
      name: g.name,
      order: g.order || 0
    }));

    return jsonResponse({ 
      sites: publicSites, 
      groups: formattedGroups, 
      settings: {
        siteName: settings.siteName || '炖炖守望',
        siteSubtitle: settings.siteSubtitle || '慢慢炖，网站不 "糊锅"',
        pageTitle: settings.pageTitle || '网站监控'
      }, 
      incidents 
    });
  } catch (error) {
    console.error('getDashboardData error:', error);
    return errorResponse('获取仪表盘失败: ' + error.message, 500);
  }
}

export async function getStats(request, env) {
  try {
    const stats = await db.getTodayStats(env);
    const settings = await db.getSettings(env);
    const sites = await db.getAllSites(env);
    
    const checkInterval = settings.checkInterval || 10;
    const estimatedDailyWrites = Math.round(1440 / checkInterval);
    
    return jsonResponse({
      writes: {
        today: stats.writes,
        total: stats.writes
      },
      checks: {
        today: stats.checks,
        total: stats.checks
      },
      sites: {
        total: sites.length,
        online: sites.filter(s => s.status === 'online').length,
        offline: sites.filter(s => s.status === 'offline').length
      },
      estimated: {
        dailyWrites: estimatedDailyWrites,
        quotaUsage: (stats.writes / 100000 * 100).toFixed(2)  // D1 有 100,000 次/天
      }
    });
  } catch (error) {
    return errorResponse('获取统计失败: ' + error.message, 500);
  }
}

export async function getHistoryBatch(request, env) {
  try {
    const url = new URL(request.url);
    const hours = parseInt(url.searchParams.get('hours') || '24', 10);
    
    const sites = await db.getAllSites(env);
    const siteIds = sites.map(s => s.id);
    
    // 批量获取历史记录
    const historyMap = await db.batchGetSiteHistory(env, siteIds, hours);
    
    // 计算统计数据
    const result = {};
    for (const site of sites) {
      const history = historyMap[site.id] || [];
      const stats = calculateStats(history);
      result[site.id] = { history, stats };
    }

    return jsonResponse(result);
  } catch (error) {
    return errorResponse('获取历史数据失败: ' + error.message, 500);
  }
}

export async function getIncidents(request, env) {
  try {
    const incidents = await db.getAllIncidents(env, 100);
    return jsonResponse({ incidents });
  } catch (error) {
    return errorResponse('获取事件失败: ' + error.message, 500);
  }
}

export async function getStatus(request, env) {
  try {
    const sites = await db.getAllSites(env);
    const settings = await db.getSettings(env);
    const stats = await db.getTodayStats(env);
    
    return jsonResponse({
      sites,
      config: settings,
      stats,
      lastUpdate: Date.now()
    });
  } catch (error) {
    return errorResponse('获取状态失败: ' + error.message, 500);
  }
}
