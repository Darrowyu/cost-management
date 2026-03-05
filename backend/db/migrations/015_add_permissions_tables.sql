-- 添加权限管理相关表

-- 权限定义表
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 角色权限关联表
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_code VARCHAR(50) NOT NULL,
  permission_code VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(role_code, permission_code)
);

-- 权限变更历史表（用于审计）
CREATE TABLE IF NOT EXISTS permission_history (
  id SERIAL PRIMARY KEY,
  role_code VARCHAR(50) NOT NULL,
  permission_code VARCHAR(100) NOT NULL,
  action VARCHAR(20) NOT NULL, -- 'grant' or 'revoke'
  operator_id INTEGER NOT NULL,
  operator_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_code);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_code);
CREATE INDEX IF NOT EXISTS idx_permission_history_role ON permission_history(role_code);
CREATE INDEX IF NOT EXISTS idx_permission_history_created ON permission_history(created_at);

-- 插入默认权限数据
INSERT INTO permissions (code, label, module, description) VALUES
-- 成本管理模块
('cost:view', '查看成本', 'cost', '查看成本记录和详情'),
('cost:create', '创建成本', 'cost', '新增成本分析'),
('cost:edit', '编辑成本', 'cost', '修改成本分析'),
('cost:delete', '删除成本', 'cost', '删除成本分析'),
('cost:submit', '提交审核', 'cost', '提交成本审核'),

-- 审核管理模块
('review:view', '查看审核', 'review', '查看审核记录'),
('review:approve', '审核通过', 'review', '批准成本分析'),
('review:reject', '审核退回', 'review', '退回成本分析'),

-- 基础数据模块 - 原料
('master:material:view', '查看原料', 'master', '查看原料数据'),
('master:material:manage', '管理原料', 'master', '增删改原料'),

-- 基础数据模块 - 工序
('master:process:view', '查看工序', 'master', '查看工序数据'),
('master:process:manage', '管理工序', 'master', '增删改工序'),

-- 基础数据模块 - 包材
('master:packaging:view', '查看包材', 'master', '查看包材数据'),
('master:packaging:manage', '管理包材', 'master', '增删改包材'),

-- 基础数据模块 - 型号
('master:model:view', '查看型号', 'master', '查看型号数据'),
('master:model:manage', '管理型号', 'master', '增删改型号'),

-- 基础数据模块 - 法规
('master:regulation:view', '查看法规', 'master', '查看法规数据'),
('master:regulation:manage', '管理法規', 'master', '增删改法规'),

-- 基础数据模块 - BOM
('master:bom:view', '查看BOM', 'master', '查看产品BOM'),
('master:bom:manage', '管理BOM', 'master', '编辑产品BOM'),

-- 基础数据模块 - 客户
('master:customer:view', '查看客户', 'master', '查看客户数据'),
('master:customer:manage', '管理客户', 'master', '增删改客户'),

-- 系统管理模块 - 用户
('system:user:view', '查看用户', 'system', '查看用户列表'),
('system:user:manage', '管理用户', 'system', '增删改用户'),

-- 系统管理模块 - 配置
('system:config:view', '查看配置', 'system', '查看系统配置'),
('system:config:manage', '管理配置', 'system', '修改系统配置'),

-- 系统管理模块 - 权限
('system:permission:view', '查看权限', 'system', '查看权限配置'),
('system:permission:manage', '管理权限', 'system', '修改权限配置'),

-- 补充缺失的权限定义
('system:admin', '系统管理员', 'system', '系统最高管理权限，拥有所有功能访问权'),
('cost:delete:all', '删除所有成本分析', 'cost', '可删除任意状态的成本分析记录'),
('cost:manage', '成本管理高级权限', 'cost', '标准成本管理等高级成本功能'),
('master:regulation:manage', '管理法规', 'master', '增删改法规数据'),
('master:model:manage', '管理型号', 'master', '增删改型号数据'),
('master:bom:manage', '管理BOM', 'master', '编辑产品BOM')
ON CONFLICT (code) DO NOTHING;

-- 为admin角色分配新权限
INSERT INTO role_permissions (role_code, permission_code)
VALUES ('admin', 'system:admin'), ('admin', 'cost:delete:all')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- 插入默认角色权限数据
INSERT INTO role_permissions (role_code, permission_code) VALUES
-- 采购
('purchaser', 'master:material:view'),
('purchaser', 'master:material:manage'),
('purchaser', 'master:model:view'),
('purchaser', 'master:regulation:view'),
('purchaser', 'master:bom:view'),
('purchaser', 'master:process:view'),
('purchaser', 'master:packaging:view'),

-- 生产
('producer', 'master:process:view'),
('producer', 'master:process:manage'),
('producer', 'master:packaging:view'),
('producer', 'master:packaging:manage'),
('producer', 'master:model:view'),
('producer', 'master:regulation:view'),
('producer', 'master:bom:view'),
('producer', 'master:material:view'),

-- 审核
('reviewer', 'cost:view'),
('reviewer', 'cost:submit'),
('reviewer', 'review:view'),
('reviewer', 'review:approve'),
('reviewer', 'review:reject'),
('reviewer', 'master:model:view'),
('reviewer', 'master:regulation:view'),
('reviewer', 'master:material:view'),
('reviewer', 'master:process:view'),
('reviewer', 'master:packaging:view'),
('reviewer', 'master:bom:view'),

-- 业务员
('salesperson', 'cost:view'),
('salesperson', 'cost:create'),
('salesperson', 'cost:edit'),
('salesperson', 'cost:delete'),
('salesperson', 'cost:submit'),
('salesperson', 'review:view'),
('salesperson', 'master:customer:view'),
('salesperson', 'master:customer:manage'),
('salesperson', 'master:model:view'),
('salesperson', 'master:regulation:view'),
('salesperson', 'master:material:view'),
('salesperson', 'master:process:view'),
('salesperson', 'master:packaging:view'),
('salesperson', 'master:bom:view'),

-- 只读
('readonly', 'cost:view'),
('readonly', 'review:view'),
('readonly', 'master:model:view'),
('readonly', 'master:regulation:view'),
('readonly', 'master:material:view'),
('readonly', 'master:process:view'),
('readonly', 'master:packaging:view'),
('readonly', 'master:bom:view'),
('readonly', 'master:customer:view')
ON CONFLICT (role_code, permission_code) DO NOTHING;
