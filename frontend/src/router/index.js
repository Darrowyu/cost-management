import { createRouter, createWebHistory } from 'vue-router'
import { getToken, isTokenExpired, clearAuth } from '../utils/auth'
import { helpMenuConfig, filterMenuByPermissions, findDocByPath } from '../utils/helpConfig'

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { requiresAuth: false }
  },
  // 使用 MainLayout 的页面
  {
    path: '/',
    component: () => import('../components/layout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue')
      },
      {
        path: 'regulations',
        name: 'RegulationManage',
        component: () => import('../views/regulation/RegulationManage.vue')
      },
      {
        path: 'models',
        name: 'ModelManage',
        component: () => import('../views/model/ModelManage.vue')
      },
      {
        path: 'materials',
        name: 'MaterialManage',
        component: () => import('../views/material/MaterialManage.vue')
      },
      {
        path: 'processes',
        name: 'ProcessManage',
        component: () => import('../views/process/ProcessManage.vue')
      },
      {
        path: 'packaging',
        name: 'PackagingManage',
        component: () => import('../views/packaging/PackagingManage.vue')
      },
      {
        path: 'users',
        name: 'UserManage',
        component: () => import('../views/user/UserManage.vue'),
        meta: { requiresPermission: 'system:user:manage' }
      },
      {
        path: 'config',
        name: 'SystemConfig',
        component: () => import('../views/config/SystemConfig.vue')
      },
      {
        path: 'config/permissions',
        name: 'PermissionManage',
        component: () => import('../views/config/PermissionManage.vue'),
        meta: { requiresPermission: 'system:permission:manage' }
      },
      {
        path: 'cost/add',
        name: 'CostAdd',
        component: () => import('../views/cost/CostAdd.vue'),
        meta: { requiresPermission: 'cost:create' }
      },
      {
        path: 'cost/edit/:id',
        name: 'CostEdit',
        component: () => import('../views/cost/CostAdd.vue'),
        meta: { requiresPermission: 'cost:edit' }
      },
      {
        path: 'cost/detail/:id',
        name: 'CostDetail',
        component: () => import('../views/cost/CostDetail.vue'),
        meta: { requiresPermission: 'cost:view' }
      },
      {
        path: 'cost/standard',
        name: 'StandardCost',
        component: () => import('../views/cost/StandardCost.vue'),
        meta: { requiresPermission: 'cost:view' }
      },
      {
        path: 'cost/records',
        name: 'CostRecords',
        component: () => import('../views/cost/CostRecords.vue'),
        meta: { requiresPermission: 'cost:view' }
      },
      {
        path: 'cost/compare',
        name: 'CostCompare',
        component: () => import('../views/cost/CostCompare.vue'),
        meta: { requiresPermission: 'cost:view' }
      },
      // 审核管理路由
      {
        path: 'review/pending',
        name: 'PendingReview',
        component: () => import('../views/review/PendingReview.vue'),
        meta: { requiresPermission: 'review:view' }
      },
      {
        path: 'review/approved',
        name: 'ApprovedReview',
        component: () => import('../views/review/ApprovedReview.vue'),
        meta: { requiresPermission: 'review:view' }
      },
      {
        path: 'profile',
        name: 'ProfileSettings',
        component: () => import('../views/user/ProfileSettings.vue')
      },
      {
        path: 'customers',
        name: 'CustomerManage',
        component: () => import('../views/customer/CustomerManage.vue')
      },
      {
        path: 'help/:pathMatch(.*)*',
        name: 'Help',
        component: () => import('../views/help/HelpView.vue'),
        meta: { requiresAuth: true },
        beforeEnter: async (to, from, next) => {
          const { useAuthStore } = await import('../store/auth')
          const authStore = useAuthStore()
          const menu = filterMenuByPermissions(helpMenuConfig, authStore)

          // 如果访问 /help 根路径，重定向到第一个可见文档
          if (to.path === '/help') {
            const firstDoc = menu[0]
            if (firstDoc) {
              next({ path: firstDoc.path, replace: true })
              return
            }
          }

          const doc = findDocByPath(menu, to.path)
          if (!doc) {
            to.meta.docContent = ''
            to.meta.docError = '文档未找到'
            next()
            return
          }

          try {
            const response = await fetch(`/help/${doc.file}`)
            if (!response.ok) {
              throw new Error(`加载失败: ${response.status}`)
            }
            const content = await response.text()
            to.meta.docContent = content
            to.meta.docError = null
          } catch (err) {
            to.meta.docContent = ''
            to.meta.docError = err.message
          }
          next()
        }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})


// 路由守卫
router.beforeEach(async (to, from, next) => {
  const token = getToken()

  // 检查路由或其父路由是否需要认证
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiredPermission = to.matched.find(record => record.meta.requiresPermission)?.meta?.requiresPermission

  // 需要认证的页面
  if (requiresAuth) {
    if (!token) {
      next('/login')
      return
    }

    if (isTokenExpired()) {
      clearAuth()
      next('/login')
      return
    }

    try {
      const { useAuthStore } = await import('../store/auth')
      const authStore = useAuthStore()

      // 如果是应用首次加载，获取用户信息
      if (from.path === '/' || from.name === null) {
        await authStore.fetchUserInfo()
      }

      // 检查权限码
      if (requiredPermission) {
        const hasPerm = authStore.hasPermission?.(requiredPermission) ?? false

        if (!hasPerm) {
          next('/dashboard')
          return
        }
      }

      next()
    } catch (error) {
      clearAuth()
      next('/login')
    }
  } else {
    // 已登录用户访问登录页，重定向到仪表盘
    if (to.path === '/login' && token && !isTokenExpired()) {
      next('/dashboard')
    } else {
      next()
    }
  }
})

export default router
