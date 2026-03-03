import { ref } from 'vue'
import { findDocByPath } from '../../../utils/helpConfig'

// 文档加载状态
const loading = ref(false)
const error = ref(null)
const content = ref('')

/**
 * 加载指定路径的文档
 * @param {string} path - 文档路径
 * @param {Array} menu - 菜单配置
 * @returns {Promise<{content: string, error: string|null}>}
 */
export async function loadDoc(path, menu) {
  const doc = findDocByPath(menu, path)
  if (!doc) {
    return { content: '', error: '文档未找到' }
  }

  loading.value = true
  error.value = null

  try {
    const response = await fetch(`/help/${doc.file}`)
    if (!response.ok) {
      throw new Error(`加载失败: ${response.status}`)
    }
    const text = await response.text()
    content.value = text
    return { content: text, error: null }
  } catch (err) {
    error.value = err.message
    content.value = ''
    return { content: '', error: err.message }
  } finally {
    loading.value = false
  }
}

/**
 * 在路由守卫中预加载文档
 * @param {Object} to - 目标路由
 * @param {Array} menu - 菜单配置
 * @returns {Promise<{content: string, error: string|null}>}
 */
export async function preloadDocForRoute(to, menu) {
  const path = to.path
  return loadDoc(path, menu)
}

/**
 * 使用文档加载器
 * @returns {Object} 加载状态和函数
 */
export function useDocLoader() {
  return {
    loading,
    error,
    content,
    loadDoc
  }
}
