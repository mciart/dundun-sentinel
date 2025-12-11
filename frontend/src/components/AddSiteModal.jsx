import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, AlertCircle } from 'lucide-react';

export default function AddSiteModal({ onClose, onSubmit, groups = [] }) {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    groupId: 'default',
    showUrl: false,
    method: 'GET',
    headers: 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36\nAccept-Language: zh-CN,zh;q=0.9',
    body: '',
    expectedCodes: '',
    responseKeyword: '',
    responseForbiddenKeyword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err.message || '添加失败');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
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
              <Plus className="w-6 h-6" />
              添加监控站点
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
                placeholder="例如: 我的博客"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                站点 URL *
              </label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="input-field"
                placeholder="https://example.com"
                required
              />
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

            <div className="grid grid-cols-1 gap-4">
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
                  '添加站点'
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
