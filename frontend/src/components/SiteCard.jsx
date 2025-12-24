import { Shield, ShieldAlert, ShieldCheck, Globe, Server, Mail } from 'lucide-react';
import { getStatusHoverBg, getStatusDotClassWithShadow } from '../utils/status';
import StatusBar from './StatusBarCanvas';

export default function SiteCard({ site, index }) {
  const daysLeft = typeof site?.sslCert?.daysLeft === 'number' ? site.sslCert.daysLeft : null;
  const certExpired = daysLeft !== null && daysLeft < 0;
  const isDns = site.monitorType === 'dns';
  const isSmtp = site.monitorType === 'smtp';
  const isPush = site.monitorType === 'push';

  const handleSiteClick = () => {
    if (site.showUrl) {
      window.open(site.url, '_blank', 'noopener,noreferrer');
    }
  };

  const overlayHoverBg = getStatusHoverBg(site.status);
  const statusDotClass = getStatusDotClassWithShadow(site.status);

  return (
    <div
      className={`site-card group px-4 py-3 transition-all duration-150 ease-out`}
    >
      <div className={`absolute inset-0 rounded-2xl pointer-events-none transition-all duration-300 ${overlayHoverBg}`} />
      <div className="relative z-[1]">
        {/* 站点信息 */}
        <div className="flex items-center justify-between mb-2 isolate gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* 状态指示灯 */}
            <div
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-md ${statusDotClass} ${site.status === 'online' ? 'animate-pulse' : ''}`}
            />
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-medium text-slate-800 dark:text-slate-200 truncate">
                <span
                  className={`transition-all duration-200 ${site.showUrl ? 'cursor-pointer hover:text-[#425AEF] dark:hover:text-[#FF953E]' : ''
                    }`}
                  onClick={site.showUrl ? handleSiteClick : undefined}
                  style={{ textRendering: 'optimizeLegibility', WebkitFontSmoothing: 'antialiased', display: 'inline-block' }}
                  title={site.name}
                >
                  {site.name}
                </span>
              </h3>

              {/* DNS 监控标识 */}
              {isDns && (
                <div className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex-shrink-0 transition-transform hover:scale-105">
                  <Globe className="w-3 h-3 flex-shrink-0" />
                  <span>DNS {site.dnsRecordType || 'A'}</span>
                </div>
              )}

              {/* Push 心跳监控标识 */}
              {isPush && (
                <div className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 flex-shrink-0 transition-transform hover:scale-105">
                  <Server className="w-3 h-3 flex-shrink-0" />
                  <span>Push</span>
                </div>
              )}

              {/* SMTP 监控标识 */}
              {isSmtp && (
                <div className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 flex-shrink-0 transition-transform hover:scale-105">
                  <Mail className="w-3 h-3 flex-shrink-0" />
                  <span>SMTP</span>
                </div>
              )}

              {/* SSL证书状态 (仅 HTTP 监控显示) */}
              {!isDns && !isPush && !isSmtp && site.sslCertLastCheck > 0 && site.sslCert && daysLeft !== null && (
                <div className={`
                  inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 transition-transform hover:scale-105
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

              {/* 无证书状态 (仅 HTTP 监控显示) */}
              {!isDns && !isPush && !isSmtp && site.sslCertLastCheck > 0 && !site.sslCert && (
                <div className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 flex-shrink-0 transition-transform hover:scale-105">
                  <ShieldAlert className="w-3 h-3 flex-shrink-0" />
                  <span>证书无效</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 状态条 */}
        <div className="relative z-[1]" style={{ transform: 'translateZ(0)' }}>
          <StatusBar siteId={site.id} />
        </div>
      </div>
    </div>
  );
}
