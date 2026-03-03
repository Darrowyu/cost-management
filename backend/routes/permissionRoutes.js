/**
 * 权限管理 API 路由
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');
const { success, error } = require('../utils/response');
const { ROLE_NAMES } = require('../config/rolePermissions');
const dbManager = require('../db/database');
const logger = require('../utils/logger');

// 权限缓存
let permissionsCache = null;
let rolePermissionsCache = {};
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

// 获取权限定义（带缓存）
async function getPermissions() {
  const now = Date.now();
  if (permissionsCache && cacheTimestamp && (now - cacheTimestamp < CACHE_TTL)) {
    return permissionsCache;
  }

  const result = await dbManager.query('SELECT * FROM permissions ORDER BY module, code');
  const permissions = {};
  const modules = {};

  result.rows.forEach(row => {
    permissions[row.code] = {
      label: row.label,
      module: row.module,
      description: row.description
    };

    if (!modules[row.module]) {
      modules[row.module] = {
        label: getModuleLabel(row.module),
        icon: getModuleIcon(row.module)
      };
    }
  });

  permissionsCache = { permissions, modules };
  cacheTimestamp = now;
  return permissionsCache;
}

// 获取角色权限（带缓存）
async function getRolePermissionsFromDB(roleCode) {
  if (roleCode === 'admin') {
    const { permissions } = await getPermissions();
    return Object.keys(permissions);
  }

  const now = Date.now();
  if (rolePermissionsCache[roleCode] && cacheTimestamp && (now - cacheTimestamp < CACHE_TTL)) {
    return rolePermissionsCache[roleCode];
  }

  const result = await dbManager.query(
    'SELECT permission_code FROM role_permissions WHERE role_code = $1',
    [roleCode]
  );

  const permissions = result.rows.map(r => r.permission_code);
  rolePermissionsCache[roleCode] = permissions;
  return permissions;
}

// 清除缓存
function clearCache() {
  permissionsCache = null;
  rolePermissionsCache = {};
  cacheTimestamp = null;
}

// 获取模块标签
function getModuleLabel(module) {
  const labels = {
    cost: '成本管理',
    review: '审核管理',
    master: '基础数据',
    system: '系统管理'
  };
  return labels[module] || module;
}

// 获取模块图标
function getModuleIcon(module) {
  const icons = {
    cost: 'ri-money-cny-box-line',
    review: 'ri-checkbox-circle-line',
    master: 'ri-database-2-line',
    system: 'ri-settings-3-line'
  };
  return icons[module] || 'ri-folder-line';
}

// 记录权限变更历史
async function logPermissionHistory(roleCode, permissionCode, action, operator) {
  await dbManager.query(
    `INSERT INTO permission_history (role_code, permission_code, action, operator_id, operator_name)
     VALUES ($1, $2, $3, $4, $5)`,
    [roleCode, permissionCode, action, operator.id, operator.username]
  );
}

/**
 * GET /api/permissions
 * 获取所有权限定义
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const { permissions, modules } = await getPermissions();
    res.json(success({ permissions, modules }));
  } catch (err) {
    logger.error('获取权限定义失败:', err);
    res.status(500).json(error('获取权限定义失败'));
  }
});

/**
 * GET /api/permissions/roles
 * 获取所有角色权限配置
 */
router.get('/roles', verifyToken, isAdmin, async (req, res) => {
  try {
    const { permissions, modules } = await getPermissions();

    // 获取所有角色权限
    const roleCodes = Object.keys(ROLE_NAMES);
    const roles = [];

    for (const roleCode of roleCodes) {
      const rolePerms = await getRolePermissionsFromDB(roleCode);
      roles.push({
        code: roleCode,
        name: ROLE_NAMES[roleCode],
        permissions: rolePerms
      });
    }

    res.json(success({ roles, permissions, modules }));
  } catch (err) {
    logger.error('获取角色权限失败:', err);
    res.status(500).json(error('获取角色权限失败'));
  }
});

/**
 * GET /api/permissions/roles/:role
 * 获取指定角色的权限
 */
router.get('/roles/:role', verifyToken, isAdmin, async (req, res) => {
  try {
    const { role } = req.params;

    if (!ROLE_NAMES[role]) {
      return res.status(404).json(error('角色不存在'));
    }

    const permissions = await getRolePermissionsFromDB(role);

    res.json(success({
      role: {
        code: role,
        name: ROLE_NAMES[role],
        permissions
      }
    }));
  } catch (err) {
    logger.error('获取角色权限失败:', err);
    res.status(500).json(error('获取角色权限失败'));
  }
});

/**
 * PUT /api/permissions/roles/:role
 * 更新指定角色的权限（仅管理员）
 */
router.put('/roles/:role', verifyToken, isAdmin, async (req, res) => {
  try {
    const { role } = req.params;
    const { permissions: newPermissions } = req.body;

    if (!ROLE_NAMES[role]) {
      return res.status(404).json(error('角色不存在'));
    }

    if (role === 'admin') {
      return res.status(403).json(error('不能修改管理员角色的权限'));
    }

    // 验证权限码有效性
    const { permissions: allPermissions } = await getPermissions();
    const validPermissions = Object.keys(allPermissions);
    const invalidPermissions = newPermissions.filter(p => !validPermissions.includes(p));

    if (invalidPermissions.length > 0) {
      return res.status(400).json(error(`无效的权限码: ${invalidPermissions.join(', ')}`));
    }

    // 获取当前权限
    const currentPerms = await getRolePermissionsFromDB(role);

    // 开始事务
    await dbManager.transaction(async (client) => {
      // 删除旧权限
      await client.query('DELETE FROM role_permissions WHERE role_code = $1', [role]);

      // 插入新权限
      for (const permCode of newPermissions) {
        await client.query(
          'INSERT INTO role_permissions (role_code, permission_code) VALUES ($1, $2)',
          [role, permCode]
        );
      }

      // 记录变更历史
      const addedPerms = newPermissions.filter(p => !currentPerms.includes(p));
      const removedPerms = currentPerms.filter(p => !newPermissions.includes(p));

      for (const perm of addedPerms) {
        await logPermissionHistory(role, perm, 'grant', req.user);
      }
      for (const perm of removedPerms) {
        await logPermissionHistory(role, perm, 'revoke', req.user);
      }
    });

    // 清除缓存
    clearCache();

    logger.info(`管理员 ${req.user.username} 更新了角色 ${role} 的权限`, {
      role,
      permissions: newPermissions,
      operator: req.user.username
    });

    res.json(success({
      role: {
        code: role,
        name: ROLE_NAMES[role],
        permissions: newPermissions
      }
    }, '权限更新成功'));
  } catch (err) {
    logger.error('更新角色权限失败:', err);
    res.status(500).json(error(err.message || '更新角色权限失败'));
  }
});

/**
 * GET /api/permissions/my
 * 获取当前用户的权限（用于前端权限控制）
 */
router.get('/my', verifyToken, async (req, res) => {
  try {
    const { role } = req.user;
    const permissions = await getRolePermissionsFromDB(role);

    res.json(success({
      role,
      roleName: ROLE_NAMES[role],
      permissions
    }));
  } catch (err) {
    logger.error('获取用户权限失败:', err);
    res.status(500).json(error('获取用户权限失败'));
  }
});

module.exports = router;
