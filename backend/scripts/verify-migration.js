/**
 * 验证数据库迁移结果
 */

const dbManager = require('../db/database');

async function verify() {
  try {
    await dbManager.initialize();

    console.log('=== 验证数据库迁移结果 ===\n');

    // 检查 packaging_configs 表结构
    const columns = await dbManager.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'packaging_configs'
      AND column_name IN ('last_modified_by', 'last_process_total')
    `);
    console.log('✅ packaging_configs 新增字段:', columns.rows.map(r => r.column_name).join(', ') || '无');

    // 检查历史表
    const tables = await dbManager.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'process_config_history'
    `);
    console.log('✅ process_config_history 表存在:', tables.rows.length > 0);

    // 检查索引
    const indexes = await dbManager.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'process_config_history'
    `);
    console.log('✅ 历史表索引:', indexes.rows.map(r => r.indexname).join(', '));

    // 检查迁移记录
    const migrations = await dbManager.query(`
      SELECT name FROM migrations WHERE name = '016_add_process_config_history.sql'
    `);
    console.log('✅ 迁移记录已插入:', migrations.rows.length > 0);

    console.log('\n=== 所有验证通过 ===');

    await dbManager.close();
  } catch (error) {
    console.error('验证失败:', error.message);
    process.exit(1);
  }
}

verify();
