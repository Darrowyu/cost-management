# 工序配置修改历史追踪 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 实现工序配置修改历史追踪功能，记录最后修改人、修改时间、工序总价，并在前端展示历史记录

**Architecture:** 采用"混合方案" - process_configs表增加last_modified_by/last_process_total字段记录最新状态，同时创建process_config_history表记录完整修改历史。前端在编辑页显示简洁信息，在详情页展示时间线式历史记录。

**Tech Stack:** Vue3 + Element Plus + Node.js + PostgreSQL

---

## Task 1: 数据库迁移 - 扩展 process_configs 表

**Files:**
- Create: `backend/db/migrations/010_add_process_config_history.sql`

**Step 1: 编写迁移脚本**

```sql
-- ============================================
-- 工序配置历史功能迁移
-- ============================================

-- 1. 扩展 process_configs 表，增加最后修改信息字段
ALTER TABLE process_configs
ADD COLUMN IF NOT EXISTS last_modified_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS last_process_total DECIMAL(12,4);

-- 2. 创建工序配置历史表
CREATE TABLE IF NOT EXISTS process_config_history (
  id SERIAL PRIMARY KEY,
  packaging_config_id INTEGER NOT NULL REFERENCES packaging_configs(id) ON DELETE CASCADE,
  process_id INTEGER REFERENCES process_configs(id),
  action VARCHAR(20) NOT NULL CHECK(action IN ('create', 'update', 'delete', 'batch_update')),

  -- 修改前数据（JSON存储工序列表快照）
  old_data JSONB,
  -- 修改后数据
  new_data JSONB,

  -- 工序总价记录
  old_process_total DECIMAL(12,4),
  new_process_total DECIMAL(12,4),

  -- 操作信息
  operated_by INTEGER NOT NULL REFERENCES users(id),
  operated_at TIMESTAMP DEFAULT NOW()
);

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_process_config_history_packaging_config_id
ON process_config_history(packaging_config_id);

CREATE INDEX IF NOT EXISTS idx_process_config_history_operated_at
ON process_config_history(operated_at DESC);

-- 4. 记录迁移
INSERT INTO migrations (name) VALUES ('010_add_process_config_history.sql')
ON CONFLICT (name) DO NOTHING;
```

**Step 2: 执行迁移**

Run: `cd backend && npm run migrate` 或手动执行 SQL

Expected: 迁移成功执行，无报错

**Step 3: 验证**

Run: `psql -d cost_management -c "\d process_configs"`
Expected: 显示 last_modified_by 和 last_process_total 字段

Run: `psql -d cost_management -c "\d process_config_history"`
Expected: 显示历史表结构

**Step 4: Commit**

```bash
git add backend/db/migrations/010_add_process_config_history.sql
git commit -m "feat: 添加工序配置历史表迁移脚本"
```

---

## Task 2: 创建 ProcessConfigHistory 模型

**Files:**
- Create: `backend/models/ProcessConfigHistory.js`

**Step 1: 编写模型代码**

```javascript
/**
 * 工序配置历史记录模型
 */

const dbManager = require('../db/database');

class ProcessConfigHistory {
  /**
   * 创建历史记录
   * @param {Object} data - 历史记录数据
   * @returns {Promise<number>} 新记录ID
   */
  static async create(data) {
    const {
      packaging_config_id,
      process_id,
      action,
      old_data,
      new_data,
      old_process_total,
      new_process_total,
      operated_by
    } = data;

    const result = await dbManager.query(
      `INSERT INTO process_config_history
       (packaging_config_id, process_id, action, old_data, new_data,
        old_process_total, new_process_total, operated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        packaging_config_id,
        process_id,
        action,
        old_data ? JSON.stringify(old_data) : null,
        new_data ? JSON.stringify(new_data) : null,
        old_process_total,
        new_process_total,
        operated_by
      ]
    );

    return result.rows[0].id;
  }

  /**
   * 批量创建历史记录
   * @param {Array} records - 历史记录数组
   * @returns {Promise<number>} 创建数量
   */
  static async createBatch(records) {
    if (!records || records.length === 0) return 0;

    return await dbManager.transaction(async (client) => {
      for (const record of records) {
        await client.query(
          `INSERT INTO process_config_history
           (packaging_config_id, process_id, action, old_data, new_data,
            old_process_total, new_process_total, operated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            record.packaging_config_id,
            record.process_id,
            record.action,
            record.old_data ? JSON.stringify(record.old_data) : null,
            record.new_data ? JSON.stringify(record.new_data) : null,
            record.old_process_total,
            record.new_process_total,
            record.operated_by
          ]
        );
      }
      return records.length;
    });
  }

  /**
   * 根据包装配置ID获取历史记录
   * @param {number} packagingConfigId - 包装配置ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 历史记录列表
   */
  static async findByPackagingConfigId(packagingConfigId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const result = await dbManager.query(
      `SELECT h.*, u.real_name as operator_name, u.username
       FROM process_config_history h
       LEFT JOIN users u ON h.operated_by = u.id
       WHERE h.packaging_config_id = $1
       ORDER BY h.operated_at DESC
       LIMIT $2 OFFSET $3`,
      [packagingConfigId, limit, offset]
    );

    return result.rows.map(row => ({
      ...row,
      old_data: row.old_data ? JSON.parse(row.old_data) : null,
      new_data: row.new_data ? JSON.parse(row.new_data) : null
    }));
  }

  /**
   * 获取最新的一条历史记录
   * @param {number} packagingConfigId - 包装配置ID
   * @returns {Promise<Object|null>} 最新历史记录
   */
  static async findLatestByPackagingConfigId(packagingConfigId) {
    const result = await dbManager.query(
      `SELECT h.*, u.real_name as operator_name, u.username
       FROM process_config_history h
       LEFT JOIN users u ON h.operated_by = u.id
       WHERE h.packaging_config_id = $1
       ORDER BY h.operated_at DESC
       LIMIT 1`,
      [packagingConfigId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      ...row,
      old_data: row.old_data ? JSON.parse(row.old_data) : null,
      new_data: row.new_data ? JSON.parse(row.new_data) : null
    };
  }
}

module.exports = ProcessConfigHistory;
```

**Step 2: Commit**

```bash
git add backend/models/ProcessConfigHistory.js
git commit -m "feat: 创建工序配置历史记录模型"
```

---

## Task 3: 修改 PackagingConfig 模型 - 增加最后修改信息

**Files:**
- Modify: `backend/models/PackagingConfig.js`

**Step 1: 修改 findById 方法，增加最后修改信息字段**

找到 `findById` 方法，修改 SELECT 语句：

```javascript
static async findById(id) {
  const result = await dbManager.query(
    `SELECT pc.*, m.model_name, m.model_category, m.model_series,
            r.name as regulation_name, r.id as regulation_id,
            u.real_name as last_modified_by_name, u.username as last_modified_by_username
     FROM packaging_configs pc
     LEFT JOIN models m ON pc.model_id = m.id
     LEFT JOIN regulations r ON m.regulation_id = r.id
     LEFT JOIN users u ON pc.last_modified_by = u.id
     WHERE pc.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}
```

**Step 2: 修改 findWithProcesses 方法**

找到 `findWithProcesses` 方法，修改 SELECT 语句：

```javascript
static async findWithProcesses(id) {
  const client = await dbManager.getClient();
  try {
    // 获取包装配置信息（增加最后修改字段）
    const configResult = await client.query(
      `SELECT pc.*, m.model_name, u.real_name as last_modified_by_name
       FROM packaging_configs pc
       LEFT JOIN models m ON pc.model_id = m.id
       LEFT JOIN users u ON pc.last_modified_by = u.id
       WHERE pc.id = $1`,
      [id]
    );

    if (configResult.rows.length === 0) {
      return null;
    }

    const config = configResult.rows[0];

    // 获取工序列表
    const processesResult = await client.query(
      `SELECT * FROM process_configs
       WHERE packaging_config_id = $1 AND is_active = true
       ORDER BY sort_order, id`,
      [id]
    );

    config.processes = processesResult.rows;
    return config;
  } finally {
    client.release();
  }
}
```

**Step 3: 增加 updateLastModified 方法**

在类末尾添加：

```javascript
/**
 * 更新最后修改信息
 * @param {number} id - 包装配置ID
 * @param {Object} data - 修改数据
 * @returns {Promise<Object>} 更新结果
 */
static async updateLastModified(id, data) {
  const { last_modified_by, last_process_total } = data;

  const result = await dbManager.query(
    `UPDATE packaging_configs
     SET last_modified_by = $1, last_process_total = $2, updated_at = NOW()
     WHERE id = $3`,
    [last_modified_by, last_process_total, id]
  );

  return { rowCount: result.rowCount };
}
```

**Step 4: Commit**

```bash
git add backend/models/PackagingConfig.js
git commit -m "feat: PackagingConfig模型增加最后修改信息字段"
```

---

## Task 4: 创建历史记录控制器

**Files:**
- Create: `backend/controllers/process/processHistoryController.js`

**Step 1: 编写控制器代码**

```javascript
/**
 * 工序配置历史记录控制器
 */

const ProcessConfigHistory = require('../../models/ProcessConfigHistory');

class ProcessHistoryController {
  /**
   * 获取包装配置的历史记录列表
   */
  async getHistoryByPackagingConfigId(req, res) {
    try {
      const { id } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const history = await ProcessConfigHistory.findByPackagingConfigId(id, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('获取历史记录失败:', error);
      res.status(500).json({
        success: false,
        error: '获取历史记录失败'
      });
    }
  }

  /**
   * 获取最新历史记录
   */
  async getLatestHistory(req, res) {
    try {
      const { id } = req.params;

      const history = await ProcessConfigHistory.findLatestByPackagingConfigId(id);

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('获取最新历史记录失败:', error);
      res.status(500).json({
        success: false,
        error: '获取最新历史记录失败'
      });
    }
  }
}

module.exports = new ProcessHistoryController();
```

**Step 2: Commit**

```bash
git add backend/controllers/process/processHistoryController.js
git commit -m "feat: 创建工序配置历史记录控制器"
```

---

## Task 5: 修改包装配置控制器 - 集成历史记录

**Files:**
- Modify: `backend/controllers/process/packagingConfigController.js`

**Step 1: 引入依赖**

在文件顶部添加：

```javascript
const ProcessConfigHistory = require('../../models/ProcessConfigHistory');
const ProcessConfig = require('../../models/ProcessConfig');
```

**Step 2: 修改 update 方法，记录历史**

找到 `update` 方法，修改为：

```javascript
async update(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id; // 从认证中间件获取当前用户ID

    // 获取旧数据（用于历史记录）
    const oldConfig = await PackagingConfig.findWithProcesses(id);
    if (!oldConfig) {
      return res.status(404).json({ success: false, error: '配置不存在' });
    }

    const oldProcesses = oldConfig.processes || [];
    const oldProcessTotal = oldProcesses.reduce(
      (sum, p) => sum + (parseFloat(p.unit_price) || 0), 0
    );

    // 执行更新
    const result = await PackagingConfig.update(id, req.body);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: '配置不存在' });
    }

    // 获取新数据
    const newProcesses = req.body.processes || [];
    const newProcessTotal = newProcesses.reduce(
      (sum, p) => sum + (parseFloat(p.unit_price) || 0), 0
    );

    // 更新最后修改信息
    await PackagingConfig.updateLastModified(id, {
      last_modified_by: userId,
      last_process_total: newProcessTotal
    });

    // 创建历史记录
    if (userId) {
      await ProcessConfigHistory.create({
        packaging_config_id: id,
        action: 'batch_update',
        old_data: { processes: oldProcesses },
        new_data: { processes: newProcesses },
        old_process_total: oldProcessTotal,
        new_process_total: newProcessTotal,
        operated_by: userId
      });
    }

    // 获取更新后的完整数据返回
    const updatedConfig = await PackagingConfig.findWithProcesses(id);

    res.json({
      success: true,
      message: '更新成功',
      data: updatedConfig
    });
  } catch (error) {
    console.error('更新包装配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '更新包装配置失败'
    });
  }
}
```

**Step 3: 修改 create 方法，记录历史**

找到 `create` 方法，在创建成功后添加历史记录：

```javascript
async create(req, res) {
  try {
    const userId = req.user?.id;
    const { processes = [], ...configData } = req.body;

    // 创建配置
    const newId = await PackagingConfig.create(configData);

    // 批量创建工序
    if (processes.length > 0) {
      await ProcessConfig.createBatch(newId, processes);
    }

    // 计算工序总价
    const processTotal = processes.reduce(
      (sum, p) => sum + (parseFloat(p.unit_price) || 0), 0
    );

    // 更新最后修改信息
    await PackagingConfig.updateLastModified(newId, {
      last_modified_by: userId,
      last_process_total: processTotal
    });

    // 创建历史记录
    if (userId) {
      await ProcessConfigHistory.create({
        packaging_config_id: newId,
        action: 'create',
        new_data: { processes },
        new_process_total: processTotal,
        operated_by: userId
      });
    }

    // 获取完整数据返回
    const newConfig = await PackagingConfig.findWithProcesses(newId);

    res.status(201).json({
      success: true,
      message: '创建成功',
      data: newConfig
    });
  } catch (error) {
    console.error('创建包装配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '创建包装配置失败'
    });
  }
}
```

**Step 4: Commit**

```bash
git add backend/controllers/process/packagingConfigController.js
git commit -m "feat: 包装配置控制器集成历史记录功能"
```

---

## Task 6: 添加路由

**Files:**
- Modify: `backend/routes/processRoutes.js`

**Step 1: 引入控制器**

在文件顶部添加：

```javascript
const processHistoryController = require('../controllers/process/processHistoryController');
```

**Step 2: 添加历史记录路由**

在文件末尾（module.exports 之前）添加：

```javascript
// ============================================
// 工序配置历史记录路由
// ============================================

// 获取历史记录列表
router.get('/packaging-configs/:id/history', authenticate, processHistoryController.getHistoryByPackagingConfigId);

// 获取最新历史记录
router.get('/packaging-configs/:id/history/latest', authenticate, processHistoryController.getLatestHistory);
```

**Step 3: Commit**

```bash
git add backend/routes/processRoutes.js
git commit -m "feat: 添加工序配置历史记录路由"
```

---

## Task 7: 前端 API 封装

**Files:**
- Modify: `frontend/src/api/process.js`（如果不存在则创建）

**Step 1: 检查/创建 API 文件**

如果 `frontend/src/api/process.js` 不存在，创建它：

```javascript
import request from '@/utils/request'

/**
 * 获取工序配置历史记录
 * @param {number} id - 包装配置ID
 * @param {Object} params - 查询参数
 */
export function getProcessConfigHistory(id, params = {}) {
  return request.get(`/processes/packaging-configs/${id}/history`, { params })
}

/**
 * 获取最新历史记录
 * @param {number} id - 包装配置ID
 */
export function getLatestProcessConfigHistory(id) {
  return request.get(`/processes/packaging-configs/${id}/history/latest`)
}
```

如果文件已存在，在末尾添加这两个函数。

**Step 2: Commit**

```bash
git add frontend/src/api/process.js
git commit -m "feat: 前端API添加工序配置历史记录接口"
```

---

## Task 8: 修改编辑对话框 - 显示最后修改信息

**Files:**
- Modify: `frontend/src/components/process/ProcessConfigDialog.vue`

**Step 1: 导入 API**

在 script setup 中添加：

```javascript
import { getLatestProcessConfigHistory } from '@/api/process'
```

**Step 2: 添加状态变量**

在 `let form = reactive({ ...defaultForm })` 之前添加：

```javascript
const lastModifiedInfo = ref(null)
```

**Step 3: 在 template 中添加最后修改信息展示**

在 `<!-- Footer Summary -->` 区域之后（第131行后），添加：

```vue
<!-- Last Modified Info -->
<div v-if="isEdit && lastModifiedInfo" class="last-modified-info">
  <el-divider />
  <div class="info-content">
    <el-icon><Clock /></el-icon>
    <span class="text">
      最后修改：<strong>{{ lastModifiedInfo.operator_name || lastModifiedInfo.username || '未知用户' }}</strong>
      于 <strong>{{ formatDateTime(lastModifiedInfo.operated_at) }}</strong>
      | 上次总价：<strong class="price">¥{{ formatNumber(lastModifiedInfo.new_process_total || 0) }}</strong>
    </span>
  </div>
</div>
```

**Step 4: 添加加载最后修改信息的方法**

在 methods 区域添加：

```javascript
const loadLastModifiedInfo = async () => {
  if (!isEdit.value || !form.id) return

  try {
    const res = await getLatestProcessConfigHistory(form.id)
    if (res.success && res.data) {
      lastModifiedInfo.value = res.data
    }
  } catch (e) {
    // 静默处理，不影响主功能
    console.warn('加载最后修改信息失败:', e)
  }
}
```

**Step 5: 在 watch 中调用加载**

修改 watch：

```javascript
watch(() => props.modelValue, (val) => {
  if (val) {
    if (props.initialData) {
      const data = JSON.parse(JSON.stringify(props.initialData))
      Object.assign(form, data)
      form.processes = (data.processes || []).map(p => ({
        ...p,
        unit_price: Number(p.unit_price) || 0
      }))
      form.is_active = data.is_active ? 1 : 0
      // 加载最后修改信息
      loadLastModifiedInfo()
    } else {
      Object.assign(form, defaultForm)
      lastModifiedInfo.value = null
    }
  }
})
```

**Step 6: 导入 Clock 图标**

在 import 中添加：

```javascript
import { Delete, Clock } from '@element-plus/icons-vue'
```

**Step 7: 添加样式**

在 style 区域添加：

```css
.last-modified-info {
  margin-top: 16px;
}

.last-modified-info .info-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #f0f9ff;
  border-radius: 6px;
  font-size: 13px;
  color: #475569;
}

.last-modified-info .info-content .el-icon {
  color: #3b82f6;
}

.last-modified-info .info-content .price {
  color: #059669;
}
```

**Step 8: Commit**

```bash
git add frontend/src/components/process/ProcessConfigDialog.vue
git commit -m "feat: 编辑对话框显示最后修改信息"
```

---

## Task 9: 修改详情对话框 - 显示历史时间线

**Files:**
- Modify: `frontend/src/components/management/ManagementDetailDialog.vue`

**Step 1: 导入 API 和图标**

在 script setup 中添加：

```javascript
import { getProcessConfigHistory } from '@/api/process'
import { Clock } from '@element-plus/icons-vue'
```

**Step 2: 添加状态变量**

在 `const configStore = useConfigStore()` 后添加：

```javascript
const historyList = ref([])
const historyLoading = ref(false)
const showHistory = ref(false)
```

**Step 3: 在 template 中添加历史时间线**

在 `<!-- 3. 明细表格 -->` 区域之后（第143行后），添加：

```vue
<!-- 4. 修改历史（仅工序配置显示） -->
<div v-if="type === 'process'" class="history-section">
  <div class="history-header" @click="showHistory = !showHistory">
    <span class="text-sm font-bold text-slate-800">
      <el-icon class="mr-1"><Clock /></el-icon>
      修改历史
    </span>
    <el-icon class="toggle-icon" :class="{ 'is-open': showHistory }">
      <ArrowDown />
    </el-icon>
  </div>

  <el-collapse-transition>
    <div v-show="showHistory" v-loading="historyLoading" class="history-content">
      <el-timeline v-if="historyList.length > 0">
        <el-timeline-item
          v-for="(item, index) in historyList"
          :key="item.id"
          :type="getHistoryItemType(item.action)"
          :timestamp="formatDateTime(item.operated_at)"
        >
          <div class="history-item">
            <div class="history-title">
              <span class="operator">{{ item.operator_name || item.username || '未知用户' }}</span>
              <el-tag size="small" :type="getHistoryActionType(item.action)">
                {{ getHistoryActionLabel(item.action) }}
              </el-tag>
            </div>
            <div class="history-detail">
              <div v-if="item.old_process_total !== null || item.new_process_total !== null" class="price-change">
                <span v-if="item.old_process_total !== null">¥{{ formatNumber(item.old_process_total) }}</span>
                <el-icon v-if="item.old_process_total !== null"><ArrowRight /></el-icon>
                <span class="new-price">¥{{ formatNumber(item.new_process_total || 0) }}</span>
              </div>
              <div v-if="item.new_data?.processes" class="process-count">
                工序数：{{ item.new_data.processes.length }}项
              </div>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>

      <el-empty v-else description="暂无修改历史" />
    </div>
  </el-collapse-transition>
</div>
```

**Step 4: 导入 ArrowDown 和 ArrowRight 图标**

修改 import：

```javascript
import { Box, Money, Operation, Clock, ArrowDown, ArrowRight } from '@element-plus/icons-vue'
```

**Step 5: 添加方法**

在 script 中添加：

```javascript
// 加载历史记录
const loadHistory = async () => {
  if (props.type !== 'process' || !props.config?.id) return

  historyLoading.value = true
  try {
    const res = await getProcessConfigHistory(props.config.id, { limit: 10 })
    if (res.success) {
      historyList.value = res.data || []
    }
  } catch (e) {
    console.warn('加载历史记录失败:', e)
  } finally {
    historyLoading.value = false
  }
}

// 获取历史项类型
const getHistoryItemType = (action) => {
  const typeMap = {
    create: 'success',
    update: 'primary',
    delete: 'danger',
    batch_update: 'warning'
  }
  return typeMap[action] || 'info'
}

// 获取操作标签类型
const getHistoryActionType = (action) => {
  const typeMap = {
    create: 'success',
    update: '',
    delete: 'danger',
    batch_update: 'warning'
  }
  return typeMap[action] || 'info'
}

// 获取操作标签文本
const getHistoryActionLabel = (action) => {
  const labelMap = {
    create: '创建',
    update: '修改',
    delete: '删除',
    batch_update: '批量更新'
  }
  return labelMap[action] || action
}

// 监听对话框打开
watch(() => props.modelValue, (val) => {
  if (val && props.type === 'process') {
    loadHistory()
  }
})
```

**Step 6: 添加样式**

在 style 区域添加：

```css
/* History Section */
.history-section {
  margin-top: 24px;
  border-top: 1px solid #e2e8f0;
  padding-top: 16px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding: 8px 0;
  color: #475569;
  transition: color 0.2s;
}

.history-header:hover {
  color: #3b82f6;
}

.toggle-icon {
  transition: transform 0.3s;
}

.toggle-icon.is-open {
  transform: rotate(180deg);
}

.history-content {
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  margin-top: 8px;
}

.history-item {
  padding: 8px 0;
}

.history-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.history-title .operator {
  font-weight: 600;
  color: #1e293b;
}

.history-detail {
  font-size: 13px;
  color: #64748b;
}

.history-detail .price-change {
  display: flex;
  align-items: center;
  gap: 8px;
}

.history-detail .price-change .new-price {
  color: #059669;
  font-weight: 600;
}

.history-detail .process-count {
  margin-top: 4px;
}
```

**Step 7: Commit**

```bash
git add frontend/src/components/management/ManagementDetailDialog.vue
git commit -m "feat: 详情对话框显示历史时间线"
```

---

## Task 10: 验证测试

**Files:**
- N/A（功能验证）

**Step 1: 启动后端服务**

Run: `cd backend && npm run dev`
Expected: 服务正常启动，无报错

**Step 2: 启动前端服务**

Run: `cd frontend && npm run dev`
Expected: 服务正常启动，无报错

**Step 3: 功能验证**

1. **创建新配置**：
   - 打开工序管理页面
   - 点击"新增配置"
   - 填写信息并保存
   - 检查数据库：`SELECT * FROM process_config_history;` 应有新记录

2. **编辑配置**：
   - 编辑刚创建的配置
   - 修改工序价格
   - 保存后查看编辑对话框底部是否显示"最后修改信息"

3. **查看详情**：
   - 点击查看配置详情
   - 展开"修改历史"区域
   - 验证时间线显示正确

**Step 4: Commit 最终版本**

```bash
git add .
git commit -m "feat: 完成工序配置修改历史追踪功能"
```

---

## 回滚方案

如果出现问题，按以下顺序回滚：

1. 回滚代码：`git reset --hard HEAD~10`
2. 回滚数据库：
   ```sql
   ALTER TABLE process_configs DROP COLUMN IF EXISTS last_modified_by;
   ALTER TABLE process_configs DROP COLUMN IF EXISTS last_process_total;
   DROP TABLE IF EXISTS process_config_history;
   DELETE FROM migrations WHERE name = '010_add_process_config_history.sql';
   ```

---

## 注意事项

1. **认证中间件**：确保 `req.user.id` 可用，否则历史记录无法记录操作人
2. **事务处理**：批量更新使用数据库事务，确保数据一致性
3. **错误处理**：历史记录写入失败不应影响主业务流程
4. **性能**：历史记录查询默认限制50条，避免大数据量影响性能
