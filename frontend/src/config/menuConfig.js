/**
 * 菜单配置 - 定义系统侧边栏菜单结构
 */

export const menuConfig = [
  { id: 'dashboard', label: '仪表盘', icon: 'ri-dashboard-3-line', route: '/dashboard' },

  { type: 'divider', label: '成本数据' },

  {
    id: 'cost',
    label: '成本管理',
    icon: 'ri-money-cny-box-line',
    roles: ['admin', 'reviewer', 'salesperson', 'readonly'],
    children: [
      { id: 'cost_add', label: '新增成本分析', route: '/cost/add', icon: 'ri-add-circle-line' },
      { id: 'cost_estimation', label: '新产品预估', route: '/cost/add?mode=estimation', icon: 'ri-lightbulb-line' },
      { id: 'cost_standard', label: '标准成本', route: '/cost/standard', icon: 'ri-bookmark-line' },
      { id: 'cost_records', label: '成本记录', route: '/cost/records', icon: 'ri-file-list-3-line' }
    ]
  },
  {
    id: 'review',
    label: '审核管理',
    icon: 'ri-checkbox-circle-line',
    roles: ['admin', 'reviewer', 'salesperson'],
    children: [
      { id: 'review_pending', label: '待审核记录', route: '/review/pending', icon: 'ri-time-line' },
      { id: 'review_approved', label: '已审核记录', route: '/review/approved', icon: 'ri-check-double-line' }
    ]
  },

  { type: 'divider', label: '基础数据' },

  { id: 'regulation', label: '法规管理', icon: 'ri-government-line', route: '/regulations', roles: ['admin', 'salesperson', 'reviewer', 'purchaser', 'producer', 'readonly'] },
  { id: 'model', label: '型号管理', icon: 'ri-price-tag-3-line', route: '/models', roles: ['admin', 'salesperson', 'reviewer', 'purchaser', 'producer', 'readonly'] },
  { id: 'customer', label: '客户管理', icon: 'ri-user-3-line', route: '/customers', roles: ['admin', 'purchaser', 'salesperson'] },
  {
    id: 'material',
    label: '原料管理',
    icon: 'ri-stack-line',
    children: [
      { id: 'material_half_mask', label: '半面罩类', route: '/materials?type=half_mask', icon: 'ri-cpu-line' },
      { id: 'material_general', label: '口罩类', route: '/materials?type=general', icon: 'ri-file-list-2-line' }
    ]
  },
  { id: 'packaging', label: '包材管理', icon: 'ri-box-3-line', route: '/packaging' },
  { id: 'process', label: '工序管理', icon: 'ri-settings-4-line', route: '/processes' },

  { type: 'divider', label: '系统管理' },

  { id: 'config', label: '系统配置', icon: 'ri-equalizer-line', route: '/config' },
  { id: 'permission', label: '权限管理', icon: 'ri-shield-keyhole-line', route: '/config/permissions', roles: ['admin'] },
  { id: 'profile', label: '个人设置', icon: 'ri-user-line', route: '/profile', roles: ['purchaser', 'producer', 'reviewer', 'salesperson', 'readonly'] },
  { id: 'user', label: '用户管理', icon: 'ri-user-settings-line', route: '/users', roles: ['admin'] }
]

export function filterMenuByRole(menuItems, userRole) {
  if (!userRole) return []
  const filtered = menuItems.filter(item => {
    if (item.type === 'divider') return true
    if ((userRole === 'purchaser' || userRole === 'producer') && item.id === 'cost') return false
    if (item.roles && !item.roles.includes(userRole)) return false
    return true
  })
  return filtered.filter((item, index) => {
    if (item.type === 'divider' && item.label === '成本数据') {
      const nextItem = filtered[index + 1]
      if (!nextItem || nextItem.type === 'divider') return false
    }
    return true
  })
}

export function findMenuItem(menuItems, menuId) {
  for (const item of menuItems) {
    if (item.id === menuId) return item
    if (item.children) {
      const sub = item.children.find(s => s.id === menuId)
      if (sub) return sub
    }
  }
  return null
}

export const roleNameMap = {
  admin: '管理员',
  purchaser: '采购',
  producer: '生产',
  reviewer: '审核',
  salesperson: '业务',
  readonly: '只读'
}

export function getRoleName(role) {
  return roleNameMap[role] || '-'
}
