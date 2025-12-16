import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit, Trash2, ExternalLink, TrendingUp, ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { formatTimeAgo, formatResponseTime, getStatusText, getStatusBgColor } from '../utils/helpers';

export default function SiteList({ sites, groups = [], onEdit, onDelete, onReorder }) {
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const initial = {};
    groups.forEach(g => { initial[g.id] = true; });
    initial['default'] = true;
    return initial;
  });

  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : 0;
      const orderB = typeof b.order === 'number' ? b.order : 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }, [groups]);

  const groupedSites = useMemo(() => {
    const result = {};
    sortedGroups.forEach(g => { result[g.id] = []; });
    if (!result['default']) result['default'] = [];
    
    sites.forEach(site => {
      const gid = site.groupId || 'default';
      if (!result[gid]) result[gid] = [];
      result[gid].push(site);
    });

    Object.keys(result).forEach(gid => {
      result[gid].sort((a, b) => {
        const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : 0;
        const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : 0;
        if (orderA !== orderB) return orderA - orderB;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
    });

    return result;
  }, [sites, sortedGroups]);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleMoveSite = async (groupId, siteIndex, direction) => {
    const sitesInGroup = groupedSites[groupId];
    if (!sitesInGroup || sitesInGroup.length < 2) return;
    
    const newIndex = siteIndex + direction;
    if (newIndex < 0 || newIndex >= sitesInGroup.length) return;

    const newOrder = [...sitesInGroup];
    [newOrder[siteIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[siteIndex]];
    
    const siteIds = newOrder.map(s => s.id);
    if (onReorder) {
      await onReorder(siteIds);
    }
  };

  if (sites.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 dark:text-slate-400">
          暂无站点，点击右上角添加站点开始监控
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedGroups.map(group => {
        const sitesInGroup = groupedSites[group.id] || [];
        if (sitesInGroup.length === 0) return null;
        
        const isExpanded = expandedGroups[group.id] !== false;

        return (
          <div key={group.id} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => toggleGroup(group.id)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                )}
                {group.icon && (
                  <i className={`${group.icon} w-4 h-4`} style={{ color: group.iconColor || '#3B82F6' }} />
                )}
                <span className="font-medium text-slate-900 dark:text-white">{group.name}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                  ({sitesInGroup.length})
                </span>
              </div>
            </button>

            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sitesInGroup.map((site, siteIndex) => (
                      <div
                        key={site.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => handleMoveSite(group.id, siteIndex, -1)}
                            disabled={siteIndex === 0}
                            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="上移"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleMoveSite(group.id, siteIndex, 1)}
                            disabled={siteIndex === sitesInGroup.length - 1}
                            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="下移"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>

                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          site.status === 'online' ? 'bg-emerald-500' :
                          site.status === 'offline' ? 'bg-red-500' :
                          site.status === 'slow' ? 'bg-amber-500' : 'bg-slate-400'
                        }`} />

                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                            {site.name}
                          </div>
                          <a
                            href={site.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1 truncate"
                          >
                            {site.url.length > 50 ? site.url.substring(0, 50) + '...' : site.url}
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        </div>

                        <div className="hidden sm:flex items-center gap-4 text-sm">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBgColor(site.status)}`}>
                            {getStatusText(site.status)}
                          </span>
                          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 w-20">
                            <TrendingUp className="w-3 h-3" />
                            {formatResponseTime(site.responseTime)}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 w-20">
                            {site.stats?.uptime !== undefined ? `${site.stats.uptime}%` : '-'}
                          </div>
                          <div className="text-slate-400 dark:text-slate-500 w-24 text-xs">
                            {site.lastCheck ? formatTimeAgo(site.lastCheck) : '未检查'}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onEdit(site)}
                            className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                            title="编辑"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDelete(site.id)}
                            className="p-1.5 rounded-lg bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 hover:bg-danger-200 dark:hover:bg-danger-900/50 transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
