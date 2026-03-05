/**
 * 标准成本路由
 */

const express = require('express');
const router = express.Router();
const standardCostController = require('../controllers/review/standardCostController');
const { verifyToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissionCheck');

// 所有路由都需要认证
router.use(verifyToken);

// 获取所有当前标准成本（所有用户可访问）
router.get('/', standardCostController.getAllStandardCosts);

// 获取标准成本详情（所有用户可访问）
router.get('/:id', standardCostController.getStandardCostById);

// 获取标准成本历史版本（仅管理员/审核人可访问）
router.get('/:id/history', checkPermission('cost:view'), standardCostController.getStandardCostHistory);

// 设置标准成本（仅管理员/审核人可访问）
router.post('/', checkPermission('cost:manage'), standardCostController.createStandardCost);

// 恢复历史版本（仅管理员/审核人可访问）
router.post('/:id/restore/:version', checkPermission('cost:manage'), standardCostController.restoreStandardCost);

// 删除标准成本（仅管理员/审核人可访问）
router.delete('/:packaging_config_id', checkPermission('cost:manage'), standardCostController.deleteStandardCost);

module.exports = router;
