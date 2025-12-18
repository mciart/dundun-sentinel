import { checkSite } from './http.js';
import { checkTcpSite } from './tcp.js';
import { checkDnsSite } from './dns.js';

export function getMonitorForSite(site) {
  if (site.monitorType === 'dns') return checkDnsSite;
  if (site.monitorType === 'tcp') return checkTcpSite;
  return checkSite;
}

export { checkSite, checkTcpSite, checkDnsSite };
