/**
 * 权限管理 API 路由
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');
const { success, error } = require('../utils/response');
const dbManager = require('../db/database');
const logger = require('../utils/logger');
const { getPermissions, getRolePermissionsFromDB, clearPermissionsCache } = require('../utils/permissions');

// 清除缓存
function clearCache() {
  clearPermissionsCache();
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

    // 从数据库获取所有启用的角色
    const rolesResult = await dbManager.query(
      `SELECT code, name, description, icon, is_system, is_active, sort_order
       FROM roles
       WHERE is_active = true
       ORDER BY sort_order ASC, id ASC`
    );

    const roles = [];
    for (const role of rolesResult.rows) {
      const rolePerms = await getRolePermissionsFromDB(role.code);
      roles.push({
        code: role.code,
        name: role.name,
        description: role.description,
        icon: role.icon,
        is_system: role.is_system,
        is_active: role.is_active,
        sort_order: role.sort_order,
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

    // 从数据库验证角色存在
    const roleResult = await dbManager.query(
      'SELECT code, name FROM roles WHERE code = $1 AND is_active = true',
      [role]
    );

    if (roleResult.rows.length === 0) {
      return res.status(404).json(error('角色不存在'));
    }

    const roleInfo = roleResult.rows[0];
    const permissions = await getRolePermissionsFromDB(role);

    res.json(success({
      role: {
        code: roleInfo.code,
        name: roleInfo.name,
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

    // 从数据库验证角色存在
    const roleResult = await dbManager.query(
      'SELECT code, name, is_system FROM roles WHERE code = $1 AND is_active = true',
      [role]
    );

    if (roleResult.rows.length === 0) {
      return res.status(404).json(error('角色不存在'));
    }

    const roleInfo = roleResult.rows[0];

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
        name: roleInfo.name,
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

    // 从数据库获取角色名称
    const roleResult = await dbManager.query(
      'SELECT name FROM roles WHERE code = $1',
      [role]
    );
    const roleName = roleResult.rows[0]?.name || role;

    res.json(success({
      role,
      roleName,
      permissions
    }));
  } catch (err) {
    logger.error('获取用户权限失败:', err);
    res.status(500).json(error('获取用户权限失败'));
  }
});

/**
 * GET /api/permissions/menu
 * 获取当前用户的菜单权限（动态菜单）
 */
router.get('/menu', verifyToken, async (req, res) => {
  try {
    const { role, username } = req.user;
    const permissions = await getRolePermissionsFromDB(role);

    // 根据权限码生成菜单配置
    const menuConfig = buildMenuByPermissions(permissions, role);

    res.json(success({ menu: menuConfig }));
  } catch (err) {
    logger.error('获取菜单权限失败:', err);
    res.status(500).json(error('获取菜单权限失败'));
  }
});

/**
 * 根据权限码构建菜单
 */
function buildMenuByPermissions(permissions, role) {
  const menu = [];

  // 仪表盘 - 所有人可见
  menu.push({
    id: 'dashboard',
    label: '仪表盘',
    icon: 'ri-dashboard-3-line',
    route: '/dashboard'
  });

  // 成本管理模块
  const costChildren = [];
  // 检查是否有成本相关权限（view 或 manage 都显示）
  const hasCostPermission = permissions.some(p => p.startsWith('cost:'));
  if (hasCostPermission && permissions.includes('cost:create')) {
    costChildren.push({ id: 'cost_add', label: '新增成本分析', route: '/cost/add', icon: 'ri-add-circle-line' });
    costChildren.push({ id: 'cost_estimation', label: '新产品预估', route: '/cost/add?mode=estimation', icon: 'ri-lightbulb-line' });
  }
  if (hasCostPermission && (permissions.includes('cost:view') || permissions.includes('cost:manage'))) {
    costChildren.push({ id: 'cost_standard', label: '标准成本', route: '/cost/standard', icon: 'ri-bookmark-line' });
    costChildren.push({ id: 'cost_records', label: '成本记录', route: '/cost/records', icon: 'ri-file-list-3-line' });
  }

  if (costChildren.length > 0) {
    menu.push({
      id: 'cost',
      label: '成本管理',
      icon: 'ri-money-cny-box-line',
      children: costChildren
    });
  }

  // 审核管理模块
  const reviewChildren = [];
  if (permissions.includes('review:view') || permissions.includes('review:approve')) {
    reviewChildren.push({ id: 'review_pending', label: '待审核记录', route: '/review/pending', icon: 'ri-time-line' });
    reviewChildren.push({ id: 'review_approved', label: '已审核记录', route: '/review/approved', icon: 'ri-check-double-line' });
  }

  if (reviewChildren.length > 0) {
    menu.push({
      id: 'review',
      label: '审核管理',
      icon: 'ri-checkbox-circle-line',
      children: reviewChildren
    });
  }

  // 基础数据模块 - 独立菜单项
  const masterItems = [];
  if (permissions.includes('master:regulation:view') || permissions.includes('master:regulation:manage')) {
    masterItems.push({ id: 'regulation', label: '法规管理', icon: 'ri-government-line', route: '/regulations' });
  }
  if (permissions.includes('master:customer:view') || permissions.includes('master:customer:manage')) {
    masterItems.push({ id: 'customer', label: '客户管理', icon: 'ri-user-3-line', route: '/customers' });
  }
  if (permissions.includes('master:material:view') || permissions.includes('master:material:manage')) {
    masterItems.push({
      id: 'material',
      label: '原料管理',
      icon: 'ri-stack-line',
      children: [
        { id: 'material_half_mask', label: '半面罩类', route: '/materials?type=half_mask', icon: 'ri-cpu-line' },
        { id: 'material_general', label: '口罩类', route: '/materials?type=general', icon: 'ri-file-list-2-line' }
      ]
    });
  }

  if (masterItems.length > 0) {
    menu.push({ type: 'divider', label: '基础数据' });
    menu.push(...masterItems);
  }

  // 产品管理 - 仅包含型号、工序、包材
  const productItems = [];
  if (permissions.includes('master:model:view') || permissions.includes('master:model:manage')) {
    productItems.push({ id: 'model', label: '型号管理', route: '/models', icon: 'ri-price-tag-3-line' });
  }
  if (permissions.includes('master:process:view') || permissions.includes('master:process:manage')) {
    productItems.push({ id: 'process', label: '工序管理', route: '/processes', icon: 'ri-settings-4-line' });
  }
  if (permissions.includes('master:packaging:view') || permissions.includes('master:packaging:manage')) {
    productItems.push({ id: 'packaging', label: '包材管理', route: '/packaging', icon: 'ri-box-3-line' });
  }

  if (productItems.length > 0) {
    menu.push({
      id: 'product',
      label: '产品管理',
      icon: 'ri-archive-2-line',
      children: productItems
    });
  }

  // 系统管理模块
  const systemItems = [];
  // 有查看或管理配置权限都显示系统配置菜单
  if (permissions.includes('system:config:view') || permissions.includes('system:config:manage')) {
    systemItems.push({ id: 'config', label: '系统配置', icon: 'ri-equalizer-line', route: '/config' });
  }
  if (permissions.includes('system:permission:view') || permissions.includes('system:permission:manage')) {
    systemItems.push({ id: 'permission', label: '权限管理', icon: 'ri-shield-keyhole-line', route: '/config/permissions' });
  }
  if (permissions.includes('system:user:view') || permissions.includes('system:user:manage')) {
    systemItems.push({ id: 'user', label: '用户管理', icon: 'ri-user-settings-line', route: '/users' });
  }

  // 个人设置 - 非管理员可见
  if (role !== 'admin') {
    systemItems.push({ id: 'profile', label: '个人设置', icon: 'ri-user-line', route: '/profile' });
  }

  // 帮助中心 - 所有人可见
  systemItems.push({ id: 'help', label: '帮助中心', icon: 'ri-book-open-line', route: '/help' });

  if (systemItems.length > 0) {
    menu.push({ type: 'divider', label: '系统管理' });
    menu.push(...systemItems);
  }

  return menu;
}

module.exports = router;
