/**
 * 角色权限检查中间件
 */

const { error } = require('../utils/response');

// 检查用户是否具有指定角色
const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(error('未授权访问', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json(error(`您没有权限执行此操作，需要角色：${allowedRoles.join(' 或 ')}`, 403));
    }

    next();
  };
};

// 检查是否为管理员
const isAdmin = checkRole('admin');

// 检查是否为采购
const isPurchaser = checkRole('admin', 'purchaser');

// 检查是否为生产
const isProducer = checkRole('admin', 'producer');

// 检查是否为审核人
const isReviewer = checkRole('admin', 'reviewer');

// 检查是否为管理员或审核人
const isAdminOrReviewer = checkRole('admin', 'reviewer');

// 检查是否为业务员
const isSalesperson = checkRole('admin', 'salesperson');

// 检查是否有读取权限（所有角色）
const canRead = checkRole('admin', 'purchaser', 'producer', 'reviewer', 'salesperson', 'readonly');

module.exports = {
  checkRole,
  isAdmin,
  isPurchaser,
  isProducer,
  isReviewer,
  isAdminOrReviewer,
  isSalesperson,
  canRead
};
