<template>
  <aside :class="[
    'bg-white border-r border-slate-200 flex flex-col shadow-sm z-10 transition-all duration-300 h-full',
    mobile ? 'w-full' : (props.collapsed ? 'w-16' : 'w-64')
  ]">
    <!-- Logo区域 (已移至顶部栏，此处保留空白或移动端兼容) -->
    <div v-if="mobile" class="h-16 flex items-center justify-between px-4 border-b border-slate-100">
      <span class="font-semibold text-slate-800">导航菜单</span>
      <i @click="$emit('close')" class="ri-close-line text-xl text-slate-400 cursor-pointer"></i>
    </div>

    <!-- 菜单列表 -->
    <nav class="flex-1 overflow-y-auto py-4 px-2 space-y-1">
      <template v-for="(item, index) in visibleMenuItems" :key="item.id || `divider-${index}`">
        
        <!-- 分割线 (Divider) -->
        <div v-if="item.type === 'divider'" class="flex items-center px-3 py-2 mt-3 mb-1">
          <template v-if="props.collapsed">
            <!-- 折叠时只显示横线 -->
            <div class="h-px bg-slate-200 w-full"></div>
          </template>
          <template v-else>
            <!-- 
              ★ 调节分割线文字大小 ★
              text-[10px] = 10像素，可改为 text-xs (12px)、text-[11px] 等
            -->
            <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-2">{{ item.label }}</span>
            <div class="h-px bg-slate-200 flex-1"></div>
          </template>
        </div>

        <!-- 无子菜单 -->
        <div 
          v-else-if="!item.children"
          @click="handleMenuClick(item)"
          :title="props.collapsed ? item.label : ''"
          :class="[
            'flex items-center rounded-lg cursor-pointer transition-colors group mb-1',
            props.collapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2.5',
            isActive(item.id) 
              ? 'bg-primary-50 text-primary-700 font-medium' 
              : 'text-slate-800 hover:bg-slate-50 hover:text-slate-900'
          ]"
        >
          <i :class="[
            item.icon, 
            'text-xl transition-colors',
            props.collapsed ? '' : 'mr-3',
            isActive(item.id) ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600'
          ]"></i>
          <span v-if="!props.collapsed" class="text-sm">{{ item.label }}</span>
        </div>

        <!-- 有子菜单 -->
        <div v-else>
          <div 
            @click="props.collapsed ? handleMenuClick(item.children[0]) : toggleSubmenu(item.id)"
            :title="props.collapsed ? item.label : ''"
            :class="[
              'flex items-center rounded-lg cursor-pointer transition-colors group mb-1 relative',
              props.collapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2.5 justify-between',
              isSubmenuActive(item) ? 'bg-white text-slate-800' : 'text-slate-800 hover:bg-slate-50 hover:text-slate-900'
            ]"
          >
            <div class="flex items-center" :class="props.collapsed ? 'justify-center' : ''">
              <i :class="[item.icon, 'text-xl text-slate-400 group-hover:text-slate-600', props.collapsed ? '' : 'mr-3']"></i>
              <span v-if="!props.collapsed" class="text-sm font-medium">{{ item.label }}</span>
              <!-- 审核管理菜单的红色气泡（折叠时显示在图标旁） -->
              <span 
                v-if="item.id === 'review' && pendingCount > 0 && props.collapsed"
                class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-medium w-4 h-4 rounded-full flex items-center justify-center"
              >
                {{ pendingCount > 9 ? '!' : pendingCount }}
              </span>
            </div>
            <div v-if="!props.collapsed" class="flex items-center">
              <!-- 审核管理菜单的红色气泡（展开时显示在箭头旁） -->
              <span 
                v-if="item.id === 'review' && pendingCount > 0 && !expandedMenus.includes(item.id)"
                class="bg-red-500 text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[18px] text-center mr-2"
              >
                {{ pendingCount > 99 ? '99+' : pendingCount }}
              </span>
              <i :class="[
                'ri-arrow-down-s-line transition-transform duration-200 text-slate-400',
                expandedMenus.includes(item.id) ? 'rotate-180' : ''
              ]"></i>
            </div>
          </div>
          
          <!-- 子菜单项 -->
          <Transition name="submenu">
            <div v-if="!props.collapsed" v-show="expandedMenus.includes(item.id)" class="pl-6 pr-2 space-y-1 mb-2">
              <div 
                v-for="sub in item.children" 
                :key="sub.id"
                @click="handleMenuClick(sub)"
                :class="[
                  'flex items-center text-sm py-2 px-3 rounded-md cursor-pointer transition-colors relative',
                  isActive(sub.id) 
                    ? 'text-primary-600 bg-primary-50 font-medium' 
                    : 'text-slate-800 hover:text-slate-900 hover:bg-slate-50'
                ]"
              >
                <i v-if="sub.icon" :class="[sub.icon, 'text-base mr-2', isActive(sub.id) ? 'text-primary-500' : 'text-slate-400']"></i>
                {{ sub.label }}
                <!-- 待审核数量红色气泡 -->
                <span 
                  v-if="sub.id === 'review_pending' && pendingCount > 0"
                  class="absolute right-2 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                >
                  {{ pendingCount > 99 ? '99+' : pendingCount }}
                </span>
              </div>
            </div>
          </Transition>
        </div>
      </template>
    </nav>

    <!-- 底部用户信息 -->
    <div class="p-3 border-t border-slate-100">
      <div :class="[
        'flex items-center p-2 rounded-lg hover:bg-slate-50 transition-colors',
        props.collapsed ? 'justify-center' : 'justify-between'
      ]">
        <!-- 头像（仅展开时显示） -->
        <div 
          v-if="!props.collapsed"
          class="user-avatar flex-shrink-0 mr-3"
          :style="{ backgroundColor: getRoleColor(authStore.userRole) }"
        >
          {{ getInitial(authStore.realName) }}
        </div>
        <div v-if="!props.collapsed" class="overflow-hidden flex-1">
          <p class="text-sm font-medium text-slate-700 truncate">{{ userName }}</p>
          <p class="text-xs text-slate-400 truncate">{{ roleName }}</p>
        </div>
        <i 
          @click="handleLogout"
          class="ri-logout-box-r-line text-slate-400 hover:text-red-500 cursor-pointer transition-colors text-xl"
          title="退出登录"
        ></i>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../store/auth'
import { useReviewStore } from '../../store/review'
import { useMenu } from '../../composables/useMenu'
import { ElMessageBox, ElMessage } from 'element-plus'
import { getRoleName } from '../../config/menuConfig'

const props = defineProps({
  mobile: { type: Boolean, default: false },
  collapsed: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'toggle-collapse'])

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const reviewStore = useReviewStore()
const { menu, fetchMenu, findMenuItem } = useMenu()

// 展开的菜单
const expandedMenus = ref([])

// 根据当前路由自动展开对应的父菜单
const expandMenuByRoute = () => {
  const currentPath = route.path
  
  for (const item of visibleMenuItems.value) {
    if (item.children && item.children.length > 0) {
      // 检查当前路由是否匹配该父菜单下的任意子菜单
      const hasActiveChild = item.children.some(sub => {
        if (sub.route) {
          const [subPath] = sub.route.split('?')
          if (currentPath === subPath) return true
          // 处理子路由匹配（如 /cost/add 匹配 /cost）
          if (subPath && currentPath.startsWith(subPath + '/')) return true
        }
        return false
      })
      
      // 检查父菜单本身是否激活
      const isParentActive = item.route && (
        currentPath === item.route || 
        currentPath.startsWith(item.route + '/')
      )
      
      if (hasActiveChild || isParentActive) {
        if (!expandedMenus.value.includes(item.id)) {
          expandedMenus.value.push(item.id)
        }
      }
    }
  }
}

// 待审核数量
const pendingCount = computed(() => reviewStore.pendingPagination.total)

// 加载待审核数量
const loadPendingCount = async () => {
  // 检查是否有审核查看权限
  if (authStore.hasPermission('review:view')) {
    await reviewStore.fetchPendingCount()
  }
}

// 组件挂载时加载菜单和待审核数量
onMounted(() => {
  fetchMenu().then(() => {
    // 菜单加载完成后，根据当前路由展开对应菜单
    expandMenuByRoute()
  })
  loadPendingCount()
})

// 监听用户变化（重新登录后），刷新菜单和权限
watch(() => authStore.user?.id, (newUserId, oldUserId) => {
  if (newUserId && newUserId !== oldUserId) {
    fetchMenu().then(() => {
      expandMenuByRoute()
    })
    loadPendingCount()
  }
})

// 监听路由变化，刷新待审核数量和菜单展开状态
watch(() => route.path, () => {
  if (route.path.includes('/review')) {
    loadPendingCount()
  }
  // 路由变化时展开对应的父菜单
  expandMenuByRoute()
})

// 用户信息
const userName = computed(() => authStore.realName || authStore.username || '未知用户')
const roleName = computed(() => getRoleName(authStore.userRole))

// 使用后端返回的动态菜单（保持响应性）
const visibleMenuItems = computed(() => menu.value)

// 切换折叠状态
const toggleCollapse = () => {
  emit('toggle-collapse')
}

// 判断菜单是否激活
const isActive = (menuId) => {
  const currentPath = route.path
  const currentQuery = route.query
  const item = findMenuItem(menuId)
  if (item?.route) {
    // 处理带查询参数的路由
    if (item.route.includes('?')) {
      const [path, queryStr] = item.route.split('?')
      if (currentPath !== path) return false
      const params = new URLSearchParams(queryStr)
      for (const [key, value] of params) {
        if (currentQuery[key] !== value) return false
      }
      return true
    }
    // 普通路由匹配（排除带mode参数的情况）
    if (currentPath === item.route) {
      return !currentQuery.mode // 只有没有mode参数时才匹配普通新增成本分析
    }
    // 只有子菜单的父菜单才用 startsWith 匹配，避免同级路由误判
    if (item.children && currentPath.startsWith(item.route + '/')) {
      return true
    }
  }
  return false
}

// 判断子菜单是否有激活项
const isSubmenuActive = (item) => {
  if (!item.children) return false
  return item.children.some(sub => isActive(sub.id))
}

// 切换子菜单展开状态
const toggleSubmenu = (menuId) => {
  const index = expandedMenus.value.indexOf(menuId)
  if (index > -1) {
    expandedMenus.value.splice(index, 1)
  } else {
    expandedMenus.value.push(menuId)
  }
}

// 点击菜单项
const handleMenuClick = (item) => {
  if (item.route) {
    const [targetPath, targetQueryStr] = item.route.split('?')
    const currentPath = route.path
    const currentQuery = route.query
    
    // 检查是否同路径但不同查询参数（如 /cost/add 和 /cost/add?mode=estimation）
    if (targetPath === currentPath) {
      const targetQuery = targetQueryStr ? Object.fromEntries(new URLSearchParams(targetQueryStr)) : {}
      const queryChanged = JSON.stringify(targetQuery) !== JSON.stringify(currentQuery)
      if (queryChanged) {
        router.replace({ path: targetPath, query: targetQuery }) // 强制导航
        return
      }
    }
    router.push(item.route)
    if (props.mobile) emit('close') // 移动端点击后关闭抽屉
  }
}

// 退出登录
const handleLogout = async () => {
  try {
    await ElMessageBox.confirm('确定要退出当前账号吗？', '退出登录', {
      confirmButtonText: '确定',
      cancelButtonText: '取消'
    })
    authStore.logout()
    ElMessage.success('已退出登录')
    router.push('/login')
  } catch {
    // 用户取消
  }
}

// 角色颜色映射
const ROLE_COLORS = {
  admin: '#F56C6C',
  purchaser: '#E6A23C',
  producer: '#67C23A',
  reviewer: '#409EFF',
  salesperson: '#9B59B6',
  readonly: '#909399'
}

// 获取角色颜色
const getRoleColor = (role) => {
  return ROLE_COLORS[role] || '#909399'
}

// 获取姓名首字母
const getInitial = (name) => {
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
}
</script>

<style scoped>
/* 用户头像样式 */
.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

/* 子菜单过渡动画 */
.submenu-enter-active,
.submenu-leave-active {
  transition: all 0.3s ease-in-out;
  max-height: 200px;
  opacity: 1;
  overflow: hidden;
}

.submenu-enter-from,
.submenu-leave-to {
  max-height: 0;
  opacity: 0;
}

/* 侧边栏滚动条样式：默认隐藏，hover时显示 */
nav::-webkit-scrollbar {
  width: 4px;
  height: 4px;
  background-color: transparent;
}

nav::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background-color: transparent; /* 默认透明 */
  transition: background-color 0.3s;
}

nav:hover::-webkit-scrollbar-thumb {
  background-color: #cbd5e1; /* hover时显示灰色，对应 slate-300 */
}
</style>
