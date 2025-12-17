import { handleMonitor, handleCertCheck } from './monitor';
import { handleAPI } from './api';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API 路由处理
    if (path.startsWith('/api/')) {
      return handleAPI(request, env, ctx);
    }

    // 静态资源处理
    try {
      // 尝试从 Assets 获取文件
      const assetResponse = await env.ASSETS.fetch(request);
      
      // 如果是 404 且不是静态文件（没有扩展名），返回 index.html（SPA 路由）
      if (assetResponse.status === 404 && !path.match(/\.[a-zA-Z0-9]+$/)) {
        const indexRequest = new Request(new URL('/', request.url), request);
        return env.ASSETS.fetch(indexRequest);
      }
      
      return assetResponse;
    } catch (error) {
      // 如果 Assets 不可用（本地开发未启用 Assets），返回简单消息
      return new Response('Static assets not available in this mode', { status: 404 });
    }
  },

  async scheduled(event, env, ctx) {
    try {
      const scheduledTime = new Date(event.scheduledTime);
      const cronExpr = event.cron || '';

      console.log('Cron 触发时间 (UTC):', scheduledTime.toISOString());
      console.log('Cron 表达式:', cronExpr);
      console.log('Cron 触发时间 (北京):', new Date(scheduledTime.getTime() + 8 * 60 * 60 * 1000).toLocaleString('zh-CN'));

      if (cronExpr === '0 4 * * *') {
        console.log('执行SSL证书检测任务...');
        await handleCertCheck(env, ctx);
      } else {
        await handleMonitor(env, ctx);
      }
    } catch (error) {
      console.error('Cron 执行错误:', error);
    }
  }
};
