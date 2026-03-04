  <template>
  <div class="animate-fade-in">
    <CostPageHeader title="仪表盘">
       <template #actions>
        <el-button link type="primary" @click="handleRefresh" :loading="refreshing">
          <i class="ri-refresh-line mr-1"></i>刷新页面数据
        </el-button>
      </template>
    </CostPageHeader>

    <!-- 问候语区域 -->
    <div class="greeting-card group">
      <!-- 装饰背景 -->
      <div class="absolute inset-0 bg-gradient-to-br from-slate-50/50 to-blue-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      <i class="ri-calendar-check-line absolute -right-4 -bottom-4 text-6xl sm:text-8xl text-slate-100/60 pointer-events-none z-0"></i>
      
      <!-- 左侧装饰条 -->
      <div class="absolute left-0 top-4 bottom-4 sm:top-5 sm:bottom-5 w-1 bg-blue-500 rounded-r-full"></div>

      <!-- 左侧文案 -->
      <div class="relative z-10 pl-4 sm:pl-5 flex-1 min-w-0">
        <h1 class="text-lg sm:text-2xl font-bold text-slate-800 mb-1 sm:mb-1.5 tracking-tight truncate">
          {{ greeting }}
        </h1>
        <p class="text-slate-500 flex items-center text-xs sm:text-sm">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2 flex-shrink-0"></span>
          <span class="truncate">{{ subGreeting }}</span>
        </p>
      </div>

      <!-- 右侧日期排版 -->
      <div class="relative z-10 text-right flex-shrink-0 hidden sm:block">
        <div class="flex items-baseline justify-end leading-none text-slate-700">
          <span class="text-3xl font-extrabold tracking-tighter mr-0.5 text-slate-800">{{ dateDay }}</span>
          <span class="text-2xl font-light text-slate-300 mx-1">/</span>
          <span class="text-xl font-semibold text-slate-500">{{ dateMonth }}</span>
        </div>
        <div class="text-xs font-medium text-slate-400 mt-1.5 tracking-wider">
          {{ currentWeekDayCN }}
        </div>
      </div>
    </div>

    <!-- 统计卡片区域 -->
    <StatCards :stats="stats" :regulations="regulations" />

    <!-- 快捷导航与系统概况 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      <!-- 快捷导航 -->
      <div class="lg:col-span-2 section-card">
        <div class="section-header">
          <div class="section-icon bg-amber-500">
            <i class="ri-flashlight-line text-white text-sm"></i>
          </div>
          <h2 class="section-title">快捷导航</h2>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <QuickNavButton
            v-for="(nav, index) in quickNavList"
            :key="nav.key"
            :icon="nav.icon"
            :icon-bg-color="nav.iconBgColor"
            :icon-color="nav.iconColor"
            :label="nav.label"
            :badge="nav.key === 'review-pending' ? pendingCount : 0"
            :show-delete="true"
            @click="router.push(nav.route)"
            @delete="confirmRemoveQuickNav(index, nav.label)"
          />
          <!-- 添加按钮 -->
          <QuickNavButton
            v-if="quickNavList.length < 4"
            icon="ri-add-line"
            :is-dashed="true"
            label="添加"
            @click="showNavSelector = true"
          />
        </div>
      </div>

      <!-- 系统概况（仅管理员可见） -->
      <div v-if="isAdmin" class="section-card">
        <div class="section-header mb-4">
          <div class="section-icon bg-slate-600">
            <i class="ri-dashboard-3-line text-white text-sm"></i>
          </div>
          <h2 class="section-title">系统概况</h2>
        </div>
        <div class="space-y-4">
          <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div class="flex items-center">
              <i class="ri-database-line text-slate-400 mr-3"></i>
              <span class="text-sm text-slate-600">数据库状态</span>
            </div>
            <span class="flex items-center text-xs font-medium text-green-600">
              <span class="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              {{ systemStatus.database === 'normal' ? '正常' : '异常' }}
            </span>
          </div>
          <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div class="flex items-center">
              <i class="ri-shield-check-line text-slate-400 mr-3"></i>
              <span class="text-sm text-slate-600">最近备份</span>
            </div>
            <span class="text-xs text-slate-500">{{ systemStatus.lastBackup }}</span>
          </div>
          <div class="mt-4 pt-4 border-t border-slate-100">
            <p class="text-xs text-slate-400 text-center">{{ systemStatus.version }}</p>
          </div>
        </div>
      </div>

      <!-- 系统通知（非管理员可见） -->
      <div v-else class="section-card">
        <div class="section-header mb-4">
          <div class="section-icon bg-blue-500">
            <i class="ri-notification-3-line text-white text-sm"></i>
          </div>
          <h2 class="section-title">系统通知</h2>
        </div>
        <div class="space-y-3 h-[140px] overflow-y-auto pr-2 custom-scrollbar">
          <div v-if="recentActivities.length === 0" class="text-center text-slate-400 py-6 h-full flex flex-col justify-center items-center">
            <i class="ri-inbox-line text-3xl mb-2"></i>
            <p class="text-sm">暂无通知</p>
          </div>
          <div
            v-for="(activity, index) in recentActivitiesWithType"
            :key="index"
            class="flex items-start p-3 rounded-lg transition-colors"
            :class="getNotificationClass(activity.type).bg"
          >
            <div
              class="w-8 h-8 rounded-lg flex items-center justify-center mr-3 flex-shrink-0 mt-0.5"
              :class="getNotificationClass(activity.type).iconBg"
            >
              <i :class="[activity.icon || getNotificationClass(activity.type).icon, 'text-sm', getNotificationClass(activity.type).iconColor]"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 mb-0.5">
                <p class="text-xs font-medium" :class="getNotificationClass(activity.type).titleColor">
                  {{ getNotificationTitle(activity.type) }}
                </p>
              </div>
              <p class="text-xs text-slate-600 whitespace-normal break-words leading-relaxed">{{ activity.content }}</p>
              <p class="text-xs text-slate-400 mt-1">{{ activity.time }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 快捷导航选择弹窗 -->
    <el-dialog 
      v-model="showNavSelector" 
      width="700px" 
      align-center
      append-to-body
      :show-close="false"
      class="quick-nav-dialog"
    >
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <div class="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center mr-3">
              <i class="ri-apps-line text-primary-600"></i>
            </div>
            <span class="text-lg font-semibold text-slate-800">添加快捷导航</span>
          </div>
          <button @click="showNavSelector = false" class="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
            <i class="ri-close-line text-slate-400 text-xl"></i>
          </button>
        </div>
      </template>
      <p class="text-sm text-slate-500 mb-4">选择要添加到快捷导航的功能</p>
      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="option in availableNavOptions"
          :key="option.key"
          @click="addQuickNav(option)"
          class="flex items-center p-4 border border-slate-200 rounded-xl cursor-pointer hover:border-primary-400 hover:bg-primary-50 hover:shadow-sm transition-all group"
        >
          <div :class="['w-10 h-10 rounded-xl flex items-center justify-center mr-3 transition-transform group-hover:scale-110', option.iconBgColor]">
            <i :class="[option.icon, 'text-xl', option.iconColor]"></i>
          </div>
          <span class="text-sm font-medium text-slate-700 group-hover:text-primary-700">{{ option.label }}</span>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end">
          <el-button @click="showNavSelector = false" round>取消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 图表区域 -->
    <ChartSection :weeklyQuotations="weeklyQuotations" :topModels="topModels" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useAuthStore } from '../store/auth'
import { useReviewStore } from '../store/review'
import { getTimeGreeting } from '../utils/greeting'
import request from '../utils/request'
import logger from '../utils/logger'
import QuickNavButton from '../components/dashboard/QuickNavButton.vue'
import StatCards from '../components/dashboard/StatCards.vue'
import ChartSection from '../components/dashboard/ChartSection.vue'
import CostPageHeader from '../components/cost/CostPageHeader.vue'

const router = useRouter()
const authStore = useAuthStore()
const reviewStore = useReviewStore()

// 待审核数量
const pendingCount = ref(0)

// 权限检查
const isAdmin = computed(() => authStore.hasPermission?.('system:admin') ?? authStore.user?.role === 'admin')
const canReview = computed(() => authStore.hasPermission('review:approve'))
const canCreateCost = computed(() => authStore.hasPermission('cost:create'))

// 最近操作记录（非管理员显示）
const recentActivities = ref([])
// 刷新状态
const refreshing = ref(false)

// 问候语
const greeting = computed(() => {
  const userName = authStore.realName || authStore.username || '用户'
  return `${getTimeGreeting()}，${userName}`
})

// 副问候语
const subGreeting = computed(() => {
  const hour = new Date().getHours()
  if (hour >= 18 || hour < 6) {
    return '系统检测到当前为下班时间段，请注意保存工作~'
  }
  return '欢迎回来，今天又是高效工作的一天~'
})

// 统计数据
const stats = ref({
  totalCostRecords: 0,
  pendingReview: 0,
  approved: 0,
  returned: 0
})

// 型号排行
const topModels = ref([])

// 周报价数据
const weeklyQuotations = ref({
  thisMonth: [0, 0, 0, 0],
  lastMonth: [0, 0, 0, 0]
})

// 法规总览
const regulations = ref([])

// 日期相关
const daysCN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const dateDay = computed(() => String(new Date().getDate()).padStart(2, '0'))
const dateMonth = computed(() => String(new Date().getMonth() + 1).padStart(2, '0'))
const currentWeekDayCN = computed(() => daysCN[new Date().getDay()])

// 系统状态
const systemStatus = ref({
  database: 'normal',
  lastBackup: '今日 02:00',
  version: 'Version 1.0'
})

// 快捷导航配置 - 基于用户ID存储
const getStorageKey = () => {
  const userId = authStore.user?.id || 'guest'
  return `dashboard_quick_nav_${userId}`
}

// 所有可选的导航选项 - 使用权限码控制
const allNavOptions = [
  { key: 'cost-add', label: '新增成本分析', icon: 'ri-add-line', iconBgColor: 'bg-blue-100', iconColor: 'text-primary-600', route: '/cost/add', permission: 'cost:create' },
  { key: 'cost-standard', label: '标准成本', icon: 'ri-file-list-3-line', iconBgColor: 'bg-purple-100', iconColor: 'text-purple-600', route: '/cost/standard', permission: 'cost:view' },
  { key: 'cost-records', label: '成本记录', icon: 'ri-history-line', iconBgColor: 'bg-green-100', iconColor: 'text-green-600', route: '/cost/records', permission: 'cost:view' },
  { key: 'review-pending', label: '待审核', icon: 'ri-time-line', iconBgColor: 'bg-orange-100', iconColor: 'text-orange-600', route: '/review/pending', permission: 'review:view' },
  { key: 'review-approved', label: '已审核', icon: 'ri-checkbox-circle-line', iconBgColor: 'bg-teal-100', iconColor: 'text-teal-600', route: '/review/approved', permission: 'review:view' },
  { key: 'materials', label: '原料管理', icon: 'ri-database-2-line', iconBgColor: 'bg-indigo-100', iconColor: 'text-indigo-600', route: '/materials', permission: 'master:material:view' },
  { key: 'packaging', label: '包材管理', icon: 'ri-box-3-line', iconBgColor: 'bg-cyan-100', iconColor: 'text-cyan-600', route: '/packaging', permission: 'master:packaging:view' },
  { key: 'processes', label: '工序管理', icon: 'ri-settings-4-line', iconBgColor: 'bg-rose-100', iconColor: 'text-rose-600', route: '/processes', permission: 'master:process:view' },
  { key: 'models', label: '型号管理', icon: 'ri-layout-grid-line', iconBgColor: 'bg-pink-100', iconColor: 'text-pink-600', route: '/models', permission: 'master:model:view' },
  { key: 'regulations', label: '法规管理', icon: 'ri-government-line', iconBgColor: 'bg-amber-100', iconColor: 'text-amber-600', route: '/regulations', permission: 'master:regulation:view' },
  { key: 'customers', label: '客户管理', icon: 'ri-user-3-line', iconBgColor: 'bg-lime-100', iconColor: 'text-lime-600', route: '/customers', permission: 'master:customer:view' }
]

// 当前快捷导航列表
const quickNavList = ref([])

// 弹窗显示状态
const showNavSelector = ref(false)

// 可添加的导航选项（排除已添加的，并根据权限过滤）
const availableNavOptions = computed(() => {
  const addedKeys = quickNavList.value.map(n => n.key)
  return allNavOptions.filter(opt => {
    if (addedKeys.includes(opt.key)) return false
    if (opt.permission && !authStore.hasPermission(opt.permission)) return false
    return true
  })
})

// 从 localStorage 加载快捷导航
const loadQuickNav = () => {
  try {
    const saved = localStorage.getItem(getStorageKey())
    if (saved) {
      const keys = JSON.parse(saved)
      quickNavList.value = keys.map(key => allNavOptions.find(opt => opt.key === key)).filter(Boolean)
    } else {
      // 默认显示两个
      quickNavList.value = [
        allNavOptions.find(opt => opt.key === 'cost-add'),
        allNavOptions.find(opt => opt.key === 'cost-standard')
      ].filter(Boolean)
    }
  } catch {
    quickNavList.value = []
  }
}

// 保存快捷导航到 localStorage
const saveQuickNav = () => {
  const keys = quickNavList.value.map(n => n.key)
  localStorage.setItem(getStorageKey(), JSON.stringify(keys))
}

// 添加快捷导航
const addQuickNav = (option) => {
  if (quickNavList.value.length < 4) {
    quickNavList.value.push(option)
    saveQuickNav()
  }
  showNavSelector.value = false
}

// 删除快捷导航
const removeQuickNav = (index) => {
  quickNavList.value.splice(index, 1)
  saveQuickNav()
}

// 确认删除快捷导航
const confirmRemoveQuickNav = async (index, label) => {
  try {
    await ElMessageBox.confirm(`确定要删除快捷方式「${label}」吗？`, '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消'
    })
    removeQuickNav(index)
  } catch {
    // 用户取消
  }
}

// 加载仪表盘数据
const loadDashboardData = async () => {
  try {
    // 并行请求所有数据
    const [statsRes, regulationsRes, topModelsRes, weeklyRes] = await Promise.all([
      request.get('/dashboard/stats'),
      request.get('/dashboard/regulations'),
      request.get('/dashboard/top-models'),
      request.get('/dashboard/weekly-quotations')
    ])

    // 统计数据
    if (statsRes.success) {
      if (statsRes.data.totalCostRecords !== undefined) {
         // 新版统计 (业务员/审核员)
         stats.value = {
            totalCostRecords: statsRes.data.totalCostRecords || 0,
            pendingReview: statsRes.data.pendingReview || 0,
            approved: statsRes.data.approved || 0,
            returned: statsRes.data.returned || 0
         }
      } else if (statsRes.data.packagingCount !== undefined) {
         // 采购/生产 (基础数据统计)
         stats.value = {
            activeMaterials: statsRes.data.activeMaterials || 0,
            activeModels: statsRes.data.activeModels || 0,
            materialsLastUpdated: statsRes.data.materialsLastUpdated,
            packagingCount: statsRes.data.packagingCount || 0,
            processCount: statsRes.data.processCount || 0
         }
      } else {
         // 管理员 (运营统计)
         stats.value = {
            monthlyQuotations: statsRes.data.monthlyQuotations || 0,
            activeMaterials: statsRes.data.activeMaterials || 0,
            activeModels: statsRes.data.activeModels || 0,
            growthRate: statsRes.data.growthRate,
            materialsLastUpdated: statsRes.data.materialsLastUpdated
         }
      }
    }

    // 法规总览 (主要用于旧版)
    if (regulationsRes.success) {
      regulations.value = regulationsRes.data || []
    }

    // 型号排行
    if (topModelsRes.success) {
      topModels.value = topModelsRes.data || []
    }

    // 周报价数据
    if (weeklyRes.success) {
      weeklyQuotations.value = {
        thisMonth: weeklyRes.data.thisMonth || [0, 0, 0, 0],
        lastMonth: weeklyRes.data.lastMonth || [0, 0, 0, 0]
      }
    }

    // 获取待审核数量（有审核权限才调用）
    if (authStore.hasPermission('review:view')) {
      pendingCount.value = await reviewStore.fetchPendingCount()
    }

    // 非管理员加载最近操作记录
    if (!isAdmin.value) {
      await loadRecentActivities()
    }
  } catch (err) {
    logger.error('加载仪表盘数据失败:', err)
  }
}

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

// 获取通知样式配置
const getNotificationClass = (type) => {
  const config = {
    system: {
      bg: 'bg-blue-50/60',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-700',
      dotColor: 'bg-blue-500',
      icon: 'ri-information-line'
    },
    review: {
      bg: 'bg-amber-50/60',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      titleColor: 'text-amber-700',
      dotColor: 'bg-amber-500',
      icon: 'ri-time-line'
    },
    approved: {
      bg: 'bg-emerald-50/60',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      titleColor: 'text-emerald-700',
      dotColor: 'bg-emerald-500',
      icon: 'ri-check-double-line'
    },
    rejected: {
      bg: 'bg-rose-50/60',
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
      titleColor: 'text-rose-700',
      dotColor: 'bg-rose-500',
      icon: 'ri-close-circle-line'
    },
    warning: {
      bg: 'bg-orange-50/60',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      titleColor: 'text-orange-700',
      dotColor: 'bg-orange-500',
      icon: 'ri-alert-line'
    },
    default: {
      bg: 'bg-slate-50',
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-600',
      titleColor: 'text-slate-700',
      dotColor: 'bg-slate-400',
      icon: 'ri-notification-3-line'
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


// 带类型的通知列表
const recentActivitiesWithType = computed(() => {
  return recentActivities.value.map(item => ({
    ...item,
    type: detectNotificationType(item)
  }))
})

// 加载最近操作记录
const loadRecentActivities = async () => {
  try {
    const res = await request.get('/dashboard/recent-activities')
    if (res.success) {
      recentActivities.value = res.data || []
    }
  } catch (err) {
    logger.error('加载最近操作失败:', err)
  }
}

// 刷新数据
const handleRefresh = async () => {
  refreshing.value = true
  try {
    await loadDashboardData()
  } finally {
    // 延迟一点结束loading，让用户感知到刷新
    setTimeout(() => {
      refreshing.value = false
    }, 500)
  }
}

onMounted(() => {
  loadDashboardData()
  loadQuickNav()
})
</script>

<style scoped>
.greeting-card {
  @apply bg-white rounded-xl p-4 sm:p-6 border border-slate-200 mb-4 sm:mb-6 relative overflow-hidden flex items-center justify-between;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}
.greeting-card:hover {
  @apply border-slate-300;
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.06);
}

.section-card {
  @apply bg-white rounded-xl border border-slate-200 p-4 sm:p-5;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}
.section-card:hover {
  @apply border-slate-300;
  box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.05);
}

.section-header {
  @apply flex items-center mb-4 sm:mb-5;
}
.section-icon {
  @apply w-7 h-7 rounded-lg flex items-center justify-center mr-2.5 shadow-sm;
}
.section-title {
  @apply text-base font-semibold text-slate-800;
}
</style>

<style>
/* 快捷导航弹窗样式 */
.quick-nav-dialog .el-dialog {
  border-radius: 16px;
  overflow: hidden;
}
.quick-nav-dialog .el-dialog__header {
  padding: 20px 24px 12px;
  margin: 0;
}
.quick-nav-dialog .el-dialog__body {
  padding: 0 24px 16px;
}
.quick-nav-dialog .el-dialog__footer {
  padding: 12px 24px 20px;
  border-top: 1px solid #f1f5f9;
}
</style>
