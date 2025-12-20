-- 炖炖守望 D1 数据库结构
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
  
  -- TCP 监控配置
  tcp_port INTEGER,
  
  -- Push 监控配置
  push_token TEXT,
  push_interval INTEGER DEFAULT 60,
  last_heartbeat INTEGER DEFAULT 0,
  push_data TEXT,  -- JSON
  show_in_host_panel INTEGER DEFAULT 0,
  
  -- SSL 证书信息
  ssl_cert TEXT,  -- JSON
  ssl_cert_last_check INTEGER DEFAULT 0,
  
  -- 状态消息
  last_message TEXT
);

-- 历史记录表：存储检测历史
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  status TEXT NOT NULL,
  status_code INTEGER DEFAULT 0,
  response_time INTEGER DEFAULT 0,
  message TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- 历史记录索引：按站点和时间查询
CREATE INDEX IF NOT EXISTS idx_history_site_time ON history(site_id, timestamp DESC);

-- 事件记录表：存储故障事件
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  site_name TEXT NOT NULL,
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
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 插入默认分组
INSERT OR IGNORE INTO groups (id, name, sort_order) VALUES ('default', '默认分类', 0);

-- 统计表：存储写入统计
CREATE TABLE IF NOT EXISTS stats (
  date TEXT PRIMARY KEY,  -- YYYY-MM-DD
  writes INTEGER DEFAULT 0,
  reads INTEGER DEFAULT 0,
  checks INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 证书告警表
CREATE TABLE IF NOT EXISTS certificate_alerts (
  site_id TEXT PRIMARY KEY,
  last_alert_time INTEGER,
  alert_type TEXT,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);
