// 帮助文档目录配置 - 使用权限码控制访问
export const helpMenuConfig = [
  {
    title: '快速入门',
    path: '/help/quick-start',
    file: 'quick-start.md',
    icon: 'ri-rocket-line'
    // 不设置 permission，表示所有人可见
  },
  {
    title: '成本分析',
    path: '/help/cost',
    file: 'cost/index.md',
    icon: 'ri-calculator-line',
    permission: 'cost:view',
    children: [
      { title: '创建成本分析', path: '/help/cost/create', file: 'cost/create.md', permission: 'cost:create' },
      { title: '编辑成本分析', path: '/help/cost/edit', file: 'cost/edit.md', permission: 'cost:edit' },
      { title: '成本对比', path: '/help/cost/compare', file: 'cost/compare.md', permission: 'cost:view' },
      { title: '成本记录', path: '/help/cost/records', file: 'cost/records.md', permission: 'cost:view' }
    ]
  },
  {
    title: '审核管理',
    path: '/help/review',
    file: 'review/index.md',
    icon: 'ri-shield-check-line',
    permission: 'review:view',
    children: [
      { title: '待审核', path: '/help/review/pending', file: 'review/pending.md', permission: 'review:view' },
      { title: '已审核', path: '/help/review/approved', file: 'review/approved.md', permission: 'review:view' }
    ]
  },
  {
    title: '基础数据',
    path: '/help/data',
    file: 'data/index.md',
    icon: 'ri-database-2-line',
    children: [
      { title: '原料管理', path: '/help/data/material', file: 'data/material.md', permission: 'master:material:view' },
      { title: '包材管理', path: '/help/data/packaging', file: 'data/packaging.md', permission: 'master:packaging:view' },
      { title: '工序管理', path: '/help/data/process', file: 'data/process.md', permission: 'master:process:view' },
      { title: '型号管理', path: '/help/data/model', file: 'data/model.md', permission: 'master:model:view' },
      { title: '法规管理', path: '/help/data/regulation', file: 'data/regulation.md', permission: 'master:regulation:view' },
      { title: '客户管理', path: '/help/data/customer', file: 'data/customer.md', permission: 'master:customer:view' }
    ]
  },
  {
    title: '系统配置',
    path: '/help/config',
    file: 'config/index.md',
    icon: 'ri-settings-3-line',
    permission: 'system:config:view',
    children: [
      { title: '系统参数', path: '/help/config/system', file: 'config/system.md', permission: 'system:config:view' },
      { title: '权限管理', path: '/help/config/permission', file: 'config/permission.md', permission: 'system:permission:view' }
    ]
  },
  {
    title: '常见问题',
    path: '/help/faq',
    file: 'faq/index.md',
    icon: 'ri-question-line',
    children: [
      { title: '通用问题', path: '/help/faq/common', file: 'faq/common.md' },
      { title: '故障排除', path: '/help/faq/troubleshooting', file: 'faq/troubleshooting.md' }
    ]
  }
]

/**
 * 根据权限过滤菜单
 * @param {Array} menu 菜单配置
 * @param {Object} authStore 认证 store 实例
 * @returns {Array} 过滤后的菜单
 */
export const filterMenuByPermissions = (menu, authStore) => {
  if (!authStore) return menu.filter(item => !item.permission)

  return menu
    .filter(item => {
      // 没有设置 permission 的菜单项所有人可见
      if (!item.permission) return true
      // 检查权限
      return authStore.hasPermission(item.permission)
    })
    .map(item => {
      if (item.children) {
        return {
          ...item,
          children: item.children.filter(child => {
            if (!child.permission) return true
            return authStore.hasPermission(child.permission)
          })
        }
      }
      return item
    })
}

// 保留旧的角色过滤函数以兼容旧代码
export const filterMenuByRole = (menu, role) => {
  console.warn('filterMenuByRole is deprecated, use filterMenuByPermissions instead')
  return menu
}

// 扁平化获取所有文档路径
export const getAllDocPaths = (menu) => {
  const paths = []
  menu.forEach(item => {
    paths.push({ path: item.path, file: item.file, title: item.title })
    if (item.children) {
      item.children.forEach(child => {
        paths.push({ path: child.path, file: child.file, title: child.title })
      })
    }
  })
  return paths
}

// 根据路径查找文档
export const findDocByPath = (menu, path) => {
  for (const item of menu) {
    if (item.path === path) return item
    if (item.children) {
      const child = item.children.find(c => c.path === path)
      if (child) return child
    }
  }
  return null
}

// 获取上一篇/下一篇
export const getPrevNextDoc = (menu, currentPath) => {
  const allPaths = getAllDocPaths(menu)
  const currentIndex = allPaths.findIndex(p => p.path === currentPath)

  return {
    prev: currentIndex > 0 ? allPaths[currentIndex - 1] : null,
    next: currentIndex < allPaths.length - 1 ? allPaths[currentIndex + 1] : null
  }
}
