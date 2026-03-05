/** BOM路由 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const bomController = require('../controllers/master/bomController');
const { verifyToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissionCheck');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(verifyToken); // 所有路由需要认证

router.get('/template/download', bomController.downloadTemplate); // 下载导入模板
router.get('/:modelId', bomController.getBomByModelId); // 获取型号BOM
router.post('/import', checkPermission('master:bom:manage'), upload.single('file'), bomController.importBom); // 导入BOM
router.post('/copy', checkPermission('master:bom:manage'), bomController.copyBom); // 复制BOM
router.post('/', checkPermission('master:bom:manage'), bomController.createBomItem); // 添加BOM原料
router.put('/batch/:modelId', checkPermission('master:bom:manage'), bomController.batchUpdateBom); // 批量更新
router.put('/:id', checkPermission('master:bom:manage'), bomController.updateBomItem); // 更新BOM原料
router.delete('/:id', checkPermission('master:bom:manage'), bomController.deleteBomItem); // 删除BOM原料

module.exports = router;
