import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertCircle } from 'lucide-react';

const DNS_RECORD_TYPES = ['A', 'AAAA', 'CAA', 'CNAME', 'MX', 'NS', 'PTR', 'SOA', 'SRV', 'TXT'];

export default function EditSiteModal({ site, onClose, onSubmit, groups = [] }) {
  const [formData, setFormData] = useState({
    name: site.name,
    url: site.url,
    groupId: site.groupId || 'default',
    showUrl: site.showUrl || false,
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
    // TCP 相关
    tcpHost: site.tcpHost || '',
    tcpPort: site.tcpPort || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <AnimatePresence initial={false}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="glass-card w-full max-w-lg max-h-[85vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 overflow-y-auto max-h-[85vh]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Save className="w-6 h-6" />
              编辑站点
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
                {formData.monitorType === 'dns' ? '域名 *' : formData.monitorType === 'tcp' ? '主机名 *' : '站点 URL *'}
              </label>
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
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                监控类型
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="monitorType"
                    value="http"
                    checked={formData.monitorType === 'http'}
                    onChange={(e) => setFormData({ ...formData, monitorType: e.target.value })}
                    className="w-4 h-4 text-primary-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">HTTP(S) 监控</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="monitorType"
                    value="dns"
                    checked={formData.monitorType === 'dns'}
                    onChange={(e) => setFormData({ ...formData, monitorType: e.target.value })}
                    className="w-4 h-4 text-primary-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">DNS 监控</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="monitorType"
                    value="tcp"
                    checked={formData.monitorType === 'tcp'}
                    onChange={(e) => setFormData({ ...formData, monitorType: e.target.value })}
                    className="w-4 h-4 text-primary-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">TCP 端口</span>
                </label>
              </div>
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

            {/* HTTP 监控配置 */}
            {formData.monitorType === 'http' && (
            <div className="grid grid-cols-1 gap-4 p-4 rounded-xl bg-green-50/50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300 text-sm font-medium">
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
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary-600"></div>
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
      </div>
    </AnimatePresence>
  );
}
