/** 型号图片控制器 */
const path = require('path');
const fs = require('fs').promises;
const ModelImage = require('../../models/ModelImage');
const Model = require('../../models/Model');
const logger = require('../../utils/logger');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/models');

/** 确保上传目录存在 */
const ensureDir = async (dir) => {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
};

/** 安全移动文件（支持跨磁盘） */
const safeMoveFile = async (source, target) => {
  try {
    // 尝试直接重命名（同磁盘下更快）
    await fs.rename(source, target);
  } catch (err) {
    if (err.code === 'EXDEV') {
      // 跨磁盘移动：先复制再删除
      await fs.copyFile(source, target);
      await fs.unlink(source);
    } else {
      throw err;
    }
  }
};

/** 上传图片 */
exports.uploadImages = async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要上传的图片' });
    }

    const model = await Model.findById(id);
    if (!model) {
      return res.status(404).json({ success: false, message: '型号不存在' });
    }

    const modelDir = path.join(UPLOAD_DIR, String(id));
    await ensureDir(modelDir);

    const hasPrimary = await ModelImage.hasPrimary(id);
    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isPrimary = !hasPrimary && i === 0;
      const fileName = `${Date.now()}_${i}_${file.originalname}`;
      const filePath = `/uploads/models/${id}/${fileName}`;
      const fullPath = path.join(modelDir, fileName);

      await safeMoveFile(file.path, fullPath);

      const image = await ModelImage.create({
        model_id: parseInt(id),
        file_name: file.originalname,
        file_path: filePath,
        file_size: file.size,
        is_primary: isPrimary
      });
      results.push(image);
    }

    res.json({ success: true, data: results, message: '上传成功' });
  } catch (err) {
    logger.error('上传图片失败:', err);
    res.status(500).json({ success: false, message: '上传失败' });
  }
};

/** 获取型号所有图片 */
exports.getImages = async (req, res) => {
  try {
    const { id } = req.params;
    const images = await ModelImage.findByModelId(id);
    res.json({ success: true, data: images });
  } catch (err) {
    logger.error('获取图片失败:', err);
    res.status(500).json({ success: false, message: '获取图片失败' });
  }
};

/** 设置主图 */
exports.setPrimary = async (req, res) => {
  try {
    const { id, imageId } = req.params;
    const image = await ModelImage.findById(imageId);
    
    if (!image || image.model_id !== parseInt(id)) {
      return res.status(404).json({ success: false, message: '图片不存在' });
    }

    await ModelImage.setPrimary(parseInt(id), parseInt(imageId));
    res.json({ success: true, message: '设置成功' });
  } catch (err) {
    logger.error('设置主图失败:', err);
    res.status(500).json({ success: false, message: '设置主图失败' });
  }
};

/** 删除图片 */
exports.deleteImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;
    const image = await ModelImage.findById(imageId);
    
    if (!image || image.model_id !== parseInt(id)) {
      return res.status(404).json({ success: false, message: '图片不存在' });
    }

    const fullPath = path.join(__dirname, '../../', image.file_path);
    try {
      await fs.unlink(fullPath);
    } catch (e) {
      logger.warn('删除文件失败:', e.message);
    }

    await ModelImage.delete(parseInt(imageId));

    if (image.is_primary) {
      const remaining = await ModelImage.findByModelId(id);
      if (remaining.length > 0) {
        await ModelImage.setPrimary(parseInt(id), remaining[0].id);
      }
    }

    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    logger.error('删除图片失败:', err);
    res.status(500).json({ success: false, message: '删除图片失败' });
  }
};
