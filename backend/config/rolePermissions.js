/**
 * 角色权限映射配置
 * 定义每个角色拥有的权限码列表
 */

const { PERMISSIONS } = require('./permissions');
const dbManager = require('../db/database');
const logger = require('../utils/logger');

// 所有权限码列表
const ALL_PERMISSIONS = Object.keys(PERMISSIONS);

// 角色权限映射（内存缓存）
let ROLE_PERMISSIONS_CACHE = {};
let ROLE_NAMES_CACHE = {};

// 初始化缓存
async function initRoleCache() {
  try {
    const result = await dbManager.query(
      'SELECT code, name FROM roles WHERE is_active = true'
    );
    result.rows.forEach(role => {
      ROLE_NAMES_CACHE[role.code] = role.name;
    });
    logger.info('角色缓存初始化完成', { count: result.rows.length });
  } catch (err) {
    logger.error('角色缓存初始化失败:', err);
    // 使用默认角色名称作为回退
    ROLE_NAMES_CACHE = {
      admin: '管理员',
      purchaser: '采购',
      producer: '生产',
      reviewer: '审核',
      salesperson: '业务员',
      readonly: '只读'
    };
  }
}

// 获取角色名称
async function getRoleNames() {
  // 如果缓存为空，先初始化
  if (Object.keys(ROLE_NAMES_CACHE).length === 0) {
    await initRoleCache();
  }
  return ROLE_NAMES_CACHE;
}

// 获取单个角色名称
async function getRoleName(roleCode) {
  const names = await getRoleNames();
  return names[roleCode] || roleCode;
}

// 刷新角色缓存
async function refreshRoleCache() {
  ROLE_NAMES_CACHE = {};
  await initRoleCache();
}

/**
 * 检查角色是否有指定权限
 * @param {string} role - 角色代码
 * @param {string} permission - 权限码
 * @returns {boolean}
 */
function hasPermission(role, permission) {
  if (role === 'admin') return true;
  const permissions = ROLE_PERMISSIONS_CACHE[role] || [];
  return permissions.includes(permission);
}

/**
 * 获取角色的所有权限
 * @param {string} role - 角色代码
 * @returns {string[]}
 */
function getRolePermissions(role) {
  if (role === 'admin') return ALL_PERMISSIONS;
  return ROLE_PERMISSIONS_CACHE[role] || [];
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
  ROLE_PERMISSIONS_CACHE[role] = permissions;
}

// 兼容旧代码的同步版本（使用缓存）
const ROLE_NAMES = {
  admin: '管理员',
  purchaser: '采购',
  producer: '生产',
  reviewer: '审核',
  salesperson: '业务员',
  readonly: '只读'
};

// 模块加载时不立即初始化缓存，等待数据库连接完成后再初始化
// 由 app.js 在服务器启动后调用 initRoleCache()

module.exports = {
  ROLE_PERMISSIONS: ROLE_PERMISSIONS_CACHE,
  ROLE_NAMES,
  ALL_PERMISSIONS,
  hasPermission,
  getRolePermissions,
  updateRolePermissions,
  getRoleNames,
  getRoleName,
  refreshRoleCache,
  initRoleCache
};
