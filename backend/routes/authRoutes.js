/**
 * 认证路由
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth/authController');
const { verifyToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissionCheck');

// 公开路由（不需要认证）
router.post('/login', authController.login);

// 注册接口 - 仅管理员可创建用户
router.post('/register', verifyToken, checkPermission('system:user:manage'), authController.register);

// 需要认证的路由
router.get('/me', verifyToken, authController.getCurrentUser);
router.post('/change-password', verifyToken, authController.changePassword);

// 管理员路由 - 用户管理
router.get('/users', verifyToken, checkPermission('system:user:view'), authController.getAllUsers);
router.put('/users/:id', verifyToken, checkPermission('system:user:manage'), authController.updateUser);
router.delete('/users/:id', verifyToken, checkPermission('system:user:manage'), authController.deleteUser);
router.post('/users/:id/reset-password', verifyToken, checkPermission('system:user:manage'), authController.resetUserPassword);
router.patch('/users/:id/toggle-status', verifyToken, checkPermission('system:user:manage'), authController.toggleUserStatus);

// 用户导入导出
const multer = require('multer');
const path = require('path');
const upload = multer({ dest: path.join(__dirname, '../uploads/temp') });
router.post('/users/import', verifyToken, checkPermission('system:user:manage'), upload.single('file'), authController.importUsers);
router.post('/users/export/excel', verifyToken, checkPermission('system:user:view'), authController.exportUsers);
router.get('/users/template/download', verifyToken, checkPermission('system:user:manage'), authController.downloadUserTemplate);

module.exports = router;
