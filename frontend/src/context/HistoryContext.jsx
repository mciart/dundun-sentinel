import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { api } from '../utils/api';

const HistoryContext = createContext();

export function HistoryProvider({ children }) {
  const [historyCache, setHistoryCache] = useState({});
  const [loading, setLoading] = useState(false);
  const lastFetchTimeRef = useRef(null);
  const fetchPromiseRef = useRef(null);
  const cacheRef = useRef({});


  const fetchAllHistory = useCallback(async (hours = 24, force = false) => {

    if (fetchPromiseRef.current && !force) {
      return fetchPromiseRef.current;
    }

    if (!force && lastFetchTimeRef.current && Date.now() - lastFetchTimeRef.current < 5 * 60 * 1000) {
      return cacheRef.current;
    }

    setLoading(true);
    
    const promise = api.getAllHistory(hours)
      .then(data => {
        cacheRef.current = data;
        setHistoryCache(data);
        lastFetchTimeRef.current = Date.now();
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
    cacheRef.current = {};
    setHistoryCache({});
    lastFetchTimeRef.current = null;
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
