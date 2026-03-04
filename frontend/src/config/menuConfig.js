/**
 * 菜单配置 - 已弃用
 *
 * 注意：菜单现在通过 /api/permissions/menu 接口动态获取
 * 保留此文件仅用于兼容旧代码中的 getRoleName 函数
 */

// 角色名称映射
export const roleNameMap = {
  admin: '管理员',
  purchaser: '采购',
  producer: '生产',
  reviewer: '审核',
  salesperson: '业务',
  readonly: '只读'
}

/**
 * 获取角色名称
 * @param {string} role 角色代码
 * @returns {string} 角色显示名称
 */
export function getRoleName(role) {
  return roleNameMap[role] || '-'
}

// 以下代码已弃用，仅用于向后兼容
// 使用 frontend/src/composables/useMenu.js 替代

export const menuConfig = []

export function filterMenuByRole() {
  console.warn('filterMenuByRole is deprecated, use useMenu composable instead')
  return []
}

export function findMenuItem() {
  console.warn('findMenuItem is deprecated, use useMenu composable instead')
  return null
}
