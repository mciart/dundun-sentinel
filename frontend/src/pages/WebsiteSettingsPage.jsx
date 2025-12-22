import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Globe, Type } from 'lucide-react';
import { api } from '../utils/api';
import { BRAND } from '../config';
import Dialog from '../components/Dialog';
import { useDialog } from '../hooks/useDialog';
import ThemeToggle from '../components/ThemeToggle';

export default function WebsiteSettingsPage() {
  const [settings, setSettings] = useState({
    siteName: BRAND.siteName,
    siteSubtitle: BRAND.siteSubtitle,
    pageTitle: BRAND.pageTitle
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { dialog, closeDialog, showSuccess, showError } = useDialog();


  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await api.getSettings();
        setSettings({
          siteName: data.siteName || BRAND.siteName,
          siteSubtitle: data.siteSubtitle || BRAND.siteSubtitle,
          pageTitle: data.pageTitle || BRAND.pageTitle
        });
      } catch (error) {
        console.error('加载设置失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentSettings = await api.getSettings();
      
      // 合并网站设置
      const updatedSettings = {
        ...currentSettings,
        siteName: settings.siteName,
        siteSubtitle: settings.siteSubtitle,
        pageTitle: settings.pageTitle
      };

      await api.updateSettings(updatedSettings);
      showSuccess('网站设置已保存！');
    } catch (error) {
      console.error('保存设置失败:', error);
      showError('保存设置失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      {/* 头部 */}
      <header className="sm:sticky top-0 z-50 backdrop-blur-lg bg-white/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-emerald-600 dark:from-primary-400 dark:to-emerald-400 bg-clip-text text-transparent">
                  网站设置
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  配置网站基本信息
                </p>
              </div>
            </div>

            {/* 主题切换 */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* 网站名称 */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                  <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    网站名称
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    显示在网站顶部的主标题
                  </p>
                </div>
              </div>

              <input
                type="text"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#2a2a2a] text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 text-lg font-medium"
                placeholder="例如：炖炖哨兵"
              />
            </div>

            {/* 副标题 */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/20">
                  <Type className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    副标题
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    显示在网站名称下方的说明文字
                  </p>
                </div>
              </div>

              <input
                type="text"
                value={settings.siteSubtitle}
                onChange={(e) => setSettings({ ...settings, siteSubtitle: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#2a2a2a] text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                placeholder="例如：慢慢炖，网站不 &quot;糊锅&quot;"
              />
            </div>

            {/* 标签页副标题 */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                  <Type className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    标签页副标题
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    显示在浏览器标签页的副标题（网站名称 - 副标题）
                  </p>
                </div>
              </div>

              <input
                type="text"
                value={settings.pageTitle}
                onChange={(e) => setSettings({ ...settings, pageTitle: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#2a2a2a] text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                placeholder="例如：网站监控"
              />
            </div>

            {/* 保存按钮 */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => navigate('/admin')}
                className="px-6 py-3 rounded-lg bg-slate-200/80 dark:bg-[#2a2a2a] hover:bg-slate-300 dark:hover:bg-[#333] text-slate-700 dark:text-slate-300 font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-primary-500 to-emerald-500 hover:from-primary-600 hover:to-emerald-600 text-white font-medium transition-all shadow-lg shadow-primary-500/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving ? '保存中...' : '保存设置'}
              </button>
            </div>
          </motion.div>
        )}
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
