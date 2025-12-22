import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { api } from '../utils/api';

const HistoryContext = createContext();

export function HistoryProvider({ children }) {
  const [historyCache, setHistoryCache] = useState({});
  const [loading, setLoading] = useState(false);
  const fetchPromiseRef = useRef(null);

  // 实时获取历史数据（聚合表优化后，N 站点只读 N 行，无需缓存）
  const fetchAllHistory = useCallback(async (hours = 24) => {
    // 防止并发请求
    if (fetchPromiseRef.current) {
      return fetchPromiseRef.current;
    }

    setLoading(true);
    
    const promise = api.getAllHistory(hours)
      .then(data => {
        setHistoryCache(data);
        fetchPromiseRef.current = null;
        return data;
      })
      .catch(error => {
        console.error('❌ 批量获取历史数据失败:', error);
        fetchPromiseRef.current = null;
        return {};
      })
      .finally(() => {
        setLoading(false);
      });

    fetchPromiseRef.current = promise;
    return promise;
  }, []);

  const getHistory = useCallback((siteId) => {
    return historyCache[siteId] || null;
  }, [historyCache]);

  const clearCache = useCallback(() => {
    setHistoryCache({});
    fetchPromiseRef.current = null;
  }, []);

  const value = {
    historyCache,
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
