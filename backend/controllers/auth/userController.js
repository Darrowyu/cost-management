/**
 * 用户管理控制器
 * 处理用户列表、更新、删除、重置密码、状态切换
 * 拆分自 authController.js
 */

const User = require('../../models/User');
const { success, error } = require('../../utils/response');
const logger = require('../../utils/logger');
const bcrypt = require('bcrypt');
const dbManager = require('../../db/database');

// 获取所有用户（管理员）
const getAllUsers = async (req, res, next) => {
    try {
        const users = await User.findAll();

        // 不返回密码字段
        const usersWithoutPassword = users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });

        res.json(success(usersWithoutPassword));
    } catch (err) {
        next(err);
    }
};

// 更新用户信息（管理员）
const updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { username, real_name, email, role, is_active } = req.body;

        // 检查用户是否存在
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json(error('用户不存在', 404));
        }

        // 不能禁用管理员账号
        if (user.username === 'admin' && is_active === false) {
            return res.status(400).json(error('不能禁用管理员账号', 400));
        }

        // 如果修改用户名，检查新用户名是否已存在
        if (username && username !== user.username) {
            const existingUser = await User.findByUsername(username);
            if (existingUser) {
                return res.status(400).json(error('用户代号已存在', 400));
            }
        }

        // 验证角色是否合法（从数据库查询）
        if (role) {
            const roleResult = await dbManager.query(
                'SELECT code FROM roles WHERE code = $1 AND is_active = true',
                [role]
            );
            if (roleResult.rows.length === 0) {
                return res.status(400).json(error('无效的角色类型', 400));
            }
        }

        await User.update(id, { username, real_name, email, role, is_active });

        res.json(success(null, '用户信息更新成功'));
    } catch (err) {
        next(err);
    }
};

// 删除用户（管理员）
const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;

        // 不能删除管理员账号
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json(error('用户不存在', 404));
        }

        if (user.username === 'admin') {
            return res.status(400).json(error('不能删除管理员账号', 400));
        }

        // 管理员删除用户时，自动处理关联的报价单
        // 1. 删除用户创建的所有报价单
        // 2. 将用户审核的报价单的 reviewed_by 设置为 NULL
        const result = await User.deleteWithRelations(id);

        if (!result.success) {
            return res.status(500).json(error('删除用户失败', 500));
        }

        res.json(success({
            deletedQuotations: result.deletedQuotations,
            updatedQuotations: result.updatedQuotations
        }, `用户删除成功。已删除 ${result.deletedQuotations} 个报价单，更新 ${result.updatedQuotations} 个审核记录。`));
    } catch (err) {
        logger.error('删除用户失败:', err);
        next(err);
    }
};

// 重置用户密码（管理员）
const resetUserPassword = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json(error('新密码不能为空', 400));
        }

        // 加密新密码
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 更新密码
        await User.updatePassword(id, hashedPassword);

        res.json(success(null, '密码重置成功'));
    } catch (err) {
        next(err);
    }
};

// 禁用/启用用户（管理员）
const toggleUserStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        // 检查用户是否存在
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json(error('用户不存在', 404));
        }

        // 不能禁用管理员账号
        if (user.username === 'admin' && is_active === false) {
            return res.status(400).json(error('不能禁用管理员账号', 400));
        }

        // 更新用户状态
        await User.update(id, { is_active });

        const statusText = is_active ? '启用' : '禁用';
        res.json(success(null, `用户${statusText}成功`));
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getAllUsers,
    updateUser,
    deleteUser,
    resetUserPassword,
    toggleUserStatus
};
