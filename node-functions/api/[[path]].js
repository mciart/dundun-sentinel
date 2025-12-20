// EdgeOne Node Functions 入口 - 处理所有 /api/* 请求
// Node Functions 支持完整的 Node.js 环境，包括原生 TCP 监控

import { handleAPI } from '../../src/api.js';

// 创建兼容的环境对象
function createEnv(context) {
  // EdgeOne Node Functions 中，环境变量在 context.env 中
  // KV 绑定也会在 context.env 中
  return {
    ENVIRONMENT: process.env.NODE_ENV || 'production',
    // 确保在控制台绑定了 KV，变量名为 MONITOR_DATA
    MONITOR_DATA: context.env?.MONITOR_DATA || context.env?.KV,
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
