/**
 * 报价单相关公共工具函数
 * 提取自 costController.js，供各子控制器复用
 */

const Model = require('../../../models/Model');
const SystemConfig = require('../../../models/SystemConfig');
const CostCalculator = require('../../../utils/costCalculator');

/**
 * 验证报价单公共字段
 * @param {Object} data - 请求数据
 * @returns {string|null} 错误消息，无错误返回 null
 */
const validateQuotationData = (data) => {
    const { sales_type, freight_total, items } = data;
    if (sales_type === 'export' && (freight_total === undefined || freight_total === null || freight_total < 0)) {
        return '外销报价必须填写运费';
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
        return '请至少添加一项成本明细';
    }
    return null;
};

/**
 * 计算原料明细总计（提取公共逻辑）
 * @param {Array} items - 明细数组
 * @param {number} materialCoefficient - 原料系数
 * @param {string} modelCategory - 产品分类
 * @param {string} calculationType - 计算类型（主体/配件/滤毒盒/滤棉/滤饼）
 * @param {Object} calculationRules - 计算规则配置
 * @returns {Object} { materialTotal, afterOverheadMaterialTotal, processTotal, packagingTotal }
 */
const calculateItemTotals = (items, materialCoefficient, modelCategory, calculationType = '', calculationRules = {}) => {
    // 获取当前型号和计算类型对应的规则
    const getRulesForItem = (itemCategory) => {
        if (modelCategory && calculationType && calculationRules[modelCategory]) {
            const typeRules = calculationRules[modelCategory][calculationType];
            if (typeRules && typeRules[itemCategory]) {
                return typeRules[itemCategory];
            }
        }
        // 默认规则
        return { formula: 'divide', coefficient: materialCoefficient };
    };

    // 计算单项原料小计的辅助函数
    const calcMaterialSubtotal = (item, itemCategory) => {
        // 始终根据当前用量和单价重新计算，不依赖前端传入的subtotal
        const rules = getRulesForItem(itemCategory);
        const usage = parseFloat(item.usage_amount || 0);
        const price = parseFloat(item.unit_price || 0);

        // 根据规则中的 formula 决定计算方式
        if (rules.formula === 'multiply') {
            // 乘法公式：(用量 × 单价) / 系数
            const subtotal = (usage * price) / (rules.coefficient || 1);
            return Math.round(subtotal * 10000) / 10000;
        } else {
            // 除法公式：(单价 / 用量) / 系数
            if (!usage || usage === 0) return 0;
            const subtotal = (price / usage) / (rules.coefficient || 1);
            return Math.round(subtotal * 10000) / 10000;
        }
    };

    // 原料总计：不包含管销后算的原料
    const materialTotal = items
        .filter(item => item.category === 'material' && !item.after_overhead)
        .reduce((sum, item) => sum + calcMaterialSubtotal(item, 'material'), 0);

    // 管销后算的原料总计
    const afterOverheadMaterialTotal = items
        .filter(item => item.category === 'material' && item.after_overhead)
        .reduce((sum, item) => sum + calcMaterialSubtotal(item, 'material'), 0);

    // 工序直接累加subtotal
    const processTotal = items
        .filter(item => item.category === 'process')
        .reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0);

    // 包材总计：使用 calculationRules 配置（从 getRulesForItem 获取）
    const packagingTotal = items
        .filter(item => item.category === 'packaging')
        .reduce((sum, item) => sum + calcMaterialSubtotal(item, 'packaging'), 0);

    return { materialTotal, afterOverheadMaterialTotal, processTotal, packagingTotal };
};

/**
 * 获取原料系数、分类和计算类型
 * @param {number} modelId - 型号ID
 * @returns {Promise<{coefficient: number, category: string, calculationType: string}>} 原料系数、分类和计算类型
 */
const getModelCostParams = async (modelId) => {
    if (!modelId) return { coefficient: 1, category: '', calculationType: '' };
    const model = await Model.findById(modelId);
    if (model && model.model_category) {
        const coefficients = await SystemConfig.getValue('material_coefficients') || {};
        return {
            coefficient: CostCalculator.getMaterialCoefficient(model.model_category, coefficients),
            category: model.model_category,
            calculationType: model.calculation_type || ''
        };
    }
    return { coefficient: 1, category: '', calculationType: '' };
};

/**
 * 验证并获取增值税率
 * @param {number|undefined} vatRate - 请求中的增值税率
 * @param {Object} calculatorConfig - 计算器配置
 * @returns {{ valid: boolean, error?: string, vatRateToSave?: number }}
 */
const processVatRate = (vatRate, calculatorConfig) => {
    if (vatRate === undefined || vatRate === null) {
        return { valid: true, vatRateToSave: null };
    }
    const parsed = parseFloat(vatRate);
    if (isNaN(parsed) || parsed < 0 || parsed > 1) {
        return { valid: false, error: '增值税率必须在 0 到 1 之间' };
    }
    calculatorConfig.vatRate = parsed;
    return { valid: true, vatRateToSave: parsed };
};

/**
 * 重新计算所有明细的小计（在保存前调用，确保数据一致性）
 * @param {Array} items - 明细数组
 * @param {number} materialCoefficient - 原料系数
 * @param {string} modelCategory - 产品分类
 * @param {string} calculationType - 计算类型
 * @param {Object} calculationRules - 计算规则配置
 * @returns {Array} 重新计算后的明细数组
 */
const recalculateItemSubtotals = (items, materialCoefficient, modelCategory, calculationType = '', calculationRules = {}) => {
    // 获取当前型号和计算类型对应的规则
    const getRulesForItem = (itemCategory) => {
        if (modelCategory && calculationType && calculationRules[modelCategory]) {
            const typeRules = calculationRules[modelCategory][calculationType];
            if (typeRules && typeRules[itemCategory]) {
                return typeRules[itemCategory];
            }
        }
        // 默认规则
        return { formula: 'divide', coefficient: materialCoefficient };
    };

    return items.map(item => {
        const usage = parseFloat(item.usage_amount || 0);
        const price = parseFloat(item.unit_price || 0);

        if (item.category === 'material' || item.category === 'packaging') {
            const rules = getRulesForItem(item.category);
            // 根据规则中的 formula 决定计算方式
            if (rules.formula === 'multiply') {
                // 乘法公式：(用量 × 单价) / 系数
                const rawSubtotal = (usage * price) / (rules.coefficient || 1);
                item.subtotal = Math.round(rawSubtotal * 10000) / 10000;
            } else {
                // 除法公式：(单价 / 用量) / 系数
                if (!usage || usage === 0) {
                    item.subtotal = 0;
                } else {
                    const rawSubtotal = (price / usage) / (rules.coefficient || 1);
                    item.subtotal = Math.round(rawSubtotal * 10000) / 10000;
                }
            }
            item.coefficient_applied = true;
        } else if (item.category === 'process') {
            // 工序直接用量 × 单价
            item.subtotal = usage * price;
        }

        // 确保subtotal是4位小数
        item.subtotal = Math.round((item.subtotal || 0) * 10000) / 10000;
        return item;
    });
};

module.exports = {
    validateQuotationData,
    calculateItemTotals,
    getModelCostParams,
    processVatRate,
    recalculateItemSubtotals
};
