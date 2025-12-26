// src/core/stats.js

/**
 * 计算站点历史的统计信息（优化版：单次遍历）
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
      offlineChecks: 0,
      incidents: 0
    };
  }

  const totalChecks = history.length;
  let onlineChecks = 0;
  let rtSum = 0;
  let rtCount = 0;
  let incidents = 0;
  let prevStatus = null;

  // 单次遍历计算所有统计数据
  for (let i = 0; i < totalChecks; i++) {
    const h = history[i];
    const status = h.status || h.s;
    const rt = h.responseTime || h.r;

    // 统计在线次数
    if (status === 'online') {
      onlineChecks++;
    }

    // 统计响应时间
    if (rt != null && rt > 0) {
      rtSum += rt;
      rtCount++;
    }

    // 统计故障次数（online/slow → offline）
    if (status === 'offline' || status === 'x') {
      if (i === 0 || (prevStatus !== 'offline' && prevStatus !== 'x')) {
        incidents++;
      }
    }
    prevStatus = status;
  }

  const offlineChecks = totalChecks - onlineChecks;
  const uptime = parseFloat(((onlineChecks / totalChecks) * 100).toFixed(2));
  const avgResponseTime = rtCount > 0 ? Math.round(rtSum / rtCount) : 0;

  return {
    uptime,
    avgResponseTime,
    totalChecks,
    onlineChecks,
    offlineChecks,
    incidents
  };
}
