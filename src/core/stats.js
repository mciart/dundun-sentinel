// src/core/stats.js

/**
 * 计算站点历史的统计信息
 * @param {Array} history - 站点历史记录数组
 * @returns {Object} 统计结果
 */
export function calculateStats(history) {
  if (!history || history.length === 0) {
    return {
      uptime: 100,
      avgResponseTime: 0,
      totalChecks: 0,
      onlineChecks: 0,
      offlineChecks: 0
    };
  }

  const onlineChecks = history.filter(h => h.status === 'online').length;
  const totalResponseTime = history.reduce((sum, h) => sum + h.responseTime, 0);

  return {
    uptime: ((onlineChecks / history.length) * 100).toFixed(2),
    avgResponseTime: Math.round(totalResponseTime / history.length),
    totalChecks: history.length,
    onlineChecks,
    offlineChecks: history.length - onlineChecks
  };
}
