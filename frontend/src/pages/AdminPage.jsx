import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  LogOut, 
  RefreshCw,
  Home,
  Settings,
  Clock,
  Server,
  ServerCog,
  ServerCrash,
  BarChart3,
  Globe,
  Type,
  TrendingUp,
  Database,
  Zap,
  Activity,
  BellRing,
  Mail,
  Link,
  Eye
} from 'lucide-react';
import { api, clearToken, getToken } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import SiteList from '../components/SiteList';
import AddSiteModal from '../components/AddSiteModal';
import EditSiteModal from '../components/EditSiteModal';
import GroupManager from '../components/GroupManager';
import Dialog from '../components/Dialog';
import { useDialog } from '../hooks/useDialog';
import StarryBackground from '../components/StarryBackground';
import ThemeToggle from '../components/ThemeToggle';

export default function AdminPage() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [triggeringCheck, setTriggeringCheck] = useState(false);
  const [activeTab, setActiveTab] = useState('sites'); 
  const [settings, setSettings] = useState({ 
    historyHours: 24, 
    retentionHours: 720,
    checkInterval: 10,
    statusChangeDebounceMinutes: 3
  });
  const [stats, setStats] = useState(null);
  const [websiteSettings, setWebsiteSettings] = useState({
    siteName: '炖炖守望',
    siteSubtitle: '慢慢炖，网站不 "糊锅"',
    pageTitle: '网站监控'
  });
  const [saving, setSaving] = useState(false);
  const [savingWebsite, setSavingWebsite] = useState(false);
  const [groups, setGroups] = useState([]);
  const [testNotifType, setTestNotifType] = useState('down');
  const [testNotifSite, setTestNotifSite] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const navigate = useNavigate();
  const { dialog, closeDialog, showAlert, showConfirm, showSuccess, showError } = useDialog();

  const NOTIF_DEFAULT = {
    enabled: false,
    events: ['down', 'recovered', 'cert_warning'],
    channels: {
      email: { enabled: false, to: '', from: '' },
      wecom: { enabled: false, webhook: '' }
    }
  };

  const setNotif = (updater) => {
    setSettings(prev => {
      const next = { ...prev, notifications: { ...(prev.notifications || NOTIF_DEFAULT) } };
      updater(next.notifications);
      return next;
    });
  };

  const loadSites = async () => {
    try {
      setLoading(true);
      const data = await api.getSites();
      setSites(data);
    } catch (error) {
      console.error('加载站点失败:', error);
      if (error.message.includes('认证') || error.message.includes('401')) {
        console.log('认证失败，跳转到登录页');
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await api.getStats();
      setStats(statsData);
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  };

  const loadGroups = async () => {
    try {
      const data = await api.getGroups();
      setGroups(data.groups);
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  };

  useEffect(() => {
    const checkAuth = () => {
      const token = getToken();
      if (token) {
        return true;
      }
      navigate('/login', { replace: true });
      return false;
    };
    
    const init = async () => {
      const isAuthenticated = checkAuth();
      if (!isAuthenticated) return;

      const loadSettings = async () => {
        try {
          const apiSettings = await api.getSettings();
          setSettings(apiSettings);
          setWebsiteSettings({
            siteName: apiSettings.siteName || '炖炖守望',
            siteSubtitle: apiSettings.siteSubtitle || '慢慢炖，网站不 "糊锅"',
            pageTitle: apiSettings.pageTitle || '网站监控'
          });
          localStorage.setItem('monitorSettings', JSON.stringify(apiSettings));
        } catch (error) {
          console.error('加载设置失败:', error);
        }
      };
      
      loadSettings();
      loadStats();
      loadGroups();

      const timer = setTimeout(() => {
        loadSites();
      }, 50);

      const statsInterval = setInterval(loadStats, 30000);
      
      return () => {
        clearTimeout(timer);
        clearInterval(statsInterval);
      };
    };
    
    init();

  }, [navigate]);

  const handleLogout = () => {
    clearToken();
    navigate('/login');
  };

  const handleSaveSettings = async () => {
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

  const handleSaveWebsiteSettings = async () => {
    setSavingWebsite(true);
    try {
      const currentSettings = await api.getSettings();
      const updatedSettings = {
        ...currentSettings,
        siteName: websiteSettings.siteName,
        siteSubtitle: websiteSettings.siteSubtitle,
        pageTitle: websiteSettings.pageTitle
      };

      await api.updateSettings(updatedSettings);
      showSuccess('网站设置已保存！');
    } catch (error) {
      console.error('保存网站设置失败:', error);
      showError('保存网站设置失败：' + error.message);
    } finally {
      setSavingWebsite(false);
    }
  };

  const handleAddSite = async (siteData) => {
    try {
      await api.addSite(siteData);
      setShowAddModal(false);
      
      setTimeout(() => {
        loadSites();
        loadStats();
      }, 2000);
    } catch (error) {
      throw error;
    }
  };

  const handleUpdateSite = async (siteId, siteData) => {
    try {
      await api.updateSite(siteId, siteData);
      setEditingSite(null);
      loadSites();
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteSite = (siteId) => {
    showConfirm(
      '确定要删除这个站点吗？',
      async () => {
        try {
          await api.deleteSite(siteId);
          loadSites();
        } catch (error) {
          showError('删除失败: ' + error.message);
        }
      },
      '确认删除'
    );
  };

  const handleTriggerCheck = async () => {
    if (!sites || sites.length === 0) {
      showAlert('没有站点可以检查，请先添加站点！', '提示', 'warning');
      return;
    }

    try {
      setTriggeringCheck(true);
      await api.triggerCheck();
      
      setTimeout(() => {
        loadSites();
        loadStats();
      }, 2000);
      
      showSuccess('检查完成，数据已更新！');
    } catch (error) {
      showError('触发失败: ' + error.message);
    } finally {
      setTriggeringCheck(false);
    }
  };

  const handleAddGroup = async (group) => {
    await api.addGroup(group);
    loadGroups();
  };

  const handleEditGroup = async (groupId, group, shouldRefresh = true) => {
    await api.updateGroup(groupId, group);
    if (shouldRefresh) {
      loadGroups();
    }
  };

  const handleDeleteGroup = async (groupId) => {
    await api.deleteGroup(groupId);
    loadGroups();
    loadSites();
  };

  return (
    <div className="min-h-screen relative">
      {/* 星空背景 */}
      <StarryBackground />
      
      {/* 头部 */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
          <div className="flex items-center justify-between gap-2">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1"
            >
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                <img src="/img/favicon.ico" alt="Logo" className="w-9 h-9 sm:w-12 sm:h-12" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-2xl font-bold bg-gradient-to-r from-primary-600 to-emerald-600 dark:from-primary-400 dark:to-emerald-400 bg-clip-text text-transparent truncate">
                  管理后台
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">
                  站点监控管理
                </p>
              </div>
            </motion.div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <a
                href="/"
                className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="返回首页"
              >
                <Home className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>

              <button
                onClick={handleTriggerCheck}
                disabled={triggeringCheck || !sites || sites.length === 0}
                className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={sites && sites.length > 0 ? "立即检查" : "请先添加站点"}
              >
                <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${triggeringCheck ? 'animate-spin' : ''}`} />
              </button>

              <ThemeToggle />

              <button
                onClick={handleLogout}
                className="px-2.5 py-2 sm:px-4 sm:py-3 rounded-lg sm:rounded-xl bg-danger-500 text-white hover:bg-danger-600 transition-colors flex items-center gap-1 sm:gap-2"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">退出登录</span>
                <span className="sm:hidden text-xs">退出</span>
              </button>
            </div>
          </div>
        </div>

        {/* 标签页导航 */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
            <nav className="flex space-x-4 sm:space-x-8 min-w-max" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('sites')}
                className={`
                  flex items-center gap-1.5 sm:gap-2 py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap
                  ${activeTab === 'sites'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
                  }
                `}
              >
                <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                站点管理
              </button>
              <button
                onClick={() => setActiveTab('website')}
                className={`
                  flex items-center gap-1.5 sm:gap-2 py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap
                  ${activeTab === 'website'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
                  }
                `}
              >
                <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                网站设置
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`
                  flex items-center gap-1.5 sm:gap-2 py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap
                  ${activeTab === 'settings'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
                  }
                `}
              >
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                数据设置
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`
                  flex items-center gap-1.5 sm:gap-2 py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap
                  ${activeTab === 'notifications'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
                  }
                `}
              >
                <BellRing className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                通知设置
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {activeTab === 'sites' && (
          <>
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  总站点数
                </p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {sites.length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Server className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  在线站点
                </p>
                <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                  {sites.filter(s => s.status === 'online').length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <ServerCog className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  离线站点
                </p>
                <p className="text-3xl font-bold text-danger-600 dark:text-danger-400">
                  {sites.filter(s => s.status === 'offline').length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <ServerCrash className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* KV 写入统计 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                    今日 KV 写入
                  </p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {stats.writes.today}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                    昨日 KV 写入
                  </p>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {stats.writes.yesterday}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                    累计 KV 写入
                  </p>
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {stats.writes.total.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* 分类管理 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-8"
        >
          <GroupManager
            groups={groups}
            onAdd={handleAddGroup}
            onEdit={handleEditGroup}
            onDelete={handleDeleteGroup}
          />
        </motion.div>

        {/* 站点管理 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="glass-card p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">站点列表</h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              添加站点
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="loading-dots text-primary-600 dark:text-primary-400">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p className="mt-4 text-slate-500 dark:text-slate-400">加载中...</p>
            </div>
          ) : (
            <SiteList
              sites={sites}
              groups={groups}
              onEdit={setEditingSite}
              onDelete={handleDeleteSite}
              onRefresh={loadSites}
            />
          )}
        </motion.div>
          </>
        )}

        {activeTab === 'website' && (
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

              <div className="ml-12">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  网站名称
                </label>
                <input
                  type="text"
                  value={websiteSettings.siteName}
                  onChange={(e) => setWebsiteSettings({ ...websiteSettings, siteName: e.target.value })}
                  className="w-full max-w-xs px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                  placeholder="例如：炖炖守望"
                />
              </div>
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

              <div className="ml-12">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  副标题
                </label>
                <input
                  type="text"
                  value={websiteSettings.siteSubtitle}
                  onChange={(e) => setWebsiteSettings({ ...websiteSettings, siteSubtitle: e.target.value })}
                  className="w-full max-w-xs px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                  placeholder="例如：慢慢炖，网站不 &quot;糊锅&quot;"
                />
              </div>
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

              <div className="ml-12">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  标签页副标题
                </label>
                <input
                  type="text"
                  value={websiteSettings.pageTitle}
                  onChange={(e) => setWebsiteSettings({ ...websiteSettings, pageTitle: e.target.value })}
                  className="w-full max-w-xs px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                  placeholder="例如：网站监控"
                />
              </div>
            </div>

            {/* 保存按钮 */}
            <div className="flex justify-end">
              <button
                onClick={handleSaveWebsiteSettings}
                disabled={savingWebsite}
                className="px-6 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Settings className="w-4 h-4" />
                {savingWebsite ? '保存中...' : '保存设置'}
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* 历史数据时间范围 */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/20">
                  <Clock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    历史数据时间范围
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    设置前端历史数据详情数据时间范围
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
                  className="w-full max-w-xs px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                  placeholder="例如：24（1天）、168（7天）"
                />
              </div>
            </div>

            {/* 数据保留时间 */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
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
                  min="24"
                  max="720"
                  value={settings.retentionHours}
                  onChange={(e) => setSettings({ ...settings, retentionHours: parseInt(e.target.value) })}
                  className="w-full max-w-xs px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                  placeholder="例如：720（30天，推荐）"
                />
              </div>
            </div>

            {/* 网站检测间隔 */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                  <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    网站检测间隔
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    无状态变化时，多久强制写入一次数据到 KV（影响 KV 写入次数）
                  </p>
                </div>
              </div>

              <div className="ml-12">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  写入间隔（分钟）
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={settings.checkInterval ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    const numeric = value === '' ? '' : Math.max(1, Math.min(60, parseInt(value)));
                    setSettings({ ...settings, checkInterval: numeric === '' ? '' : Number(numeric) });
                  }}
                  onBlur={(e) => {
                    if (e.target.value === '') {
                      setSettings({ ...settings, checkInterval: 1 });
                    }
                  }}
                  className="w-full max-w-xs px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                  placeholder="1 - 60"
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">范围 1-60，数值越小刷新越频繁。</p>
              </div>
            </div>

            {/* 设定防止临时波动误报时间 */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                  <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    防抖时间设置
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    防止网络短暂波动导致误报，持续异常达到设定时间才确认状态变化
                  </p>
                </div>
              </div>

              <div className="ml-12">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  防抖时间（分钟）
                </label>
                <input
                  type="number"
                  min="0.5"
                  max="30"
                  step="0.5"
                  value={settings.statusChangeDebounceMinutes ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    const numeric = value === '' ? '' : Math.max(0.5, Math.min(30, parseFloat(value)));
                    setSettings({ ...settings, statusChangeDebounceMinutes: numeric === '' ? '' : Number(numeric) });
                  }}
                  onBlur={(e) => {
                    if (e.target.value === '') {
                      setSettings({ ...settings, statusChangeDebounceMinutes: 3 });
                    }
                  }}
                  className="w-full max-w-xs px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                  placeholder="推荐 3 分钟"
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  范围 0.5-30 分钟，持续异常达到此时间才确认状态变化。设置越小响应越快，但可能增加误报。
                </p>
              </div>
            </div>
            {/* 保存按钮 */}
            <div className="flex justify-end">
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="px-6 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Settings className="w-4 h-4" />
                {saving ? '保存中...' : '保存设置'}
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === 'notifications' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/20">
                  <BellRing className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">通知设置</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">支持企业微信机器人与邮件通知，可分别或同时开启</p>
                </div>
              </div>

              <div className="ml-12 space-y-6">
                {/* 总开关 */}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!settings.notifications?.enabled}
                    onChange={(e) => setNotif(n => { n.enabled = e.target.checked; })}
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">启用通知</span>
                </label>

                {/* 事件类型 */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">通知事件</label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { key: 'down', label: '离线' },
                      { key: 'recovered', label: '恢复' },
                      { key: 'cert_warning', label: '证书到期' }
                    ].map(opt => (
                      <label key={opt.key} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Array.isArray(settings.notifications?.events) ? settings.notifications.events.includes(opt.key) : false}
                          onChange={(e) => setNotif(n => {
                            const set = new Set(Array.isArray(n.events) ? n.events : []);
                            if (e.target.checked) set.add(opt.key); else set.delete(opt.key);
                            n.events = Array.from(set);
                          })}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 企业微信 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800"><Link className="w-4 h-4" /></div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">企业微信机器人</span>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!settings.notifications?.channels?.wecom?.enabled}
                        onChange={(e) => setNotif(n => { n.channels.wecom.enabled = e.target.checked; })}
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">启用</span>
                    </label>
                  </div>
                  <input
                    type="url"
                    className="w-full max-w-xl px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none"
                    placeholder="请输入企业微信机器人 Webhook"
                    value={settings.notifications?.channels?.wecom?.webhook || ''}
                    onChange={(e) => setNotif(n => { n.channels.wecom.webhook = e.target.value; })}
                  />
                </div>

                {/* 邮件通知 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-800"><Mail className="w-4 h-4" /></div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">邮件通知（Resend）</span>
                    <a 
                      href="https://resend.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline"
                    >
                      申请 API Key →
                    </a>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!settings.notifications?.channels?.email?.enabled}
                        onChange={(e) => setNotif(n => { n.channels.email.enabled = e.target.checked; })}
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">启用</span>
                    </label>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="password"
                        className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none"
                        placeholder="Resend API Key (re_xxxxxxxx)"
                        value={settings.notifications?.channels?.email?.resendApiKey || ''}
                        onChange={(e) => setNotif(n => { n.channels.email.resendApiKey = e.target.value; })}
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="email"
                        className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none"
                        placeholder="收件邮箱"
                        value={settings.notifications?.channels?.email?.to || ''}
                        onChange={(e) => setNotif(n => { n.channels.email.to = e.target.value; })}
                      />
                      <input
                        type="email"
                        className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none"
                        placeholder="发件邮箱 (默认: onboarding@resend.dev)"
                        value={settings.notifications?.channels?.email?.from ?? ''}
                        onChange={(e) => setNotif(n => { n.channels.email.from = e.target.value; })}
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">使用 Resend 发送邮件通知，每月免费 3000 封。未验证域名可使用 onboarding@resend.dev 发件邮箱。</p>
                </div>
              </div>
            </div>

            {/* 测试通知 */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                  <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">测试通知</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">发送测试通知验证配置是否正确</p>
                </div>
              </div>

              <div className="ml-12 space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">通知类型</label>
                    <select
                      value={testNotifType}
                      onChange={(e) => setTestNotifType(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none"
                    >
                      <option value="down">离线</option>
                      <option value="recovered">恢复</option>
                      <option value="cert_warning">证书到期</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">选择站点</label>
                    <select
                      value={testNotifSite}
                      onChange={(e) => setTestNotifSite(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none"
                    >
                      <option value="">随机选择</option>
                      {sites.map(site => (
                        <option key={site.id} value={site.id}>{site.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={async () => {
                        if (!settings.notifications?.enabled) {
                          showError('请先启用通知功能');
                          return;
                        }
                        setSendingTest(true);
                        try {
                          await api.testNotification(testNotifType, testNotifSite || undefined);
                          showSuccess('测试通知已发送，请检查企业微信/邮箱');
                        } catch (error) {
                          showError(error.message || '发送失败');
                        } finally {
                          setSendingTest(false);
                        }
                      }}
                      disabled={sendingTest}
                      className="px-6 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      <Zap className="w-4 h-4" />
                      {sendingTest ? '发送中...' : '发送测试'}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  测试通知将使用随机生成的数据（响应时间、证书剩余天数等），不会记录到异常通知列表。
                </p>
              </div>
            </div>

            {/* 保存按钮 */}
            <div className="flex justify-end">
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="px-6 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Settings className="w-4 h-4" />
                {saving ? '保存中...' : '保存通知设置'}
              </button>
            </div>
          </motion.div>
        )}

      </main>

      {/* 添加站点弹窗 */}
      {showAddModal && (
        <AddSiteModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddSite}
          groups={groups}
        />
      )}

      {/* 编辑站点弹窗 */}
      {editingSite && (
        <EditSiteModal
          site={editingSite}
          onClose={() => setEditingSite(null)}
          onSubmit={handleUpdateSite}
          onDelete={handleDeleteSite}
          groups={groups}
        />
      )}

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
