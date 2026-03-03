# 权限管理页面 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现一个可视化的权限管理页面，让管理员可以通过 JSON 配置文件动态管理各角色的功能访问权限。

**Architecture:** 采用 JSON 配置文件存储权限定义和角色权限映射，后端提供 API 读取/修改配置，前端展示权限矩阵表格支持勾选配置。保持现有 RBAC 架构，将硬编码权限抽离为可配置。

**Tech Stack:** Node.js + Express + Vue 3 + Element Plus + Pinia

---

## 前置依赖

- ✅ PostgreSQL 数据库已配置
- ✅ 后端服务可正常启动
- ✅ admin 用户可登录
- ✅ 现有权限硬编码在 roleCheck.js 和 menuConfig.js

---

## Task 1: 创建权限配置文件

**Files:**
- Create: `backend/config/permissions.js`

**Step 1: 定义权限码常量**

```javascript
/**
 * 权限定义配置
 * 定义系统中所有的权限码
 */

const PERMISSIONS = {
  // 成本管理模块
  'cost:view': { label: '查看成本', module: 'cost', description: '查看成本记录和详情' },
  'cost:create': { label: '创建成本', module: 'cost', description: '新增成本分析' },
  'cost:edit': { label: '编辑成本', module: 'cost', description: '修改成本分析' },
  'cost:delete': { label: '删除成本', module: 'cost', description: '删除成本分析' },
  'cost:submit': { label: '提交审核', module: 'cost', description: '提交成本审核' },

  // 审核管理模块
  'review:view': { label: '查看审核', module: 'review', description: '查看审核记录' },
  'review:approve': { label: '审核通过', module: 'review', description: '批准成本分析' },
  'review:reject': { label: '审核退回', module: 'review', description: '退回成本分析' },

  // 基础数据模块
  'master:material:view': { label: '查看原料', module: 'master', description: '查看原料数据' },
  'master:material:manage': { label: '管理原料', module: 'master', description: '增删改原料' },
  'master:process:view': { label: '查看工序', module: 'master', description: '查看工序数据' },
  'master:process:manage': { label: '管理工序', module: 'master', description: '增删改工序' },
  'master:packaging:view': { label: '查看包材', module: 'master', description: '查看包材数据' },
  'master:packaging:manage': { label: '管理包材', module: 'master', description: '增删改包材' },
  'master:model:view': { label: '查看型号', module: 'master', description: '查看型号数据' },
  'master:model:manage': { label: '管理型号', module: 'master', description: '增删改型号' },
  'master:regulation:view': { label: '查看法规', module: 'master', description: '查看法规数据' },
  'master:regulation:manage': { label: '管理法規', module: 'master', description: '增删改法规' },
  'master:bom:view': { label: '查看BOM', module: 'master', description: '查看产品BOM' },
  'master:bom:manage': { label: '管理BOM', module: 'master', description: '编辑产品BOM' },
  'master:customer:view': { label: '查看客户', module: 'master', description: '查看客户数据' },
  'master:customer:manage': { label: '管理客户', module: 'master', description: '增删改客户' },

  // 系统管理模块
  'system:user:view': { label: '查看用户', module: 'system', description: '查看用户列表' },
  'system:user:manage': { label: '管理用户', module: 'system', description: '增删改用户' },
  'system:config:view': { label: '查看配置', module: 'system', description: '查看系统配置' },
  'system:config:manage': { label: '管理配置', module: 'system', description: '修改系统配置' },
  'system:permission:view': { label: '查看权限', module: 'system', description: '查看权限配置' },
  'system:permission:manage': { label: '管理权限', module: 'system', description: '修改权限配置' }
};

// 权限模块分组
const PERMISSION_MODULES = {
  cost: { label: '成本管理', icon: 'ri-money-cny-box-line' },
  review: { label: '审核管理', icon: 'ri-checkbox-circle-line' },
  master: { label: '基础数据', icon: 'ri-database-2-line' },
  system: { label: '系统管理', icon: 'ri-settings-3-line' }
};

module.exports = {
  PERMISSIONS,
  PERMISSION_MODULES
};
```

**Step 2: 验证文件创建成功**

Run: `cat backend/config/permissions.js`
Expected: 文件内容正确显示

**Step 3: Commit**

```bash
git add backend/config/permissions.js
git commit -m "feat: 添加权限定义配置文件"
```

---

## Task 2: 创建角色权限映射配置

**Files:**
- Create: `backend/config/rolePermissions.js`

**Step 1: 定义角色权限映射**

```javascript
/**
 * 角色权限映射配置
 * 定义每个角色拥有的权限码列表
 */

const { PERMISSIONS } = require('./permissions');

// 所有权限码列表
const ALL_PERMISSIONS = Object.keys(PERMISSIONS);

// 角色权限映射
const ROLE_PERMISSIONS = {
  // 管理员：拥有所有权限
  admin: ALL_PERMISSIONS,

  // 采购：管理原料，查看其他基础数据
  purchaser: [
    'master:material:view',
    'master:material:manage',
    'master:model:view',
    'master:regulation:view',
    'master:bom:view',
    'master:process:view',
    'master:packaging:view'
  ],

  // 生产：管理工序和包材，查看其他基础数据
  producer: [
    'master:process:view',
    'master:process:manage',
    'master:packaging:view',
    'master:packaging:manage',
    'master:model:view',
    'master:regulation:view',
    'master:bom:view',
    'master:material:view'
  ],

  // 审核：成本审核权限 + 基础数据查看
  reviewer: [
    'cost:view',
    'cost:submit',
    'review:view',
    'review:approve',
    'review:reject',
    'master:model:view',
    'master:regulation:view',
    'master:material:view',
    'master:process:view',
    'master:packaging:view',
    'master:bom:view'
  ],

  // 业务员：成本管理权限 + 客户管理 + 基础数据查看
  salesperson: [
    'cost:view',
    'cost:create',
    'cost:edit',
    'cost:delete',
    'cost:submit',
    'review:view',
    'master:customer:view',
    'master:customer:manage',
    'master:model:view',
    'master:regulation:view',
    'master:material:view',
    'master:process:view',
    'master:packaging:view',
    'master:bom:view'
  ],

  // 只读：仅查看权限
  readonly: [
    'cost:view',
    'review:view',
    'master:model:view',
    'master:regulation:view',
    'master:material:view',
    'master:process:view',
    'master:packaging:view',
    'master:bom:view',
    'master:customer:view'
  ]
};

// 角色名称映射
const ROLE_NAMES = {
  admin: '管理员',
  purchaser: '采购',
  producer: '生产',
  reviewer: '审核',
  salesperson: '业务员',
  readonly: '只读'
};

/**
 * 检查角色是否有指定权限
 * @param {string} role - 角色代码
 * @param {string} permission - 权限码
 * @returns {boolean}
 */
function hasPermission(role, permission) {
  if (role === 'admin') return true;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * 获取角色的所有权限
 * @param {string} role - 角色代码
 * @returns {string[]}
 */
function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * 更新角色权限（仅用于权限管理页面）
 * @param {string} role - 角色代码
 * @param {string[]} permissions - 权限码列表
 */
function updateRolePermissions(role, permissions) {
  if (role === 'admin') {
    throw new Error('不能修改管理员角色的权限');
  }
  if (!ROLE_PERMISSIONS[role]) {
    throw new Error('未知的角色: ' + role);
  }
  ROLE_PERMISSIONS[role] = permissions;
}

module.exports = {
  ROLE_PERMISSIONS,
  ROLE_NAMES,
  ALL_PERMISSIONS,
  hasPermission,
  getRolePermissions,
  updateRolePermissions
};
```

**Step 2: 验证文件创建成功**

Run: `node -e "const { hasPermission } = require('./backend/config/rolePermissions'); console.log('admin has cost:create:', hasPermission('admin', 'cost:create'));"`
Expected: 输出 `admin has cost:create: true`

**Step 3: Commit**

```bash
git add backend/config/rolePermissions.js
git commit -m "feat: 添加角色权限映射配置"
```

---

## Task 3: 创建权限管理 API 路由

**Files:**
- Create: `backend/routes/permissionRoutes.js`
- Modify: `backend/server.js` (添加路由挂载)

**Step 1: 创建权限路由文件**

```javascript
/**
 * 权限管理 API 路由
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');
const { success, error } = require('../utils/response');
const { PERMISSIONS, PERMISSION_MODULES } = require('../config/permissions');
const {
  ROLE_PERMISSIONS,
  ROLE_NAMES,
  getRolePermissions,
  updateRolePermissions
} = require('../config/rolePermissions');
const logger = require('../utils/logger');

/**
 * GET /api/permissions
 * 获取所有权限定义
 */
router.get('/', verifyToken, (req, res) => {
  try {
    res.json(success({
      permissions: PERMISSIONS,
      modules: PERMISSION_MODULES
    }));
  } catch (err) {
    logger.error('获取权限定义失败:', err);
    res.status(500).json(error('获取权限定义失败'));
  }
});

/**
 * GET /api/permissions/roles
 * 获取所有角色权限配置
 */
router.get('/roles', verifyToken, isAdmin, (req, res) => {
  try {
    const roles = Object.keys(ROLE_PERMISSIONS).map(role => ({
      code: role,
      name: ROLE_NAMES[role],
      permissions: ROLE_PERMISSIONS[role]
    }));

    res.json(success({
      roles,
      permissions: PERMISSIONS,
      modules: PERMISSION_MODULES
    }));
  } catch (err) {
    logger.error('获取角色权限失败:', err);
    res.status(500).json(error('获取角色权限失败'));
  }
});

/**
 * GET /api/permissions/roles/:role
 * 获取指定角色的权限
 */
router.get('/roles/:role', verifyToken, isAdmin, (req, res) => {
  try {
    const { role } = req.params;

    if (!ROLE_PERMISSIONS[role]) {
      return res.status(404).json(error('角色不存在'));
    }

    res.json(success({
      role: {
        code: role,
        name: ROLE_NAMES[role],
        permissions: getRolePermissions(role)
      }
    }));
  } catch (err) {
    logger.error('获取角色权限失败:', err);
    res.status(500).json(error('获取角色权限失败'));
  }
});

/**
 * PUT /api/permissions/roles/:role
 * 更新指定角色的权限（仅管理员）
 */
router.put('/roles/:role', verifyToken, isAdmin, (req, res) => {
  try {
    const { role } = req.params;
    const { permissions } = req.body;

    if (!ROLE_PERMISSIONS[role]) {
      return res.status(404).json(error('角色不存在'));
    }

    if (role === 'admin') {
      return res.status(403).json(error('不能修改管理员角色的权限'));
    }

    // 验证权限码有效性
    const validPermissions = Object.keys(PERMISSIONS);
    const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));

    if (invalidPermissions.length > 0) {
      return res.status(400).json(error(`无效的权限码: ${invalidPermissions.join(', ')}`));
    }

    // 更新权限
    updateRolePermissions(role, permissions);

    logger.info(`管理员 ${req.user.username} 更新了角色 ${role} 的权限`, {
      role,
      permissions,
      operator: req.user.username
    });

    res.json(success({
      role: {
        code: role,
        name: ROLE_NAMES[role],
        permissions: getRolePermissions(role)
      }
    }, '权限更新成功'));
  } catch (err) {
    logger.error('更新角色权限失败:', err);
    res.status(500).json(error(err.message || '更新角色权限失败'));
  }
});

/**
 * GET /api/permissions/my
 * 获取当前用户的权限（用于前端权限控制）
 */
router.get('/my', verifyToken, (req, res) => {
  try {
    const { role } = req.user;
    const permissions = getRolePermissions(role);

    res.json(success({
      role,
      roleName: ROLE_NAMES[role],
      permissions
    }));
  } catch (err) {
    logger.error('获取用户权限失败:', err);
    res.status(500).json(error('获取用户权限失败'));
  }
});

module.exports = router;
```

**Step 2: 修改 server.js 添加路由**

在 server.js 中找到路由挂载区域，添加：

```javascript
// 在文件顶部引入
const permissionRoutes = require('./routes/permissionRoutes');

// 在其他 app.use('/api/...') 之后添加
app.use('/api/permissions', permissionRoutes);
```

**Step 3: 测试 API**

Run: `npm run dev:backend`
然后测试: `curl http://localhost:3001/api/permissions`
Expected: 返回权限定义 JSON

**Step 4: Commit**

```bash
git add backend/routes/permissionRoutes.js backend/server.js
git commit -m "feat: 添加权限管理 API"
```

---

## Task 4: 创建前端权限管理页面

**Files:**
- Create: `frontend/src/views/config/PermissionManage.vue`

**Step 1: 创建权限管理页面组件**

```vue
<template>
  <div class="permission-manage">
    <div class="page-header">
      <h2>权限管理</h2>
      <el-alert
        title="安全提示"
        description="修改权限后，已登录用户需要重新登录才能生效。请勿删除所有管理员权限，否则将导致无法管理系统。"
        type="warning"
        show-icon
        :closable="false"
      />
    </div>

    <!-- 权限矩阵表格 -->
    <el-card v-loading="loading" class="permission-table">
      <el-table
        :data="tableData"
        border
        style="width: 100%"
        :header-cell-style="{ background: '#f5f7fa' }"
      >
        <!-- 权限名称列 -->
        <el-table-column prop="label" label="权限名称" width="180" fixed="left">
          <template #default="{ row }">
            <div class="permission-name">
              <span>{{ row.label }}</span>
              <el-tooltip :content="row.description" placement="top">
                <i class="ri-question-line" style="color: #909399; margin-left: 4px;" />
              </el-tooltip>
            </div>
          </template>
        </el-table-column>

        <!-- 模块列 -->
        <el-table-column prop="moduleLabel" label="所属模块" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ row.moduleLabel }}</el-tag>
          </template>
        </el-table-column>

        <!-- 各角色列 -->
        <el-table-column
          v-for="role in roles"
          :key="role.code"
          :label="role.name"
          width="100"
          align="center"
        >
          <template #header>
            <div class="role-header">
              <span>{{ role.name }}</span>
              <el-checkbox
                v-if="role.code !== 'admin'"
                :checked="isRoleAllSelected(role.code)"
                :indeterminate="isRoleIndeterminate(role.code)"
                @change="(val) => toggleRoleAll(role.code, val)"
              />
            </div>
          </template>
          <template #default="{ row }">
            <el-checkbox
              v-model="rolePermissions[role.code]"
              :label="row.code"
              :disabled="role.code === 'admin'"
              @change="handlePermissionChange"
            >
              &nbsp;
            </el-checkbox>
          </template>
        </el-table-column>
      </el-table>

      <!-- 操作按钮 -->
      <div class="actions">
        <el-button type="primary" :loading="saving" @click="savePermissions">
          <i class="ri-save-line" /> 保存配置
        </el-button>
        <el-button @click="resetPermissions">
          <i class="ri-refresh-line" /> 重置
        </el-button>
      </div>
    </el-card>

    <!-- 角色说明 -->
    <el-card class="role-info">
      <template #header>
        <span>角色说明</span>
      </template>
      <el-descriptions :column="3" border>
        <el-descriptions-item
          v-for="role in roles"
          :key="role.code"
          :label="role.name"
        >
          {{ getRoleDescription(role.code) }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../../utils/request'

// 状态
const loading = ref(false)
const saving = ref(false)
const permissions = ref({})
const modules = ref({})
const roles = ref([])
const rolePermissions = ref({})
const originalPermissions = ref({})

// 计算表格数据
const tableData = computed(() => {
  return Object.entries(permissions.value).map(([code, config]) => ({
    code,
    label: config.label,
    module: config.module,
    moduleLabel: modules.value[config.module]?.label || config.module,
    description: config.description
  }))
})

// 获取角色说明
const getRoleDescription = (roleCode) => {
  const descriptions = {
    admin: '拥有所有权限，包括用户管理和系统配置',
    purchaser: '负责原料采购管理，可管理原料数据',
    producer: '负责生产管理，可管理工序和包材',
    reviewer: '负责审核成本分析，可批准或退回报价',
    salesperson: '负责业务报价，可创建和管理成本分析',
    readonly: '仅查看权限，无法修改任何数据'
  }
  return descriptions[roleCode] || ''
}

// 检查角色是否全选
const isRoleAllSelected = (roleCode) => {
  const allCodes = Object.keys(permissions.value)
  const selectedCodes = rolePermissions.value[roleCode] || []
  return selectedCodes.length === allCodes.length
}

// 检查角色是否部分选中
const isRoleIndeterminate = (roleCode) => {
  const allCodes = Object.keys(permissions.value)
  const selectedCodes = rolePermissions.value[roleCode] || []
  return selectedCodes.length > 0 && selectedCodes.length < allCodes.length
}

// 切换角色全选
const toggleRoleAll = (roleCode, selected) => {
  const allCodes = Object.keys(permissions.value)
  rolePermissions.value[roleCode] = selected ? [...allCodes] : []
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

      // 初始化角色权限
      response.data.roles.forEach(role => {
        rolePermissions.value[role.code] = [...role.permissions]
      })

      // 保存原始值用于重置
      originalPermissions.value = JSON.parse(JSON.stringify(rolePermissions.value))
    }
  } catch (err) {
    ElMessage.error('加载权限数据失败')
  } finally {
    loading.value = false
  }
}

// 保存权限
const savePermissions = async () => {
  // 检查是否至少有一个管理员权限
  const adminPermissions = rolePermissions.value.admin || []
  if (adminPermissions.length === 0) {
    ElMessage.error('管理员角色必须拥有至少一个权限')
    return
  }

  saving.value = true
  try {
    let hasError = false

    // 逐个保存角色权限
    for (const role of roles.value) {
      if (role.code === 'admin') continue // 跳过管理员

      try {
        await request.put(`/permissions/roles/${role.code}`, {
          permissions: rolePermissions.value[role.code]
        })
      } catch (err) {
        hasError = true
        ElMessage.error(`保存 ${role.name} 权限失败`)
      }
    }

    if (!hasError) {
      ElMessage.success('权限配置已保存')
      originalPermissions.value = JSON.parse(JSON.stringify(rolePermissions.value))
    }
  } catch (err) {
    ElMessage.error('保存权限失败')
  } finally {
    saving.value = false
  }
}

// 重置权限
const resetPermissions = () => {
  ElMessageBox.confirm('确定要重置所有权限吗？未保存的修改将丢失。', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    rolePermissions.value = JSON.parse(JSON.stringify(originalPermissions.value))
    ElMessage.info('已重置为上次保存的配置')
  }).catch(() => {})
}

// 权限变更处理
const handlePermissionChange = () => {
  // 可以在这里添加实时验证逻辑
}

onMounted(() => {
  loadPermissions()
})
</script>

<style scoped>
.permission-manage {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0 0 16px 0;
  font-size: 24px;
}

.permission-table {
  margin-bottom: 20px;
}

.permission-name {
  display: flex;
  align-items: center;
}

.role-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
  justify-content: center;
}

.role-info {
  margin-top: 20px;
}
</style>
```

**Step 2: Commit**

```bash
git add frontend/src/views/config/PermissionManage.vue
git commit -m "feat: 添加权限管理页面"
```

---

## Task 5: 添加前端路由和菜单

**Files:**
- Modify: `frontend/src/router/index.js`
- Modify: `frontend/src/config/menuConfig.js`

**Step 1: 添加路由**

在 `router/index.js` 中找到路由配置数组，添加：

```javascript
{
  path: '/config/permissions',
  name: 'PermissionManage',
  component: () => import('../views/config/PermissionManage.vue'),
  meta: {
    title: '权限管理',
    requiresAuth: true,
    roles: ['admin'] // 仅管理员可见
  }
}
```

**Step 2: 添加菜单项**

在 `menuConfig.js` 中找到系统管理部分，在 `user` 菜单后添加：

```javascript
{
  id: 'permission',
  label: '权限管理',
  icon: 'ri-shield-keyhole-line',
  route: '/config/permissions',
  roles: ['admin']
}
```

**Step 3: 验证路由和菜单**

启动前端后，使用 admin 账号登录，检查：
- 侧边栏是否显示"权限管理"菜单
- 点击是否能正常跳转
- 页面是否显示权限矩阵表格

**Step 4: Commit**

```bash
git add frontend/src/router/index.js frontend/src/config/menuConfig.js
git commit -m "feat: 添加权限管理路由和菜单"
```

---

## Task 6: 验证完整功能

**Step 1: 启动服务测试**

```bash
# 终端1：启动后端
npm run dev:backend

# 终端2：启动前端
npm run dev:frontend
```

**Step 2: 功能验证清单**

- [ ] 使用 admin/admin123 登录
- [ ] 侧边栏显示"权限管理"菜单
- [ ] 打开权限管理页面，显示6个角色
- [ ] 表格显示所有权限码（约20+项）
- [ ] 勾选/取消某个角色的权限
- [ ] 点击保存，显示成功提示
- [ ] 使用其他角色登录，验证权限已生效

**Step 3: 边界测试**

- [ ] 尝试修改 admin 角色权限（应被拒绝）
- [ ] 尝试将所有 admin 权限取消（应被阻止）
- [ ] 尝试保存无效的权限码（应报错）

**Step 4: Commit 最终版本**

```bash
git add .
git commit -m "feat: 权限管理功能完整实现"
```

---

## 回滚方案

如果出现问题，可按以下顺序回滚：

1. 删除路由和菜单修改
2. 删除 PermissionManage.vue 页面
3. 删除 permissionRoutes.js
4. 删除配置文件
5. 恢复 roleCheck.js 硬编码权限（如有修改）

---

## 后续优化建议

1. **持久化到数据库**：当权限变更频繁时，迁移到数据库表存储
2. **操作审计**：记录每次权限变更的操作人、时间、变更内容
3. **权限缓存**：后端缓存权限配置，避免每次请求都读取文件
4. **实时生效**：通过 WebSocket 通知前端权限变更，无需重新登录
