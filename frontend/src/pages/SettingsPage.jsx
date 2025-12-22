import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Settings as SettingsIcon,
  Database,
  Clock
} from 'lucide-react';
import { api, getToken } from '../utils/api';
import Dialog from '../components/Dialog';
import { useDialog } from '../hooks/useDialog';
import ThemeToggle from '../components/ThemeToggle';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('general');
  const { dialog, closeDialog, showSuccess, showError } = useDialog();
  const [settings, setSettings] = useState({
    historyHours: 24,
    retentionHours: 720
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {

    const token = getToken();
    if (!token) {
      navigate('/console');
      return;
    }

    const loadSettings = async () => {
      try {
        const apiSettings = await api.getSettings();
        setSettings(apiSettings);
      } catch (error) {
        console.error('加载设置失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [navigate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSettings(settings);
      localStorage.setItem('monitorSettings', JSON.stringify(settings));
      showSuccess('数据设置已保存！');
    } catch (error) {
      console.error('保存设置失败:', error);
      showError('保存设置失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'general', name: '数据设置', icon: Database },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-dots text-primary-600 dark:text-primary-400">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* 头部 */}
      <header className="sm:sticky top-0 z-50 backdrop-blur-lg bg-white/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            {/* 标题和返回 */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin')}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#333] transition-colors"
                title="返回管理后台"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-emerald-500 flex items-center justify-center">
                  <SettingsIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-emerald-600 dark:from-primary-400 dark:to-emerald-400 bg-clip-text text-transparent">
                    全局设置
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    配置系统参数和行为
                  </p>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="glass-card overflow-hidden">
          {/* 标签页导航 */}
          <div className="border-b border-slate-200 dark:border-slate-700">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                      ${activeTab === tab.id
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* 标签页内容 */}
          <div className="p-6">
            {activeTab === 'general' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                {/* 历史数据时间范围 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/20">
                      <Clock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        历史数据时间范围
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        设置状态条显示的历史数据时间范围（最多 30 天）
                      </p>
                    </div>
                  </div>

                  <div className="ml-12">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      时间范围（小时）
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="720"
                      value={settings.historyHours}
                      onChange={(e) => setSettings({ ...settings, historyHours: parseInt(e.target.value) })}
                      className="w-full max-w-xs px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#2a2a2a] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <p>• 24 小时 = 1 天（默认）</p>
                      <p>• 120 小时 = 5 天</p>
                      <p>• 168 小时 = 7 天</p>
                      <p>• 720 小时 = 30 天（最大）</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-8"></div>

                {/* 数据保留时间 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/20">
                      <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        数据保留时间
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        设置后端实际保留多久的历史数据（超过此时间的数据会被自动删除）
                      </p>
                    </div>
                  </div>

                  <div className="ml-12">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      保留时间（小时）
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="720"
                      value={settings.retentionHours}
                      onChange={(e) => setSettings({ ...settings, retentionHours: parseInt(e.target.value) })}
                      className="w-full max-w-xs px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#2a2a2a] text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <p>• 24 小时 = 1 天</p>
                      <p>• 168 小时 = 7 天</p>
                      <p>• 720 小时 = 30 天（默认，最大）</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* 底部保存按钮 */}
          <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                修改设置后需要刷新页面才能生效
              </p>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving ? '保存中...' : '保存设置'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* 统一弹窗 */}
      <Dialog
        isOpen={dialog.isOpen}
        onClose={closeDialog}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        onConfirm={dialog.onConfirm}
      />
    </div>
  );
}
