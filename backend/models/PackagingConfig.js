/**
 * 包装配置数据模型
 * 型号+包装方式的固定组合
 * PostgreSQL 异步版本
 * 
 * 支持多种包装类型：standard_box, no_box, blister_direct, blister_bag
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

const dbManager = require('../db/database');
const { isValidPackagingType, VALID_PACKAGING_TYPE_KEYS } = require('../config/packagingTypes');

class PackagingConfig {
  /**
   * 获取所有包装配置
   * @param {Object} [options] - 查询选项
   * @param {string} [options.packaging_type] - 按包装类型筛选
   * @param {boolean} [options.include_inactive=false] - 是否包含禁用记录
   * @returns {Promise<Array>} 包装配置列表
   */
  static async findAll(options = {}) {
    const conditions = []; // 动态条件数组
    const params = [];

    // 是否过滤禁用记录（默认过滤）
    if (!options.include_inactive) {
      conditions.push('pc.is_active = true');
    }

    if (options.packaging_type) {
      params.push(options.packaging_type);
      conditions.push(`pc.packaging_type = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT pc.id, pc.model_id, pc.config_name, pc.packaging_type,
             pc.layer1_qty, pc.layer2_qty, pc.layer3_qty,
             pc.pc_per_bag, pc.bags_per_box, pc.boxes_per_carton,
             pc.factory,
             pc.is_active, pc.created_at, pc.updated_at,
             m.model_name, m.model_category, r.name as regulation_name
      FROM packaging_configs pc
      LEFT JOIN models m ON pc.model_id = m.id
      LEFT JOIN regulations r ON m.regulation_id = r.id
      ${whereClause}
      ORDER BY pc.created_at DESC
    `;

    const result = await dbManager.query(sql, params);
    return result.rows;
  }

  /**
   * 根据型号 ID 获取包装配置
   * @param {number} modelId - 型号 ID
   * @param {Object} [options] - 查询选项
   * @param {string} [options.packaging_type] - 按包装类型筛选
   * @param {boolean} [options.include_inactive=false] - 是否包含禁用记录
   * @returns {Promise<Array>} 包装配置列表
   */
  static async findByModelId(modelId, options = {}) {
    const conditions = ['pc.model_id = $1']; // 型号ID是必须条件
    const params = [modelId];

    // 是否过滤禁用记录（默认过滤）
    if (!options.include_inactive) {
      conditions.push('pc.is_active = true');
    }

    if (options.packaging_type) {
      params.push(options.packaging_type);
      conditions.push(`pc.packaging_type = $${params.length}`);
    }

    const sql = `
      SELECT pc.id, pc.model_id, pc.config_name, pc.packaging_type,
             pc.layer1_qty, pc.layer2_qty, pc.layer3_qty,
             pc.pc_per_bag, pc.bags_per_box, pc.boxes_per_carton,
             pc.factory,
             pc.is_active, pc.created_at, pc.updated_at,
             m.model_name, m.model_category, r.name as regulation_name
      FROM packaging_configs pc
      LEFT JOIN models m ON pc.model_id = m.id
      LEFT JOIN regulations r ON m.regulation_id = r.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY pc.created_at DESC
    `;

    const result = await dbManager.query(sql, params);
    return result.rows;
  }


  /**
   * 根据 ID 查找包装配置
   * @param {number} id - 配置 ID
   * @returns {Promise<Object|null>} 包装配置对象或 null
   */
  static async findById(id) {
    const result = await dbManager.query(
      `SELECT pc.id, pc.model_id, pc.config_name, pc.packaging_type,
              pc.layer1_qty, pc.layer2_qty, pc.layer3_qty,
              pc.pc_per_bag, pc.bags_per_box, pc.boxes_per_carton,
              pc.factory,
              pc.is_active, pc.created_at, pc.updated_at,
              pc.last_modified_by, pc.last_process_total,
              m.model_name, m.model_category, r.name as regulation_name,
              u.real_name as last_modified_by_name, u.username as last_modified_by_username
       FROM packaging_configs pc
       LEFT JOIN models m ON pc.model_id = m.id
       LEFT JOIN regulations r ON m.regulation_id = r.id
       LEFT JOIN users u ON pc.last_modified_by = u.id
       WHERE pc.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * 按包装类型筛选配置
   * @param {string} packagingType - 包装类型标识
   * @returns {Promise<Array>} 包装配置列表
   */
  static async findByType(packagingType) {
    if (!isValidPackagingType(packagingType)) {
      throw new Error(`无效的包装类型: ${packagingType}`);
    }

    const result = await dbManager.query(
      `SELECT pc.id, pc.model_id, pc.config_name, pc.packaging_type,
              pc.layer1_qty, pc.layer2_qty, pc.layer3_qty,
              pc.pc_per_bag, pc.bags_per_box, pc.boxes_per_carton,
              pc.factory,
              pc.is_active, pc.created_at, pc.updated_at,
              m.model_name, m.model_category, r.name as regulation_name
       FROM packaging_configs pc
       LEFT JOIN models m ON pc.model_id = m.id
       LEFT JOIN regulations r ON m.regulation_id = r.id
       WHERE pc.packaging_type = $1 AND pc.is_active = true
       ORDER BY pc.created_at DESC`,
      [packagingType]
    );
    return result.rows;
  }

  /**
   * 按包装类型分组查询配置
   * @param {Object} [options] - 查询选项
   * @param {number} [options.model_id] - 按型号筛选
   * @returns {Promise<Object>} 按包装类型分组的配置对象
   */
  static async findGroupedByType(options = {}) {
    let sql = `
      SELECT pc.id, pc.model_id, pc.config_name, pc.packaging_type,
             pc.layer1_qty, pc.layer2_qty, pc.layer3_qty,
             pc.pc_per_bag, pc.bags_per_box, pc.boxes_per_carton,
             pc.factory,
             pc.is_active, pc.created_at, pc.updated_at,
             m.model_name, m.model_category, r.name as regulation_name
      FROM packaging_configs pc
      LEFT JOIN models m ON pc.model_id = m.id
      LEFT JOIN regulations r ON m.regulation_id = r.id
      WHERE pc.is_active = true
    `;
    const params = [];

    if (options.model_id) {
      params.push(options.model_id);
      sql += ` AND pc.model_id = $${params.length}`;
    }

    sql += ` ORDER BY pc.packaging_type, pc.created_at DESC`;

    const result = await dbManager.query(sql, params);

    // 按 packaging_type 分组
    const grouped = {};
    for (const type of VALID_PACKAGING_TYPE_KEYS) {
      grouped[type] = [];
    }

    for (const row of result.rows) {
      if (grouped[row.packaging_type]) {
        grouped[row.packaging_type].push(row);
      }
    }

    return grouped;
  }

  /**
   * 检查配置名称是否已存在
   * @param {number} modelId - 型号 ID
   * @param {string} configName - 配置名称
   * @returns {Promise<boolean>} 是否存在
   */
  static async existsByModelAndName(modelId, configName) {
    const result = await dbManager.query(
      `SELECT COUNT(*) as count
       FROM packaging_configs
       WHERE model_id = $1 AND config_name = $2 AND is_active = true`,
      [modelId, configName]
    );
    return parseInt(result.rows[0].count) > 0;
  }


  /**
   * 创建包装配置
   * @param {Object} data - 配置数据
   * @param {number} data.model_id - 型号 ID
   * @param {string} data.config_name - 配置名称
   * @param {string} [data.packaging_type='standard_box'] - 包装类型
   * @param {number} data.layer1_qty - 第一层数量
   * @param {number} data.layer2_qty - 第二层数量
   * @param {number} [data.layer3_qty] - 第三层数量（2层类型可为空）
   * @param {string} [data.factory='dongguan_xunan'] - 工厂/供应商
   * @returns {Promise<number>} 新配置的 ID
   */
  static async create(data) {
    const {
      model_id,
      config_name,
      packaging_type = 'standard_box',
      layer1_qty,
      layer2_qty,
      layer3_qty,
      factory = 'dongguan_xunan',
      // 兼容旧字段名
      pc_per_bag,
      bags_per_box,
      boxes_per_carton
    } = data;

    // 验证包装类型
    if (!isValidPackagingType(packaging_type)) {
      throw new Error(`无效的包装类型: ${packaging_type}`);
    }

    // 使用新字段名，如果没有则回退到旧字段名
    const l1 = layer1_qty !== undefined ? layer1_qty : pc_per_bag;
    const l2 = layer2_qty !== undefined ? layer2_qty : bags_per_box;
    const l3 = layer3_qty !== undefined ? layer3_qty : boxes_per_carton;

    // 旧字段 boxes_per_carton 有 NOT NULL 约束，对于 2 层类型需要设置默认值 1
    const l3ForOldField = l3 !== null && l3 !== undefined ? l3 : 1;

    const result = await dbManager.query(
      `INSERT INTO packaging_configs 
       (model_id, config_name, packaging_type, layer1_qty, layer2_qty, layer3_qty, factory, pc_per_bag, bags_per_box, boxes_per_carton)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [model_id, config_name, packaging_type, l1, l2, l3, factory, l1, l2, l3ForOldField]
    );

    return result.rows[0].id;
  }

  /**
   * 更新包装配置
   * @param {number} id - 配置 ID
   * @param {Object} data - 更新的数据
   * @returns {Promise<Object>} 更新结果 { rowCount }
   */
  static async update(id, data) {
    const {
      config_name,
      packaging_type,
      layer1_qty,
      layer2_qty,
      layer3_qty,
      factory,
      is_active,
      // 兼容旧字段名
      pc_per_bag,
      bags_per_box,
      boxes_per_carton
    } = data;

    // 如果提供了 packaging_type，验证其有效性
    if (packaging_type !== undefined && !isValidPackagingType(packaging_type)) {
      throw new Error(`无效的包装类型: ${packaging_type}`);
    }

    // 使用新字段名，如果没有则回退到旧字段名
    const l1 = layer1_qty !== undefined ? layer1_qty : pc_per_bag;
    const l2 = layer2_qty !== undefined ? layer2_qty : bags_per_box;
    const l3 = layer3_qty !== undefined ? layer3_qty : boxes_per_carton;

    // 旧字段 boxes_per_carton 有 NOT NULL 约束，对于 2 层类型需要设置默认值 1
    const l3ForOldField = l3 !== null && l3 !== undefined ? l3 : 1;

    const result = await dbManager.query(
      `UPDATE packaging_configs
       SET config_name = $1, 
           packaging_type = COALESCE($2, packaging_type),
           layer1_qty = $3, layer2_qty = $4, layer3_qty = $5,
           factory = COALESCE($6, factory),
           pc_per_bag = $3, bags_per_box = $4, boxes_per_carton = $8,
           is_active = $9, updated_at = NOW()
       WHERE id = $7`,
      [config_name, packaging_type, l1, l2, l3, factory, id, l3ForOldField, is_active]
    );

    return { rowCount: result.rowCount };
  }


  /**
   * 删除包装配置（软删除）
   * @param {number} id - 配置 ID
   * @returns {Promise<Object>} 删除结果 { rowCount }
   */
  static async delete(id) {
    // 先获取当前配置信息
    const config = await this.findById(id);
    if (!config) {
      throw new Error('配置不存在');
    }

    // 软删除时，在配置名称后添加删除标记和时间戳，避免唯一性约束冲突
    const deletedName = `${config.config_name}_deleted_${Date.now()}`;

    const result = await dbManager.query(
      `UPDATE packaging_configs
       SET is_active = false, 
           config_name = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [deletedName, id]
    );

    return { rowCount: result.rowCount };
  }

  /**
   * 获取包装配置及其工序列表
   * @param {number} id - 配置 ID
   * @returns {Promise<Object|null>} 包装配置对象（含工序）或 null
   */
  static async findWithProcesses(id) {
    // 获取包装配置
    const configResult = await dbManager.query(
      `SELECT pc.id, pc.model_id, pc.config_name, pc.packaging_type,
              pc.layer1_qty, pc.layer2_qty, pc.layer3_qty,
              pc.pc_per_bag, pc.bags_per_box, pc.boxes_per_carton,
              pc.factory,
              pc.is_active, pc.created_at, pc.updated_at,
              pc.last_modified_by, pc.last_process_total,
              m.model_name, m.model_category, r.name as regulation_name,
              u.real_name as last_modified_by_name
       FROM packaging_configs pc
       LEFT JOIN models m ON pc.model_id = m.id
       LEFT JOIN regulations r ON m.regulation_id = r.id
       LEFT JOIN users u ON pc.last_modified_by = u.id
       WHERE pc.id = $1`,
      [id]
    );
    if (configResult.rows.length === 0) return null;
    const config = configResult.rows[0];

    // 获取工序列表
    const processResult = await dbManager.query(
      `SELECT id, packaging_config_id, process_name, unit_price, sort_order, is_active, created_at, updated_at FROM process_configs
       WHERE packaging_config_id = $1 AND is_active = true
       ORDER BY sort_order, id`,
      [id]
    );
    config.processes = processResult.rows;

    return config;
  }

  /**
   * 获取包装配置及其工序和包材列表
   * @param {number} id - 配置 ID
   * @returns {Promise<Object|null>} 包装配置对象（含工序和包材）或 null
   */
  static async findWithDetails(id) {
    // 获取包装配置
    const config = await this.findById(id);
    if (!config) return null;

    // 获取工序列表
    const processResult = await dbManager.query(
      `SELECT id, packaging_config_id, process_name, unit_price, sort_order, is_active, created_at, updated_at FROM process_configs
       WHERE packaging_config_id = $1 AND is_active = true
       ORDER BY sort_order, id`,
      [id]
    );
    config.processes = processResult.rows;

    // 获取包材列表
    const materialResult = await dbManager.query(
      `SELECT id, packaging_config_id, material_name, basic_usage, unit_price, carton_volume, sort_order, is_active, created_at, updated_at FROM packaging_materials
       WHERE packaging_config_id = $1 AND is_active = true
       ORDER BY sort_order, id`,
      [id]
    );
    config.materials = materialResult.rows;

    return config;
  }

  /**
   * 更新最后修改信息
   * @param {number} id - 配置 ID
   * @param {Object} data - 更新数据
   * @param {number} data.last_modified_by - 最后修改人 ID
   * @param {number} data.last_process_total - 工序合计
   * @returns {Promise<Object>} 更新结果 { rowCount }
   */
  static async updateLastModified(id, data) {
    const { last_modified_by, last_process_total } = data;
    const result = await dbManager.query(
      `UPDATE packaging_configs
       SET last_modified_by = $1, last_process_total = $2, updated_at = NOW()
       WHERE id = $3`,
      [last_modified_by, last_process_total, id]
    );
    return { rowCount: result.rowCount };
  }
}

module.exports = PackagingConfig;
