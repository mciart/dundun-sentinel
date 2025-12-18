export const DNS_TYPE_MAP = {
  'A': 1,
  'AAAA': 28,
  'CNAME': 5,
  'MX': 15,
  'NS': 2,
  'TXT': 16,
  'SOA': 6,
  'SRV': 33,
  'CAA': 257,
  'PTR': 12
};

export async function dnsResolveStatus(hostname, ua) {
  if (!hostname) return 'unknown';
  
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    
    // 并行查询 A 和 AAAA 记录，减少等待时间
    const headers = {
      'accept': 'application/dns-json',
      'user-agent': ua || 'Mozilla/5.0'
    };
    
    const [resA, resAAAA] = await Promise.allSettled([
      fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`, {
        method: 'GET',
        headers,
        signal: controller.signal
      }),
      fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=AAAA`, {
        method: 'GET',
        headers,
        signal: controller.signal
      })
    ]);
    
    clearTimeout(timer);
    
    // 处理 A 记录结果
    if (resA.status === 'fulfilled') {
      const data = await resA.value.json();
      if (data && typeof data.Status === 'number') {
        if (data.Status === 0) {
          const answers = Array.isArray(data.Answer) ? data.Answer : [];
          if (answers.some(a => a && (a.type === 1 || a.type === 5))) return 'resolved';
        }
        if (data.Status === 3) return 'nxdomain';
        if (data.Status === 2) return 'dns_error';
      }
    }
    
    // 处理 AAAA 记录结果
    if (resAAAA.status === 'fulfilled') {
      const data6 = await resAAAA.value.json();
      if (data6 && data6.Status === 0 && Array.isArray(data6.Answer) && data6.Answer.some(a => a && a.type === 28)) {
        return 'resolved';
      }
    }
    
    // 都没有有效记录
    return 'nodata';
    
  } catch (e) {
    return 'unknown';
  }
}

export async function checkDnsSite(site, checkTime) {
  const startTime = Date.now();

  // Mock mode for DNS checks
  if (site && site.mock && typeof site.mock === 'object' && site.mock.forceStatus) {
    return {
      timestamp: checkTime,
      status: site.mock.forceStatus,
      statusCode: site.mock.statusCode || 0,
      responseTime: site.mock.responseTime || 0,
      message: site.mock.message || '模拟',
      dnsRecords: site.mock.dnsRecords || []
    };
  }

  const domain = site.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
  const recordType = site.dnsRecordType || 'A';
  const expectedValue = site.dnsExpectedValue?.trim() || '';
  
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${recordType}`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/dns-json',
          'user-agent': 'Mozilla/5.0'
        },
        signal: controller.signal
      }
    );
    
    clearTimeout(timer);
    const responseTime = Date.now() - startTime;
    const data = await response.json();
    
    // DNS 状态码: 0=成功, 2=SERVFAIL, 3=NXDOMAIN
    if (data.Status === 3) {
      return {
        timestamp: checkTime,
        status: 'offline',
        statusCode: 0,
        responseTime,
        message: `域名不存在 (NXDOMAIN)`,
        dnsRecords: []
      };
    }
    
    if (data.Status === 2) {
      return {
        timestamp: checkTime,
        status: 'offline',
        statusCode: 0,
        responseTime,
        message: `DNS服务器错误 (SERVFAIL)`,
        dnsRecords: []
      };
    }
    
    if (data.Status !== 0) {
      return {
        timestamp: checkTime,
        status: 'offline',
        statusCode: 0,
        responseTime,
        message: `DNS查询失败 (状态码: ${data.Status})`,
        dnsRecords: []
      };
    }
    
    // 解析记录
    const answers = Array.isArray(data.Answer) ? data.Answer : [];
    const typeCode = DNS_TYPE_MAP[recordType] || 1;
    const records = answers
      .filter(a => a && a.type === typeCode)
      .map(a => a.data);
    
    if (records.length === 0) {
      return {
        timestamp: checkTime,
        status: 'offline',
        statusCode: 0,
        responseTime,
        message: `无 ${recordType} 记录`,
        dnsRecords: []
      };
    }
    
    // 如果设置了期望值，验证是否匹配（精确匹配）
    if (expectedValue) {
      const normalizedExpected = expectedValue.toLowerCase().replace(/\.$/, '').replace(/^"|"$/g, '');
      const matched = records.some(r => {
        const normalizedRecord = String(r).toLowerCase().replace(/\.$/, '').replace(/^"|"$/g, '');
        return normalizedRecord === normalizedExpected;
      });
      
      if (!matched) {
        return {
          timestamp: checkTime,
          status: 'offline',
          statusCode: 0,
          responseTime,
          message: `${recordType} 记录不匹配 (期望: ${expectedValue}, 实际: ${records.join(', ')})`,
          dnsRecords: records
        };
      }
    }
    
    // 检测成功
    return {
      timestamp: checkTime,
      status: 'online',
      statusCode: 200,
      responseTime,
      message: `${recordType}: ${records.slice(0, 3).join(', ')}${records.length > 3 ? '...' : ''}`,
      dnsRecords: records
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errMsg = error?.message || String(error);
    
    return {
      timestamp: checkTime,
      status: 'offline',
      statusCode: 0,
      responseTime,
      message: errMsg.includes('abort') ? 'DNS查询超时' : `DNS查询失败: ${errMsg}`,
      dnsRecords: []
    };
  }
}
