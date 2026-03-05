<template>
  <div class="cost-section">
    <div class="cost-section-header">
      <h3 class="cost-section-title">
        <i class="ri-file-info-line bg-blue-500"></i>
        基本信息
      </h3>
    </div>
    <div class="cost-section-body">
      <!-- 法规 & 型号配置 -->
      <div class="cost-form-row cost-form-row-2">
        <el-form-item label="法规标准" prop="regulation_id" class="cost-form-item">
          <el-select
            v-model="form.regulation_id"
            placeholder="请选择法规标准"
            @change="$emit('regulation-change', $event)"
            style="width: 100%"
            :disabled="isEditMode"
          >
            <el-option v-for="reg in regulations" :key="reg.id" :label="reg.name" :value="reg.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="型号配置" prop="packaging_config_id" class="cost-form-item">
          <el-select
            v-model="form.packaging_config_id"
            placeholder="请选择型号和包装配置"
            @change="$emit('packaging-config-change', $event)"
            style="width: 100%"
            :disabled="!form.regulation_id || isEditMode"
            filterable
          >
            <el-option-group v-for="group in groupedPackagingConfigs" :key="group.type" :label="group.typeName">
              <el-option
                v-for="config in group.configs"
                :key="config.id"
                :label="`${config.model_name} - ${config.config_name} (${formatPackagingMethod(config)})`"
                :value="config.id"
              >
                <div class="flex justify-between w-full">
                  <span><strong>{{ config.model_name }}</strong> - {{ config.config_name }}</span>
                  <span class="text-slate-400 text-xs">{{ formatPackagingMethod(config) }}</span>
                </div>
              </el-option>
            </el-option-group>
          </el-select>
        </el-form-item>
      </div>

      <!-- 客户类型 -->
      <div class="cost-form-row">
        <el-form-item label="是否新客户" class="cost-form-item">
          <el-radio-group v-model="localIsNewCustomer" @change="onCustomerTypeChange">
            <el-radio :value="true">是</el-radio>
            <el-radio :value="false">否</el-radio>
          </el-radio-group>
        </el-form-item>
      </div>

      <!-- 客户信息 -->
      <div class="cost-form-row cost-form-row-2">
        <el-form-item label="客户名称" prop="customer_name" class="cost-form-item">
          <el-input v-if="localIsNewCustomer" v-model="form.customer_name" placeholder="请输入客户名称" clearable />
          <el-select
            v-else
            v-model="localSelectedCustomerId"
            filterable
            remote
            reserve-keyword
            clearable
            :remote-method="searchCustomers"
            :loading="customerSearchLoading"
            placeholder="输入关键词搜索客户"
            style="width: 100%"
            @change="onCustomerSelect"
            @focus="customerSelectFocused = true"
            @blur="customerSelectFocused = false"
          >
            <el-option
              v-for="c in customerOptions"
              :key="c.id"
              :label="customerSelectFocused ? `${c.vc_code} - ${c.name}` : c.name"
              :value="c.id"
            >
              <div class="flex justify-between w-full">
                <span>{{ c.vc_code }} - {{ c.name }}</span>
                <span v-if="c.region" class="text-slate-400 text-xs">{{ c.region }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item label="客户地区" prop="customer_region" class="cost-form-item">
          <el-input 
            v-model="form.customer_region" 
            placeholder="请输入客户地区" 
            :disabled="!localIsNewCustomer && localSelectedCustomerId" 
            clearable 
          />
        </el-form-item>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import request from '@/utils/request'
import logger from '@/utils/logger'

const props = defineProps({
  form: { type: Object, required: true },
  regulations: { type: Array, default: () => [] },
  groupedPackagingConfigs: { type: Array, default: () => [] },
  isEditMode: { type: Boolean, default: false },
  isNewCustomer: { type: Boolean, default: true },
  selectedCustomerId: { type: [Number, String], default: null },
  formatPackagingMethod: { type: Function, required: true }
})

const emit = defineEmits([
  'regulation-change',
  'packaging-config-change',
  'customer-type-change',
  'customer-select',
  'update:isNewCustomer',
  'update:selectedCustomerId'
])

const localIsNewCustomer = ref(props.isNewCustomer)
const localSelectedCustomerId = ref(props.selectedCustomerId)
const customerSearchLoading = ref(false)
const customerOptions = ref([])
const customerSelectFocused = ref(false)

watch(() => props.isNewCustomer, (val) => { localIsNewCustomer.value = val })
watch(() => props.selectedCustomerId, (val) => { localSelectedCustomerId.value = val })

const onCustomerTypeChange = (val) => {
  emit('update:isNewCustomer', val)
  emit('customer-type-change', val)
}

const onCustomerSelect = (customerId) => {
  emit('update:selectedCustomerId', customerId)
  const customer = customerOptions.value.find(c => c.id === customerId)
  emit('customer-select', customer)
}

const searchCustomers = async (query) => {
  if (!query || query.length < 1) {
    customerOptions.value = []
    return
  }
  customerSearchLoading.value = true
  try {
    const res = await request.get('/customers/search', { params: { keyword: query, limit: 20 } })
    if (res.success) {
      customerOptions.value = res.data || []
    }
  } catch (err) {
    logger.error('搜索客户失败:', err)
  } finally {
    customerSearchLoading.value = false
  }
}
</script>
