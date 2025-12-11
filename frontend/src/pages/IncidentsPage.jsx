import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/helpers';
import { INCIDENT_COLORS, INCIDENT_ICONS, INCIDENT_LABELS } from '../components/IncidentTicker';

const TYPE_OPTIONS = [
  { value: 'all', label: '全部类型' },
  { value: 'down', label: INCIDENT_LABELS.down },
  { value: 'recovered', label: INCIDENT_LABELS.recovered },
  { value: 'cert_warning', label: INCIDENT_LABELS.cert_warning }
];

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      setError('');
      const { incidents: list = [] } = await api.getIncidents();
      setIncidents(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.message || '加载异常通知失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const monthAvailability = useMemo(() => {
    const list = Array.isArray(incidents) ? incidents : [];
    const map = new Map();

    list.forEach(item => {
      if (!item?.createdAt) return;
      const date = new Date(item.createdAt);
      if (Number.isNaN(date.getTime())) return;
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      if (!map.has(year)) map.set(year, new Set());
      map.get(year).add(month);
    });

    const years = Array.from(map.keys()).sort((a, b) => b - a);
    const monthsByYear = {};
    years.forEach(year => {
      monthsByYear[year] = Array.from(map.get(year)).sort((a, b) => a - b);
    });

    return { years, monthsByYear };
  }, [incidents]);

  useEffect(() => {
    if (!monthAvailability.years.length) {
      setSelectedYear(null);
      setSelectedMonth(null);
      return;
    }

    setSelectedYear((prev) => {
      if (prev && monthAvailability.years.includes(prev)) return prev;
      return monthAvailability.years[0];
    });
  }, [monthAvailability.years]);

  useEffect(() => {
    if (!selectedYear) {
      setSelectedMonth(null);
      return;
    }

    const months = monthAvailability.monthsByYear[selectedYear] || [];
    setSelectedMonth((prev) => {
      if (prev && months.includes(prev)) return prev;
      return months.length ? months[months.length - 1] : null;
    });
  }, [selectedYear, monthAvailability.monthsByYear]);

  const filteredIncidents = useMemo(() => {
    const list = Array.isArray(incidents) ? incidents : [];
    return list
      .filter(item => {
        if (!item) return false;
        const matchesType = filterType === 'all' || item.type === filterType;
        if (!matchesType) return false;
        if (!item.createdAt) return false;
        const date = new Date(item.createdAt);
        if (Number.isNaN(date.getTime())) return false;
        const yearMatches = selectedYear ? date.getFullYear() === selectedYear : true;
        const monthMatches = selectedMonth ? (date.getMonth() + 1) === selectedMonth : true;
        return yearMatches && monthMatches;
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [incidents, filterType, selectedYear, selectedMonth]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-8 gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl glass-card text-sm sm:text-base"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              返回首页
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">异常通知</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {monthAvailability.years.length > 0 && (
              <select
                value={selectedYear ?? ''}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setSelectedYear(Number.isFinite(value) ? value : null);
                }}
                className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl glass-card text-xs sm:text-sm focus:outline-none hover:shadow-lg transition-shadow duration-200"
              >
                {monthAvailability.years.map((year) => (
                  <option key={year} value={year}>{year} 年</option>
                ))}
              </select>
            )}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl glass-card text-xs sm:text-sm focus:outline-none hover:shadow-lg transition-shadow duration-200"
            >
              {TYPE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedYear && (
          <div className="mb-4 sm:mb-6 flex flex-wrap gap-1.5 sm:gap-2">
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
              const availableMonths = monthAvailability.monthsByYear[selectedYear] || [];
              const isAvailable = availableMonths.includes(month);
              const isActive = selectedMonth === month;
              return (
                <button
                  key={month}
                  type="button"
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-500 text-white shadow-lg scale-105'
                      : isAvailable
                        ? 'glass-card hover:shadow-lg hover:scale-[1.02]'
                        : 'glass-card opacity-40 cursor-not-allowed'
                  }`}
                  onClick={() => isAvailable && setSelectedMonth(month)}
                  disabled={!isAvailable}
                >
                  {month} 月
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading && incidents.length === 0 ? (
          <div className="glass-card p-10 text-center text-slate-500 dark:text-slate-400">
            正在加载异常通知...
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="glass-card p-10 text-center text-slate-500 dark:text-slate-400">
            当前筛选条件下暂无异常通知。
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {filteredIncidents.map((incident) => {
              const Icon = INCIDENT_ICONS[incident.type];
              const palette = INCIDENT_COLORS[incident.type] || INCIDENT_COLORS.down;
              const label = INCIDENT_LABELS[incident.type] || '通知';
              const extraInfo = [];
              if (incident.type === 'down' && incident.responseTime) {
                extraInfo.push(`耗时 ${incident.responseTime}ms`);
              }
              if (incident.type === 'cert_warning' && typeof incident.daysLeft === 'number') {
                extraInfo.push(
                  incident.daysLeft >= 0
                    ? `剩余 ${incident.daysLeft} 天`
                    : `已过期 ${Math.abs(incident.daysLeft)} 天`
                );
              }

              return (
                <div
                  key={`${incident.id}`}
                  className="glass-card flex items-start gap-3 sm:gap-4 px-4 sm:px-6 py-3.5 sm:py-5"
                >
                  <div className={`flex-shrink-0 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl shadow-inner ${palette.bg} ${palette.text}`}>
                    {Icon && <Icon className="w-5 h-5 sm:w-6 sm:h-6" />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1 sm:space-y-1.5">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${palette.bg} ${palette.text}`}>
                        {label}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {formatDateTime(incident.createdAt)}
                      </span>
                    </div>
                    <div className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                      {incident.siteName}
                    </div>
                    <div className="text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {extraInfo.length > 0
                        ? `${incident.message}（${extraInfo.join('，')}）`
                        : incident.message}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
