/**
 * 型号路由
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const modelController = require('../controllers/master/modelController');
const modelImageController = require('../controllers/master/modelImageController');
const { verifyToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissionCheck');

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `model_${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({ storage });

// 图片上传配置
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/temp'));
  },
  filename: (req, file, cb) => {
    cb(null, `temp_${Date.now()}_${file.originalname}`);
  }
});

const fs = require('fs');

// 文件魔数验证
const FILE_SIGNATURES = {
  'ffd8ff': 'image/jpeg',      // JPEG
  '89504e47': 'image/png',     // PNG
  '52494646': 'image/webp'     // WebP (RIFF header)
};

const validateFileSignature = (buffer, mimetype) => {
  const hex = buffer.toString('hex', 0, 4).toLowerCase();
  for (const [signature, type] of Object.entries(FILE_SIGNATURES)) {
    if (hex.startsWith(signature) && type === mimetype) return true;
  }
  return false;
};

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error('只支持 JPG/PNG/WEBP 格式'));
    } else {
      cb(null, true);
    }
  }
});

// 上传后验证文件魔数的中间件
const verifyImageSignature = async (req, res, next) => {
  if (!req.files || req.files.length === 0) return next();
  
  for (const file of req.files) {
    try {
      const buffer = fs.readFileSync(file.path);
      if (!validateFileSignature(buffer, file.mimetype)) {
        fs.unlinkSync(file.path); // 删除伪造文件
        return res.status(400).json({ success: false, message: '文件类型验证失败，请上传真实的图片文件' });
      }
    } catch (err) {
      return res.status(500).json({ success: false, message: '文件验证失败' });
    }
  }
  next();
};

// 所有路由都需要认证
router.use(verifyToken);

// 获取所有型号（支持 model_category 和 regulation_id 查询参数过滤）
router.get('/', modelController.getAllModels);

// 获取所有型号分类
router.get('/categories', modelController.getModelCategories);

// 获取所有产品系列
router.get('/series', modelController.getModelSeries);

// 获取所有型号（带BOM数量，用于BOM复制）
router.get('/with-bom-count', modelController.getModelsWithBomCount);

// 获取激活的型号
router.get('/active', modelController.getActiveModels);

// 根据法规 ID 获取型号
router.get('/regulation/:regulationId', modelController.getModelsByRegulation);

// 获取单个型号
router.get('/:id', modelController.getModelById);

// 型号图片管理
router.get('/:id/images', modelImageController.getImages);
router.post('/:id/images', checkPermission('master:model:manage'), imageUpload.array('images', 10), verifyImageSignature, modelImageController.uploadImages);
router.put('/:id/images/:imageId/primary', checkPermission('master:model:manage'), modelImageController.setPrimary);
router.delete('/:id/images/:imageId', checkPermission('master:model:manage'), modelImageController.deleteImage);

// 以下路由需要型号管理权限
router.post('/', checkPermission('master:model:manage'), modelController.createModel);
router.put('/:id', checkPermission('master:model:manage'), modelController.updateModel);
router.delete('/:id', checkPermission('master:model:manage'), modelController.deleteModel);

// 导入导出功能需要型号管理权限
router.post('/import', checkPermission('master:model:manage'), upload.single('file'), modelController.importModels);
router.post('/export/excel', checkPermission('master:model:manage'), modelController.exportModels);
router.get('/template/download', checkPermission('master:model:manage'), modelController.downloadTemplate);

module.exports = router;
