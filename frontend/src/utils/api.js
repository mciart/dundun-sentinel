import { API_BASE_URL } from '../config';


export function getToken() {
  let token = localStorage.getItem('auth_token');
  if (!token) {

    token = sessionStorage.getItem('auth_token');
  }
  return token;
}

export function setToken(token) {
  try {
    localStorage.setItem('auth_token', token);
    localStorage.getItem('auth_token');
  } catch (e) {
    console.error('设置 token 失败:', e);

    sessionStorage.setItem('auth_token', token);
  }
}

export function clearToken() {
  localStorage.removeItem('auth_token');
  sessionStorage.removeItem('auth_token');
}


async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();

  const headers = {
    Accept: 'application/json',
    ...options.headers,
  };

  const method = (options.method || 'GET').toUpperCase();
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  if (token && options.auth !== false) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 添加 30 秒超时保护
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '请求失败');
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('API 请求超时:', endpoint);
      throw new Error('请求超时');
    }
    console.error('API 请求错误:', error);
    throw error;
  }
}

export const api = {
  login: (password) =>
    request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
      auth: false,
    }),

  getStatus: () =>
    request('/api/status', { auth: false }),

  getDashboard: () =>
    request('/api/dashboard', { auth: false }),

  getIncidents: (limit = 20) =>
    request(`/api/incidents?limit=${limit}`, { auth: false }),

  getAllHistory: (hours = 24) =>
    request(`/api/history-batch?hours=${hours}`, { auth: false }),

  getSites: () =>
    request('/api/sites'),

  addSite: (site) =>
    request('/api/sites', {
      method: 'POST',
      body: JSON.stringify(site),
    }),

  updateSite: (siteId, site) =>
    request(`/api/sites/${siteId}`, {
      method: 'PUT',
      body: JSON.stringify(site),
    }),

  deleteSite: (siteId) =>
    request(`/api/sites/${siteId}`, {
      method: 'DELETE',
    }),

  triggerCheck: () =>
    request('/api/trigger-check', {
      method: 'POST',
    }),

  getSettings: () =>
    request('/api/settings', { auth: false }),

  updateSettings: (settings) =>
    request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  getStats: () =>
    request('/api/stats', { auth: false }),

  getPushHistory: (siteId, hours = 24) =>
    request(`/api/push-history/${siteId}?hours=${hours}`, { auth: false }),

  getGroups: () =>
    request('/api/groups', { auth: false }),

  addGroup: (group) =>
    request('/api/groups', {
      method: 'POST',
      body: JSON.stringify(group),
    }),

  updateGroup: (groupId, group) =>
    request(`/api/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(group),
    }),

  deleteGroup: (groupId) =>
    request(`/api/groups/${groupId}`, {
      method: 'DELETE',
    }),

  testNotification: (type, siteId) =>
    request('/api/test-notification', {
      method: 'POST',
      body: JSON.stringify({ type, siteId }),
    }),

  reorderSites: (siteIds) =>
    request('/api/sites/reorder', {
      method: 'POST',
      body: JSON.stringify({ siteIds }),
    }),

  reorderHosts: (siteIds) =>
    request('/api/hosts/reorder', {
      method: 'POST',
      body: JSON.stringify({ siteIds }),
    }),

  getAdminPath: () =>
    request('/api/admin-path', { auth: false }),

  changePassword: (oldPassword, newPassword) =>
    request('/api/password', {
      method: 'PUT',
      body: JSON.stringify({ oldPassword, newPassword }),
    }),

  changeAdminPath: (newPath) =>
    request('/api/admin-path', {
      method: 'PUT',
      body: JSON.stringify({ newPath }),
    }),

  // Push 监控相关 API
  getPushConfig: (siteId) =>
    request(`/api/sites/${siteId}/push-config`),

  regeneratePushToken: (siteId) =>
    request(`/api/sites/${siteId}/regenerate-token`, {
      method: 'POST',
    }),

  // 清除通知历史
  clearIncidents: () =>
    request('/api/incidents/clear', {
      method: 'POST',
    }),
};
