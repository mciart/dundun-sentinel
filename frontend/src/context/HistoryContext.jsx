import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { api } from '../utils/api';

const HistoryContext = createContext();

export function HistoryProvider({ children }) {
  const [historyCache, setHistoryCache] = useState({});
  const [loading, setLoading] = useState(false);
  const [cacheVersion, setCacheVersion] = useState(0);
  const versionRef = useRef(null);
  const loadingRef = useRef(new Set()); // 正在加载的站点ID
  const hoursRef = useRef(1);

  // 标准化历史记录
  const normalizeHistoryRecord = (record) => ({
    timestamp: record.timestamp || record.t,
    status: record.status || record.s,
    statusCode: record.statusCode || record.c,
    responseTime: record.responseTime || record.r,
    message: record.message || record.m
  });

  // 获取数据版本号（带缓存）
  const getVersion = useCallback(async () => {
    if (versionRef.current) return versionRef.current;
    const { version } = await api.getDataVersion();
    versionRef.current = version;
    return version;
  }, []);

  // 设置小时数
  const setHours = useCallback((hours) => {
    hoursRef.current = hours;
  }, []);

  // 单站点加载（带缓存检查，防止重复加载）
  const loadSiteHistory = useCallback(async (siteId) => {
    // 已有缓存，不重复加载
    if (historyCache[siteId]) return historyCache[siteId];

    // 正在加载中，不重复请求
    if (loadingRef.current.has(siteId)) return null;

    loadingRef.current.add(siteId);

    try {
      const version = await getVersion();
      const history = await api.getSiteHistoryWithVersion(siteId, hoursRef.current, version);
      const historyArray = Array.isArray(history) ? history : (history?.history || []);
      const normalized = { history: historyArray.map(normalizeHistoryRecord) };

      setHistoryCache(prev => ({ ...prev, [siteId]: normalized }));
      setCacheVersion(v => v + 1);
      return normalized;
    } catch (error) {
      console.warn(`站点 ${siteId} 历史加载失败:`, error);
      return { history: [] };
    } finally {
      loadingRef.current.delete(siteId);
    }
  }, [historyCache, getVersion]);

  // 批量预加载（智能缓存：只在版本变化时清除）
  const preloadSites = useCallback(async (siteIds = [], hours = 1) => {
    if (!siteIds || siteIds.length === 0) return {};

    hoursRef.current = hours;
    setLoading(true);
    const startTime = Date.now();
    const BATCH_SIZE = 4;

    try {
      // 获取最新版本号
      const { version: newVersion } = await api.getDataVersion();
      const oldVersion = versionRef.current;

      // 版本变化时清除缓存
      if (oldVersion && newVersion !== oldVersion) {
        console.log(`[HistoryContext] 版本变化: ${oldVersion} → ${newVersion}，清除缓存`);
        setHistoryCache({});
      }
      versionRef.current = newVersion;

      // 过滤已缓存的站点（版本相同时复用缓存）
      const uncachedIds = siteIds.filter(id => !historyCache[id]);
      console.log(`[HistoryContext] 预加载: ${uncachedIds.length}/${siteIds.length} 未缓存, v=${newVersion}`);

      if (uncachedIds.length === 0) {
        console.log('[HistoryContext] 全部命中缓存');
        return historyCache;
      }

      // 分批并发加载
      for (let i = 0; i < uncachedIds.length; i += BATCH_SIZE) {
        const batch = uncachedIds.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (siteId) => {
            try {
              const history = await api.getSiteHistoryWithVersion(siteId, hours, newVersion);
              const historyArray = Array.isArray(history) ? history : (history?.history || []);
              return { siteId, history: historyArray.map(normalizeHistoryRecord) };
            } catch (error) {
              console.warn(`站点 ${siteId} 历史加载失败:`, error);
              return { siteId, history: [] };
            }
          })
        );

        // 渐进更新 UI
        const batchData = {};
        for (const result of batchResults) {
          batchData[result.siteId] = { history: result.history };
        }
        setHistoryCache(prev => ({ ...prev, ...batchData }));
      }

      const elapsed = Date.now() - startTime;
      console.log(`[HistoryContext] 预加载完成: ${uncachedIds.length} 站点, ${elapsed}ms`);
      setCacheVersion(v => v + 1);
    } catch (error) {
      console.error('❌ 预加载失败:', error);
    } finally {
      setLoading(false);
    }
  }, [historyCache]);

  // 清除缓存
  const clearCache = useCallback(() => {
    setHistoryCache({});
    setCacheVersion(0);
    versionRef.current = null;
  }, []);

  // 重置版本（数据更新时调用）
  const invalidateVersion = useCallback(() => {
    versionRef.current = null;
  }, []);

  const getHistory = useCallback((siteId) => {
    return historyCache[siteId] || null;
  }, [historyCache]);

  const value = {
    historyCache,
    cacheVersion,
    loading,
    loadSiteHistory,   // 单站点懒加载
    preloadSites,      // 批量预加载
    getHistory,
    clearCache,
    invalidateVersion,
    setHours
  };

  return (
    <HistoryContext.Provider value={value}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
}
