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
      offlineChecks: 0,
      incidents: 0
    };
  }

  const totalChecks = history.length;
  const onlineChecks = history.filter(h => h.status === 'online').length;
  const offlineChecks = totalChecks - onlineChecks;
  const uptime = parseFloat(((onlineChecks / totalChecks) * 100).toFixed(2));

  const responseTimes = history
    .filter(h => h.responseTime != null && h.responseTime > 0)
    .map(h => h.responseTime);
  const avgResponseTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;

  // 计算故障次数（状态从非 offline 变为 offline 的次数）
  const incidents = history.filter((h, i, arr) => {
    const currentStatus = h.status || h.s; // 兼容可能存在的旧数据格式
    if (i === 0) return currentStatus === 'offline' || currentStatus === 'x';
    const prevStatus = arr[i - 1].status || arr[i - 1].s;
    return (prevStatus !== 'offline' && prevStatus !== 'x') && (currentStatus === 'offline' || currentStatus === 'x');
  }).length;

  return {
    uptime,
    avgResponseTime,
    totalChecks,
    onlineChecks,
    offlineChecks,
    incidents
  };
}
