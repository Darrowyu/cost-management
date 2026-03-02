<template>
  <div class="export-freight-section">
    <div class="freight-panel">
      <div class="freight-panel-header">外销运费明细</div>
      <div class="freight-panel-body">
        <!-- 货柜类型 -->
        <el-row :gutter="24">
          <el-col :span="24">
            <div class="freight-field">
              <span class="freight-label">货柜类型:</span>
              <div class="container-type-btns">
                <el-button
                  :type="store.form.shipping_method === 'fcl_20' ? 'primary' : 'default'"
                  @click="handleShippingMethodChange('fcl_20')"
                >
                  20GP 小柜
                </el-button>
                <el-button
                  :type="store.form.shipping_method === 'fcl_40' ? 'primary' : 'default'"
                  @click="handleShippingMethodChange('fcl_40')"
                >
                  40GP 大柜
                </el-button>
                <el-button
                  :type="store.form.shipping_method === 'lcl' ? 'primary' : 'default'"
                  @click="handleShippingMethodChange('lcl')"
                >
                  LCL 散货
                </el-button>
                <el-button
                  :type="store.form.shipping_method === 'cif_lcl' ? 'primary' : 'default'"
                  @click="handleShippingMethodChange('cif_lcl')"
                >
                  CIF 深圳
                </el-button>
              </div>
            </div>
          </el-col>
        </el-row>

        <!-- 起运港口 -->
        <el-row :gutter="24" v-if="showPortSelection">
          <el-col :span="12">
            <div class="freight-field">
              <span class="freight-label">起运港口:</span>
              <el-radio-group v-model="store.form.port_type" @change="handlePortTypeChange">
                <el-radio value="fob_shenzhen">FOB 深圳</el-radio>
                <el-radio value="other">其他港口</el-radio>
              </el-radio-group>
            </div>
          </el-col>
          <el-col :span="12" v-if="store.form.port_type === 'other'">
            <el-form-item label="港口名称" prop="port" :rules="[{ required: true, message: '请输入港口名称', trigger: 'blur' }]">
              <el-input v-model="store.form.port" placeholder="请输入港口名称" style="width: 200px" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- LCL 数量输入 -->
        <div v-if="store.isLCL" class="lcl-quantity-section mt-4">
          <el-row :gutter="24">
            <el-col :span="12">
              <el-form-item label="数量单位">
                <el-radio-group v-model="store.quantityUnit" @change="handleQuantityUnitChange" :disabled="!pcsPerCarton">
                  <el-radio value="pcs">按片</el-radio>
                  <el-radio value="carton">按箱</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="quantityLabel" prop="quantity" class="compact-required-label">
                <el-input-number
                  v-model="store.quantityInput"
                  :min="1"
                  :max="99999999"
                  :precision="0"
                  :controls="false"
                  @change="handleQuantityInputChange"
                  style="width: 100%"
                />
                <div v-if="showQuantityHint" class="quantity-hint">= {{ store.form.quantity }} 片（{{ store.quantityInput }}箱 × {{ pcsPerCarton }}片/箱）</div>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="24" v-if="showShippingInfo">
            <el-col :span="12">
              <el-form-item label="总箱数">
                <div class="readonly-value-box">{{ shippingInfo.cartons || '-' }}</div>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="总体积(CBM)">
                <div class="readonly-value-box">{{ shippingInfo.cbm || '-' }}</div>
              </el-form-item>
            </el-col>
          </el-row>

          <!-- 智能装箱建议 -->
          <div v-if="showSmartPackingTip" class="smart-packing-tip domestic">
            <el-icon><InfoFilled /></el-icon>
            <div class="tip-content">
              <div class="tip-title">智能装箱建议:</div>
              <div>当前数量: {{ store.form.quantity }} pcs ({{ (store.form.quantity / pcsPerCarton).toFixed(1) }}箱)</div>
              <div>建议数量: <strong>{{ suggestedQuantity }} pcs</strong> ({{ suggestedCartons }}箱) 以达到整数箱</div>
            </div>
          </div>

          <!-- CBM过大提示 -->
          <div v-if="showCBMWarning" class="smart-packing-tip warning">
            <el-icon><WarningFilled /></el-icon>
            <div class="tip-content">
              <div class="tip-title">运输建议:</div>
              <div>当前CBM为 <strong>{{ shippingInfo.cbm }}</strong> (超过15)，建议选择整柜运输或联系物流单独确认运费。</div>
            </div>
          </div>
        </div>

        <!-- 运费卡片 -->
        <FreightCardFCL
          v-if="showFCLCard"
          :freight-calculation="freightCalculation"
          :shipping-method="store.form.shipping_method"
          :cbm="shippingInfo.cbm"
          :quantity="store.form.quantity"
        />
        <FreightCardLCL
          v-else-if="showLCLCard"
          :freight-calculation="freightCalculation"
        />
        <FreightCardCIF
          v-else-if="showCIFCard"
          :freight-calculation="freightCalculation"
        />

        <!-- 手动输入运费 -->
        <el-row :gutter="24" v-if="showManualFreight">
          <el-col :span="12">
            <el-form-item label="运费总价" prop="freight_total" :rules="[{ required: true, message: '请输入运费总价', trigger: 'blur' }]">
              <el-input-number
                v-model="store.form.freight_total"
                :min="0"
                :precision="4"
                :controls="false"
                @change="emitCalculate"
                style="width: 200px"
              />
              <span class="freight-unit">CNY</span>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 运费计入成本 -->
        <el-row :gutter="24">
          <el-col :span="24">
            <div class="freight-field freight-field-wide">
              <el-form-item label="运费计入成本" required class="wide-label-item mb-0">
                <el-radio-group v-model="store.form.include_freight_in_base" @change="emitCalculate">
                  <el-radio :value="true">是</el-radio>
                  <el-radio :value="false">否（运费在管销价基础上单独计算）</el-radio>
                </el-radio-group>
              </el-form-item>
            </div>
          </el-col>
        </el-row>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { InfoFilled, WarningFilled } from '@element-plus/icons-vue'
import { useCostFormStore } from '@/store/costForm'
import FreightCardFCL from './FreightCardFCL.vue'
import FreightCardLCL from './FreightCardLCL.vue'
import FreightCardCIF from './FreightCardCIF.vue'

const props = defineProps({
  shippingInfo: {
    type: Object,
    default: () => ({})
  },
  freightCalculation: {
    type: Object,
    default: null
  },
  pcsPerCarton: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits([
  'shipping-method-change',
  'port-type-change',
  'quantity-unit-change',
  'quantity-input-change',
  'calculate'
])

const store = useCostFormStore()

// ========== 显示控制 ==========
const showPortSelection = computed(() => {
  return store.form.shipping_method && !store.isCIF
})

const showShippingInfo = computed(() => {
  return props.shippingInfo.cartons !== null || props.shippingInfo.cbm !== null
})

const showSmartPackingTip = computed(() => {
  return store.quantityUnit === 'pcs' &&
    store.form.quantity &&
    props.pcsPerCarton &&
    (store.form.quantity % props.pcsPerCarton !== 0)
})

const showCBMWarning = computed(() => {
  return props.shippingInfo.cbm && parseFloat(props.shippingInfo.cbm) > 15
})

const showFCLCard = computed(() => {
  return store.isFOBShenzhen && props.freightCalculation && store.isFCL
})

const showLCLCard = computed(() => {
  return store.isFOBShenzhen && props.freightCalculation && store.form.shipping_method === 'lcl'
})

const showCIFCard = computed(() => {
  return store.form.port_type === 'cif_shenzhen' && props.freightCalculation
})

const showManualFreight = computed(() => {
  return !store.isFOBShenzhen && !store.isCIF
})

// ========== 计算属性 ==========
const quantityLabel = computed(() => {
  return store.quantityUnit === 'pcs' ? '订购数量(片)' : '订购数量(箱)'
})

const showQuantityHint = computed(() => {
  return store.quantityUnit === 'carton' && props.pcsPerCarton > 0
})

const suggestedQuantity = computed(() => {
  return Math.ceil(store.form.quantity / props.pcsPerCarton) * props.pcsPerCarton
})

const suggestedCartons = computed(() => {
  return Math.ceil(store.form.quantity / props.pcsPerCarton)
})

// ========== 事件处理 ==========
const handleShippingMethodChange = (method) => {
  store.setShippingMethod(method)
  emit('shipping-method-change', method)
}

const handlePortTypeChange = (type) => {
  store.setPortType(type)
  emit('port-type-change', type)
}

const handleQuantityUnitChange = () => {
  // 更新 store 中的 form.quantity
  if (store.quantityUnit === 'carton' && props.pcsPerCarton > 0) {
    store.form.quantity = store.quantityInput * props.pcsPerCarton
  } else {
    store.form.quantity = store.quantityInput
  }
  emit('quantity-unit-change')
}

const handleQuantityInputChange = () => {
  // 更新 store 中的 form.quantity
  if (store.quantityUnit === 'carton' && props.pcsPerCarton > 0) {
    store.form.quantity = store.quantityInput * props.pcsPerCarton
  } else {
    store.form.quantity = store.quantityInput
  }
  emit('quantity-input-change')
}

const emitCalculate = () => {
  emit('calculate')
}
</script>

<style scoped>
.export-freight-section {
  margin-top: 20px;
}

.freight-panel {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
}

.freight-panel-header {
  background: #f5f7fa;
  padding: 12px 16px;
  font-weight: 600;
  color: #303133;
  border-bottom: 1px solid #e4e7ed;
}

.freight-panel-body {
  padding: 16px;
}

.freight-field {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.freight-label {
  width: 80px;
  color: #606266;
  font-size: 14px;
  flex-shrink: 0;
}

.freight-unit {
  margin-left: 8px;
  color: #909399;
}

.container-type-btns {
  display: flex;
  gap: 10px;
}

.lcl-quantity-section {
  margin-top: 16px;
}

.quantity-hint {
  color: #67c23a;
  font-size: 12px;
  margin-top: 4px;
}

.readonly-value-box {
  background-color: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 0 12px;
  height: 32px;
  line-height: 32px;
  color: #606266;
  width: 100%;
}

.smart-packing-tip {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 6px;
  margin: 16px 0;
}

.smart-packing-tip .el-icon {
  color: #1890ff;
  font-size: 18px;
  margin-top: 2px;
}

.smart-packing-tip.domestic {
  background: #fdf6ec;
  border-color: #faecd8;
}

.smart-packing-tip.domestic .el-icon {
  color: #e6a23c;
}

.smart-packing-tip.warning {
  background: #fef0f0;
  border-color: #fde2e2;
}

.smart-packing-tip.warning .el-icon {
  color: #f56c6c;
}

.tip-content {
  flex: 1;
}

.tip-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.smart-packing-tip .tip-title {
  color: #1890ff;
}

.smart-packing-tip.domestic .tip-title {
  color: #e6a23c;
}

.smart-packing-tip.warning .tip-title {
  color: #f56c6c;
}

.tip-content div {
  color: #606266;
  font-size: 13px;
  line-height: 1.6;
}

.compact-required-label :deep(.el-form-item__label) {
  padding-right: 4px;
}

.compact-required-label :deep(.el-form-item__label::before) {
  margin-right: 2px !important;
}

.wide-label-item {
  display: flex !important;
  align-items: center !important;
}

.wide-label-item :deep(.el-form-item__label) {
  width: auto !important;
  margin-right: 12px !important;
  float: none !important;
  white-space: nowrap;
  text-align: left !important;
}

.wide-label-item :deep(.el-form-item__content) {
  margin-left: 0 !important;
  flex: none !important;
}

.mt-4 {
  margin-top: 16px;
}

.mb-0 {
  margin-bottom: 0 !important;
}
</style>
