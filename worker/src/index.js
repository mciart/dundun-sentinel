import { handleMonitor, handleCertCheck } from './monitor';

export default {
  async fetch(request, env, ctx) {
    return new Response(JSON.stringify({
      name: '炖炖守望 - Worker',
      version: '1.0.0',
      status: 'running',
      message: 'Cron 任务运行中，API 请求请访问 Pages'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
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
