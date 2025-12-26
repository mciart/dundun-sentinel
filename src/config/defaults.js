// 默认值配置
// 集中管理所有默认文本、品牌名称等

export const BRAND = {
  // 站点名称
  siteName: '炖炖哨兵',
  // 副标题
  siteSubtitle: '慢慢炖，网站不"糊锅"',
  // 页面标题
  pageTitle: '网站监控',
};

export const AUTH = {
  // 默认密码 'admin' 的 SHA-256 哈希值
  defaultPasswordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
  // Token 有效期（毫秒）- 7天
  tokenExpireMs: 7 * 24 * 60 * 60 * 1000,
};

export const GROUPS = {
  // 默认分组名称
  defaultGroupName: '默认分类',
  // 默认分组图标
  defaultGroupIcon: 'Folder',
};

export const SETTINGS = {
  // 默认历史展示时长（小时）
  historyHours: 24,
  // 默认数据保留时长（小时）- 30天
  retentionHours: 720,
  // 默认主机面板显示模式
  hostDisplayMode: 'card',
  // 默认主机面板展开状态
  hostPanelExpanded: true,
};

export const NOTIFICATIONS = {
  // 默认通知配置
  defaults: {
    enabled: false,
    events: ['down', 'recovered', 'cert_warning'],
    channels: {
      email: { enabled: false, to: '', from: '' },
      wecom: { enabled: false, webhook: '' }
    }
  },
  // 默认邮件发送地址
  defaultFromEmail: 'onboarding@resend.dev',
};

export const PUSH = {
  // Push Token 长度
  tokenLength: 32,
  // Push Token 允许的字符集
  tokenChars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  // 默认超时时间（分钟）
  defaultTimeoutMinutes: 3,
};

export const MONITOR = {
  // 默认监控方法
  defaultMethod: 'GET',
  // 允许的 HTTP 方法
  allowedMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // 默认 User-Agent
  defaultUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  // 默认 SMTP 端口
  defaultSmtpPort: 25,
  // 默认 TCP 端口
  defaultTcpPort: 80,
};
