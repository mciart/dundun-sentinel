// API 处理模块 - 从 Pages Functions 迁移
import { handleMonitor, sendNotifications } from './monitor';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function generateId() {
  return `site_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function floorToMinute(timestamp) {
  const minuteMs = 60_000;
  return Math.floor(timestamp / minuteMs) * minuteMs;
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function verifyPassword(password, correctPassword) {
  return password === correctPassword;
}

function generateToken(payload) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = btoa(JSON.stringify(payload));
  return `${header}.${data}`;
}

function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

async function handleLogin(request, env) {
  try {
    const { password } = await request.json();
    
    if (!password) {
      return errorResponse('密码不能为空', 400);
    }

    const kvAdmin = await env.MONITOR_DATA.get('admin_password');
    const adminPassword = kvAdmin || 'admin123456';

    if (!verifyPassword(password, adminPassword)) {
      return errorResponse('密码错误', 401);
    }

    const token = generateToken({
      admin: true,
      exp: Date.now() + 24 * 60 * 60 * 1000
    });

    return jsonResponse({
      success: true,
      token,
      message: '登录成功'
    });

  } catch (error) {
    return errorResponse('登录失败: ' + error.message, 500);
  }
}

function requireAuth(request) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: '未提供认证信息' };
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    return { authorized: false, error: '认证信息无效或已过期' };
  }

  return { authorized: true, payload };
}

async function getState(env) {
  try {
    const data = await env.MONITOR_DATA.get('monitor_state', 'json');
    if (!data) {
      return initializeState();
    }
    return data;
  } catch (error) {
    console.error('获取状态失败:', error);
    return initializeState();
  }
}

async function updateState(env, state) {
  state.lastUpdate = Date.now();
  await env.MONITOR_DATA.put('monitor_state', JSON.stringify(state));
}

function initializeState() {
  return {
    sites: [],
    history: {},
    incidents: {},
    incidentIndex: [],
    certificateAlerts: {},
    config: {
      historyHours: 24,
      retentionHours: 720,
      checkInterval: 10,
      statusChangeDebounceMinutes: 3,
      groups: [{ id: 'default', name: '默认分类', order: 0 }],
      siteName: '炖炖守望',
      siteSubtitle: '慢慢炖，网站不 "糊锅"',
      pageTitle: '网站监控'
    },
    stats: {
      writes: { today: 0, total: 0, lastDate: '' }
    },
    lastUpdate: Date.now()
  };
}

function calculateStats(history) {
  if (!history || history.length === 0) {
    return { uptime: 100, avgResponseTime: 0, incidents: 0 };
  }

  const onlineCount = history.filter(h => h.s === 'o').length;
  const uptime = (onlineCount / history.length) * 100;

  const responseTimes = history
    .filter(h => h.r != null && h.r > 0)
    .map(h => h.r);
  const avgResponseTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;

  const incidents = history.filter((h, i, arr) => {
    if (i === 0) return h.s === 'x';
    return arr[i - 1].s !== 'x' && h.s === 'x';
  }).length;

  return { uptime, avgResponseTime, incidents };
}

// API 路由处理
export async function handleAPI(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ==================== 公开接口（不需要认证） ====================

  // 登录接口
  if (path === '/api/login' && request.method === 'POST') {
    return handleLogin(request, env);
  }

  // 获取后台路径（公开接口）
  if (path === '/api/admin-path' && request.method === 'GET') {
    try {
      const kvAdminPath = await env.MONITOR_DATA.get('admin_path');
      const adminPath = kvAdminPath || 'admin';
      return jsonResponse({ path: adminPath });
    } catch (error) {
      return errorResponse('获取后台路径失败: ' + error.message, 500);
    }
  }

  // 获取仪表盘数据（公开接口）
  if (path === '/api/dashboard' && request.method === 'GET') {
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

      // 返回事件列表供首页轮播使用
      const incidents = Array.isArray(state.incidentIndex) ? state.incidentIndex : [];

      return jsonResponse({ sites: publicSites, groups, settings, incidents });
    } catch (error) {
      return errorResponse('获取仪表盘失败: ' + error.message, 500);
    }
  }

  // 获取设置（公开接口）
  if (path === '/api/settings' && request.method === 'GET') {
    try {
      const state = await getState(env);
      return jsonResponse(state.config || {});
    } catch (error) {
      return errorResponse('获取设置失败: ' + error.message, 500);
    }
  }

  // 获取统计信息（公开接口）
  if (path === '/api/stats' && request.method === 'GET') {
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

  // 获取分类列表（公开接口）
  if (path === '/api/groups' && request.method === 'GET') {
    try {
      const state = await getState(env);
      const groups = state.config?.groups || [{ id: 'default', name: '默认分类', order: 0 }];
      return jsonResponse({ groups });
    } catch (error) {
      return errorResponse('获取分类失败: ' + error.message, 500);
    }
  }

  // 批量获取历史数据（公开接口）
  if (path === '/api/history-batch' && request.method === 'GET') {
    try {
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

  // 获取事件记录（公开接口）
  if (path === '/api/incidents' && request.method === 'GET') {
    try {
      const state = await getState(env);
      // 返回 incidentIndex 作为 incidents 数组，前端期望数组格式
      const incidentList = Array.isArray(state.incidentIndex) ? state.incidentIndex : [];
      return jsonResponse({
        incidents: incidentList
      });
    } catch (error) {
      return errorResponse('获取事件失败: ' + error.message, 500);
    }
  }

  // ==================== 需要认证的接口 ====================
  
  const auth = requireAuth(request);
  if (!auth.authorized) {
    return errorResponse(auth.error, 401);
  }

  // 获取状态（需要认证）
  if (path === '/api/status' && request.method === 'GET') {
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

  // 获取所有站点（需要认证）
  if (path === '/api/sites' && request.method === 'GET') {
    try {
      const state = await getState(env);
      return jsonResponse(state.sites || []);
    } catch (error) {
      return errorResponse('获取站点失败: ' + error.message, 500);
    }
  }

  // 手动触发检测（需要认证）
  if (path === '/api/trigger-check' && request.method === 'POST') {
    try {
      // 同步执行监控任务（等待完成后再返回）
      await handleMonitor(env, ctx, true);
      return jsonResponse({ success: true, message: '监控任务已完成' });
    } catch (error) {
      return errorResponse('触发监控失败: ' + error.message, 500);
    }
  }

  // 更新设置（需要认证）
  if (path === '/api/settings' && request.method === 'PUT') {

    try {
      const newSettings = await request.json();
      const state = await getState(env);
      state.config = { ...state.config, ...newSettings };
      await updateState(env, state);
      return jsonResponse({ success: true, config: state.config });
    } catch (error) {
      return errorResponse('更新设置失败: ' + error.message, 500);
    }
  }

  // 添加站点
  if (path === '/api/sites' && request.method === 'POST') {
    try {
      const site = await request.json();
      if (!site.url || !isValidUrl(site.url)) {
        return errorResponse('无效的 URL', 400);
      }
      
      const state = await getState(env);
      const newSite = {
        id: generateId(),
        name: site.name || '未命名站点',
        url: site.url,
        status: 'unknown',
        responseTime: 0,
        lastCheck: 0,
        groupId: site.groupId || 'default',
        method: site.method || 'GET',
        headers: site.headers || {},
        expectedCodes: site.expectedCodes || [200],
        responseKeyword: site.responseKeyword || '',
        responseForbiddenKeyword: site.responseForbiddenKeyword || '',
        showUrl: site.showUrl || false,
        sortOrder: site.sortOrder || state.sites.length,
        createdAt: Date.now()
      };

      state.sites.push(newSite);
      state.history[newSite.id] = [];
      await updateState(env, state);

      return jsonResponse({ success: true, site: newSite });
    } catch (error) {
      return errorResponse('添加站点失败: ' + error.message, 500);
    }
  }

  // 更新站点
  if (path.startsWith('/api/sites/') && request.method === 'PUT') {
    try {
      const siteId = path.split('/')[3];
      const updates = await request.json();
      
      const state = await getState(env);
      const siteIndex = state.sites.findIndex(s => s.id === siteId);
      
      if (siteIndex === -1) {
        return errorResponse('站点不存在', 404);
      }

      state.sites[siteIndex] = { ...state.sites[siteIndex], ...updates };
      await updateState(env, state);

      return jsonResponse({ success: true, site: state.sites[siteIndex] });
    } catch (error) {
      return errorResponse('更新站点失败: ' + error.message, 500);
    }
  }

  // 删除站点
  if (path.startsWith('/api/sites/') && request.method === 'DELETE') {
    try {
      const siteId = path.split('/')[3];
      const state = await getState(env);
      
      state.sites = state.sites.filter(s => s.id !== siteId);
      delete state.history[siteId];
      delete state.incidents[siteId];
      
      await updateState(env, state);

      return jsonResponse({ success: true });
    } catch (error) {
      return errorResponse('删除站点失败: ' + error.message, 500);
    }
  }

  // 获取历史数据
  if (path.startsWith('/api/history/') && request.method === 'GET') {
    try {
      const siteId = path.split('/')[3];
      const state = await getState(env);
      const history = state.history[siteId] || [];

      return jsonResponse({
        siteId,
        history,
        stats: calculateStats(history)
      });
    } catch (error) {
      return errorResponse('获取历史失败: ' + error.message, 500);
    }
  }

  // 测试通知
  if (path === '/api/test-notification' && request.method === 'POST') {
    try {
      const { type, siteId } = await request.json();
      
      if (!type || !['down', 'recovered', 'cert_warning'].includes(type)) {
        return errorResponse('无效的通知类型', 400);
      }
      
      const state = await getState(env);
      
      if (!state.config?.notifications?.enabled) {
        return errorResponse('通知功能未启用', 400);
      }
      
      let site;
      if (siteId) {
        site = state.sites.find(s => s.id === siteId);
        if (!site) {
          return errorResponse('站点不存在', 404);
        }
      } else {
        if (!state.sites || state.sites.length === 0) {
          return errorResponse('没有可用的站点', 400);
        }
        site = state.sites[Math.floor(Math.random() * state.sites.length)];
      }
      
      // 使用真实的 SSL 证书数据
      const sslCert = site.sslCert || {};
      const realDaysLeft = typeof sslCert.daysLeft === 'number' ? sslCert.daysLeft : 7;
      const realCertIssuer = sslCert.issuer || 'Let\'s Encrypt';
      const realCertValidTo = sslCert.validTo || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const incident = {
        id: 'test-' + Date.now(),
        siteId: site.id,
        siteName: site.name,
        type,
        createdAt: Date.now(),
        message: type === 'down' 
          ? '【测试】站点无法访问' 
          : type === 'recovered' 
          ? '【测试】站点已恢复正常' 
          : '【测试】证书即将到期',
        responseTime: type === 'down' ? 5000 : 200,
        downDuration: type === 'recovered' ? 300000 : undefined,
        monthlyDownCount: type === 'recovered' ? 3 : undefined,
        daysLeft: type === 'cert_warning' ? realDaysLeft : undefined,
        certIssuer: type === 'cert_warning' ? realCertIssuer : undefined,
        certValidTo: type === 'cert_warning' ? realCertValidTo : undefined
      };
      
      await sendNotifications(env, incident, site, state.config.notifications);
      
      return jsonResponse({
        success: true,
        message: '测试通知已发送',
        site: { id: site.id, name: site.name }
      });
      
    } catch (error) {
      console.error('测试通知失败:', error);
      return errorResponse('测试通知失败: ' + error.message, 500);
    }
  }

  // 站点排序
  if (path === '/api/sites/reorder' && request.method === 'POST') {
    try {
      const { siteIds } = await request.json();
      
      if (!Array.isArray(siteIds) || siteIds.length === 0) {
        return errorResponse('无效的站点ID列表', 400);
      }
      
      const state = await getState(env);
      
      siteIds.forEach((id, index) => {
        const site = state.sites.find(s => s.id === id);
        if (site) {
          site.sortOrder = index;
        }
      });
      
      await updateState(env, state);
      
      return jsonResponse({
        success: true,
        message: '站点排序已更新'
      });
    } catch (error) {
      return errorResponse('更新排序失败: ' + error.message, 500);
    }
  }

  // 手动触发监控
  if (path === '/api/monitor/trigger' && request.method === 'POST') {
    try {
      ctx.waitUntil(handleMonitor(env, ctx, true));
      return jsonResponse({ success: true, message: '监控任务已触发' });
    } catch (error) {
      return errorResponse('触发监控失败: ' + error.message, 500);
    }
  }

  // 修改密码
  if (path === '/api/password' && request.method === 'PUT') {
    try {
      const { oldPassword, newPassword } = await request.json();
      
      if (!oldPassword || !newPassword) {
        return errorResponse('旧密码和新密码不能为空', 400);
      }

      const kvAdmin = await env.MONITOR_DATA.get('admin_password');
      const adminPassword = kvAdmin || 'admin123456';

      if (!verifyPassword(oldPassword, adminPassword)) {
        return errorResponse('旧密码错误', 401);
      }

      await env.MONITOR_DATA.put('admin_password', newPassword);
      return jsonResponse({ success: true, message: '密码修改成功' });
    } catch (error) {
      return errorResponse('修改密码失败: ' + error.message, 500);
    }
  }

  // 添加分类
  if (path === '/api/groups' && request.method === 'POST') {
    try {
      const data = await request.json();
      const { name, order, icon, iconColor } = data;

      if (!name || !name.trim()) {
        return errorResponse('分类名称不能为空', 400);
      }

      const state = await getState(env);
      if (!state.config.groups) {
        state.config.groups = [{ id: 'default', name: '默认分类', order: 0 }];
      }

      if (state.config.groups.some(g => g.name === name)) {
        return errorResponse('分类名称已存在', 400);
      }

      const newGroup = {
        id: `group_${Date.now()}`,
        name: name.trim(),
        order: order || state.config.groups.length,
        icon: icon ? icon.trim() : null,
        iconColor: iconColor ? iconColor.trim() : null,
        createdAt: Date.now()
      };

      state.config.groups.push(newGroup);
      await updateState(env, state);

      return jsonResponse({
        success: true,
        group: newGroup,
        message: '分类添加成功'
      });
    } catch (error) {
      return errorResponse('添加分类失败: ' + error.message, 500);
    }
  }

  // 更新分类
  if (path.startsWith('/api/groups/') && request.method === 'PUT') {
    try {
      const groupId = path.split('/')[3];
      const data = await request.json();
      const { name, order, icon, iconColor } = data;

      if (!name || !name.trim()) {
        return errorResponse('分类名称不能为空', 400);
      }

      const state = await getState(env);
      const groupIndex = state.config.groups.findIndex(g => g.id === groupId);

      if (groupIndex === -1) {
        return errorResponse('分类不存在', 404);
      }

      if (state.config.groups.some(g => g.id !== groupId && g.name === name)) {
        return errorResponse('分类名称已存在', 400);
      }

      state.config.groups[groupIndex].name = name.trim();
      if (icon !== undefined) {
        state.config.groups[groupIndex].icon = icon ? icon.trim() : null;
      }
      if (iconColor !== undefined) {
        state.config.groups[groupIndex].iconColor = iconColor ? iconColor.trim() : null;
      }
      if (order !== undefined) {
        state.config.groups[groupIndex].order = order;
      }

      await updateState(env, state);

      return jsonResponse({
        success: true,
        group: state.config.groups[groupIndex],
        message: '分类更新成功'
      });
    } catch (error) {
      return errorResponse('更新分类失败: ' + error.message, 500);
    }
  }

  // 删除分类
  if (path.startsWith('/api/groups/') && request.method === 'DELETE') {
    try {
      const groupId = path.split('/')[3];

      if (groupId === 'default') {
        return errorResponse('不能删除默认分类', 400);
      }

      const state = await getState(env);
      const groupIndex = state.config.groups.findIndex(g => g.id === groupId);

      if (groupIndex === -1) {
        return errorResponse('分类不存在', 404);
      }

      // 将该分类下的站点移到默认分类
      const sitesInGroup = state.sites.filter(s => s.groupId === groupId);
      if (sitesInGroup.length > 0) {
        state.sites.forEach(site => {
          if (site.groupId === groupId) {
            site.groupId = 'default';
          }
        });
      }

      state.config.groups.splice(groupIndex, 1);
      await updateState(env, state);

      return jsonResponse({
        success: true,
        message: `分类已删除，${sitesInGroup.length} 个站点已移至默认分类`
      });
    } catch (error) {
      return errorResponse('删除分类失败: ' + error.message, 500);
    }
  }

  return errorResponse('接口不存在', 404);
}
