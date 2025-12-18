// Lightweight KV storage abstraction
// Purpose: centralize KV operations and provide hooks for future migration to D1

export async function getRaw(env, key, options = {}) {
  return await env.MONITOR_DATA.get(key, options);
}

export async function putRaw(env, key, value) {
  return await env.MONITOR_DATA.put(key, value);
}

export async function getMonitorState(env) {
  const state = await env.MONITOR_DATA.get('monitor_state', { type: 'json' });
  return state || null;
}

export async function putMonitorState(env, state) {
  await env.MONITOR_DATA.put('monitor_state', JSON.stringify(state));
}

export async function getSiteHistory(env, siteId) {
  const raw = await env.MONITOR_DATA.get(`history:${siteId}`, { type: 'json' });
  return Array.isArray(raw) ? raw : [];
}

export async function putSiteHistory(env, siteId, history) {
  await env.MONITOR_DATA.put(`history:${siteId}`, JSON.stringify(history));
}

// Simple helpers for per-site kv keys; may be replaced with proper DB later
export function historyKey(siteId) {
  return `history:${siteId}`;
}

export function configKey() {
  return `config`;
}
