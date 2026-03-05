<template>
  <div class="role-manage">
    <!-- 页面表头 -->
    <CostPageHeader title="角色管理">
      <template #after-title>
        <span class="text-sm text-slate-400 ml-2">管理系统角色，配置角色权限</span>
      </template>
      <template #actions>
        <el-button type="primary" @click="showCreateDialog">
          <i class="ri-add-line"></i> 新增角色
        </el-button>
      </template>
    </CostPageHeader>

    <!-- 角色列表 -->
    <div class="content-wrapper">
      <el-card v-loading="loading">
        <el-table :data="roles" border stripe>
          <el-table-column type="index" width="60" label="#" />
          <el-table-column label="角色" min-width="200">
            <template #default="{ row }">
              <div class="role-info">
                <i :class="[row.icon, 'role-icon']" :style="{ color: getRoleColor(row.code) }"></i>
                <div class="role-details">
                  <div class="role-name">
                    {{ row.name }}
                    <el-tag v-if="row.is_system" size="small" type="warning" effect="plain">系统</el-tag>
                    <el-tag v-if="!row.is_active" size="small" type="info" effect="plain">禁用</el-tag>
                  </div>
                  <div class="role-code">{{ row.code }}</div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="描述" min-width="300" show-overflow-tooltip />
          <el-table-column label="权限数" width="100" align="center">
            <template #default="{ row }">
              <el-button link type="primary" @click="goToPermissions(row)">
                {{ getRolePermissionCount(row.code) }}
              </el-button>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-switch
                v-model="row.is_active"
                :disabled="row.is_system"
                @change="(val) => toggleRoleStatus(row, val)"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="editRole(row)">
                <i class="ri-edit-line"></i> 编辑
              </el-button>
              <el-button link type="primary" @click="goToPermissions(row)">
                <i class="ri-shield-keyhole-line"></i> 权限
              </el-button>
              <el-button
                link
                type="danger"
                :disabled="row.is_system"
                @click="deleteRole(row)"
              >
                <i class="ri-delete-bin-line"></i> 删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <!-- 创建/编辑角色弹窗 -->
    <RoleFormDialog
      v-model="dialogVisible"
      :is-edit="isEdit"
      :role-data="currentRole"
      @success="handleDialogSuccess"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../../utils/request'
import CostPageHeader from '../../components/cost/CostPageHeader.vue'
import RoleFormDialog from '../../components/role/RoleFormDialog.vue'

const router = useRouter()

// 状态
const loading = ref(false)
const roles = ref([])
const rolePermissions = ref({})
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentRole = ref(null)

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
const getRoleColor = (code) => {
  return ROLE_COLORS[code] || '#409EFF'
}

// 获取角色权限数量
const getRolePermissionCount = (code) => {
  return rolePermissions.value[code]?.length || 0
}

// 加载角色列表
const loadRoles = async () => {
  loading.value = true
  try {
    const [rolesRes, permsRes] = await Promise.all([
      request.get('/roles'),
      request.get('/permissions/roles')
    ])

    if (rolesRes.success) {
      roles.value = rolesRes.data
    }

    if (permsRes.success) {
      // 构建角色权限映射
      const permsMap = {}
      permsRes.data.roles.forEach(role => {
        permsMap[role.code] = role.permissions
      })
      rolePermissions.value = permsMap
    }
  } catch (err) {
    // 忽略请求被取消的错误（去重机制导致）
    if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
      console.log('请求被取消（去重）:', err.message)
      return
    }
    const errorMsg = err.response?.data?.message || err.message || '加载角色列表失败'
    ElMessage.error(errorMsg)
    console.error('加载角色列表失败:', err)
  } finally {
    loading.value = false
  }
}

// 显示创建弹窗
const showCreateDialog = () => {
  isEdit.value = false
  currentRole.value = null
  dialogVisible.value = true
}

// 编辑角色
const editRole = (row) => {
  isEdit.value = true
  currentRole.value = { ...row }
  dialogVisible.value = true
}

// 删除角色
const deleteRole = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除角色 "${row.name}" 吗？\n此操作不可恢复！`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const response = await request.delete(`/roles/${row.id}`)
    if (response.success) {
      ElMessage.success('删除成功')
      loadRoles()
    }
  } catch (err) {
    if (err !== 'cancel') {
      // 错误已在拦截器处理
    }
  }
}

// 切换角色状态
const toggleRoleStatus = async (row, isActive) => {
  try {
    const response = await request.put(`/roles/${row.id}`, {
      is_active: isActive
    })
    if (response.success) {
      ElMessage.success(`${row.name} 已${isActive ? '启用' : '禁用'}`)
    }
  } catch (err) {
    // 恢复原状态
    row.is_active = !isActive
    ElMessage.error('操作失败')
  }
}

// 跳转到权限配置
const goToPermissions = (row) => {
  router.push('/config/permissions')
}

// 弹窗成功回调
const handleDialogSuccess = () => {
  loadRoles()
}

onMounted(() => {
  loadRoles()
})
</script>

<style scoped>
.role-manage {
  background-color: var(--el-bg-color-page);
  min-height: 100%;
}

.content-wrapper {
  margin-top: 20px;
}

.role-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.role-icon {
  font-size: 32px;
  width: 40px;
  text-align: center;
}

.role-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.role-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.role-code {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
