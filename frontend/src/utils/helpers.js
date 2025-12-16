import { formatDistanceToNow, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';


export function formatTimeAgo(timestamp) {
  if (!timestamp) return '未知';
  try {
    return formatDistanceToNow(new Date(timestamp), {
      addSuffix: true,
      locale: zhCN
    });
  } catch {
    return '未知';
  }
}

export function formatDateTime(timestamp) {
  if (!timestamp) return '未知';
  try {
    return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss');
  } catch {
    return '未知';
  }
}

export function formatResponseTime(ms) {
  if (!ms || ms === 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function getStatusColor(status) {
  const colors = {
    online: 'text-primary-600 dark:text-primary-400',
    offline: 'text-danger-600 dark:text-danger-400',
    slow: 'text-warning-600 dark:text-warning-400',
    unknown: 'text-slate-500 dark:text-slate-400',
  };
  return colors[status] || colors.unknown;
}

export function getStatusBgColor(status) {
  const colors = {
    online: 'bg-primary-100 dark:bg-primary-900/30',
    offline: 'bg-danger-100 dark:bg-danger-900/30',
    slow: 'bg-warning-100 dark:bg-warning-900/30',
    unknown: 'bg-slate-100 dark:bg-slate-800',
  };
  return colors[status] || colors.unknown;
}

export function getStatusText(status) {
  const texts = {
    online: '正常',
    offline: '离线',
    slow: '缓慢',
    unknown: '未知',
  };
  return texts[status] || texts.unknown;
}

export function getUptimeColor(uptime) {
  if (uptime >= 99) return 'text-primary-600 dark:text-primary-400';
  if (uptime >= 95) return 'text-warning-600 dark:text-warning-400';
  return 'text-danger-600 dark:text-danger-400';
}


export function groupSites(sites, groups = []) {
  const grouped = {};
  
  sites.forEach(site => {

    let groupName = '默认分类';
    
    if (site.groupId) {
      const groupObj = groups.find(g => g && g.id === site.groupId);
      if (groupObj && groupObj.name) {
        groupName = groupObj.name;
      }
    }
    
    if (!grouped[groupName]) {
      grouped[groupName] = [];
    }
    grouped[groupName].push(site);
  });
  

  const sortedGrouped = {};
  const groupOrder = {};
  
  groups.forEach(g => {
    if (g && g.name) {
      groupOrder[g.name] = typeof g.order === 'number' ? g.order : 999;
    }
  });
  
  Object.keys(grouped)
    .sort((a, b) => {
      const orderA = groupOrder[a] !== undefined ? groupOrder[a] : 999;
      const orderB = groupOrder[b] !== undefined ? groupOrder[b] : 999;
      return orderA - orderB;
    })
    .forEach(key => {
      // 对每个分类内的站点按 sortOrder 排序
      sortedGrouped[key] = grouped[key].sort((a, b) => {
        const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : 0;
        const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : 0;
        if (orderA !== orderB) return orderA - orderB;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
    });
  
  return sortedGrouped;
}

export function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
