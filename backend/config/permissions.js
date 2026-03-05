/**
 * 权限定义配置
 * 定义系统中所有的权限码
 */

const PERMISSIONS = {
  // 成本管理模块
  'cost:view': { label: '查看成本', module: 'cost', description: '查看成本记录和详情' },
  'cost:create': { label: '创建成本', module: 'cost', description: '新增成本分析' },
  'cost:edit': { label: '编辑成本', module: 'cost', description: '修改成本分析' },
  'cost:delete': { label: '删除成本', module: 'cost', description: '删除成本分析' },
  'cost:submit': { label: '提交审核', module: 'cost', description: '提交成本审核' },

  // 审核管理模块
  'review:view': { label: '查看审核', module: 'review', description: '查看审核记录' },
  'review:approve': { label: '审核通过', module: 'review', description: '批准成本分析' },
  'review:reject': { label: '审核退回', module: 'review', description: '退回成本分析' },

  // 基础数据模块 - 原料
  'master:material:view': { label: '查看原料', module: 'master', description: '查看原料数据' },
  'master:material:manage': { label: '管理原料', module: 'master', description: '增删改原料' },

  // 基础数据模块 - 工序
  'master:process:view': { label: '查看工序', module: 'master', description: '查看工序数据' },
  'master:process:manage': { label: '管理工序', module: 'master', description: '增删改工序' },

  // 基础数据模块 - 包材
  'master:packaging:view': { label: '查看包材', module: 'master', description: '查看包材数据' },
  'master:packaging:manage': { label: '管理包材', module: 'master', description: '增删改包材' },

  // 基础数据模块 - 型号
  'master:model:view': { label: '查看型号', module: 'master', description: '查看型号数据' },
  'master:model:manage': { label: '管理型号', module: 'master', description: '增删改型号' },

  // 基础数据模块 - 法规
  'master:regulation:view': { label: '查看法规', module: 'master', description: '查看法规数据' },
  'master:regulation:manage': { label: '管理法規', module: 'master', description: '增删改法规' },

  // 基础数据模块 - BOM
  'master:bom:view': { label: '查看BOM', module: 'master', description: '查看产品BOM' },
  'master:bom:manage': { label: '管理BOM', module: 'master', description: '编辑产品BOM' },

  // 基础数据模块 - 客户
  'master:customer:view': { label: '查看客户', module: 'master', description: '查看客户数据' },
  'master:customer:manage': { label: '管理客户', module: 'master', description: '增删改客户' },

  // 系统管理模块 - 用户
  'system:user:view': { label: '查看用户', module: 'system', description: '查看用户列表' },
  'system:user:manage': { label: '管理用户', module: 'system', description: '增删改用户' },

  // 系统管理模块 - 配置
  'system:config:view': { label: '查看配置', module: 'system', description: '查看系统配置' },
  'system:config:manage': { label: '管理配置', module: 'system', description: '修改系统配置' },

  // 系统管理模块 - 权限
  'system:permission:view': { label: '查看权限', module: 'system', description: '查看权限配置' },
  'system:permission:manage': { label: '管理权限', module: 'system', description: '修改权限配置' },

  // 补充缺失的权限定义
  'system:admin': {
    label: '系统管理员',
    module: 'system',
    description: '系统最高管理权限，拥有所有功能访问权'
  },
  'cost:delete:all': {
    label: '删除所有成本分析',
    module: 'cost',
    description: '可删除任意状态的成本分析记录（草稿/已提交/已审核）'
  },
  'cost:manage': {
    label: '成本管理高级权限',
    module: 'cost',
    description: '标准成本管理等高级成本功能'
  },
  'master:regulation:manage': {
    label: '管理法规',
    module: 'master',
    description: '增删改法规数据'
  },
  'master:model:manage': {
    label: '管理型号',
    module: 'master',
    description: '增删改型号数据'
  },
  'master:bom:manage': {
    label: '管理BOM',
    module: 'master',
    description: '编辑产品BOM'
  }
};

// 权限模块分组
const PERMISSION_MODULES = {
  cost: { label: '成本管理', icon: 'ri-money-cny-box-line' },
  review: { label: '审核管理', icon: 'ri-checkbox-circle-line' },
  master: { label: '基础数据', icon: 'ri-database-2-line' },
  system: { label: '系统管理', icon: 'ri-settings-3-line' }
};

module.exports = {
  PERMISSIONS,
  PERMISSION_MODULES
};
