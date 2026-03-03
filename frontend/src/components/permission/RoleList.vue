<template>
  <div class="role-sidebar">
    <h3>选择角色</h3>
    <div class="role-list">
      <div
        v-for="role in roles"
        :key="role.code"
        class="role-item"
        :class="{ active: selectedRole?.code === role.code }"
        @click="$emit('select-role', role)"
      >
        <div class="role-icon">
          <i :class="getRoleIcon(role.code)"></i>
        </div>
        <div class="role-info">
          <span class="role-name">{{ role.name }}</span>
          <span class="role-count">{{ getRolePermissionCount(role.code) }} 项权限</span>
        </div>
        <el-tag v-if="role.code === 'admin'" type="danger" size="small">系统</el-tag>
        <i v-else class="ri-arrow-right-s-line arrow"></i>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  roles: {
    type: Array,
    required: true
  },
  selectedRole: {
    type: Object,
    default: null
  },
  getRoleIcon: {
    type: Function,
    required: true
  },
  getRolePermissionCount: {
    type: Function,
    required: true
  }
})

defineEmits(['select-role'])
</script>

<style scoped>
.role-sidebar {
  width: 280px;
  flex-shrink: 0;
  background: var(--el-bg-color);
  border-radius: 12px;
  border: 1px solid var(--el-border-color-light);
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.role-sidebar h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.role-sidebar h3::before {
  content: '';
  width: 4px;
  height: 16px;
  background: var(--el-color-primary);
  border-radius: 2px;
}

.role-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.role-item {
  display: flex;
  align-items: center;
  padding: 14px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s ease;
  border: 1px solid transparent;
}

.role-item:hover {
  background: var(--el-fill-color-light);
  transform: translateX(2px);
}

.role-item.active {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.15);
}

.role-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--el-color-primary-light-8);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
}

.role-icon i {
  font-size: 20px;
  color: var(--el-color-primary);
}

.role-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.role-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.role-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.role-item .arrow {
  font-size: 18px;
  color: var(--el-text-color-secondary);
}

.role-item.active .arrow {
  color: var(--el-color-primary);
}

@media (max-width: 1024px) {
  .role-sidebar {
    width: 100%;
  }

  .role-list {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .role-item {
    flex: 1;
    min-width: 200px;
  }
}
</style>
