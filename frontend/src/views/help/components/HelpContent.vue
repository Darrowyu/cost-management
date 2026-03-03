<template>
  <div class="flex gap-8">
    <!-- 目录导航 (桌面端左侧悬浮) -->
    <aside
      v-if="toc.length > 0"
      class="hidden lg:block w-64 flex-shrink-0"
    >
      <div class="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-slate-700">目录</h3>
        </div>
        <nav class="space-y-1 border-l-2 border-slate-200">
          <a
            v-for="item in toc"
            :key="item.id"
            :href="`#${item.id}`"
            :class="[
              'block py-1.5 text-sm transition-colors hover:text-primary-600',
              item.level === 2 ? 'pl-4' : 'pl-8',
              activeHeading === item.id
                ? 'text-primary-600 border-l-2 border-primary-600 -ml-[2px] bg-primary-50/50'
                : 'text-slate-600'
            ]"
            @click.prevent="scrollToHeading(item.id)"
          >
            {{ item.text }}
          </a>
        </nav>
      </div>
    </aside>

    <!-- 移动端目录按钮 -->
    <div
      v-if="toc.length > 0"
      class="lg:hidden fixed bottom-6 right-6 z-50"
    >
      <el-button
        type="primary"
        circle
        size="large"
        @click="showMobileToc = true"
      >
        <i class="ri-list-check text-lg"></i>
      </el-button>
    </div>

    <!-- 移动端目录抽屉 -->
    <el-drawer
      v-model="showMobileToc"
      title="目录"
      size="280px"
      direction="rtl"
      :with-header="true"
    >
      <nav class="space-y-1">
        <a
          v-for="item in toc"
          :key="item.id"
          :href="`#${item.id}`"
          :class="[
            'block py-2 text-sm transition-colors hover:text-primary-600',
            item.level === 2 ? 'pl-2' : 'pl-6',
            activeHeading === item.id ? 'text-primary-600 font-medium' : 'text-slate-600'
          ]"
          @click.prevent="scrollToHeading(item.id); showMobileToc = false"
        >
          {{ item.text }}
        </a>
      </nav>
    </el-drawer>

    <!-- 主内容区域 -->
    <article class="flex-1 min-w-0 max-w-4xl mx-auto lg:mx-0">
      <!-- 加载状态 -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <el-skeleton :rows="10" animated />
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="text-center py-20">
        <i class="ri-error-warning-line text-4xl text-slate-300 mb-4"></i>
        <p class="text-slate-500">{{ error }}</p>
        <el-button type="primary" class="mt-4" @click="$emit('retry')">
          重试
        </el-button>
      </div>

      <!-- 内容 -->
      <div v-else>
        <div ref="contentRef" class="help-markdown-content" v-html="renderedContent"></div>

        <!-- 上一篇/下一篇导航 -->
        <div v-if="navigation.prev || navigation.next" class="mt-12 pt-8 border-t border-slate-200">
          <div class="flex justify-between">
            <div v-if="navigation.prev" class="flex-1">
              <div class="text-xs text-slate-400 mb-1">上一篇</div>
              <a
                :href="navigation.prev.path"
                class="text-primary-600 hover:text-primary-700 flex items-center"
                @click.prevent="navigateToDoc(navigation.prev.path)"
              >
                <i class="ri-arrow-left-line mr-1"></i>
                {{ navigation.prev.title }}
              </a>
            </div>
            <div v-if="navigation.next" class="flex-1 text-right">
              <div class="text-xs text-slate-400 mb-1">下一篇</div>
              <a
                :href="navigation.next.path"
                class="text-primary-600 hover:text-primary-700 flex items-center justify-end"
                @click.prevent="navigateToDoc(navigation.next.path)"
              >
                {{ navigation.next.title }}
                <i class="ri-arrow-right-line ml-1"></i>
              </a>
            </div>
          </div>
        </div>
      </div>
    </article>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { extractTOC } from '@/utils/markdownRenderer.js'

const props = defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  renderedContent: { type: String, required: true },
  rawContent: { type: String, default: '' }, // 原始 Markdown 内容
  navigation: {
    type: Object,
    default: () => ({ prev: null, next: null })
  }
})

const emit = defineEmits(['retry', 'navigate'])

// 目录数据
const toc = computed(() => extractTOC(props.rawContent))

// 移动端目录显示状态
const showMobileToc = ref(false)

// 当前激活的标题
const activeHeading = ref('')
const contentRef = ref(null)

// 滚动到指定标题
const scrollToHeading = (id) => {
  const element = document.getElementById(id)
  if (element) {
    const offset = 80 // 顶部偏移量
    const elementPosition = element.getBoundingClientRect().top + window.scrollY
    window.scrollTo({
      top: elementPosition - offset,
      behavior: 'smooth'
    })
    activeHeading.value = id
  }
}

// 导航到文档，通知父组件处理
const navigateToDoc = (path) => {
  emit('navigate', path)
}

// 监听滚动更新当前激活的标题
let observer = null

const setupIntersectionObserver = () => {
  if (!contentRef.value) return

  const headings = contentRef.value.querySelectorAll('h2[id], h3[id]')
  if (headings.length === 0) return

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          activeHeading.value = entry.target.id
        }
      })
    },
    {
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0
    }
  )

  headings.forEach((heading) => observer.observe(heading))
}

// 监听内容变化，重新设置观察器
watch(() => props.renderedContent, () => {
  if (observer) {
    observer.disconnect()
  }
  setTimeout(setupIntersectionObserver, 100)
})

onMounted(() => {
  setupIntersectionObserver()
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
})
</script>

<style>
/* 代码块样式 - 浅色背景高对比度，强制覆盖深色主题 */
.help-markdown-content pre {
  background: #f6f8fa !important;
  border: 1px solid #e1e4e8 !important;
  border-radius: 8px !important;
  padding: 16px !important;
  overflow-x: auto !important;
  margin: 16px 0 !important;
  color: #24292e !important;
}

.help-markdown-content pre code {
  background: transparent !important;
  color: #24292e !important;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace !important;
  font-size: 14px !important;
  line-height: 1.6 !important;
  display: block !important;
  padding: 0 !important;
}

/* 代码关键字高亮 - GitHub风格浅色主题 */
.help-markdown-content .hljs-keyword,
.help-markdown-content pre .hljs-keyword {
  color: #d73a49 !important;
  font-weight: 600 !important;
}

.help-markdown-content .hljs-string,
.help-markdown-content pre .hljs-string {
  color: #032f62 !important;
}

.help-markdown-content .hljs-number,
.help-markdown-content .hljs-literal,
.help-markdown-content pre .hljs-number,
.help-markdown-content pre .hljs-literal {
  color: #005cc5 !important;
}

.help-markdown-content .hljs-comment,
.help-markdown-content pre .hljs-comment {
  color: #6a737d !important;
  font-style: italic !important;
}

.help-markdown-content .hljs-function,
.help-markdown-content pre .hljs-function {
  color: #6f42c1 !important;
}

.help-markdown-content .hljs-variable,
.help-markdown-content .hljs-params,
.help-markdown-content pre .hljs-variable,
.help-markdown-content pre .hljs-params {
  color: #e36209 !important;
}

.help-markdown-content .hljs-operator,
.help-markdown-content pre .hljs-operator {
  color: #d73a49 !important;
}

.help-markdown-content .hljs-punctuation,
.help-markdown-content pre .hljs-punctuation {
  color: #24292e !important;
}

.help-markdown-content .hljs-attr,
.help-markdown-content pre .hljs-attr {
  color: #005cc5 !important;
}

.help-markdown-content .hljs-tag,
.help-markdown-content pre .hljs-tag {
  color: #22863a !important;
}

/* 行内代码 */
.help-markdown-content code:not(pre code) {
  background: rgba(175, 184, 193, 0.2) !important;
  color: #24292e !important;
  padding: 0.2em 0.4em !important;
  border-radius: 3px !important;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace !important;
  font-size: 85% !important;
}

/* 标题锚点样式 - 移除 hover 时的 # 符号 */

/* 滚动偏移量，防止被固定导航遮挡 */
.scroll-mt-20 {
  scroll-margin-top: 5rem;
}

/* 基础标题样式 */
.help-markdown-content h1 {
  font-size: 1.875rem;
  font-weight: 700;
  margin-top: 2rem;
  margin-bottom: 1rem;
  color: #1e293b;
}
.help-markdown-content h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  color: #1e293b;
}
.help-markdown-content h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  color: #1e293b;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-left: 4px solid #3b82f6;
  border-radius: 0 8px 8px 0;
}

.help-markdown-content h3 a {
  color: #1e293b;
  font-weight: 600;
}

.help-markdown-content h3 a:hover {
  color: #3b82f6;
  text-decoration: none;
}

.help-markdown-content h3 + p {
  margin-top: 0.5rem;
  padding-left: 1rem;
  color: #64748b;
}
.help-markdown-content p {
  margin-top: 1rem;
  margin-bottom: 1rem;
  color: #475569;
  line-height: 1.625;
}
.help-markdown-content ul {
  list-style-type: none;
  margin-top: 1rem;
  margin-bottom: 1rem;
  padding-left: 0;
  color: #475569;
}

.help-markdown-content ul li {
  padding-left: 0;
  margin-bottom: 0.5rem;
}
.help-markdown-content ol {
  list-style-type: decimal;
  list-style-position: outside;
  margin-top: 1rem;
  margin-bottom: 1rem;
  padding-left: 1.5rem;
  color: #475569;
}
.help-markdown-content li {
  color: #475569;
}
.help-markdown-content a {
  color: #2563eb;
  text-decoration: none;
}
.help-markdown-content a:hover {
  color: #1d4ed8;
  text-decoration: underline;
}
.help-markdown-content table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #e2e8f0;
  margin-top: 1rem;
  margin-bottom: 1rem;
}
.help-markdown-content th {
  background-color: #f8fafc;
  font-weight: 600;
  color: #334155;
  padding: 0.75rem;
  text-align: left;
  border: 1px solid #e2e8f0;
}
.help-markdown-content td {
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  color: #475569;
}
.help-markdown-content tr {
  border-bottom: 1px solid #e2e8f0;
}

/* 代码块内的 hljs 样式覆盖 */
.help-markdown-content .hljs {
  background: transparent;
}

.help-markdown-content blockquote {
  border-left: 4px solid #60a5fa;
  background-color: rgba(239, 246, 255, 0.5);
  padding-left: 1rem;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  margin-top: 1rem;
  margin-bottom: 1rem;
  font-style: italic;
  color: #475569;
}

/* 截图位置标记样式 */
.help-markdown-content .screenshot-placeholder {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: #fef3c7;
  border: 1px dashed #f59e0b;
  border-radius: 6px;
  padding: 8px 12px;
  margin: 12px 0;
  color: #92400e;
  font-size: 14px;
}

.help-markdown-content .screenshot-icon {
  font-size: 16px;
}

.help-markdown-content .screenshot-text {
  color: #78350f;
}
</style>
