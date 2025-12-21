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
  KeyRound,
  Settings2,
  Route,
  LayoutGrid,
  LayoutList,
  Monitor
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
    siteName: '炖炖哨兵',
    siteSubtitle: '慢慢炖，网站不 "糊锅"',
    pageTitle: '网站监控',
    hostDisplayMode: 'card' // 'card' | 'list'
  });
  const [saving, setSaving] = useState(false);
  const [savingWebsite, setSavingWebsite] = useState(false);
  const [groups, setGroups] = useState([]);
  const [testNotifType, setTestNotifType] = useState('down');
  const [testNotifSite, setTestNotifSite] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [adminPath, setAdminPath] = useState('');
  const [newAdminPath, setNewAdminPath] = useState('');
  const [changingPath, setChangingPath] = useState(false);
  const navigate = useNavigate();
  const { dialog, closeDialog, showAlert, showConfirm, showSuccess, showError } = useDialog();

  const NOTIF_DEFAULT = {
    enabled: false,
    events: ['down', 'recovered', 'cert_warning'],
    channels: {
      email: { enabled: false, to: '', from: '', emailType: 'resend' },
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

  // 修复点 1: 增加 showLoading 参数，默认为 true
  const loadSites = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const data = await api.getSites();
      setSites(data);
    } catch (error) {
      console.error('加载站点失败:', error);
      if (error.message.includes('认证') || error.message.includes('401')) {
        console.log('认证失败，跳转到登录页');
        handleLogout();
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
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
      navigate('/', { replace: true });
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
            siteName: apiSettings.siteName || '炖炖哨兵',
            siteSubtitle: apiSettings.siteSubtitle || '慢慢炖，网站不 "糊锅"',
            pageTitle: apiSettings.pageTitle || '网站监控',
            hostDisplayMode: apiSettings.hostDisplayMode || 'card'
          });
          localStorage.setItem('monitorSettings', JSON.stringify(apiSettings));
        } catch (error) {
          console.error('加载设置失败:', error);
        }
      };

      const loadAdminPath = async () => {
        try {
          const data = await api.getAdminPath();
          setAdminPath(data.path || 'admin');
          setNewAdminPath(data.path || 'admin');
        } catch (error) {
          console.error('加载后台路径失败:', error);
        }
      };
      
      loadSettings();
      loadStats();
      loadGroups();
      loadAdminPath();

      const timer = setTimeout(() => {
        loadSites(true); // 首次加载显示 loading
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
    navigate('/');
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
        pageTitle: websiteSettings.pageTitle,
        hostDisplayMode: websiteSettings.hostDisplayMode
      };

      await api.updateSettings(updatedSettings);
      localStorage.setItem('monitorSettings', JSON.stringify(updatedSettings));
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
        loadSites(false); // 修复点 2: 添加后静默更新
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
      loadSites(false); // 修复点 3: 更新后静默更新
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
          loadSites(false); // 修复点 4: 删除后静默更新
        } catch (error) {
          showError('删除失败: ' + error.message);
        }
      },
      '确认删除'
    );
  };

  const handleReorderSites = async (siteIds) => {
    try {
      await api.reorderSites(siteIds);
      loadSites(false); // 修复点 5: 排序后静默更新（最关键的一点）
    } catch (error) {
      showError('排序失败: ' + error.message);
    }
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
        loadSites(false); // 修复点 6: 手动检查后静默更新
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
    loadSites(false); // 修复点 7: 删除分组后静默更新
  };

  return (
    <div className="min-h-screen relative">
      <StarryBackground />
      
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
          <div className="flex items-center justify-between gap-2">
            <motion.div
              initial={false}
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

            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <a
                href="/"
                className="p-2 sm:p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="返回首页"
              >
                <Home className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-300" />
              </a>

              <button
                onClick={handleTriggerCheck}
                disabled={triggeringCheck || !sites || sites.length === 0}
                className="p-2 sm:p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={sites && sites.length > 0 ? "立即检查" : "请先添加站点"}
              >
                <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-300 ${triggeringCheck ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleLogout}
                className="p-2 sm:p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-danger-100 dark:hover:bg-danger-900/30 hover:text-danger-600 dark:hover:text-danger-400 transition-colors"
                title="退出登录"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>

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
              <button
                onClick={() => setActiveTab('account')}
                className={`
                  flex items-center gap-1.5 sm:gap-2 py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap
                  ${activeTab === 'account'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
                  }
                `}
              >
                <Settings2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                后台设置
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {activeTab === 'sites' && (
          <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={false}
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
            initial={false}
            animate={{ opacity: 1, y: 0 }}
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
              initial={false}
              animate={{ opacity: 1, y: 0 }}
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

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <motion.div
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                    今日 D1 写入
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
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                    昨日 D1 写入
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
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                    累计 D1 写入
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

        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <GroupManager
            groups={groups}
            onAdd={handleAddGroup}
            onEdit={handleEditGroup}
            onDelete={handleDeleteGroup}
          />
        </motion.div>

        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
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
              onReorder={handleReorderSites}
            />
          )}
        </motion.div>
          </>
        )}

        {/* 为保持代码简洁，website/settings/notifications/account 标签页内容与之前一致，
          这里不需要修改，但请确保在合并代码时保留它们。
          上面的代码已经包含了完整的 AdminPage 结构。
          为了完整性，这里保留了所有 activeTab 的判断逻辑。
        */}
        {activeTab === 'website' && (
          <motion.div
            initial={false}
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
                  placeholder="例如：炖炖哨兵"
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

            {/* 主机监控显示模式 */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20">
                  <Monitor className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    主机监控显示模式
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    设置主机监控面板的显示样式，可选卡片模式或列表模式
                  </p>
                </div>
              </div>

              <div className="ml-12">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  显示模式
                </label>
                <div className="flex gap-4">
                  <label 
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all
                      ${websiteSettings.hostDisplayMode === 'card' 
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}
                    `}
                  >
                    <input
                      type="radio"
                      name="hostDisplayMode"
                      value="card"
                      checked={websiteSettings.hostDisplayMode === 'card'}
                      onChange={(e) => setWebsiteSettings({ ...websiteSettings, hostDisplayMode: e.target.value })}
                      className="sr-only"
                    />
                    <LayoutGrid className={`w-5 h-5 ${websiteSettings.hostDisplayMode === 'card' ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500'}`} />
                    <div>
                      <p className={`font-medium ${websiteSettings.hostDisplayMode === 'card' ? 'text-primary-700 dark:text-primary-300' : 'text-slate-700 dark:text-slate-300'}`}>
                        卡片模式
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        网格布局，显示详细指标
                      </p>
                    </div>
                  </label>
                  <label 
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all
                      ${websiteSettings.hostDisplayMode === 'list' 
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}
                    `}
                  >
                    <input
                      type="radio"
                      name="hostDisplayMode"
                      value="list"
                      checked={websiteSettings.hostDisplayMode === 'list'}
                      onChange={(e) => setWebsiteSettings({ ...websiteSettings, hostDisplayMode: e.target.value })}
                      className="sr-only"
                    />
                    <LayoutList className={`w-5 h-5 ${websiteSettings.hostDisplayMode === 'list' ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500'}`} />
                    <div>
                      <p className={`font-medium ${websiteSettings.hostDisplayMode === 'list' ? 'text-primary-700 dark:text-primary-300' : 'text-slate-700 dark:text-slate-300'}`}>
                        列表模式
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        紧凑列表，支持拖拽排序
                      </p>
                    </div>
                  </label>
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  列表模式支持拖拽调整主机显示顺序
                </p>
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
            initial={false}
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

            {/* KV 数据写入间隔 */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                  <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    KV 数据写入间隔
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    网站检测每分钟自动执行，此设置控制无状态变化时多久写入一次 KV
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
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  范围 1-60 分钟。检测结果实时写入 D1 数据库，D1 免费版每天 100,000 次写入配额。
                </p>
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
            initial={false}
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
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">邮件通知</span>
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
                    {/* 邮件类型选择 */}
                    <select
                      value={settings.notifications?.channels?.email?.emailType || 'resend'}
                      onChange={(e) => setNotif(n => { n.channels.email.emailType = e.target.value; })}
                      className="px-3 py-1 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none"
                    >
                      <option value="resend">Resend API</option>
                      <option value="smtp">SMTP</option>
                    </select>
                  </div>
                  
                  {/* Resend 配置 */}
                  {(settings.notifications?.channels?.email?.emailType || 'resend') === 'resend' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <a 
                          href="https://resend.com" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline"
                        >
                          申请 Resend API Key →
                        </a>
                      </div>
                      <input
                        type="password"
                        className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none"
                        placeholder="Resend API Key (re_xxxxxxxx)"
                        value={settings.notifications?.channels?.email?.resendApiKey || ''}
                        onChange={(e) => setNotif(n => { n.channels.email.resendApiKey = e.target.value; })}
                      />
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
                      <p className="text-xs text-slate-500 dark:text-slate-400">使用 Resend 发送邮件通知，每月免费 3000 封。</p>
                    </div>
                  )}
                  
                  {/* SMTP 配置 */}
                  {settings.notifications?.channels?.email?.emailType === 'smtp' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none"
                          placeholder="SMTP 服务器 (如 smtp.qq.com)"
                          value={settings.notifications?.channels?.email?.smtpHost || ''}
                          onChange={(e) => setNotif(n => { n.channels.email.smtpHost = e.target.value; })}
                        />
                        <input
                          type="number"
                          className="w-24 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none"
                          placeholder="端口"
                          value={settings.notifications?.channels?.email?.smtpPort || 587}
                          onChange={(e) => setNotif(n => { n.channels.email.smtpPort = parseInt(e.target.value) || 587; })}
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none"
                          placeholder="SMTP 用户名（通常是邮箱地址）"
                          value={settings.notifications?.channels?.email?.smtpUser || ''}
                          onChange={(e) => setNotif(n => { n.channels.email.smtpUser = e.target.value; })}
                        />
                        <input
                          type="password"
                          className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none"
                          placeholder="SMTP 密码/授权码"
                          value={settings.notifications?.channels?.email?.smtpPass || ''}
                          onChange={(e) => setNotif(n => { n.channels.email.smtpPass = e.target.value; })}
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
                          placeholder="发件邮箱"
                          value={settings.notifications?.channels?.email?.from ?? ''}
                          onChange={(e) => setNotif(n => { n.channels.email.from = e.target.value; })}
                        />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        常用端口: 465 (SSL/TLS) 或 587 (STARTTLS)。QQ邮箱需使用授权码而非密码。
                      </p>
                    </div>
                  )}
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

        {/* 后台设置 */}
        {activeTab === 'account' && (
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* 修改密码 */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/20">
                  <KeyRound className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    修改密码
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    修改后台登录密码
                  </p>
                </div>
              </div>
            
              <div className="ml-12 max-w-md space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  当前密码
                </label>
                <input
                  type="password"
                  value={passwordForm.oldPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, oldPassword: e.target.value }))}
                  className="w-full max-w-xs px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                  placeholder="请输入当前密码"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  新密码
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full max-w-xs px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                  placeholder="请输入新密码"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  确认新密码
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full max-w-xs px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                  placeholder="请再次输入新密码"
                />
              </div>
              
              <div className="pt-2">
                <button
                  onClick={async () => {
                    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
                      showError('请填写所有密码字段');
                      return;
                    }
                    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                      showError('两次输入的新密码不一致');
                      return;
                    }
                    if (passwordForm.newPassword.length < 6) {
                      showError('新密码长度至少 6 位');
                      return;
                    }
                    
                    setChangingPassword(true);
                    try {
                      await api.changePassword(passwordForm.oldPassword, passwordForm.newPassword);
                      showSuccess('密码修改成功，请重新登录');
                      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
                      setTimeout(() => {
                        clearToken();
                        navigate('/admin');
                      }, 1500);
                    } catch (error) {
                      showError(error.message || '密码修改失败');
                    } finally {
                      setChangingPassword(false);
                    }
                  }}
                  disabled={changingPassword}
                  className="px-6 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <KeyRound className="w-4 h-4" />
                  {changingPassword ? '修改中...' : '修改密码'}
                </button>
              </div>
              
              <p className="text-xs text-slate-500 dark:text-slate-400 pt-2">
                密码修改成功后需要重新登录。密码将使用 SHA-256 加密后存储。
              </p>
              </div>
            </div>

            {/* 后台路径设置 */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                  <Route className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    后台路径
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    自定义后台访问地址
                  </p>
                </div>
              </div>
            
              <div className="ml-12 max-w-md space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  后台路径
                </label>
                <div className="flex items-center gap-2 max-w-xs">
                  <span className="text-slate-500 dark:text-slate-400">/</span>
                  <input
                    type="text"
                    value={newAdminPath}
                    onChange={(e) => setNewAdminPath(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                    placeholder="admin"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  只能包含字母、数字、连字符和下划线，长度 2-32 个字符
                </p>
              </div>
              
              <div className="pt-2">
                <button
                  onClick={async () => {
                    if (!newAdminPath || newAdminPath.trim().length < 2) {
                      showError('后台路径长度至少 2 个字符');
                      return;
                    }
                    if (newAdminPath.trim().length > 32) {
                      showError('后台路径长度不能超过 32 个字符');
                      return;
                    }
                    if (newAdminPath === adminPath) {
                      showError('新路径与当前路径相同');
                      return;
                    }
                    
                    setChangingPath(true);
                    try {
                      const result = await api.changeAdminPath(newAdminPath);
                      showSuccess(`后台路径已修改为 /${result.newPath}，即将跳转...`);
                      setAdminPath(result.newPath);
                      setTimeout(() => {
                        window.location.href = `/${result.newPath}`;
                      }, 1500);
                    } catch (error) {
                      showError(error.message || '修改失败');
                    } finally {
                      setChangingPath(false);
                    }
                  }}
                  disabled={changingPath || newAdminPath === adminPath}
                  className="px-6 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Route className="w-4 h-4" />
                  {changingPath ? '修改中...' : '修改路径'}
                </button>
              </div>
              
              <p className="text-xs text-slate-500 dark:text-slate-400 pt-2">
                修改后台路径后，当前页面将跳转到新地址。请牢记新的后台路径。
              </p>
              </div>
            </div>
          </motion.div>
        )}

      </main>

      {/* 弹窗组件 */}
      {showAddModal && (
        <AddSiteModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddSite}
          groups={groups}
        />
      )}

      {editingSite && (
        <EditSiteModal
          site={editingSite}
          onClose={() => setEditingSite(null)}
          onSubmit={handleUpdateSite}
          onDelete={handleDeleteSite}
          groups={groups}
        />
      )}

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