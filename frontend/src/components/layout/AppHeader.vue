<template>
  <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-20 shadow-sm">
    <!-- 左侧：Logo + 折叠按钮 -->
    <div class="flex items-center">
      <!-- Logo区域 -->
      <LogoSection :collapsed="collapsed" />

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
        <NotificationDropdown />

        <!-- 设置下拉 -->
        <SettingsDropdown />
      </div>
    </div>
  </header>
</template>

<script setup>
import { useLayoutStore } from '@/store/layout'
import LogoSection from './header/LogoSection.vue'
import NotificationDropdown from './header/NotificationDropdown.vue'
import SettingsDropdown from './header/SettingsDropdown.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps({
  collapsed: {
    type: Boolean,
    default: false
  }
})

defineEmits(['toggle-sidebar'])

const layoutStore = useLayoutStore()
const route = useRoute()

// 是否是帮助页面路由
const isHelpRoute = computed(() => route.path.startsWith('/help'))
</script>
