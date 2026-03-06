# 物料变更通知标准成本审核人员 - 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现物料价格变更通知审核人员，支持对比决策和选择性更新标准成本的功能

**Architecture:** 基于现有成本计算系统，新增通知模块，物料变更时自动计算受影响的标准成本并生成通知，审核人员通过通知中心查看对比后选择性更新

**Tech Stack:** Vue 3 + Element Plus + Pinia | Node.js + Express + PostgreSQL

---

## 前置依赖

- [ ] 确认数据库可连接且 migrations 目录可写入
- [ ] 确认后端 `npm install` 依赖已安装
- [ ] 确认前端 `npm install` 依赖已安装

---

## Task 1: 创建数据库迁移脚本

**Files:**
- Create: `backend/db/migrations/0XX_add_notifications_table.sql`

**Step 1: 编写通知表迁移脚本**

```sql
-- ============================================
-- 通知表
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL CHECK(type IN ('material_price_change', 'material_deleted')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processed', 'archived')),
  actor_id INTEGER NOT NULL REFERENCES users(id),
  material_id INTEGER NOT NULL REFERENCES materials(id),
  material_name VARCHAR(200) NOT NULL,
  old_price DECIMAL(12,4),
  new_price DECIMAL(12,4),
  affected_standard_costs JSONB NOT NULL DEFAULT '[]',
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

-- ============================================
-- 标准成本更新记录表
-- ============================================
CREATE TABLE IF NOT EXISTS standard_cost_updates (
  id SERIAL PRIMARY KEY,
  notification_id INTEGER NOT NULL REFERENCES notifications(id),
  standard_cost_id INTEGER NOT NULL REFERENCES standard_costs(id),
  old_version INTEGER NOT NULL,
  new_version INTEGER NOT NULL,
  old_data JSONB NOT NULL,
  new_data JSONB NOT NULL,
  decision VARCHAR(20) NOT NULL CHECK(decision IN ('approved', 'rejected')),
  decided_by INTEGER NOT NULL REFERENCES users(id),
  decided_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_sc_updates_notification ON standard_cost_updates(notification_id);
CREATE INDEX idx_sc_updates_standard_cost ON standard_cost_updates(standard_cost_id);
CREATE INDEX idx_sc_updates_decided_at ON standard_cost_updates(decided_at DESC);
```

**Step 2: 运行迁移**

```bash
cd D:/Code/JS/Project/WIP/cost-mangment/backend
node db/migrations/run_migrations.js
```

**Expected:** 显示 "Migration 0XX_add_notifications_table.sql executed successfully"

**Step 3: 验证表创建**

```bash
psql -d cost_management -c "\dt notifications"
psql -d cost_management -c "\dt standard_cost_updates"
```

**Expected:** 两张表都显示在列表中

**Step 4: Commit**

```bash
git add backend/db/migrations/0XX_add_notifications_table.sql
git commit -m "feat: add notifications and standard_cost_updates tables"
```

---

## Task 2: 创建 Notification 模型

**Files:**
- Create: `backend/models/Notification.js`

**Step 1: 编写 Notification 模型**

```javascript
/**
 * 通知数据模型
 */

const dbManager = require('../db/database');

class Notification {
  /**
   * 创建通知
   */
  static async create(data) {
    const result = await dbManager.query(
      `INSERT INTO notifications (type, actor_id, material_id, material_name, old_price, new_price, affected_standard_costs)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [data.type, data.actorId, data.materialId, data.materialName, data.oldPrice, data.newPrice, JSON.stringify(data.affectedStandardCosts)]
    );
    return result.rows[0].id;
  }

  /**
   * 更新通知（用于覆盖未处理的通知）
   */
  static async update(id, data) {
    const result = await dbManager.query(
      `UPDATE notifications
       SET old_price = $1, new_price = $2, affected_standard_costs = $3, updated_at = NOW()
       WHERE id = $4`,
      [data.oldPrice, data.newPrice, JSON.stringify(data.affectedStandardCosts), id]
    );
    return result.rowCount > 0;
  }

  /**
   * 查找指定物料的未处理通知
   */
  static async findPendingByMaterial(materialId) {
    const result = await dbManager.query(
      `SELECT * FROM notifications WHERE material_id = $1 AND status = 'pending' LIMIT 1`,
      [materialId]
    );
    return result.rows[0] || null;
  }

  /**
   * 根据ID查找通知
   */
  static async findById(id) {
    const result = await dbManager.query(
      `SELECT n.*, u.real_name as actor_name
       FROM notifications n
       JOIN users u ON n.actor_id = u.id
       WHERE n.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * 查找通知列表（支持筛选）
   */
  static async findAll(options = {}) {
    const { status = 'pending', page = 1, pageSize = 20 } = options;
    const params = [];
    let whereClause = '';

    if (status !== 'all') {
      whereClause = 'WHERE n.status = $1';
      params.push(status);
    }

    const countResult = await dbManager.query(
      `SELECT COUNT(*) as total FROM notifications n ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    const offset = (page - 1) * pageSize;
    const dataParams = [...params, pageSize, offset];
    const paramIndex = params.length + 1;

    const dataResult = await dbManager.query(
      `SELECT n.*, u.real_name as actor_name,
        jsonb_array_length(n.affected_standard_costs) as affected_count
       FROM notifications n
       JOIN users u ON n.actor_id = u.id
       ${whereClause}
       ORDER BY n.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      dataParams
    );

    return { data: dataResult.rows, total, page, pageSize };
  }

  /**
   * 获取未读通知数量
   */
  static async getUnreadCount() {
    const result = await dbManager.query(
      `SELECT COUNT(*) as count FROM notifications WHERE status = 'pending'`
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * 标记通知为已处理
   */
  static async markAsProcessed(id, processedBy) {
    const result = await dbManager.query(
      `UPDATE notifications
       SET status = 'processed', processed_by = $1, processed_at = NOW()
       WHERE id = $2`,
      [processedBy, id]
    );
    return result.rowCount > 0;
  }

  /**
   * 归档通知
   */
  static async archive(id) {
    const result = await dbManager.query(
      `UPDATE notifications SET status = 'archived' WHERE id = $1`,
      [id]
    );
    return result.rowCount > 0;
  }
}

module.exports = Notification;
```

**Step 2: Commit**

```bash
git add backend/models/Notification.js
git commit -m "feat: add Notification model"
```

---

## Task 3: 创建 StandardCostUpdate 模型

**Files:**
- Create: `backend/models/StandardCostUpdate.js`

**Step 1: 编写 StandardCostUpdate 模型**

```javascript
/**
 * 标准成本更新记录数据模型
 */

const dbManager = require('../db/database');

class StandardCostUpdate {
  /**
   * 创建更新记录
   */
  static async create(data) {
    const result = await dbManager.query(
      `INSERT INTO standard_cost_updates
       (notification_id, standard_cost_id, old_version, new_version, old_data, new_data, decision, decided_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        data.notificationId,
        data.standardCostId,
        data.oldVersion,
        data.newVersion,
        JSON.stringify(data.oldData),
        JSON.stringify(data.newData),
        data.decision,
        data.decidedBy
      ]
    );
    return result.rows[0].id;
  }

  /**
   * 批量创建更新记录
   */
  static async batchCreate(items) {
    if (!items || items.length === 0) return 0;

    const values = [];
    const placeholders = [];
    let paramIndex = 0;

    items.forEach((item) => {
      const start = paramIndex + 1;
      placeholders.push(`($${start}, $${start+1}, $${start+2}, $${start+3}, $${start+4}, $${start+5}, $${start+6}, $${start+8})`);
      values.push(
        item.notificationId,
        item.standardCostId,
        item.oldVersion,
        item.newVersion,
        JSON.stringify(item.oldData),
        JSON.stringify(item.newData),
        item.decision,
        item.decidedBy
      );
      paramIndex += 8;
    });

    const sql = `INSERT INTO standard_cost_updates
      (notification_id, standard_cost_id, old_version, new_version, old_data, new_data, decision, decided_by)
      VALUES ${placeholders.join(', ')}`;

    await dbManager.query(sql, values);
    return items.length;
  }

  /**
   * 根据通知ID查找更新记录
   */
  static async findByNotificationId(notificationId) {
    const result = await dbManager.query(
      `SELECT scu.*, u.real_name as decided_by_name
       FROM standard_cost_updates scu
       JOIN users u ON scu.decided_by = u.id
       WHERE scu.notification_id = $1
       ORDER BY scu.created_at DESC`,
      [notificationId]
    );
    return result.rows;
  }

  /**
   * 根据标准成本ID查找更新历史
   */
  static async findByStandardCostId(standardCostId) {
    const result = await dbManager.query(
      `SELECT scu.*, n.material_name, n.old_price, n.new_price, u.real_name as decided_by_name
       FROM standard_cost_updates scu
       JOIN notifications n ON scu.notification_id = n.id
       JOIN users u ON scu.decided_by = u.id
       WHERE scu.standard_cost_id = $1
       ORDER BY scu.decided_at DESC`,
      [standardCostId]
    );
    return result.rows;
  }
}

module.exports = StandardCostUpdate;
```

**Step 2: Commit**

```bash
git add backend/models/StandardCostUpdate.js
git commit -m "feat: add StandardCostUpdate model"
```

---

## Task 4: 创建通知生成工具函数

**Files:**
- Create: `backend/utils/notificationHelper.js`

**Step 1: 编写通知生成工具函数**

```javascript
/**
 * 通知生成工具函数
 */

const Notification = require('../models/Notification');
const StandardCost = require('../models/StandardCost');
const QuotationItem = require('../models/QuotationItem');
const SystemConfig = require('../models/SystemConfig');
const CostCalculator = require('./costCalculator');
const dbManager = require('../db/database');
const logger = require('./logger');

/**
 * 处理物料价格变更，生成或更新通知
 * @param {Object} params - 参数
 * @param {number} params.materialId - 物料ID
 * @param {string} params.materialName - 物料名称
 * @param {number} params.oldPrice - 旧价格
 * @param {number} params.newPrice - 新价格
 * @param {number} params.actorId - 触发者ID
 */
async function handleMaterialPriceChange({ materialId, materialName, oldPrice, newPrice, actorId }) {
  try {
    // 1. 查找受影响的标准成本（当前版本且包含该物料）
    const affectedStandardCosts = await findAffectedStandardCosts(materialId);

    if (affectedStandardCosts.length === 0) {
      logger.debug(`物料 ${materialName} 的变更不影响任何标准成本`);
      return null;
    }

    // 2. 计算每个标准成本的新价格
    const affectedCostsWithCalculation = await calculateNewPrices(
      affectedStandardCosts,
      materialId,
      newPrice
    );

    // 3. 检查是否有未处理的同物料通知
    const existingNotification = await Notification.findPendingByMaterial(materialId);

    if (existingNotification) {
      // 更新现有通知
      await Notification.update(existingNotification.id, {
        oldPrice,
        newPrice,
        affectedStandardCosts: affectedCostsWithCalculation
      });
      logger.info(`更新通知 ID=${existingNotification.id}，物料 ${materialName} 价格变更`);
      return existingNotification.id;
    } else {
      // 创建新通知
      const notificationId = await Notification.create({
        type: 'material_price_change',
        actorId,
        materialId,
        materialName,
        oldPrice,
        newPrice,
        affectedStandardCosts: affectedCostsWithCalculation
      });
      logger.info(`创建通知 ID=${notificationId}，物料 ${materialName} 价格变更`);
      return notificationId;
    }
  } catch (error) {
    logger.error('处理物料价格变更通知失败:', error);
    throw error;
  }
}

/**
 * 查找受影响的标准成本
 */
async function findAffectedStandardCosts(materialId) {
  const result = await dbManager.query(
    `SELECT DISTINCT sc.id, sc.packaging_config_id, sc.quotation_id, sc.quantity,
      sc.sales_type, sc.currency, m.model_name, pc.config_name as packaging_config_name
     FROM standard_costs sc
     JOIN quotations q ON sc.quotation_id = q.id
     JOIN quotation_items qi ON q.id = qi.quotation_id
     JOIN packaging_configs pc ON sc.packaging_config_id = pc.id
     JOIN models m ON pc.model_id = m.id
     WHERE sc.is_current = true
       AND qi.category = 'material'
       AND qi.material_id = $1`,
    [materialId]
  );
  return result.rows;
}

/**
 * 计算每个标准成本的新价格
 */
async function calculateNewPrices(standardCosts, materialId, newMaterialPrice) {
  const config = await SystemConfig.getCalculatorConfig();
  const calculator = new CostCalculator(config);

  const results = [];

  for (const sc of standardCosts) {
    try {
      // 获取明细
      const items = await QuotationItem.getGroupedByCategory(sc.quotation_id);

      // 更新物料价格
      let materialTotal = 0;
      let afterOverheadMaterialTotal = 0;

      for (const item of items.material.items) {
        const unitPrice = item.material_id === materialId ? newMaterialPrice : parseFloat(item.unit_price);
        const subtotal = parseFloat(item.usage_amount) * unitPrice;

        if (item.after_overhead) {
          afterOverheadMaterialTotal += subtotal;
        } else {
          materialTotal += subtotal;
        }
      }

      // 计算新价格
      const calculation = calculator.calculateQuotation({
        materialTotal,
        processTotal: parseFloat(items.process.total || 0),
        packagingTotal: parseFloat(items.packaging.total || 0),
        freightTotal: 0, // 标准成本不包含运费
        quantity: sc.quantity,
        salesType: sc.sales_type,
        includeFreightInBase: false,
        afterOverheadMaterialTotal
      });

      const oldFinalPrice = sc.sales_type === 'domestic' ? sc.domestic_price : sc.export_price;
      const newFinalPrice = sc.sales_type === 'domestic' ? calculation.domesticPrice : calculation.insurancePrice;
      const priceDiff = newFinalPrice - oldFinalPrice;
      const priceDiffRate = oldFinalPrice > 0 ? priceDiff / oldFinalPrice : 0;

      results.push({
        standard_cost_id: sc.id,
        packaging_config_id: sc.packaging_config_id,
        model_name: sc.model_name,
        packaging_config_name: sc.packaging_config_name,
        sales_type: sc.sales_type,
        old_final_price: parseFloat(oldFinalPrice.toFixed(4)),
        new_final_price: parseFloat(newFinalPrice.toFixed(4)),
        price_diff: parseFloat(priceDiff.toFixed(4)),
        price_diff_rate: parseFloat(priceDiffRate.toFixed(4))
      });
    } catch (error) {
      logger.error(`计算标准成本 ID=${sc.id} 的新价格失败:`, error);
      // 跳过这个标准成本，继续处理其他的
    }
  }

  return results;
}

module.exports = {
  handleMaterialPriceChange
};
```

**Step 2: Commit**

```bash
git add backend/utils/notificationHelper.js
git commit -m "feat: add notification helper for material price change"
```

---

## Task 5: 创建通知控制器

**Files:**
- Create: `backend/controllers/notificationController.js`

**Step 1: 编写通知控制器**

```javascript
/**
 * 通知控制器
 */

const Notification = require('../models/Notification');
const StandardCostUpdate = require('../models/StandardCostUpdate');
const StandardCost = require('../models/StandardCost');
const Quotation = require('../models/Quotation');
const QuotationItem = require('../models/QuotationItem');
const SystemConfig = require('../models/SystemConfig');
const CostCalculator = require('../utils/costCalculator');
const { success, error, paginated } = require('../utils/response');
const logger = require('../utils/logger');
const dbManager = require('../db/database');

/**
 * 获取通知列表 GET /api/notifications
 */
const getNotifications = async (req, res) => {
  try {
    const { status = 'pending', page = 1, pageSize = 20 } = req.query;

    const result = await Notification.findAll({
      status,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });

    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err) {
    logger.error('获取通知列表失败:', err);
    res.status(500).json(error('获取通知列表失败', 500));
  }
};

/**
 * 获取通知详情 GET /api/notifications/:id
 */
const getNotificationDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json(error('通知不存在', 404));
    }

    // 解析 affected_standard_costs
    const affectedStandardCosts = notification.affected_standard_costs || [];

    res.json(success({
      ...notification,
      affected_standard_costs: affectedStandardCosts,
      price_diff: notification.new_price - notification.old_price,
      price_diff_rate: notification.old_price > 0
        ? (notification.new_price - notification.old_price) / notification.old_price
        : 0
    }));
  } catch (err) {
    logger.error('获取通知详情失败:', err);
    res.status(500).json(error('获取通知详情失败', 500));
  }
};

/**
 * 获取未读通知数量 GET /api/notifications/unread-count
 */
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.getUnreadCount();
    res.json(success({ count }));
  } catch (err) {
    logger.error('获取未读通知数量失败:', err);
    res.status(500).json(error('获取未读通知数量失败', 500));
  }
};

/**
 * 处理通知（审核人员决策） POST /api/notifications/:id/process
 */
const processNotification = async (req, res) => {
  const client = await dbManager.pool.connect();

  try {
    const { id } = req.params;
    const { selected_standard_cost_ids, decision } = req.body;
    const processedBy = req.user.id;

    // 参数验证
    if (!Array.isArray(selected_standard_cost_ids)) {
      return res.status(400).json(error('selected_standard_cost_ids 必须是数组', 400));
    }
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json(error('decision 必须是 approved 或 rejected', 400));
    }

    // 获取通知详情
    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json(error('通知不存在', 404));
    }
    if (notification.status !== 'pending') {
      return res.status(400).json(error('该通知已处理', 400));
    }

    await client.query('BEGIN');

    const updatedStandardCosts = [];
    const skippedStandardCosts = [];

    // 处理每个选中的标准成本
    for (const standardCostId of selected_standard_cost_ids) {
      try {
        // 查找受影响的标准成本数据
        const affectedData = (notification.affected_standard_costs || [])
          .find(sc => sc.standard_cost_id === standardCostId);

        if (!affectedData) {
          skippedStandardCosts.push({ id: standardCostId, reason: '不在受影响列表中' });
          continue;
        }

        // 获取当前标准成本
        const currentSC = await StandardCost.findById(standardCostId);
        if (!currentSC) {
          skippedStandardCosts.push({ id: standardCostId, reason: '标准成本不存在' });
          continue;
        }

        if (decision === 'approved') {
          // 创建新版本
          const newStandardCostId = await createNewStandardCostVersion(
            client,
            currentSC,
            notification.material_id,
            notification.new_price,
            processedBy
          );

          const newSC = await StandardCost.findById(newStandardCostId);

          // 记录更新日志
          await StandardCostUpdate.create({
            notificationId: id,
            standardCostId,
            oldVersion: currentSC.version,
            newVersion: newSC.version,
            oldData: currentSC,
            newData: newSC,
            decision: 'approved',
            decidedBy: processedBy
          });

          updatedStandardCosts.push({
            id: newStandardCostId,
            model_name: currentSC.model_name,
            version: newSC.version
          });
        } else {
          // 拒绝更新，只记录日志
          await StandardCostUpdate.create({
            notificationId: id,
            standardCostId,
            oldVersion: currentSC.version,
            newVersion: currentSC.version,
            oldData: currentSC,
            newData: currentSC,
            decision: 'rejected',
            decidedBy: processedBy
          });

          skippedStandardCosts.push({ id: standardCostId, reason: '审核拒绝' });
        }
      } catch (error) {
        logger.error(`处理标准成本 ID=${standardCostId} 失败:`, error);
        skippedStandardCosts.push({ id: standardCostId, reason: error.message });
      }
    }

    // 标记通知为已处理
    await client.query(
      `UPDATE notifications SET status = 'processed', processed_by = $1, processed_at = NOW() WHERE id = $2`,
      [processedBy, id]
    );

    await client.query('COMMIT');

    res.json(success({
      message: `已处理 ${updatedStandardCosts.length} 个标准成本，跳过 ${skippedStandardCosts.length} 个`,
      updated_count: updatedStandardCosts.length,
      skipped_count: skippedStandardCosts.length,
      updated_standard_costs: updatedStandardCosts,
      skipped_standard_costs: skippedStandardCosts
    }));

  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('处理通知失败:', err);
    res.status(500).json(error('处理通知失败: ' + err.message, 500));
  } finally {
    client.release();
  }
};

/**
 * 创建新标准成本版本
 */
async function createNewStandardCostVersion(client, currentSC, materialId, newMaterialPrice, setBy) {
  // 获取原报价单明细
  const items = await QuotationItem.getGroupedByCategory(currentSC.quotation_id);

  // 更新物料价格
  const updatedMaterialItems = items.material.items.map(item => {
    if (item.material_id === materialId) {
      return { ...item, unit_price: newMaterialPrice };
    }
    return item;
  });

  // 获取系统配置
  const config = await SystemConfig.getCalculatorConfig();
  const calculator = new CostCalculator(config);

  // 计算新的原料总计
  let materialTotal = 0;
  let afterOverheadMaterialTotal = 0;

  for (const item of updatedMaterialItems) {
    const subtotal = parseFloat(item.usage_amount) * parseFloat(item.unit_price);
    if (item.after_overhead) {
      afterOverheadMaterialTotal += subtotal;
    } else {
      materialTotal += subtotal;
    }
  }

  // 重新计算成本
  const calculation = calculator.calculateQuotation({
    materialTotal,
    processTotal: parseFloat(items.process.total || 0),
    packagingTotal: parseFloat(items.packaging.total || 0),
    freightTotal: 0,
    quantity: currentSC.quantity,
    salesType: currentSC.sales_type,
    includeFreightInBase: false,
    afterOverheadMaterialTotal
  });

  // 生成新的报价单编号（内部使用）
  const quotationNo = await Quotation.generateQuotationNo();

  // 创建新报价单（状态为内部版本）
  const newQuotationResult = await client.query(
    `INSERT INTO quotations
     (quotation_no, customer_name, customer_region, model_id, regulation_id, quantity,
      freight_total, freight_per_unit, sales_type, base_cost, overhead_price, final_price,
      currency, status, created_by, packaging_config_id, include_freight_in_base)
     SELECT $1, customer_name, customer_region, model_id, regulation_id, quantity,
            0, 0, sales_type, $2, $3, $4, $5, 'draft', $6, packaging_config_id, false
     FROM quotations WHERE id = $7
     RETURNING id`,
    [
      quotationNo,
      calculation.baseCost,
      calculation.overheadPrice,
      currentSC.sales_type === 'domestic' ? calculation.domesticPrice : calculation.insurancePrice,
      currentSC.currency,
      setBy,
      currentSC.quotation_id
    ]
  );
  const newQuotationId = newQuotationResult.rows[0].id;

  // 复制明细（使用新价格）
  const allItems = [
    ...updatedMaterialItems.map(item => ({ ...item, category: 'material' })),
    ...items.process.items.map(item => ({ ...item, category: 'process' })),
    ...items.packaging.items.map(item => ({ ...item, category: 'packaging' }))
  ];

  for (const item of allItems) {
    await client.query(
      `INSERT INTO quotation_items
       (quotation_id, category, item_name, usage_amount, unit_price, subtotal, material_id, after_overhead)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        newQuotationId,
        item.category,
        item.item_name,
        item.usage_amount,
        item.unit_price,
        item.subtotal,
        item.material_id || null,
        item.after_overhead || false
      ]
    );
  }

  // 获取新版本号
  const maxVersionResult = await client.query(
    `SELECT MAX(version) as max_version FROM standard_costs WHERE packaging_config_id = $1 AND sales_type = $2`,
    [currentSC.packaging_config_id, currentSC.sales_type]
  );
  const newVersion = (maxVersionResult.rows[0].max_version || 0) + 1;

  // 旧版本标记为非当前
  await client.query(
    `UPDATE standard_costs SET is_current = false WHERE id = $1`,
    [currentSC.id]
  );

  // 创建新标准成本版本
  const newSCResult = await client.query(
    `INSERT INTO standard_costs
     (packaging_config_id, quotation_id, version, is_current, base_cost, overhead_price,
      domestic_price, export_price, quantity, currency, sales_type, set_by)
     VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      currentSC.packaging_config_id,
      newQuotationId,
      newVersion,
      calculation.baseCost,
      calculation.overheadPrice,
      calculation.domesticPrice || null,
      calculation.insurancePrice || null,
      currentSC.quantity,
      currentSC.currency,
      currentSC.sales_type,
      setBy
    ]
  );

  return newSCResult.rows[0].id;
}

module.exports = {
  getNotifications,
  getNotificationDetail,
  getUnreadCount,
  processNotification
};
```

**Step 2: Commit**

```bash
git add backend/controllers/notificationController.js
git commit -m "feat: add notification controller with CRUD and process endpoints"
```

---

## Task 6: 添加通知路由

**Files:**
- Create: `backend/routes/notificationRoutes.js`
- Modify: `backend/server.js` (添加路由注册)

**Step 1: 创建通知路由文件**

```javascript
/**
 * 通知路由
 */

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissionCheck');

// 所有路由都需要认证
router.use(verifyToken);

// 获取通知列表
router.get('/', checkPermission('notification:view'), notificationController.getNotifications);

// 获取未读通知数量
router.get('/unread-count', checkPermission('notification:view'), notificationController.getUnreadCount);

// 获取通知详情
router.get('/:id', checkPermission('notification:view'), notificationController.getNotificationDetail);

// 处理通知（审核人员决策）
router.post('/:id/process', checkPermission('notification:process'), notificationController.processNotification);

module.exports = router;
```

**Step 2: 修改 server.js 注册路由**

在 `backend/server.js` 中找到路由注册区域，添加：

```javascript
// 在文件顶部引入
const notificationRoutes = require('./routes/notificationRoutes');

// 在路由注册区域添加（约第80-100行附近）
app.use('/api/notifications', notificationRoutes);
```

**Step 3: Commit**

```bash
git add backend/routes/notificationRoutes.js backend/server.js
git commit -m "feat: add notification routes and register in server"
```

---

## Task 7: 修改物料控制器，集成通知生成

**Files:**
- Modify: `backend/controllers/master/materialCrudController.js`

**Step 1: 在 updateMaterial 方法中添加通知触发**

找到 `updateMaterial` 方法（约第72行），在价格变更后添加：

```javascript
// 在文件顶部引入
const { handleMaterialPriceChange } = require('../../utils/notificationHelper');

// 在 updateMaterial 方法中，价格更新成功后添加
const updateMaterial = async (req, res) => {
  // ... 原有代码 ...

  try {
    // ... 原有验证代码 ...

    // 获取旧价格
    const oldMaterial = await Material.findById(id);
    const oldPrice = oldMaterial.price;

    // 执行更新
    await Material.update(id, { name, unit, price, manufacturer, usage_amount });

    // 如果价格变更，触发通知生成（异步，不阻塞响应）
    if (parseFloat(price) !== parseFloat(oldPrice)) {
      handleMaterialPriceChange({
        materialId: id,
        materialName: name,
        oldPrice: parseFloat(oldPrice),
        newPrice: parseFloat(price),
        actorId: req.user.id
      }).catch(err => {
        logger.error('物料价格变更通知生成失败:', err);
      });
    }

    res.json(success({ message: '物料更新成功' }));
  } catch (err) {
    // ... 原有错误处理 ...
  }
};
```

**Step 2: Commit**

```bash
git add backend/controllers/master/materialCrudController.js
git commit -m "feat: trigger notification when material price changes"
```

---

## Task 8: 添加权限配置

**Files:**
- Modify: `backend/config/permissions.js`
- Modify: `backend/config/rolePermissions.js`

**Step 1: 添加通知权限**

在 `backend/config/permissions.js` 中添加：

```javascript
// 通知模块权限
'notification:view': { label: '查看通知', module: 'notification', description: '查看系统通知' },
'notification:process': { label: '处理通知', module: 'notification', description: '处理物料变更通知' },
```

**Step 2: 为角色分配权限**

在 `backend/config/rolePermissions.js` 中，为 `reviewer` 和 `admin` 角色添加：

```javascript
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
```

**Step 3: Commit**

```bash
git add backend/config/permissions.js backend/config/rolePermissions.js
git commit -m "feat: add notification permissions"
```

---

## Task 9: 创建前端通知 Store

**Files:**
- Create: `frontend/src/store/notification.js`

**Step 1: 编写通知 Store**

```javascript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import request from '@/utils/request'
import logger from '@/utils/logger'

export const useNotificationStore = defineStore('notification', () => {
  // State
  const notifications = ref([])
  const unreadCount = ref(0)
  const loading = ref(false)
  const currentNotification = ref(null)

  // Getters
  const pendingNotifications = computed(() =>
    notifications.value.filter(n => n.status === 'pending')
  )

  // Actions
  const fetchNotifications = async (params = {}) => {
    loading.value = true
    try {
      const res = await request.get('/notifications', { params })
      if (res.success) {
        notifications.value = res.data
        return res.data
      }
    } catch (error) {
      logger.error('获取通知列表失败:', error)
    } finally {
      loading.value = false
    }
  }

  const fetchUnreadCount = async () => {
    try {
      const res = await request.get('/notifications/unread-count')
      if (res.success) {
        unreadCount.value = res.data.count
      }
    } catch (error) {
      logger.error('获取未读通知数量失败:', error)
    }
  }

  const fetchNotificationDetail = async (id) => {
    loading.value = true
    try {
      const res = await request.get(`/notifications/${id}`)
      if (res.success) {
        currentNotification.value = res.data
        return res.data
      }
    } catch (error) {
      logger.error('获取通知详情失败:', error)
    } finally {
      loading.value = false
    }
  }

  const processNotification = async (id, selectedIds, decision = 'approved') => {
    try {
      const res = await request.post(`/notifications/${id}/process`, {
        selected_standard_cost_ids: selectedIds,
        decision
      })
      if (res.success) {
        // 更新本地状态
        const index = notifications.value.findIndex(n => n.id === id)
        if (index > -1) {
          notifications.value[index].status = 'processed'
        }
        // 刷新未读数量
        await fetchUnreadCount()
        return res.data
      }
    } catch (error) {
      logger.error('处理通知失败:', error)
      throw error
    }
  }

  return {
    notifications,
    unreadCount,
    loading,
    currentNotification,
    pendingNotifications,
    fetchNotifications,
    fetchUnreadCount,
    fetchNotificationDetail,
    processNotification
  }
})
```

**Step 2: Commit**

```bash
git add frontend/src/store/notification.js
git commit -m "feat: add notification store"
```

---

## Task 10: 创建物料变更处理弹窗组件

**Files:**
- Create: `frontend/src/components/notification/MaterialChangeDialog.vue`

**Step 1: 编写弹窗组件**

```vue
<template>
  <el-dialog
    v-model="visible"
    title="物料价格变更处理"
    width="900px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div v-loading="loading" class="material-change-dialog">
      <!-- 物料信息 -->
      <el-card class="info-card" shadow="never">
        <template #header>
          <span>物料变更信息</span>
        </template>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="物料名称">
            {{ notification?.material_name }}
          </el-descriptions-item>
          <el-descriptions-item label="价格变动">
            <span class="price-old">¥{{ formatNumber(notification?.old_price) }}</span>
            <el-icon class="arrow-icon"><ArrowRight /></el-icon>
            <span class="price-new">¥{{ formatNumber(notification?.new_price) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="变动幅度">
            <span :class="diffClass">
              {{ diffText }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="变更人">
            {{ notification?.actor_name }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 受影响标准成本 -->
      <el-card class="affected-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span>受影响的标准成本</span>
            <el-checkbox v-model="selectAll" @change="handleSelectAll">
              全选 ({{ selectedCount }}/{{ affectedList.length }})
            </el-checkbox>
          </div>
        </template>

        <el-table
          :data="affectedList"
          border
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="55" />
          <el-table-column prop="model_name" label="型号" width="150" />
          <el-table-column prop="packaging_config_name" label="包装配置" width="180" />
          <el-table-column prop="sales_type" label="销售类型" width="100">
            <template #default="{ row }">
              <el-tag :type="row.sales_type === 'domestic' ? 'primary' : 'success'">
                {{ row.sales_type === 'domestic' ? '内销' : '外销' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="原价格" width="120">
            <template #default="{ row }">
              ¥{{ formatNumber(row.old_final_price) }}
            </template>
          </el-table-column>
          <el-table-column label="新价格" width="120">
            <template #default="{ row }">
              <span class="price-new">¥{{ formatNumber(row.new_final_price) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="差价" width="100">
            <template #default="{ row }">
              <span :class="getDiffClass(row.price_diff)">
                {{ row.price_diff > 0 ? '+' : '' }}{{ formatNumber(row.price_diff) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="差率" width="100">
            <template #default="{ row }">
              <span :class="getDiffClass(row.price_diff_rate)">
                {{ row.price_diff_rate > 0 ? '+' : '' }}{{ formatPercent(row.price_diff_rate) }}
              </span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button
        type="primary"
        :disabled="selectedIds.length === 0 || processing"
        :loading="processing"
        @click="handleConfirm"
      >
        确认更新 ({{ selectedCount }})
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { formatNumber } from '@/utils/format'
import { useNotificationStore } from '@/store/notification'

const props = defineProps({
  modelValue: Boolean,
  notificationId: Number
})

const emit = defineEmits(['update:modelValue', 'processed'])

const notificationStore = useNotificationStore()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const notification = ref(null)
const affectedList = ref([])
const selectedIds = ref([])
const selectAll = ref(false)
const loading = ref(false)
const processing = ref(false)

const selectedCount = computed(() => selectedIds.value.length)

const diffText = computed(() => {
  if (!notification.value) return ''
  const diff = notification.value.new_price - notification.value.old_price
  const rate = notification.value.old_price > 0
    ? diff / notification.value.old_price
    : 0
  const sign = diff > 0 ? '+' : ''
  return `${sign}${formatNumber(diff)} (${sign}${formatPercent(rate)})`
})

const diffClass = computed(() => {
  if (!notification.value) return ''
  const diff = notification.value.new_price - notification.value.old_price
  return diff > 0 ? 'price-up' : diff < 0 ? 'price-down' : ''
})

const getDiffClass = (val) => {
  return val > 0 ? 'price-up' : val < 0 ? 'price-down' : ''
}

const formatPercent = (val) => {
  if (!val) return '0%'
  return (val * 100).toFixed(2) + '%'
}

const handleSelectAll = (val) => {
  if (val) {
    selectedIds.value = affectedList.value.map(item => item.standard_cost_id)
  } else {
    selectedIds.value = []
  }
}

const handleSelectionChange = (selection) => {
  selectedIds.value = selection.map(item => item.standard_cost_id)
  selectAll.value = selectedIds.value.length === affectedList.value.length
}

const handleConfirm = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要更新选中的 ${selectedCount.value} 个标准成本吗？`,
      '确认更新',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    processing.value = true
    const result = await notificationStore.processNotification(
      props.notificationId,
      selectedIds.value,
      'approved'
    )

    ElMessage.success(`成功更新 ${result.updated_count} 个标准成本`)
    emit('processed')
    visible.value = false
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '更新失败')
    }
  } finally {
    processing.value = false
  }
}

// 加载通知详情
const loadNotification = async () => {
  if (!props.notificationId) return

  loading.value = true
  try {
    const data = await notificationStore.fetchNotificationDetail(props.notificationId)
    notification.value = data
    affectedList.value = data.affected_standard_costs || []
  } finally {
    loading.value = false
  }
}

watch(() => props.notificationId, (newId) => {
  if (newId && visible.value) {
    loadNotification()
  }
})

watch(() => visible.value, (val) => {
  if (val && props.notificationId) {
    loadNotification()
    // 重置选择
    selectedIds.value = []
    selectAll.value = false
  }
})
</script>

<style scoped>
.material-change-dialog {
  max-height: 60vh;
  overflow-y: auto;
}

.info-card {
  margin-bottom: 16px;
}

.affected-card {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.price-old {
  color: #909399;
  text-decoration: line-through;
}

.price-new {
  color: #409EFF;
  font-weight: bold;
}

.arrow-icon {
  margin: 0 8px;
  color: #909399;
}

.price-up {
  color: #F56C6C;
}

.price-down {
  color: #67C23A;
}
</style>
```

**Step 2: Commit**

```bash
git add frontend/src/components/notification/MaterialChangeDialog.vue
git commit -m "feat: add MaterialChangeDialog component"
```

---

## Task 11: 创建通知中心页面

**Files:**
- Create: `frontend/src/views/notifications/NotificationCenter.vue`
- Create: `frontend/src/views/notifications/index.js`

**Step 1: 编写通知中心页面**

```vue
<template>
  <div class="notification-center">
    <CostPageHeader title="通知中心" :show-back="false" />

    <el-card>
      <!-- 标签页 -->
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="待处理" name="pending">
          <el-badge :value="unreadCount" v-if="unreadCount > 0" />
        </el-tab-pane>
        <el-tab-pane label="已处理" name="processed" />
        <el-tab-pane label="已归档" name="archived" />
      </el-tabs>

      <!-- 通知列表 -->
      <el-table
        v-loading="loading"
        :data="filteredNotifications"
        border
        style="width: 100%"
      >
        <el-table-column type="index" width="50" />
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getTypeType(row.type)">
              {{ getTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="物料信息" min-width="250">
          <template #default="{ row }">
            <div class="material-info">
              <div class="material-name">{{ row.material_name }}</div>
              <div class="price-change">
                <span class="price-old">¥{{ formatNumber(row.old_price) }}</span>
                <el-icon><ArrowRight /></el-icon>
                <span class="price-new">¥{{ formatNumber(row.new_price) }}</span>
                <span :class="['diff-tag', getDiffClass(row.new_price - row.old_price)]">
                  {{ getDiffText(row) }}
                </span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="影响范围" width="150">
          <template #default="{ row }">
            <el-tag type="info">{{ row.affected_count || 0 }} 个标准成本</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="提交人" width="120">
          <template #default="{ row }">
            {{ row.actor_name }}
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'pending'"
              type="primary"
              size="small"
              @click="handleProcess(row)"
            >
              去处理
            </el-button>
            <el-button
              v-else
              type="info"
              size="small"
              @click="handleViewDetail(row)"
            >
              查看
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <CommonPagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          @change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 处理弹窗 -->
    <MaterialChangeDialog
      v-model="dialogVisible"
      :notification-id="selectedNotificationId"
      @processed="handleProcessed"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import CostPageHeader from '@/components/cost/CostPageHeader.vue'
import CommonPagination from '@/components/common/CommonPagination.vue'
import MaterialChangeDialog from '@/components/notification/MaterialChangeDialog.vue'
import { useNotificationStore } from '@/store/notification'
import { formatNumber, formatDateTime } from '@/utils/format'

const notificationStore = useNotificationStore()

const activeTab = ref('pending')
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const dialogVisible = ref(false)
const selectedNotificationId = ref(null)

const loading = computed(() => notificationStore.loading)
const notifications = computed(() => notificationStore.notifications)
const unreadCount = computed(() => notificationStore.unreadCount)

const filteredNotifications = computed(() => {
  return notifications.value.filter(n => {
    if (activeTab.value === 'all') return true
    return n.status === activeTab.value
  })
})

const getTypeType = (type) => {
  const map = {
    'material_price_change': 'warning',
    'material_deleted': 'danger'
  }
  return map[type] || 'info'
}

const getTypeLabel = (type) => {
  const map = {
    'material_price_change': '价格变更',
    'material_deleted': '物料删除'
  }
  return map[type] || type
}

const getDiffClass = (diff) => {
  return diff > 0 ? 'price-up' : diff < 0 ? 'price-down' : ''
}

const getDiffText = (row) => {
  const diff = row.new_price - row.old_price
  const rate = row.old_price > 0 ? diff / row.old_price : 0
  const sign = diff > 0 ? '+' : ''
  return `${sign}${(rate * 100).toFixed(2)}%`
}

const loadNotifications = async () => {
  await notificationStore.fetchNotifications({
    status: activeTab.value,
    page: currentPage.value,
    pageSize: pageSize.value
  })
  total.value = notificationStore.notifications.length
}

const handleTabChange = () => {
  currentPage.value = 1
  loadNotifications()
}

const handlePageChange = () => {
  loadNotifications()
}

const handleProcess = (row) => {
  selectedNotificationId.value = row.id
  dialogVisible.value = true
}

const handleViewDetail = (row) => {
  selectedNotificationId.value = row.id
  dialogVisible.value = true
}

const handleProcessed = () => {
  loadNotifications()
  notificationStore.fetchUnreadCount()
}

onMounted(() => {
  loadNotifications()
  notificationStore.fetchUnreadCount()
})

watch(activeTab, () => {
  loadNotifications()
})
</script>

<style scoped>
.notification-center {
  padding: 20px;
}

.material-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.material-name {
  font-weight: bold;
}

.price-change {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.price-old {
  color: #909399;
  text-decoration: line-through;
}

.price-new {
  color: #409EFF;
  font-weight: bold;
}

.diff-tag {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.price-up {
  color: #F56C6C;
  background: #fef0f0;
}

.price-down {
  color: #67C23A;
  background: #f0f9eb;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
```

**Step 2: 创建 index.js 导出**

```javascript
import NotificationCenter from './NotificationCenter.vue'

export default NotificationCenter
```

**Step 3: Commit**

```bash
git add frontend/src/views/notifications/
git commit -m "feat: add NotificationCenter page"
```

---

## Task 12: 添加路由配置

**Files:**
- Modify: `frontend/src/router/index.js`

**Step 1: 添加通知中心路由**

在路由配置中添加：

```javascript
{
  path: '/notifications',
  name: 'NotificationCenter',
  component: () => import('@/views/notifications/NotificationCenter.vue'),
  meta: {
    title: '通知中心',
    requiresAuth: true,
    permissions: ['notification:view']
  }
}
```

**Step 2: Commit**

```bash
git add frontend/src/router/index.js
git commit -m "feat: add notification center route"
```

---

## Task 13: 修改 Header 通知组件

**Files:**
- Modify: `frontend/src/components/layout/header/NotificationDropdown.vue`

**Step 1: 修改通知下拉组件**

```vue
<template>
  <el-dropdown trigger="click" @visible-change="handleVisibleChange">
    <el-badge :value="unreadCount" :hidden="unreadCount === 0" class="notification-badge">
      <el-icon :size="20"><Bell /></el-icon>
    </el-badge>
    <template #dropdown>
      <el-dropdown-menu class="notification-dropdown">
        <div class="notification-header">
          <span>通知</span>
          <el-button type="primary" link @click="goToNotificationCenter">
            查看全部
          </el-button>
        </div>
        <el-dropdown-item
          v-for="item in recentNotifications"
          :key="item.id"
          @click="handleNotificationClick(item)"
        >
          <div class="notification-item" :class="{ unread: item.status === 'pending' }">
            <div class="notification-title">
              <el-tag size="small" :type="getTypeType(item.type)">
                {{ getTypeLabel(item.type) }}
              </el-tag>
              <span class="material-name">{{ item.material_name }}</span>
            </div>
            <div class="notification-content">
              ¥{{ formatNumber(item.old_price) }} → ¥{{ formatNumber(item.new_price) }}
              ({{ item.affected_count || 0 }}个标准成本)
            </div>
            <div class="notification-time">{{ formatTime(item.created_at) }}</div>
          </div>
        </el-dropdown-item>
        <el-dropdown-item v-if="recentNotifications.length === 0" disabled>
          <div class="no-notification">暂无通知</div>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Bell } from '@element-plus/icons-vue'
import { useNotificationStore } from '@/store/notification'
import { formatNumber } from '@/utils/format'

const router = useRouter()
const notificationStore = useNotificationStore()

const unreadCount = computed(() => notificationStore.unreadCount)
const recentNotifications = computed(() =>
  notificationStore.pendingNotifications.slice(0, 5)
)

const getTypeType = (type) => {
  const map = {
    'material_price_change': 'warning',
    'material_deleted': 'danger'
  }
  return map[type] || 'info'
}

const getTypeLabel = (type) => {
  const map = {
    'material_price_change': '价格变更',
    'material_deleted': '物料删除'
  }
  return map[type] || type
}

const formatTime = (time) => {
  if (!time) return ''
  const date = new Date(time)
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const handleVisibleChange = (visible) => {
  if (visible) {
    notificationStore.fetchUnreadCount()
    notificationStore.fetchNotifications({ status: 'pending', page: 1, pageSize: 5 })
  }
}

const handleNotificationClick = (item) => {
  router.push({
    path: '/notifications',
    query: { highlight: item.id }
  })
}

const goToNotificationCenter = () => {
  router.push('/notifications')
}

onMounted(() => {
  notificationStore.fetchUnreadCount()
})
</script>

<style scoped>
.notification-badge {
  cursor: pointer;
  padding: 8px;
}

.notification-dropdown {
  width: 320px;
  max-height: 400px;
  overflow-y: auto;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  font-weight: bold;
}

.notification-item {
  padding: 8px 0;
  width: 100%;
}

.notification-item.unread {
  background: #f5f7fa;
}

.notification-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.material-name {
  font-weight: bold;
}

.notification-content {
  font-size: 13px;
  color: #606266;
}

.notification-time {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.no-notification {
  text-align: center;
  color: #909399;
  padding: 20px;
}
</style>
```

**Step 2: Commit**

```bash
git add frontend/src/components/layout/header/NotificationDropdown.vue
git commit -m "feat: update NotificationDropdown to use notification API"
```

---

## Task 14: 添加菜单项

**Files:**
- Modify: `frontend/src/components/layout/sidebar/index.vue`

**Step 1: 在侧边栏添加通知中心菜单**

找到菜单配置，添加：

```javascript
{
  title: '通知中心',
  icon: 'Bell',
  path: '/notifications',
  permission: 'notification:view'
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/layout/sidebar/index.vue
git commit -m "feat: add notification center to sidebar menu"
```

---

## 验收测试清单

### 后端测试

- [ ] 物料价格变更后，数据库 notifications 表中生成通知记录
- [ ] GET /api/notifications 返回正确的通知列表
- [ ] GET /api/notifications/unread-count 返回正确的未读数量
- [ ] POST /api/notifications/:id/process 正确更新标准成本并生成新版本
- [ ] 同一物料多次变更，只保留最新通知（覆盖机制）

### 前端测试

- [ ] Header 通知角标显示未读数量
- [ ] 点击角标下拉显示最近通知
- [ ] 通知中心页面正常显示通知列表
- [ ] 点击"去处理"打开物料变更弹窗
- [ ] 弹窗正确显示物料信息和受影响标准成本对比
- [ ] 勾选标准成本后点击确认，成功更新
- [ ] 更新后的标准成本在列表中显示新版本号

### 集成测试

- [ ] 完整流程：修改物料价格 → 生成通知 → 审核人员查看 → 选择更新 → 生成新版本

---

## 回滚方案

如果需要回滚：

1. **代码回滚**
   ```bash
   git log --oneline -10
   git revert <commit-hash>
   ```

2. **数据库回滚**
   ```sql
   DROP TABLE IF EXISTS standard_cost_updates;
   DROP TABLE IF EXISTS notifications;
   ```

3. **清理权限配置**
   从 `permissions.js` 和 `rolePermissions.js` 中移除通知相关权限

---

**计划完成时间**: 2-3天
**开发顺序**: 按Task顺序依次执行
**测试策略**: 每个Task完成后进行单元测试，全部完成后进行集成测试
