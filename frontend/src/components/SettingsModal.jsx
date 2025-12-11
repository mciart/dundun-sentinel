import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save } from 'lucide-react';

export default function SettingsModal({ onClose, onSave, currentSettings }) {
  const [historyHours, setHistoryHours] = useState(currentSettings?.historyHours || 24);
  const [retentionHours, setRetentionHours] = useState(currentSettings?.retentionHours || 720);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ 
      historyHours: parseInt(historyHours),
      retentionHours: parseInt(retentionHours)
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl"
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              全局设置
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* 历史数据时间范围 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                历史数据时间范围（小时）
              </label>
              <input
                type="number"
                min="1"
                max="720"
                value={historyHours}
                onChange={(e) => setHistoryHours(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                设置状态条显示的历史数据时间范围（最多 30 天）
              </p>
              <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                <p>• 24 小时 = 1 天（默认）</p>
                <p>• 120 小时 = 5 天</p>
                <p>• 168 小时 = 7 天</p>
                <p>• 720 小时 = 30 天（最大）</p>
              </div>
            </div>

            {/* 数据保留时间 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                数据保留时间（小时）
              </label>
              <input
                type="number"
                min="1"
                max="720"
                value={retentionHours}
                onChange={(e) => setRetentionHours(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                设置后端实际保留多久的历史数据（超过此时间的数据会被自动删除）
              </p>
              <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                <p>• 24 小时 = 1 天</p>
                <p>• 168 小时 = 7 天</p>
                <p>• 720 小时 = 30 天（默认，最大）</p>
              </div>
            </div>

            {/* 按钮 */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                保存设置
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
