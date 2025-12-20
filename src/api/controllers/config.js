// Config controllers: settings, groups, and admin path - D1 版本
import { jsonResponse, errorResponse } from '../../utils.js';
import * as db from '../../core/storage.js';

export async function getSettings(request, env) {
  try {
    const settings = await db.getSettings(env);
    const groups = await db.getAllGroups(env);
    return jsonResponse({ ...settings, groups });
  } catch (error) {
    return errorResponse('获取设置失败: ' + error.message, 500);
  }
}

export async function updateSettings(request, env) {
  try {
    const newSettings = await request.json();
    const currentSettings = await db.getSettings(env);
    const merged = { ...currentSettings, ...newSettings };
    
    // 排除 groups，groups 通过单独的 API 管理
    delete merged.groups;
    
    await db.saveSettings(env, merged);
    
    const groups = await db.getAllGroups(env);
    return jsonResponse({ success: true, config: { ...merged, groups } });
  } catch (error) {
    return errorResponse('更新设置失败: ' + error.message, 500);
  }
}

export async function getGroups(request, env) {
  try {
    const groups = await db.getAllGroups(env);
    return jsonResponse({ groups });
  } catch (error) {
    return errorResponse('获取分类失败: ' + error.message, 500);
  }
}

export async function addGroup(request, env) {
  try {
    const data = await request.json();
    const { name, order, icon, iconColor } = data;

    if (!name || !name.trim()) {
      return errorResponse('分类名称不能为空', 400);
    }

    const groups = await db.getAllGroups(env);

    if (groups.some(g => g.name === name)) {
      return errorResponse('分类名称已存在', 400);
    }

    const newGroup = {
      id: `group_${Date.now()}`,
      name: name.trim(),
      order: order || groups.length,
      icon: icon ? icon.trim() : null,
      iconColor: iconColor ? iconColor.trim() : null,
      createdAt: Date.now()
    };

    await db.createGroup(env, newGroup);

    return jsonResponse({
      success: true,
      group: newGroup,
      message: '分类添加成功'
    });
  } catch (error) {
    return errorResponse('添加分类失败: ' + error.message, 500);
  }
}

export async function updateGroup(request, env, groupId) {
  try {
    const data = await request.json();
    const { name, order, icon, iconColor } = data;

    if (!name || !name.trim()) {
      return errorResponse('分类名称不能为空', 400);
    }

    const groups = await db.getAllGroups(env);
    const existingGroup = groups.find(g => g.id === groupId);

    if (!existingGroup) {
      return errorResponse('分类不存在', 404);
    }

    if (groups.some(g => g.id !== groupId && g.name === name)) {
      return errorResponse('分类名称已存在', 400);
    }

    await db.updateGroup(env, groupId, {
      name: name.trim(),
      order: order !== undefined ? order : existingGroup.order,
      icon: icon !== undefined ? (icon ? icon.trim() : null) : existingGroup.icon,
      iconColor: iconColor !== undefined ? (iconColor ? iconColor.trim() : null) : existingGroup.iconColor
    });

    return jsonResponse({
      success: true,
      message: '分类更新成功'
    });
  } catch (error) {
    return errorResponse('更新分类失败: ' + error.message, 500);
  }
}

export async function deleteGroup(request, env, groupId) {
  try {
    if (groupId === 'default') {
      return errorResponse('不能删除默认分类', 400);
    }

    const groups = await db.getAllGroups(env);
    const existingGroup = groups.find(g => g.id === groupId);

    if (!existingGroup) {
      return errorResponse('分类不存在', 404);
    }

    await db.deleteGroup(env, groupId);

    return jsonResponse({
      success: true,
      message: '分类已删除，相关站点已移至默认分类'
    });
  } catch (error) {
    return errorResponse('删除分类失败: ' + error.message, 500);
  }
}

export async function getAdminPath(request, env) {
  try {
    const adminPath = await db.getAdminPath(env);
    return jsonResponse({ path: adminPath || 'admin' });
  } catch (error) {
    return errorResponse('获取后台路径失败: ' + error.message, 500);
  }
}

export async function updateAdminPath(request, env) {
  try {
    const { newPath } = await request.json();
    
    if (!newPath || !newPath.trim()) {
      return errorResponse('后台路径不能为空', 400);
    }

    const pathRegex = /^[a-zA-Z0-9_-]+$/;
    const cleanPath = newPath.trim().replace(/^\/+/, '').replace(/\/+$/, '');
    
    if (!pathRegex.test(cleanPath)) {
      return errorResponse('后台路径只能包含字母、数字、连字符和下划线', 400);
    }

    if (cleanPath.length < 2 || cleanPath.length > 32) {
      return errorResponse('后台路径长度必须在2-32个字符之间', 400);
    }

    const reservedPaths = ['api', 'console', 'incidents', 'assets', 'img', 'public', 'static'];
    if (reservedPaths.includes(cleanPath.toLowerCase())) {
      return errorResponse(`"${cleanPath}" 是系统保留路径，请使用其他名称`, 400);
    }

    await db.setAdminPath(env, cleanPath);
    return jsonResponse({ success: true, message: '后台路径修改成功', newPath: cleanPath });
  } catch (error) {
    return errorResponse('修改后台路径失败: ' + error.message, 500);
  }
}

// 分组排序
export async function reorderGroups(request, env) {
  try {
    const { groupIds } = await request.json();
    if (!Array.isArray(groupIds) || groupIds.length === 0) {
      return errorResponse('无效的分组ID列表', 400);
    }
    
    for (let i = 0; i < groupIds.length; i++) {
      await db.updateGroup(env, groupIds[i], { order: i });
    }
    
    return jsonResponse({ success: true, message: '分组排序已更新' });
  } catch (error) {
    return errorResponse('更新排序失败: ' + error.message, 500);
  }
}
