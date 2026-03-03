import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../../store/auth'
import {
  helpMenuConfig,
  filterMenuByRole,
  findDocByPath,
  getPrevNextDoc
} from '../../../utils/helpConfig'
import { renderMarkdown } from '../../../utils/markdownRenderer'

export function useHelpDocs() {
  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()

  // 状态
  const loading = ref(false)
  const error = ref(null)
  const rawContent = ref('')
  const searchQuery = ref('')
  const searchResults = ref([])
  const allDocsCache = ref([])
  const sidebarCollapsed = ref(false)

  // 根据角色过滤的菜单
  const userRole = computed(() => authStore.user?.role || 'readonly')
  const menu = computed(() => filterMenuByRole(helpMenuConfig, userRole.value))

  // 当前文档
  const currentPath = computed(() => route?.path || '/')
  const currentDoc = computed(() => findDocByPath(menu.value, currentPath.value))

  // 渲染后的内容
  const renderedContent = computed(() => renderMarkdown(rawContent.value))

  // 面包屑（不包含帮助中心根节点，避免与页面标题重复）
  const breadcrumbs = computed(() => {
    const crumbs = []

    for (const item of menu.value) {
      if (item.path === currentPath.value) {
        crumbs.push({ title: item.title, path: item.path })
        return crumbs
      }
      if (item.children) {
        const child = item.children.find(c => c.path === currentPath.value)
        if (child) {
          crumbs.push({ title: item.title, path: item.path })
          crumbs.push({ title: child.title, path: child.path })
          return crumbs
        }
      }
    }
    return crumbs
  })

  // 上一篇/下一篇
  const navigation = computed(() => getPrevNextDoc(menu.value, currentPath.value))

  // 加载文档
  const loadDoc = async (path) => {
    const doc = findDocByPath(menu.value, path)
    if (!doc) {
      error.value = '文档未找到'
      return
    }

    loading.value = true
    error.value = null

    try {
      const response = await fetch(`/help/${doc.file}`)
      if (!response.ok) {
        throw new Error(`Failed to load: ${response.status}`)
      }
      rawContent.value = await response.text()

      // 恢复阅读进度
      restoreProgress(path)
    } catch (err) {
      error.value = err.message
      rawContent.value = ''
    } finally {
      loading.value = false
    }
  }

  // 加载搜索索引
  const loadSearchIndex = async () => {
    if (allDocsCache.value.length > 0) return // 已缓存则跳过

    try {
      const response = await fetch('/help/search-index.json')
      if (response.ok) {
        const index = await response.json()
        allDocsCache.value = index.documents || []
      }
    } catch (err) {
      console.error('加载搜索索引失败:', err.message)
    }
  }

  // 搜索功能
  const search = async (query) => {
    if (!query.trim()) {
      searchResults.value = []
      return
    }

    // 加载索引（如果还没加载）
    if (allDocsCache.value.length === 0) {
      await loadSearchIndex()
    }

    const lowerQuery = query.toLowerCase()
    searchResults.value = allDocsCache.value
      .filter(doc =>
        doc.title.toLowerCase().includes(lowerQuery) ||
        doc.content.toLowerCase().includes(lowerQuery) ||
        doc.keywords?.some(k => k.includes(lowerQuery))
      )
      .slice(0, 10)
      .map(doc => ({
        ...doc,
        snippet: extractSnippet(doc.content, lowerQuery)
      }))
  }

  // 提取搜索片段
  const extractSnippet = (content, query) => {
    const lowerContent = content.toLowerCase()
    const index = lowerContent.indexOf(query)
    if (index === -1) return content.slice(0, 100) + '...'

    const start = Math.max(0, index - 50)
    const end = Math.min(content.length, index + query.length + 50)
    let snippet = content.slice(start, end)

    if (start > 0) snippet = '...' + snippet
    if (end < content.length) snippet = snippet + '...'

    return snippet
  }

  // 保存阅读进度
  const saveProgress = (path, scrollTop) => {
    localStorage.setItem(`help_progress_${path}`, JSON.stringify({
      scrollTop,
      timestamp: Date.now()
    }))
  }

  // 恢复阅读进度
  const restoreProgress = (path) => {
    const saved = localStorage.getItem(`help_progress_${path}`)
    if (saved) {
      const { scrollTop } = JSON.parse(saved)
      setTimeout(() => {
        window.scrollTo({ top: scrollTop, behavior: 'smooth' })
      }, 100)
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // 监听路径变化自动加载文档
  watch(currentPath, (newPath) => {
    if (newPath.startsWith('/help')) {
      loadDoc(newPath)
    }
  }, { immediate: true })

  return {
    // 状态
    loading,
    error,
    rawContent,
    renderedContent,
    searchQuery,
    searchResults,
    sidebarCollapsed,

    // 计算属性
    menu,
    currentPath,
    currentDoc,
    breadcrumbs,
    navigation,

    // 方法
    loadDoc,
    search,
    saveProgress,
    restoreProgress
  }
}
