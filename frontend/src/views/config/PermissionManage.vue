<template>
  <div class="permission-manage">
    <!-- 页面头部 -->
    <div class="page-header">
      <h2>权限管理</h2>
      <p class="subtitle">为不同角色配置功能访问权限</p>
    </div>

    <!-- 安全提示 -->
    <el-alert
      title="安全提示"
      description="修改权限后，已登录用户需要重新登录才能生效。管理员角色拥有所有权限，不可修改。"
      type="warning"
      show-icon
      :closable="false"
      class="security-alert"
    />

    <div class="content-wrapper">
      <!-- 左侧：角色列表 -->
      <RoleList
        :roles="roles"
        :selected-role="selectedRole"
        :get-role-icon="getRoleIcon"
        :get-role-permission-count="getRolePermissionCount"
        @select-role="selectRole"
      />

      <!-- 右侧：权限配置 -->
      <div class="permission-panel" v-if="selectedRole">
        <div class="panel-header">
          <div class="title-section">
            <h3>{{ selectedRole.name }} <span class="role-tag">{{ selectedRole.code }}</span></h3>
            <p class="role-desc">{{ getRoleDescription(selectedRole.code) }}</p>
          </div>
          <div class="actions" v-if="selectedRole.code !== 'admin'">
            <el-button type="primary" :loading="saving" @click="savePermissions">
              <i class="ri-save-line"></i> 保存
            </el-button>
            <el-button @click="resetPermissions">重置</el-button>
          </div>
        </div>

        <!-- 管理员特殊提示 -->
        <el-alert
          v-if="selectedRole.code === 'admin'"
          title="管理员拥有系统所有权限"
          description="管理员角色是系统最高权限，拥有所有功能的访问和操作权限，不可修改。"
          type="info"
          show-icon
          :closable="false"
        />

        <!-- 权限列表 -->
        <div v-else class="permission-groups">
          <PermissionGroup
            v-for="(groupPermissions, moduleKey) in groupedPermissions"
            :key="moduleKey"
            :module-key="moduleKey"
            :group-permissions="groupPermissions"
            :modules="modules"
            :has-permission="hasPermission"
            :is-group-all-selected="isGroupAllSelected"
            :is-group-indeterminate="isGroupIndeterminate"
            @toggle-permission="togglePermission"
            @toggle-group-all="toggleGroupAll"
          />
        </div>
      </div>

      <!-- 未选择角色提示 -->
      <div v-else class="empty-state">
        <i class="ri-shield-user-line"></i>
        <p>请在左侧选择一个角色进行权限配置</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { usePermissions } from '../../composables/usePermissions'
import RoleList from '../../components/permission/RoleList.vue'
import PermissionGroup from '../../components/permission/PermissionGroup.vue'

const {
  saving,
  modules,
  roles,
  selectedRole,
  groupedPermissions,
  getRoleIcon,
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
} = usePermissions()

onMounted(() => {
  loadPermissions()
})
</script>

<style scoped>
.permission-manage {
  padding: 20px;
  background-color: var(--el-bg-color-page);
  min-height: 100%;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.subtitle {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.security-alert {
  margin-bottom: 20px;
}

.content-wrapper {
  display: flex;
  gap: 20px;
}

.permission-panel {
  flex: 1;
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  padding: 24px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.title-section h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 10px;
}

.role-tag {
  font-size: 12px;
  font-weight: normal;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  padding: 2px 8px;
  border-radius: 4px;
}

.role-desc {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.actions {
  display: flex;
  gap: 10px;
}

.permission-groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px dashed var(--el-border-color);
  color: var(--el-text-color-secondary);
  min-height: 400px;
}

.empty-state i {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-state p {
  font-size: 14px;
}

@media (max-width: 1024px) {
  .content-wrapper {
    flex-direction: column;
  }
}
</style>
