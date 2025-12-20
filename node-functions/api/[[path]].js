// EdgeOne Node Functions 入口 - 处理所有 /api/* 请求
// Node Functions 支持完整的 Node.js 环境，包括原生 TCP 监控

import { handleAPI } from '../../src/api.js';

// 创建兼容的环境对象
function createEnv(context) {
  // 1. 优先尝试 context.env 中的绑定 (标准方式)
  let upstashUrl = context.env?.UPSTASH_REDIS_REST_URL;
  let upstashToken = context.env?.UPSTASH_REDIS_REST_TOKEN;
  
  // 2. 如果没有，尝试 process.env (Node.js 兼容方式)
  if (!upstashUrl && process.env && process.env.UPSTASH_REDIS_REST_URL) {
    upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  }
  if (!upstashToken && process.env && process.env.UPSTASH_REDIS_REST_TOKEN) {
    upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  }
  
  // 3. 调试日志：部署后查看函数日志可确认 Upstash 是否配置成功
  if (!upstashUrl || !upstashToken) {
    console.error('❌ CRITICAL ERROR: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing!');
    console.log('Available context keys:', Object.keys(context.env || {}));
    console.log('Available process keys:', Object.keys(process.env || {}).filter(k => !k.includes('PATH')).slice(0, 20));
  } else {
    console.log('✅ Upstash Redis configured successfully');
  }

  return {
    ENVIRONMENT: process.env.NODE_ENV || 'production',
    UPSTASH_REDIS_REST_URL: upstashUrl,
    UPSTASH_REDIS_REST_TOKEN: upstashToken,
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
