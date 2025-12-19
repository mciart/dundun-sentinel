// 通用工具函数
export function generateId() {
  return `site_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

export function isValidDomain(string) {
  if (!string || typeof string !== 'string') return false;
  const domain = string.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
  const domainRegex = /^(?:[a-zA-Z0-9_](?:[a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  return domainRegex.test(domain) && domain.length <= 253;
}

export function isValidHost(string) {
  if (!string || typeof string !== 'string') return false;
  const host = string.trim();
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$|^::(?:[a-fA-F0-9]{1,4}:){0,6}[a-fA-F0-9]{1,4}$|^(?:[a-fA-F0-9]{1,4}:){1,7}:$|^(?:[a-fA-F0-9]{1,4}:){1,6}:[a-fA-F0-9]{1,4}$/;
  if (ipv4Regex.test(host) || ipv6Regex.test(host)) return true;
  return isValidDomain(host);
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};



export function formatTime(timestamp) {
  return new Date(timestamp).toISOString();
}

export function floorToMinute(timestamp) {
  const minuteMs = 60_000;
  return Math.floor(timestamp / minuteMs) * minuteMs;
}

export function calculateUptime(checks) {
  if (!checks || checks.length === 0) return 100;
  const online = checks.filter(c => c.status === 'online').length;
  return ((online / checks.length) * 100).toFixed(2);
}



export function verifyPassword(password, correctPassword) {
  return password === correctPassword;
}

export function generateToken(payload) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = btoa(JSON.stringify(payload));
  return `${header}.${data}`;
}

export function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const payload = JSON.parse(atob(parts[1]));

    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

export function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}
