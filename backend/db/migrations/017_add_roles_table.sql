-- 创建角色定义表
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,     -- 角色代码（英文标识）
  name VARCHAR(100) NOT NULL,           -- 角色名称（中文显示）
  description TEXT,                      -- 角色描述
  icon VARCHAR(50) DEFAULT 'ri-user-line', -- 图标类名
  is_system BOOLEAN DEFAULT false,      -- 是否为系统预设角色（不可删除）
  is_active BOOLEAN DEFAULT true,       -- 是否启用
  sort_order INTEGER DEFAULT 0,         -- 排序顺序
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 迁移现有角色数据
INSERT INTO roles (code, name, description, icon, is_system, sort_order) VALUES
('admin', '管理员', '系统最高权限，拥有所有功能的访问和操作权限', 'ri-shield-user-fill', true, 1),
('purchaser', '采购', '负责原料采购管理，可管理原料数据，查看基础数据', 'ri-shopping-cart-line', true, 2),
('producer', '生产', '负责生产管理，可管理工序和包材，查看基础数据', 'ri-settings-3-line', true, 3),
('reviewer', '审核', '负责审核成本分析，可批准或退回报价，查看成本数据', 'ri-checkbox-circle-line', true, 4),
('salesperson', '业务员', '负责业务报价，可创建和管理成本分析，管理客户', 'ri-briefcase-line', true, 5),
('readonly', '只读', '仅查看权限，无法修改任何数据，适合访客使用', 'ri-eye-line', true, 6)
ON CONFLICT (code) DO NOTHING;

-- 创建触发器更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
