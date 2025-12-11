import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/helpers';

export const INCIDENT_ICONS = {
  down: AlertTriangle,
  recovered: CheckCircle,
  cert_warning: ShieldAlert,
};

export const INCIDENT_COLORS = {
  down: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-300',
  },
  recovered: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/20',
    text: 'text-emerald-600 dark:text-emerald-300',
  },
  cert_warning: {
    bg: 'bg-amber-100 dark:bg-amber-900/20',
    text: 'text-amber-600 dark:text-amber-300',
  },
};

export const INCIDENT_LABELS = {
  down: '站点离线',
  recovered: '站点恢复',
  cert_warning: '证书提醒',
};

function buildKey(incident) {
  return `${incident.id || incident.siteId}_${incident.createdAt}`;
}

export default function IncidentTicker({ autoRefreshInterval = 60_000 }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const latest = useMemo(() => incidents.slice(0, 10), [incidents]);

  const loadIncidents = async () => {
    try {
      setLoading(true);
      setError('');
      const { incidents: list = [] } = await api.getIncidents(20);
      setIncidents(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.message || '加载异常通知失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  useEffect(() => {
    if (!autoRefreshInterval) return;
    const timer = setInterval(loadIncidents, Math.max(10_000, autoRefreshInterval));
    return () => clearInterval(timer);
  }, [autoRefreshInterval]);

  if (loading && latest.length === 0) {
    return (
      <div className="glass-card p-4">
        <div className="text-sm text-slate-500 dark:text-slate-400">加载通知中...</div>
      </div>
    );
  }

  if (!loading && latest.length === 0) {
    return (
      <div className="glass-card p-4">
        <div className="text-sm text-slate-500 dark:text-slate-400">暂时没有异常通知</div>
      </div>
    );
  }

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">异常通知</h2>
        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
          {loading ? '刷新中…' : `共 ${incidents.length} 条`}
          <button
            onClick={loadIncidents}
            className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            type="button"
          >
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-500 dark:text-red-400">{error}</div>
      )}

      <div className="space-y-2">
        <AnimatePresence>
          {latest.map((incident) => {
            const key = buildKey(incident);
            const Icon = INCIDENT_ICONS[incident.type] || AlertTriangle;
            const color = INCIDENT_COLORS[incident.type] || INCIDENT_COLORS.down;
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={`rounded-xl px-3 py-2 flex items-start gap-3 ${color.bg}`}
              >
                <div className={`mt-0.5 rounded-full p-1 ${color.text} bg-white/70 dark:bg-black/30 shadow`}> 
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${color.text}`}>{INCIDENT_LABELS[incident.type] || '通知'}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(incident.createdAt)}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {incident.siteName}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {incident.message}
                    {incident.type === 'down' && incident.responseTime ? `（耗时 ${incident.responseTime}ms）` : ''}
                    {incident.type === 'cert_warning' && typeof incident.daysLeft === 'number' && incident.daysLeft >= 0 ? `（剩余 ${incident.daysLeft} 天）` : ''}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
