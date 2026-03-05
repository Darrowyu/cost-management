<template>
  <div class="permission-manage">
    <!-- 动态表头 -->
    <CostPageHeader title="权限管理">
      <template #after-title>
        <span class="text-sm text-slate-400 ml-2">为不同角色配置功能访问权限</span>
      </template>
    </CostPageHeader>

    <!-- Tab 切换 -->
    <el-tabs v-model="activeTab" class="permission-tabs" type="border-card">
      <!-- 权限配置 Tab -->
      <el-tab-pane label="权限配置" name="permissions">
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
              <!-- 全局操作栏 -->
              <div class="global-actions">
                <el-button-group>
                  <el-button size="small" @click="expandAll">
                    <i class="ri-arrow-down-s-line"></i> 展开全部
                  </el-button>
                  <el-button size="small" @click="collapseAll">
                    <i class="ri-arrow-up-s-line"></i> 折叠全部
                  </el-button>
                </el-button-group>
                <el-button size="small" type="primary" plain @click="selectAll">
                  <i class="ri-check-double-line"></i> 全选所有权限
                </el-button>
                <el-button size="small" @click="clearAll">
                  <i class="ri-eraser-line"></i> 清空所有
                </el-button>
              </div>

              <PermissionGroup
                v-for="(groupPermissions, moduleKey) in groupedPermissions"
                :key="moduleKey"
                :ref="el => { if (el) groupRefs[moduleKey] = el }"
                :module-key="moduleKey"
                :group-permissions="groupPermissions"
                :modules="modules"
                :selected-permissions="selectedRolePermissionList"
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
      </el-tab-pane>

      <!-- 角色管理 Tab -->
      <el-tab-pane label="角色管理" name="roles">
        <RoleManageTab />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { usePermissions } from '../../composables/usePermissions'
import RoleList from '../../components/permission/RoleList.vue'
import PermissionGroup from '../../components/permission/PermissionGroup.vue'
import CostPageHeader from '../../components/cost/CostPageHeader.vue'
import RoleManageTab from '../../components/role/RoleManageTab.vue'

const activeTab = ref('permissions')

const {
  saving,
  modules,
  roles,
  selectedRole,
  groupedPermissions,
  selectedRolePermissionList,
  getRoleDescription,
  getRolePermissionCount,
  selectRole,
  togglePermission,
  isGroupAllSelected,
  isGroupIndeterminate,
  toggleGroupAll,
  loadPermissions,
  savePermissions,
  resetPermissions,
} = usePermissions()

const groupRefs = ref({})

// 展开所有
const expandAll = () => {
  Object.values(groupRefs.value).forEach(group => {
    if (group && group.expand) group.expand()
  })
}

// 折叠所有
const collapseAll = () => {
  Object.values(groupRefs.value).forEach(group => {
    if (group && group.collapse) group.collapse()
  })
}

// 全选所有权限
const selectAll = () => {
  Object.keys(groupedPermissions.value).forEach(moduleKey => {
    if (!isGroupAllSelected(moduleKey)) {
      toggleGroupAll(moduleKey, true)
    }
  })
}

// 清空所有权限
const clearAll = () => {
  Object.keys(groupedPermissions.value).forEach(moduleKey => {
    toggleGroupAll(moduleKey, false)
  })
}

onMounted(() => {
  loadPermissions()
})
</script>

<style scoped>
.permission-manage {
  background-color: var(--el-bg-color-page);
  min-height: 100%;
}

.permission-tabs {
  margin-top: 20px;
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
  border-radius: 12px;
  border: 1px solid var(--el-border-color-light);
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
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
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--el-border-color-light);
}

.role-desc {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.actions {
  display: flex;
  gap: 10px;
}

.permission-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.global-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 20px;
  background: var(--el-fill-color-light);
  border-radius: 10px;
  margin-bottom: 8px;
  align-items: center;
}

.global-actions .el-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--el-bg-color);
  border-radius: 12px;
  border: 1px dashed var(--el-border-color);
  color: var(--el-text-color-secondary);
  min-height: 400px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
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
