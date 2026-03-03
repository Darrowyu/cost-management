/**
 * 角色权限映射配置
 * 定义每个角色拥有的权限码列表
 */

const { PERMISSIONS } = require('./permissions');

// 所有权限码列表
const ALL_PERMISSIONS = Object.keys(PERMISSIONS);

// 角色权限映射
const ROLE_PERMISSIONS = {
  // 管理员：拥有所有权限
  admin: ALL_PERMISSIONS,

  // 采购：管理原料，查看其他基础数据
  purchaser: [
    'master:material:view',
    'master:material:manage',
    'master:model:view',
    'master:regulation:view',
    'master:bom:view',
    'master:process:view',
    'master:packaging:view'
  ],

  // 生产：管理工序和包材，查看其他基础数据
  producer: [
    'master:process:view',
    'master:process:manage',
    'master:packaging:view',
    'master:packaging:manage',
    'master:model:view',
    'master:regulation:view',
    'master:bom:view',
    'master:material:view'
  ],

  // 审核：成本审核权限 + 基础数据查看
  reviewer: [
    'cost:view',
    'cost:submit',
    'review:view',
    'review:approve',
    'review:reject',
    'master:model:view',
    'master:regulation:view',
    'master:material:view',
    'master:process:view',
    'master:packaging:view',
    'master:bom:view'
  ],

  // 业务员：成本管理权限 + 客户管理 + 基础数据查看
  salesperson: [
    'cost:view',
    'cost:create',
    'cost:edit',
    'cost:delete',
    'cost:submit',
    'review:view',
    'master:customer:view',
    'master:customer:manage',
    'master:model:view',
    'master:regulation:view',
    'master:material:view',
    'master:process:view',
    'master:packaging:view',
    'master:bom:view'
  ],

  // 只读：仅查看权限
  readonly: [
    'cost:view',
    'review:view',
    'master:model:view',
    'master:regulation:view',
    'master:material:view',
    'master:process:view',
    'master:packaging:view',
    'master:bom:view',
    'master:customer:view'
  ]
};

// 角色名称映射
const ROLE_NAMES = {
  admin: '管理员',
  purchaser: '采购',
  producer: '生产',
  reviewer: '审核',
  salesperson: '业务员',
  readonly: '只读'
};

/**
 * 检查角色是否有指定权限
 * @param {string} role - 角色代码
 * @param {string} permission - 权限码
 * @returns {boolean}
 */
function hasPermission(role, permission) {
  if (role === 'admin') return true;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * 获取角色的所有权限
 * @param {string} role - 角色代码
 * @returns {string[]}
 */
function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * 更新角色权限（仅用于权限管理页面）
 * @param {string} role - 角色代码
 * @param {string[]} permissions - 权限码列表
 */
function updateRolePermissions(role, permissions) {
  if (role === 'admin') {
    throw new Error('不能修改管理员角色的权限');
  }
  if (!ROLE_PERMISSIONS[role]) {
    throw new Error('未知的角色: ' + role);
  }
  ROLE_PERMISSIONS[role] = permissions;
}

module.exports = {
  ROLE_PERMISSIONS,
  ROLE_NAMES,
  ALL_PERMISSIONS,
  hasPermission,
  getRolePermissions,
  updateRolePermissions
};
