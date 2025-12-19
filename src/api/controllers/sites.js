// Sites controllers: CRUD and related helpers
import { calculateStats } from '../../core/stats.js';
import { generateId, isValidUrl, isValidDomain, isValidHost, jsonResponse, errorResponse } from '../../utils.js';
import { getState, updateState } from '../../core/state.js';

export async function getSites(request, env) {
  try {
    const state = await getState(env);
    return jsonResponse(state.sites || []);
  } catch (e) {
    return errorResponse('获取站点失败: ' + e.message, 500);
  }
}

export async function addSite(request, env) {
  try {
    const site = await request.json();
    const isDns = site.monitorType === 'dns';
    const isTcp = site.monitorType === 'tcp';
    
    if (isDns) {
      if (!site.url || !isValidDomain(site.url)) {
        return errorResponse('无效的域名', 400);
      }
    } else if (isTcp) {
      if (!site.tcpHost || !isValidHost(site.tcpHost)) {
        return errorResponse('无效的主机名', 400);
      }
      if (!site.tcpPort || isNaN(parseInt(site.tcpPort)) || parseInt(site.tcpPort) < 1 || parseInt(site.tcpPort) > 65535) {
        return errorResponse('无效的端口号（必须为 1-65535）', 400);
      }
    } else {
      if (!site.url || !isValidUrl(site.url)) {
        return errorResponse('无效的 URL', 400);
      }
    }

    const state = await getState(env);
    const newSite = {
      id: generateId(),
      name: site.name || '未命名站点',
      url: isTcp ? '' : site.url,
      status: 'unknown',
      responseTime: 0,
      lastCheck: 0,
      groupId: site.groupId || 'default',
      monitorType: site.monitorType || 'http',
      method: site.method || 'GET',
      headers: site.headers || {},
      expectedCodes: site.expectedCodes || [200],
      responseKeyword: site.responseKeyword || '',
      responseForbiddenKeyword: site.responseForbiddenKeyword || '',
      dnsRecordType: site.dnsRecordType || 'A',
      dnsExpectedValue: site.dnsExpectedValue || '',
      tcpHost: site.tcpHost || '',
      tcpPort: site.tcpPort ? parseInt(site.tcpPort, 10) : 0,
      showUrl: site.showUrl || false,
      sortOrder: site.sortOrder || (state.sites ? state.sites.length : 0),
      createdAt: Date.now()
    };

    state.sites.push(newSite);
    state.history = state.history || {};
    state.history[newSite.id] = [];
    await updateState(env, state);

    return jsonResponse({ success: true, site: newSite });
  } catch (error) {
    return errorResponse('添加站点失败: ' + error.message, 500);
  }
}

export async function updateSite(request, env, siteId) {
  try {
    const updates = await request.json();
    const state = await getState(env);
    const siteIndex = state.sites.findIndex(s => s.id === siteId);
    if (siteIndex === -1) return errorResponse('站点不存在', 404);

    const oldSite = state.sites[siteIndex];
    const newMonitorType = updates.monitorType || oldSite.monitorType || 'http';

    const criticalFields = [
      'url','monitorType','method','expectedCodes','responseKeyword','responseForbiddenKeyword','dnsRecordType','dnsExpectedValue','tcpHost','tcpPort'
    ];

    const changedFields = criticalFields.filter(field => {
      if (updates[field] === undefined) return false;
      if (Array.isArray(updates[field]) && Array.isArray(oldSite[field])) {
        return JSON.stringify(updates[field]) !== JSON.stringify(oldSite[field]);
      }
      return updates[field] !== oldSite[field];
    });

    const needReset = changedFields.length > 0;

    if (newMonitorType === 'tcp') {
      if (updates.tcpHost && !isValidHost(updates.tcpHost)) {
        return errorResponse('无效的主机名', 400);
      }
      if (updates.tcpPort !== undefined) {
        const port = parseInt(updates.tcpPort, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          return errorResponse('无效的端口号（必须为 1-65535）', 400);
        }
        updates.tcpPort = port;
      }
    } else if (updates.url) {
      if (newMonitorType === 'dns') {
        if (!isValidDomain(updates.url)) {
          return errorResponse('无效的域名', 400);
        }
      } else {
        if (!isValidUrl(updates.url)) {
          return errorResponse('无效的 URL', 400);
        }
      }
    }

    state.sites[siteIndex] = { ...oldSite, ...updates };

    if (needReset) {
      state.sites[siteIndex].status = 'unknown';
      state.sites[siteIndex].statusRaw = null;
      state.sites[siteIndex].statusPending = null;
      state.sites[siteIndex].statusPendingStartTime = null;
      state.sites[siteIndex].lastCheckTime = null;
      state.sites[siteIndex].responseTime = null;
      state.sites[siteIndex].message = null;
      state.sites[siteIndex].sslCert = null;
      state.sites[siteIndex].sslCertLastCheck = null;
      if (state.history && state.history[siteId]) {
        state.history[siteId] = [];
      }
    }

    await updateState(env, state);

    return jsonResponse({ success: true, site: state.sites[siteIndex], configChanged: needReset, changedFields });
  } catch (error) {
    return errorResponse('更新站点失败: ' + error.message, 500);
  }
}

export async function deleteSite(request, env, siteId) {
  try {
    const state = await getState(env);
    state.sites = state.sites.filter(s => s.id !== siteId);
    delete state.history?.[siteId];
    delete state.incidents?.[siteId];
    delete state.certificateAlerts?.[siteId];
    if (Array.isArray(state.incidentIndex)) {
      state.incidentIndex = state.incidentIndex.filter(inc => inc?.siteId !== siteId);
    }
    if (state.lastNotifications) {
      Object.keys(state.lastNotifications).forEach(key => {
        if (key.startsWith(`${siteId}:`)) delete state.lastNotifications[key];
      });
    }
    await updateState(env, state);
    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse('删除站点失败: ' + error.message, 500);
  }
}

export async function reorderSites(request, env) {
  try {
    const { siteIds } = await request.json();
    if (!Array.isArray(siteIds) || siteIds.length === 0) return errorResponse('无效的站点ID列表', 400);
    const state = await getState(env);
    siteIds.forEach((id, index) => {
      const site = state.sites.find(s => s.id === id);
      if (site) site.sortOrder = index;
    });
    await updateState(env, state);
    return jsonResponse({ success: true, message: '站点排序已更新' });
  } catch (error) {
    return errorResponse('更新排序失败: ' + error.message, 500);
  }
}

export async function getHistory(request, env, siteId) {
  try {
    const state = await getState(env);
    const history = state.history[siteId] || [];
    return jsonResponse({ siteId, history, stats: calculateStats(history) });
  } catch (error) {
    return errorResponse('获取历史失败: ' + error.message, 500);
  }
}
