#!/bin/bash
# 自动数据库迁移脚本
# 对比 schema.sql 和现有数据库结构，自动添加缺失的列

set -e

echo "🔄 开始自动数据库迁移..."

# 获取当前 sites 表的列
EXISTING_COLS=$(npx wrangler d1 execute dundun-sentinel-db --command "PRAGMA table_info(sites);" --remote --json 2>/dev/null | grep -oP '"name":\s*"\K[^"]+' | tr '\n' ' ')
echo "📋 现有 sites 表列: $EXISTING_COLS"

# 从 schema.sql 解析 sites 表的列定义
# 提取 sites 表定义中的列名
SCHEMA_COLS=$(sed -n '/CREATE TABLE.*sites/,/^);/p' schema.sql | grep -oP '^\s+(\w+)\s+(TEXT|INTEGER|REAL)' | awk '{print $1}' | tr '\n' ' ')
echo "📋 Schema 定义的列: $SCHEMA_COLS"

# 定义列类型映射（列名:类型:默认值）
declare -A COL_DEFS=(
  ["tcp_host"]="TEXT"
  ["tcp_port"]="INTEGER"
  ["notify_enabled"]="INTEGER DEFAULT 0"
  ["push_token"]="TEXT"
  ["push_interval"]="INTEGER DEFAULT 60"
  ["last_heartbeat"]="INTEGER DEFAULT 0"
  ["push_data"]="TEXT"
  ["show_in_host_panel"]="INTEGER DEFAULT 0"
  ["ssl_cert"]="TEXT"
  ["ssl_cert_last_check"]="INTEGER DEFAULT 0"
  ["last_message"]="TEXT"
  ["host_sort_order"]="INTEGER DEFAULT 0"
)

# 检查并添加缺失的列
for col in "${!COL_DEFS[@]}"; do
  if [[ ! " $EXISTING_COLS " =~ " $col " ]]; then
    echo "➕ 添加缺失列: $col (${COL_DEFS[$col]})"
    npx wrangler d1 execute dundun-sentinel-db --command "ALTER TABLE sites ADD COLUMN $col ${COL_DEFS[$col]};" --remote --yes 2>/dev/null || true
  fi
done

# incidents 表迁移
echo "🔄 检查 incidents 表..."
INCIDENT_COLS=$(npx wrangler d1 execute dundun-sentinel-db --command "PRAGMA table_info(incidents);" --remote --json 2>/dev/null | grep -oP '"name":\s*"\K[^"]+' | tr '\n' ' ')

if [[ ! " $INCIDENT_COLS " =~ " type " ]]; then
  echo "➕ 添加 incidents.type 列"
  npx wrangler d1 execute dundun-sentinel-db --command "ALTER TABLE incidents ADD COLUMN type TEXT DEFAULT 'down';" --remote --yes 2>/dev/null || true
fi

# 创建 push_history 表（如果不存在）
echo "🔄 检查 push_history 表..."
npx wrangler d1 execute dundun-sentinel-db --command "CREATE TABLE IF NOT EXISTS push_history (id INTEGER PRIMARY KEY AUTOINCREMENT, site_id TEXT NOT NULL, timestamp INTEGER NOT NULL, cpu REAL, memory REAL, disk REAL, load REAL, temperature REAL, latency INTEGER, uptime INTEGER, custom TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000), FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE);" --remote --yes 2>/dev/null || true
npx wrangler d1 execute dundun-sentinel-db --command "CREATE INDEX IF NOT EXISTS idx_push_history_site_time ON push_history(site_id, timestamp DESC);" --remote --yes 2>/dev/null || true

echo "✅ 数据库迁移完成"
