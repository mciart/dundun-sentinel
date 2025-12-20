// EdgeOne Node Functions 入口 - 处理所有 /api/* 请求
// Node Functions 支持完整的 Node.js 环境，包括原生 TCP 监控

import { handleAPI } from '../../src/api.js';

// 创建兼容的环境对象
function createEnv(context) {
  // 1. 优先尝试 context.env 中的绑定 (标准方式)
  let kv = context.env?.MONITOR_DATA;
  
  // 2. 如果没有，尝试 process.env (Node.js 兼容方式)
  if (!kv && process.env && process.env.MONITOR_DATA) {
    kv = process.env.MONITOR_DATA;
  }
  
  // 3. 调试日志：部署后查看函数日志可确认 KV 是否获取成功
  if (!kv) {
    console.error('❌ CRITICAL ERROR: MONITOR_DATA is missing!');
    console.log('Available context keys:', Object.keys(context.env || {}));
    console.log('Available process keys:', Object.keys(process.env || {}).filter(k => !k.includes('PATH')).slice(0, 20));
  } else {
    console.log('✅ MONITOR_DATA linked successfully. Type:', typeof kv);
  }

  return {
    ENVIRONMENT: process.env.NODE_ENV || 'production',
    MONITOR_DATA: kv,
    // 透传其他环境变量
    ...context.env
  };
}

export async function onRequest(context) {
  const { request } = context;
  
  // CORS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
  
  // 构造 ctx 对象
  const ctx = {
    waitUntil: (promise) => {
      // Node.js 环境中的异步任务处理
      if (context.waitUntil) {
        context.waitUntil(promise);
      } else {
        // 确保异步任务不会导致未捕获异常
        Promise.resolve(promise).catch(err => {
          console.error('Background task error:', err);
        });
      }
    }
  };

  try {
    const env = createEnv(context);
    
    // 调用核心 API 处理逻辑
    return await handleAPI(request, env, ctx);
    
  } catch (error) {
    console.error('Node Function API Error:', error);
    return new Response(JSON.stringify({
      error: '服务器内部错误',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
