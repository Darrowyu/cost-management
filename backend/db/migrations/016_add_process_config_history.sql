-- 016: 添加工序配置历史记录功能
-- 扩展 process_configs 表并创建历史记录表

-- 1. 扩展 packaging_configs 表，添加审计字段
ALTER TABLE packaging_configs
  ADD COLUMN IF NOT EXISTS last_modified_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS last_process_total DECIMAL(12,4);

COMMENT ON COLUMN packaging_configs.last_modified_by IS '最后修改人ID';
COMMENT ON COLUMN packaging_configs.last_process_total IS '最后工序总价';

-- 2. 创建工序配置历史记录表
CREATE TABLE IF NOT EXISTS process_config_history (
  id SERIAL PRIMARY KEY,
  packaging_config_id INTEGER NOT NULL REFERENCES packaging_configs(id) ON DELETE CASCADE,
  process_id INTEGER REFERENCES process_configs(id),
  action VARCHAR(20) NOT NULL CHECK(action IN ('create', 'update', 'delete', 'batch_update')),
  old_data JSONB,
  new_data JSONB,
  old_process_total DECIMAL(12,4),
  new_process_total DECIMAL(12,4),
  operated_by INTEGER NOT NULL REFERENCES users(id),
  operated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE process_config_history IS '工序配置变更历史记录';
COMMENT ON COLUMN process_config_history.packaging_config_id IS '关联的包材配置ID';
COMMENT ON COLUMN process_config_history.process_id IS '关联的工序配置ID';
COMMENT ON COLUMN process_config_history.action IS '操作类型：create-创建, update-更新, delete-删除, batch_update-批量更新';
COMMENT ON COLUMN process_config_history.old_data IS '变更前的完整数据（JSON格式）';
COMMENT ON COLUMN process_config_history.new_data IS '变更后的完整数据（JSON格式）';
COMMENT ON COLUMN process_config_history.old_process_total IS '变更前的工序总价';
COMMENT ON COLUMN process_config_history.new_process_total IS '变更后的工序总价';
COMMENT ON COLUMN process_config_history.operated_by IS '操作人ID';
COMMENT ON COLUMN process_config_history.operated_at IS '操作时间';

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_process_config_history_packaging_config_id ON process_config_history(packaging_config_id);
CREATE INDEX IF NOT EXISTS idx_process_config_history_operated_at ON process_config_history(operated_at);

-- 4. 插入迁移记录
INSERT INTO migrations (name, executed_at)
VALUES ('016_add_process_config_history', NOW())
ON CONFLICT (name) DO NOTHING;
