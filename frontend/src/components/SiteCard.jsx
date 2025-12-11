import { useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { formatResponseTime, getStatusText, getStatusBgColor } from '../utils/helpers';
import StatusBar from './StatusBarCanvas';

export default function SiteCard({ site, index }) {
  const daysLeft = typeof site?.sslCert?.daysLeft === 'number' ? site.sslCert.daysLeft : null;
  const certExpired = daysLeft !== null && daysLeft < 0;

  const handleSiteClick = () => {
    if (site.showUrl) {
      window.open(site.url, '_blank', 'noopener,noreferrer');
    }
  };

  const getHoverBgColor = () => {
    switch (site.status) {
      case 'online':
        return 'hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30';
      case 'slow':
        return 'hover:bg-amber-50/80 dark:hover:bg-amber-950/30';
      case 'offline':
        return 'hover:bg-red-50/80 dark:hover:bg-red-950/30';
      default:
        return 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30';
    }
  };


  const getOverlayHoverBg = () => {
    switch (site.status) {
      case 'online':
        return 'group-hover:bg-emerald-50/80 dark:group-hover:bg-emerald-950/30';
      case 'slow':
        return 'group-hover:bg-amber-50/80 dark:group-hover:bg-amber-950/30';
      case 'offline':
        return 'group-hover:bg-red-50/80 dark:group-hover:bg-red-950/30';
      default:
        return 'group-hover:bg-slate-50/80 dark:group-hover:bg-slate-800/30';
    }
  };

  return (
    <div className={`site-card group px-4 py-3 transition-colors duration-300`}>
      <div className={`absolute inset-0 rounded-2xl pointer-events-none transition-colors duration-300 ${getOverlayHoverBg()}`} />
      <div className="relative z-[1]">
      {/* 站点信息 */}
      <div className="flex items-center justify-between mb-2 isolate gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            site.status === 'online' 
              ? 'bg-emerald-500 shadow-md shadow-emerald-500/30 animate-pulse-slow' 
              : site.status === 'offline'
              ? 'bg-red-500 shadow-md shadow-red-500/30 animate-pulse-slow'
              : site.status === 'slow'
              ? 'bg-amber-500 shadow-md shadow-amber-500/30 animate-pulse-slow'
              : 'bg-slate-400'
          }`} />
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-medium text-slate-800 dark:text-slate-200 truncate">
              <span
                className={`transition-colors duration-200 ${
                  site.showUrl ? 'cursor-pointer hover:text-[#425AEF] dark:hover:text-[#FF953E]' : ''
                }`}
                onClick={site.showUrl ? handleSiteClick : undefined}
                style={{ textRendering: 'optimizeLegibility', WebkitFontSmoothing: 'antialiased' }}
                title={site.name}
              >
                {site.name}
              </span>
            </h3>
            
            {/* SSL证书状态 - 美化版 */}
            {site.sslCertLastCheck && site.sslCert && (
              <div className={`
                inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0
                ${certExpired
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                  : daysLeft >= 30
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : daysLeft >= 7
                  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                }
              `}>
                {!certExpired && daysLeft >= 30 ? (
                  <ShieldCheck className="w-3 h-3 flex-shrink-0" />
                ) : (
                  <ShieldAlert className="w-3 h-3 flex-shrink-0" />
                )}
                <span>
                  {certExpired
                    ? `证书已过期 ${Math.abs(daysLeft)} 天`
                    : `证书剩余 ${daysLeft} 天`}
                </span>
              </div>
            )}
            
            {/* 无证书状态 */}
            {site.sslCertLastCheck && !site.sslCert && (
              <div className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 flex-shrink-0">
                <ShieldAlert className="w-3 h-3 flex-shrink-0" />
                <span>证书无效</span>
              </div>
            )}
          </div>
        </div>

        {/* 历史数据按钮已移除 */}
      </div>

      {/* 状态条（保留） */}
      <div className="relative z-[1]" style={{ transform: 'translateZ(0)' }}>
        <StatusBar siteId={site.id} />
      </div>
      </div>
    </div>
  );
}
