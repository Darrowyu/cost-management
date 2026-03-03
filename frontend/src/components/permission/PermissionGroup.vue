<template>
  <div class="permission-group">
    <div class="group-header">
      <div class="group-title">
        <i :class="modules[moduleKey]?.icon || 'ri-folder-line'"></i>
        <span>{{ modules[moduleKey]?.label || moduleKey }}</span>
      </div>
      <el-checkbox
        :checked="isGroupAllSelected(moduleKey)"
        :indeterminate="isGroupIndeterminate(moduleKey)"
        @change="(val) => $emit('toggle-group-all', moduleKey, val)"
      >
        全选
      </el-checkbox>
    </div>

    <div class="permission-items">
      <div
        v-for="perm in groupPermissions"
        :key="perm.code"
        class="permission-item"
        :class="{ selected: hasPermission(perm.code) }"
        @click="$emit('toggle-permission', perm.code)"
      >
        <div class="permission-check">
          <el-checkbox :checked="hasPermission(perm.code)" @click.stop>
            <span class="permission-label">{{ perm.label }}</span>
          </el-checkbox>
        </div>
        <el-tooltip :content="perm.description" placement="right">
          <i class="ri-question-line info-icon"></i>
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
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
  hasPermission: {
    type: Function,
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

defineEmits(['toggle-permission', 'toggle-group-all'])
</script>

<style scoped>
.permission-group {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  overflow: hidden;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-light);
}

.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.group-title i {
  font-size: 18px;
  color: var(--el-color-primary);
}

.permission-items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1px;
  background: var(--el-border-color-light);
}

.permission-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--el-bg-color);
  cursor: pointer;
  transition: all 0.15s;
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

.info-icon {
  color: var(--el-text-color-secondary);
  font-size: 16px;
  cursor: help;
}
</style>
