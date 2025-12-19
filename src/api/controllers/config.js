// Config controllers: settings, groups, and admin path
import { jsonResponse, errorResponse } from '../../utils.js';
import { getState, updateState } from '../../core/state.js';
import { getAdminPath as fetchAdminPath, putAdminPath as saveAdminPath } from '../../core/storage.js';

export async function getSettings(request, env) {
  try {
    const state = await getState(env);
    return jsonResponse(state.config || {});
  } catch (error) {
    return errorResponse('获取设置失败: ' + error.message, 500);
  }
}

export async function updateSettings(request, env) {
  try {
    const newSettings = await request.json();
    const state = await getState(env);
    state.config = { ...state.config, ...newSettings };
    await updateState(env, state);
    return jsonResponse({ success: true, config: state.config });
  } catch (error) {
    return errorResponse('更新设置失败: ' + error.message, 500);
  }
}

export async function getGroups(request, env) {
  try {
    const state = await getState(env);
    const groups = state.config?.groups || [{ id: 'default', name: '默认分类', order: 0 }];
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

    const state = await getState(env);
    if (!state.config.groups) {
      state.config.groups = [{ id: 'default', name: '默认分类', order: 0 }];
    }

    if (state.config.groups.some(g => g.name === name)) {
      return errorResponse('分类名称已存在', 400);
    }

    const newGroup = {
      id: `group_${Date.now()}`,
      name: name.trim(),
      order: order || state.config.groups.length,
      icon: icon ? icon.trim() : null,
      iconColor: iconColor ? iconColor.trim() : null,
      createdAt: Date.now()
    };

    state.config.groups.push(newGroup);
    await updateState(env, state);

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

    const state = await getState(env);
    const groupIndex = state.config.groups.findIndex(g => g.id === groupId);

    if (groupIndex === -1) {
      return errorResponse('分类不存在', 404);
    }

    if (state.config.groups.some(g => g.id !== groupId && g.name === name)) {
      return errorResponse('分类名称已存在', 400);
    }

    state.config.groups[groupIndex].name = name.trim();
    if (icon !== undefined) {
      state.config.groups[groupIndex].icon = icon ? icon.trim() : null;
    }
    if (iconColor !== undefined) {
      state.config.groups[groupIndex].iconColor = iconColor ? iconColor.trim() : null;
    }
    if (order !== undefined) {
      state.config.groups[groupIndex].order = order;
    }

    await updateState(env, state);

    return jsonResponse({
      success: true,
      group: state.config.groups[groupIndex],
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

    const state = await getState(env);
    const groupIndex = state.config.groups.findIndex(g => g.id === groupId);

    if (groupIndex === -1) {
      return errorResponse('分类不存在', 404);
    }

    // 将该分类下的站点移到默认分类
    const sitesInGroup = state.sites.filter(s => s.groupId === groupId);
    if (sitesInGroup.length > 0) {
      state.sites.forEach(site => {
        if (site.groupId === groupId) {
          site.groupId = 'default';
        }
      });
    }

    state.config.groups.splice(groupIndex, 1);
    await updateState(env, state);

    return jsonResponse({
      success: true,
      message: `分类已删除，${sitesInGroup.length} 个站点已移至默认分类`
    });
  } catch (error) {
    return errorResponse('删除分类失败: ' + error.message, 500);
  }
}

export async function getAdminPath(request, env) {
  try {
    const kvAdminPath = await fetchAdminPath(env);
    const adminPath = kvAdminPath || 'admin';
    return jsonResponse({ path: adminPath });
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

    await saveAdminPath(env, cleanPath);
    return jsonResponse({ success: true, message: '后台路径修改成功', newPath: cleanPath });
  } catch (error) {
    return errorResponse('修改后台路径失败: ' + error.message, 500);
  }
}
