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

  // 获取历史数据 - 带版本号实现缓存控制
  const fetchAllHistory = useCallback(async (hours = 1) => {
    setLoading(true);
    const startTime = Date.now();

    try {
      // 获取数据版本号用于缓存控制
      const { version } = await api.getDataVersion();

      // 带版本号请求历史数据（相同版本号会命中 CF 缓存）
      const data = await api.getAllHistory(hours, version);

      // 新格式：data[siteId] 直接是 history 数组，不再是 { history, stats }
      const normalizedData = {};
      for (const [siteId, historyArray] of Object.entries(data)) {
        // 如果是数组直接处理，兼容旧格式
        const history = Array.isArray(historyArray) ? historyArray : (historyArray?.history || []);
        normalizedData[siteId] = {
          history: history.map(normalizeHistoryRecord)
        };
      }

      const elapsed = Date.now() - startTime;
      console.log(`[HistoryContext] 历史数据加载完成: ${Object.keys(normalizedData).length} 站点, ${elapsed}ms, v=${version}`);
      setHistoryCache(normalizedData);
      setCacheVersion(v => v + 1);
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
