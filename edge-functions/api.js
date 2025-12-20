// EdgeOne Edge Functions - API 入口
// 处理所有 /api/* 请求

import { handleAPI } from '../src/api.js';

// 创建环境对象
function createEnv(context) {
  return {
    ENVIRONMENT: 'production',
    // EdgeOne KV 绑定
    MONITOR_DATA: context.kv,
  };
}

// EdgeOne Edge Functions 入口
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
  
  try {
    const env = createEnv(context);
    const ctx = {
      waitUntil: (promise) => {
        // EdgeOne 支持 waitUntil
        if (context.waitUntil) {
          context.waitUntil(promise);
        } else {
          promise.catch(console.error);
        }
      }
    };
    
    // 调用 API 处理函数
    return await handleAPI(request, env, ctx);
    
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({
      error: '服务器内部错误',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}
