/**
 * 审核管理路由
 * 处理报价单审核相关的API请求
 */

const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review/reviewController');
const { verifyToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissionCheck');

// 所有审核接口都需要认证
router.use(verifyToken);

// 审核列表 - 查看权限
router.get('/pending', checkPermission('review:view'), reviewController.getPendingList);
router.get('/approved', checkPermission('review:view'), reviewController.getApprovedList);

// 审核详情 - 查看权限
router.get('/:id/detail', checkPermission('review:view'), reviewController.getReviewDetail);

// 审核操作 - 审批权限
router.post('/:id/approve', checkPermission('review:approve'), reviewController.approveQuotation);
router.post('/:id/reject', checkPermission('review:reject'), reviewController.rejectQuotation);

// 重新提交 - 提交审核权限
router.post('/:id/resubmit', checkPermission('cost:submit'), reviewController.resubmitQuotation);

// 删除报价单 - 删除所有权限
router.delete('/:id', checkPermission('cost:delete:all'), reviewController.deleteQuotation);

module.exports = router;
