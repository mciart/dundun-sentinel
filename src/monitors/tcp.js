import { connect } from 'cloudflare:sockets';

export async function checkTcpSite(site, checkTime) {
  const startTime = Date.now();

  // Mock mode for TCP checks
  if (site && site.mock && typeof site.mock === 'object' && site.mock.forceStatus) {
    return {
      timestamp: checkTime,
      status: site.mock.forceStatus,
      statusCode: site.mock.statusCode || 0,
      responseTime: site.mock.responseTime || 0,
      message: site.mock.message || '模拟'
    };
  }

  const host = site.tcpHost || '';
  const port = parseInt(site.tcpPort, 10) || 80;
  
  if (!host) {
    return {
      timestamp: checkTime,
      status: 'offline',
      statusCode: 0,
      responseTime: 0,
      message: '未配置主机名'
    };
  }

  try {
    // 设置超时
    const timeoutMs = 15000; // 15秒超时
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('TCP_TIMEOUT')), timeoutMs);
    });
    
    // 使用 Cloudflare 原生 connect() API 建立 TCP 连接
    const connectPromise = (async () => {
      const socket = connect({ hostname: host, port: port });
      // 等待连接建立
      await socket.opened;
      // 连接成功，关闭 socket
      await socket.close();
      return true;
    })();
    
    // 竞争：连接成功 vs 超时
    await Promise.race([connectPromise, timeoutPromise]);
    clearTimeout(timeoutId);
    
    const responseTime = Date.now() - startTime;
    
    // 连接成功，端口开放
    let finalStatus = 'online';
    let finalMessage = `端口 ${port} 开放`;
    
    if (responseTime > 10000) {
      finalStatus = 'slow';
      finalMessage = `端口 ${port} 开放 (响应缓慢)`;
    } else if (responseTime > 5000) {
      finalStatus = 'slow';
      finalMessage = `端口 ${port} 开放 (响应较慢)`;
    }
    
    return {
      timestamp: checkTime,
      status: finalStatus,
      statusCode: 0,
      responseTime,
      message: finalMessage
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errMsg = (error && (error.message || String(error))) || '';
    const msgLower = errMsg.toLowerCase();
    
    // 检查是否是超时
    if (errMsg === 'TCP_TIMEOUT' || msgLower.includes('timeout') || msgLower.includes('etimedout')) {
      return {
        timestamp: checkTime,
        status: 'offline',
        statusCode: 0,
        responseTime,
        message: `端口 ${port} 超时 (可能被防火墙过滤)`
      };
    }
    
    // 检查是否是连接被拒绝（端口关闭）
    const isConnectionRefused = msgLower.includes('refused') || 
                                 msgLower.includes('econnrefused') ||
                                 msgLower.includes('connection refused') ||
                                 msgLower.includes('reset');
    
    if (isConnectionRefused) {
      return {
        timestamp: checkTime,
        status: 'offline',
        statusCode: 0,
        responseTime,
        message: `端口 ${port} 关闭 (连接被拒绝)`
      };
    }
    
    // 检查是否是 DNS 解析失败
    if (msgLower.includes('getaddrinfo') || msgLower.includes('enotfound') || msgLower.includes('dns')) {
      return {
        timestamp: checkTime,
        status: 'offline',
        statusCode: 0,
        responseTime,
        message: `主机 ${host} DNS解析失败`
      };
    }
    
    // 其他错误
    return {
      timestamp: checkTime,
      status: 'offline',
      statusCode: 0,
      responseTime,
      message: `端口 ${port} 检测失败: ${errMsg.substring(0, 50)}`
    };
  }
}
