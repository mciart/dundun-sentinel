// 超时配置
// 集中管理所有超时时间、轮询间隔等

export const TIMEOUTS = {
  // HTTP 监控超时（毫秒）
  httpTimeout: 30000,
  // TCP 监控超时（毫秒）
  tcpTimeout: 15000,
  // SMTP 监控超时（毫秒）
  smtpTimeout: 30000,
  // DNS 查询超时（毫秒）
  dnsTimeout: 5000,
  // MySQL 监控超时（毫秒）
  mysqlTimeout: 15000,
  // PostgreSQL 监控超时（毫秒）
  postgresTimeout: 15000,
  // MongoDB 监控超时（毫秒）
  mongodbTimeout: 15000,
  // Redis 监控超时（毫秒）
  redisTimeout: 10000,
  // gRPC 监控超时（毫秒）
  grpcTimeout: 15000,
  // MQTT 监控超时（毫秒）
  mqttTimeout: 15000,
};

export const INTERVALS = {
  // 前端刷新间隔（毫秒）
  refreshInterval: 60000,
  // 监控检查间隔（秒）- 用于 Cron Trigger
  monitorCheckSeconds: 60,
};

// SSL 证书预警天数
export const CERT_WARNING_DAYS = [30, 14, 7, 3, 1];
