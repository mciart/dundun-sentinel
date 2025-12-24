import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronRight } from 'lucide-react';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/helpers';
import { getStatusClasses } from '../utils/status';
import { INCIDENT_ICONS, INCIDENT_LABELS } from './IncidentTicker';

const SLIDE_DURATION = 2000;

function isSameMonth(timestamp, now = new Date()) {
  if (!timestamp) return false;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export default function IncidentCarousel({ limit = 20, autoInterval = SLIDE_DURATION, initialIncidents = null }) {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef(null);

  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const { incidents: list = [] } = await api.getIncidents(Math.max(20, limit));
      const safeList = Array.isArray(list) ? list : [];
      const currentMonth = safeList.filter(item => isSameMonth(item?.createdAt));
      const displayList = currentMonth.length > 0 ? currentMonth : safeList;
      const finalList = displayList.slice(0, limit);
      setIncidents(finalList);
      if (finalList.length > 0) {
        setCurrentIndex(0);
      }
    } catch (err) {
      setError(err?.message || '加载异常通知失败');
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    const provided = Array.isArray(initialIncidents) ? initialIncidents : [];

    if (initialIncidents !== null) {
      const safeList = provided.slice(0, limit);
      setIncidents(safeList);
      setCurrentIndex(0);
      setLoading(false);
      setError('');
      return;
    }
    fetchIncidents();
  }, [fetchIncidents, initialIncidents, limit]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isPaused || incidents.length <= 1) return undefined;

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        if (incidents.length === 0) return 0;
        return (prev + 1) % incidents.length;
      });
    }, Math.max(2000, autoInterval));

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [incidents.length, autoInterval, isPaused]);

  useEffect(() => {
    if (incidents.length > 0 && currentIndex >= incidents.length) {
      setCurrentIndex(0);
    }
  }, [incidents.length, currentIndex]);

  const currentIncident = useMemo(() => {
    if (!incidents.length) return null;
    const index = currentIndex % incidents.length;
    return incidents[index] || null;
  }, [currentIndex, incidents]);

  const isEmpty = !loading && incidents.length === 0;

  const Icon = currentIncident ? (INCIDENT_ICONS[currentIncident.type] || null) : null;
  const label = currentIncident
    ? (INCIDENT_LABELS[currentIncident.type] || '通知')
    : '通知';

  const statusType = currentIncident ? (
    currentIncident.type === 'down' ? 'offline' :
      currentIncident.type === 'recovered' ? 'online' :
        currentIncident.type === 'cert_warning' ? 'slow' : 'unknown'
  ) : 'unknown';

  const statusClasses = getStatusClasses(statusType);

  return (
    <div
      className="glass-card overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div className="flex items-center gap-4 px-6 py-3">
        <div
          className="flex-shrink-0 text-black dark:text-white cursor-pointer transition-transform duration-200 hover:scale-110 hover:rotate-12"
        >
          <Bell className="w-5 h-5" />
        </div>

        <div
          className="flex-1 min-w-0 cursor-pointer group/content transition-colors"
          onClick={() => navigate('/incidents')}
        >
          {error ? (
            <div className="text-base text-red-500 dark:text-red-400 text-center">加载失败</div>
          ) : loading && !currentIncident ? (
            <div className="text-base text-slate-500 dark:text-slate-400 text-center">加载通知中...</div>
          ) : isEmpty ? (
            <div className="text-base text-slate-500 dark:text-slate-400 text-center">本月暂无异常通知</div>
          ) : (
            <div className="relative h-7 overflow-hidden">
              <AnimatePresence mode="wait">
                {currentIncident && (
                  <motion.div
                    key={`${currentIncident.id}-${currentIncident.createdAt}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-xs ${statusClasses} flex-shrink-0`}>
                        {label}
                      </span>
                      <span className="font-medium text-base text-slate-900 dark:text-slate-100 group-hover/content:text-[#425AEF] dark:group-hover/content:text-[#FF953E] transition-colors truncate">
                        {currentIncident.siteName} {formatDateTime(currentIncident.createdAt)}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div
          className="flex-shrink-0 cursor-pointer transition-transform duration-200 hover:translate-x-1 hover:scale-110 active:scale-90"
          onClick={() => navigate('/incidents')}
        >
          <i className="fa-solid fa-circle-arrow-right text-2xl text-slate-600 dark:text-slate-300 hover:text-[#425AEF] dark:hover:text-[#FF953E] transition-colors" />
        </div>
      </div>
    </div>
  );
}
