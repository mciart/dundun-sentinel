import { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../utils/api';

const HistoryContext = createContext();

export function HistoryProvider({ children }) {
  const [historyCache, setHistoryCache] = useState({});
  const [loading, setLoading] = useState(false);
  const [cacheVersion, setCacheVersion] = useState(0);

  // 标准化历史记录（支持短属性名 t,s,c,r,m 和完整属性名）
  const normalizeHistoryRecord = (record) => ({
    timestamp: record.timestamp || record.t,
    status: record.status || record.s,
    statusCode: record.statusCode || record.c,
    responseTime: record.responseTime || record.r,
    message: record.message || record.m
  });

  // 获取历史数据 - 每次调用都直接请求，不做并发防护
  const fetchAllHistory = useCallback(async (hours = 24) => {
    setLoading(true);
    const startTime = Date.now();

    try {
      const data = await api.getAllHistory(hours);

      // 标准化所有历史记录
      const normalizedData = {};
      for (const [siteId, siteData] of Object.entries(data)) {
        if (siteData.history) {
          normalizedData[siteId] = {
            ...siteData,
            history: siteData.history.map(normalizeHistoryRecord)
          };
        } else {
          normalizedData[siteId] = siteData;
        }
      }

      const siteCount = Object.keys(normalizedData).length;
      const elapsed = Date.now() - startTime;
      console.log(`[HistoryContext] 获取历史数据成功: ${siteCount} 个站点, 耗时 ${elapsed}ms`);
      setHistoryCache(normalizedData);
      setCacheVersion(v => v + 1); // 强制触发组件更新
      return normalizedData;
    } catch (error) {
      console.error('❌ 批量获取历史数据失败:', error);
      return {};
    } finally {
      setLoading(false);
    }
  }, []);

  const getHistory = useCallback((siteId) => {
    return historyCache[siteId] || null;
  }, [historyCache]);

  const clearCache = useCallback(() => {
    setHistoryCache({});
    setCacheVersion(0);
  }, []);

  const value = {
    historyCache,
    cacheVersion,
    loading,
    fetchAllHistory,
    getHistory,
    clearCache
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
