// D1 数据库存储层
// 替代 KV 存储，提供 100,000 次/天的写入配额

import { BRAND, SETTINGS, NOTIFICATIONS, TIMEOUTS, MONITOR, GROUPS } from '../config/index.js';

/**
 * 获取北京日期字符串
 */
function getBeijingDate() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return beijingTime.toISOString().split('T')[0];
}

// ==================== 配置操作 ====================

/**
 * 获取配置项
 */
export async function getConfig(env, key) {
  const result = await env.DB.prepare(
    'SELECT value FROM config WHERE key = ?'
  ).bind(key).first();
  return result ? JSON.parse(result.value) : null;
}

/**
 * 设置配置项
 */
export async function setConfig(env, key, value) {
  const now = Date.now();
  await env.DB.prepare(
    'INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)'
  ).bind(key, JSON.stringify(value), now).run();
}

/**
 * 获取数据版本号（用于缓存控制）
 */
export async function getDataVersion(env) {
  const result = await env.DB.prepare(
    "SELECT value FROM config WHERE key = 'dataVersion'"
  ).first();
  return result ? JSON.parse(result.value) : Date.now();
}

/**
 * 更新数据版本号（在数据变化时调用）
 */
export async function updateDataVersion(env) {
  const now = Date.now();
  await env.DB.prepare(
    "INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('dataVersion', ?, ?)"
  ).bind(JSON.stringify(now), now).run();
  return now;
}

/**
 * 获取全局设置
 */
export async function getSettings(env) {
  const defaults = {
    siteName: BRAND.siteName,
    siteSubtitle: BRAND.siteSubtitle,
    pageTitle: BRAND.pageTitle,
    historyHours: SETTINGS.historyHours,
    retentionHours: SETTINGS.retentionHours,
    hostDisplayMode: SETTINGS.hostDisplayMode,
    hostPanelExpanded: SETTINGS.hostPanelExpanded,
    notifications: NOTIFICATIONS.defaults,
  };

  const result = await getConfig(env, 'settings');
  if (!result) return defaults;

  // 合并默认值，确保新增字段有默认值
  return { ...defaults, ...result };
}

/**
 * 保存全局设置
 */
export async function saveSettings(env, settings) {
  await setConfig(env, 'settings', settings);
}

// ==================== 站点操作 ====================

/**
 * 获取所有站点
 */
export async function getAllSites(env) {
  const results = await env.DB.prepare(
    'SELECT * FROM sites ORDER BY sort_order ASC, created_at ASC'
  ).all();

  return (results.results || []).map(row => ({
    id: row.id,
    name: row.name,
    url: row.url,
    monitorType: row.monitor_type,
    status: row.status,
    responseTime: row.response_time,
    lastCheck: row.last_check,
    groupId: row.group_id,
    sortOrder: row.sort_order,
    hostSortOrder: row.host_sort_order || 0,
    showUrl: !!row.show_url,
    createdAt: row.created_at,
    // HTTP
    method: row.method,
    expectedStatus: row.expected_status,
    timeout: row.timeout,
    headers: row.headers ? JSON.parse(row.headers) : null,
    body: row.body,
    // DNS
    dnsRecordType: row.dns_record_type,
    dnsExpectedValue: row.dns_expected_value,
    dnsServer: row.dns_server || 'cloudflare',
    dnsServerCustom: row.dns_server_custom || '',
    // TCP
    tcpHost: row.tcp_host,
    tcpPort: row.tcp_port,
    // SMTP
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    smtpSecurity: row.smtp_security,
    // Database (MySQL/PostgreSQL)
    dbHost: row.db_host,
    dbPort: row.db_port,
    // gRPC
    grpcHost: row.grpc_host,
    grpcPort: row.grpc_port,
    grpcTls: row.grpc_tls !== 0,  // D1 存储为 0/1
    // MQTT
    mqttHost: row.mqtt_host,
    mqttPort: row.mqtt_port,
    // Push
    pushToken: row.push_token,
    pushInterval: row.push_interval,
    lastHeartbeat: row.last_heartbeat,
    pushData: row.push_data ? JSON.parse(row.push_data) : null,
    showInHostPanel: !!row.show_in_host_panel,
    // SSL
    sslCert: row.ssl_cert ? JSON.parse(row.ssl_cert) : null,
    sslCertLastCheck: row.ssl_cert_last_check,
    sslCheckEnabled: row.ssl_check_enabled !== 0,
    // 通知
    notifyEnabled: !!row.notify_enabled,
    // 反转模式
    inverted: !!row.inverted,
    // 消息
    lastMessage: row.last_message
  }));
}

/**
 * 获取单个站点
 */
export async function getSite(env, siteId) {
  const row = await env.DB.prepare(
    'SELECT * FROM sites WHERE id = ?'
  ).bind(siteId).first();

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    url: row.url,
    monitorType: row.monitor_type,
    status: row.status,
    responseTime: row.response_time,
    lastCheck: row.last_check,
    groupId: row.group_id,
    sortOrder: row.sort_order,
    hostSortOrder: row.host_sort_order || 0,
    showUrl: !!row.show_url,
    createdAt: row.created_at,
    method: row.method,
    expectedStatus: row.expected_status,
    timeout: row.timeout,
    headers: row.headers ? JSON.parse(row.headers) : null,
    body: row.body,
    dnsRecordType: row.dns_record_type,
    dnsExpectedValue: row.dns_expected_value,
    dnsServer: row.dns_server || 'cloudflare',
    dnsServerCustom: row.dns_server_custom || '',
    tcpHost: row.tcp_host,
    tcpPort: row.tcp_port,
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    smtpSecurity: row.smtp_security,
    dbHost: row.db_host,
    dbPort: row.db_port,
    grpcHost: row.grpc_host,
    grpcPort: row.grpc_port,
    grpcTls: row.grpc_tls !== 0,
    mqttHost: row.mqtt_host,
    mqttPort: row.mqtt_port,
    pushToken: row.push_token,
    pushInterval: row.push_interval,
    lastHeartbeat: row.last_heartbeat,
    pushData: row.push_data ? JSON.parse(row.push_data) : null,
    showInHostPanel: !!row.show_in_host_panel,
    sslCert: row.ssl_cert ? JSON.parse(row.ssl_cert) : null,
    sslCertLastCheck: row.ssl_cert_last_check,
    sslCheckEnabled: row.ssl_check_enabled !== 0,
    notifyEnabled: !!row.notify_enabled,
    inverted: !!row.inverted,
    lastMessage: row.last_message
  };
}

/**
 * 通过 Push Token 获取站点（优化：避免读取所有站点）
 */
export async function getSiteByPushToken(env, token) {
  const row = await env.DB.prepare(
    'SELECT * FROM sites WHERE push_token = ? AND monitor_type = ?'
  ).bind(token, 'push').first();

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    url: row.url,
    monitorType: row.monitor_type,
    status: row.status,
    responseTime: row.response_time,
    lastCheck: row.last_check,
    groupId: row.group_id,
    sortOrder: row.sort_order,
    hostSortOrder: row.host_sort_order || 0,
    showUrl: !!row.show_url,
    createdAt: row.created_at,
    pushToken: row.push_token,
    pushInterval: row.push_interval,
    lastHeartbeat: row.last_heartbeat,
    pushData: row.push_data ? JSON.parse(row.push_data) : null,
    showInHostPanel: !!row.show_in_host_panel,
    notifyEnabled: !!row.notify_enabled
  };
}

/**
 * 创建站点
 */
export async function createSite(env, site) {
  const now = Date.now();
  await env.DB.prepare(`
    INSERT INTO sites (
      id, name, url, monitor_type, status, response_time, last_check,
      group_id, sort_order, show_url, created_at,
      method, expected_status, timeout, headers, body,
      dns_record_type, dns_expected_value, dns_server, dns_server_custom,
      tcp_host, tcp_port,
      smtp_host, smtp_port, smtp_security,
      db_host, db_port,
      grpc_host, grpc_port, grpc_tls,
      mqtt_host, mqtt_port,
      push_token, push_interval, last_heartbeat, push_data, show_in_host_panel,
      ssl_cert, ssl_cert_last_check, ssl_check_enabled,
      notify_enabled, inverted, last_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    site.id,
    site.name,
    site.url,
    site.monitorType || 'http',
    site.status || 'unknown',
    site.responseTime || 0,
    site.lastCheck || 0,
    site.groupId || 'default',
    site.sortOrder || 0,
    site.showUrl ? 1 : 0,
    site.createdAt || now,
    site.method || 'GET',
    site.expectedStatus || 200,
    site.timeout || TIMEOUTS.httpTimeout,
    site.headers ? JSON.stringify(site.headers) : null,
    site.body || null,
    site.dnsRecordType || 'A',
    site.dnsExpectedValue || null,
    site.dnsServer || 'cloudflare',
    site.dnsServerCustom || null,
    site.tcpHost || null,
    site.tcpPort || null,
    site.smtpHost || null,
    site.smtpPort || MONITOR.defaultSmtpPort,
    site.smtpSecurity || 'starttls',
    site.dbHost || null,
    site.dbPort || null,
    site.grpcHost || null,
    site.grpcPort || 443,
    site.grpcTls !== false ? 1 : 0,
    site.mqttHost || null,
    site.mqttPort || 1883,
    site.pushToken || null,
    site.pushInterval || 60,
    site.lastHeartbeat || 0,
    site.pushData ? JSON.stringify(site.pushData) : null,
    site.showInHostPanel ? 1 : 0,
    site.sslCert ? JSON.stringify(site.sslCert) : null,
    site.sslCertLastCheck || 0,
    site.sslCheckEnabled !== false && site.sslCheckEnabled !== 0 ? 1 : 0,
    site.notifyEnabled ? 1 : 0,
    site.inverted ? 1 : 0,
    site.lastMessage || null
  ).run();

}

/**
 * 更新站点
 */
export async function updateSite(env, siteId, updates) {
  const site = await getSite(env, siteId);
  if (!site) return false;

  const merged = { ...site, ...updates };

  await env.DB.prepare(`
    UPDATE sites SET
      name = ?, url = ?, monitor_type = ?, status = ?, response_time = ?, last_check = ?,
      group_id = ?, sort_order = ?, host_sort_order = ?, show_url = ?,
      method = ?, expected_status = ?, timeout = ?, headers = ?, body = ?,
      dns_record_type = ?, dns_expected_value = ?, dns_server = ?, dns_server_custom = ?,
      tcp_host = ?, tcp_port = ?,
      smtp_host = ?, smtp_port = ?, smtp_security = ?,
      db_host = ?, db_port = ?,
      grpc_host = ?, grpc_port = ?, grpc_tls = ?,
      mqtt_host = ?, mqtt_port = ?,
      push_token = ?, push_interval = ?, last_heartbeat = ?, push_data = ?, show_in_host_panel = ?,
      ssl_cert = ?, ssl_cert_last_check = ?, ssl_check_enabled = ?,
      notify_enabled = ?, inverted = ?, last_message = ?
    WHERE id = ?
  `).bind(
    merged.name,
    merged.url,
    merged.monitorType,
    merged.status,
    merged.responseTime,
    merged.lastCheck,
    merged.groupId,
    merged.sortOrder,
    merged.hostSortOrder || 0,
    merged.showUrl ? 1 : 0,
    merged.method,
    merged.expectedStatus,
    merged.timeout,
    merged.headers ? JSON.stringify(merged.headers) : null,
    merged.body,
    merged.dnsRecordType,
    merged.dnsExpectedValue,
    merged.dnsServer || 'cloudflare',
    merged.dnsServerCustom || null,
    merged.tcpHost,
    merged.tcpPort,
    merged.smtpHost,
    merged.smtpPort || 25,
    merged.smtpSecurity || 'starttls',
    merged.dbHost,
    merged.dbPort,
    merged.grpcHost || null,
    merged.grpcPort || 443,
    merged.grpcTls !== false ? 1 : 0,
    merged.mqttHost || null,
    merged.mqttPort || 1883,
    merged.pushToken,
    merged.pushInterval,
    merged.lastHeartbeat,
    merged.pushData ? JSON.stringify(merged.pushData) : null,
    merged.showInHostPanel ? 1 : 0,
    merged.sslCert ? JSON.stringify(merged.sslCert) : null,
    merged.sslCertLastCheck,
    merged.sslCheckEnabled !== false && merged.sslCheckEnabled !== 0 ? 1 : 0,
    merged.notifyEnabled ? 1 : 0,
    merged.inverted ? 1 : 0,
    merged.lastMessage,
    siteId
  ).run();

  return true;
}

/**
 * 批量更新站点状态（优化：单次事务）
 */
export async function batchUpdateSiteStatus(env, updates) {
  if (!updates || updates.length === 0) return;

  const statements = updates.map(u =>
    env.DB.prepare(`
      UPDATE sites SET status = ?, response_time = ?, last_check = ?, last_message = ?
      WHERE id = ?
    `).bind(u.status, u.responseTime, u.lastCheck, u.message || null, u.siteId)
  );

  await env.DB.batch(statements);
}

/**
 * 删除站点
 */
export async function deleteSite(env, siteId) {
  // 删除历史记录、事件、证书告警（级联删除）
  await env.DB.batch([
    env.DB.prepare('DELETE FROM history WHERE site_id = ?').bind(siteId),
    env.DB.prepare('DELETE FROM incidents WHERE site_id = ?').bind(siteId),
    env.DB.prepare('DELETE FROM certificate_alerts WHERE site_id = ?').bind(siteId),
    env.DB.prepare('DELETE FROM sites WHERE id = ?').bind(siteId)
  ]);
}

// ==================== 历史记录操作 (终极优化版) ====================

/**
 * 添加历史记录
 * [CPU 优化] 复杂度 O(1) - 直接插入行，无 JSON 解析
 */
export async function addHistoryAggregated(env, siteId, record) {
  // 提取 Push 数据中的关键指标
  const pushDataStr = record.pushData ? JSON.stringify({
    c: record.pushData.cpu ?? null,
    m: record.pushData.memory ?? null,
    d: record.pushData.disk ?? null,
    l: record.pushData.load ?? null,
    T: record.pushData.temperature ?? null,
    L: record.pushData.latency ?? null,
    u: record.pushData.uptime ?? null,
    x: record.pushData.custom || null
  }) : null;

  await env.DB.prepare(`
    INSERT INTO history (site_id, created_at, status, status_code, response_time, message, push_data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    siteId,
    record.timestamp,
    record.status,
    record.statusCode || 0,
    record.responseTime || 0,
    record.message || null,
    pushDataStr
  ).run();
}

/**
 * 批量添加历史记录
 * [CPU 优化] 复杂度 O(N) - N 条 INSERT，无 JSON 解析
 */
export async function batchAddHistoryAggregated(env, records) {
  if (!records || records.length === 0) return;

  const statements = records.map(r => {
    const pushDataStr = r.pushData ? JSON.stringify({
      c: r.pushData.cpu ?? null,
      m: r.pushData.memory ?? null,
      d: r.pushData.disk ?? null,
      l: r.pushData.load ?? null,
      T: r.pushData.temperature ?? null,
      L: r.pushData.latency ?? null,
      u: r.pushData.uptime ?? null,
      x: r.pushData.custom || null
    }) : null;

    return env.DB.prepare(`
      INSERT INTO history (site_id, created_at, status, status_code, response_time, message, push_data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      r.siteId,
      r.timestamp,
      r.status,
      r.statusCode || 0,
      r.responseTime || 0,
      r.message || null,
      pushDataStr
    );
  });

  await env.DB.batch(statements);
}

/**
 * 获取站点历史记录
 * 按需加载：通过 hours 参数控制数据量
 */
export async function getSiteHistoryAggregated(env, siteId, hours = 24) {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;

  const results = await env.DB.prepare(`
    SELECT created_at, status, status_code, response_time, message
    FROM history
    WHERE site_id = ? AND created_at > ?
    ORDER BY created_at DESC
  `).bind(siteId, cutoff).all();

  return (results.results || []).map(r => ({
    t: r.created_at,
    s: r.status,
    c: r.status_code,
    r: r.response_time,
    m: r.message
  }));
}
/**
 * 批量获取多个站点的历史记录
 * 按需加载：前端通过 hours 参数控制数据量
 * 例如：首页 1 小时，详情页 24 小时
 */
export async function batchGetSiteHistoryAggregated(env, siteIds, hours = 24) {
  if (!siteIds || siteIds.length === 0) return {};
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const placeholders = siteIds.map(() => '?').join(',');

  const results = await env.DB.prepare(`
    SELECT site_id, created_at, status, status_code, response_time, message
    FROM history
    WHERE site_id IN (${placeholders}) AND created_at > ?
    ORDER BY site_id, created_at DESC
  `).bind(...siteIds, cutoff).all();

  // 在内存中分组
  const historyMap = {};
  siteIds.forEach(id => historyMap[id] = []);

  for (const row of (results.results || [])) {
    if (historyMap[row.site_id]) {
      historyMap[row.site_id].push({
        t: row.created_at,
        s: row.status,
        c: row.status_code,
        r: row.response_time,
        m: row.message
      });
    }
  }

  return historyMap;
}

/**
 * 清理旧历史记录
 * [CPU 优化] 使用 DELETE 语句，数据库引擎负责处理，不占用 Worker CPU
 */
export async function cleanupAggregatedHistory(env, retentionHours = 720) {
  const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;

  const result = await env.DB.prepare(
    'DELETE FROM history WHERE created_at < ?'
  ).bind(cutoff).run();

  const deletedCount = result.meta?.changes || 0;
  console.log(`🧹 已清理 ${deletedCount} 条旧历史记录`);
  return deletedCount;
}

/**
 * 添加历史记录
 */
export async function addHistory(env, siteId, record) {
  await addHistoryAggregated(env, siteId, record);
}

/**
 * 批量添加历史记录
 */
export async function batchAddHistory(env, records) {
  if (!records || records.length === 0) return;
  await batchAddHistoryAggregated(env, records);
  // 更新数据版本号用于缓存失效
  await updateDataVersion(env);
}

/**
 * 获取站点历史记录
 */
export async function getSiteHistory(env, siteId, hours = 24) {
  return getSiteHistoryAggregated(env, siteId, hours);
}

/**
 * 批量获取多个站点的历史记录
 */
export async function batchGetSiteHistory(env, siteIds, hours = 24) {
  return batchGetSiteHistoryAggregated(env, siteIds, hours);
}

/**
 * 清理旧历史记录
 */
export async function cleanupOldHistory(env, retentionHours = 720) {
  return cleanupAggregatedHistory(env, retentionHours);
}


// ==================== 分组操作 ====================

/**
 * 获取所有分组
 */
export async function getAllGroups(env) {
  const results = await env.DB.prepare(
    'SELECT * FROM groups ORDER BY sort_order ASC'
  ).all();

  return (results.results || []).map(row => ({
    id: row.id,
    name: row.name,
    order: row.sort_order,
    icon: row.icon || null,
    iconColor: row.icon_color || null,
    createdAt: row.created_at
  }));
}

/**
 * 创建分组
 */
export async function createGroup(env, group) {
  await env.DB.prepare(`
    INSERT INTO groups (id, name, sort_order, created_at)
    VALUES (?, ?, ?, ?)
  `).bind(
    group.id,
    group.name,
    group.order || 0,
    group.createdAt || Date.now()
  ).run();
}

/**
 * 更新分组
 */
export async function updateGroup(env, groupId, updates) {
  await env.DB.prepare(`
    UPDATE groups SET name = ?, sort_order = ?, icon = ?, icon_color = ? WHERE id = ?
  `).bind(updates.name, updates.order || 0, updates.icon || null, updates.iconColor || null, groupId).run();
}

/**
 * 删除分组
 */
export async function deleteGroup(env, groupId) {
  // 将该分组的站点移到默认分组
  await env.DB.batch([
    env.DB.prepare('UPDATE sites SET group_id = ? WHERE group_id = ?').bind('default', groupId),
    env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(groupId)
  ]);
}

// ==================== 事件操作 ====================

/**
 * 创建事件
 */
export async function createIncident(env, incident) {
  await env.DB.prepare(`
    INSERT INTO incidents (id, site_id, site_name, type, start_time, end_time, status, reason, resolved_reason, duration, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    incident.id,
    incident.siteId,
    incident.siteName,
    incident.type || 'down',
    incident.startTime,
    incident.endTime || null,
    incident.status || 'ongoing',
    incident.reason || null,
    incident.resolvedReason || null,
    incident.duration || null,
    incident.createdAt || Date.now()
  ).run();
}

/**
 * 更新事件
 */
export async function updateIncident(env, incidentId, updates) {
  await env.DB.prepare(`
    UPDATE incidents SET end_time = ?, status = ?, resolved_reason = ?, duration = ?
    WHERE id = ?
  `).bind(
    updates.endTime || null,
    updates.status || 'ongoing',
    updates.resolvedReason || null,
    updates.duration || null,
    incidentId
  ).run();
}

/**
 * 获取所有事件
 */
export async function getAllIncidents(env, limit = 100) {
  const results = await env.DB.prepare(`
    SELECT * FROM incidents ORDER BY start_time DESC LIMIT ?
  `).bind(limit).all();

  return (results.results || []).map(row => ({
    id: row.id,
    siteId: row.site_id,
    siteName: row.site_name,
    type: row.type || 'down',
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    reason: row.reason,
    resolvedReason: row.resolved_reason,
    duration: row.duration,
    createdAt: row.created_at || row.start_time
  }));
}

/**
 * 获取站点的未解决事件
 */
export async function getOngoingIncident(env, siteId) {
  const row = await env.DB.prepare(`
    SELECT * FROM incidents WHERE site_id = ? AND status = 'ongoing' ORDER BY start_time DESC LIMIT 1
  `).bind(siteId).first();

  if (!row) return null;

  return {
    id: row.id,
    siteId: row.site_id,
    siteName: row.site_name,
    type: row.type || 'down',
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    reason: row.reason,
    resolvedReason: row.resolved_reason,
    duration: row.duration,
    createdAt: row.created_at || row.start_time
  };
}

/**
 * 清除所有事件记录
 */
export async function clearAllIncidents(env) {
  await env.DB.prepare('DELETE FROM incidents').run();
  console.log('🧹 已清除所有事件记录');
}

// ==================== 统计操作 ====================

/**
 * 增加统计计数（仅用于 checks）
 */
export async function incrementStats(env, type, count = 1) {
  // 仅保留 checks 统计，writes 已移除
  if (type !== 'checks') return;

  const date = getBeijingDate();
  try {
    await env.DB.prepare(`
      INSERT INTO stats (date, ${type})
      VALUES (?, ?)
      ON CONFLICT(date) DO UPDATE SET ${type} = ${type} + ?
    `).bind(date, count, count).run();
  } catch (e) {
    // 忽略统计错误
  }
}

/**
 * 获取今日统计
 */
export async function getTodayStats(env) {
  const date = getBeijingDate();
  try {
    const row = await env.DB.prepare(
      'SELECT * FROM stats WHERE date = ?'
    ).bind(date).first();

    return {
      date,
      checks: row?.checks || 0
    };
  } catch (e) {
    return { date, checks: 0 };
  }
}

// ==================== 认证操作 ====================

/**
 * 获取管理员路径
 */
export async function getAdminPath(env) {
  const result = await getConfig(env, 'admin_path');
  return result;
}

/**
 * 设置管理员路径
 */
export async function setAdminPath(env, path) {
  await setConfig(env, 'admin_path', path);
}

// 别名，兼容旧代码
export const putAdminPath = setAdminPath;

/**
 * 获取管理员密码哈希
 */
export async function getAdminPassword(env) {
  const result = await getConfig(env, 'admin_password');
  return result;
}

/**
 * 设置管理员密码哈希
 */
export async function setAdminPassword(env, hash) {
  await setConfig(env, 'admin_password', hash);
}

// 别名，兼容旧代码
export const putAdminPassword = setAdminPassword;

// ==================== Push 心跳操作 ====================

/**
 * 更新 Push 心跳（立即写入数据库）
 */
export async function updatePushHeartbeat(env, siteId, heartbeatData) {
  const now = Date.now();
  const pushData = heartbeatData.pushData || {};

  await env.DB.prepare(`
    UPDATE sites SET 
      status = 'online',
      last_heartbeat = ?,
      push_data = ?,
      response_time = ?
    WHERE id = ?
  `).bind(
    now,
    JSON.stringify(pushData),
    heartbeatData.responseTime || 0,
    siteId
  ).run();

  // 添加历史记录
  await addHistory(env, siteId, {
    timestamp: now,
    status: 'online',
    statusCode: 200,
    responseTime: heartbeatData.responseTime || 0,
    message: 'OK',
    pushData: pushData
  });

  console.log(`📡 Push 心跳已写入 D1: ${siteId}`);
}

/**
 * 获取 Push 指标历史记录
 * [CPU 优化] 从 history 表查询，无需解析大 JSON
 */
export async function getPushHistory(env, siteId, hours = 24) {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;

  const results = await env.DB.prepare(`
    SELECT created_at, push_data
    FROM history
    WHERE site_id = ? AND created_at > ? AND push_data IS NOT NULL
    ORDER BY created_at DESC
  `).bind(siteId, cutoff).all();

  return (results.results || []).map(row => {
    let p = {};
    try { p = JSON.parse(row.push_data); } catch (e) { }
    return {
      timestamp: row.created_at,
      cpu: p.c,
      memory: p.m,
      disk: p.d,
      load: p.l,
      temperature: p.T,
      latency: p.L,
      uptime: p.u,
      custom: p.x
    };
  });
}

/**
 * 清理旧的 Push 历史记录（已由 cleanupOldHistory 统一处理）
 */
export async function cleanupOldPushHistory(env, retentionHours = 168) {
  return 0; // 已由 cleanupOldHistory 统一处理
}

// ==================== 证书告警操作 ====================

/**
 * 获取证书告警状态
 */
export async function getCertificateAlert(env, siteId) {
  const row = await env.DB.prepare(
    'SELECT * FROM certificate_alerts WHERE site_id = ?'
  ).bind(siteId).first();

  return row ? {
    siteId: row.site_id,
    lastAlertTime: row.last_alert_time,
    alertType: row.alert_type
  } : null;
}

/**
 * 设置证书告警状态
 */
export async function setCertificateAlert(env, siteId, alertTime, alertType) {
  await env.DB.prepare(`
    INSERT OR REPLACE INTO certificate_alerts (site_id, last_alert_time, alert_type)
    VALUES (?, ?, ?)
  `).bind(siteId, alertTime, alertType).run();
}

// ==================== 数据库初始化 ====================

/**
 * 初始化数据库表结构
 * 使用模块级变量缓存，避免每分钟重复检查
 */
let _dbInitialized = false;

export async function initDatabase(env) {
  // 如果已初始化，直接返回
  if (_dbInitialized) {
    return false;
  }

  // 检查是否已初始化
  try {
    const check = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sites'"
    ).first();

    if (check) {
      // 表已存在，执行迁移检查
      await runMigrations(env);
      _dbInitialized = true;
      return false; // 已初始化
    }
  } catch (e) {
    // 表不存在，继续初始化
  }

  console.log('🔧 初始化 D1 数据库...');

  // 创建表结构
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        monitor_type TEXT DEFAULT 'http',
        status TEXT DEFAULT 'unknown',
        response_time INTEGER DEFAULT 0,
        last_check INTEGER DEFAULT 0,
        group_id TEXT DEFAULT 'default',
        sort_order INTEGER DEFAULT 0,
        host_sort_order INTEGER DEFAULT 0,
        show_url INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        method TEXT DEFAULT 'GET',
        expected_status INTEGER DEFAULT 200,
        timeout INTEGER DEFAULT 30000,
        headers TEXT,
        body TEXT,
        dns_record_type TEXT DEFAULT 'A',
        dns_expected_value TEXT,
        dns_server TEXT DEFAULT 'cloudflare',
        dns_server_custom TEXT,
        tcp_host TEXT,
        tcp_port INTEGER,
        push_token TEXT,
        push_interval INTEGER DEFAULT 60,
        last_heartbeat INTEGER DEFAULT 0,
        push_data TEXT,
        show_in_host_panel INTEGER DEFAULT 0,
        ssl_cert TEXT,
        ssl_cert_last_check INTEGER DEFAULT 0,
        last_message TEXT
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL,
        site_name TEXT NOT NULL,
        type TEXT DEFAULT 'down',
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        status TEXT DEFAULT 'ongoing',
        reason TEXT,
        resolved_reason TEXT,
        duration INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_incidents_site ON incidents(site_id)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_incidents_time ON incidents(start_time DESC)'),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `),
    env.DB.prepare(`INSERT OR IGNORE INTO groups (id, name, sort_order) VALUES ('default', '${GROUPS.defaultGroupName}', 0)`),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS stats (
        date TEXT PRIMARY KEY,
        writes INTEGER DEFAULT 0,
        reads INTEGER DEFAULT 0,
        checks INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS certificate_alerts (
        site_id TEXT PRIMARY KEY,
        last_alert_time INTEGER,
        alert_type TEXT
      )
    `),
    // 关系型历史记录表：每条记录一行，极大降低 CPU 消耗
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT,
        status_code INTEGER,
        response_time INTEGER,
        message TEXT,
        push_data TEXT,
        FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
      )
    `),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_history_site_time ON history(site_id, created_at DESC)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at)')
  ]);

  console.log('✅ D1 数据库初始化完成');
  return true;
}

/**
 * 执行数据库迁移
 * 自动添加缺失的列和表
 */
async function runMigrations(env) {
  console.log('🔄 检查数据库迁移...');

  // 获取现有列信息
  const sitesColumns = await env.DB.prepare("PRAGMA table_info(sites)").all();
  const incidentsColumns = await env.DB.prepare("PRAGMA table_info(incidents)").all();

  const sitesCols = new Set((sitesColumns.results || []).map(c => c.name));
  const incidentsCols = new Set((incidentsColumns.results || []).map(c => c.name));

  const migrations = [];

  // 检查 history 表是否存在（终极优化迁移）
  const historyCheck = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='history'"
  ).first();

  if (!historyCheck) {
    migrations.push(env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT,
        status_code INTEGER,
        response_time INTEGER,
        message TEXT,
        push_data TEXT,
        FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
      )
    `));
    migrations.push(env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_history_site_time ON history(site_id, created_at DESC)'));
    migrations.push(env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at)'));
    console.log('  + 创建 history 表 (V2 Schema)');
  }

  // 检查 sites 表缺失的列
  if (!sitesCols.has('tcp_host')) {
    migrations.push(env.DB.prepare('ALTER TABLE sites ADD COLUMN tcp_host TEXT'));
    console.log('  + 添加 sites.tcp_host 列');
  }

  if (!sitesCols.has('host_sort_order')) {
    migrations.push(env.DB.prepare('ALTER TABLE sites ADD COLUMN host_sort_order INTEGER DEFAULT 0'));
    console.log('  + 添加 sites.host_sort_order 列');
  }

  if (!sitesCols.has('db_host')) {
    migrations.push(env.DB.prepare('ALTER TABLE sites ADD COLUMN db_host TEXT'));
    console.log('  + 添加 sites.db_host 列');
  }
  if (!sitesCols.has('db_port')) {
    migrations.push(env.DB.prepare('ALTER TABLE sites ADD COLUMN db_port INTEGER'));
    console.log('  + 添加 sites.db_port 列');
  }

  // 检查 ssl_check_enabled 列（SSL 检测开关）
  if (!sitesCols.has('ssl_check_enabled')) {
    migrations.push(env.DB.prepare('ALTER TABLE sites ADD COLUMN ssl_check_enabled INTEGER DEFAULT 1'));
    console.log('  + 添加 sites.ssl_check_enabled 列');
  }

  // 检查 incidents 表缺失的列
  if (!incidentsCols.has('type')) {
    migrations.push(env.DB.prepare("ALTER TABLE incidents ADD COLUMN type TEXT DEFAULT 'down'"));
    console.log('  + 添加 incidents.type 列');
  }

  if (migrations.length > 0) {
    await env.DB.batch(migrations);
    console.log(`✅ 完成 ${migrations.length} 项迁移`);
  } else {
    console.log('✅ 数据库已是最新');
  }
}

// ==================== 兼容性导出（旧 KV 接口） ====================

// 保留旧接口以便渐进迁移
export async function getMonitorState(env) {
  // 返回兼容的状态对象
  const [settings, sites, groups, incidents, stats] = await Promise.all([
    getSettings(env),
    getAllSites(env),
    getAllGroups(env),
    getAllIncidents(env),
    getTodayStats(env)
  ]);

  return {
    config: {
      ...settings,
      groups
    },
    sites,
    incidents: {},  // 兼容旧格式
    incidentIndex: incidents.map(i => i.id),
    stats: {
      checks: {
        today: stats.checks,
        total: stats.checks
      }
    }
  };
}

// ==================== 清除所有数据 ====================

/**
 * 清除所有数据（危险操作）
 */
export async function clearAllData(env) {
  console.log('⚠️ 清除所有 D1 数据...');

  await env.DB.batch([
    env.DB.prepare('DELETE FROM history'),
    env.DB.prepare('DELETE FROM incidents'),
    env.DB.prepare('DELETE FROM certificate_alerts'),
    env.DB.prepare('DELETE FROM sites'),
    env.DB.prepare("DELETE FROM groups WHERE id != 'default'"),
    env.DB.prepare("DELETE FROM config WHERE key NOT IN ('admin_password', 'admin_path')")
  ]);

  console.log('✅ 所有数据已清除');
}
