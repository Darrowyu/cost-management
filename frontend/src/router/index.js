import { createRouter, createWebHistory } from 'vue-router'
import { getToken, isTokenExpired, clearAuth } from '../utils/auth'

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
        meta: { requiresAdmin: true }
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
        meta: { requiresAdmin: true }
      },
      {
        path: 'cost/add',
        name: 'CostAdd',
        component: () => import('../views/cost/CostAdd.vue'),
        meta: { forbidPurchaserProducer: true }
      },
      {
        path: 'cost/edit/:id',
        name: 'CostEdit',
        component: () => import('../views/cost/CostAdd.vue'),
        meta: { forbidPurchaserProducer: true }
      },
      {
        path: 'cost/detail/:id',
        name: 'CostDetail',
        component: () => import('../views/cost/CostDetail.vue'),
        meta: { forbidPurchaserProducer: true }
      },
      {
        path: 'cost/standard',
        name: 'StandardCost',
        component: () => import('../views/cost/StandardCost.vue'),
        meta: { forbidPurchaserProducer: true }
      },
      {
        path: 'cost/records',
        name: 'CostRecords',
        component: () => import('../views/cost/CostRecords.vue'),
        meta: { forbidPurchaserProducer: true }
      },
      {
        path: 'cost/compare',
        name: 'CostCompare',
        component: () => import('../views/cost/CostCompare.vue'),
        meta: { forbidPurchaserProducer: true }
      },
      // 审核管理路由 - admin/reviewer/salesperson 可访问
      {
        path: 'review/pending',
        name: 'PendingReview',
        component: () => import('../views/review/PendingReview.vue'),
        meta: { requiresReviewAccess: true }
      },
      {
        path: 'review/approved',
        name: 'ApprovedReview',
        component: () => import('../views/review/ApprovedReview.vue'),
        meta: { requiresReviewAccess: true }
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
  const requiresAdmin = to.matched.some(record => record.meta.requiresAdmin)
  const requiresReviewer = to.matched.some(record => record.meta.requiresReviewer)
  const requiresReviewAccess = to.matched.some(record => record.meta.requiresReviewAccess)
  const forbidPurchaserProducer = to.matched.some(record => record.meta.forbidPurchaserProducer)

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

    // 如果是应用首次加载，验证 token 有效性
    if (from.path === '/' || from.name === null) {
      try {
        const { useAuthStore } = await import('../store/auth')
        const authStore = useAuthStore()
        await authStore.fetchUserInfo()

        const role = authStore.user?.role

        // 检查管理员权限
        if (requiresAdmin && role !== 'admin') {
          next('/dashboard')
          return
        }

        // 检查审核人员权限（仅admin和reviewer可访问）
        if (requiresReviewer && role !== 'admin' && role !== 'reviewer') {
          next('/dashboard')
          return
        }

        // 检查审核管理访问权限（admin/reviewer/salesperson可访问）
        if (requiresReviewAccess && role !== 'admin' && role !== 'reviewer' && role !== 'salesperson') {
          next('/dashboard')
          return
        }

        // 检查采购/生产人员限制
        if (forbidPurchaserProducer && (role === 'purchaser' || role === 'producer')) {
          next('/dashboard')
          return
        }

        next()
      } catch (error) {
        clearAuth()
        next('/login')
      }
    } else {
      const { useAuthStore } = await import('../store/auth')
      const authStore = useAuthStore()
      const role = authStore.user?.role

      if (requiresAdmin && role !== 'admin') {
        next('/dashboard')
        return
      }

      // 检查审核人员权限
      if (requiresReviewer && role !== 'admin' && role !== 'reviewer') {
        next('/dashboard')
        return
      }

      // 检查审核管理访问权限（admin/reviewer/salesperson可访问）
      if (requiresReviewAccess && role !== 'admin' && role !== 'reviewer' && role !== 'salesperson') {
        next('/dashboard')
        return
      }

      if (forbidPurchaserProducer && (role === 'purchaser' || role === 'producer')) {
        next('/dashboard')
        return
      }

      next()
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
