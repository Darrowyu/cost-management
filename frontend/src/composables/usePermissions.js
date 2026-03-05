import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../utils/request'

export function usePermissions() {
  // 状态
  const loading = ref(false)
  const saving = ref(false)
  const permissions = ref({})
  const modules = ref({})
  const roles = ref([])
  const selectedRole = ref(null)
  const rolePermissions = ref({})
  const originalPermissions = ref({})

  // 当前选中角色的权限列表（计算属性，用于响应式绑定）
  const selectedRolePermissionList = computed(() => {
    if (!selectedRole.value) return []
    return rolePermissions.value[selectedRole.value.code] || []
  })

  // 计算权限分组
  const groupedPermissions = computed(() => {
    const groups = {}
    Object.entries(permissions.value).forEach(([code, config]) => {
      if (!groups[config.module]) {
        groups[config.module] = []
      }
      groups[config.module].push({
        code,
        ...config
      })
    })
    return groups
  })

  // 角色描述映射（从后端获取）
  const roleDescMap = ref({})

  // 获取角色说明
  const getRoleDescription = (roleCode) => {
    // 优先从动态映射获取
    if (roleDescMap.value[roleCode]) {
      return roleDescMap.value[roleCode]
    }
    return ''
  }

  // 获取角色权限数量
  const getRolePermissionCount = (roleCode) => {
    return rolePermissions.value[roleCode]?.length || 0
  }

  // 选择角色
  const selectRole = (role) => {
    selectedRole.value = role
  }

  // 检查是否有权限
  const hasPermission = (permissionCode) => {
    if (!selectedRole.value) return false
    const perms = rolePermissions.value[selectedRole.value.code] || []
    return perms.includes(permissionCode)
  }

  // 切换权限
  const togglePermission = (permissionCode) => {
    if (!selectedRole.value || selectedRole.value.code === 'admin') return

    const roleCode = selectedRole.value.code
    const currentPerms = rolePermissions.value[roleCode] || []
    const index = currentPerms.indexOf(permissionCode)

    // 创建新数组确保响应式更新
    if (index > -1) {
      rolePermissions.value[roleCode] = currentPerms.filter(p => p !== permissionCode)
    } else {
      rolePermissions.value[roleCode] = [...currentPerms, permissionCode]
    }
  }

  // 检查组是否全选
  const isGroupAllSelected = (moduleKey) => {
    if (!selectedRole.value) return false
    const groupPerms = groupedPermissions.value[moduleKey] || []
    const selectedPerms = rolePermissions.value[selectedRole.value.code] || []
    return groupPerms.every(p => selectedPerms.includes(p.code))
  }

  // 检查组是否部分选中
  const isGroupIndeterminate = (moduleKey) => {
    if (!selectedRole.value) return false
    const groupPerms = groupedPermissions.value[moduleKey] || []
    const selectedPerms = rolePermissions.value[selectedRole.value.code] || []
    const hasSome = groupPerms.some(p => selectedPerms.includes(p.code))
    const hasAll = groupPerms.every(p => selectedPerms.includes(p.code))
    return hasSome && !hasAll
  }

  // 切换组全选
  const toggleGroupAll = (moduleKey, selected) => {
    if (!selectedRole.value || selectedRole.value.code === 'admin') return

    const groupPerms = groupedPermissions.value[moduleKey] || []
    const roleCode = selectedRole.value.code

    // 创建新数组确保响应式更新
    const currentPerms = rolePermissions.value[roleCode] || []

    if (selected) {
      // 添加该组所有权限（创建新数组）
      const groupCodes = groupPerms.map(p => p.code)
      const newPerms = [...new Set([...currentPerms, ...groupCodes])]
      rolePermissions.value[roleCode] = newPerms
    } else {
      // 移除该组所有权限（创建新数组）
      const groupCodes = groupPerms.map(p => p.code)
      rolePermissions.value[roleCode] = currentPerms.filter(
        p => !groupCodes.includes(p)
      )
    }
  }

  // 加载权限数据
  const loadPermissions = async () => {
    loading.value = true
    try {
      const response = await request.get('/permissions/roles')
      if (response.success) {
        permissions.value = response.data.permissions
        modules.value = response.data.modules
        roles.value = response.data.roles

        // 初始化角色描述映射
        const descMap = {}
        response.data.roles.forEach(role => {
          if (role.description) descMap[role.code] = role.description
        })
        roleDescMap.value = descMap

        // 初始化角色权限（创建新对象确保响应式）
        const initialPerms = {}
        response.data.roles.forEach(role => {
          initialPerms[role.code] = [...role.permissions]
        })
        rolePermissions.value = initialPerms

        // 保存原始值用于重置
        originalPermissions.value = JSON.parse(JSON.stringify(rolePermissions.value))

        // 默认选中第一个非管理员角色
        const nonAdminRole = roles.value.find(r => r.code !== 'admin')
        if (nonAdminRole) {
          selectedRole.value = nonAdminRole
        }
      }
    } catch (err) {
      // 忽略请求被取消的错误（去重机制导致）
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        console.log('请求被取消（去重）:', err.message)
        return
      }
      ElMessage.error('加载权限数据失败')
    } finally {
      loading.value = false
    }
  }

  // 保存权限
  const savePermissions = async () => {
    if (!selectedRole.value || selectedRole.value.code === 'admin') return

    const roleCode = selectedRole.value.code
    saving.value = true

    try {
      const response = await request.put(`/permissions/roles/${roleCode}`, {
        permissions: rolePermissions.value[roleCode]
      })

      if (response.success) {
        ElMessage.success(`${selectedRole.value.name} 权限已保存`)
        // 创建新对象确保响应式更新
        originalPermissions.value = {
          ...originalPermissions.value,
          [roleCode]: [...rolePermissions.value[roleCode]]
        }
      }
    } catch (err) {
      ElMessage.error('保存权限失败')
    } finally {
      saving.value = false
    }
  }

  // 重置权限
  const resetPermissions = () => {
    if (!selectedRole.value) return

    ElMessageBox.confirm(
      `确定要重置 ${selectedRole.value.name} 的权限吗？未保存的修改将丢失。`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    ).then(() => {
      const roleCode = selectedRole.value.code
      // 创建新数组确保响应式更新
      rolePermissions.value = {
        ...rolePermissions.value,
        [roleCode]: [...(originalPermissions.value[roleCode] || [])]
      }
      ElMessage.info('已重置')
    }).catch(() => {})
  }

  return {
    // 状态
    loading,
    saving,
    permissions,
    modules,
    roles,
    selectedRole,
    rolePermissions,
    groupedPermissions,
    selectedRolePermissionList,  // 当前角色权限列表（响应式）
    // 方法
    getRoleDescription,
    getRolePermissionCount,
    selectRole,
    hasPermission,
    togglePermission,
    isGroupAllSelected,
    isGroupIndeterminate,
    toggleGroupAll,
    loadPermissions,
    savePermissions,
    resetPermissions
  }
}
