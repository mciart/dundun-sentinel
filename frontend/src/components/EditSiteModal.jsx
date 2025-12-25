import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertCircle, Server, Copy, RefreshCw } from 'lucide-react';
import { api } from '../utils/api';
import {
  modalVariants,
  modalTransition,
  backdropVariants,
  backdropTransition,
  closeButtonHover
} from '../utils/animations';

const DNS_RECORD_TYPES = ['A', 'AAAA', 'CAA', 'CNAME', 'MX', 'NS', 'PTR', 'SOA', 'SRV', 'TXT'];

// DoH 服务器选项
const DOH_SERVERS = [
  { value: 'cloudflare', label: 'Cloudflare', description: '1.1.1.1' },
  { value: 'google', label: 'Google', description: '8.8.8.8' },
  { value: 'quad9', label: 'Quad9', description: '9.9.9.9' },
  { value: 'alidns', label: '阿里 DNS', description: '223.5.5.5' },
  { value: 'dnspod', label: '腾讯 DNSPod', description: '119.29.29.29' },
  { value: 'custom', label: '自定义', description: '输入自定义 DoH 地址' },
];

// 监控类型配置
const MONITOR_TYPES = [
  { value: 'http', label: 'HTTP(S)', description: '监控网站或 API 可用性' },
  { value: 'dns', label: 'DNS', description: '监控域名 DNS 记录' },
  { value: 'tcp', label: 'TCP 端口', description: '监控端口连通性' },
  { value: 'smtp', label: 'SMTP', description: '监控邮件服务器可用性' },
  { value: 'mysql', label: 'MySQL', description: '监控 MySQL 数据库可用性' },
  { value: 'postgres', label: 'PostgreSQL', description: '监控 PostgreSQL 数据库可用性' },
  { value: 'push', label: 'Push 心跳', description: '被动接收主机心跳' },
];

// SMTP 安全性选项
const SMTP_SECURITY_OPTIONS = [
  { value: 'smtps', label: 'SMTPS', description: '测试 SMTP/TLS 是否正常工作' },
  { value: 'none', label: '忽略 STARTTLS', description: '通过明文连接' },
  { value: 'starttls', label: '使用 STARTTLS', description: '通过明文连接，然后发出 STARTTLS 命令并验证服务器证书' },
];

export default function EditSiteModal({ site, onClose, onSubmit, groups = [] }) {
  const [formData, setFormData] = useState({
    name: site.name,
    url: site.url,
    groupId: site.groupId || 'default',
    showUrl: site.showUrl || false,
    notifyEnabled: !!site.notifyEnabled,  // 从站点数据读取，默认为 false
    inverted: !!site.inverted,  // 反转模式
    // 监控类型
    monitorType: site.monitorType || 'http',
    // HTTP 相关
    method: site.method || 'GET',
    headers: site.headers && typeof site.headers === 'object'
      ? Object.entries(site.headers).map(([k, v]) => `${k}: ${v}`).join('\n')
      : (site.headers || ''),
    body: site.body || '',
    expectedCodes: (() => {
      if (Array.isArray(site.expectedCodes)) {
        const filtered = site.expectedCodes.filter(c => c && c !== 0);
        return filtered.length > 0 ? filtered.join(',') : '';
      }
      const str = String(site.expectedCodes || '').trim();
      return (str === '0' || !str) ? '' : str;
    })(),
    responseKeyword: site.responseKeyword || '',
    responseForbiddenKeyword: site.responseForbiddenKeyword || '',
    // DNS 相关
    dnsRecordType: site.dnsRecordType || 'A',
    dnsExpectedValue: site.dnsExpectedValue || '',
    dnsServer: site.dnsServer || 'cloudflare',
    dnsServerCustom: site.dnsServerCustom || '',
    // TCP 相关
    tcpHost: site.tcpHost || '',
    tcpPort: site.tcpPort || '',
    // SMTP 相关
    smtpHost: site.smtpHost || '',
    smtpPort: site.smtpPort || '25',
    smtpSecurity: site.smtpSecurity || 'starttls',
    // 数据库相关
    dbHost: site.dbHost || '',
    dbPort: site.dbPort || '',
    // Push 相关
    pushTimeoutMinutes: site.pushTimeoutMinutes || 3,
    showInHostPanel: site.showInHostPanel !== false  // 默认为 true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pushConfig, setPushConfig] = useState(null);
  const [loadingPushConfig, setLoadingPushConfig] = useState(false);
  const [selectedScript, setSelectedScript] = useState('bash');
  const [copySuccess, setCopySuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onSubmit(site.id, formData);
    } catch (err) {
      setError(err.message || '更新失败');
      setLoading(false);
    }
  };

  // 加载 Push 配置
  const loadPushConfig = async () => {
    if (site.monitorType !== 'push') return;
    setLoadingPushConfig(true);
    try {
      const data = await api.getPushConfig(site.id);
      setPushConfig(data.config);
    } catch (err) {
      console.error('加载 Push 配置失败:', err);
    } finally {
      setLoadingPushConfig(false);
    }
  };

  // 重新生成 Token
  const handleRegenerateToken = async () => {
    if (!confirm('确定要重新生成 Token 吗？旧 Token 将立即失效，需要更新主机端脚本。')) return;
    try {
      const data = await api.regeneratePushToken(site.id);
      setPushConfig(prev => prev ? { ...prev, token: data.token, endpoint: prev.endpoint.replace(/\/[^/]+$/, `/${data.token}`) } : null);
      alert('Token 已重新生成');
    } catch (err) {
      alert('生成失败: ' + err.message);
    }
  };

  // 复制到剪贴板
  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(label);
      setTimeout(() => setCopySuccess(''), 2000);
    } catch (err) {
      alert('复制失败');
    }
  };

  // 首次加载 Push 配置
  useEffect(() => {
    if (site.monitorType === 'push') {
      loadPushConfig();
    }
  }, []);

  return (
    <AnimatePresence initial={false}>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        initial={backdropVariants.initial}
        animate={backdropVariants.animate}
        exit={backdropVariants.exit}
        transition={backdropTransition}
        onClick={onClose}
      >
        <motion.div
          initial={modalVariants.initial}
          animate={modalVariants.animate}
          exit={modalVariants.exit}
          transition={modalTransition}
          className="glass-card w-full max-w-lg max-h-[85vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 overflow-y-auto max-h-[85vh]">
            <div className="flex items-center justify-between mb-6">
              <motion.h2
                className="text-xl font-semibold flex items-center gap-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
              >
                <Save className="w-6 h-6" />
                编辑站点
              </motion.h2>
              <button
                onClick={onClose}
                className="close-btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  站点名称 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {formData.monitorType === 'dns' ? '域名 *'
                    : (formData.monitorType === 'tcp' || formData.monitorType === 'smtp') ? '主机名 *'
                      : (formData.monitorType === 'mysql' || formData.monitorType === 'postgres') ? '数据库主机 *'
                        : formData.monitorType === 'push' ? '主机名称 *'
                          : '站点 URL *'}
                </label>
                {formData.monitorType === 'push' ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    Push 模式下，主机会主动向监控系统发送心跳，无需填写 URL
                  </p>
                ) : formData.monitorType === 'smtp' ? (
                  <input
                    type="text"
                    value={formData.smtpHost}
                    onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                    className="input-field"
                    placeholder="smtp.example.com"
                    required
                  />
                ) : (formData.monitorType === 'mysql' || formData.monitorType === 'postgres') ? (
                  <input
                    type="text"
                    value={formData.dbHost}
                    onChange={(e) => setFormData({ ...formData, dbHost: e.target.value })}
                    className="input-field"
                    placeholder="db.example.com"
                    required
                  />
                ) : (
                  <input
                    type="text"
                    value={formData.monitorType === 'tcp' ? formData.tcpHost : formData.url}
                    onChange={(e) => formData.monitorType === 'tcp'
                      ? setFormData({ ...formData, tcpHost: e.target.value })
                      : setFormData({ ...formData, url: e.target.value })}
                    className="input-field"
                    placeholder={formData.monitorType === 'dns' ? 'example.com' : formData.monitorType === 'tcp' ? 'example.com 或 192.168.1.1' : 'https://example.com'}
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  监控类型
                </label>
                <select
                  value={formData.monitorType}
                  onChange={(e) => setFormData({ ...formData, monitorType: e.target.value })}
                  className="input-field"
                >
                  {MONITOR_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {MONITOR_TYPES.find(t => t.value === formData.monitorType)?.description}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  所属分类
                </label>
                <select
                  value={formData.groupId}
                  onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                  className="input-field"
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* DNS 监控配置 */}
              {formData.monitorType === 'dns' && (
                <div className="grid grid-cols-1 gap-4 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    DNS 记录检测配置
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      记录类型
                    </label>
                    <select
                      value={formData.dnsRecordType}
                      onChange={(e) => setFormData({ ...formData, dnsRecordType: e.target.value })}
                      className="input-field"
                    >
                      {DNS_RECORD_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      期望值（可选）
                    </label>
                    <input
                      type="text"
                      value={formData.dnsExpectedValue}
                      onChange={(e) => setFormData({ ...formData, dnsExpectedValue: e.target.value })}
                      className="input-field"
                      placeholder="留空则仅检测记录是否存在，填写则验证记录值"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      示例：A 记录填 IP 地址，CNAME 填目标域名，MX 填邮件服务器
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      解析服务器（DoH）
                    </label>
                    <select
                      value={formData.dnsServer}
                      onChange={(e) => setFormData({ ...formData, dnsServer: e.target.value })}
                      className="input-field"
                    >
                      {DOH_SERVERS.map(server => (
                        <option key={server.value} value={server.value}>
                          {server.label} ({server.description})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      选择用于 DNS 查询的 DoH（DNS over HTTPS）服务器
                    </p>
                  </div>
                  {formData.dnsServer === 'custom' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        自定义 DoH 地址 *
                      </label>
                      <input
                        type="text"
                        value={formData.dnsServerCustom}
                        onChange={(e) => setFormData({ ...formData, dnsServerCustom: e.target.value })}
                        className="input-field"
                        placeholder="https://dns.example.com/dns-query"
                        required
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        输入支持 DNS-JSON 格式的 DoH 服务器地址
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TCP 端口监控配置 */}
              {formData.monitorType === 'tcp' && (
                <div className="grid grid-cols-1 gap-4 p-4 rounded-xl bg-purple-50/50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                    </svg>
                    TCP 端口检测配置
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      目标端口 *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      value={formData.tcpPort}
                      onChange={(e) => setFormData({ ...formData, tcpPort: e.target.value })}
                      className="input-field"
                      placeholder="例如：22、3306、6379"
                      required
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      常见端口：SSH(22)、MySQL(3306)、Redis(6379)、PostgreSQL(5432)
                    </p>
                  </div>
                </div>
              )}

              {/* SMTP 监控配置 */}
              {formData.monitorType === 'smtp' && (
                <div className="grid grid-cols-1 gap-4 p-4 rounded-xl bg-cyan-50/50 dark:bg-cyan-900/10 border border-cyan-200 dark:border-cyan-800">
                  <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300 text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    SMTP 邮件服务器检测配置
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      端口 *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      value={formData.smtpPort}
                      onChange={(e) => setFormData({ ...formData, smtpPort: e.target.value })}
                      className="input-field"
                      placeholder="25"
                      required
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      常见端口：25（SMTP）、465（SMTPS）、587（Submission）
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      SMTP 安全性
                    </label>
                    <select
                      value={formData.smtpSecurity}
                      onChange={(e) => setFormData({ ...formData, smtpSecurity: e.target.value })}
                      className="input-field"
                    >
                      {SMTP_SECURITY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      {SMTP_SECURITY_OPTIONS.find(opt => opt.value === formData.smtpSecurity)?.description}
                    </p>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 p-3 rounded-lg bg-slate-200/80 dark:bg-dark-layer">
                    <p className="font-medium mb-1">💡 安全性说明：</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li><strong>SMTPS</strong>：测试 SMTP/TLS 是否正常工作</li>
                      <li><strong>忽略 STARTTLS</strong>：通过明文连接</li>
                      <li><strong>使用 STARTTLS</strong>：通过明文连接，然后发出 STARTTLS 命令并验证服务器证书</li>
                    </ul>
                    <p className="mt-2 text-amber-600 dark:text-amber-400">⚠️ 这些方式都不会导致实际发送电子邮件。</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-cyan-200 dark:border-cyan-800">
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        反转模式
                      </label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        开启后，服务可访问视为故障，不可访问视为正常
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, inverted: !formData.inverted })}
                      className={`relative w-11 h-6 rounded-full transition-colors ${formData.inverted
                        ? 'bg-amber-500'
                        : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.inverted ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                    </button>
                  </div>
                </div>
              )}

              {/* MySQL 数据库配置 - 橙黄色主题 */}
              {formData.monitorType === 'mysql' && (
                <div className="grid grid-cols-1 gap-4 p-4 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-sm font-medium">
                    <Server className="w-4 h-4" />
                    MySQL 数据库配置
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      端口
                    </label>
                    <input
                      type="number"
                      value={formData.dbPort}
                      onChange={(e) => setFormData({ ...formData, dbPort: e.target.value })}
                      className="input-field"
                      placeholder="3306"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      留空使用默认端口 3306
                    </p>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 p-3 rounded-lg bg-slate-200/80 dark:bg-dark-layer">
                    <p className="font-medium mb-1">💡 监控说明：</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>通过 TCP 连接验证数据库服务是否可达</li>
                      <li>会检测 MySQL 协议握手包确认服务类型</li>
                      <li>不会发送用户名/密码，不会执行任何查询</li>
                    </ul>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-amber-200 dark:border-amber-800">
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        反转模式
                      </label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        开启后，服务可访问视为故障，不可访问视为正常
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, inverted: !formData.inverted })}
                      className={`relative w-11 h-6 rounded-full transition-colors ${formData.inverted
                        ? 'bg-amber-500'
                        : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.inverted ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                    </button>
                  </div>
                </div>
              )}

              {/* PostgreSQL 数据库配置 - 蓝色主题 */}
              {formData.monitorType === 'postgres' && (
                <div className="grid grid-cols-1 gap-4 p-4 rounded-xl bg-sky-50/50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-800">
                  <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300 text-sm font-medium">
                    <Server className="w-4 h-4" />
                    PostgreSQL 数据库配置
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      端口
                    </label>
                    <input
                      type="number"
                      value={formData.dbPort}
                      onChange={(e) => setFormData({ ...formData, dbPort: e.target.value })}
                      className="input-field"
                      placeholder="5432"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      留空使用默认端口 5432
                    </p>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 p-3 rounded-lg bg-slate-200/80 dark:bg-dark-layer">
                    <p className="font-medium mb-1">💡 监控说明：</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>通过 TCP 连接验证数据库服务是否可达</li>
                      <li>会发送启动消息验证 PostgreSQL 协议</li>
                      <li>不会发送用户名/密码，不会执行任何查询</li>
                    </ul>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-sky-200 dark:border-sky-800">
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        反转模式
                      </label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        开启后，服务可访问视为故障，不可访问视为正常
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, inverted: !formData.inverted })}
                      className={`relative w-11 h-6 rounded-full transition-colors ${formData.inverted
                        ? 'bg-amber-500'
                        : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.inverted ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                    </button>
                  </div>
                </div>
              )}

              {/* Push 心跳监控配置 */}
              {formData.monitorType === 'push' && (
                <div className="grid grid-cols-1 gap-4 p-4 rounded-xl bg-orange-50/50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 text-sm font-medium">
                    <Server className="w-4 h-4" />
                    Push 心跳监控配置
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      超时时间（分钟）
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={formData.pushTimeoutMinutes}
                      onChange={(e) => setFormData({ ...formData, pushTimeoutMinutes: parseInt(e.target.value) || 3 })}
                      className="input-field"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      超过此时间未收到心跳，将判定主机离线
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-orange-200 dark:border-orange-800">
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        显示在主机监控面板
                      </label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        关闭后仅在站点列表显示，不在主页主机监控区域展示
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, showInHostPanel: !formData.showInHostPanel })}
                      className={`relative w-11 h-6 rounded-full transition-colors ${formData.showInHostPanel
                        ? 'bg-orange-500'
                        : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.showInHostPanel ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                    </button>
                  </div>

                  {/* Push 配置和脚本 - 仅在原本就是 push 类型时显示 */}
                  {site.monitorType === 'push' && (
                    <div className="space-y-4 pt-2 border-t border-orange-200 dark:border-orange-800">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          上报地址
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={pushConfig?.endpoint || '加载中...'}
                            readOnly
                            className="input-field flex-1 bg-slate-100 dark:bg-dark-layer font-mono text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(pushConfig?.endpoint, 'endpoint')}
                            className="btn-secondary px-3"
                            disabled={!pushConfig}
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                        {copySuccess === 'endpoint' && (
                          <p className="text-xs text-primary-600 mt-1">已复制！</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Token
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={pushConfig?.token || site.pushToken || '加载中...'}
                            readOnly
                            className="input-field flex-1 bg-slate-100 dark:bg-dark-layer font-mono text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(pushConfig?.token || site.pushToken, 'token')}
                            className="btn-secondary px-3"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={handleRegenerateToken}
                            className="btn-secondary px-3"
                            title="重新生成 Token"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                        {copySuccess === 'token' && (
                          <p className="text-xs text-primary-600 mt-1">已复制！</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          部署脚本
                        </label>
                        <div className="flex gap-2 mb-2">
                          {['bash', 'python', 'powershell', 'node', 'curl'].map(lang => (
                            <button
                              key={lang}
                              type="button"
                              onClick={() => {
                                setSelectedScript(lang);
                                if (!pushConfig) loadPushConfig();
                              }}
                              className={`px-3 py-1 text-xs rounded-lg transition-colors ${selectedScript === lang
                                ? 'bg-orange-500 text-white'
                                : 'bg-slate-100 dark:bg-dark-layer hover:bg-slate-200 dark:hover:bg-dark-highlight'
                                }`}
                            >
                              {lang === 'bash' ? 'Bash' : lang === 'python' ? 'Python' : lang === 'powershell' ? 'PowerShell' : lang === 'node' ? 'Node.js' : 'cURL'}
                            </button>
                          ))}
                        </div>
                        <div className="relative">
                          <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs overflow-x-auto max-h-48 overflow-y-auto">
                            {loadingPushConfig ? '加载中...' : (pushConfig?.scripts?.[selectedScript] || '请等待配置加载...')}
                          </pre>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(pushConfig?.scripts?.[selectedScript], 'script')}
                            className="absolute top-2 right-2 p-1.5 rounded bg-slate-700 hover:bg-slate-600 transition-colors"
                            disabled={!pushConfig}
                          >
                            <Copy className="w-3 h-3 text-white" />
                          </button>
                        </div>
                        {copySuccess === 'script' && (
                          <p className="text-xs text-primary-600 mt-1">脚本已复制！</p>
                        )}
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                          将脚本保存到主机，然后添加到 crontab 定时执行（建议每分钟一次）
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* HTTP 监控配置 */}
              {formData.monitorType === 'http' && (
                <div className="grid grid-cols-1 gap-4 p-4 rounded-xl bg-primary-50/50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800">
                  <div className="flex items-center gap-2 text-primary-700 dark:text-primary-300 text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                    </svg>
                    HTTP(S) 监控配置
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      请求方法
                    </label>
                    <select
                      value={formData.method}
                      onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                      className="input-field"
                    >
                      <option>GET</option>
                      <option>HEAD</option>
                      <option>POST</option>
                      <option>PUT</option>
                      <option>PATCH</option>
                      <option>DELETE</option>
                      <option>OPTIONS</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      请求头（每行形如 Key: Value，或粘贴 JSON）
                    </label>
                    <textarea
                      value={formData.headers}
                      onChange={(e) => setFormData({ ...formData, headers: e.target.value })}
                      className="input-field min-h-[88px]"
                      placeholder={"User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36\nAccept-Language: zh-CN,zh;q=0.9"}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      请求体（仅在 POST/PUT/PATCH 时生效）
                    </label>
                    <textarea
                      value={formData.body}
                      onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                      className="input-field min-h-[88px]"
                      placeholder='{"ping":1}'
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      期望状态码（逗号分隔，如 200,204,301）
                    </label>
                    <input
                      type="text"
                      value={formData.expectedCodes}
                      onChange={(e) => setFormData({ ...formData, expectedCodes: e.target.value })}
                      className="input-field"
                      placeholder="留空则默认 2xx 视为正常"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        必须包含的关键字
                      </label>
                      <input
                        type="text"
                        value={formData.responseKeyword}
                        onChange={(e) => setFormData({ ...formData, responseKeyword: e.target.value })}
                        className="input-field"
                        placeholder="例如：success"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        禁止出现的关键字
                      </label>
                      <input
                        type="text"
                        value={formData.responseForbiddenKeyword}
                        onChange={(e) => setFormData({ ...formData, responseForbiddenKeyword: e.target.value })}
                        className="input-field"
                        placeholder="例如：Error"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 站点跳转选项 - 仅 HTTP 监控显示 */}
              {formData.monitorType === 'http' && (
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      开启站点跳转
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      开启后可在首页跳转站点URL
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showUrl}
                      onChange={(e) => setFormData({ ...formData, showUrl: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-dark-layer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              )}

              {/* 启用通知选项 */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    启用通知
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    关闭后此站点的状态变化不会发送通知
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.notifyEnabled}
                    onChange={(e) => setFormData({ ...formData, notifyEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-dark-layer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {/* 反转模式选项 - 仅非 Push 和非 SMTP 类型显示（SMTP 在配置面板中已有） */}
              {formData.monitorType !== 'push' && formData.monitorType !== 'smtp' && (
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      反转模式
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      开启后，服务可访问视为故障，不可访问视为正常
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.inverted}
                      onChange={(e) => setFormData({ ...formData, inverted: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-dark-layer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-amber-500"></div>
                  </label>
                </div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-4 rounded-xl bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </motion.div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 btn-secondary"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {loading ? (
                    <div className="loading-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  ) : (
                    '保存更改'
                  )}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
