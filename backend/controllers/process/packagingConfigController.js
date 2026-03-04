/**
 * 包装配置控制器
 * 处理包装配置的 CRUD 操作
 */

const logger = require('../../utils/logger');
const PackagingConfig = require('../../models/PackagingConfig');
const ProcessConfig = require('../../models/ProcessConfig');
const PackagingMaterial = require('../../models/PackagingMaterial');
const ProcessConfigHistory = require('../../models/ProcessConfigHistory');
const SystemConfig = require('../../models/SystemConfig');
const StandardCost = require('../../models/StandardCost');
const dbManager = require('../../db/database');
const { isValidPackagingType, getPackagingTypeName, VALID_PACKAGING_TYPE_KEYS } = require('../../config/packagingTypes');

// 辅助函数：计算配置的工序和包材价格
const enrichConfigWithPrices = async (config, processCoefficient, includeTypeName = false) => {
  const processes = await ProcessConfig.findByPackagingConfigId(config.id);
  const processSum = processes.reduce((sum, p) => sum + parseFloat(p.unit_price), 0);

  const materials = await PackagingMaterial.findByPackagingConfigId(config.id);
  const materialTotalPrice = materials.reduce((sum, m) => {
    return sum + (m.basic_usage !== 0 ? parseFloat(m.unit_price) / parseFloat(m.basic_usage) : 0);
  }, 0);

  return {
    ...config,
    ...(includeTypeName && { packaging_type_name: getPackagingTypeName(config.packaging_type) }),
    process_total_price: processSum * processCoefficient,
    material_total_price: materialTotalPrice
  };
};

// 辅助函数：批量计算配置价格
const enrichConfigsWithPrices = async (configs, includeTypeName = false) => {
  const processCoefficient = parseFloat(await SystemConfig.getValue('process_coefficient')) || 1.56;
  return Promise.all(configs.map(config => enrichConfigWithPrices(config, processCoefficient, includeTypeName)));
};

// 获取所有包装配置（支持 packaging_type 和 include_inactive 筛选）
exports.getAllPackagingConfigs = async (req, res) => {
  try {
    const { packaging_type, include_inactive } = req.query;

    if (packaging_type && !isValidPackagingType(packaging_type)) {
      return res.status(400).json({
        success: false,
        message: `无效的包装类型: ${packaging_type}。有效值: ${VALID_PACKAGING_TYPE_KEYS.join(', ')}`
      });
    }

    const configs = await PackagingConfig.findAll({
      packaging_type,
      include_inactive: include_inactive === 'true' // 字符串转布尔
    });
    const configsWithPrice = await enrichConfigsWithPrices(configs, true);

    res.json({ success: true, data: configsWithPrice });
  } catch (error) {
    logger.error('获取包装配置失败:', error);
    res.status(500).json({ success: false, message: '获取包装配置失败' });
  }
};

// 根据型号获取包装配置
exports.getPackagingConfigsByModel = async (req, res) => {
  try {
    const { modelId } = req.params;
    const { include_inactive } = req.query;
    const configs = await PackagingConfig.findByModelId(modelId, {
      include_inactive: include_inactive === 'true'
    });
    const configsWithPrice = await enrichConfigsWithPrices(configs);

    res.json({ success: true, data: configsWithPrice });
  } catch (error) {
    logger.error('获取包装配置失败:', error);
    res.status(500).json({ success: false, message: '获取包装配置失败' });
  }
};

// 获取包装配置详情（含工序列表）
exports.getPackagingConfigDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const config = await PackagingConfig.findWithProcesses(id);

    if (!config) {
      return res.status(404).json({ success: false, message: '包装配置不存在' });
    }

    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('获取包装配置详情失败:', error);
    res.status(500).json({ success: false, message: '获取包装配置详情失败' });
  }
};

// 获取包装配置完整详情（含工序和包材列表）
exports.getPackagingConfigFullDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const config = await PackagingConfig.findWithDetails(id);

    if (!config) {
      return res.status(404).json({ success: false, message: '包装配置不存在' });
    }

    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('获取包装配置完整详情失败:', error);
    res.status(500).json({ success: false, message: '获取包装配置完整详情失败' });
  }
};

// 创建包装配置
exports.createPackagingConfig = async (req, res) => {
  try {
    const userId = req.user?.id;
    const {
      model_id, config_name, packaging_type = 'standard_box',
      layer1_qty, layer2_qty, layer3_qty,
      pc_per_bag, bags_per_box, boxes_per_carton, // 兼容旧字段
      processes, materials, factory
    } = req.body;

    if (!isValidPackagingType(packaging_type)) {
      return res.status(400).json({
        success: false,
        message: `无效的包装类型: ${packaging_type}。有效值: ${VALID_PACKAGING_TYPE_KEYS.join(', ')}`
      });
    }

    const l1 = layer1_qty !== undefined ? layer1_qty : pc_per_bag;
    const l2 = layer2_qty !== undefined ? layer2_qty : bags_per_box;
    const l3 = layer3_qty !== undefined ? layer3_qty : boxes_per_carton;

    if (!model_id || !config_name || !l1 || !l2) {
      return res.status(400).json({ success: false, message: '请填写完整的包装配置信息' });
    }

    if (await PackagingConfig.existsByModelAndName(model_id, config_name)) {
      return res.status(400).json({ success: false, message: '该型号下已存在同名的配置，请修改配置名称' });
    }

    const configId = await PackagingConfig.create({
      model_id, config_name, packaging_type, layer1_qty: l1, layer2_qty: l2, layer3_qty: l3, factory
    });

    if (processes && processes.length > 0) {
      await ProcessConfig.createBatch(configId, processes);
    }
    if (materials && materials.length > 0) {
      await PackagingMaterial.createBatch(configId, materials);
    }

    // 计算工序总价
    const processTotal = processes?.reduce((sum, p) => sum + (parseFloat(p.unit_price) || 0), 0) || 0;

    // 更新最后修改信息
    await PackagingConfig.updateLastModified(configId, {
      last_modified_by: userId,
      last_process_total: processTotal
    });

    // 创建历史记录
    if (userId) {
      await ProcessConfigHistory.create({
        packaging_config_id: configId,
        action: 'create',
        new_data: { processes: processes || [] },
        new_process_total: processTotal,
        operated_by: userId
      });
    }

    res.json({ success: true, data: { id: configId }, message: '包装配置创建成功' });
  } catch (error) {
    logger.error('创建包装配置失败:', error);

    if (error.message && error.message.includes('无效的包装类型')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.code === '23505' || (error.message && error.message.includes('duplicate key'))) {
      return res.status(400).json({ success: false, message: '该型号下已存在同名的配置，请修改配置名称' });
    }

    res.status(500).json({ success: false, message: error.message || '创建包装配置失败' });
  }
};

// 更新包装配置
exports.updatePackagingConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const {
      config_name, packaging_type, layer1_qty, layer2_qty, layer3_qty,
      pc_per_bag, bags_per_box, boxes_per_carton, // 兼容旧字段
      is_active, processes, materials, factory
    } = req.body;

    // 先计算包装数量值（后续权限检查需要用到）
    const l1 = layer1_qty !== undefined ? layer1_qty : pc_per_bag;
    const l2 = layer2_qty !== undefined ? layer2_qty : bags_per_box;
    const l3 = layer3_qty !== undefined ? layer3_qty : boxes_per_carton;

    // 权限控制：明确各角色可编辑范围
    const isAdmin = userRole === 'admin';
    const isProducer = userRole === 'producer';
    const isPurchaser = userRole === 'purchaser';
    const canEditConfig = isAdmin || isProducer;  // 可编辑配置信息
    const canEditProcess = isAdmin || isProducer; // 可编辑工序
    const canEditMaterial = isAdmin || isPurchaser; // 可编辑包材

    // 生产不能修改包材
    if (isProducer && materials) {
      return res.status(403).json({
        success: false,
        message: '您没有权限修改包材，请联系采购人员'
      });
    }

    // 采购不能修改工序
    if (isPurchaser && processes) {
      return res.status(403).json({
        success: false,
        message: '您没有权限修改工序，请联系生产人员'
      });
    }

    // 采购不能修改配置基本信息
    if (isPurchaser && (config_name !== undefined || packaging_type !== undefined || l1 !== undefined || l2 !== undefined)) {
      return res.status(403).json({
        success: false,
        message: '您没有权限修改包装配置信息，请联系生产人员'
      });
    }

    if (!isPurchaser && packaging_type !== undefined && !isValidPackagingType(packaging_type)) {
      return res.status(400).json({
        success: false,
        message: `无效的包装类型: ${packaging_type}。有效值: ${VALID_PACKAGING_TYPE_KEYS.join(', ')}`
      });
    }

    // 处理 is_active 转换为布尔值 (前端可能传 1/0)
    let activeState = true;
    if (is_active !== undefined) {
      activeState = (is_active === 1 || is_active === '1' || is_active === true || is_active === 'true');
    }

    // 只有生产/管理员可修改配置基本信息
    if (canEditConfig) {
      await PackagingConfig.update(id, {
        config_name, packaging_type, layer1_qty: l1, layer2_qty: l2, layer3_qty: l3,
        is_active: activeState, factory
      });
    }

    // 只有生产/管理员可修改工序
    let oldProcesses = [];
    let oldProcessTotal = 0;
    if (processes && canEditProcess) {
      // 获取旧工序数据用于历史记录
      const oldConfig = await PackagingConfig.findWithProcesses(id);
      oldProcesses = oldConfig?.processes || [];
      oldProcessTotal = oldProcesses.reduce((sum, p) => sum + (parseFloat(p.unit_price) || 0), 0);

      await ProcessConfig.deleteByPackagingConfigId(id);
      if (processes.length > 0) await ProcessConfig.createBatch(id, processes);

      // 计算新工序总价
      const newProcessTotal = processes.reduce((sum, p) => sum + (parseFloat(p.unit_price) || 0), 0);

      // 更新最后修改信息
      await PackagingConfig.updateLastModified(id, {
        last_modified_by: userId,
        last_process_total: newProcessTotal
      });

      // 创建历史记录
      if (userId) {
        await ProcessConfigHistory.create({
          packaging_config_id: id,
          action: 'batch_update',
          old_data: { processes: oldProcesses },
          new_data: { processes },
          old_process_total: oldProcessTotal,
          new_process_total: newProcessTotal,
          operated_by: userId
        });
      }
    }

    // 只有采购/管理员可修改包材
    if (materials && canEditMaterial) {
      await PackagingMaterial.deleteByPackagingConfigId(id);
      if (materials.length > 0) await PackagingMaterial.createBatch(id, materials);
    }

    res.json({ success: true, message: '包装配置更新成功' });
  } catch (error) {
    logger.error('更新包装配置失败:', error);

    if (error.message && error.message.includes('无效的包装类型')) {
      return res.status(400).json({ success: false, message: error.message });
    }

    // 处理名称重复错误
    if (error.code === '23505' || (error.message && error.message.includes('duplicate key'))) {
      return res.status(400).json({ success: false, message: '该型号下已存在同名的配置，请修改配置名称' });
    }

    res.status(500).json({ success: false, message: error.message || '更新包装配置失败' });
  }
};

// 辅助函数：检查配置是否可删除
const checkDeleteConstraints = async (id) => {
  const quotationCheck = await dbManager.query(
    'SELECT COUNT(*) as count FROM quotations WHERE packaging_config_id = $1', [id]
  );
  if (parseInt(quotationCheck.rows[0].count) > 0) {
    return '被报价单引用';
  }

  const hasStandardCost = await StandardCost.findCurrentByPackagingConfigId(id);
  if (hasStandardCost) {
    return '已设置标准成本';
  }

  return null; // 可删除
};

// 辅助函数：级联软删除包材和工序
const cascadeSoftDelete = async (id) => {
  await Promise.all([
    dbManager.query('UPDATE packaging_materials SET is_active = false, updated_at = NOW() WHERE packaging_config_id = $1', [id]),
    dbManager.query('UPDATE process_configs SET is_active = false, updated_at = NOW() WHERE packaging_config_id = $1', [id])
  ]);
};

// 删除包装配置
exports.deletePackagingConfig = async (req, res) => {
  try {
    const { id } = req.params;

    const reason = await checkDeleteConstraints(id);
    if (reason) {
      const messages = {
        '被报价单引用': '该包装配置已被报价单引用，无法删除',
        '已设置标准成本': '该包装配置已设置标准成本，请先删除标准成本记录'
      };
      return res.status(400).json({ success: false, message: messages[reason] });
    }

    await cascadeSoftDelete(id);
    await PackagingConfig.delete(id);
    res.json({ success: true, message: '包装配置删除成功' });
  } catch (error) {
    logger.error('删除包装配置失败:', error);
    res.status(500).json({ success: false, message: '删除包装配置失败' });
  }
};

// 批量删除包装配置（检查每个是否可删除）
exports.batchDeletePackagingConfigs = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请提供要删除的配置ID' });
    }

    const results = { deleted: 0, failed: [] };

    for (const id of ids) {
      const config = await PackagingConfig.findById(id);
      if (!config) continue;

      const reason = await checkDeleteConstraints(id);
      if (reason) {
        results.failed.push({ id, name: config.config_name, reason });
        continue;
      }

      await cascadeSoftDelete(id);
      await PackagingConfig.delete(id);
      results.deleted++;
    }

    const msg = results.deleted > 0 ? `成功删除 ${results.deleted} 条` : '无可删除项';
    res.json({ success: true, data: results, message: msg });
  } catch (error) {
    logger.error('批量删除包装配置失败:', error);
    res.status(500).json({ success: false, message: '批量删除失败' });
  }
};

// 获取所有配置及其工序数量（用于一键复制，优化 N+1 查询）
exports.getPackagingConfigsWithProcessCount = async (req, res) => {
  try {
    const result = await dbManager.query(`
      SELECT pc.id, pc.model_id, pc.config_name, pc.packaging_type,
             m.model_name, m.model_category, r.name as regulation_name,
             COUNT(prc.id)::int as process_count
      FROM packaging_configs pc
      LEFT JOIN models m ON pc.model_id = m.id
      LEFT JOIN regulations r ON m.regulation_id = r.id
      LEFT JOIN process_configs prc ON pc.id = prc.packaging_config_id AND prc.is_active = true
      WHERE pc.is_active = true
      GROUP BY pc.id, pc.model_id, pc.config_name, pc.packaging_type,
               m.model_name, m.model_category, r.name
      ORDER BY pc.created_at DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('获取配置工序数量失败:', error);
    res.status(500).json({ success: false, message: '获取配置工序数量失败' });
  }
};

// 按包装类型分组获取配置
exports.getPackagingConfigsGrouped = async (req, res) => {
  try {
    const { model_id } = req.query;
    const options = model_id ? { model_id: parseInt(model_id) } : {};

    const grouped = await PackagingConfig.findGroupedByType(options);

    const result = {};
    for (const [type, configs] of Object.entries(grouped)) {
      result[type] = {
        type_name: getPackagingTypeName(type),
        configs: configs.map(config => ({
          ...config,
          packaging_type_name: getPackagingTypeName(config.packaging_type)
        }))
      };
    }

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('获取分组包装配置失败:', error);
    res.status(500).json({ success: false, message: '获取分组包装配置失败' });
  }
};

// 获取所有配置及其包材数量（用于一键复制，优化 N+1 查询）
exports.getPackagingConfigsWithMaterialCount = async (req, res) => {
  try {
    const result = await dbManager.query(`
      SELECT pc.id, pc.model_id, pc.config_name, pc.packaging_type,
             m.model_name, m.model_category, r.name as regulation_name,
             COUNT(pm.id)::int as material_count
      FROM packaging_configs pc
      LEFT JOIN models m ON pc.model_id = m.id
      LEFT JOIN regulations r ON m.regulation_id = r.id
      LEFT JOIN packaging_materials pm ON pc.id = pm.packaging_config_id AND pm.is_active = true
      WHERE pc.is_active = true
      GROUP BY pc.id, pc.model_id, pc.config_name, pc.packaging_type,
               m.model_name, m.model_category, r.name
      ORDER BY pc.created_at DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('获取配置包材数量失败:', error);
    res.status(500).json({ success: false, message: '获取配置包材数量失败' });
  }
};
