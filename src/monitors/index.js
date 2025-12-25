import { checkSite } from './http.js';
import { checkTcpSite } from './tcp.js';
import { checkDnsSite } from './dns.js';
import { checkPushSite } from './push.js';
import { checkSmtpSite } from './smtp.js';
import { checkMysqlSite } from './mysql.js';
import { checkPostgresSite } from './postgres.js';
import { checkMongodbSite } from './mongodb.js';
import { checkRedisSite } from './redis.js';
import { checkGrpcSite } from './grpc.js';
import { checkMqttSite } from './mqtt.js';

export function getMonitorForSite(site) {
  if (site.monitorType === 'dns') return checkDnsSite;
  if (site.monitorType === 'tcp') return checkTcpSite;
  if (site.monitorType === 'smtp') return checkSmtpSite;
  if (site.monitorType === 'mysql') return checkMysqlSite;
  if (site.monitorType === 'postgres') return checkPostgresSite;
  if (site.monitorType === 'mongodb') return checkMongodbSite;
  if (site.monitorType === 'redis') return checkRedisSite;
  if (site.monitorType === 'grpc') return checkGrpcSite;
  if (site.monitorType === 'mqtt') return checkMqttSite;
  if (site.monitorType === 'push') return (site, now) => checkPushSite(site, now, site.pushTimeoutMinutes || 3);
  return checkSite;
}

export { checkSite, checkTcpSite, checkDnsSite, checkPushSite, checkSmtpSite, checkMysqlSite, checkPostgresSite, checkMongodbSite, checkRedisSite, checkGrpcSite, checkMqttSite };
