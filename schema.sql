-- 炖炖哨兵 D1 数据库结构
-- 用于替代 KV 存储，提供更高的写入配额和更好的查询能力

-- 配置表：存储全局配置
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 站点表：存储监控站点信息
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  monitor_type TEXT DEFAULT 'http',
  status TEXT DEFAULT 'unknown',
  response_time INTEGER DEFAULT 0,
  last_check INTEGER DEFAULT 0,
  group_id TEXT DEFAULT 'default',
  sort_order INTEGER DEFAULT 0,
  host_sort_order INTEGER DEFAULT 0,
  show_url INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  
  -- HTTP 监控配置
  method TEXT DEFAULT 'GET',
  expected_status INTEGER DEFAULT 200,
  timeout INTEGER DEFAULT 30000,
  headers TEXT,  -- JSON
  body TEXT,
  
  -- DNS 监控配置
  dns_record_type TEXT DEFAULT 'A',
  dns_expected_value TEXT,
  dns_server TEXT DEFAULT 'cloudflare',  -- DoH 服务器: cloudflare, google, quad9, alidns, dnspod, custom
  dns_server_custom TEXT,  -- 自定义 DoH 服务器地址
  
  -- TCP 监控配置
  tcp_host TEXT,
  tcp_port INTEGER,
  
  -- SMTP 监控配置
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 25,
  smtp_security TEXT DEFAULT 'starttls',  -- 'smtps', 'starttls', 'none'
  
  -- 数据库监控配置 (MySQL/PostgreSQL/MongoDB/Redis)
  db_host TEXT,
  db_port INTEGER,
  
  -- gRPC 监控配置
  grpc_host TEXT,
  grpc_port INTEGER DEFAULT 443,
  grpc_tls INTEGER DEFAULT 1,  -- 0=不使用TLS, 1=使用TLS
  
  -- MQTT 监控配置
  mqtt_host TEXT,
  mqtt_port INTEGER DEFAULT 1883,
  
  -- Push 监控配置
  push_token TEXT,
  push_interval INTEGER DEFAULT 60,
  last_heartbeat INTEGER DEFAULT 0,
  push_data TEXT,  -- JSON
  show_in_host_panel INTEGER DEFAULT 0,
  
  -- SSL 证书信息
  ssl_cert TEXT,  -- JSON
  ssl_cert_last_check INTEGER DEFAULT 0,
  
  -- 通知设置
  notify_enabled INTEGER DEFAULT 0,  -- 0=关闭, 1=启用
  
  -- 反转模式
  inverted INTEGER DEFAULT 0,  -- 0=正常, 1=反转（可访问=故障）
  
  -- 状态消息
  last_message TEXT
);

-- 事件记录表：存储故障事件
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  site_name TEXT NOT NULL,
  type TEXT DEFAULT 'down',  -- down, recovered, cert_warning
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  status TEXT DEFAULT 'ongoing',  -- ongoing, resolved
  reason TEXT,
  resolved_reason TEXT,
  duration INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- 事件索引
CREATE INDEX IF NOT EXISTS idx_incidents_site ON incidents(site_id);
CREATE INDEX IF NOT EXISTS idx_incidents_time ON incidents(start_time DESC);

-- 分组表：存储站点分组
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  icon TEXT,
  icon_color TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 插入默认分组
INSERT OR IGNORE INTO groups (id, name, sort_order) VALUES ('default', '默认分类', 0);

-- 证书告警表
CREATE TABLE IF NOT EXISTS certificate_alerts (
  site_id TEXT PRIMARY KEY,
  last_alert_time INTEGER,
  alert_type TEXT,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- 聚合历史表：每个站点一行，存储 JSON 数组（优化 D1 读写行数）
-- 普通站点: [{t:时间戳,s:状态,c:状态码,r:响应时间,m:消息},...]
-- Push站点: [{t:时间戳,s:状态,r:响应时间,p:{c:cpu,m:mem,d:disk,l:load,T:temp,L:latency,u:uptime,x:custom}},...]
CREATE TABLE IF NOT EXISTS history_aggregated (
  site_id TEXT PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);
