/**
 * 认证状态管理
 */

import { defineStore } from 'pinia'
import request from '../utils/request'
import { getToken, setToken, getUser, setUser, clearAuth } from '../utils/auth'
import logger from '../utils/logger'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: getToken(),
    user: getUser(),
    permissions: [], // 用户权限列表
    permissionsLoaded: false
  }),

  getters: {
    // 是否已登录
    isLoggedIn: (state) => !!state.token,

    // 用户角色
    userRole: (state) => state.user?.role || null,

    // 用户名
    username: (state) => state.user?.username || '',

    // 真实姓名
    realName: (state) => state.user?.real_name || state.user?.username || '',

    // 是否是管理员
    isAdmin: (state) => state.user?.role === 'admin',

    // 是否是采购
    isPurchaser: (state) => state.user?.role === 'purchaser',

    // 是否是生产
    isProducer: (state) => state.user?.role === 'producer',

    // 是否是审核
    isReviewer: (state) => state.user?.role === 'reviewer',

    // 是否是业务员
    isSalesperson: (state) => state.user?.role === 'salesperson',

    // 检查单个权限
    hasPermission: (state) => (permissionCode) => {
      if (!state.user) return false
      if (state.user.role === 'admin') return true
      return state.permissions.includes(permissionCode)
    },

    // 批量检查权限（有一个满足即可）
    hasAnyPermission: (state) => (permissionCodes) => {
      if (!state.user) return false
      if (state.user.role === 'admin') return true
      return permissionCodes.some(code => state.permissions.includes(code))
    }
  },

  actions: {
    // 登录
    async login(username, password) {
      try {
        const response = await request.post('/auth/login', {
          username,
          password
        })

        if (response.success) {
          this.token = response.data.token
          this.user = response.data.user

          // 保存到 localStorage
          setToken(response.data.token)
          setUser(response.data.user)

          // 获取用户权限
          await this.fetchPermissions()

          return response.data
        } else {
          throw new Error(response.message || '登录失败')
        }
      } catch (error) {
        throw error
      }
    },

    // 登出
    logout() {
      this.token = null
      this.user = null
      this.permissions = []
      this.permissionsLoaded = false
      clearAuth()

      // 跳转到登录页
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    },

    // 获取当前用户信息
    async fetchUserInfo() {
      try {
        const response = await request.get('/auth/me')
        if (response.success) {
          this.user = response.data
          setUser(response.data)
          // 同时获取权限
          await this.fetchPermissions()
          return response.data
        }
      } catch (error) {
        // Token 可能已过期，清除登录状态
        this.logout()
        throw error
      }
    },

    // 获取用户权限
    async fetchPermissions() {
      try {
        const response = await request.get('/permissions/my')
        if (response.success) {
          this.permissions = response.data.permissions || []
          this.permissionsLoaded = true
        }
      } catch (error) {
        logger.error('获取权限失败:', error)
        this.permissions = []
        this.permissionsLoaded = false
      }
    },

    // 修改密码
    async changePassword(oldPassword, newPassword) {
      try {
        const response = await request.post('/auth/change-password', {
          oldPassword,
          newPassword
        })
        return response
      } catch (error) {
        throw error
      }
    }
  }
})
