import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, LogIn, AlertCircle } from 'lucide-react';
import { api, setToken } from '../utils/api';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.login(password);
      
      if (!response.token) {
        throw new Error('登录响应无效');
      }

      setToken(response.token);
      window.location.href = '/admin';
    } catch (err) {
      console.error('登录错误:', err);
      setError(err.message || '登录失败，请重试');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="glass-card p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4">
              <img src="/img/favicon.ico" alt="Logo" className="w-16 h-16" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-emerald-600 dark:from-primary-400 dark:to-emerald-400 bg-clip-text text-transparent">
              炖炖守望
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">
              管理后台登录
            </p>
          </div>

          {/* 登录表单 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                管理密码
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-12"
                  placeholder="请输入管理密码"
                  required
                  autoFocus
                />
              </div>
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

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full btn-primary h-12 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  登录中...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  登录
                </>
              )}
            </button>
          </form>

          {/* 返回首页 */}
          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              返回首页
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
