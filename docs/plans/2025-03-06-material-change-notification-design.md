# 物料变更通知标准成本审核人员 - 系统设计文档

**日期**: 2025-03-06
**需求提出者**: Darrow哥
**设计状态**: 已确认

---

## 一、背景与目标

### 1.1 问题背景
当前系统中，物料价格变更后，标准成本不会自动更新。这导致：
- 业务员引用标准成本时，可能拿到过时的成本数据
- 审核人员无法及时知晓物料变更对标准成本的影响
- 缺乏系统化的标准成本更新决策流程

### 1.2 设计目标
当物料价格被修改或物料被删除时，系统自动通知审核人员，让审核人员能够：
1. 查看物料变更对哪些标准成本产生影响
2. 查看每个标准成本的价格变化对比
3. 选择性地更新受影响的标准成本
4. 更新时生成新版本，保留历史记录

---

## 二、数据模型设计

### 2.1 通知表 (notifications)

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,  -- 'material_price_change' | 'material_deleted'
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending' | 'processed' | 'archived'

  -- 触发者（采购员）
  actor_id INTEGER NOT NULL REFERENCES users(id),

  -- 关联物料
  material_id INTEGER NOT NULL REFERENCES materials(id),
  material_name VARCHAR(200),  -- 冗余存储，防止物料被删除后无法显示
  old_price DECIMAL(12,4),
  new_price DECIMAL(12,4),

  -- 受影响的标准成本（JSON数组）
  -- [
  --   {
  --     standard_cost_id: 1,
  --     packaging_config_id: 10,
  --     model_name: 'N95口罩',
  --     old_final_price: 12.50,
  --     new_final_price: 12.80,
  --     price_diff: 0.30,
  --     price_diff_rate: 0.024
  --   }
  -- ]
  affected_standard_costs JSONB NOT NULL DEFAULT '[]',

  -- 处理信息
  processed_at TIMESTAMP,
  processed_by INTEGER REFERENCES users(id),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_actor ON notifications(actor_id);
CREATE INDEX idx_notifications_material ON notifications(material_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

### 2.2 标准成本更新记录表 (standard_cost_updates)

```sql
CREATE TABLE IF NOT EXISTS standard_cost_updates (
  id SERIAL PRIMARY KEY,

  -- 关联通知
  notification_id INTEGER NOT NULL REFERENCES notifications(id),

  -- 标准成本信息
  standard_cost_id INTEGER NOT NULL REFERENCES standard_costs(id),
  old_version INTEGER NOT NULL,
  new_version INTEGER NOT NULL,

  -- 更新前数据（完整备份）
  old_data JSONB NOT NULL,
  -- 更新后数据（完整备份）
  new_data JSONB NOT NULL,

  -- 决策信息
  decision VARCHAR(20) NOT NULL,  -- 'approved' | 'rejected'
  decided_by INTEGER NOT NULL REFERENCES users(id),
  decided_at TIMESTAMP NOT NULL DEFAULT NOW(),

  created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_sc_updates_notification ON standard_cost_updates(notification_id);
CREATE INDEX idx_sc_updates_standard_cost ON standard_cost_updates(standard_cost_id);
CREATE INDEX idx_sc_updates_decided_at ON standard_cost_updates(decided_at DESC);
```

---

## 三、核心业务流程

### 3.1 物料价格变更流程

```
采购员修改物料价格
    │
    ▼
┌─────────────────────────┐
│ 1. 保存物料新价格        │
│ 2. 记录价格历史          │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│ 3. 查询受影响的标准成本  │
│    - 当前版本(is_current=true)
│    - 明细中包含该物料    │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│ 4. 计算每个标准成本的    │
│    新最终价格            │
│    - 使用现有成本计算器  │
│    - 只更新物料价格参数  │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│ 5. 检查是否有未处理的    │
│    同物料通知            │
└─────────────────────────┘
    │
    ├── 有 ──► 更新该通知的价格和计算结果
    │
    └── 无 ──► 创建新通知
                    │
                    ▼
            通知状态：待审核人员处理
```

### 3.2 审核人员处理流程

```
审核人员进入通知中心
    │
    ▼
┌─────────────────────────┐
│ 查看待处理通知列表       │
│ - 物料名称              │
│ - 价格变更(旧→新)       │
│ - 影响标准成本数量       │
│ - 创建时间              │
└─────────────────────────┘
    │
    ▼
点击通知进入处理详情
    │
    ▼
┌─────────────────────────┐
│ 物料变更详情            │
│ - 物料名称              │
│ - 旧价格 → 新价格       │
│ - 价格变动金额和比例     │
│ - 变更人                │
│ - 变更时间              │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│ 受影响标准成本对比表格   │
│ - 型号名称              │
│ - 包装配置              │
│ - 销售类型              │
│ - 旧最终价 → 新最终价   │
│ - 差价                  │
│ - 差率                  │
│ - 复选框(勾选要更新的)   │
└─────────────────────────┘
    │
    ▼
审核人员勾选要更新的项
    │
    ▼
点击"确认更新"
    │
    ▼
┌─────────────────────────┐
│ 系统处理：               │
│ 1. 为每个选中的标准成本  │
│    创建新版本            │
│ 2. 记录更新日志          │
│ 3. 通知状态改为已处理    │
│ 4. 其他未选中的保持原样  │
└─────────────────────────┘
```

### 3.3 标准成本更新逻辑

```javascript
// 伪代码：更新标准成本
async function updateStandardCost(standardCostId, materialNewPrice, decidedBy) {
  // 1. 获取当前标准成本
  const currentSC = await StandardCost.findById(standardCostId);

  // 2. 获取关联的报价单明细
  const items = await QuotationItem.getGroupedByCategory(currentSC.quotation_id);

  // 3. 更新物料价格为新价格
  const updatedItems = items.map(item => {
    if (item.category === 'material' && item.material_id === materialId) {
      return { ...item, unit_price: materialNewPrice };
    }
    return item;
  });

  // 4. 重新计算成本
  const calculator = new CostCalculator(config);
  const calculation = calculator.calculateQuotation({
    materialTotal: calculateMaterialTotal(updatedItems),
    processTotal: items.process.total,
    packagingTotal: items.packaging.total,
    // ... 其他参数
  });

  // 5. 获取最大版本号
  const maxVersion = await StandardCost.getMaxVersion(
    currentSC.packaging_config_id,
    currentSC.sales_type
  );

  // 6. 创建新版本（复制原报价单，更新价格和明细）
  const newQuotationId = await Quotation.create({
    ...currentSC,
    base_cost: calculation.baseCost,
    overhead_price: calculation.overheadPrice,
    final_price: calculation.domesticPrice || calculation.insurancePrice,
    items: updatedItems,
    status: 'draft',  // 内部使用，不显示给业务员
    is_standard_cost_version: true
  });

  // 7. 创建新标准成本版本
  const newStandardCostId = await StandardCost.create({
    packaging_config_id: currentSC.packaging_config_id,
    quotation_id: newQuotationId,
    base_cost: calculation.baseCost,
    overhead_price: calculation.overheadPrice,
    domestic_price: calculation.domesticPrice,
    export_price: calculation.exportPrice,
    quantity: currentSC.quantity,
    currency: currentSC.currency,
    sales_type: currentSC.sales_type,
    set_by: decidedBy,
    version: maxVersion + 1
  });

  // 8. 旧版本标记为非当前
  await StandardCost.markAsNotCurrent(currentSC.id);

  return newStandardCostId;
}
```

---

## 四、API接口设计

### 4.1 通知相关接口

#### GET /api/notifications
获取当前用户的通知列表

**Query参数：**
- `status`: 'pending' | 'processed' | 'archived' | 'all' (默认'pending')
- `page`: 页码 (默认1)
- `pageSize`: 每页数量 (默认20)

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "material_price_change",
      "status": "pending",
      "material_name": "无纺布",
      "old_price": 15.50,
      "new_price": 16.00,
      "affected_count": 3,
      "created_at": "2025-03-06T10:00:00Z",
      "actor_name": "张三"
    }
  ],
  "total": 10,
  "unread_count": 5
}
```

#### GET /api/notifications/:id
获取通知详情

**响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "type": "material_price_change",
    "status": "pending",
    "material": {
      "id": 10,
      "name": "无纺布",
      "old_price": 15.50,
      "new_price": 16.00,
      "price_diff": 0.50,
      "price_diff_rate": 0.032
    },
    "actor": { "id": 5, "name": "张三" },
    "affected_standard_costs": [
      {
        "standard_cost_id": 1,
        "packaging_config_id": 10,
        "model_name": "N95口罩",
        "packaging_config_name": "10片/袋装",
        "sales_type": "domestic",
        "old_final_price": 12.50,
        "new_final_price": 12.65,
        "price_diff": 0.15,
        "price_diff_rate": 0.012
      }
    ],
    "created_at": "2025-03-06T10:00:00Z"
  }
}
```

#### POST /api/notifications/:id/process
处理通知（审核人员决策）

**请求体：**
```json
{
  "selected_standard_cost_ids": [1, 3],  // 要更新的标准成本ID列表
  "decision": "approved"  // 'approved' | 'rejected'
}
```

**响应：**
```json
{
  "success": true,
  "message": "已更新2个标准成本",
  "data": {
    "updated_count": 2,
    "skipped_count": 1,
    "updated_standard_costs": [
      { "id": 5, "version": 2, "model_name": "N95口罩" }
    ]
  }
}
```

#### GET /api/notifications/unread-count
获取未读通知数量

**响应：**
```json
{
  "success": true,
  "data": { "count": 5 }
}
```

### 4.2 物料变更触发接口（内部调用）

在物料更新控制器中调用：

```javascript
// materialCrudController.js

const { handleMaterialPriceChange } = require('../utils/notificationHelper');

// 在updateMaterial方法中，价格变更后
if (oldPrice !== newPrice) {
  await handleMaterialPriceChange({
    materialId: id,
    materialName: name,
    oldPrice,
    newPrice,
    actorId: req.user.id
  });
}
```

---

## 五、前端页面设计

### 5.1 通知中心页面 (/notifications)

**页面结构：**
```
┌─────────────────────────────────────────────────────┐
│  通知中心                              [刷新按钮]   │
├─────────────────────────────────────────────────────┤
│  [待处理(5)]  [已处理]  [已归档]                    │
├─────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────┐ │
│  │ 🔴 物料价格变更                                 │ │
│  │    无纺布: ¥15.50 → ¥16.00 (+¥0.50, +3.2%)     │ │
│  │    影响3个标准成本                              │ │
│  │    由 张三 于 2025-03-06 10:00 提交            │ │
│  │                                    [去处理]     │ │
│  └───────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────┐ │
│  │ 🔴 物料价格变更                                 │ │
│  │    熔喷布: ¥25.00 → ¥24.00 (-¥1.00, -4.0%)     │ │
│  │    影响5个标准成本                              │ │
│  │    由 李四 于 2025-03-06 09:30 提交            │ │
│  │                                    [去处理]     │ │
│  └───────────────────────────────────────────────┘ │
│  ...                                               │
└─────────────────────────────────────────────────────┘
```

### 5.2 物料变更处理弹窗 (MaterialChangeDialog.vue)

**弹窗结构：**
```
┌─────────────────────────────────────────────────────────────┐
│  物料价格变更处理                              [X]          │
├─────────────────────────────────────────────────────────────┤
│  物料信息:                                                  │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 物料名称: 无纺布                                       │ │
│  │ 价格变动: ¥15.50 → ¥16.00                              │ │
│  │ 变动幅度: +¥0.50 (+3.2%)                               │ │
│  │ 变更人: 张三 | 变更时间: 2025-03-06 10:00             │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  受影响的标准成本:                                          │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ [✓] 全选                                              │ │
│  │ ┌──────────┬──────────┬─────────┬──────────┬────────┐ │ │
│  │ │ 型号     │ 包装配置 │ 旧价格  │ 新价格   │ 差率   │ │ │
│  │ ├──────────┼──────────┼─────────┼──────────┼────────┤ │ │
│  │ │ ☑ N95    │ 10片/袋  │ ¥12.50  │ ¥12.65   │ +1.2%  │ │ │
│  │ │ ☑ KN95   │ 5片/袋   │ ¥11.00  │ ¥11.15   │ +1.4%  │ │ │
│  │ │ ☐ 平面口罩│ 50片/盒  │ ¥8.00   │ ¥8.05    │ +0.6%  │ │ │
│  │ └──────────┴──────────┴─────────┴──────────┴────────┘ │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  [取消]                                    [确认更新(2)]   │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Header通知角标

**组件位置：** `frontend/src/components/layout/header/NotificationDropdown.vue`（已有，需扩展）

**修改内容：**
1. 从 `/api/notifications/unread-count` 获取未读数量
2. 点击通知项跳转到通知中心或打开处理弹窗
3. 添加"查看全部"入口

---

## 六、权限控制

### 6.1 权限定义

新增权限：
```javascript
// backend/config/permissions.js
{
  'notification:view': { label: '查看通知', module: 'notification', description: '查看系统通知' },
  'notification:process': { label: '处理通知', module: 'notification', description: '处理物料变更通知' }
}
```

### 6.2 角色权限配置

```javascript
// backend/config/rolePermissions.js
{
  reviewer: [
    'notification:view',
    'notification:process',
    // ... 其他已有权限
  ],
  admin: [
    'notification:view',
    'notification:process',
    // ... 其他已有权限
  ]
}
```

---

## 七、边界情况处理

### 7.1 物料多次变更
**场景**: 物料A在10分钟内被修改了3次价格
**处理**: 覆盖未处理的通知，只保留最新的变更通知

### 7.2 标准成本被删除
**场景**: 处理通知时，发现某个标准成本已被删除
**处理**: 在对比表格中标记"已删除"，不可勾选，提示用户

### 7.3 物料被删除
**场景**: 物料被删除（需先确保无引用才能删除）
**处理**:
1. 系统先检查是否有当前版本的标准成本引用该物料
2. 如果有 → 拒绝删除，提示用户先处理相关标准成本
3. 如果没有 → 允许删除，不生成通知

### 7.4 审核人员离线
**场景**: 物料变更时，审核人员不在线
**处理**:
1. 通知存储在数据库中
2. 审核人员登录后从 `/api/notifications` 获取待处理通知
3. Header角标显示未读数量

### 7.5 价格变动极小
**场景**: 物料价格从 10.00 变为 10.01，差率 0.1%
**处理**:
- 方案1: 不设置阈值，所有变更都通知（选择此方案）
- 方案2: 设置阈值（如>1%才通知），但审核人员可能错过重要的小幅累积变更

---

## 八、与现有系统的集成

### 8.1 复用的现有功能

| 功能 | 现有实现 | 复用方式 |
|------|----------|----------|
| 成本计算 | `CostCalculator` 类 | 直接使用 |
| 标准成本创建 | `StandardCost.create()` | 复用逻辑 |
| 报价单创建 | `Quotation.create()` | 复用逻辑 |
| 权限检查 | `checkPermission` 中间件 | 直接使用 |
| 响应格式 | `success`/`error` 工具函数 | 直接使用 |

### 8.2 需要修改的现有代码

1. **物料更新控制器** (`materialCrudController.js`)
   - 价格变更后调用通知生成逻辑

2. **Header通知组件** (`NotificationDropdown.vue`)
   - 改为从通知API获取数据
   - 添加未读数量角标

---

## 九、性能考虑

### 9.1 查询优化
- 为 `notifications` 表的 `status`、`material_id`、`created_at` 字段添加索引
- 使用 JSONB 类型存储 `affected_standard_costs`，利用 PostgreSQL 的 JSONB 索引

### 9.2 批量处理
- 如果一次物料变更影响100+标准成本，对比表格分页展示
- 标准成本更新使用事务批量处理

### 9.3 异步处理
- 物料价格变更后的通知生成可以异步执行（使用 setImmediate 或队列）
- 不影响物料保存的响应速度

---

## 十、验收标准

### 10.1 功能验收

- [ ] 物料价格变更后，审核人员能在通知中心看到通知
- [ ] 通知展示物料名称、价格变更幅度、影响标准成本数量
- [ ] 点击通知进入处理页面，展示受影响标准成本对比表格
- [ ] 对比表格显示：型号、包装配置、旧价格、新价格、差率
- [ ] 支持全选/反选/单个选择要更新的标准成本
- [ ] 确认更新后，选中的标准成本生成新版本
- [ ] 新版本的历史记录可在标准成本详情页查看
- [ ] 已处理的通知自动归档，不再显示在待处理列表
- [ ] Header通知角标显示未读通知数量

### 10.2 边界验收

- [ ] 同一物料短时间内多次变更，只保留最新通知
- [ ] 标准成本被删除后，通知中标记为不可选
- [ ] 无权限用户无法查看或处理通知

---

## 十一、后续扩展（可选）

1. **WebSocket实时推送**: 审核人员在线时立即收到新通知
2. **邮件通知**: 重要变更发送邮件提醒
3. **定时任务**: 每日汇总未处理通知，发送提醒
4. **自动更新**: 设置规则，符合条件的变更自动更新标准成本（无需审核）

---

## 十二、附录

### 12.1 相关文件路径

```
backend/
  controllers/
    notificationController.js       # 新增：通知API控制器
    master/materialCrudController.js # 修改：价格变更后触发通知
  models/
    Notification.js                 # 新增：通知模型
    StandardCostUpdate.js           # 新增：标准成本更新记录模型
  utils/
    notificationHelper.js           # 新增：通知生成工具函数
  routes/
    notificationRoutes.js           # 新增：通知路由
  db/migrations/
    0XX_add_notifications_table.sql # 新增：通知表迁移

frontend/
  src/views/notifications/
    NotificationCenter.vue          # 新增：通知中心页面
  src/components/notification/
    MaterialChangeDialog.vue        # 新增：物料变更处理弹窗
  src/components/layout/header/
    NotificationDropdown.vue        # 修改：接入通知API
  src/store/
    notification.js                 # 新增：通知状态管理
```

### 12.2 数据库迁移脚本

见上文 "2.1 通知表" 和 "2.2 标准成本更新记录表" 的 SQL 定义。

---

**设计确认**: Darrow哥 ✅
**设计日期**: 2025-03-06
**预计开发周期**: 2-3天
