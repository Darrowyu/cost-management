/**
 * Axios 请求封装 - 带有请求去重与重试机制 (Production Grade)
 */

import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '../router'
import { getToken, clearAuth } from './auth'
import logger from './logger'

// 默认超时时间（毫秒）
const DEFAULT_TIMEOUT = 30000 // 30秒，适合大部分操作
const LONG_TIMEOUT = 120000   // 120秒，用于导入/导出等耗时操作

// 创建 axios 实例
const request = axios.create({
  baseURL: '/api', // 通过 Vite 代理转发到后端
  timeout: DEFAULT_TIMEOUT
})

// === 请求去重机制 ===
const pendingRequests = new Map()

const safeStringify = (obj) => {
  if (!obj) return ''
  if (typeof obj === 'string') return obj
  try {
    return JSON.stringify(obj)
  } catch (e) {
    return 'circular-or-unserializable-object'
  }
}

const generateRequestKey = (config) => {
  const { method, url, params, data } = config
  // 对于含有FormData的请求，不去重
  if (data instanceof FormData) return null
  return [method, url, safeStringify(params), safeStringify(data)].join('&')
}

const addPendingRequest = (config) => {
  const requestKey = generateRequestKey(config)
  if (!requestKey) return
  config.cancelToken = config.cancelToken || new axios.CancelToken((cancel) => {
    if (!pendingRequests.has(requestKey)) {
      pendingRequests.set(requestKey, cancel)
    }
  })
}

const removePendingRequest = (config) => {
  const requestKey = generateRequestKey(config)
  if (requestKey && pendingRequests.has(requestKey)) {
    const cancel = pendingRequests.get(requestKey)
    cancel(requestKey)
    pendingRequests.delete(requestKey)
  }
}

// 请求拦截器
request.interceptors.request.use(
  config => {
    // 移除之前的同名请求
    removePendingRequest(config)
    addPendingRequest(config)

    // 从 localStorage/sessionStorage 获取 token
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // 导入/导出接口使用更长的超时时间
    if (config.url?.includes('/import') || config.url?.includes('/export') || config.url?.includes('/template')) {
      config.timeout = LONG_TIMEOUT
    }

    return config
  },
  error => {
    logger.error('请求错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  response => {
    removePendingRequest(response.config)
    // 直接返回响应数据
    return response.data
  },
  async error => {
    if (axios.isCancel(error)) {
      logger.info('请求被取消去重:', error.message)
      return Promise.reject(error)
    }

    if (error.config) {
      removePendingRequest(error.config)
    }

    const { config } = error

    // === 指数退避重试机制 ===
    // 只重试暂时的网络错误或特定服务器错误(502,503,504)
    const shouldRetry = (!error.response && error.code !== 'ECONNABORTED') ||
      (error.response && [502, 503, 504].includes(error.response.status))

    if (config && shouldRetry && !config.url?.includes('/auth/login')) {
      config.__retryCount = config.__retryCount || 0
      const maxRetries = 3

      if (config.__retryCount < maxRetries) {
        config.__retryCount += 1
        const backoff = new Promise((resolve) => {
          setTimeout(() => {
            resolve()
          }, parseInt(Math.pow(2, config.__retryCount) * 500)) // 1s, 2s, 4s 退避
        })

        await backoff
        logger.warn(`请求超时或网关不可用，正在进行第 ${config.__retryCount} 次重试: ${config.url}`)
        return request(config)
      }
    }

    logger.error('响应错误:', error)

    // 超时错误特殊处理
    if (error.code === 'ECONNABORTED' && error.message?.includes('timeout')) {
      ElMessage.error('请求超时，请检查网络或稍后重试')
      return Promise.reject(error)
    }

    if (error.response) {
      const { status, data } = error.response

      switch (status) {
        case 401:
          // 如果是登录接口本身的 401 错误，不视为 token 过期，直接抛出由页面处理
          if (error.config.url && error.config.url.includes('/auth/login')) {
            return Promise.reject(error)
          }

          ElMessage.error('登录已过期，请重新登录')
          // 清除所有认证信息
          clearAuth()
          // 跳转到登录页
          if (router.currentRoute.value.path !== '/login') {
            router.push('/login')
          }
          break
        case 403:
          // 直接使用后端返回的错误信息（已包含具体权限码）
          ElMessage.error(data?.message || '您没有权限执行此操作')
          break
        case 404:
          ElMessage.error('请求的接口不存在(404)，请检查后端服务是否正常启动')
          break
        case 429:
          ElMessage.error('请求过于频繁，请稍后再试')
          break
        case 500:
          ElMessage.error('服务器错误，请稍后重试')
          break
        case 502:
        case 503:
        case 504:
          ElMessage.error('网关或服务暂时不可用，请联系管理员')
          break
        default:
          ElMessage.error(data?.message || '请求失败')
      }
    } else if (error.request) {
      ElMessage.error('无法连接到服务器，请检查网络或后端服务是否启动')
    } else {
      ElMessage.error('请求配置错误')
    }

    return Promise.reject(error)
  }
)

export default request

// 导出自定义超时配置，供特殊场景使用
export { DEFAULT_TIMEOUT, LONG_TIMEOUT }
