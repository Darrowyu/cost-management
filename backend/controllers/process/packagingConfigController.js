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

    // 计算工序总价
    const processTotal = processes?.reduce((sum, p) => sum + (parseFloat(p.unit_price) || 0), 0) || 0;

    // 使用事务包裹所有操作
    const configId = await dbManager.transaction(async (client) => {
      // 1. 创建包装配置
      const l3ForOldField = l3 !== null && l3 !== undefined ? l3 : 1;
      const configResult = await client.query(
        `INSERT INTO packaging_configs
         (model_id, config_name, packaging_type, layer1_qty, layer2_qty, layer3_qty, factory, pc_per_bag, bags_per_box, boxes_per_carton, last_modified_by, last_process_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [model_id, config_name, packaging_type, l1, l2, l3, factory, l1, l2, l3ForOldField, userId || null, processTotal]
      );
      const newConfigId = configResult.rows[0].id;

      // 2. 创建工序配置（批量插入优化）
      if (processes && processes.length > 0) {
        const processValues = processes.map((_, i) =>
          `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`
        ).join(',');
        const processParams = processes.flatMap(p => [
          newConfigId, p.process_name, p.unit_price, p.sort_order || 0
        ]);
        await client.query(
          `INSERT INTO process_configs (packaging_config_id, process_name, unit_price, sort_order)
           VALUES ${processValues}`,
          processParams
        );
      }

      // 3. 创建包材配置（批量插入优化）
      if (materials && materials.length > 0) {
        const materialValues = materials.map((_, i) =>
          `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`
        ).join(',');
        const materialParams = materials.flatMap(m => [
          newConfigId, m.material_name, m.basic_usage, m.unit_price, m.carton_volume || null, m.sort_order || 0
        ]);
        await client.query(
          `INSERT INTO packaging_materials (packaging_config_id, material_name, basic_usage, unit_price, carton_volume, sort_order)
           VALUES ${materialValues}`,
          materialParams
        );
      }

      // 4. 创建历史记录
      await client.query(
        `INSERT INTO process_config_history (
          packaging_config_id, action, new_data, new_process_total, operated_by
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          newConfigId,
          'create',
          JSON.stringify({
            config: { config_name, packaging_type, layer1_qty: l1, layer2_qty: l2, layer3_qty: l3, factory, is_active: true },
            processes: processes || []
          }),
          processTotal,
          userId || null
        ]
      );

      return newConfigId;
    });

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

    // 判断是否有数据变更
    const hasConfigChange = canEditConfig && (config_name !== undefined || packaging_type !== undefined || l1 !== undefined || l2 !== undefined || l3 !== undefined || factory !== undefined || is_active !== undefined);
    const hasProcessChange = processes && canEditProcess;
    const hasMaterialChange = materials && canEditMaterial;

    // 如果没有变更，直接返回成功
    if (!hasConfigChange && !hasProcessChange && !hasMaterialChange) {
      return res.json({ success: true, message: '包装配置更新成功' });
    }

    // 查询旧状态（用于检测 is_active 变更）
    let oldActiveState = null;
    let isActiveChanged = false;
    let activeChangeAction = null;  // 'activate' 或 'deactivate'
    if (is_active !== undefined && canEditConfig) {
      const oldStateResult = await dbManager.query(
        'SELECT is_active FROM packaging_configs WHERE id = $1',
        [id]
      );
      if (oldStateResult.rows.length > 0) {
        oldActiveState = oldStateResult.rows[0].is_active;
        isActiveChanged = oldActiveState !== activeState;
        if (isActiveChanged) {
          activeChangeAction = activeState ? 'activate' : 'deactivate';
        }
      }
    }

    // 使用事务包裹所有更新操作
    await dbManager.transaction(async (client) => {
      // 获取旧数据（用于历史记录）
      let oldConfig = null;
      let oldProcesses = [];
      let oldProcessTotal = 0;

      if ((hasProcessChange || isActiveChanged) && userId) {
        const oldConfigResult = await client.query(
          `SELECT id, model_id, config_name, packaging_type, layer1_qty, layer2_qty, layer3_qty, factory, is_active
           FROM packaging_configs WHERE id = $1`,
          [id]
        );
        if (oldConfigResult.rows.length > 0) {
          oldConfig = oldConfigResult.rows[0];
        }

        if (hasProcessChange) {
          const oldProcessResult = await client.query(
            `SELECT id, process_name, unit_price, sort_order FROM process_configs
             WHERE packaging_config_id = $1 AND is_active = true ORDER BY sort_order, id`,
            [id]
          );
          oldProcesses = oldProcessResult.rows;
          oldProcessTotal = oldProcesses.reduce((sum, p) => sum + (parseFloat(p.unit_price) || 0), 0);
        }
      }

      // 1. 更新配置基本信息
      if (hasConfigChange) {
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;

        if (config_name !== undefined) { updateFields.push(`config_name = $${paramIndex++}`); updateValues.push(config_name); }
        if (packaging_type !== undefined) { updateFields.push(`packaging_type = $${paramIndex++}`); updateValues.push(packaging_type); }
        if (l1 !== undefined) {
          updateFields.push(`layer1_qty = $${paramIndex++}`);
          updateFields.push(`pc_per_bag = $${paramIndex++}`);
          updateValues.push(l1, l1);
        }
        if (l2 !== undefined) {
          updateFields.push(`layer2_qty = $${paramIndex++}`);
          updateFields.push(`bags_per_box = $${paramIndex++}`);
          updateValues.push(l2, l2);
        }
        if (l3 !== undefined) {
          updateFields.push(`layer3_qty = $${paramIndex++}`);
          updateFields.push(`boxes_per_carton = $${paramIndex++}`);
          updateValues.push(l3, l3 !== null && l3 !== undefined ? l3 : 1);
        }
        if (factory !== undefined) { updateFields.push(`factory = $${paramIndex++}`); updateValues.push(factory); }
        if (is_active !== undefined) { updateFields.push(`is_active = $${paramIndex++}`); updateValues.push(activeState); }

        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        updateValues.push(id);

        await client.query(
          `UPDATE packaging_configs SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
          updateValues
        );
      }

      // 2. 更新工序配置
      let newProcessTotal = 0;
      if (hasProcessChange) {
        // 删除旧工序
        await client.query('DELETE FROM process_configs WHERE packaging_config_id = $1', [id]);

        // 插入新工序（批量插入优化）
        if (processes.length > 0) {
          const processValues = processes.map((_, i) =>
            `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`
          ).join(',');
          const processParams = processes.flatMap(p => [
            id, p.process_name, p.unit_price, p.sort_order || 0
          ]);
          await client.query(
            `INSERT INTO process_configs (packaging_config_id, process_name, unit_price, sort_order)
             VALUES ${processValues}`,
            processParams
          );
        }

        // 计算新工序总价
        newProcessTotal = processes.reduce((sum, p) => sum + (parseFloat(p.unit_price) || 0), 0);

        // 更新最后修改信息
        await client.query(
          `UPDATE packaging_configs SET last_modified_by = $1, last_process_total = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [userId || null, newProcessTotal, id]
        );
      }

      // 3. 更新包材配置
      if (hasMaterialChange) {
        await client.query('DELETE FROM packaging_materials WHERE packaging_config_id = $1', [id]);

        if (materials.length > 0) {
          const materialValues = materials.map((_, i) =>
            `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`
          ).join(',');
          const materialParams = materials.flatMap(m => [
            id, m.material_name, m.basic_usage, m.unit_price, m.carton_volume || null, m.sort_order || 0
          ]);
          await client.query(
            `INSERT INTO packaging_materials (packaging_config_id, material_name, basic_usage, unit_price, carton_volume, sort_order)
             VALUES ${materialValues}`,
            materialParams
          );
        }
      }

      // 4. 创建历史记录
      if (userId && (hasProcessChange || isActiveChanged)) {
        // 获取新配置数据
        const newConfigResult = await client.query(
          `SELECT id, model_id, config_name, packaging_type, layer1_qty, layer2_qty, layer3_qty, factory, is_active
           FROM packaging_configs WHERE id = $1`,
          [id]
        );
        const newConfig = newConfigResult.rows[0];

        // 确定 action：优先使用状态变更的 action
        const historyAction = activeChangeAction || 'batch_update';

        await client.query(
          `INSERT INTO process_config_history (
            packaging_config_id, action, old_data, new_data, old_process_total, new_process_total, operated_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id,
            historyAction,
            JSON.stringify({ config: oldConfig, processes: oldProcesses }),
            JSON.stringify({ config: newConfig, processes: processes || [] }),
            oldProcessTotal,
            newProcessTotal,
            userId
          ]
        );
      }
    });

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

// 删除包装配置
exports.deletePackagingConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const reason = await checkDeleteConstraints(id);
    if (reason) {
      const messages = {
        '被报价单引用': '该包装配置已被报价单引用，无法删除',
        '已设置标准成本': '该包装配置已设置标准成本，请先删除标准成本记录'
      };
      return res.status(400).json({ success: false, message: messages[reason] });
    }

    // 获取完整配置数据（用于历史记录）
    const configToDelete = await PackagingConfig.findWithDetails(id);
    if (!configToDelete) {
      return res.status(404).json({ success: false, message: '包装配置不存在' });
    }

    const processTotal = configToDelete.processes?.reduce((sum, p) => sum + (parseFloat(p.unit_price) || 0), 0) || 0;

    // 使用事务包裹删除和历史记录创建
    await dbManager.transaction(async (client) => {
      // 1. 软删除包材和工序
      await client.query(
        'UPDATE packaging_materials SET is_active = false, updated_at = NOW() WHERE packaging_config_id = $1',
        [id]
      );
      await client.query(
        'UPDATE process_configs SET is_active = false, updated_at = NOW() WHERE packaging_config_id = $1',
        [id]
      );

      // 2. 软删除包装配置
      const deletedName = `${configToDelete.config_name}_deleted_${Date.now()}`;
      await client.query(
        `UPDATE packaging_configs
         SET is_active = false, config_name = $1, updated_at = NOW()
         WHERE id = $2`,
        [deletedName, id]
      );

      // 3. 创建删除历史记录
      if (userId) {
        await client.query(
          `INSERT INTO process_config_history (
            packaging_config_id, action, old_data, new_data, old_process_total, new_process_total, operated_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id,
            'delete',
            JSON.stringify({
              config: {
                config_name: configToDelete.config_name,
                packaging_type: configToDelete.packaging_type,
                layer1_qty: configToDelete.layer1_qty,
                layer2_qty: configToDelete.layer2_qty,
                layer3_qty: configToDelete.layer3_qty,
                factory: configToDelete.factory,
                is_active: configToDelete.is_active
              },
              processes: configToDelete.processes || []
            }),
            null,  // 删除后无新数据
            processTotal,
            0,  // 删除后总价为0
            userId
          ]
        );
      }
    });

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
    const userId = req.user?.id;
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

      // 获取完整配置数据（用于历史记录）
      const configToDelete = await PackagingConfig.findWithDetails(id);
      if (!configToDelete) continue;

      const processTotal = configToDelete.processes?.reduce((sum, p) => sum + (parseFloat(p.unit_price) || 0), 0) || 0;

      // 使用事务包裹删除和历史记录创建
      try {
        await dbManager.transaction(async (client) => {
          // 1. 软删除包材和工序
          await client.query(
            'UPDATE packaging_materials SET is_active = false, updated_at = NOW() WHERE packaging_config_id = $1',
            [id]
          );
          await client.query(
            'UPDATE process_configs SET is_active = false, updated_at = NOW() WHERE packaging_config_id = $1',
            [id]
          );

          // 2. 软删除包装配置
          const deletedName = `${configToDelete.config_name}_deleted_${Date.now()}`;
          await client.query(
            `UPDATE packaging_configs
             SET is_active = false, config_name = $1, updated_at = NOW()
             WHERE id = $2`,
            [deletedName, id]
          );

          // 3. 创建删除历史记录
          if (userId) {
            await client.query(
              `INSERT INTO process_config_history (
                packaging_config_id, action, old_data, new_data, old_process_total, new_process_total, operated_by
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                id,
                'delete',
                JSON.stringify({
                  config: {
                    config_name: configToDelete.config_name,
                    packaging_type: configToDelete.packaging_type,
                    layer1_qty: configToDelete.layer1_qty,
                    layer2_qty: configToDelete.layer2_qty,
                    layer3_qty: configToDelete.layer3_qty,
                    factory: configToDelete.factory,
                    is_active: configToDelete.is_active
                  },
                  processes: configToDelete.processes || []
                }),
                null,  // 删除后无新数据
                processTotal,
                0,  // 删除后总价为0
                userId
              ]
            );
          }
        });
        results.deleted++;
      } catch (err) {
        results.failed.push({ id, name: config.config_name, reason: err.message });
      }
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
