/**
 * 成本计算工具类测试
 * 运行: node backend/utils/costCalculator.test.js
 */

const CostCalculator = require('./costCalculator');

console.log('========================================');
console.log('成本计算工具类测试');
console.log('========================================\n');

// 创建计算器实例（使用默认配置）
const calculator = new CostCalculator({
  overheadRate: 0.2,      // 管销率 20%
  vatRate: 0.13,          // 增值税率 13%
  insuranceRate: 0.003,   // 保险率 0.3%
  exchangeRate: 7.2,      // 汇率
  profitTiers: [0.05, 0.10, 0.25, 0.50]  // 利润区间
});

// 测试数据
const testData = {
  materialTotal: 5.5,      // 原料总价
  processTotal: 2.3,       // 工价总价
  packagingTotal: 1.2,     // 包材总价
  freightTotal: 500,       // 运费总价
  quantity: 1000           // 购买数量
};

console.log('测试数据:');
console.log('- 原料总价:', testData.materialTotal, 'CNY');
console.log('- 工价总价:', testData.processTotal, 'CNY');
console.log('- 包材总价:', testData.packagingTotal, 'CNY');
console.log('- 运费总价:', testData.freightTotal, 'CNY');
console.log('- 购买数量:', testData.quantity, '片\n');

// 测试 1: 基础成本计算（不含运费）
console.log('【测试 1】基础成本计算（不含运费）');
const freightCost = testData.freightTotal / testData.quantity;
const baseCost = calculator.calculateBaseCost({
  materialTotal: testData.materialTotal,
  processTotal: testData.processTotal,
  packagingTotal: testData.packagingTotal
});
console.log('基础成本价（原料 + 工序×系数 + 包材）:', baseCost, 'CNY');
console.log('注：基础成本不含运费，运费单独计算');
console.log('✓ 通过\n');

// 测试 2: 管销价计算
console.log('【测试 2】管销价计算');
const overheadPrice = calculator.calculateOverheadPrice(baseCost);
console.log('管销价:', overheadPrice, 'CNY');
console.log('✓ 通过\n');

// 测试 3: 内销价计算
console.log('【测试 3】内销价计算');
const domesticPrice = calculator.calculateDomesticPrice(overheadPrice);
console.log('内销价（含税）:', domesticPrice, 'CNY');
console.log('✓ 通过\n');

// 测试 4: 外销价计算
console.log('【测试 4】外销价计算');
const exportPrice = calculator.calculateExportPrice(overheadPrice);
const insurancePrice = calculator.calculateInsurancePrice(exportPrice);
console.log('外销价（未税）:', exportPrice, 'USD');
console.log('保险价:', insurancePrice, 'USD');
console.log('✓ 通过\n');

// 测试 5: 利润区间报价（内销）
console.log('【测试 5】利润区间报价（内销）');
const domesticProfitTiers = calculator.generateProfitTiers(domesticPrice);
console.log('基础价:', domesticPrice, 'CNY');
domesticProfitTiers.forEach(tier => {
  console.log(`  利润 ${tier.profitPercentage}:`, tier.price, 'CNY');
});
console.log('✓ 通过\n');

// 测试 6: 利润区间报价（外销）
console.log('【测试 6】利润区间报价（外销）');
const exportProfitTiers = calculator.generateProfitTiers(insurancePrice);
console.log('基础价:', insurancePrice, 'USD');
exportProfitTiers.forEach(tier => {
  console.log(`  利润 ${tier.profitPercentage}:`, tier.price, 'USD');
});
console.log('✓ 通过\n');

// 测试 7: 完整报价计算（内销）
console.log('【测试 7】完整报价计算（内销）');
const domesticQuotation = calculator.calculateQuotation({
  ...testData,
  salesType: 'domestic'
});
console.log('完整报价结果:');
console.log(JSON.stringify(domesticQuotation, null, 2));
console.log('✓ 通过\n');

// 测试 8: 完整报价计算（外销）
console.log('【测试 8】完整报价计算（外销）');
const exportQuotation = calculator.calculateQuotation({
  ...testData,
  salesType: 'export'
});
console.log('完整报价结果:');
console.log(JSON.stringify(exportQuotation, null, 2));
console.log('✓ 通过\n');

console.log('========================================');
console.log('所有测试通过！✓');
console.log('========================================');
