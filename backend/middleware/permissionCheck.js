/**
 * 权限码检查中间件
 * 基于权限码进行访问控制
 */

const { error } = require('../utils/response');
const { getRolePermissionsFromDB } = require('../utils/permissions');
const logger = require('../utils/logger');

/**
 * 检查用户是否具有指定权限
 * @param {string} permissionCode - 权限码
 */
const checkPermission = (permissionCode) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(error('未授权访问', 401));
    }

    // 管理员直接通过
    if (req.user.role === 'admin') {
      return next();
    }

    try {
      // 获取用户权限列表
      const permissions = await getRolePermissionsFromDB(req.user.role);

      if (permissions.includes(permissionCode)) {
        return next();
      }

      return res.status(403).json(error(`您没有权限执行此操作，需要权限：${permissionCode}`, 403));
    } catch (err) {
      logger.error('权限检查失败:', err);
      return res.status(500).json(error('权限检查失败', 500));
    }
  };
};

/**
 * 检查用户是否具有任意一个指定权限
 * @param {string[]} permissionCodes - 权限码数组
 */
const checkAnyPermission = (permissionCodes) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(error('未授权访问', 401));
    }

    // 管理员直接通过
    if (req.user.role === 'admin') {
      return next();
    }

    try {
      // 获取用户权限列表
      const permissions = await getRolePermissionsFromDB(req.user.role);

      // 检查是否有任意一个权限
      const hasAny = permissionCodes.some(code => permissions.includes(code));

      if (hasAny) {
        return next();
      }

      return res.status(403).json(error(`您没有权限执行此操作，需要任意权限：${permissionCodes.join(' 或 ')}`, 403));
    } catch (err) {
      logger.error('权限检查失败:', err);
      return res.status(500).json(error('权限检查失败', 500));
    }
  };
};

/**
 * 检查用户是否具有所有指定权限
 * @param {string[]} permissionCodes - 权限码数组
 */
const checkAllPermissions = (permissionCodes) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(error('未授权访问', 401));
    }

    // 管理员直接通过
    if (req.user.role === 'admin') {
      return next();
    }

    try {
      // 获取用户权限列表
      const permissions = await getRolePermissionsFromDB(req.user.role);

      // 检查是否拥有所有权限
      const hasAll = permissionCodes.every(code => permissions.includes(code));

      if (hasAll) {
        return next();
      }

      return res.status(403).json(error(`您没有权限执行此操作，需要全部权限：${permissionCodes.join(', ')}`, 403));
    } catch (err) {
      logger.error('权限检查失败:', err);
      return res.status(500).json(error('权限检查失败', 500));
    }
  };
};

module.exports = {
  checkPermission,
  checkAnyPermission,
  checkAllPermissions
};
