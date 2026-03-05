<template>
  <div class="packaging-spec-configurator">
    <el-row :gutter="16" class="mb-2">
      <el-col :span="24">
        <el-form-item label="包装类型" class="mb-3">
          <div class="packaging-type-grid">
            <div 
              v-for="type in packagingTypes" 
              :key="type.key"
              class="type-card"
              :class="{ active: modelValue.packaging_type === type.key }"
              @click="setPackagingType(type.key)"
            >
              <div class="card-radio">
                <div class="radio-circle"></div>
              </div>
              <div class="type-name">{{ type.name }}</div>
            </div>
          </div>
        </el-form-item>
      </el-col>
    </el-row>

    <!-- Formula Style Spec Config -->
    <div class="spec-formula-container" v-if="currentPackagingTypeConfig">
       
      <!-- Item 1 -->
      <div class="formula-item input-card">
         <div class="item-label">{{ currentPackagingTypeConfig.fieldLabels[0] }}</div>
         <el-input-number
          v-model="modelValue.layer1_qty"
          :min="1"
          :controls="false"
          class="formula-input"
          placeholder="-"
          :disabled="disabled"
        />
      </div>

      <!-- Operator -->
      <div class="formula-operator" v-if="currentPackagingTypeConfig.layers >= 2">×</div>

      <!-- Item 2 -->
      <div class="formula-item input-card" v-if="currentPackagingTypeConfig.layers >= 2">
         <div class="item-label">{{ currentPackagingTypeConfig.fieldLabels[1] }}</div>
         <el-input-number
          v-model="modelValue.layer2_qty"
          :min="1"
          :controls="false"
          class="formula-input"
          placeholder="-"
          :disabled="disabled"
        />
      </div>
      
      <!-- Operator -->
      <div class="formula-operator" v-if="currentPackagingTypeConfig.layers >= 3">×</div>

      <!-- Item 3 -->
      <div class="formula-item input-card" v-if="currentPackagingTypeConfig.layers >= 3">
         <div class="item-label">{{ currentPackagingTypeConfig.fieldLabels[2] }}</div>
         <el-input-number
          v-model="modelValue.layer3_qty"
          :min="1"
          :controls="false"
          class="formula-input"
          placeholder="-"
          :disabled="disabled"
        />
      </div>

      <!-- Operator -->
      <div class="formula-operator">=</div>

      <!-- Result -->
      <div class="formula-item result-card">
        <div class="item-label">每箱总数</div>
        <div class="result-value">
          {{ computedTotalPerCarton }}
          <span class="result-unit">pcs</span>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getPackagingTypeByKey, calculateTotalPerCarton } from '@/config/packagingTypes'

const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

// Definition of types for UI
const packagingTypes = [
  { key: 'standard_box', name: '标准彩盒' },
  { key: 'no_box', name: '无彩盒' },
  { key: 'blister_direct', name: '泡壳直出' },
  { key: 'blister_bag', name: '泡壳袋装' },
]

// Computed: Current Type Config
const currentPackagingTypeConfig = computed(() => {
  return getPackagingTypeByKey(props.modelValue.packaging_type)
})

// Computed: Total Per Carton
const computedTotalPerCarton = computed(() => {
  return calculateTotalPerCarton(
    props.modelValue.packaging_type,
    props.modelValue.layer1_qty,
    props.modelValue.layer2_qty,
    props.modelValue.layer3_qty
  )
})

const setPackagingType = (type) => {
  if (props.modelValue.packaging_type === type) return
  
  // Create a copy to emit
  const newValue = { ...props.modelValue }
  newValue.packaging_type = type
  newValue.layer1_qty = null
  newValue.layer2_qty = null
  newValue.layer3_qty = null
  
  emit('update:modelValue', newValue)
}

</script>

<style scoped>
/* Packaging Type Cards */
.packaging-type-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  width: 100%;
}

.type-card {
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  height: 40px;
}

.type-card:hover {
  border-color: #c0c4cc;
  background: #fdfdfd;
}

.type-card.active {
  border-color: #409eff;
  background-color: #ecf5ff;
  box-shadow: 0 0 0 1px #409eff inset;
}

.card-radio {
  min-width: 14px;
  height: 14px;
  border: 1px solid #dcdfe6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  flex-shrink: 0;
}

.type-card.active .card-radio {
  border-color: #409eff;
  background: #409eff;
}

.radio-circle {
  width: 6px;
  height: 6px;
  background: #fff;
  border-radius: 50%;
  opacity: 0;
}

.type-card.active .radio-circle {
  opacity: 1;
}

.type-name {
  font-size: 12px;
  font-weight: 500;
  color: #334155;
  transition: color 0.2s;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.type-card.active .type-name {
  color: #409eff;
  font-weight: 600;
}

/* Formula Layout Styles */
.spec-formula-container {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  padding-top: 4px;
  flex-wrap: wrap;
}

.formula-item {
  flex: 1;
  min-width: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 72px;
}

.input-card {
  background-color: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  transition: all 0.2s;
}

.input-card:focus-within {
  border-color: #409eff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.1);
}

.result-card {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  min-width: 100px;
  flex: 0 0 auto;
}

.formula-operator {
  font-size: 18px;
  color: #94a3b8;
  font-weight: 400;
  user-select: none;
  padding: 0 2px;
}

.item-label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
  margin-top: 8px;
}

/* Custom Input Styling inside Formula Card */
.formula-input :deep(.el-input__wrapper) {
  box-shadow: none !important;
  background-color: transparent !important;
  padding: 0;
}

.formula-input :deep(.el-input__inner) {
  text-align: center;
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
  height: 32px;
  line-height: 32px;
}

/* Result Styles */
.result-value {
  font-size: 22px;
  font-weight: 700;
  color: #3b82f6;
  line-height: 1;
  display: flex;
  align-items: baseline;
  gap: 3px;
  margin-bottom: 8px;
}

.result-unit {
  font-size: 12px;
  font-weight: 500;
  color: #94a3b8;
}
</style>
