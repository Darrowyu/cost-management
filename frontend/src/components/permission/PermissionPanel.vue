<template>
  <div class="permission-panel">
    <div class="panel-header">
      <div class="title-section">
        <h3>{{ selectedRole.name }} <span class="role-tag">{{ selectedRole.code }}</span></h3>
        <p class="role-desc">{{ getRoleDescription(selectedRole.code) }}</p>
      </div>
      <div class="actions" v-if="selectedRole.code !== 'admin'">
        <el-button type="primary" :loading="saving" @click="$emit('save')">
          <i class="ri-save-line"></i> 保存
        </el-button>
        <el-button @click="$emit('reset')">重置</el-button>
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
        v-for="(perms, moduleKey) in groupedPermissions"
        :key="moduleKey"
        :module-key="moduleKey"
        :group-permissions="perms"
        :modules="modules"
        :has-permission="hasPermission"
        :is-group-all-selected="isGroupAllSelected"
        :is-group-indeterminate="isGroupIndeterminate"
        @toggle-permission="(code) => $emit('toggle-permission', code)"
        @toggle-group-all="(key, val) => $emit('toggle-group-all', key, val)"
      />
    </div>
  </div>
</template>

<script setup>
import PermissionGroup from './PermissionGroup.vue'

defineProps({
  selectedRole: { type: Object, required: true },
  saving: { type: Boolean, default: false },
  modules: { type: Object, required: true },
  groupedPermissions: { type: Object, required: true },
  getRoleDescription: { type: Function, required: true },
  hasPermission: { type: Function, required: true },
  isGroupAllSelected: { type: Function, required: true },
  isGroupIndeterminate: { type: Function, required: true }
})

defineEmits(['save', 'reset', 'toggle-permission', 'toggle-group-all'])
</script>

<style scoped>
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
</style>
