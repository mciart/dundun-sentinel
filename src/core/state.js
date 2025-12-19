// src/core/state.js

import { getMonitorState, putMonitorState } from './storage.js';

/**
 * 获取北京日期字符串 (YYYY-MM-DD)
 * @returns {string}
 */
export function getBeijingDate() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return beijingTime.toISOString().split('T')[0];
}

/**
 * 初始化监控系统状态
 * @returns {Object}
 */
export function initializeState() {
  return {
    version: 1,
    lastUpdate: Date.now(),
    
    config: {
      historyHours: 24,              
      retentionHours: 720,           
      checkInterval: 10,             
      statusChangeDebounceMinutes: 3, 
      siteName: '炖炖守望',
      siteSubtitle: '慢慢炖，网站不"糊锅"',
      pageTitle: '网站监控',
      
      notifications: {
        enabled: false,
        events: ['down', 'recovered', 'cert_warning'],
        channels: {
          email: {
            enabled: false,
            to: '',
            from: '' 
          },
          wecom: {
            enabled: false,
            webhook: ''
          }
        }
      },
      groups: [
        {
          id: 'default',
          name: '默认分类',
          order: 0,
          createdAt: Date.now()
        }
      ]
    },
    
    sites: [],
    
    history: {},
    
    incidents: {},
    incidentIndex: [],
    certificateAlerts: {},
    
    stats: {
      writes: {
        total: 0,
        today: 0,
        yesterday: 0,
        forced: 0,
        statusChange: 0,
        lastResetDate: getBeijingDate()
      },
      checks: {
        total: 0,
        today: 0,
        yesterday: 0
      },
      sites: {
        total: 0,
        online: 0,
        offline: 0
      }
    }
  };
}

/**
 * 检查是否需要重置每日统计
 * @param {Object} state 
 * @returns {boolean}
 */
export function shouldResetStats(state) {
  const today = getBeijingDate();
  return state.stats.writes.lastResetDate !== today;
}

/**
 * 重置每日统计信息
 * @param {Object} state 
 */
export function resetDailyStats(state) {
  const yesterday = state.stats.writes.lastResetDate;
  const yesterdayWrites = state.stats.writes.today;
  const yesterdayChecks = state.stats.checks.today;
  
  console.log(`📊 日期变更，重置统计: ${yesterday} 写入 ${yesterdayWrites} 次，检测 ${yesterdayChecks} 次`);
  
  state.stats.writes.yesterday = yesterdayWrites;
  state.stats.checks.yesterday = yesterdayChecks;
  
  state.stats.writes.today = 0;
  state.stats.writes.forced = 0;
  state.stats.writes.statusChange = 0;
  state.stats.checks.today = 0;
  state.stats.writes.lastResetDate = getBeijingDate();
}

/**
 * 从 KV 获取状态，如果不存在则初始化
 * @param {Object} env 
 * @returns {Promise<Object>}
 */
export async function getState(env) {
  try {
    const data = await getMonitorState(env);
    if (!data) {
      return initializeState();
    }
    // 确保基本结构存在 (防御性编程)
    if (!data.config) data.config = initializeState().config;
    if (!data.sites) data.sites = [];
    if (!data.stats) data.stats = initializeState().stats;
    if (!data.history) data.history = {};
    if (!data.incidents) data.incidents = {};
    if (!data.incidentIndex) data.incidentIndex = [];
    
    return data;
  } catch (error) {
    console.error('获取状态失败:', error);
    return initializeState();
  }
}

/**
 * 将状态保存到 KV
 * @param {Object} env 
 * @param {Object} state 
 */
export async function updateState(env, state) {
  state.lastUpdate = Date.now();
  await putMonitorState(env, state);
}
