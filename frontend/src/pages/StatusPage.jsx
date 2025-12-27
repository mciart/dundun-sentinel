import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Server,
  ServerCog,
  ServerCrash,
  TrendingUp,
  Gauge
} from 'lucide-react';
import { api, getToken } from '../utils/api';
import {
  formatTimeAgo,
  formatResponseTime,
  groupSites,
  getLucideIcon
} from '../utils/helpers';
import { REFRESH_INTERVAL, BRAND } from '../config';
import StatsCard from '../components/StatsCard';
import SiteCard from '../components/SiteCard';
import StarryBackground from '../components/StarryBackground';
import ThemeToggle from '../components/ThemeToggle';
import IncidentCarousel from '../components/IncidentCarousel';
import HostMonitorPanel from '../components/HostMonitorPanel';
import { useHistory } from '../context/HistoryContext';

export default function StatusPage() {
  const [sites, setSites] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [siteSettings, setSiteSettings] = useState({
    siteName: BRAND.siteName,
    siteSubtitle: BRAND.siteSubtitle,
    pageTitle: BRAND.pageTitle,
    hostDisplayMode: 'card',
    hostPanelExpanded: true
  });

  const { fetchAllHistory, historyCache } = useHistory();

  const loadGroups = async () => {
    try {
      const data = await api.getGroups();
      setGroups(data.groups || []);
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  };

  const loadData = async () => {
    try {
      const dashboard = await api.getDashboard();
      const sitesList = Array.isArray(dashboard?.sites) ? dashboard.sites : [];
      const groupList = Array.isArray(dashboard?.groups) ? dashboard.groups : [];
      const cfg = dashboard?.settings || {};

      setSites(sitesList);
      setGroups(groupList);
      const settings = {
        siteName: cfg.siteName || BRAND.siteName,
        siteSubtitle: cfg.siteSubtitle || BRAND.siteSubtitle,
        pageTitle: cfg.pageTitle || BRAND.pageTitle,
        hostDisplayMode: cfg.hostDisplayMode || 'card',
        hostPanelExpanded: cfg.hostPanelExpanded !== false
      };
      setSiteSettings(settings);
      document.title = `${settings.siteName} - ${settings.pageTitle}`;
      setLastUpdate(Date.now());

      const inc = Array.isArray(dashboard?.incidents) ? dashboard.incidents : [];
      setIncidents(inc);


      // 实时获取历史数据 - 默认1小时减少D1行读取
      let historyHours = 1;
      try {
        const savedSettings = localStorage.getItem('monitorSettings');
        if (savedSettings) {
          const storeSettings = JSON.parse(savedSettings);
          if (storeSettings && typeof storeSettings.historyHours === 'number') {
            historyHours = storeSettings.historyHours;
          }
        }
      } catch (error) {
        console.warn('monitorSettings 解析失败，使用默认历史范围', error);
      }
      fetchAllHistory(historyHours || 1);
    } catch (error) {
      console.error('加载仪表盘失败:', error);
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    loadData();
  }, []);

  // 使用 ref 保存最新的 loadData 函数，避免闭包陷阱
  const loadDataRef = useRef(loadData);
  useEffect(() => {
    loadDataRef.current = loadData;
  });

  // 定时刷新：每分钟执行一次
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      loadDataRef.current();
    }, REFRESH_INTERVAL);

    return () => clearInterval(timer);
  }, [autoRefresh]);


  // 使用 useMemo 缓存平均响应时间计算
  const avgResponseTime = useMemo(() => {
    if (sites.length === 0) return 0;

    let totalResponseTime = 0;
    let totalCount = 0;

    for (const site of sites) {
      const siteHistory = historyCache[site.id]?.history || [];
      const recentRecords = siteHistory.slice(0, 30);

      for (const record of recentRecords) {
        if (record.responseTime && record.responseTime > 0) {
          totalResponseTime += record.responseTime;
          totalCount++;
        }
      }
    }

    return totalCount > 0 ? Math.round(totalResponseTime / totalCount) : 0;
  }, [sites, historyCache]);

  const globalStats = useMemo(() => ({
    total: sites.length,
    online: sites.filter(s => s.status === 'online').length,
    offline: sites.filter(s => s.status === 'offline').length,
    avgResponseTime,
  }), [sites, avgResponseTime]);


  const lastCheckTime = sites.length > 0
    ? Math.max(...sites.map(s => s.lastCheck || 0))
    : null;

  const groupedSites = groupSites(sites, groups);

  return (
    <div className="flex flex-col min-h-screen relative">
      {/* 星空背景 */}
      <StarryBackground />

      {/* 头部 - 悬挂式设计 */}
      <div className="sm:sticky top-0 z-50 px-4 sm:px-6 lg:px-8">
        <header className="max-w-7xl mx-auto backdrop-blur-md bg-white/70 dark:bg-dark-card/70 shadow-lg rounded-b-2xl border-x border-b border-[--border-color]">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-[auto,1fr,auto] items-center h-16 gap-4">
              {/* Logo */}
              <div
                className="flex items-center gap-4 min-w-0"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                  <img src="/img/favicon.ico" alt="Logo" className="w-10 h-10" />
                </div>
                <div className="flex flex-col min-w-0">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 via-emerald-600 to-blue-600 dark:from-primary-400 dark:via-emerald-400 dark:to-blue-400 bg-clip-text text-transparent tracking-tight truncate">
                    {siteSettings.siteName}
                  </h1>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 tracking-wide whitespace-nowrap">
                    {siteSettings.siteSubtitle}
                  </p>
                </div>
              </div>

              {/* 右侧区域 */}
              <div className="flex items-center gap-3 justify-end">
                {/* 最后监测时间 */}
                {lastCheckTime > 0 && (
                  <div
                    className="hidden md:flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                  >
                    <span className="font-medium whitespace-nowrap">
                      数据更新: {new Date(lastCheckTime).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      }).replace(/\//g, '-')}
                    </span>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  </div>
                )}

                {/* 主题切换按钮 */}
                <div>
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* 主内容 */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* 全局统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-8">
          <StatsCard
            icon={Server}
            label="总站点数"
            value={globalStats.total}
            color="blue"
          />
          <StatsCard
            icon={ServerCog}
            label="在线站点"
            value={globalStats.online}
            color="green"
          />
          <StatsCard
            icon={ServerCrash}
            label="离线站点"
            value={globalStats.offline}
            color="red"
          />
          <StatsCard
            icon={Gauge}
            label="平均响应"
            value={formatResponseTime(globalStats.avgResponseTime)}
            color="purple"
          />
        </div>

        {/* 异常通知轮播 */}
        <div className="mb-8">
          <IncidentCarousel autoInterval={5000} initialIncidents={incidents} />
        </div>

        {/* 主机监控面板 */}
        <HostMonitorPanel
          sites={sites}
          displayMode={siteSettings.hostDisplayMode}
          defaultExpanded={siteSettings.hostPanelExpanded}
          onReorder={getToken() ? async (siteIds) => {
            try {
              await api.reorderHosts(siteIds);
              loadData();
            } catch (error) {
              console.error('排序失败:', error);
            }
          } : null}
        />

        {/* 站点状态 */}
        {loading ? (
          <div className="glass-card p-12 text-center">
            <div className="loading-dots text-primary-600 dark:text-primary-400">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p className="mt-4 text-slate-500 dark:text-slate-400">加载中...</p>
          </div>
        ) : sites.length === 0 ? (
          <div
            className="glass-card p-12 text-center"
          >
            <TrendingUp className="w-16 h-16 mx-auto text-slate-400 mb-4" />
            <p className="text-xl font-medium text-slate-600 dark:text-slate-300 mb-2">
              暂无监控站点
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              暂无可显示的监控站点
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedSites).map(([group, groupSites], groupIndex) => (
              <div
                key={group}
                className="space-y-3"
              >
                {/* 分类标题 */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 pl-9 sm:pl-10">
                  {(() => {
                    const groupObj = groups.find(g => g.name === group);
                    if (!groupObj?.icon) return null;
                    const IconComponent = getLucideIcon(groupObj.icon);
                    return IconComponent ? (
                      <IconComponent
                        className="w-8 h-8 flex-shrink-0"
                        style={{ color: groupObj.iconColor || 'currentColor' }}
                      />
                    ) : null;
                  })()}
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                    {group}
                  </h2>
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                    {groupSites.length} 个站点
                  </span>
                </div>

                {/* 站点列表 */}
                <div className="glass-card p-5">
                  <div className="space-y-0">
                    {groupSites.map((site, siteIndex) => (
                      <SiteCard
                        key={site.id}
                        site={site}
                        index={siteIndex}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 页脚 */}
      <footer className="py-4 mt-auto border-t border-[--border-color]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-1">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} {siteSettings.siteName} · 网站监控平台
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            <a
              href="https://github.com/mciart/dundun-sentinel"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary-500 dark:hover:text-primary-400 transition-colors inline-flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
              dundun-sentinel · 项目开源
            </a>
          </p>
        </div>
      </footer>

      {/* 历史数据详情功能已移除 */}
    </div>
  );
}
