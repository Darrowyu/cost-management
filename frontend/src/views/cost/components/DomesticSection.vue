<template>
  <div class="domestic-quantity-section">
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
        <el-form-item label="箱数">
          <div class="readonly-value-box">{{ shippingInfo.cartons || '-' }}</div>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="CBM">
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

    <el-row :gutter="24" class="domestic-freight-row">
      <el-col :span="12">
        <el-form-item label="每CBM单价">
          <el-input-number
            v-model="store.domesticCbmPrice"
            :min="0"
            :max="99999999.99"
            :precision="2"
            :controls="false"
            @change="handleCbmPriceChange"
            style="width: 100%"
            placeholder="0"
          />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="运费总价" prop="freight_total" class="compact-required-label">
          <el-input-number
            v-model="store.form.freight_total"
            :min="0"
            :max="99999999.99"
            :precision="2"
            :controls="false"
            @change="emitCalculate"
            style="width: 100%"
          />
          <div v-if="showFreightHint" class="freight-hint">= {{ store.domesticCbmPrice }} × {{ cbmCeiled }} CBM</div>
        </el-form-item>
      </el-col>
    </el-row>

    <el-row :gutter="24">
      <el-col :span="24">
        <el-form-item label="运费计入成本" required class="wide-label-item">
          <el-radio-group v-model="store.form.include_freight_in_base" @change="emitCalculate">
            <el-radio :value="true">是</el-radio>
            <el-radio :value="false">否</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'
import { useCostFormStore } from '@/store/costForm'

const props = defineProps({
  shippingInfo: {
    type: Object,
    default: () => ({})
  },
  pcsPerCarton: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits([
  'quantity-unit-change',
  'quantity-input-change',
  'cbm-price-change',
  'calculate'
])

const store = useCostFormStore()

// ========== 显示控制 ==========
const showShippingInfo = computed(() => {
  return props.shippingInfo.cartons !== null || props.shippingInfo.cbm !== null
})

const showSmartPackingTip = computed(() => {
  return store.quantityUnit === 'pcs' &&
    store.form.quantity &&
    props.pcsPerCarton &&
    (store.form.quantity % props.pcsPerCarton !== 0)
})

const showQuantityHint = computed(() => {
  return store.quantityUnit === 'carton' && props.pcsPerCarton > 0
})

const showFreightHint = computed(() => {
  return store.domesticCbmPrice > 0 && props.shippingInfo.cbm > 0
})

// ========== 计算属性 ==========
const quantityLabel = computed(() => {
  return store.quantityUnit === 'pcs' ? '购买数量(片)' : '购买数量(箱)'
})

const cbmCeiled = computed(() => {
  return Math.ceil(parseFloat(props.shippingInfo.cbm || 0))
})

const suggestedQuantity = computed(() => {
  return Math.ceil(store.form.quantity / props.pcsPerCarton) * props.pcsPerCarton
})

const suggestedCartons = computed(() => {
  return Math.ceil(store.form.quantity / props.pcsPerCarton)
})

// ========== 事件处理 ==========
const handleQuantityUnitChange = () => {
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

const handleCbmPriceChange = () => {
  emit('cbm-price-change')
}

const emitCalculate = () => {
  emit('calculate')
}
</script>

<style scoped>
.domestic-quantity-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed #e4e7ed;
}

.quantity-hint {
  color: #67c23a;
  font-size: 12px;
  margin-top: 4px;
}

.freight-hint {
  color: #909399;
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
  gap: 8px;
  padding: 12px;
  margin: 12px 0 20px 0;
  border-radius: 6px;
  background: #fdf6ec;
  border: 1px solid #faecd8;
}

.smart-packing-tip .el-icon {
  color: #e6a23c;
  font-size: 18px;
  margin-top: 2px;
}

.tip-content {
  flex: 1;
}

.tip-title {
  color: #e6a23c;
  font-weight: 600;
  margin-bottom: 4px;
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

.domestic-freight-row {
  margin-top: 16px;
}
</style>
