/**
 * 审核控制器 - 处理报价单审核相关操作
 */

const logger = require('../../utils/logger');
const Quotation = require('../../models/Quotation');
const QuotationItem = require('../../models/QuotationItem');
const Comment = require('../../models/Comment');
const { success, error, paginated } = require('../../utils/response');
const dbManager = require('../../db/database');
const { formatPackagingMethod } = require('../../config/packagingTypes');

/**
 * 获取待审核列表（支持分页和搜索）
 * GET /api/review/pending
 * @query {number} page - 页码，默认 1
 * @query {number} page_size - 每页条数，默认 20，最大 100
 * @query {string} keyword - 搜索关键词（匹配报价单编号、客户名称、型号）
 */
const getPendingList = async (req, res) => {
  try {
    const { keyword, start_date, end_date, page = 1, page_size, pageSize } = req.query; // 兼容两种命名
    const userRole = req.user.role;
    const userId = req.user.id;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(page_size || pageSize) || 20)); // 优先 page_size，兼容 pageSize
    
    let sql = `
      SELECT 
        q.id, q.quotation_no, q.customer_name, q.customer_region,
        q.quantity, q.sales_type, q.final_price, q.currency, q.status,
        q.created_at, q.submitted_at,
        m.model_name, r.name as regulation_name,
        u.real_name as creator_name,
        pc.config_name, pc.packaging_type, pc.layer1_qty, pc.layer2_qty, pc.layer3_qty
      FROM quotations q
      LEFT JOIN models m ON q.model_id = m.id
      LEFT JOIN regulations r ON q.regulation_id = r.id
      LEFT JOIN users u ON q.created_by = u.id
      LEFT JOIN packaging_configs pc ON q.packaging_config_id = pc.id
      WHERE q.status = 'submitted'
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (userRole === 'salesperson') { // 业务员只能看到自己提交的报价单
      sql += ` AND q.created_by = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }
    
    if (keyword && keyword.trim()) { // 关键词搜索
      const kw = `%${keyword.trim()}%`;
      sql += ` AND (q.quotation_no ILIKE $${paramIndex} OR q.customer_name ILIKE $${paramIndex + 1} OR m.model_name ILIKE $${paramIndex + 2})`;
      params.push(kw, kw, kw);
      paramIndex += 3;
    }
    
    if (start_date) {
      sql += ` AND q.submitted_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      sql += ` AND q.submitted_at <= $${paramIndex}`;
      params.push(end_date + ' 23:59:59');
      paramIndex++;
    }
    
    const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await dbManager.query(countSql, params);
    const total = parseInt(countResult.rows[0].total);
    
    sql += ` ORDER BY q.submitted_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pageSizeNum, (pageNum - 1) * pageSizeNum);
    
    const result = await dbManager.query(sql, params);
    
    const rows = result.rows.map(row => {
      let packaging_config_name = null;
      if (row.config_name && row.packaging_type) {
        const formatted = formatPackagingMethod(row.packaging_type, row.layer1_qty, row.layer2_qty, row.layer3_qty);
        packaging_config_name = row.config_name + formatted;
      }
      return { ...row, packaging_config_name };
    });
    
    res.json(paginated(rows, total, pageNum, pageSizeNum));
  } catch (err) {
    logger.error('获取待审核列表失败:', err);
    res.status(500).json(error('获取待审核列表失败', 500));
  }
};


/**
 * 获取已审核列表（支持分页和搜索）
 * GET /api/review/approved
 * @query {number} page - 页码，默认 1
 * @query {number} page_size - 每页条数，默认 20，最大 100
 * @query {string} keyword - 搜索关键词（匹配报价单编号、客户名称、型号）
 * @query {string} status - 状态过滤（approved/rejected）
 */
const getApprovedList = async (req, res) => {
  try {
    const { status, keyword, start_date, end_date, page = 1, page_size, pageSize } = req.query; // 兼容两种命名
    const userRole = req.user.role;
    const userId = req.user.id;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(page_size || pageSize) || 20)); // 优先 page_size，兼容 pageSize
    
    let sql = `
      SELECT 
        q.id, q.quotation_no, q.customer_name, q.customer_region,
        q.quantity, q.sales_type, q.final_price, q.currency, q.status,
        q.created_at, q.submitted_at, q.reviewed_at,
        m.model_name, r.name as regulation_name,
        u.real_name as creator_name,
        rv.real_name as reviewer_name,
        pc.config_name, pc.packaging_type, pc.layer1_qty, pc.layer2_qty, pc.layer3_qty
      FROM quotations q
      LEFT JOIN models m ON q.model_id = m.id
      LEFT JOIN regulations r ON q.regulation_id = r.id
      LEFT JOIN users u ON q.created_by = u.id
      LEFT JOIN users rv ON q.reviewed_by = rv.id
      LEFT JOIN packaging_configs pc ON q.packaging_config_id = pc.id
      WHERE q.status IN ('approved', 'rejected')
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (userRole === 'salesperson') { // 业务员只能看到自己提交的报价单
      sql += ` AND q.created_by = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }
    
    if (status && ['approved', 'rejected'].includes(status)) {
      sql += ` AND q.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (keyword && keyword.trim()) { // 关键词搜索
      const kw = `%${keyword.trim()}%`;
      sql += ` AND (q.quotation_no ILIKE $${paramIndex} OR q.customer_name ILIKE $${paramIndex + 1} OR m.model_name ILIKE $${paramIndex + 2})`;
      params.push(kw, kw, kw);
      paramIndex += 3;
    }
    
    if (start_date) {
      sql += ` AND q.reviewed_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      sql += ` AND q.reviewed_at <= $${paramIndex}`;
      params.push(end_date + ' 23:59:59');
      paramIndex++;
    }
    
    const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await dbManager.query(countSql, params);
    const total = parseInt(countResult.rows[0].total);
    
    sql += ` ORDER BY q.reviewed_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pageSizeNum, (pageNum - 1) * pageSizeNum);
    
    const result = await dbManager.query(sql, params);
    
    const rows = result.rows.map(row => {
      let packaging_config_name = null;
      if (row.config_name && row.packaging_type) {
        const formatted = formatPackagingMethod(row.packaging_type, row.layer1_qty, row.layer2_qty, row.layer3_qty);
        packaging_config_name = row.config_name + formatted;
      }
      return { ...row, packaging_config_name };
    });
    
    res.json(paginated(rows, total, pageNum, pageSizeNum));
  } catch (err) {
    logger.error('获取已审核列表失败:', err);
    res.status(500).json(error('获取已审核列表失败', 500));
  }
};

/** 获取报价单审核详情 - GET /api/review/:id/detail */
const getReviewDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;
    const userId = req.user.id;
    
    const quotationSql = `
      SELECT q.*, m.model_name, r.name as regulation_name, u.real_name as creator_name, rv.real_name as reviewer_name,
        pc.config_name as packaging_config_name, pc.packaging_type, pc.layer1_qty, pc.layer2_qty, pc.layer3_qty,
        pc.pc_per_bag, pc.bags_per_box, pc.boxes_per_carton
      FROM quotations q
      LEFT JOIN models m ON q.model_id = m.id
      LEFT JOIN regulations r ON q.regulation_id = r.id
      LEFT JOIN users u ON q.created_by = u.id
      LEFT JOIN users rv ON q.reviewed_by = rv.id
      LEFT JOIN packaging_configs pc ON q.packaging_config_id = pc.id
      WHERE q.id = $1
    `;
    
    const quotationResult = await dbManager.query(quotationSql, [id]);
    if (quotationResult.rows.length === 0) return res.status(404).json(error('报价单不存在', 404));
    
    const quotation = quotationResult.rows[0];
    if (userRole === 'salesperson' && quotation.created_by !== userId) {
      return res.status(403).json(error('无权限查看此报价单', 403));
    }
    
    const items = await QuotationItem.findByQuotationId(id);
    
    let standardItems = [];
    if (quotation.packaging_config_id) {
      const standardCostSql = `SELECT quotation_id FROM standard_costs WHERE packaging_config_id = $1 AND sales_type = $2 AND is_current = true LIMIT 1`;
      const standardCostResult = await dbManager.query(standardCostSql, [quotation.packaging_config_id, quotation.sales_type]);
      
      if (standardCostResult.rows.length > 0) {
        const standardQuotationId = standardCostResult.rows[0].quotation_id;
        const standardItemsSql = `SELECT category, item_name, usage_amount, unit_price, subtotal, material_id FROM quotation_items WHERE quotation_id = $1 ORDER BY category, id`;
        const standardItemsResult = await dbManager.query(standardItemsSql, [standardQuotationId]);
        standardItems = standardItemsResult.rows;
      }
    }
    
    const comments = await Comment.findByQuotationId(id);
    
    let history = [];
    try {
      const historySql = `SELECT rh.*, u.real_name as operator_name FROM review_history rh LEFT JOIN users u ON rh.operator_id = u.id WHERE rh.quotation_id = $1 ORDER BY rh.created_at ASC`;
      const historyResult = await dbManager.query(historySql, [id]);
      history = historyResult.rows;
    } catch (e) { logger.debug('审核历史表不存在，跳过'); }
    
    res.json(success({ quotation, items, standardItems, comments, history }));
  } catch (err) {
    logger.error('获取审核详情失败:', err);
    res.status(500).json(error('获取审核详情失败', 500));
  }
};


/** 审核通过 - POST /api/review/:id/approve */
const approveQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const reviewerId = req.user.id;
    const userRole = req.user.role;

    // 1. 只允许审核员审核
    if (userRole !== 'reviewer' && userRole !== 'admin') {
      return res.status(403).json(error('只有审核员可以执行审核操作', 403));
    }

    // 2. 使用行级锁防止并发竞争
    const client = await dbManager.getClient();
    try {
      await client.query('BEGIN');

      // FOR UPDATE 锁定该行，阻止其他事务同时修改
      const lockResult = await client.query(
        `SELECT * FROM quotations WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (lockResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json(error('报价单不存在', 404));
      }

      const quotation = lockResult.rows[0];

      // 3. 状态检查（在锁内再次检查，防止并发修改）
      if (quotation.status !== 'submitted') {
        await client.query('ROLLBACK');
        return res.status(400).json(error('当前状态不允许审核操作', 400));
      }

      // 4. 禁止自审核
      if (quotation.created_by === reviewerId) {
        await client.query('ROLLBACK');
        return res.status(403).json(error('不能审核自己创建的报价单', 403));
      }

      // 5. 执行审核更新
      await client.query(
        `UPDATE quotations SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [reviewerId, id]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    
    if (comment) await Comment.create({ quotation_id: id, user_id: reviewerId, content: comment });
    
    try { await dbManager.query(`INSERT INTO review_history (quotation_id, action, operator_id, comment) VALUES ($1, 'approved', $2, $3)`, [id, reviewerId, comment || null]); } catch (e) { logger.debug('记录审核历史失败:', e.message); }
    
    res.json(success({ message: '审核通过成功' }));
  } catch (err) {
    logger.error('审核通过失败:', err);
    res.status(500).json(error('审核通过失败', 500));
  }
};

/** 审核退回 - POST /api/review/:id/reject */
const rejectQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const reviewerId = req.user.id;
    const userRole = req.user.role;

    // 1. 只允许审核员退回
    if (userRole !== 'reviewer' && userRole !== 'admin') {
      return res.status(403).json(error('只有审核员可以执行退回操作', 403));
    }

    if (!reason || !reason.trim()) return res.status(400).json(error('请输入退回原因', 400));

    // 2. 使用行级锁防止并发竞争
    const client = await dbManager.getClient();
    try {
      await client.query('BEGIN');

      const lockResult = await client.query(
        `SELECT * FROM quotations WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (lockResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json(error('报价单不存在', 404));
      }

      const quotation = lockResult.rows[0];

      if (quotation.status !== 'submitted') {
        await client.query('ROLLBACK');
        return res.status(400).json(error('当前状态不允许退回操作', 400));
      }

      if (quotation.created_by === reviewerId) {
        await client.query('ROLLBACK');
        return res.status(403).json(error('不能退回自己创建的报价单', 403));
      }

      await client.query(
        `UPDATE quotations SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [reviewerId, id]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    await Comment.create({ quotation_id: id, user_id: reviewerId, content: `【退回原因】${reason}` });
    
    try { await dbManager.query(`INSERT INTO review_history (quotation_id, action, operator_id, comment) VALUES ($1, 'rejected', $2, $3)`, [id, reviewerId, reason]); } catch (e) { logger.debug('记录审核历史失败:', e.message); }
    
    res.json(success({ message: '退回成功' }));
  } catch (err) {
    logger.error('审核退回失败:', err);
    res.status(500).json(error('审核退回失败', 500));
  }
};

/** 重新提交 - POST /api/review/:id/resubmit */
const resubmitQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const quotation = await Quotation.findById(id);
    if (!quotation) return res.status(404).json(error('报价单不存在', 404));
    if (quotation.status !== 'rejected') return res.status(400).json(error('只有已退回的报价单才能重新提交', 400));
    if (quotation.created_by !== userId && req.user.role !== 'admin') return res.status(403).json(error('只有创建人才能重新提交', 403));
    
    await dbManager.query(`UPDATE quotations SET status = 'submitted', submitted_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
    
    try { await dbManager.query(`INSERT INTO review_history (quotation_id, action, operator_id) VALUES ($1, 'resubmitted', $2)`, [id, userId]); } catch (e) { logger.debug('记录审核历史失败:', e.message); }
    
    res.json(success({ message: '重新提交成功' }));
  } catch (err) {
    logger.error('重新提交失败:', err);
    res.status(500).json(error('重新提交失败', 500));
  }
};

/** 删除报价单（仅管理员） - DELETE /api/review/:id */
const deleteQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (req.user.role !== 'admin') return res.status(403).json(error('只有管理员才能删除报价单', 403));
    
    const quotation = await Quotation.findById(id);
    if (!quotation) return res.status(404).json(error('报价单不存在', 404));
    
    await dbManager.query('DELETE FROM quotations WHERE id = $1', [id]);
    res.json(success({ message: '删除成功' }));
  } catch (err) {
    logger.error('删除报价单失败:', err);
    res.status(500).json(error('删除报价单失败', 500));
  }
};

module.exports = {
  getPendingList,
  getApprovedList,
  getReviewDetail,
  approveQuotation,
  rejectQuotation,
  resubmitQuotation,
  deleteQuotation
};
