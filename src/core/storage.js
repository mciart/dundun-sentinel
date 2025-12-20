// EdgeOne KV 存储抽象层
// 统一管理所有 KV 操作
// EdgeOne KV API 兼容 Cloudflare Workers KV

// ==================== 内部 KV 访问 ====================

// 获取 KV 实例
function getKV(env) {
  // EdgeOne 通过 env.MONITOR_DATA 绑定 KV 命名空间
  if (env && env.MONITOR_DATA) {
    return env.MONITOR_DATA;
  }
  throw new Error('KV 存储未配置，请在 EdgeOne 控制台绑定 KV 命名空间');
}

// ==================== 通用接口 ====================

export async function getRaw(env, key, options = {}) {
  const kv = getKV(env);
  const value = await kv.get(key, { type: 'json' });
  return value;
}

export async function putRaw(env, key, value) {
  const kv = getKV(env);
  await kv.put(key, JSON.stringify(value));
}

export async function deleteRaw(env, key) {
  const kv = getKV(env);
  await kv.delete(key);
}

// ==================== 监控状态 ====================

export async function getMonitorState(env) {
  try {
    const state = await getRaw(env, 'monitor_state');
    return state || null;
  } catch (error) {
    console.error('获取监控状态失败:', error);
    return null;
  }
}

export async function putMonitorState(env, state) {
  await putRaw(env, 'monitor_state', state);
}

// ==================== 站点历史 ====================

export async function getSiteHistory(env, siteId) {
  try {
    const raw = await getRaw(env, `history:${siteId}`);
    return Array.isArray(raw) ? raw : [];
  } catch (error) {
    console.error(`获取站点 ${siteId} 历史失败:`, error);
    return [];
  }
}

export async function putSiteHistory(env, siteId, history) {
  await putRaw(env, `history:${siteId}`, history);
}

// ==================== 管理员设置 ====================

export async function getAdminPath(env) {
  return await getRaw(env, 'admin_path');
}

export async function putAdminPath(env, path) {
  await putRaw(env, 'admin_path', path);
}

export async function getAdminPassword(env) {
  return await getRaw(env, 'admin_password');
}

export async function putAdminPassword(env, hash) {
  await putRaw(env, 'admin_password', hash);
}

// ==================== 辅助函数 ====================

export function historyKey(siteId) {
  return `history:${siteId}`;
}

export function configKey() {
  return `config`;
}

export async function clearAllData(env) {
  const kv = getKV(env);
  // EdgeOne KV 使用 list 获取所有键
  const result = await kv.list();
  if (result && result.keys && result.keys.length > 0) {
    for (const key of result.keys) {
      await kv.delete(key.name);
    }
  }
}

// ==================== 列表所有键（用于调试） ====================

export async function listAllKeys(env) {
  const kv = getKV(env);
  const result = await kv.list();
  return result?.keys?.map(k => k.name) || [];
}
