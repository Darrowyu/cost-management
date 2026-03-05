/**
 * 运行指定的 SQL 迁移文件
 * 用法: node scripts/run-migration.js 014_add_production_cycle.sql
 */

require('dotenv').config();
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const dbManager = require('../db/database');

async function runMigration() {
    const migrationFile = process.argv[2];

    if (!migrationFile) {
        logger.error('请指定迁移文件名，例如: node scripts/run-migration.js 014_add_production_cycle.sql');
        process.exit(1);
    }

    const filePath = path.join(__dirname, '../db/migrations', migrationFile);

    if (!fs.existsSync(filePath)) {
        logger.error(`迁移文件不存在: ${filePath}`);
        process.exit(1);
    }

    try {
        // 先初始化数据库连接
        await dbManager.initialize();

        logger.info(`正在执行迁移: ${migrationFile}`);
        const sql = fs.readFileSync(filePath, 'utf8');

        await dbManager.query(sql);
        logger.info(`✅ 迁移成功: ${migrationFile}`);

        await dbManager.close();
        process.exit(0);
    } catch (error) {
        logger.error(`❌ 迁移失败: ${error.message}`);
        process.exit(1);
    }
}

runMigration();
