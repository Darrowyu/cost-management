<template>
  <div class="h-full flex flex-col bg-slate-50">
    <!-- 顶部搜索栏 - 固定 -->
    <header class="flex-shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8">
      <div class="max-w-7xl mx-auto">
        <div class="flex items-center h-16">
          <!-- 移动端菜单按钮 -->
          <button
            class="lg:hidden mr-4 p-2 rounded-lg hover:bg-slate-100"
            @click="showMobileMenu = true"
          >
            <i class="ri-menu-line text-xl text-slate-600"></i>
          </button>

          <!-- Logo/返回 -->
          <div class="flex items-center flex-shrink-0">
            <i class="ri-book-open-line text-primary-600 text-xl mr-2"></i>
            <span class="font-semibold text-slate-800">帮助中心</span>
          </div>

          <!-- 面包屑 -->
          <div class="hidden md:flex items-center ml-8 text-sm text-slate-500">
            <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path">
              <span v-if="index > 0" class="mx-2">/</span>
              <a
                :href="crumb.path"
                class="hover:text-primary-600"
                :class="index === breadcrumbs.length - 1 ? 'text-slate-800 font-medium' : ''"
                @click.prevent="$router.push(crumb.path)"
              >
                {{ crumb.title }}
              </a>
            </template>
          </div>

          <!-- 搜索 - 靠右显示 -->
          <div class="ml-auto w-full max-w-md">
            <HelpSearchBar
              v-model="searchQuery"
              :search-results="searchResults"
              @search="search"
            />
          </div>
        </div>
      </div>
    </header>

    <!-- 下方内容区 - 左右布局 -->
    <div class="flex flex-1 overflow-hidden">
      <!-- 桌面端侧边栏 -->
      <HelpSidebar
        :menu="menu"
        :current-path="currentPath"
        class="hidden lg:block w-60 flex-shrink-0 overflow-y-auto scrollbar-hide"
      />

      <!-- 主内容区 -->
      <main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scrollbar-hide" ref="mainContent">
        <HelpContent
          :loading="loading"
          :error="error"
          :rendered-content="renderedContent"
          :raw-content="rawContent"
          :navigation="navigation"
          @retry="retryLoad"
          @navigate="handleNavigate"
        />
      </main>
    </div>

    <!-- 移动端侧边栏抽屉 -->
    <el-drawer
      v-model="showMobileMenu"
      title="帮助目录"
      direction="ltr"
      size="260px"
    >
      <HelpSidebar
        :menu="menu"
        :current-path="currentPath"
      />
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue' // 组合式API
import { useRoute, useRouter } from 'vue-router'
import { throttle } from 'lodash-es'
import { useHelpDocs } from './composables/useHelpDocs'
import { renderMarkdown } from '../../utils/markdownRenderer'
import HelpSidebar from './components/HelpSidebar.vue'
import HelpSearchBar from './components/HelpSearchBar.vue'
import HelpContent from './components/HelpContent.vue'

const route = useRoute()
const router = useRouter()

// 从路由 meta 获取文档内容和错误信息
const docContent = computed(() => route.meta.docContent || '')
const docError = computed(() => route.meta.docError || null)

// 使用帮助文档逻辑（传入初始内容）
const {
  rawContent,
  searchQuery,
  searchResults,
  menu,
  currentPath,
  breadcrumbs,
  navigation,
  search,
  saveProgress,
  restoreProgress
} = useHelpDocs({
  initialContent: docContent.value,
  initialError: docError.value
})

// 加载状态（由路由守卫控制，这里保持兼容性）
const loading = ref(false)
// 错误状态（从路由 meta 获取）
const error = computed(() => docError.value)
// 渲染后的内容
const renderedContent = computed(() => renderMarkdown(rawContent.value))

const showMobileMenu = ref(false)
const mainContent = ref(null)

// 监听路由变化更新内容
watch(docContent, (newContent) => {
  if (newContent !== undefined) {
    rawContent.value = newContent
  }
})

// 节流保存进度，每 500ms 最多执行一次
const throttledSave = throttle((path, scrollTop) => {
  saveProgress(path, scrollTop)
}, 500)

// 页面卸载前确保保存进度
const handleBeforeUnload = () => {
  if (mainContent.value) {
    throttledSave.flush() // 立即执行待保存的进度
    saveProgress(currentPath.value, mainContent.value.scrollTop)
  }
}

// 监听滚动，使用节流函数
const handleScroll = () => {
  if (mainContent.value) {
    throttledSave(currentPath.value, mainContent.value.scrollTop)
  }
}

onMounted(() => {
  if (mainContent.value) {
    mainContent.value.addEventListener('scroll', handleScroll)
  }
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  if (mainContent.value) {
    mainContent.value.removeEventListener('scroll', handleScroll)
  }
  window.removeEventListener('beforeunload', handleBeforeUnload)
  throttledSave.cancel() // 取消待执行的节流函数，防止内存泄漏
})

// 处理导航事件：先回到顶部，再跳转
const handleNavigate = (path) => {
  if (mainContent.value) {
    mainContent.value.scrollTop = 0
  }
  router.push(path)
}

// 重试加载（刷新页面触发路由守卫重新加载）
const retryLoad = () => {
  window.location.reload()
}

// 切换文档时恢复滚动位置
watch(currentPath, (newPath, oldPath) => {
  if (mainContent.value && newPath !== oldPath) {
    restoreProgress(newPath, mainContent)
  }
})
</script>

<style scoped>
/* 隐藏滚动条但保持滚动功能 */
.scrollbar-hide {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;  /* Chrome, Safari, Opera */
}
</style>
