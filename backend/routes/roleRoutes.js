/**
 * 角色管理 API 路由
 * 提供角色的增删改查功能
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');
const { success, error } = require('../utils/response');
const dbManager = require('../db/database');
const logger = require('../utils/logger');

/**
 * GET /api/roles
 * 获取所有角色列表
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await dbManager.query(
      `SELECT id, code, name, description, icon, is_system, is_active, sort_order, created_at, updated_at
       FROM roles
       ORDER BY sort_order ASC, id ASC`
    );
    res.json(success(result.rows));
  } catch (err) {
    logger.error('获取角色列表失败:', err);
    res.status(500).json(error('获取角色列表失败'));
  }
});

/**
 * GET /api/roles/:id
 * 获取单个角色详情
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbManager.query(
      `SELECT id, code, name, description, icon, is_system, is_active, sort_order, created_at, updated_at
       FROM roles
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error('角色不存在'));
    }

    res.json(success(result.rows[0]));
  } catch (err) {
    logger.error('获取角色详情失败:', err);
    res.status(500).json(error('获取角色详情失败'));
  }
});

/**
 * POST /api/roles
 * 创建新角色（仅管理员）
 */
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { code, name, description, icon, sort_order } = req.body;

    // 验证必填字段
    if (!code || !name) {
      return res.status(400).json(error('角色代码和名称不能为空'));
    }

    // 验证code格式（只能包含字母、数字、下划线）
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(code)) {
      return res.status(400).json(error('角色代码只能以字母开头，包含字母、数字和下划线'));
    }

    // 检查code是否已存在
    const existingRole = await dbManager.query(
      'SELECT id FROM roles WHERE code = $1',
      [code]
    );
    if (existingRole.rows.length > 0) {
      return res.status(400).json(error('角色代码已存在'));
    }

    // 创建新角色
    const result = await dbManager.query(
      `INSERT INTO roles (code, name, description, icon, is_system, sort_order)
       VALUES ($1, $2, $3, $4, false, $5)
       RETURNING id, code, name, description, icon, is_system, is_active, sort_order, created_at, updated_at`,
      [code, name, description || '', icon || 'ri-user-line', sort_order || 0]
    );

    const newRole = result.rows[0];

    logger.info(`管理员 ${req.user.username} 创建了新角色 ${code}`, {
      role: newRole,
      operator: req.user.username
    });

    res.json(success(newRole, '角色创建成功'));
  } catch (err) {
    logger.error('创建角色失败:', err);
    res.status(500).json(error(err.message || '创建角色失败'));
  }
});

/**
 * PUT /api/roles/:id
 * 更新角色信息（仅管理员）
 */
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, is_active, sort_order } = req.body;

    // 检查角色是否存在
    const existingRole = await dbManager.query(
      'SELECT * FROM roles WHERE id = $1',
      [id]
    );
    if (existingRole.rows.length === 0) {
      return res.status(404).json(error('角色不存在'));
    }

    const role = existingRole.rows[0];

    // 系统角色只能修改部分字段（不能修改is_active，避免禁用系统角色）
    if (role.is_system && is_active === false) {
      return res.status(403).json(error('不能禁用系统预设角色'));
    }

    // 更新角色
    const result = await dbManager.query(
      `UPDATE roles
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           icon = COALESCE($3, icon),
           is_active = COALESCE($4, is_active),
           sort_order = COALESCE($5, sort_order),
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, code, name, description, icon, is_system, is_active, sort_order, created_at, updated_at`,
      [name, description, icon, is_active, sort_order, id]
    );

    const updatedRole = result.rows[0];

    logger.info(`管理员 ${req.user.username} 更新了角色 ${role.code}`, {
      role: updatedRole,
      operator: req.user.username
    });

    res.json(success(updatedRole, '角色更新成功'));
  } catch (err) {
    logger.error('更新角色失败:', err);
    res.status(500).json(error(err.message || '更新角色失败'));
  }
});

/**
 * DELETE /api/roles/:id
 * 删除角色（仅管理员）
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查角色是否存在
    const existingRole = await dbManager.query(
      'SELECT * FROM roles WHERE id = $1',
      [id]
    );
    if (existingRole.rows.length === 0) {
      return res.status(404).json(error('角色不存在'));
    }

    const role = existingRole.rows[0];

    // 系统角色不能删除
    if (role.is_system) {
      return res.status(403).json(error('系统预设角色不能删除'));
    }

    // 检查是否有用户使用该角色
    const userCount = await dbManager.query(
      'SELECT COUNT(*) as count FROM users WHERE role = $1',
      [role.code]
    );
    const count = parseInt(userCount.rows[0].count, 10);

    if (count > 0) {
      return res.status(400).json(error(`该角色下有 ${count} 个用户，无法删除。请先转移这些用户的角色。`));
    }

    // 删除角色及其权限关联
    await dbManager.transaction(async (client) => {
      // 删除角色权限关联
      await client.query('DELETE FROM role_permissions WHERE role_code = $1', [role.code]);
      // 删除角色
      await client.query('DELETE FROM roles WHERE id = $1', [id]);
    });

    logger.info(`管理员 ${req.user.username} 删除了角色 ${role.code}`, {
      role: role,
      operator: req.user.username
    });

    res.json(success(null, '角色删除成功'));
  } catch (err) {
    logger.error('删除角色失败:', err);
    res.status(500).json(error(err.message || '删除角色失败'));
  }
});

/**
 * GET /api/roles/:id/users
 * 获取使用该角色的用户列表
 */
router.get('/:id/users', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 获取角色code
    const roleResult = await dbManager.query(
      'SELECT code FROM roles WHERE id = $1',
      [id]
    );
    if (roleResult.rows.length === 0) {
      return res.status(404).json(error('角色不存在'));
    }

    const roleCode = roleResult.rows[0].code;

    // 获取使用该角色的用户
    const usersResult = await dbManager.query(
      `SELECT id, username, real_name, email, is_active, created_at
       FROM users
       WHERE role = $1
       ORDER BY id ASC`,
      [roleCode]
    );

    res.json(success(usersResult.rows));
  } catch (err) {
    logger.error('获取角色用户列表失败:', err);
    res.status(500).json(error('获取角色用户列表失败'));
  }
});

module.exports = router;
