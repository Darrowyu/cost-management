/**
 * 动态菜单组合式函数
 * 从后端获取菜单配置，实现权限动态化
 */

import { ref, computed } from 'vue'
import { useAuthStore } from '../store/auth'
import request from '../utils/request'

export function useMenu() {
  const authStore = useAuthStore()
  const menuLoading = ref(false)
  const menuError = ref(null)

  // 从后端获取的动态菜单
  const dynamicMenu = ref([])

  // 获取菜单
  const fetchMenu = async () => {
    // 未登录时不获取
    if (!authStore.isLoggedIn) {
      dynamicMenu.value = []
      return
    }

    menuLoading.value = true
    menuError.value = null

    try {
      const response = await request.get('/permissions/menu')
      if (response.success) {
        dynamicMenu.value = response.data.menu || []
      } else {
        menuError.value = response.message || '获取菜单失败'
        dynamicMenu.value = []
      }
    } catch (err) {
      menuError.value = err.message || '获取菜单失败'
      dynamicMenu.value = []
    } finally {
      menuLoading.value = false
    }
  }

  // 过滤后的菜单（直接使用后端返回的菜单）
  const menu = computed(() => dynamicMenu.value)

  // 根据ID查找菜单项
  const findMenuItem = (menuId, items = dynamicMenu.value) => {
    for (const item of items) {
      if (item.id === menuId) return item
      if (item.children) {
        const found = findMenuItem(menuId, item.children)
        if (found) return found
      }
    }
    return null
  }

  return {
    menu,
    loading: menuLoading,
    error: menuError,
    fetchMenu,
    findMenuItem
  }
}
