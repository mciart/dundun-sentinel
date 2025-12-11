import { motion } from 'framer-motion';
import { Edit, Trash2, ExternalLink, TrendingUp } from 'lucide-react';
import { formatTimeAgo, formatResponseTime, getStatusText, getStatusBgColor } from '../utils/helpers';

export default function SiteList({ sites, groups = [], onEdit, onDelete, onRefresh }) {
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
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
              站点名称
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
              URL
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
              分类
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
              状态
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
              响应时间
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
              在线率
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
              最后检查
            </th>
            <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {sites.map((site, index) => (
            <motion.tr
              key={site.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <td className="py-4 px-4">
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {site.name}
                </div>
              </td>
              <td className="py-4 px-4">
                <a
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                >
                  {site.url.length > 40 ? site.url.substring(0, 40) + '...' : site.url}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </td>
              <td className="py-4 px-4">
                <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {groups.find(g => g.id === site.groupId)?.name || '默认'}
                </span>
              </td>
              <td className="py-4 px-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBgColor(site.status)}`}>
                  {getStatusText(site.status)}
                </span>
              </td>
              <td className="py-4 px-4">
                <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                  <TrendingUp className="w-4 h-4" />
                  {formatResponseTime(site.responseTime)}
                </div>
              </td>
              <td className="py-4 px-4">
                <div className="text-sm font-medium">
                  {site.stats ? (
                    <span className={
                      site.stats.uptime >= 99 
                        ? 'text-primary-600 dark:text-primary-400' 
                        : site.stats.uptime >= 95
                        ? 'text-warning-600 dark:text-warning-400'
                        : 'text-danger-600 dark:text-danger-400'
                    }>
                      {site.stats.uptime}%
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </div>
              </td>
              <td className="py-4 px-4">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {site.lastCheck ? formatTimeAgo(site.lastCheck) : '未检查'}
                </div>
              </td>
              <td className="py-4 px-4">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(site)}
                    className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    title="编辑"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(site.id)}
                    className="p-2 rounded-lg bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 hover:bg-danger-200 dark:hover:bg-danger-900/50 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
