/**
 * 系统配置路由
 */

const express = require('express');
const router = express.Router();
const configController = require('../controllers/system/configController');
const { verifyToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissionCheck');

// 所有配置路由都需要认证
router.use(verifyToken);

// 获取所有配置（所有角色可访问）
router.get('/', configController.getAllConfigs);

// 获取计算器配置（所有角色可访问）
router.get('/calculator', configController.getCalculatorConfig);

// 获取包装类型列表（所有角色可访问）
router.get('/packaging-types', configController.getPackagingTypes);

// 获取单个配置（所有角色可访问）
router.get('/:key', configController.getConfigByKey);

// 以下路由需要系统配置管理权限
router.put('/:key', checkPermission('system:config:manage'), configController.updateConfig);
router.post('/batch', checkPermission('system:config:manage'), configController.batchUpdateConfigs);
router.post('/', checkPermission('system:config:manage'), configController.createConfig);
router.delete('/:key', checkPermission('system:config:manage'), configController.deleteConfig);

module.exports = router;
