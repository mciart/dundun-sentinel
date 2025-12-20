// EdgeOne Cron - 监控检测任务
// 每15分钟执行一次（在 edgeone.json 中配置）

import { handleMonitor } from '../src/monitor.js';

// 创建环境对象
function createEnv(context) {
  return {
    ENVIRONMENT: 'production',
    MONITOR_DATA: context.kv,
  };
}

// EdgeOne Cron Trigger 入口
export async function onCron(context) {
  console.log('=== EdgeOne Cron: 开始监控检测 ===');
  console.log('执行时间:', new Date().toISOString());
  
  try {
    const env = createEnv(context);
    const ctx = {
      waitUntil: (promise) => {
        if (context.waitUntil) {
          context.waitUntil(promise);
        } else {
          promise.catch(console.error);
        }
      }
    };
    
    // 执行监控检测
    await handleMonitor(env, ctx, false);
    
    console.log('=== EdgeOne Cron: 监控检测完成 ===');
    
  } catch (error) {
    console.error('Cron 监控检测错误:', error);
    throw error;
  }
}

// 也支持 HTTP 触发（用于手动触发）
export async function onRequest(context) {
  const { request } = context;
  
  // 验证 Cron Secret
  const authHeader = request.headers.get('Authorization');
  const cronSecret = context.env?.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    await onCron(context);
    
    return new Response(JSON.stringify({
      success: true,
      message: '监控检测完成',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      error: '监控检测失败',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
