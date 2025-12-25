// Sites controllers: CRUD and related helpers - D1 版本
import { calculateStats } from '../../core/stats.js';
import { generateId, isValidUrl, isValidDomain, isValidHost, jsonResponse, errorResponse } from '../../utils.js';
import * as db from '../../core/storage.js';
import { generatePushToken } from '../../monitors/push.js';

export async function getSites(request, env) {
  try {
    await db.initDatabase(env);  // 确保数据库已初始化和迁移
    const sites = await db.getAllSites(env);
    return jsonResponse(sites || []);
  } catch (e) {
    return errorResponse('获取站点失败: ' + e.message, 500);
  }
}

export async function addSite(request, env) {
  try {
    await db.initDatabase(env);  // 确保数据库已初始化和迁移
    const site = await request.json();
    const isDns = site.monitorType === 'dns';
    const isTcp = site.monitorType === 'tcp';
    const isSmtp = site.monitorType === 'smtp';
    const isPush = site.monitorType === 'push';

    if (isDns) {
      if (!site.url || !isValidDomain(site.url)) {
        return errorResponse('无效的域名', 400);
      }
    } else if (isTcp) {
      if (!site.tcpHost || !isValidHost(site.tcpHost)) {
        return errorResponse('无效的主机名', 400);
      }
      if (!site.tcpPort || isNaN(parseInt(site.tcpPort)) || parseInt(site.tcpPort) < 1 || parseInt(site.tcpPort) > 65535) {
        return errorResponse('无效的端口号（必须为 1-65535）', 400);
      }
    } else if (isSmtp) {
      if (!site.smtpHost || !isValidHost(site.smtpHost)) {
        return errorResponse('无效的SMTP主机名', 400);
      }
      if (!site.smtpPort || isNaN(parseInt(site.smtpPort)) || parseInt(site.smtpPort) < 1 || parseInt(site.smtpPort) > 65535) {
        return errorResponse('无效的SMTP端口号（必须为 1-65535）', 400);
      }
      const validSecurityModes = ['smtps', 'starttls', 'none'];
      if (site.smtpSecurity && !validSecurityModes.includes(site.smtpSecurity)) {
        return errorResponse('无效的SMTP安全模式', 400);
      }
    } else if (site.monitorType === 'mysql' || site.monitorType === 'postgres' || site.monitorType === 'mongodb' || site.monitorType === 'redis') {
      if (!site.dbHost || !isValidHost(site.dbHost)) {
        return errorResponse('无效的数据库主机名', 400);
      }
      if (site.dbPort) {
        const port = parseInt(site.dbPort, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          return errorResponse('无效的端口号（必须为 1-65535）', 400);
        }
      }
    } else if (site.monitorType === 'grpc') {
      if (!site.grpcHost || !isValidHost(site.grpcHost)) {
        return errorResponse('无效的 gRPC 主机名', 400);
      }
      if (site.grpcPort) {
        const port = parseInt(site.grpcPort, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          return errorResponse('无效的端口号（必须为 1-65535）', 400);
        }
      }
    } else if (site.monitorType === 'mqtt') {
      if (!site.mqttHost || !isValidHost(site.mqttHost)) {
        return errorResponse('无效的 MQTT 主机名', 400);
      }
      if (site.mqttPort) {
        const port = parseInt(site.mqttPort, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          return errorResponse('无效的端口号（必须为 1-65535）', 400);
        }
      }
    } else if (isPush) {
      if (!site.name || site.name.trim() === '') {
        return errorResponse('请输入主机名称', 400);
      }
    } else {
      if (!site.url || !isValidUrl(site.url)) {
        return errorResponse('无效的 URL', 400);
      }
    }

    const existingSites = await db.getAllSites(env);

    const newSite = {
      id: generateId(),
      name: site.name || '未命名站点',
      url: (isTcp || isPush || isSmtp) ? '' : site.url,
      status: 'unknown',
      responseTime: 0,
      lastCheck: 0,
      groupId: site.groupId || 'default',
      monitorType: site.monitorType || 'http',
      method: site.method || 'GET',
      headers: site.headers || {},
      expectedStatus: site.expectedCodes?.[0] || 200,
      body: site.body || '',
      dnsRecordType: site.dnsRecordType || 'A',
      dnsExpectedValue: site.dnsExpectedValue || '',
      dnsServer: site.dnsServer || 'cloudflare',
      dnsServerCustom: site.dnsServerCustom || '',
      tcpHost: site.tcpHost || '',
      tcpPort: site.tcpPort ? parseInt(site.tcpPort, 10) : 0,
      // SMTP 监控相关字段
      smtpHost: site.smtpHost || '',
      smtpPort: site.smtpPort ? parseInt(site.smtpPort, 10) : 25,
      smtpSecurity: site.smtpSecurity || 'starttls',
      // 数据库监控相关字段 (MySQL/PostgreSQL/MongoDB/Redis)
      dbHost: site.dbHost || '',
      dbPort: site.dbPort ? parseInt(site.dbPort, 10) : null,
      // gRPC 监控相关字段
      grpcHost: site.grpcHost || '',
      grpcPort: site.grpcPort ? parseInt(site.grpcPort, 10) : 443,
      grpcTls: site.grpcTls !== false,
      // MQTT 监控相关字段
      mqttHost: site.mqttHost || '',
      mqttPort: site.mqttPort ? parseInt(site.mqttPort, 10) : 1883,
      showUrl: site.showUrl || false,
      notifyEnabled: site.notifyEnabled === true,  // 默认关闭通知
      inverted: site.inverted === true,  // 反转模式
      sortOrder: site.sortOrder || existingSites.length,
      createdAt: Date.now(),
      // Push 监控相关字段
      pushToken: isPush ? generatePushToken() : '',
      pushInterval: isPush ? (site.pushInterval || 60) : 60,
      showInHostPanel: isPush ? (site.showInHostPanel !== false) : false,
      lastHeartbeat: 0,
      pushData: null
    };

    await db.createSite(env, newSite);

    return jsonResponse({ success: true, site: newSite });
  } catch (error) {
    return errorResponse('添加站点失败: ' + error.message, 500);
  }
}

export async function updateSite(request, env, siteId) {
  try {
    const updates = await request.json();
    const oldSite = await db.getSite(env, siteId);

    if (!oldSite) {
      return errorResponse('站点不存在', 404);
    }

    const newMonitorType = updates.monitorType || oldSite.monitorType || 'http';

    // 验证
    if (newMonitorType === 'tcp') {
      if (updates.tcpHost && !isValidHost(updates.tcpHost)) {
        return errorResponse('无效的主机名', 400);
      }
      if (updates.tcpPort !== undefined) {
        const port = parseInt(updates.tcpPort, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          return errorResponse('无效的端口号（必须为 1-65535）', 400);
        }
        updates.tcpPort = port;
      }
    } else if (newMonitorType === 'smtp') {
      if (updates.smtpHost && !isValidHost(updates.smtpHost)) {
        return errorResponse('无效的SMTP主机名', 400);
      }
      if (updates.smtpPort !== undefined) {
        const port = parseInt(updates.smtpPort, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          return errorResponse('无效的SMTP端口号（必须为 1-65535）', 400);
        }
        updates.smtpPort = port;
      }
      const validSecurityModes = ['smtps', 'starttls', 'none'];
      if (updates.smtpSecurity && !validSecurityModes.includes(updates.smtpSecurity)) {
        return errorResponse('无效的SMTP安全模式', 400);
      }
    } else if (newMonitorType === 'mysql' || newMonitorType === 'postgres' || newMonitorType === 'mongodb' || newMonitorType === 'redis') {
      if (updates.dbHost && !isValidHost(updates.dbHost)) {
        return errorResponse('无效的数据库主机名', 400);
      }
      if (updates.dbPort !== undefined) {
        const port = parseInt(updates.dbPort, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          return errorResponse('无效的端口号（必须为 1-65535）', 400);
        }
        updates.dbPort = port;
      }
    } else if (newMonitorType === 'grpc') {
      if (updates.grpcHost && !isValidHost(updates.grpcHost)) {
        return errorResponse('无效的 gRPC 主机名', 400);
      }
      if (updates.grpcPort !== undefined) {
        const port = parseInt(updates.grpcPort, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          return errorResponse('无效的端口号（必须为 1-65535）', 400);
        }
        updates.grpcPort = port;
      }
    } else if (newMonitorType === 'mqtt') {
      if (updates.mqttHost && !isValidHost(updates.mqttHost)) {
        return errorResponse('无效的 MQTT 主机名', 400);
      }
      if (updates.mqttPort !== undefined) {
        const port = parseInt(updates.mqttPort, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          return errorResponse('无效的端口号（必须为 1-65535）', 400);
        }
        updates.mqttPort = port;
      }
    } else if (newMonitorType === 'push') {
      if (updates.pushInterval !== undefined) {
        const interval = parseInt(updates.pushInterval, 10);
        if (isNaN(interval) || interval < 10 || interval > 3600) {
          return errorResponse('心跳间隔必须在 10-3600 秒之间', 400);
        }
        updates.pushInterval = interval;
      }
      // 如果从其他类型切换到 push，生成新的 token
      if (oldSite.monitorType !== 'push' && !oldSite.pushToken) {
        updates.pushToken = generatePushToken();
      }
    } else if (updates.url) {
      if (newMonitorType === 'dns') {
        if (!isValidDomain(updates.url)) {
          return errorResponse('无效的域名', 400);
        }
      } else {
        if (!isValidUrl(updates.url)) {
          return errorResponse('无效的 URL', 400);
        }
      }
    }

    // 检查关键字段是否变化，需要重置状态
    const criticalFields = [
      'url', 'monitorType', 'method', 'expectedStatus', 'dnsRecordType', 'dnsExpectedValue', 'dnsServer', 'dnsServerCustom',
      'tcpHost', 'tcpPort', 'smtpHost', 'smtpPort', 'smtpSecurity', 'dbHost', 'dbPort', 'inverted'
    ];

    const needReset = criticalFields.some(field => {
      if (updates[field] === undefined) return false;
      return updates[field] !== oldSite[field];
    });

    if (needReset) {
      updates.status = 'unknown';
      updates.responseTime = 0;
      updates.lastCheck = 0;
      updates.sslCert = null;
      updates.sslCertLastCheck = 0;
    }

    await db.updateSite(env, siteId, updates);

    const updatedSite = await db.getSite(env, siteId);

    return jsonResponse({ success: true, site: updatedSite, configChanged: needReset });
  } catch (error) {
    return errorResponse('更新站点失败: ' + error.message, 500);
  }
}

export async function deleteSite(request, env, siteId) {
  try {
    await db.deleteSite(env, siteId);
    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse('删除站点失败: ' + error.message, 500);
  }
}

export async function reorderSites(request, env) {
  try {
    const { siteIds } = await request.json();
    if (!Array.isArray(siteIds) || siteIds.length === 0) {
      return errorResponse('无效的站点ID列表', 400);
    }

    // 批量更新排序
    for (let i = 0; i < siteIds.length; i++) {
      await db.updateSite(env, siteIds[i], { sortOrder: i });
    }

    return jsonResponse({ success: true, message: '站点排序已更新' });
  } catch (error) {
    return errorResponse('更新排序失败: ' + error.message, 500);
  }
}

export async function reorderHosts(request, env) {
  try {
    const { siteIds } = await request.json();
    if (!Array.isArray(siteIds) || siteIds.length === 0) {
      return errorResponse('无效的主机ID列表', 400);
    }

    // 批量更新主机面板排序
    for (let i = 0; i < siteIds.length; i++) {
      await db.updateSite(env, siteIds[i], { hostSortOrder: i });
    }

    return jsonResponse({ success: true, message: '主机排序已更新' });
  } catch (error) {
    return errorResponse('更新主机排序失败: ' + error.message, 500);
  }
}

export async function getHistory(request, env, siteId) {
  try {
    const settings = await db.getSettings(env);
    const hours = settings.historyHours || 24;
    const history = await db.getSiteHistory(env, siteId, hours);
    return jsonResponse({ siteId, history, stats: calculateStats(history) });
  } catch (error) {
    return errorResponse('获取历史失败: ' + error.message, 500);
  }
}
