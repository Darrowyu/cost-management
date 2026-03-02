/**
 * 标准成本控制器
 * 处理标准成本的查询、设置、恢复、删除等操作
 * PostgreSQL 异步版本
 */

const StandardCost = require('../../models/StandardCost');
const Quotation = require('../../models/Quotation');
const QuotationItem = require('../../models/QuotationItem');
const { success, error, paginated } = require('../../utils/response');

/** 获取所有当前标准成本（支持分页） GET /api/standard-costs */
const getAllStandardCosts = async (req, res, next) => {
  try {
    const { model_category, model_name, keyword, regulation_id, sales_type, page = 1, pageSize = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize) || 20));

    const result = await StandardCost.findAllCurrent({
      model_category, model_name, keyword,
      regulation_id: regulation_id ? parseInt(regulation_id) : null,
      sales_type,
      page: pageNum, pageSize: pageSizeNum
    });
    res.json(paginated(result.data, result.total, result.page, result.pageSize));
  } catch (err) {
    next(err);
  }
};

/**
 * 获取标准成本详情
 * GET /api/standard-costs/:id
 */
const getStandardCostById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const standardCost = await StandardCost.findById(id);
    if (!standardCost) {
      return res.status(404).json(error('标准成本不存在', 404));
    }

    // 获取关联的报价单明细
    const items = await QuotationItem.getGroupedByCategory(standardCost.quotation_id);

    res.json(success({
      standardCost,
      items
    }));
  } catch (err) {
    next(err);
  }
};

/**
 * 获取标准成本历史版本
 * GET /api/standard-costs/:id/history
 */
const getStandardCostHistory = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 先获取当前标准成本以获取 packaging_config_id 和 sales_type
    const standardCost = await StandardCost.findById(id);
    if (!standardCost) {
      return res.status(404).json(error('标准成本不存在', 404));
    }

    // 获取同一 packaging_config_id + sales_type 的历史版本
    const history = await StandardCost.getHistory(standardCost.packaging_config_id, standardCost.sales_type);

    res.json(success(history));
  } catch (err) {
    next(err);
  }
};

/**
 * 设置标准成本（从报价单）
 * POST /api/standard-costs
 */
const createStandardCost = async (req, res, next) => {
  try {
    const { quotation_id } = req.body;

    if (!quotation_id) {
      return res.status(400).json(error('报价单ID不能为空', 400));
    }

    // 获取报价单信息
    const quotation = await Quotation.findById(quotation_id);
    if (!quotation) {
      return res.status(404).json(error('报价单不存在', 404));
    }

    // 只有已审核通过的报价单才能设为标准成本
    if (quotation.status !== 'approved') {
      return res.status(400).json(error('只有已审核通过的报价单才能设为标准成本', 400));
    }

    if (!quotation.packaging_config_id) {
      return res.status(400).json(error('该报价单没有关联包装配置，无法设为标准成本', 400));
    }

    // 创建标准成本
    const id = await StandardCost.create({
      packaging_config_id: quotation.packaging_config_id,
      quotation_id: quotation.id,
      base_cost: quotation.base_cost,
      overhead_price: quotation.overhead_price,
      domestic_price: quotation.sales_type === 'domestic' ? quotation.final_price : null,
      export_price: quotation.sales_type === 'export' ? quotation.final_price : null,
      quantity: quotation.quantity,
      currency: quotation.currency,
      sales_type: quotation.sales_type,
      set_by: req.user.id
    });

    const newStandardCost = await StandardCost.findById(id);

    res.status(201).json(success(newStandardCost, '标准成本设置成功'));
  } catch (err) {
    next(err);
  }
};

/**
 * 恢复历史版本
 * POST /api/standard-costs/:id/restore/:version
 */
const restoreStandardCost = async (req, res, next) => {
  try {
    const { id, version } = req.params;
    const userRole = req.user.role;

    // 1. 只允许审核员恢复版本
    if (userRole !== 'reviewer' && userRole !== 'admin') {
      return res.status(403).json(error('只有审核员可以恢复标准成本版本', 403));
    }

    // 获取当前标准成本以获取 packaging_config_id 和 sales_type
    const standardCost = await StandardCost.findById(id);
    if (!standardCost) {
      return res.status(404).json(error('标准成本不存在', 404));
    }

    const newId = await StandardCost.restore(
      standardCost.packaging_config_id,
      standardCost.sales_type,
      parseInt(version),
      req.user.id
    );

    const newStandardCost = await StandardCost.findById(newId);

    res.json(success(newStandardCost, '历史版本恢复成功'));
  } catch (err) {
    if (err.message === '历史版本不存在') {
      return res.status(404).json(error(err.message, 404));
    }
    next(err);
  }
};

/**
 * 删除标准成本（删除所有版本）
 * DELETE /api/standard-costs/:packaging_config_id
 */
const deleteStandardCost = async (req, res, next) => {
  try {
    const { packaging_config_id } = req.params;

    // 检查是否存在
    const existing = await StandardCost.findCurrentByPackagingConfigId(packaging_config_id);
    if (!existing) {
      return res.status(404).json(error('标准成本不存在', 404));
    }

    const deleted = await StandardCost.deleteByPackagingConfigId(packaging_config_id);

    if (deleted) {
      res.json(success(null, '标准成本删除成功'));
    } else {
      res.status(500).json(error('删除失败', 500));
    }
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllStandardCosts,
  getStandardCostById,
  getStandardCostHistory,
  createStandardCost,
  restoreStandardCost,
  deleteStandardCost
};
