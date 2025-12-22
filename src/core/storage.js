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
 * 获取全局设置
 */
export async function getSettings(env) {
  const defaults = {
    siteName: BRAND.siteName,
    siteSubtitle: BRAND.siteSubtitle,
    pageTitle: BRAND.pageTitle,
    historyHours: SETTINGS.historyHours,
    retentionHours: SETTINGS.retentionHours,
    statusChangeDebounceMinutes: SETTINGS.statusChangeDebounceMinutes,
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
    // Push
    pushToken: row.push_token,
    pushInterval: row.push_interval,
    lastHeartbeat: row.last_heartbeat,
    pushData: row.push_data ? JSON.parse(row.push_data) : null,
    showInHostPanel: !!row.show_in_host_panel,
    // SSL
    sslCert: row.ssl_cert ? JSON.parse(row.ssl_cert) : null,
    sslCertLastCheck: row.ssl_cert_last_check,
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
    pushToken: row.push_token,
    pushInterval: row.push_interval,
    lastHeartbeat: row.last_heartbeat,
    pushData: row.push_data ? JSON.parse(row.push_data) : null,
    showInHostPanel: !!row.show_in_host_panel,
    sslCert: row.ssl_cert ? JSON.parse(row.ssl_cert) : null,
    sslCertLastCheck: row.ssl_cert_last_check,
    notifyEnabled: !!row.notify_enabled,
    inverted: !!row.inverted,
    lastMessage: row.last_message
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
      push_token, push_interval, last_heartbeat, push_data, show_in_host_panel,
      ssl_cert, ssl_cert_last_check, notify_enabled, inverted, last_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    site.pushToken || null,
    site.pushInterval || 60,
    site.lastHeartbeat || 0,
    site.pushData ? JSON.stringify(site.pushData) : null,
    site.showInHostPanel ? 1 : 0,
    site.sslCert ? JSON.stringify(site.sslCert) : null,
    site.sslCertLastCheck || 0,
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
      push_token = ?, push_interval = ?, last_heartbeat = ?, push_data = ?, show_in_host_panel = ?,
      ssl_cert = ?, ssl_cert_last_check = ?, notify_enabled = ?, inverted = ?, last_message = ?
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
    merged.pushToken,
    merged.pushInterval,
    merged.lastHeartbeat,
    merged.pushData ? JSON.stringify(merged.pushData) : null,
    merged.showInHostPanel ? 1 : 0,
    merged.sslCert ? JSON.stringify(merged.sslCert) : null,
    merged.sslCertLastCheck,
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
  // 同时删除历史记录、聚合历史、事件（级联删除）
  await env.DB.batch([
    env.DB.prepare('DELETE FROM history WHERE site_id = ?').bind(siteId),
    env.DB.prepare('DELETE FROM history_aggregated WHERE site_id = ?').bind(siteId),
    env.DB.prepare('DELETE FROM incidents WHERE site_id = ?').bind(siteId),
    env.DB.prepare('DELETE FROM certificate_alerts WHERE site_id = ?').bind(siteId),
    env.DB.prepare('DELETE FROM sites WHERE id = ?').bind(siteId)
  ]);
}

// ==================== 历史记录操作 ====================

// 聚合历史数据的最大保留条数（根据 retentionHours 动态计算更精确，这里设置上限）
const MAX_HISTORY_RECORDS = 4320; // 30天 × 144条/天 = 4320

/**
 * 添加历史记录到聚合表
 */
export async function addHistoryAggregated(env, siteId, record) {
  // 读取现有数据
  const row = await env.DB.prepare(
    'SELECT data FROM history_aggregated WHERE site_id = ?'
  ).bind(siteId).first();
  
  let history = [];
  if (row && row.data) {
    try {
      history = JSON.parse(row.data);
    } catch (e) {
      history = [];
    }
  }
  
  // 添加新记录（压缩格式）
  history.unshift({
    t: record.timestamp,
    s: record.status,
    c: record.statusCode || 0,
    r: record.responseTime || 0,
    m: record.message || null
  });
  
  // 限制记录数量
  if (history.length > MAX_HISTORY_RECORDS) {
    history = history.slice(0, MAX_HISTORY_RECORDS);
  }
  
  // 写入
  const now = Date.now();
  await env.DB.prepare(`
    INSERT INTO history_aggregated (site_id, data, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(site_id) DO UPDATE SET data = ?, updated_at = ?
  `).bind(siteId, JSON.stringify(history), now, JSON.stringify(history), now).run();
}

/**
 * 批量添加历史记录到聚合表（优化：单次事务）
 */
export async function batchAddHistoryAggregated(env, records) {
  if (!records || records.length === 0) return;
  
  // 按站点分组
  const recordsBySite = {};
  for (const r of records) {
    if (!recordsBySite[r.siteId]) {
      recordsBySite[r.siteId] = [];
    }
    recordsBySite[r.siteId].push({
      t: r.timestamp,
      s: r.status,
      c: r.statusCode || 0,
      r: r.responseTime || 0,
      m: r.message || null
    });
  }
  
  const siteIds = Object.keys(recordsBySite);
  
  // 批量读取现有数据
  const placeholders = siteIds.map(() => '?').join(',');
  const existing = await env.DB.prepare(
    `SELECT site_id, data FROM history_aggregated WHERE site_id IN (${placeholders})`
  ).bind(...siteIds).all();
  
  const existingMap = {};
  for (const row of (existing.results || [])) {
    try {
      existingMap[row.site_id] = JSON.parse(row.data);
    } catch (e) {
      existingMap[row.site_id] = [];
    }
  }
  
  // 准备批量写入
  const now = Date.now();
  const statements = [];
  
  for (const siteId of siteIds) {
    let history = existingMap[siteId] || [];
    // 新记录添加到前面
    history = [...recordsBySite[siteId], ...history];
    // 限制数量
    if (history.length > MAX_HISTORY_RECORDS) {
      history = history.slice(0, MAX_HISTORY_RECORDS);
    }
    
    const dataStr = JSON.stringify(history);
    statements.push(
      env.DB.prepare(`
        INSERT INTO history_aggregated (site_id, data, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(site_id) DO UPDATE SET data = ?, updated_at = ?
      `).bind(siteId, dataStr, now, dataStr, now)
    );
  }
  
  await env.DB.batch(statements);
}

/**
 * 获取站点聚合历史记录
 */
export async function getSiteHistoryAggregated(env, siteId, hours = 24) {
  const row = await env.DB.prepare(
    'SELECT data FROM history_aggregated WHERE site_id = ?'
  ).bind(siteId).first();
  
  if (!row || !row.data) return [];
  
  let history = [];
  try {
    history = JSON.parse(row.data);
  } catch (e) {
    return [];
  }
  
  // 按时间过滤
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const filtered = history.filter(r => r.t > cutoff);
  
  // 转换为标准格式
  return filtered.map(r => ({
    timestamp: r.t,
    status: r.s,
    statusCode: r.c,
    responseTime: r.r,
    message: r.m
  }));
}

/**
 * 批量获取多个站点的聚合历史记录（核心优化：N 站点只读 N 行）
 */
export async function batchGetSiteHistoryAggregated(env, siteIds, hours = 24) {
  if (!siteIds || siteIds.length === 0) return {};
  
  const placeholders = siteIds.map(() => '?').join(',');
  const results = await env.DB.prepare(
    `SELECT site_id, data FROM history_aggregated WHERE site_id IN (${placeholders})`
  ).bind(...siteIds).all();
  
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const historyMap = {};
  
  for (const row of (results.results || [])) {
    let history = [];
    try {
      history = JSON.parse(row.data);
    } catch (e) {
      history = [];
    }
    
    // 按时间过滤并转换格式
    historyMap[row.site_id] = history
      .filter(r => r.t > cutoff)
      .map(r => ({
        timestamp: r.t,
        status: r.s,
        statusCode: r.c,
        responseTime: r.r,
        message: r.m
      }));
  }
  
  // 确保所有请求的站点都有返回值
  for (const siteId of siteIds) {
    if (!historyMap[siteId]) {
      historyMap[siteId] = [];
    }
  }
  
  return historyMap;
}

/**
 * 清理聚合历史中的旧数据
 */
export async function cleanupAggregatedHistory(env, retentionHours = 720) {
  const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;
  
  // 读取所有聚合数据
  const results = await env.DB.prepare(
    'SELECT site_id, data FROM history_aggregated'
  ).all();
  
  let cleanedCount = 0;
  const statements = [];
  const now = Date.now();
  
  for (const row of (results.results || [])) {
    let history = [];
    try {
      history = JSON.parse(row.data);
    } catch (e) {
      continue;
    }
    
    const originalLength = history.length;
    history = history.filter(r => r.t > cutoff);
    
    if (history.length < originalLength) {
      cleanedCount += originalLength - history.length;
      statements.push(
        env.DB.prepare(
          'UPDATE history_aggregated SET data = ?, updated_at = ? WHERE site_id = ?'
        ).bind(JSON.stringify(history), now, row.site_id)
      );
    }
  }
  
  if (statements.length > 0) {
    await env.DB.batch(statements);
  }
  
  console.log(`🧹 清理了 ${cleanedCount} 条旧聚合历史记录`);
  return cleanedCount;
}

/**
 * 添加历史记录（保留旧表兼容，同时写入聚合表）
 */
export async function addHistory(env, siteId, record) {
  // 同时写入旧表和聚合表
  await Promise.all([
    env.DB.prepare(`
      INSERT INTO history (site_id, timestamp, status, status_code, response_time, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      siteId,
      record.timestamp,
      record.status,
      record.statusCode || 0,
      record.responseTime || 0,
      record.message || null
    ).run(),
    addHistoryAggregated(env, siteId, record)
  ]);
}

/**
 * 批量添加历史记录（优化：单次事务，同时写入聚合表）
 */
export async function batchAddHistory(env, records) {
  if (!records || records.length === 0) return;
  
  // 写入旧表
  const statements = records.map(r =>
    env.DB.prepare(`
      INSERT INTO history (site_id, timestamp, status, status_code, response_time, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(r.siteId, r.timestamp, r.status, r.statusCode || 0, r.responseTime || 0, r.message || null)
  );
  
  // 并行写入旧表和聚合表
  await Promise.all([
    env.DB.batch(statements),
    batchAddHistoryAggregated(env, records)
  ]);
}

/**
 * 获取站点历史记录（使用聚合表，只读 1 行）
 */
export async function getSiteHistory(env, siteId, hours = 24) {
  return getSiteHistoryAggregated(env, siteId, hours);
}

/**
 * 批量获取多个站点的历史记录（使用聚合表，N 站点只读 N 行）
 */
export async function batchGetSiteHistory(env, siteIds, hours = 24) {
  return batchGetSiteHistoryAggregated(env, siteIds, hours);
}

/**
 * 清理旧历史记录（同时清理旧表和聚合表）
 */
export async function cleanupOldHistory(env, retentionHours = 720) {
  const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;
  
  // 清理旧表
  const result = await env.DB.prepare(
    'DELETE FROM history WHERE timestamp < ?'
  ).bind(cutoff).run();
  
  // 清理聚合表
  const aggregatedCount = await cleanupAggregatedHistory(env, retentionHours);
  
  const oldTableCount = result.meta?.changes || 0;
  console.log(`🧹 清理了 ${oldTableCount} 条旧历史记录，${aggregatedCount} 条聚合历史记录`);
  return oldTableCount + aggregatedCount;
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
  
  // 同时添加历史记录
  await addHistory(env, siteId, {
    timestamp: now,
    status: 'online',
    statusCode: 200,
    responseTime: heartbeatData.responseTime || 0,
    message: 'OK'
  });
  
  // 添加 Push 指标历史记录
  await addPushHistory(env, siteId, {
    timestamp: now,
    cpu: pushData.cpu,
    memory: pushData.memory,
    disk: pushData.disk,
    load: pushData.load,
    temperature: pushData.temperature,
    latency: pushData.latency,
    uptime: pushData.uptime,
    custom: pushData.custom
  });
  
  console.log(`📡 Push 心跳已写入 D1: ${siteId}`);
}

/**
 * 添加 Push 指标历史记录
 */
export async function addPushHistory(env, siteId, data) {
  const now = Date.now();
  await env.DB.prepare(`
    INSERT INTO push_history (site_id, timestamp, cpu, memory, disk, load, temperature, latency, uptime, custom, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    siteId,
    data.timestamp || now,
    data.cpu ?? null,
    data.memory ?? null,
    data.disk ?? null,
    data.load ?? null,
    data.temperature ?? null,
    data.latency ?? null,
    data.uptime ?? null,
    data.custom ? JSON.stringify(data.custom) : null,
    now
  ).run();
}

/**
 * 获取 Push 指标历史记录
 */
export async function getPushHistory(env, siteId, hours = 24) {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const results = await env.DB.prepare(`
    SELECT * FROM push_history 
    WHERE site_id = ? AND timestamp > ?
    ORDER BY timestamp ASC
  `).bind(siteId, cutoff).all();
  
  return (results.results || []).map(row => ({
    timestamp: row.timestamp,
    cpu: row.cpu,
    memory: row.memory,
    disk: row.disk,
    load: row.load,
    temperature: row.temperature,
    latency: row.latency,
    uptime: row.uptime,
    custom: row.custom ? JSON.parse(row.custom) : null
  }));
}

/**
 * 清理旧的 Push 历史记录
 */
export async function cleanupOldPushHistory(env, retentionHours = 168) {
  const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;
  const result = await env.DB.prepare(
    'DELETE FROM push_history WHERE timestamp < ?'
  ).bind(cutoff).run();
  
  console.log(`🧹 清理了 ${result.meta?.changes || 0} 条旧 Push 历史记录`);
  return result.meta?.changes || 0;
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
 */
export async function initDatabase(env) {
  // 检查是否已初始化
  try {
    const check = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sites'"
    ).first();
    
    if (check) {
      // 表已存在，执行迁移检查
      await runMigrations(env);
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
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        status TEXT NOT NULL,
        status_code INTEGER DEFAULT 0,
        response_time INTEGER DEFAULT 0,
        message TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_history_site_time ON history(site_id, timestamp DESC)'),
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
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS push_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        cpu REAL,
        memory REAL,
        disk REAL,
        load REAL,
        temperature REAL,
        latency INTEGER,
        uptime INTEGER,
        custom TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_push_history_site_time ON push_history(site_id, timestamp DESC)'),
    // 聚合历史表：每站点一行，存储 JSON 数组（优化 D1 读取行数）
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS history_aggregated (
        site_id TEXT PRIMARY KEY,
        data TEXT NOT NULL DEFAULT '[]',
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `)
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
  
  // 检查 sites 表缺失的列
  if (!sitesCols.has('tcp_host')) {
    migrations.push(env.DB.prepare('ALTER TABLE sites ADD COLUMN tcp_host TEXT'));
    console.log('  + 添加 sites.tcp_host 列');
  }
  
  // 检查 host_sort_order 列（主机面板排序）
  if (!sitesCols.has('host_sort_order')) {
    migrations.push(env.DB.prepare('ALTER TABLE sites ADD COLUMN host_sort_order INTEGER DEFAULT 0'));
    console.log('  + 添加 sites.host_sort_order 列');
  }
  
  // 检查 incidents 表缺失的列
  if (!incidentsCols.has('type')) {
    migrations.push(env.DB.prepare("ALTER TABLE incidents ADD COLUMN type TEXT DEFAULT 'down'"));
    console.log('  + 添加 incidents.type 列');
  }
  
  // 检查 push_history 表是否存在
  const pushHistoryCheck = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='push_history'"
  ).first();
  
  if (!pushHistoryCheck) {
    migrations.push(env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS push_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        cpu REAL,
        memory REAL,
        disk REAL,
        load REAL,
        temperature REAL,
        latency INTEGER,
        uptime INTEGER,
        custom TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `));
    migrations.push(env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_push_history_site_time ON push_history(site_id, timestamp DESC)'));
    console.log('  + 创建 push_history 表');
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
    env.DB.prepare('DELETE FROM stats'),
    env.DB.prepare("DELETE FROM groups WHERE id != 'default'"),
    env.DB.prepare("DELETE FROM config WHERE key NOT IN ('admin_password', 'admin_path')")
  ]);
  
  console.log('✅ 所有数据已清除');
}
