// src/core/state.js
// D1 数据库版本的状态管理

import * as db from './storage.js';

/**
 * 获取北京日期字符串 (YYYY-MM-DD)
 */
export function getBeijingDate() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return beijingTime.toISOString().split('T')[0];
}

// ==================== 配置和设置 ====================

/**
 * 获取全局设置
 */
export async function getSettings(env) {
  return await db.getSettings(env);
}

/**
 * 保存全局设置
 */
export async function saveSettings(env, settings) {
  await db.saveSettings(env, settings);
}

// ==================== 站点操作 ====================

/**
 * 获取所有站点
 */
export async function getAllSites(env) {
  return await db.getAllSites(env);
}

/**
 * 获取单个站点
 */
export async function getSite(env, siteId) {
  return await db.getSite(env, siteId);
}

/**
 * 创建站点
 */
export async function createSite(env, site) {
  await db.createSite(env, site);
}

/**
 * 更新站点
 */
export async function updateSite(env, siteId, updates) {
  return await db.updateSite(env, siteId, updates);
}

/**
 * 批量更新站点状态
 */
export async function batchUpdateSiteStatus(env, updates) {
  await db.batchUpdateSiteStatus(env, updates);
}

/**
 * 删除站点
 */
export async function deleteSite(env, siteId) {
  await db.deleteSite(env, siteId);
}

// ==================== 历史记录操作 ====================

/**
 * 添加历史记录
 */
export async function addHistory(env, siteId, record) {
  await db.addHistory(env, siteId, record);
}

/**
 * 批量添加历史记录
 */
export async function batchAddHistory(env, records) {
  await db.batchAddHistory(env, records);
}

/**
 * 获取站点历史记录
 */
export async function getSiteHistory(env, siteId, hours = 24) {
  return await db.getSiteHistory(env, siteId, hours);
}

/**
 * 批量获取历史记录
 */
export async function batchGetSiteHistory(env, siteIds, hours = 24) {
  return await db.batchGetSiteHistory(env, siteIds, hours);
}

/**
 * 清理旧历史记录
 */
export async function cleanupOldHistory(env, retentionHours = 720) {
  return await db.cleanupOldHistory(env, retentionHours);
}

// ==================== 分组操作 ====================

/**
 * 获取所有分组
 */
export async function getAllGroups(env) {
  return await db.getAllGroups(env);
}

/**
 * 创建分组
 */
export async function createGroup(env, group) {
  await db.createGroup(env, group);
}

/**
 * 更新分组
 */
export async function updateGroup(env, groupId, updates) {
  await db.updateGroup(env, groupId, updates);
}

/**
 * 删除分组
 */
export async function deleteGroup(env, groupId) {
  await db.deleteGroup(env, groupId);
}

// ==================== 事件操作 ====================

/**
 * 创建事件
 */
export async function createIncident(env, incident) {
  await db.createIncident(env, incident);
}

/**
 * 更新事件
 */
export async function updateIncident(env, incidentId, updates) {
  await db.updateIncident(env, incidentId, updates);
}

/**
 * 获取所有事件
 */
export async function getAllIncidents(env, limit = 100) {
  return await db.getAllIncidents(env, limit);
}

/**
 * 获取站点的未解决事件
 */
export async function getOngoingIncident(env, siteId) {
  return await db.getOngoingIncident(env, siteId);
}

// ==================== Push 心跳操作 ====================

/**
 * 更新 Push 心跳
 */
export async function updatePushHeartbeat(env, siteId, heartbeatData) {
  await db.updatePushHeartbeat(env, siteId, heartbeatData);
}

// ==================== 统计操作 ====================

/**
 * 增加统计计数
 */
export async function incrementStats(env, type, count = 1) {
  await db.incrementStats(env, type, count);
}

/**
 * 获取今日统计
 */
export async function getTodayStats(env) {
  return await db.getTodayStats(env);
}

/**
 * 获取统计历史
 */
export async function getStatsHistory(env, days = 7) {
  return await db.getStatsHistory(env, days);
}

// ==================== 认证操作 ====================

/**
 * 获取管理员路径
 */
export async function getAdminPath(env) {
  return await db.getAdminPath(env);
}

/**
 * 设置管理员路径
 */
export async function setAdminPath(env, path) {
  await db.setAdminPath(env, path);
}

/**
 * 获取管理员密码哈希
 */
export async function getAdminPassword(env) {
  return await db.getAdminPassword(env);
}

/**
 * 设置管理员密码哈希
 */
export async function setAdminPassword(env, hash) {
  await db.setAdminPassword(env, hash);
}

// ==================== 证书告警操作 ====================

/**
 * 获取证书告警状态
 */
export async function getCertificateAlert(env, siteId) {
  return await db.getCertificateAlert(env, siteId);
}

/**
 * 设置证书告警状态
 */
export async function setCertificateAlert(env, siteId, alertTime, alertType) {
  await db.setCertificateAlert(env, siteId, alertTime, alertType);
}

// ==================== 数据库初始化 ====================

/**
 * 初始化数据库
 */
export async function initDatabase(env) {
  return await db.initDatabase(env);
}

// ==================== 兼容性接口（旧代码可能用到） ====================

/**
 * 获取完整状态（兼容旧 KV 接口）
 * @deprecated 建议使用单独的函数获取各部分数据
 */
export async function getState(env) {
  await initDatabase(env);  // 确保数据库已初始化
  
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
    history: {},  // 历史记录按需获取，不再全量加载
    incidents: incidents.reduce((acc, i) => { acc[i.id] = i; return acc; }, {}),
    incidentIndex: incidents.map(i => i.id),
    stats: {
      writes: {
        today: stats.writes,
        total: stats.writes,
        yesterday: 0,
        forced: 0,
        statusChange: 0,
        lastResetDate: getBeijingDate()
      },
      checks: {
        today: stats.checks,
        total: stats.checks,
        yesterday: 0
      },
      sites: {
        total: sites.length,
        online: sites.filter(s => s.status === 'online').length,
        offline: sites.filter(s => s.status === 'offline').length
      }
    }
  };
}

/**
 * 保存状态（兼容旧接口，但实际上各操作已直接写入数据库）
 * @deprecated D1 版本每次操作都直接写入数据库，不需要手动保存
 */
export async function saveStateNow(env, state) {
  // D1 版本不需要此操作，每次修改都直接写入数据库
  console.log('💡 D1 版本已自动保存，无需手动调用 saveStateNow');
}

/**
 * 更新状态（兼容旧接口）
 * @deprecated 建议使用具体的更新函数
 */
export async function updateState(env, state) {
  // D1 版本不需要此操作
  console.log('💡 D1 版本请使用具体的更新函数');
}

/**
 * 刷新状态到存储（兼容旧接口）
 * @deprecated D1 版本每次操作都直接写入数据库
 */
export async function flushState(env, force = false) {
  // D1 版本不需要此操作
  return false;
}

// 保留这些函数签名以兼容旧代码
export function initializeState() {
  return {
    version: 1,
    lastUpdate: Date.now(),
    config: {},
    sites: [],
    history: {},
    incidents: {},
    incidentIndex: [],
    stats: {}
  };
}

export function isCacheDirty() { return false; }
export function markCacheDirty() {}
export function clearDirtyFlag() {}
export function getMemoryCache() { return null; }

// 这些内存缓存函数在 D1 版本中不再需要，但保留接口兼容性
export function updateSiteStatusCache() {}
export function getSiteStatusCache() { return new Map(); }
export function clearSiteStatusCache() {}
export function addHistoryRecord() {}
export function getHistoryCache() { return new Map(); }
export function clearHistoryCache() {}
export function shouldResetStats() { return false; }
export function resetDailyStats() {}
