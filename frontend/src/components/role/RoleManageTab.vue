<template>
  <div class="role-manage-tab">
    <div class="toolbar">
      <el-button type="primary" @click="showCreateDialog">
        <i class="ri-add-line"></i> 新增角色
      </el-button>
    </div>

    <el-card>
      <el-table :data="roles" border stripe>
        <el-table-column type="index" width="60" label="#" />

        <el-table-column label="角色" min-width="200">
          <template #default="{ row }">
            <div class="role-info">
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
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../../utils/request'
import RoleFormDialog from './RoleFormDialog.vue'

// Props - 从父组件接收数据
const props = defineProps({
  roles: { type: Array, default: () => [] },
  rolePermissions: { type: Object, default: () => ({}) }
})

// Emits
const emit = defineEmits(['refresh'])

// 状态
const dialogVisible = ref(false)
const isEdit = ref(false)
const currentRole = ref(null)

// 获取角色权限数量
const getRolePermissionCount = (code) => {
  return props.rolePermissions[code]?.length || 0
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
      emit('refresh')
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
    row.is_active = !isActive
    ElMessage.error('操作失败')
  }
}

// 跳转到权限配置
const goToPermissions = (row) => {
  // 切换回权限配置Tab
  const permissionManage = document.querySelector('.permission-tabs')
  if (permissionManage) {
    const tab = permissionManage.querySelector('.el-tabs__item:nth-child(1)')
    if (tab) tab.click()
  }
}

// 弹窗成功回调
const handleDialogSuccess = () => {
  emit('refresh')
}
</script>

<style scoped>
.role-manage-tab {
  padding: 20px 0;
}

.toolbar {
  margin-bottom: 20px;
}

.role-info {
  display: flex;
  align-items: center;
  gap: 12px;
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
