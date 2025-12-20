// 本地开发服务器
// 模拟 EdgeOne Node Functions 环境

import http from 'http';
import { handleAPI } from './src/api.js';

const PORT = 8787;

// 模拟 KV 存储（用于本地开发）
class MockKV {
  constructor() {
    this.data = new Map();
  }

  async get(key, options = {}) {
    const value = this.data.get(key);
    if (!value) return null;
    
    if (options.type === 'json') {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }
    return value;
  }

  async put(key, value) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    this.data.set(key, stringValue);
  }

  async delete(key) {
    this.data.delete(key);
  }

  async list() {
    return {
      keys: Array.from(this.data.keys()).map(name => ({ name }))
    };
  }
}

const mockKV = new MockKV();

// 创建模拟环境
function createMockEnv() {
  return {
    ENVIRONMENT: 'development',
    MONITOR_DATA: mockKV
  };
}

// 将 Node.js Request 转换为 Web Request
function createWebRequest(req) {
  const protocol = 'http';
  const host = req.headers.host || 'localhost';
  const url = new URL(req.url, `${protocol}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value[0] : value);
  }

  const init = {
    method: req.method,
    headers
  };

  // 处理请求体
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        init.body = body;
        resolve(new Request(url.toString(), init));
      });
    });
  }

  return Promise.resolve(new Request(url.toString(), init));
}

// 将 Web Response 转换为 Node.js Response
async function sendWebResponse(res, webResponse) {
  res.statusCode = webResponse.status;

  // 设置响应头
  webResponse.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  // 发送响应体
  const body = await webResponse.text();
  res.end(body);
}

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
  try {
    console.log(`${req.method} ${req.url}`);

    // CORS 预检
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      res.end();
      return;
    }

    // 创建模拟环境
    const env = createMockEnv();
    const ctx = {
      waitUntil: (promise) => {
        promise.catch(err => console.error('Background task error:', err));
      }
    };

    // 转换请求
    const webRequest = await createWebRequest(req);

    // 调用 API 处理函数
    const response = await handleAPI(webRequest, env, ctx);

    // 返回响应
    await sendWebResponse(res, response);

  } catch (error) {
    console.error('Server Error:', error);
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      error: '服务器内部错误',
      message: error.message
    }));
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 本地开发服务器运行在 http://localhost:${PORT}`);
  console.log(`📝 API 路由: http://localhost:${PORT}/api/*`);
  console.log(`⚠️  使用内存 KV 存储（仅用于开发）\n`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n\n👋 关闭开发服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});
