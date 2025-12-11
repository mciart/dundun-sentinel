import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock } from 'lucide-react';
import { useHistory } from '../context/HistoryContext';

export default function HistoryModal({ site, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [timeRange, setTimeRange] = useState(24); 
  const [statusFilter, setStatusFilter] = useState('all'); 
  const scrollContainerRef = useRef(null);
  

  const { getHistory: getCachedHistory } = useHistory();

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  useEffect(() => {
    const loadHistory = () => {
      setLoading(true);
      try {
        
        const savedSettings = localStorage.getItem('monitorSettings');
        const settings = savedSettings ? JSON.parse(savedSettings) : { historyHours: 24 };
        const hours = settings.historyHours || 24;
        setTimeRange(hours);
        
        const cachedData = getCachedHistory(site.id);
        const historyData = cachedData?.history || [];
        
        setHistory(historyData);
        
        const total = historyData?.length || 0;
        const online = historyData?.filter(r => r.status === 'online').length || 0;
        const slow = historyData?.filter(r => r.status === 'slow').length || 0;
        const offline = historyData?.filter(r => r.status === 'offline').length || 0;
        const avgResponseTime = total > 0
          ? Math.round(historyData.reduce((sum, r) => sum + (r.responseTime || 0), 0) / total)
          : 0;
        
        setStats({
          total,
          online,
          slow,
          offline,
          uptime: total > 0 ? ((online / total) * 100).toFixed(2) : 0,
          avgResponseTime
        });
      } catch (error) {
        console.error('加载历史数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    if (site) {
      loadHistory();
    }
  }, [site, getCachedHistory]);

  const filteredHistory = statusFilter === 'all' 
    ? history 
    : history.filter(r => r.status === statusFilter);

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onWheel={(e) => e.preventDefault()}
        onTouchMove={(e) => e.preventDefault()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                历史数据详情
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {(site.showUrl === true) ? `${site.name} - ${site.url}` : site.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 时间范围信息 */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                数据时间范围：
              </span>
              <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                最近 {timeRange} 小时
              </span>
            </div>
          </div>

          {/* 统计数据 */}
          {!loading && stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-slate-50 dark:bg-slate-900/50">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {stats.uptime}%
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  在线率
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.online}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  正常次数
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-600 dark:text-slate-300">
                  {stats.total}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  总检测次数
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {stats.avgResponseTime}ms
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  平均响应时间
                </div>
              </div>
            </div>
          )}

          {/* 状态筛选按钮 */}
          {!loading && (
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mr-2">
                  状态筛选:
                </span>
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === 'all'
                      ? 'bg-primary-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  全部 ({stats?.total || 0})
                </button>
                <button
                  onClick={() => setStatusFilter('online')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === 'online'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  正常 ({stats?.online || 0})
                </button>
                <button
                  onClick={() => setStatusFilter('slow')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === 'slow'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  缓慢 ({stats?.slow || 0})
                </button>
                <button
                  onClick={() => setStatusFilter('offline')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === 'offline'
                      ? 'bg-red-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  异常 ({stats?.offline || 0})
                </button>
              </div>
            </div>
          )}

          {/* 历史记录列表 */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-6"
            onWheel={(e) => {
              const element = scrollContainerRef.current;
              if (!element) return;
              
              const { scrollTop, scrollHeight, clientHeight } = element;
              const isAtTop = scrollTop === 0;
              const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;
              

              if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
                e.preventDefault();
              }
            }}
          >
            {loading ? (
              <div className="text-center py-12">
                <div className="loading-dots text-primary-600 dark:text-primary-400">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <p className="mt-4 text-slate-500 dark:text-slate-400">加载中...</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">
                  {history.length === 0 ? '暂无历史数据' : '暂无符合条件的记录'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredHistory.slice(0, 100).map((record, index) => {
                  const date = new Date(record.timestamp);
                  const dateStr = date.toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                  }).replace(/\//g, '-');
                  const timeStr = date.toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  const statusColor = 
                    record.status === 'online' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' :
                    record.status === 'slow' ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' :
                    'text-red-600 bg-red-50 dark:bg-red-900/20';

                  const statusText = 
                    record.status === 'online' ? '正常' :
                    record.status === 'slow' ? '缓慢' : '异常';

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.01 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          record.status === 'online' ? 'bg-emerald-500' :
                          record.status === 'slow' ? 'bg-amber-500' : 'bg-red-500'
                        }`} />
                        <div>
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {dateStr} {timeStr}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                          {statusText}
                        </span>
                        <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                          <Clock className="w-3 h-3" />
                          <span>{record.responseTime}ms</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                {filteredHistory.length > 100 && (
                  <div className="text-center py-4 text-sm text-slate-500 dark:text-slate-400">
                    显示最近 100 条记录（共 {filteredHistory.length} 条{statusFilter !== 'all' && ` · 已筛选`}）
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 底部按钮 */}
          <div className="p-6 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-medium transition-colors"
            >
              关闭
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
