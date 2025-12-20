import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, Reorder } from 'framer-motion';
import { 
  Server, 
  Cpu, 
  MemoryStick, 
  HardDrive, 
  Activity,
  Clock,
  Wifi,
  WifiOff,
  Thermometer,
  ChevronDown,
  ChevronUp,
  X,
  TrendingUp,
  BarChart3,
  GripVertical
} from 'lucide-react';
import { api } from '../utils/api';

/**
 * 主机监控面板组件
 * 用于显示 Push 心跳监控的主机状态和详细指标
 */
export default function HostMonitorPanel({ sites = [], displayMode = 'card', onReorder }) {
  const [expanded, setExpanded] = useState(true);
  const [selectedHost, setSelectedHost] = useState(null);
  const [items, setItems] = useState([]);
  
  // 过滤出 Push 类型且设置为在主机面板显示的站点
  const pushSites = useMemo(() => {
    const filtered = sites.filter(site => 
      site.monitorType === 'push' && site.showInHostPanel !== false
    );
    // 按 hostSortOrder 排序
    return filtered.sort((a, b) => {
      const orderA = typeof a.hostSortOrder === 'number' ? a.hostSortOrder : 999999;
      const orderB = typeof b.hostSortOrder === 'number' ? b.hostSortOrder : 999999;
      return orderA - orderB;
    });
  }, [sites]);

  // 同步 items 状态
  useEffect(() => {
    setItems(pushSites);
  }, [pushSites]);

  // 统计数据
  const stats = useMemo(() => {
    const online = pushSites.filter(s => s.status === 'online').length;
    const offline = pushSites.filter(s => s.status === 'offline').length;
    const unknown = pushSites.filter(s => s.status === 'unknown').length;
    return { total: pushSites.length, online, offline, unknown };
  }, [pushSites]);

  // 处理拖拽排序
  const handleReorder = (newOrder) => {
    setItems(newOrder);
  };

  const handleDragEnd = async () => {
    if (onReorder) {
      const siteIds = items.map(site => site.id);
      await onReorder(siteIds);
    }
  };

  // 没有 Push 站点时不渲染
  if (pushSites.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      {/* 标题栏 */}
      <div 
        className="flex items-center justify-between mb-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              主机监控
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {stats.online}/{stats.total} 在线 · Push 心跳模式
            </p>
          </div>
        </div>
        <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* 主机卡片网格 / 列表 */}
      {expanded && displayMode === 'card' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pushSites.map((site) => (
            <HostCard 
              key={site.id} 
              site={site} 
              onClick={() => setSelectedHost(site)}
            />
          ))}
        </div>
      )}

      {/* 列表模式 - 支持拖拽排序（仅登录后） */}
      {expanded && displayMode === 'list' && onReorder && (
        <div className="glass-card overflow-hidden">
          <Reorder.Group 
            axis="y" 
            values={items} 
            onReorder={handleReorder}
            className="divide-y divide-slate-100 dark:divide-slate-800"
          >
            {items.map((site) => (
              <HostListItem
                key={site.id}
                site={site}
                onClick={() => setSelectedHost(site)}
                onDragEnd={handleDragEnd}
                canDrag={true}
              />
            ))}
          </Reorder.Group>
        </div>
      )}

      {/* 列表模式 - 无拖拽（未登录） */}
      {expanded && displayMode === 'list' && !onReorder && (
        <div className="glass-card overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {pushSites.map((site) => (
              <HostListItemStatic
                key={site.id}
                site={site}
                onClick={() => setSelectedHost(site)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {selectedHost && (
        <HostDetailModal 
          site={selectedHost} 
          onClose={() => setSelectedHost(null)} 
        />
      )}
    </div>
  );
}

/**
 * 列表模式下的单个主机项（可拖拽）
 */
function HostListItem({ site, onClick, onDragEnd, canDrag }) {
  const pushData = site.pushData || {};
  const isOnline = site.status === 'online';
  const isOffline = site.status === 'offline';
  const lastHeartbeat = site.lastHeartbeat || site.lastCheck || 0;

  // 格式化最后心跳时间
  const formatLastSeen = (timestamp) => {
    if (!timestamp) return '从未';
    const diff = Date.now() - timestamp;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return `${Math.floor(diff / 86400000)}天前`;
  };

  // 获取使用率颜色
  const getUsageColor = (value) => {
    if (value === null || value === undefined) return 'text-slate-400';
    if (value >= 90) return 'text-red-500';
    if (value >= 70) return 'text-amber-500';
    return 'text-emerald-500';
  };

  return (
    <Reorder.Item
      value={site}
      onDragEnd={onDragEnd}
      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors bg-white dark:bg-transparent cursor-pointer"
    >
      {/* 拖拽手柄 */}
      {canDrag && (
        <div className="flex flex-col gap-0.5 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400">
          <GripVertical className="w-4 h-4" />
        </div>
      )}

      {/* 状态指示点 */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
        isOnline ? 'bg-emerald-500' :
        isOffline ? 'bg-red-500' : 'bg-slate-400'
      }`} />

      {/* 主机名称和状态 */}
      <div 
        className="flex-1 min-w-0"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
          {site.name}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {formatLastSeen(lastHeartbeat)}
        </div>
      </div>

      {/* 指标显示 */}
      <div 
        className="hidden sm:flex items-center gap-4 text-sm"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* CPU */}
        <div className="flex items-center gap-1.5 w-16">
          <Cpu className="w-3.5 h-3.5 text-slate-400" />
          <span className={`font-medium ${getUsageColor(pushData.cpu)}`}>
            {pushData.cpu !== null && pushData.cpu !== undefined ? `${pushData.cpu.toFixed(0)}%` : '-'}
          </span>
        </div>
        
        {/* 内存 */}
        <div className="flex items-center gap-1.5 w-16">
          <MemoryStick className="w-3.5 h-3.5 text-slate-400" />
          <span className={`font-medium ${getUsageColor(pushData.memory)}`}>
            {pushData.memory !== null && pushData.memory !== undefined ? `${pushData.memory.toFixed(0)}%` : '-'}
          </span>
        </div>

        {/* 磁盘 */}
        <div className="flex items-center gap-1.5 w-16">
          <HardDrive className="w-3.5 h-3.5 text-slate-400" />
          <span className={`font-medium ${getUsageColor(pushData.disk)}`}>
            {pushData.disk !== null && pushData.disk !== undefined ? `${pushData.disk.toFixed(0)}%` : '-'}
          </span>
        </div>

        {/* 状态标签 */}
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          isOnline ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
          isOffline ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
          'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
        }`}>
          {isOnline ? '在线' : isOffline ? '离线' : '等待'}
        </span>
      </div>

      {/* 移动端简化显示 */}
      <div 
        className="sm:hidden flex items-center gap-2"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          isOnline ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
          isOffline ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
          'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
        }`}>
          {isOnline ? '在线' : isOffline ? '离线' : '等待'}
        </span>
      </div>
    </Reorder.Item>
  );
}

/**
 * 列表模式下的单个主机项（静态，不可拖拽）
 */
function HostListItemStatic({ site, onClick }) {
  const pushData = site.pushData || {};
  const isOnline = site.status === 'online';
  const isOffline = site.status === 'offline';
  const lastHeartbeat = site.lastHeartbeat || site.lastCheck || 0;

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return '从未';
    const diff = Date.now() - timestamp;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return `${Math.floor(diff / 86400000)}天前`;
  };

  const getUsageColor = (value) => {
    if (value === null || value === undefined) return 'text-slate-400';
    if (value >= 90) return 'text-red-500';
    if (value >= 70) return 'text-amber-500';
    return 'text-emerald-500';
  };

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors bg-white dark:bg-transparent cursor-pointer"
    >
      {/* 状态指示点 */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
        isOnline ? 'bg-emerald-500' :
        isOffline ? 'bg-red-500' : 'bg-slate-400'
      }`} />

      {/* 主机名称和状态 */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
          {site.name}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {formatLastSeen(lastHeartbeat)}
        </div>
      </div>

      {/* 指标显示 */}
      <div className="hidden sm:flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5 w-16">
          <Cpu className="w-3.5 h-3.5 text-slate-400" />
          <span className={`font-medium ${getUsageColor(pushData.cpu)}`}>
            {pushData.cpu !== null && pushData.cpu !== undefined ? `${pushData.cpu.toFixed(0)}%` : '-'}
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 w-16">
          <MemoryStick className="w-3.5 h-3.5 text-slate-400" />
          <span className={`font-medium ${getUsageColor(pushData.memory)}`}>
            {pushData.memory !== null && pushData.memory !== undefined ? `${pushData.memory.toFixed(0)}%` : '-'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 w-16">
          <HardDrive className="w-3.5 h-3.5 text-slate-400" />
          <span className={`font-medium ${getUsageColor(pushData.disk)}`}>
            {pushData.disk !== null && pushData.disk !== undefined ? `${pushData.disk.toFixed(0)}%` : '-'}
          </span>
        </div>

        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          isOnline ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
          isOffline ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
          'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
        }`}>
          {isOnline ? '在线' : isOffline ? '离线' : '等待'}
        </span>
      </div>

      {/* 移动端简化显示 */}
      <div className="sm:hidden flex items-center gap-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          isOnline ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
          isOffline ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
          'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
        }`}>
          {isOnline ? '在线' : isOffline ? '离线' : '等待'}
        </span>
      </div>
    </div>
  );
}

/**
 * 单个主机卡片
 */
function HostCard({ site, onClick }) {
  const pushData = site.pushData || {};
  const isOnline = site.status === 'online';
  const isOffline = site.status === 'offline';
  const lastHeartbeat = site.lastHeartbeat || site.lastCheck || 0;

  // 格式化运行时间
  const formatUptime = (seconds) => {
    if (!seconds || seconds <= 0) return '-';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}天 ${hours}时`;
    if (hours > 0) return `${hours}时 ${mins}分`;
    return `${mins}分钟`;
  };

  // 格式化最后心跳时间
  const formatLastSeen = (timestamp) => {
    if (!timestamp) return '从未';
    const diff = Date.now() - timestamp;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return `${Math.floor(diff / 86400000)}天前`;
  };

  // 获取使用率颜色
  const getUsageColor = (value) => {
    if (value === null || value === undefined) return 'text-slate-400';
    if (value >= 90) return 'text-red-500';
    if (value >= 70) return 'text-amber-500';
    return 'text-emerald-500';
  };

  // 获取进度条颜色
  const getProgressColor = (value) => {
    if (value === null || value === undefined) return 'bg-slate-200 dark:bg-slate-700';
    if (value >= 90) return 'bg-red-500';
    if (value >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div
      onClick={onClick}
      className={`
        glass-card p-4 relative overflow-hidden cursor-pointer
        hover:shadow-lg hover:scale-[1.02] transition-all duration-200
        ${isOffline ? 'border-red-200 dark:border-red-800' : ''}
      `}
    >
      {/* 状态指示条 */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${
        isOnline ? 'bg-emerald-500' : isOffline ? 'bg-red-500' : 'bg-slate-400'
      }`} />

      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${
            isOnline ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
            isOffline ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
            'bg-slate-100 dark:bg-slate-800 text-slate-500'
          }`}>
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[150px]" title={site.name}>
              {site.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatLastSeen(lastHeartbeat)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-400" />
          <div className={`
            px-2 py-0.5 rounded-full text-xs font-medium
            ${isOnline ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
              isOffline ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
              'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}
          `}>
            {isOnline ? '在线' : isOffline ? '离线' : '等待'}
          </div>
        </div>
      </div>

      {/* 指标网格 */}
      <div className="grid grid-cols-2 gap-3">
        <MetricItem
          icon={<Cpu className="w-4 h-4" />}
          label="CPU"
          value={pushData.cpu}
          unit="%"
          getColor={getUsageColor}
          getProgressColor={getProgressColor}
        />
        <MetricItem
          icon={<MemoryStick className="w-4 h-4" />}
          label="内存"
          value={pushData.memory}
          unit="%"
          getColor={getUsageColor}
          getProgressColor={getProgressColor}
        />
        <MetricItem
          icon={<HardDrive className="w-4 h-4" />}
          label="磁盘"
          value={pushData.disk}
          unit="%"
          getColor={getUsageColor}
          getProgressColor={getProgressColor}
        />
        {pushData.load !== null && pushData.load !== undefined ? (
          <MetricItem
            icon={<Activity className="w-4 h-4" />}
            label="负载"
            value={pushData.load}
            unit=""
            showProgress={false}
          />
        ) : (
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400">运行</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                {formatUptime(pushData.uptime)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 温度（如果有） */}
      {pushData.temperature !== null && pushData.temperature !== undefined && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <Thermometer className={`w-4 h-4 ${
            pushData.temperature >= 80 ? 'text-red-500' :
            pushData.temperature >= 60 ? 'text-amber-500' :
            'text-blue-500'
          }`} />
          <span className="text-sm text-slate-600 dark:text-slate-400">
            温度: <span className="font-medium">{pushData.temperature}°C</span>
          </span>
        </div>
      )}

      {/* 点击提示 */}
      <div className="absolute bottom-2 right-2 text-xs text-slate-400 dark:text-slate-500">
        点击查看详情
      </div>
    </div>
  );
}

/**
 * 主机详情弹窗
 */
function HostDetailModal({ site, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);
  const [activeMetric, setActiveMetric] = useState('cpu');

  const pushData = site.pushData || {};

  // 加载历史数据
  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const data = await api.getPushHistory(site.id, hours);
        setHistory(data.history || []);
      } catch (err) {
        console.error('加载 Push 历史失败:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [site.id, hours]);

  // 可用的指标列表
  const metrics = useMemo(() => {
    const base = [
      { key: 'cpu', label: 'CPU', unit: '%', icon: Cpu, color: '#10b981' },
      { key: 'memory', label: '内存', unit: '%', icon: MemoryStick, color: '#3b82f6' },
      { key: 'disk', label: '磁盘', unit: '%', icon: HardDrive, color: '#f59e0b' },
      { key: 'load', label: '负载', unit: '', icon: Activity, color: '#8b5cf6' },
      { key: 'temperature', label: '温度', unit: '°C', icon: Thermometer, color: '#ef4444' },
      { key: 'latency', label: '延迟', unit: 'ms', icon: TrendingUp, color: '#06b6d4' },
    ];
    
    // 检查自定义字段
    if (pushData.custom && typeof pushData.custom === 'object') {
      Object.keys(pushData.custom).forEach(key => {
        const customField = pushData.custom[key];
        // 支持 showHistory 参数控制是否显示历史
        if (typeof customField === 'object' && customField.showHistory !== false) {
          base.push({
            key: `custom.${key}`,
            label: customField.label || key,
            unit: customField.unit || '',
            icon: Activity,
            color: customField.color || '#64748b',
            isCustom: true
          });
        } else if (typeof customField === 'number') {
          // 数字类型直接显示
          base.push({
            key: `custom.${key}`,
            label: key,
            unit: '',
            icon: Activity,
            color: '#64748b',
            isCustom: true
          });
        }
      });
    }
    
    return base;
  }, [pushData.custom]);

  // 获取指标数据
  const getMetricValue = useCallback((record, metricKey) => {
    if (metricKey.startsWith('custom.')) {
      const customKey = metricKey.replace('custom.', '');
      const custom = record.custom;
      if (!custom) return null;
      const value = custom[customKey];
      if (typeof value === 'object' && value !== null) {
        return value.value ?? null;
      }
      return value ?? null;
    }
    return record[metricKey] ?? null;
  }, []);

  // 计算图表数据
  const chartData = useMemo(() => {
    if (!history.length) return [];
    
    // 采样数据点，最多显示 100 个点
    const maxPoints = 100;
    const step = Math.max(1, Math.floor(history.length / maxPoints));
    const sampled = history.filter((_, i) => i % step === 0);
    
    return sampled.map(record => ({
      timestamp: record.timestamp,
      value: getMetricValue(record, activeMetric)
    })).filter(d => d.value !== null);
  }, [history, activeMetric, getMetricValue]);

  // 计算统计数据
  const stats = useMemo(() => {
    const values = chartData.map(d => d.value).filter(v => v !== null && !isNaN(v));
    if (!values.length) return null;
    
    return {
      min: Math.min(...values).toFixed(1),
      max: Math.max(...values).toFixed(1),
      avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1),
      current: values[values.length - 1]?.toFixed(1) || '-'
    };
  }, [chartData]);

  const activeMetricInfo = metrics.find(m => m.key === activeMetric);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div 
        className="glass-card w-full max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${
                site.status === 'online' 
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              }`}>
                <Server className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                  {site.name}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  主机监控详情 · 历史数据走势
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
          {/* 时间范围选择 */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-sm text-slate-600 dark:text-slate-400">时间范围:</span>
            {[6, 12, 24, 48, 72, 168].map(h => (
              <button
                key={h}
                onClick={() => setHours(h)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  hours === h
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {h < 24 ? `${h}小时` : `${h / 24}天`}
              </button>
            ))}
          </div>

          {/* 指标选择 */}
          <div className="flex flex-wrap gap-2 mb-6">
            {metrics.map(metric => {
              const Icon = metric.icon;
              const isActive = activeMetric === metric.key;
              return (
                <button
                  key={metric.key}
                  onClick={() => setActiveMetric(metric.key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {metric.label}
                  {metric.isCustom && (
                    <span className="text-xs opacity-60">(自定义)</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 统计摘要 */}
          {stats && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="glass-card p-4 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">当前</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                  {stats.current}{activeMetricInfo?.unit}
                </p>
              </div>
              <div className="glass-card p-4 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">平均</p>
                <p className="text-2xl font-bold text-blue-500">
                  {stats.avg}{activeMetricInfo?.unit}
                </p>
              </div>
              <div className="glass-card p-4 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">最高</p>
                <p className="text-2xl font-bold text-red-500">
                  {stats.max}{activeMetricInfo?.unit}
                </p>
              </div>
              <div className="glass-card p-4 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">最低</p>
                <p className="text-2xl font-bold text-emerald-500">
                  {stats.min}{activeMetricInfo?.unit}
                </p>
              </div>
            </div>
          )}

          {/* 图表区域 */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-slate-500" />
              <h3 className="font-medium text-slate-800 dark:text-slate-200">
                {activeMetricInfo?.label} 走势图
              </h3>
            </div>
            
            {loading ? (
              <div className="h-64 flex items-center justify-center text-slate-500">
                加载中...
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-500">
                暂无历史数据
              </div>
            ) : (
              <SimpleLineChart 
                data={chartData} 
                color={activeMetricInfo?.color || '#10b981'}
                unit={activeMetricInfo?.unit || ''}
              />
            )}
          </div>

          {/* 自定义字段说明 */}
          <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              💡 自定义字段上传示例
            </h4>
            <pre className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 p-3 rounded-lg overflow-x-auto">
{`curl -X POST "https://your-worker/api/push/TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "cpu": 25.5,
    "memory": 60.2,
    "custom": {
      "gpu": { "value": 45, "label": "GPU", "unit": "%", "showHistory": true },
      "connections": { "value": 128, "label": "连接数", "showHistory": true },
      "queue_size": 42  // 简单数值也会被记录
    }
  }'`}
            </pre>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              设置 <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">showHistory: false</code> 可以隐藏某个字段的历史走势
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 简单折线图组件
 */
function SimpleLineChart({ data, color, unit }) {
  if (!data || data.length === 0) return null;

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // SVG 尺寸
  const width = 800;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 计算点坐标
  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
    const y = padding.top + chartHeight - ((d.value - min) / range) * chartHeight;
    return { x, y, ...d };
  });

  // 生成路径
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  
  // 生成区域填充路径
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;

  // Y 轴刻度
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
    value: (min + range * ratio).toFixed(1),
    y: padding.top + chartHeight * (1 - ratio)
  }));

  // X 轴时间标签
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const index = Math.floor(ratio * (data.length - 1));
    const point = data[index];
    return {
      label: new Date(point.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      x: padding.left + ratio * chartWidth
    };
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64">
      {/* 网格线 */}
      {yTicks.map((tick, i) => (
        <line
          key={i}
          x1={padding.left}
          y1={tick.y}
          x2={width - padding.right}
          y2={tick.y}
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeDasharray="4 4"
        />
      ))}

      {/* Y 轴标签 */}
      {yTicks.map((tick, i) => (
        <text
          key={i}
          x={padding.left - 10}
          y={tick.y}
          textAnchor="end"
          dominantBaseline="middle"
          className="text-xs fill-slate-500"
        >
          {tick.value}
        </text>
      ))}

      {/* X 轴标签 */}
      {xTicks.map((tick, i) => (
        <text
          key={i}
          x={tick.x}
          y={height - 5}
          textAnchor="middle"
          className="text-xs fill-slate-500"
        >
          {tick.label}
        </text>
      ))}

      {/* 区域填充 */}
      <path
        d={areaD}
        fill={color}
        fillOpacity={0.1}
      />

      {/* 折线 */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 数据点 */}
      {points.length <= 50 && points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3}
          fill={color}
        />
      ))}
    </svg>
  );
}

/**
 * 指标项组件
 */
function MetricItem({ icon, label, value, unit, getColor, getProgressColor, showProgress = true }) {
  const displayValue = value !== null && value !== undefined ? 
    (typeof value === 'number' ? value.toFixed(1) : value) : '-';
  const colorClass = getColor ? getColor(value) : 'text-slate-700 dark:text-slate-300';
  const progressColorClass = getProgressColor ? getProgressColor(value) : 'bg-slate-300';

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className={`text-sm font-medium ${colorClass}`}>
            {displayValue}{value !== null && value !== undefined ? unit : ''}
          </p>
        </div>
      </div>
      {showProgress && value !== null && value !== undefined && (
        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${progressColorClass}`}
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        </div>
      )}
    </div>
  );
}
