/**
 * 权限工具函数
 */

const dbManager = require('../db/database');

// 权限缓存
let permissionsCache = null;
let rolePermissionsCache = {};
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

/**
 * 获取权限定义（带缓存）
 */
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

/**
 * 获取角色权限（带缓存）
 * @param {string} roleCode - 角色代码
 */
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

/**
 * 清除权限缓存
 */
function clearPermissionsCache() {
  permissionsCache = null;
  rolePermissionsCache = {};
  cacheTimestamp = null;
}

/**
 * 获取模块标签
 */
function getModuleLabel(module) {
  const labels = {
    cost: '成本管理',
    review: '审核管理',
    master: '基础数据',
    system: '系统管理'
  };
  return labels[module] || module;
}

/**
 * 获取模块图标
 */
function getModuleIcon(module) {
  const icons = {
    cost: 'ri-money-cny-box-line',
    review: 'ri-checkbox-circle-line',
    master: 'ri-database-2-line',
    system: 'ri-settings-3-line'
  };
  return icons[module] || 'ri-folder-line';
}

/**
 * 检查角色是否有指定权限
 * @param {string} roleCode - 角色代码
 * @param {string} permissionCode - 权限码
 */
async function roleHasPermission(roleCode, permissionCode) {
  if (roleCode === 'admin') return true;
  const permissions = await getRolePermissionsFromDB(roleCode);
  return permissions.includes(permissionCode);
}

module.exports = {
  getPermissions,
  getRolePermissionsFromDB,
  clearPermissionsCache,
  roleHasPermission,
  getModuleLabel,
  getModuleIcon
};
