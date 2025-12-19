// Monitor controllers: trigger check, test notifications
import { jsonResponse, errorResponse } from '../../utils.js';
import { getState } from '../../core/state.js';
import { handleMonitor, sendNotifications } from '../../monitor.js';

export async function triggerCheck(request, env, ctx) {
  try {
    // 同步执行监控任务（等待完成后再返回）
    await handleMonitor(env, ctx, true);
    return jsonResponse({ success: true, message: '监控任务已完成' });
  } catch (error) {
    return errorResponse('触发监控失败: ' + error.message, 500);
  }
}

export async function triggerCheckAsync(request, env, ctx) {
  try {
    ctx.waitUntil(handleMonitor(env, ctx, true));
    return jsonResponse({ success: true, message: '监控任务已触发' });
  } catch (error) {
    return errorResponse('触发监控失败: ' + error.message, 500);
  }
}

export async function testNotification(request, env) {
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
