/**
 * 工序配置历史记录数据模型
 * 记录工序配置的变更历史
 * PostgreSQL 异步版本
 */

const dbManager = require('../db/database');

function parseJson(row) {
  // pg 库会自动解析 JSONB 列，这里只需要处理可能的字符串情况
  return {
    ...row,
    old_data: typeof row.old_data === 'string' ? JSON.parse(row.old_data) : row.old_data,
    new_data: typeof row.new_data === 'string' ? JSON.parse(row.new_data) : row.new_data
  };
}

class ProcessConfigHistory {
  /**
   * 创建历史记录
   * @param {Object} data - 历史记录数据
   * @param {number} data.packaging_config_id - 包装配置ID
   * @param {number} [data.process_id] - 工序ID（可选）
   * @param {string} data.action - 操作类型 ('create'|'update'|'delete'|'batch_update'|'activate'|'deactivate')
   * @param {Object} [data.old_data] - 变更前数据，格式 { config: {...}, processes: [...] }
   * @param {Object} [data.new_data] - 变更后数据，格式 { config: {...}, processes: [...] }
   * @param {number} [data.old_process_total] - 变更前工序总价
   * @param {number} [data.new_process_total] - 变更后工序总价
   * @param {number} data.operated_by - 操作人ID
   * @returns {Promise<number>} 新历史记录的ID
   */
  static async create(data) {
    const {
      packaging_config_id,
      process_id,
      action,
      old_data,
      new_data,
      old_process_total,
      new_process_total,
      operated_by
    } = data;

    const result = await dbManager.query(
      `INSERT INTO process_config_history (
        packaging_config_id, process_id, action,
        old_data, new_data, old_process_total, new_process_total, operated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        packaging_config_id,
        process_id,
        action,
        old_data ? JSON.stringify(old_data) : null,
        new_data ? JSON.stringify(new_data) : null,
        old_process_total,
        new_process_total,
        operated_by
      ]
    );

    return result.rows[0].id;
  }

  /**
   * 批量创建历史记录
   * @param {Array} records - 历史记录数组
   * @returns {Promise<number>} 创建数量
   */
  static async createBatch(records) {
    return await dbManager.transaction(async (client) => {
      for (const record of records) {
        await client.query(
          `INSERT INTO process_config_history (
            packaging_config_id, process_id, action,
            old_data, new_data, old_process_total, new_process_total, operated_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            record.packaging_config_id,
            record.process_id,
            record.action,
            record.old_data ? JSON.stringify(record.old_data) : null,
            record.new_data ? JSON.stringify(record.new_data) : null,
            record.old_process_total,
            record.new_process_total,
            record.operated_by
          ]
        );
      }
      return records.length;
    });
  }

  /**
   * 根据包装配置ID查询历史列表
   * @param {number} packagingConfigId - 包装配置ID
   * @param {Object} options - 查询选项
   * @param {number} options.limit - 限制数量
   * @param {number} options.offset - 偏移量
   * @returns {Promise<Array>} 历史记录列表
   */
  static async findByPackagingConfigId(packagingConfigId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const result = await dbManager.query(
      `SELECT h.*, u.username as operator_name
       FROM process_config_history h
       LEFT JOIN users u ON h.operated_by = u.id
       WHERE h.packaging_config_id = $1
       ORDER BY h.operated_at DESC
       LIMIT $2 OFFSET $3`,
      [packagingConfigId, limit, offset]
    );

    return result.rows.map(parseJson);
  }

  /**
   * 查询最新的历史记录
   * @param {number} packagingConfigId - 包装配置ID
   * @returns {Promise<Object|null>} 最新历史记录或null
   */
  static async findLatestByPackagingConfigId(packagingConfigId) {
    const result = await dbManager.query(
      `SELECT h.*, u.username as operator_name
       FROM process_config_history h
       LEFT JOIN users u ON h.operated_by = u.id
       WHERE h.packaging_config_id = $1
       ORDER BY h.operated_at DESC
       LIMIT 1`,
      [packagingConfigId]
    );

    return result.rows[0] ? parseJson(result.rows[0]) : null;
  }
}

module.exports = ProcessConfigHistory;
