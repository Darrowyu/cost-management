/**
 * 工序管理路由
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const processController = require('../controllers/processController');
const processHistoryController = require('../controllers/process/processHistoryController');
const { verifyToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      return cb(new Error('只支持 Excel 文件'));
    }
    cb(null, true);
  }
});

// 所有路由都需要认证
router.use(verifyToken);

// 包装配置路由
router.get('/packaging-configs', processController.getAllPackagingConfigs);
router.get('/packaging-configs/grouped', processController.getPackagingConfigsGrouped);
router.get('/packaging-configs/with-material-count', processController.getPackagingConfigsWithMaterialCount);
router.get('/packaging-configs/with-process-count', processController.getPackagingConfigsWithProcessCount);
router.get('/packaging-configs/model/:modelId', processController.getPackagingConfigsByModel);
router.get('/packaging-configs/:id', processController.getPackagingConfigDetail);
router.get('/packaging-configs/:id/full', processController.getPackagingConfigFullDetail);
router.post('/packaging-configs', checkRole('admin', 'producer'), processController.createPackagingConfig);
router.post('/packaging-configs/batch-delete', checkRole('admin', 'producer'), processController.batchDeletePackagingConfigs);
router.put('/packaging-configs/:id', checkRole('admin', 'producer', 'purchaser'), processController.updatePackagingConfig);
router.delete('/packaging-configs/:id', checkRole('admin', 'producer'), processController.deletePackagingConfig);

// 工序配置路由
router.get('/process-configs/:packagingConfigId', processController.getProcessConfigs);
router.post('/process-configs', checkRole('admin', 'producer'), processController.createProcessConfig);
router.put('/process-configs/:id', checkRole('admin', 'producer'), processController.updateProcessConfig);
router.delete('/process-configs/:id', checkRole('admin', 'producer'), processController.deleteProcessConfig);

// 包材配置路由
// 采购人员可以管理包材，生产人员只能查看
router.get('/packaging-materials/:packagingConfigId', processController.getPackagingMaterials);
router.post('/packaging-materials', checkRole('admin', 'purchaser'), processController.createPackagingMaterial);
router.put('/packaging-materials/:id', checkRole('admin', 'purchaser'), processController.updatePackagingMaterial);
router.delete('/packaging-materials/:id', checkRole('admin', 'purchaser'), processController.deletePackagingMaterial);

// 工序 Excel 导入导出
router.post('/process-configs/import', upload.single('file'), checkRole('admin', 'producer'), processController.importProcesses);
router.post('/process-configs/export/excel', checkRole('admin', 'producer'), processController.exportProcesses);
router.get('/process-configs/template/download', checkRole('admin', 'producer'), processController.downloadProcessTemplate);

// 包材 Excel 导入导出
// 采购人员可以导入导出包材，生产人员只能查看
router.post('/packaging-materials/import', upload.single('file'), checkRole('admin', 'purchaser'), processController.importPackagingMaterials);
router.post('/packaging-materials/export/excel', checkRole('admin', 'purchaser'), processController.exportPackagingMaterials);
router.get('/packaging-materials/template/download', checkRole('admin', 'purchaser'), processController.downloadPackagingMaterialTemplate);

// 工序配置历史记录路由
router.get('/packaging-configs/:id/history', verifyToken, processHistoryController.getHistoryByPackagingConfigId);
router.get('/packaging-configs/:id/history/latest', verifyToken, processHistoryController.getLatestHistory);

module.exports = router;
