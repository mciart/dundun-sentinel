// Dashboard controllers: public data, stats, history batch, and incidents
import { jsonResponse, errorResponse } from '../../utils.js';
import { getState } from '../../core/state.js';
import { calculateStats } from '../../core/stats.js';

export async function getDashboardData(request, env) {
  try {
    const state = await getState(env);
    const sites = Array.isArray(state.sites) ? state.sites : [];

    const publicSites = sites.map(site => ({
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
      createdAt: site.createdAt || 0
    }));

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

    const historyMap = {};
    for (const site of (state.sites || [])) {
      const raw = (state.history && state.history[site.id]) ? state.history[site.id] : [];
      const history = raw
        .filter(record => record && typeof record.timestamp === 'number' && record.timestamp >= cutoffTime)
        .sort((a, b) => b.timestamp - a.timestamp);
      const stats = calculateStats(history);
      historyMap[site.id] = { history, stats };
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
