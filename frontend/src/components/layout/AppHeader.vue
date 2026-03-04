<template>
  <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-20 shadow-sm">
    <!-- 左侧：Logo + 折叠按钮 -->
    <div class="flex items-center">
      <!-- Logo区域 -->
      <div class="flex items-center mr-6">
        <!-- 展开状态：显示完整Logo和系统名称 -->
        <template v-if="!collapsed">
          <img src="../../images/logo.png" alt="Logo" class="h-[1.35rem] w-auto object-contain mr-[0.5625rem]" />
          <span class="font-bold text-base tracking-tight text-slate-800 hidden sm:block">成本分析系统</span>
        </template>
        <!-- 折叠状态：显示蓝色Logo -->
        <template v-else>
          <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span class="text-white font-bold text-sm">M</span>
          </div>
        </template>
      </div>

      <!-- 折叠按钮 -->
      <button
        @click="$emit('toggle-sidebar')"
        class="p-2 text-slate-400 hover:text-slate-600 transition-colors duration-200 mr-4"
      >
        <i :class="collapsed ? 'ri-sidebar-unfold-line' : 'ri-sidebar-fold-line'" class="text-xl"></i>
      </button>

      <!-- 分割线 (仅在有门户内容时显示) -->
      <div v-if="layoutStore.isHeaderPortalActive" class="h-6 w-px bg-slate-300 mx-4"></div>

      <!-- 门户插槽（左侧标题） -->
      <div id="header-portal-left" class="flex items-center"></div>
    </div>

    <!-- 右侧：功能图标 -->
    <div class="flex items-center">
      <!-- 门户插槽（右侧操作栏） -->
      <div id="header-portal-right" class="flex items-center"></div>

      <!-- 分割线 (仅在有门户内容时显示) -->
      <div v-if="layoutStore.isHeaderPortalActive" class="h-6 w-px bg-transparent mx-4"></div>

      <div class="flex items-center space-x-2 mr-4">
        <!-- 通知下拉 -->
        <el-dropdown
          trigger="click"
          popper-class="notification-dropdown"
          :teleported="true"
          @visible-change="(visible) => { isNotificationOpen = visible; if (visible) fetchNotifications() }"
        >
          <div
            class="relative cursor-pointer p-2.5 rounded-lg hover:bg-slate-100 transition-all duration-200"
            :class="{ 'bg-slate-100': isNotificationOpen }"
          >
            <i class="ri-notification-3-line text-xl" :class="isNotificationOpen ? 'text-blue-600' : 'text-slate-500'"></i>
            <!-- 未读数量徽章 -->
            <span
              v-if="unreadCount > 0"
              class="absolute top-1.5 right-1.5 min-w-[1.125rem] h-[1.125rem] px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-semibold rounded-full border-2 border-white shadow-sm"
            >
              {{ unreadCount > 99 ? '99+' : unreadCount }}
            </span>
          </div>

          <template #dropdown>
            <div class="w-[360px] bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
              <!-- 头部 -->
              <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-semibold text-slate-800">系统通知</span>
                  <span v-if="unreadCount > 0" class="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-full">
                    {{ unreadCount }} 条新消息
                  </span>
                </div>
                <button
                  v-if="unreadCount > 0"
                  class="text-xs text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1"
                  @click="markAllAsRead"
                >
                  <i class="ri-brush-line"></i>
                  全部已读
                </button>
              </div>

              <!-- 通知列表 -->
              <div class="max-h-[400px] overflow-y-auto notification-list" @scroll="handleScroll">
                <div v-if="loading && currentPage === 1" class="flex items-center justify-center py-8">
                  <el-icon class="animate-spin text-slate-400"><i class="ri-loader-4-line text-xl"></i></el-icon>
                </div>

                <div v-else-if="notificationList.length === 0" class="flex flex-col items-center justify-center py-10 text-center">
                  <div class="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                    <i class="ri-check-double-line text-2xl text-slate-300"></i>
                  </div>
                  <p class="text-sm text-slate-500">暂无通知</p>
                  <p class="text-xs text-slate-400 mt-1">系统消息将在这里显示</p>
                </div>

                <div v-else class="divide-y divide-slate-50">
                  <div
                    v-for="(item, index) in paginatedNotifications"
                    :key="item.id || item.content || index"
                    class="notification-item relative px-4 py-3 cursor-pointer transition-all duration-300 ease"
                    :class="getNotificationItemClass(item)"
                    @click="handleNotificationClick(item)"
                  >
                    <div class="flex items-start gap-3">
                      <div
                        class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        :class="getNotificationClass(item.type).iconBg"
                      >
                        <i :class="[item.icon || getNotificationClass(item.type).icon, getNotificationClass(item.type).iconColor]"></i>
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                          <p class="text-sm font-medium" :class="getNotificationTitleClass(item)">
                            {{ getNotificationTitle(item.type) }}
                          </p>
                          <span
                            v-if="isUnread(item)"
                            class="unread-dot w-1.5 h-1.5 rounded-full"
                            :class="getNotificationClass(item.type).dotColor"
                          ></span>
                        </div>
                        <p class="text-sm leading-relaxed" :class="getNotificationContentClass(item)">
                          {{ item.content }}
                        </p>
                        <p class="text-xs mt-1" :class="isUnread(item) ? 'text-slate-400' : 'text-[#909399]'">
                          {{ item.time }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 加载更多 -->
                <div v-if="hasMoreNotifications" class="py-3 text-center">
                  <button
                    v-if="!loadingMore"
                    class="text-xs text-slate-500 hover:text-blue-600 transition-colors px-4 py-2 rounded-lg hover:bg-slate-100"
                    @click="loadMoreNotifications"
                  >
                    加载更多
                  </button>
                  <el-icon v-else class="animate-spin text-slate-400"><i class="ri-loader-4-line text-lg"></i></el-icon>
                </div>
              </div>

              <!-- 底部 -->
              <div class="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <span class="text-xs text-slate-500">
                  {{ Math.min(displayedCount, notificationCount) }} / {{ notificationCount }} 条
                </span>
                <span v-if="!hasMoreNotifications && notificationCount > 0" class="text-xs text-slate-400">已显示全部</span>
              </div>
            </div>
          </template>
        </el-dropdown>

        <!-- 设置下拉 -->
        <el-dropdown
          trigger="click"
          popper-class="settings-dropdown"
          @visible-change="(visible) => isSettingsOpen = visible"
        >
          <div
            class="cursor-pointer p-2.5 rounded-lg hover:bg-slate-100 transition-all duration-200"
            :class="{ 'bg-slate-100': isSettingsOpen }"
          >
            <i class="ri-settings-3-line text-xl" :class="isSettingsOpen ? 'text-blue-600' : 'text-slate-500'"></i>
          </div>

          <template #dropdown>
            <el-dropdown-menu class="min-w-[160px]">
              <el-dropdown-item @click="goToSystemConfig">
                <div class="flex items-center gap-3 py-1">
                  <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <i class="ri-computer-line text-blue-600"></i>
                  </div>
                  <div>
                    <p class="text-sm font-medium text-slate-800">系统配置</p>
                    <p class="text-xs text-slate-400">全局参数设置</p>
                  </div>
                </div>
              </el-dropdown-item>

              <el-dropdown-item divided @click="goToProfileSettings">
                <div class="flex items-center gap-3 py-1">
                  <div class="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <i class="ri-user-settings-line text-emerald-600"></i>
                  </div>
                  <div>
                    <p class="text-sm font-medium text-slate-800">个人设置</p>
                    <p class="text-xs text-slate-400">账号与偏好</p>
                  </div>
                </div>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import request from '@/utils/request'
import { useLayoutStore } from '@/store/layout'

const router = useRouter()
const layoutStore = useLayoutStore()

const props = defineProps({
  collapsed: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggle-sidebar'])

// 通知相关状态
const notificationCount = ref(0)
const notificationList = ref([])
const loading = ref(false)
const loadingMore = ref(false)
const isNotificationOpen = ref(false)
const isSettingsOpen = ref(false)

// 分页相关
const currentPage = ref(1)
const pageSize = 10
const hasMoreNotifications = ref(false)

// 已读通知ID集合（本地存储）
const readNotificationIds = ref(new Set())

// 未读数量
const unreadCount = computed(() => {
  return notificationList.value.filter(item => !readNotificationIds.value.has(item.id || item.content)).length
})

// 分页显示的通知列表
const paginatedNotifications = computed(() => {
  return notificationList.value.slice(0, currentPage.value * pageSize)
})

// 当前显示条数
const displayedCount = computed(() => {
  return paginatedNotifications.value.length
})

// 智能判断通知类型
const detectNotificationType = (item) => {
  const content = (item.content || '').toLowerCase()

  // 审核退回
  if (content.includes('退回') || content.includes('拒绝') || content.includes('驳回')) {
    return 'rejected'
  }
  // 审核通过
  if (content.includes('通过') || content.includes('批准') || content.includes('已完成')) {
    return 'approved'
  }
  // 待审核
  if (content.includes('待审核') || content.includes('待处理') || content.includes('提交')) {
    return 'review'
  }
  // 警告提醒
  if (content.includes('警告') || content.includes('异常') || content.includes('失败') || content.includes('错误')) {
    return 'warning'
  }
  // 系统通知（默认）
  return item.type || 'system'
}

// 获取通知列表
const fetchNotifications = async () => {
  loading.value = true
  currentPage.value = 1
  try {
    const response = await request.get('/dashboard/recent-activities')
    if (response.success) {
      // 为每条通知添加智能判断的类型
      notificationList.value = (response.data || []).map(item => ({
        ...item,
        type: detectNotificationType(item)
      }))
      notificationCount.value = notificationList.value.length
      // 检查是否还有更多
      hasMoreNotifications.value = notificationList.value.length > pageSize
    }
  } catch (error) {
    // 错误已在UI中提示，无需额外处理
  } finally {
    loading.value = false
  }
}

// 加载更多通知
const loadMoreNotifications = () => {
  if (loadingMore.value) return
  loadingMore.value = true

  // 模拟加载延迟，实际项目中可能是API调用
  setTimeout(() => {
    currentPage.value++
    const totalDisplayed = currentPage.value * pageSize
    hasMoreNotifications.value = notificationCount.value > totalDisplayed
    loadingMore.value = false
  }, 300)
}

// 处理滚动加载
const handleScroll = (e) => {
  const target = e.target
  const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight
  // 滚动到底部附近时自动加载
  if (scrollBottom < 20 && hasMoreNotifications.value && !loadingMore.value) {
    loadMoreNotifications()
  }
}

// 获取通知样式配置
const getNotificationClass = (type) => {
  const config = {
    system: {
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-700',
      dotColor: 'bg-blue-500',
      icon: 'ri-information-line',
      bgHover: 'hover:bg-blue-50/50'
    },
    review: {
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      titleColor: 'text-amber-700',
      dotColor: 'bg-amber-500',
      icon: 'ri-time-line',
      bgHover: 'hover:bg-amber-50/50'
    },
    approved: {
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      titleColor: 'text-emerald-700',
      dotColor: 'bg-emerald-500',
      icon: 'ri-check-double-line',
      bgHover: 'hover:bg-emerald-50/50'
    },
    rejected: {
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      titleColor: 'text-rose-700',
      dotColor: 'bg-rose-500',
      icon: 'ri-close-circle-line',
      bgHover: 'hover:bg-rose-50/50'
    },
    warning: {
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      titleColor: 'text-orange-700',
      dotColor: 'bg-orange-500',
      icon: 'ri-alert-line',
      bgHover: 'hover:bg-orange-50/50'
    },
    default: {
      iconBg: 'bg-slate-50',
      iconColor: 'text-slate-600',
      titleColor: 'text-slate-700',
      dotColor: 'bg-slate-400',
      icon: 'ri-notification-3-line',
      bgHover: 'hover:bg-slate-50'
    }
  }
  return config[type] || config.default
}

// 获取通知标题
const getNotificationTitle = (type) => {
  const titles = {
    system: '系统通知',
    review: '待审核提醒',
    approved: '审核通过',
    rejected: '审核退回',
    warning: '重要提醒'
  }
  return titles[type] || '消息通知'
}

// 判断是否为未读（根据localStorage中的已读记录）
const isUnread = (item) => {
  const id = item.id || item.content
  return !readNotificationIds.value.has(id)
}

// 获取通知项样式类（未读/已读状态）
const getNotificationItemClass = (item) => {
  const unread = isUnread(item)
  const baseClass = getNotificationClass(item.type).bgHover

  if (unread) {
    // 未读状态：保持原有悬停效果
    return baseClass
  } else {
    // 已读状态：透明度降低
    return 'opacity-60 hover:opacity-80'
  }
}

// 获取通知标题样式
const getNotificationTitleClass = (item) => {
  const unread = isUnread(item)
  const colorClass = getNotificationClass(item.type).titleColor

  if (unread) {
    return colorClass
  } else {
    return 'text-[#909399]'
  }
}

// 获取通知内容样式
const getNotificationContentClass = (item) => {
  const unread = isUnread(item)

  if (unread) {
    return 'text-slate-600'
  } else {
    return 'text-[#909399]'
  }
}

// 处理通知点击
const handleNotificationClick = (item) => {
  const id = item.id || item.content
  if (!readNotificationIds.value.has(id)) {
    readNotificationIds.value.add(id)
    saveReadNotifications()
  }

  // 如果通知有跳转链接，可以在这里处理
  // if (item.link) { router.push(item.link) }
}

// 跳转到系统配置
const goToSystemConfig = () => {
  router.push('/config')
}

// 跳转到个人设置
const goToProfileSettings = () => {
  router.push('/profile')
}

// 从localStorage加载已读记录
const loadReadNotifications = () => {
  try {
    const saved = localStorage.getItem('read_notification_ids')
    if (saved) {
      readNotificationIds.value = new Set(JSON.parse(saved))
    }
  } catch (e) {
    // localStorage读取失败，使用默认值
  }
}

// 保存已读记录到localStorage
const saveReadNotifications = () => {
  try {
    localStorage.setItem('read_notification_ids', JSON.stringify([...readNotificationIds.value]))
  } catch (e) {
    // localStorage保存失败，忽略
  }
}

// 标记全部已读
const markAllAsRead = () => {
  // 将所有当前通知ID加入已读集合
  notificationList.value.forEach(item => {
    const id = item.id || item.content
    readNotificationIds.value.add(id)
  })
  // 保存到本地
  saveReadNotifications()
}

// 组件挂载时加载已读记录并获取通知
onMounted(() => {
  loadReadNotifications()
  fetchNotifications()
})
</script>

<style scoped>
/* 通知列表样式 */
.notification-list {
  scroll-behavior: smooth;
}

/* 未读红点动画 - 消失时使用cubic-bezier */
.unread-dot {
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1),
              opacity 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* 通知项点击过渡 */
.notification-item {
  transition: all 300ms ease;
}

/* 已读通知的过渡效果 */
.notification-item.reading {
  animation: fadeToRead 300ms ease forwards;
}

@keyframes fadeToRead {
  from {
    opacity: 1;
  }
  to {
    opacity: 0.6;
  }
}

/* 红点消失动画 */
.notification-item.reading .unread-dot {
  transform: scale(0);
  opacity: 0;
}

/* 支持prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .notification-list {
    scroll-behavior: auto;
  }

  .notification-item,
  .unread-dot {
    transition: none;
    animation: none;
  }

  .notification-item.reading .unread-dot {
    transform: scale(0);
    opacity: 0;
  }
}
</style>
