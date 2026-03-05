/**
 * 法规类别路由
 */

const express = require('express');
const router = express.Router();
const regulationController = require('../controllers/master/regulationController');
const { verifyToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissionCheck');

// 所有路由都需要认证
router.use(verifyToken);

// 获取所有法规类别
router.get('/', regulationController.getAllRegulations);

// 获取激活的法规类别
router.get('/active', regulationController.getActiveRegulations);

// 获取单个法规类别
router.get('/:id', regulationController.getRegulationById);

// 以下路由需要法规管理权限
router.post('/', checkPermission('master:regulation:manage'), regulationController.createRegulation);
router.put('/:id', checkPermission('master:regulation:manage'), regulationController.updateRegulation);
router.delete('/:id', checkPermission('master:regulation:manage'), regulationController.deleteRegulation);

module.exports = router;
