/**
 * 修复迁移 016 - 修正字段添加到错误的表
 */

const dbManager = require('../db/database');

async function fixMigration() {
  try {
    await dbManager.initialize();
    console.log('数据库连接成功...\n');

    // 1. 检查 packaging_configs 表是否有这些字段
    const checkPackage = await dbManager.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'packaging_configs'
      AND column_name IN ('last_modified_by', 'last_process_total')
    `);

    console.log('packaging_configs 表已有字段:', checkPackage.rows.map(r => r.column_name).join(', ') || '无');

    // 2. 检查 process_configs 表是否有这些字段
    const checkProcess = await dbManager.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'process_configs'
      AND column_name IN ('last_modified_by', 'last_process_total')
    `);

    console.log('process_configs 表已有字段:', checkProcess.rows.map(r => r.column_name).join(', ') || '无');

    // 3. 如果 packaging_configs 没有字段，添加它们
    if (checkPackage.rows.length < 2) {
      console.log('\n正在向 packaging_configs 表添加字段...');
      await dbManager.query(`
        ALTER TABLE packaging_configs
        ADD COLUMN IF NOT EXISTS last_modified_by INTEGER REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS last_process_total DECIMAL(12,4)
      `);
      console.log('✅ 字段添加成功');
    } else {
      console.log('\n✅ packaging_configs 表字段已存在，无需修改');
    }

    // 4. 如果 process_configs 有字段，删除它们
    if (checkProcess.rows.length > 0) {
      console.log('\n正在从 process_configs 表删除错误添加的字段...');

      // 需要先删除外键约束
      try {
        await dbManager.query(`
          ALTER TABLE process_configs DROP CONSTRAINT IF EXISTS process_configs_last_modified_by_fkey
        `);
      } catch (e) {
        // 约束可能不存在，忽略错误
      }

      await dbManager.query(`
        ALTER TABLE process_configs
        DROP COLUMN IF EXISTS last_modified_by,
        DROP COLUMN IF EXISTS last_process_total
      `);
      console.log('✅ 错误字段已删除');
    } else {
      console.log('\n✅ process_configs 表无错误字段');
    }

    // 5. 验证修复结果
    const verifyPackage = await dbManager.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'packaging_configs'
      AND column_name IN ('last_modified_by', 'last_process_total')
    `);

    console.log('\n=== 修复结果验证 ===');
    console.log('packaging_configs 表字段:', verifyPackage.rows.map(r => r.column_name).join(', '));

    if (verifyPackage.rows.length === 2) {
      console.log('\n✅ 修复完成！字段已正确添加到 packaging_configs 表');
    } else {
      console.log('\n❌ 修复失败，字段数量不正确');
    }

    await dbManager.close();
  } catch (error) {
    console.error('修复失败:', error.message);
    process.exit(1);
  }
}

fixMigration();
