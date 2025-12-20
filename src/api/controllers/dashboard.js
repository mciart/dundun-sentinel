// Dashboard controllers: public data, stats, history batch, and incidents
import { jsonResponse, errorResponse } from '../../utils.js';
import { getState, getSiteStatusCache, getHistoryCache } from '../../core/state.js';
import { calculateStats } from '../../core/stats.js';
import { getPushHeartbeatCache } from './push.js';

export async function getDashboardData(request, env) {
  try {
    const state = await getState(env);
    const sites = Array.isArray(state.sites) ? state.sites : [];
    
    // 获取内存缓存中的心跳数据（Push 类型）
    const heartbeatCache = getPushHeartbeatCache();
    // 获取站点状态缓存（HTTP/DNS/TCP 类型）
    const statusCache = getSiteStatusCache();

    const publicSites = sites.map(site => {
      // 基础数据
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
        // Push 监控相关字段
        monitorType: site.monitorType || 'http',
        lastHeartbeat: site.lastHeartbeat || 0,
        pushData: site.pushData || null,
        showInHostPanel: site.showInHostPanel !== false,  // 是否显示在主机监控面板
        // DNS 监控相关字段
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
      
      // 非 Push 类型：检查站点状态缓存是否有更新的数据
      if (site.monitorType !== 'push' && statusCache.has(site.id)) {
        const cached = statusCache.get(site.id);
        // 只有缓存数据比 KV 数据更新时才使用
        if (cached.lastCheck > siteData.lastCheck) {
          siteData.status = cached.status || siteData.status;
          siteData.responseTime = cached.responseTime || siteData.responseTime;
          siteData.lastCheck = cached.lastCheck || siteData.lastCheck;
        }
      }
      
      return siteData;
    });

    const groups = state.config?.groups || [{ id: 'default', name: '默认分类', order: 0 }];
    const settings = {
      siteName: state.config?.siteName || '炖炖守望',
      siteSubtitle: state.config?.siteSubtitle || '慢慢炖，网站不 "糊锅"',
      pageTitle: state.config?.pageTitle || '网站监控'
    };

    const incidents = Array.isArray(state.incidentIndex) ? state.incidentIndex : [];

    return jsonResponse({ sites: publicSites, groups, settings, incidents });
  } catch (error) {
    return errorResponse('获取仪表盘失败: ' + error.message, 500);
  }
}

export async function getStats(request, env) {
  try {
    const state = await getState(env);
    const estimatedDailyWrites = Math.round(1440 / (state.config?.checkInterval || 10));
    
    return jsonResponse({
      ...state.stats,
      estimated: {
        dailyWrites: estimatedDailyWrites,
        quotaUsage: ((state.stats?.writes?.today || 0) / 1000 * 100).toFixed(1)
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
    const state = await getState(env);
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    
    // 获取历史记录缓存
    const historyCacheData = getHistoryCache();

    const historyMap = {};
    for (const site of (state.sites || [])) {
      // 从 KV 获取历史数据
      const raw = (state.history && state.history[site.id]) ? state.history[site.id] : [];
      
      // 合并内存缓存中的历史数据
      const cachedRecords = historyCacheData.get(site.id) || [];
      const merged = [...raw, ...cachedRecords];
      
      // 过滤和排序
      const history = merged
        .filter(record => record && typeof record.timestamp === 'number' && record.timestamp >= cutoffTime)
        .sort((a, b) => b.timestamp - a.timestamp);
      
      // 去重（基于 timestamp）
      const seen = new Set();
      const deduped = history.filter(record => {
        if (seen.has(record.timestamp)) return false;
        seen.add(record.timestamp);
        return true;
      });
      
      const stats = calculateStats(deduped);
      historyMap[site.id] = { history: deduped, stats };
    }

    return jsonResponse(historyMap);
  } catch (error) {
    return errorResponse('获取历史数据失败: ' + error.message, 500);
  }
}

export async function getIncidents(request, env) {
  try {
    const state = await getState(env);
    const incidentList = Array.isArray(state.incidentIndex) ? state.incidentIndex : [];
    return jsonResponse({
      incidents: incidentList
    });
  } catch (error) {
    return errorResponse('获取事件失败: ' + error.message, 500);
  }
}

export async function getStatus(request, env) {
  try {
    const state = await getState(env);
    return jsonResponse({
      sites: state.sites || [],
      config: state.config || {},
      stats: state.stats || {},
      lastUpdate: state.lastUpdate
    });
  } catch (error) {
    return errorResponse('获取状态失败: ' + error.message, 500);
  }
}
