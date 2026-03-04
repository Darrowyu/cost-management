/**
 * 检查历史记录数据，诊断 JSON 解析问题
 */

const dbManager = require('../db/database');

async function checkHistoryData() {
  try {
    await dbManager.initialize();
    console.log('数据库连接成功...\n');

    // 获取所有历史记录
    const result = await dbManager.query(`
      SELECT id, packaging_config_id, action, old_data, new_data, operated_at
      FROM process_config_history
      ORDER BY id DESC
      LIMIT 5
    `);

    console.log('=== 历史记录数据检查 ===\n');

    for (const row of result.rows) {
      console.log(`记录 ID: ${row.id}, 操作: ${row.action}`);
      console.log(`  old_data 类型: ${typeof row.old_data}, 值: ${row.old_data}`);
      console.log(`  new_data 类型: ${typeof row.new_data}, 值: ${row.new_data}`);
      console.log('');
    }

    await dbManager.close();
  } catch (error) {
    console.error('检查失败:', error.message);
    process.exit(1);
  }
}

checkHistoryData();
