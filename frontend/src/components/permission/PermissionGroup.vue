<template>
  <div class="permission-group" :class="{ collapsed: isCollapsed }">
    <div class="group-header" @click.self="toggleCollapse">
      <div class="group-title">
        <span>{{ modules[moduleKey]?.label || moduleKey }}</span>
        <span class="permission-count">{{ selectedPermissions.filter(p => groupPermissions.map(g => g.code).includes(p)).length }}/{{ groupPermissions.length }}</span>
      </div>
      <div class="group-actions">
        <el-checkbox
          :model-value="isGroupAllSelected(moduleKey)"
          :indeterminate="isGroupIndeterminate(moduleKey)"
          @change="(val) => $emit('toggle-group-all', moduleKey, val)"
        >
          全选
        </el-checkbox>
        <i class="ri-arrow-down-s-line collapse-icon"></i>
      </div>
    </div>

    <div class="permission-items" v-show="!isCollapsed">
      <div
        v-for="perm in groupPermissions"
        :key="perm.code"
        class="permission-item"
        :class="{ selected: selectedPermissions.includes(perm.code) }"
      >
        <el-tooltip :content="perm.description" placement="top">
          <div class="permission-check">
            <el-checkbox
              :model-value="selectedPermissions.includes(perm.code)"
              @change="$emit('toggle-permission', perm.code)"
            >
              <span class="permission-label">{{ perm.label }}</span>
            </el-checkbox>
          </div>
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  moduleKey: {
    type: String,
    required: true
  },
  groupPermissions: {
    type: Array,
    required: true
  },
  modules: {
    type: Object,
    required: true
  },
  selectedPermissions: {
    type: Array,
    required: true
  },
  isGroupAllSelected: {
    type: Function,
    required: true
  },
  isGroupIndeterminate: {
    type: Function,
    required: true
  }
})

const emit = defineEmits(['toggle-permission', 'toggle-group-all'])

const isCollapsed = ref(true)  // 默认折叠

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

// 暴露方法给父组件控制折叠状态
defineExpose({
  expand: () => { isCollapsed.value = false },
  collapse: () => { isCollapsed.value = true }
})
</script>

<style scoped>
.permission-group {
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  overflow: hidden;
  background: var(--el-bg-color);
  transition: all 0.3s ease;
}

.permission-group:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}

.permission-group.collapsed {
  border-color: var(--el-border-color);
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--el-fill-color-light);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.group-header:hover {
  background: var(--el-fill-color);
}

.group-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 15px;
  color: var(--el-text-color-primary);
}

.permission-count {
  font-size: 12px;
  font-weight: normal;
  color: var(--el-text-color-secondary);
  background: var(--el-bg-color);
  padding: 2px 10px;
  border-radius: 10px;
  margin-left: 8px;
  border: 1px solid var(--el-border-color-light);
}

.group-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-icon {
  font-size: 20px;
  color: var(--el-text-color-secondary);
  transition: transform 0.3s ease;
}

.permission-group.collapsed .collapse-icon {
  transform: rotate(-90deg);
}

.permission-items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1px;
  background: var(--el-border-color-light);
  animation: slideDown 0.25s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.permission-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: var(--el-bg-color);
  cursor: pointer;
  transition: all 0.2s ease;
}

.permission-item:hover {
  background: var(--el-fill-color-light);
}

.permission-item.selected {
  background: var(--el-color-primary-light-9);
}

.permission-check {
  flex: 1;
}

.permission-label {
  font-size: 14px;
  color: var(--el-text-color-primary);
  margin-left: 4px;
}

/* 响应式优化 */
@media (max-width: 768px) {
  .group-header {
    padding: 14px 16px;
  }

  .permission-items {
    grid-template-columns: 1fr;
  }
}
</style>
