/**
 * 认证控制器
 * 包含核心认证逻辑，并汇总导出用户管理功能
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const { success, error } = require('../../utils/response');
const dbManager = require('../../db/database');

// 导入子模块功能
const userController = require('./userController');
const userImportExport = require('./userImportExport');

// 用户登录
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // 验证必填字段
    if (!username || !password) {
      return res.status(400).json(error('用户名和密码不能为空', 400));
    }

    // 查找用户
    const user = await User.findByUsername(username);
    if (!user) {
      return res.status(401).json(error('用户名或密码错误', 401));
    }

    // 检查用户是否被禁用
    if (user.is_active === 0 || user.is_active === false) {
      return res.status(403).json(error('该账号已被禁用，请联系管理员', 403));
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json(error('用户名或密码错误', 401));
    }

    // 生成 JWT Token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // 返回用户信息和 token（不包含密码）
    res.json(success({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        real_name: user.real_name,
        email: user.email
      }
    }, '登录成功'));

  } catch (err) {
    next(err);
  }
};

// 用户注册
const register = async (req, res, next) => {
  try {
    const { username, password, role, real_name, email } = req.body;

    // 验证必填字段
    if (!username || !password || !role) {
      return res.status(400).json(error('用户名、密码和角色不能为空', 400));
    }

    // 验证角色是否合法（从数据库查询）
    const roleResult = await dbManager.query(
      'SELECT code FROM roles WHERE code = $1 AND is_active = true',
      [role]
    );
    if (roleResult.rows.length === 0) {
      return res.status(400).json(error('无效的角色类型', 400));
    }

    // 检查用户名是否已存在
    if (await User.exists(username)) {
      return res.status(400).json(error('用户名已存在', 400));
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const userId = await User.create({
      username,
      password: hashedPassword,
      role,
      real_name,
      email
    });

    res.status(201).json(success({ id: userId }, '注册成功'));

  } catch (err) {
    next(err);
  }
};

// 获取当前用户信息
const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json(error('用户不存在', 404));
    }

    // 返回用户信息（不包含密码）
    res.json(success({
      id: user.id,
      username: user.username,
      role: user.role,
      real_name: user.real_name,
      email: user.email
    }));

  } catch (err) {
    next(err);
  }
};

// 修改密码
const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json(error('旧密码和新密码不能为空', 400));
    }

    // 获取当前用户
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json(error('用户不存在', 404));
    }

    // 验证旧密码
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json(error('旧密码错误', 401));
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await User.updatePassword(req.user.id, hashedPassword);

    res.json(success(null, '密码修改成功'));

  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  register,
  getCurrentUser,
  changePassword,
  // 导出子模块功能
  ...userController,
  ...userImportExport
};
