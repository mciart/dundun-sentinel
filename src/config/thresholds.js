// 阈值配置
// 集中管理响应时间阈值、状态判断标准等

export const RESPONSE_TIME = {
  // TCP 响应时间阈值（毫秒）
  tcp: {
    slow: 5000,      // 超过此值显示 "响应较慢"
    verySlow: 10000, // 超过此值显示 "响应缓慢"
  },
  // HTTP 响应时间阈值（毫秒）
  http: {
    normal: 1500,     // 正常响应时间上限
    slow: 5000,       // 慢响应阈值
    verySlow: 15000,  // 非常慢阈值
  },
  // MySQL 响应时间阈值（毫秒）
  mysql: {
    slow: 1000,       // 超过此值显示 "响应较慢"
    verySlow: 3000,   // 超过此值显示 "响应缓慢"
  },
  // PostgreSQL 响应时间阈值（毫秒）
  postgres: {
    slow: 1000,       // 超过此值显示 "响应较慢"
    verySlow: 3000,   // 超过此值显示 "响应缓慢"
  },
  // MongoDB 响应时间阈值（毫秒）
  mongodb: {
    slow: 1000,       // 超过此值显示 "响应较慢"
    verySlow: 3000,   // 超过此值显示 "响应缓慢"
  },
  // Redis 响应时间阈值（毫秒）- Redis 是内存数据库，响应更快
  redis: {
    slow: 500,        // 超过此值显示 "响应较慢"
    verySlow: 1500,   // 超过此值显示 "响应缓慢"
  },
  // gRPC 响应时间阈值（毫秒）
  grpc: {
    slow: 1000,       // 超过此值显示 "响应较慢"
    verySlow: 3000,   // 超过此值显示 "响应缓慢"
  },
  // MQTT 响应时间阈值（毫秒）
  mqtt: {
    slow: 1000,       // 超过此值显示 "响应较慢"
    verySlow: 3000,   // 超过此值显示 "响应缓慢"
  },
};

// 状态颜色（用于后端生成的邮件模板等）
export const STATUS_COLORS = {
  // 异常状态
  down: {
    headerBg: '#fb7185',
    boxBg: '#fffbeb',
    boxBorder: '#d97706',
    labelColor: '#b45309',
  },
  // 恢复状态
  recovered: {
    headerBg: '#4ade80',
    boxBg: '#f0fdf4',
    boxBorder: '#16a34a',
    labelColor: '#15803d',
  },
  // 证书警告
  certWarning: {
    headerBg: '#fbbf24',
    boxBg: '#fff7ed',
    boxBorder: '#ea580c',
    labelColor: '#c2410c',
  },
};

// 主机监控指标颜色
export const METRIC_COLORS = {
  cpu: '#3b82f6',       // 蓝色
  memory: '#8b5cf6',    // 紫色
  disk: '#f59e0b',      // 橙色
  temperature: '#ef4444', // 红色
  network: '#06b6d4',   // 青色
  load: '#22c55e',      // 绿色
};

// 仪表盘统计阈值
export const DASHBOARD_THRESHOLDS = {
  // 正常运行率阈值（百分比）
  uptimeGood: 99,
  uptimeWarning: 95,
  // 响应时间阈值（毫秒）
  responseTimeGood: 500,
  responseTimeWarning: 1000,
};
