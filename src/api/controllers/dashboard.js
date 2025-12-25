// Dashboard controllers: public data, stats, history batch, and incidents - D1 版本
import { jsonResponse, errorResponse } from '../../utils.js';
import * as db from '../../core/storage.js';
import { calculateStats } from '../../core/stats.js';
import { BRAND, SETTINGS } from '../../config/index.js';

export async function getDashboardData(request, env) {
  try {
    // 确保数据库已初始化
    await db.initDatabase(env);

    const sites = await db.getAllSites(env);
    const groups = await db.getAllGroups(env);
    const settings = await db.getSettings(env);
    const incidents = await db.getAllIncidents(env, 50);

    // D1 版本：直接从数据库读取，无需内存缓存
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
      hostSortOrder: site.hostSortOrder || 0,
      createdAt: site.createdAt || 0,
      monitorType: site.monitorType || 'http',
      lastHeartbeat: site.lastHeartbeat || 0,
      pushData: site.pushData || null,
      showInHostPanel: site.showInHostPanel !== false,
      dnsRecordType: site.dnsRecordType || 'A',
      tcpPort: site.tcpPort || null,
      dbPort: site.dbPort || null
    }));

    const formattedGroups = groups.map(g => ({
      id: g.id,
      name: g.name,
      order: g.order || 0,
      icon: g.icon || null,
      iconColor: g.iconColor || null
    }));

    return jsonResponse({
      sites: publicSites,
      groups: formattedGroups,
      settings: {
        siteName: settings.siteName || BRAND.siteName,
        siteSubtitle: settings.siteSubtitle || BRAND.siteSubtitle,
        pageTitle: settings.pageTitle || BRAND.pageTitle,
        hostDisplayMode: settings.hostDisplayMode || SETTINGS.hostDisplayMode,
        hostPanelExpanded: settings.hostPanelExpanded !== false
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
    const sites = await db.getAllSites(env);

    return jsonResponse({
      checks: {
        today: stats.checks,
        total: stats.checks
      },
      sites: {
        total: sites.length,
        online: sites.filter(s => s.status === 'online').length,
        offline: sites.filter(s => s.status === 'offline').length
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

export async function getPushHistory(request, env, siteId) {
  try {
    if (!siteId) {
      return errorResponse('站点 ID 不能为空', 400);
    }

    const url = new URL(request.url);
    const hours = parseInt(url.searchParams.get('hours')) || 24;

    // 验证站点存在且是 Push 类型
    const site = await db.getSite(env, siteId);
    if (!site) {
      return errorResponse('站点不存在', 404);
    }
    if (site.monitorType !== 'push') {
      return errorResponse('该站点不是 Push 监控类型', 400);
    }

    const history = await db.getPushHistory(env, siteId, hours);

    return jsonResponse({
      siteId,
      siteName: site.name,
      history,
      hours
    });
  } catch (error) {
    return errorResponse('获取 Push 历史数据失败: ' + error.message, 500);
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
