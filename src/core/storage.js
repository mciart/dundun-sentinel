// src/core/storage.js
// 适配 Upstash Redis (HTTP 模式)
// 完美解决 "ERR max number of clients reached" 问题

import { Redis } from '@upstash/redis';

let redis = null;

function getRedis(env) {
  if (redis) return redis;

  // 优先从 env 获取，兼容 process.env
  const url = env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error('未配置 UPSTASH_REDIS_REST_URL 或 UPSTASH_REDIS_REST_TOKEN');
  }

  // 初始化 Upstash HTTP 客户端 (无状态，无连接数限制)
  redis = new Redis({
    url: url,
    token: token,
  });

  return redis;
}

// ==================== 通用接口 ====================

export async function getRaw(env, key) {
  const client = getRedis(env);
  // Upstash 会自动尝试解析 JSON，所以我们不需要自己 JSON.parse
  // 除非存的是纯字符串。为了保险，我们做个兼容。
  const value = await client.get(key);
  return value;
}

export async function putRaw(env, key, value) {
  const client = getRedis(env);
  // @upstash/redis 会自动处理对象序列化
  await client.set(key, value);
}

export async function deleteRaw(env, key) {
  const client = getRedis(env);
  await client.del(key);
}

// ==================== 业务逻辑 (保持不变) ====================

export async function getMonitorState(env) {
  return await getRaw(env, 'monitor_state');
}

export async function putMonitorState(env, state) {
  await putRaw(env, 'monitor_state', state);
}

export async function getSiteHistory(env, siteId) {
  const raw = await getRaw(env, `history:${siteId}`);
  return Array.isArray(raw) ? raw : [];
}

export async function putSiteHistory(env, siteId, history) {
  await putRaw(env, `history:${siteId}`, history);
}

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

// 辅助函数
export function historyKey(siteId) {
  return `history:${siteId}`;
}

export function configKey() {
  return `config`;
}

export async function clearAllData(env) {
  const client = getRedis(env);
  await client.flushdb();
  console.log('Redis 数据已清空');
}

export async function listAllKeys(env) {
  const client = getRedis(env);
  return await client.keys('*');
}
