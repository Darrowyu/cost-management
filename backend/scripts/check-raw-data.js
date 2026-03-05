/**
 * 检查数据库中的原始数据
 */

const dbManager = require('../db/database');

async function checkRawData() {
  try {
    await dbManager.initialize();

    // 使用 pg 客户端直接查询，避免任何转换
    const result = await dbManager.query(`
      SELECT id, new_data::text as raw_data
      FROM process_config_history
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      console.log('原始数据 (文本):', result.rows[0].raw_data);
      console.log('长度:', result.rows[0].raw_data.length);
    } else {
      console.log('没有历史记录');
    }

    await dbManager.close();
  } catch (error) {
    console.error('检查失败:', error.message);
    await dbManager.close();
    process.exit(1);
  }
}

checkRawData();
