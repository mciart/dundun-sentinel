// API 处理模块 - 从 Pages Functions 迁移
import { errorResponse, corsHeaders, jsonResponse } from './utils.js';
import { handleLogin, changePassword as changePasswordCtrl, requireAuth } from './api/controllers/auth.js';
import * as sitesController from './api/controllers/sites.js';
import * as configController from './api/controllers/config.js';
import * as dashboardController from './api/controllers/dashboard.js';
import * as monitorController from './api/controllers/monitor.js';
import * as pushController from './api/controllers/push.js';
import { clearAllData } from './core/storage.js';

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

  // Push 心跳上报接口（公开，通过 Token 验证）
  if (path.startsWith('/api/push/') && (request.method === 'POST' || request.method === 'GET')) {
    const token = path.split('/')[3];
    return await pushController.handlePushReport(request, env, token);
  }

  // 获取后台路径（公开接口）
  if (path === '/api/admin-path' && request.method === 'GET') {
    return await configController.getAdminPath(request, env);
  }

  // 获取仪表盘数据（公开接口）
  if (path === '/api/dashboard' && request.method === 'GET') {
    return await dashboardController.getDashboardData(request, env);
  }

  // 获取设置（公开接口）
  if (path === '/api/settings' && request.method === 'GET') {
    return await configController.getSettings(request, env);
  }

  // 获取统计信息（公开接口）
  if (path === '/api/stats' && request.method === 'GET') {
    return await dashboardController.getStats(request, env);
  }

  // 获取分类列表（公开接口）
  if (path === '/api/groups' && request.method === 'GET') {
    return await configController.getGroups(request, env);
  }

  // 批量获取历史数据（公开接口）
  if (path === '/api/history-batch' && request.method === 'GET') {
    return await dashboardController.getHistoryBatch(request, env);
  }

  // 获取事件记录（公开接口）
  if (path === '/api/incidents' && request.method === 'GET') {
    return await dashboardController.getIncidents(request, env);
  }

  // 获取 Push 历史数据（公开接口）
  if (path.startsWith('/api/push-history/') && request.method === 'GET') {
    const siteId = path.split('/api/push-history/')[1];
    return await dashboardController.getPushHistory(request, env, siteId);
  }

  if (path === '/api/dev/reset-kv' && request.method === 'POST') {
    if (env.ENVIRONMENT !== 'development') {
      return errorResponse('当前环境不允许重置数据', 403);
    }
    await clearAllData(env);
    return jsonResponse({ success: true });
  }

  // ==================== 需要认证的接口 ====================

  const auth = requireAuth(request);
  if (!auth.authorized) {
    return errorResponse(auth.error, 401);
  }

  // 获取状态（需要认证）
  if (path === '/api/status' && request.method === 'GET') {
    return await dashboardController.getStatus(request, env);
  }

  // 获取所有站点（需要认证）
  if (path === '/api/sites' && request.method === 'GET') {
    return await sitesController.getSites(request, env);
  }

  // 手动触发检测（需要认证）
  if (path === '/api/trigger-check' && request.method === 'POST') {
    return await monitorController.triggerCheck(request, env, ctx);
  }

  // 更新设置（需要认证）
  if (path === '/api/settings' && request.method === 'PUT') {
    return await configController.updateSettings(request, env);
  }

  // 添加站点
  if (path === '/api/sites' && request.method === 'POST') {
    return await sitesController.addSite(request, env);
  }

  // 更新站点
  if (path.startsWith('/api/sites/') && request.method === 'PUT') {
    const siteId = path.split('/')[3];
    if (siteId === 'reorder') {
      return await sitesController.reorderSites(request, env);
    }
    return await sitesController.updateSite(request, env, siteId);
  }

  // 删除站点
  if (path.startsWith('/api/sites/') && request.method === 'DELETE') {
    const siteId = path.split('/')[3];
    return await sitesController.deleteSite(request, env, siteId);
  }

  // 获取历史数据
  if (path.startsWith('/api/history/') && request.method === 'GET') {
    const siteId = path.split('/')[3];
    return await sitesController.getHistory(request, env, siteId);
  }

  // 测试通知
  if (path === '/api/test-notification' && request.method === 'POST') {
    return await monitorController.testNotification(request, env);
  }

  // 清除所有通知历史
  if (path === '/api/incidents/clear' && request.method === 'POST') {
    try {
      const db = await import('./core/storage.js');
      await db.clearAllIncidents(env);
      return jsonResponse({ success: true, message: '通知历史已清除' });
    } catch (error) {
      return errorResponse('清除失败: ' + error.message, 500);
    }
  }

  // 站点排序
  if (path === '/api/sites/reorder' && request.method === 'POST') {
    return await sitesController.reorderSites(request, env);
  }

  // 主机排序（主机面板显示顺序）
  if (path === '/api/hosts/reorder' && request.method === 'POST') {
    return await sitesController.reorderHosts(request, env);
  }

  // 手动触发监控
  if (path === '/api/monitor/trigger' && request.method === 'POST') {
    return await monitorController.triggerCheckAsync(request, env, ctx);
  }

  // 修改密码
  if (path === '/api/password' && request.method === 'PUT') {
    return await changePasswordCtrl(request, env);
  }

  // 修改后台路径
  if (path === '/api/admin-path' && request.method === 'PUT') {
    return await configController.updateAdminPath(request, env);
  }

  // 添加分类
  if (path === '/api/groups' && request.method === 'POST') {
    return await configController.addGroup(request, env);
  }

  // 更新分类
  if (path.startsWith('/api/groups/') && request.method === 'PUT') {
    const groupId = path.split('/')[3];
    return await configController.updateGroup(request, env, groupId);
  }

  // 删除分类
  if (path.startsWith('/api/groups/') && request.method === 'DELETE') {
    const groupId = path.split('/')[3];
    return await configController.deleteGroup(request, env, groupId);
  }

  // Push 监控相关接口
  // 重新生成 Push Token
  if (path.match(/^\/api\/sites\/[^/]+\/regenerate-token$/) && request.method === 'POST') {
    const siteId = path.split('/')[3];
    return await pushController.regeneratePushToken(request, env, siteId);
  }

  // 获取 Push 配置和脚本
  if (path.match(/^\/api\/sites\/[^/]+\/push-config$/) && request.method === 'GET') {
    const siteId = path.split('/')[3];
    return await pushController.getPushConfig(request, env, siteId);
  }

  return errorResponse('接口不存在', 404);
}
