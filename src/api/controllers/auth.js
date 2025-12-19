// Auth controllers: login and password change
import { jsonResponse, errorResponse } from '../../utils.js';
import { getAdminPassword, putAdminPassword } from '../../core/storage.js';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, storedHash) {
  const hashedInput = await hashPassword(password);
  return hashedInput === storedHash;
}

function generateToken(payload) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = btoa(JSON.stringify(payload));
  return `${header}.${data}`;
}

function verifyToken(token) {
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

export async function handleLogin(request, env) {
  try {
    const { password } = await request.json();
    
    if (!password) {
      return errorResponse('密码不能为空', 400);
    }

    const kvAdmin = await getAdminPassword(env);
    // 默认密码为 'admin' 的 SHA-256 哈希值
    const defaultPasswordHash = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
    
    let adminPassword = kvAdmin || defaultPasswordHash;

    // 兼容旧版本的默认密码哈希 (ac0e7d037817094e9e0b4441f9bae3209d67b02fa484917065f71b16109a1a78)
    // 如果 KV 中存储的是旧的默认哈希值，我们也将其视为默认情况
    if (adminPassword === 'ac0e7d037817094e9e0b4441f9bae3209d67b02fa484917065f71b16109a1a78') {
      adminPassword = defaultPasswordHash;
    }

    if (!await verifyPassword(password, adminPassword)) {
      return errorResponse('密码错误', 401);
    }

    const token = generateToken({ admin: true, exp: Date.now() + 24 * 60 * 60 * 1000 });

    return jsonResponse({ success: true, token, message: '登录成功' });

  } catch (error) {
    return errorResponse('登录失败: ' + error.message, 500);
  }
}

export async function changePassword(request, env) {
  try {
    const { oldPassword, newPassword } = await request.json();
    
    if (!oldPassword || !newPassword) {
      return errorResponse('旧密码和新密码不能为空', 400);
    }

    const kvAdmin = await getAdminPassword(env);
    // 默认密码为 'admin' 的 SHA-256 哈希值
    const defaultPasswordHash = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
    const adminPassword = kvAdmin || defaultPasswordHash;

    if (!await verifyPassword(oldPassword, adminPassword)) {
      return errorResponse('旧密码错误', 401);
    }

    const hashedNewPassword = await hashPassword(newPassword);
    await putAdminPassword(env, hashedNewPassword);
    return jsonResponse({ success: true, message: '密码修改成功' });
  } catch (error) {
    return errorResponse('修改密码失败: ' + error.message, 500);
  }
}

export function requireAuth(request) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: '未提供认证信息' };
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    return { authorized: false, error: '认证信息无效或已过期' };
  }

  return { authorized: true, payload };
}

export { verifyToken };
