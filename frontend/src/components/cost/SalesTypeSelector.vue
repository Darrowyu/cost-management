<template>
  <div class="cost-section">
    <div class="cost-section-header">
      <h3 class="cost-section-title">
        <i class="ri-exchange-dollar-line bg-emerald-500"></i>
        销售类型
      </h3>
    </div>
    <div class="cost-section-body">
      <!-- 销售类型选择 -->
      <div class="sales-type-group">
        <div 
          class="sales-type-card" 
          :class="{ active: form.sales_type === 'domestic' }"
          @click="selectSalesType('domestic')"
        >
          <div class="sales-type-title">内销</div>
          <div class="sales-type-desc">币种: 人民币 (CNY)</div>
          <div class="sales-type-desc">含 {{ vatRatePercent }}% 增值税</div>
        </div>
        <div 
          class="sales-type-card" 
          :class="{ active: form.sales_type === 'export' }"
          @click="selectSalesType('export')"
        >
          <div class="sales-type-title">外销</div>
          <div class="sales-type-desc">币种: 美元 (USD)</div>
          <div class="sales-type-desc">FOB 条款 / 0% 税率</div>
        </div>
      </div>

      <!-- 内销增值税率 -->
      <div v-if="form.sales_type === 'domestic'" class="mb-5 pt-5 border-t border-dashed border-slate-200">
        <el-form-item label="增值税率" prop="vat_rate">
          <el-select v-model="form.vat_rate" placeholder="请选择增值税率" @change="$emit('calculate')" style="width: 200px">
            <el-option v-for="rate in vatRateOptions" :key="rate" :label="`${(rate * 100).toFixed(0)}%`" :value="rate" />
          </el-select>
        </el-form-item>
      </div>

      <!-- 外销运费配置 -->
      <div v-if="form.sales_type === 'export'" class="freight-panel">
        <div class="freight-panel-header">
          <i class="ri-ship-line"></i>
          外销运费明细
        </div>

        <!-- 货柜类型 -->
        <div class="freight-field mb-4">
          <span class="freight-label">货柜类型:</span>
          <div class="flex gap-2">
            <el-button 
              :type="form.shipping_method === 'fcl_20' ? 'primary' : 'default'"
              @click="selectShippingMethod('fcl_20')"
            >20GP 小柜</el-button>
            <el-button 
              :type="form.shipping_method === 'fcl_40' ? 'primary' : 'default'"
              @click="selectShippingMethod('fcl_40')"
            >40GP 大柜</el-button>
            <el-button 
              :type="form.shipping_method === 'lcl' ? 'primary' : 'default'"
              @click="selectShippingMethod('lcl')"
            >LCL 散货</el-button>
          </div>
        </div>

        <!-- 港口选择 -->
        <div v-if="form.shipping_method" class="cost-form-row cost-form-row-2 mb-4">
          <div class="freight-field">
            <span class="freight-label">起运港口:</span>
            <el-radio-group v-model="form.port_type" @change="$emit('port-type-change')">
              <el-radio value="fob_shenzhen">FOB 深圳</el-radio>
              <el-radio value="other">其他港口</el-radio>
            </el-radio-group>
          </div>
          <div v-if="form.port_type === 'other'" class="freight-field">
            <span class="freight-label">港口名称:</span>
            <el-input v-model="form.port" placeholder="请输入港口名称" style="width: 200px" />
          </div>
        </div>

        <!-- 数量配置 -->
        <div v-if="form.shipping_method" class="cost-form-row cost-form-row-4 mb-4">
          <div class="freight-field">
            <span class="freight-label">数量单位:</span>
            <el-radio-group v-model="localQuantityUnit" @change="onQuantityUnitChange" :disabled="!shippingInfo.pcsPerCarton">
              <el-radio value="pcs">按片</el-radio>
              <el-radio value="carton">按箱</el-radio>
            </el-radio-group>
          </div>
          <div class="freight-field">
            <span class="freight-label">订购数量:</span>
            <el-input-number
              v-model="localQuantityInput"
              :min="1"
              :precision="0"
              :controls="false"
              @change="onQuantityInputChange"
              style="width: 120px"
              :disabled="isFclFobShenzhen"
            />
            <span class="freight-unit">{{ localQuantityUnit === 'pcs' ? 'pcs' : '箱' }}</span>
          </div>
          <div v-if="shippingInfo.cartons !== null" class="freight-field">
            <span class="freight-label">箱数:</span>
            <span class="freight-value">{{ shippingInfo.cartons }}</span>
          </div>
          <div v-if="shippingInfo.cbm !== null" class="freight-field">
            <span class="freight-label">CBM:</span>
            <span class="freight-value">{{ shippingInfo.cbm }}</span>
          </div>
        </div>

        <!-- 智能装箱建议 -->
        <div v-if="freightCalculation && freightCalculation.suggestedQuantity" class="cost-tip info">
          <i class="ri-lightbulb-line"></i>
          <div class="cost-tip-content">
            <div class="cost-tip-title">智能装箱建议</div>
            <div>当前数量: {{ form.quantity }} pcs ≈ {{ shippingInfo.cartons }} 箱</div>
            <div>建议数量: <strong>{{ freightCalculation.suggestedQuantity }} pcs</strong> ({{ freightCalculation.maxCartons }}箱) 以达到最佳装载率</div>
          </div>
        </div>

        <!-- 运费计算结果 - 整柜 -->
        <FreightResultCard
          v-if="form.port_type === 'fob_shenzhen' && freightCalculation && (form.shipping_method === 'fcl_20' || form.shipping_method === 'fcl_40')"
          type="fcl"
          :shipping-method="form.shipping_method"
          :freight-calculation="freightCalculation"
          :quantity="form.quantity"
        />

        <!-- 运费计算结果 - 散货 -->
        <FreightResultCard
          v-if="form.port_type === 'fob_shenzhen' && freightCalculation && form.shipping_method === 'lcl'"
          type="lcl"
          :freight-calculation="freightCalculation"
        />

        <!-- 手动输入运费（非FOB深圳） -->
        <div v-if="form.port_type !== 'fob_shenzhen'" class="cost-form-row cost-form-row-2 mt-4">
          <div class="freight-field">
            <span class="freight-label">运费总价:</span>
            <el-input-number v-model="form.freight_total" :min="0" :precision="4" :controls="false" @change="$emit('calculate')" style="width: 180px" />
            <span class="freight-unit">CNY</span>
          </div>
        </div>

        <!-- 运费计入成本选项 -->
        <div class="freight-field mt-4">
          <span class="freight-label w-28">运费计入成本:</span>
          <el-radio-group v-model="form.include_freight_in_base" @change="$emit('calculate')">
            <el-radio :value="true">是</el-radio>
            <el-radio :value="false">否（运费在管销价基础上单独计算）</el-radio>
          </el-radio-group>
        </div>
      </div>

      <!-- 内销数量配置 -->
      <div v-if="form.sales_type === 'domestic'" class="mt-5 pt-5 border-t border-dashed border-slate-200">
        <div class="cost-form-row cost-form-row-4">
          <el-form-item label="数量单位">
            <el-radio-group v-model="localQuantityUnit" @change="onQuantityUnitChange" :disabled="!shippingInfo.pcsPerCarton">
              <el-radio value="pcs">按片</el-radio>
              <el-radio value="carton">按箱</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item :label="localQuantityUnit === 'pcs' ? '购买数量(片)' : '购买数量(箱)'" prop="quantity">
            <el-input-number v-model="localQuantityInput" :min="1" :precision="0" :controls="false" @change="onQuantityInputChange" style="width: 100%" />
            <div v-if="localQuantityUnit === 'carton' && shippingInfo.pcsPerCarton" class="text-xs text-emerald-600 mt-1">
              = {{ form.quantity }} 片（{{ localQuantityInput }}箱 × {{ shippingInfo.pcsPerCarton }}片/箱）
            </div>
          </el-form-item>
          <el-form-item v-if="shippingInfo.cartons !== null" label="箱数">
            <el-input :value="shippingInfo.cartons" disabled />
          </el-form-item>
          <el-form-item v-if="shippingInfo.cbm !== null" label="CBM">
            <el-input :value="shippingInfo.cbm" disabled />
          </el-form-item>
        </div>

        <div class="cost-form-row cost-form-row-3 mt-4">
          <el-form-item label="每CBM单价">
            <el-input-number v-model="localDomesticCbmPrice" :min="0" :precision="2" :controls="false" @change="onDomesticCbmPriceChange" style="width: 100%" placeholder="0" />
          </el-form-item>
          <el-form-item label="运费总价" prop="freight_total">
            <el-input-number v-model="form.freight_total" :min="0" :precision="2" :controls="false" @change="$emit('calculate')" style="width: 100%" />
            <div v-if="localDomesticCbmPrice && shippingInfo.cbm" class="text-xs text-slate-400 mt-1">
              = {{ localDomesticCbmPrice }} × {{ Math.ceil(parseFloat(shippingInfo.cbm)) }} CBM
            </div>
          </el-form-item>
          <el-form-item label="运费计入成本">
            <el-radio-group v-model="form.include_freight_in_base" @change="$emit('calculate')">
              <el-radio :value="true">是</el-radio>
              <el-radio :value="false">否</el-radio>
            </el-radio-group>
          </el-form-item>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import FreightResultCard from './FreightResultCard.vue'

const props = defineProps({
  form: { type: Object, required: true },
  vatRateOptions: { type: Array, default: () => [0.13, 0.10] },
  shippingInfo: { type: Object, default: () => ({ cartons: null, cbm: null, pcsPerCarton: null }) },
  freightCalculation: { type: Object, default: null },
  quantityUnit: { type: String, default: 'pcs' },
  quantityInput: { type: Number, default: 1 },
  domesticCbmPrice: { type: Number, default: 0 }
})

const emit = defineEmits([
  'sales-type-change',
  'shipping-method-change',
  'port-type-change',
  'quantity-unit-change',
  'quantity-input-change',
  'domestic-cbm-price-change',
  'calculate',
  'update:quantityUnit',
  'update:quantityInput',
  'update:domesticCbmPrice'
])

const localQuantityUnit = ref(props.quantityUnit)
const localQuantityInput = ref(props.quantityInput)
const localDomesticCbmPrice = ref(props.domesticCbmPrice)

watch(() => props.quantityUnit, (val) => { localQuantityUnit.value = val })
watch(() => props.quantityInput, (val) => { localQuantityInput.value = val })
watch(() => props.domesticCbmPrice, (val) => { localDomesticCbmPrice.value = val })

const vatRatePercent = computed(() => ((props.form.vat_rate || 0.13) * 100).toFixed(0))

const isFclFobShenzhen = computed(() => {
  return (props.form.shipping_method === 'fcl_20' || props.form.shipping_method === 'fcl_40') && props.form.port_type === 'fob_shenzhen'
})

const selectSalesType = (type) => {
  props.form.sales_type = type
  emit('sales-type-change', type)
}

const selectShippingMethod = (method) => {
  props.form.shipping_method = method
  emit('shipping-method-change', method)
}

const onQuantityUnitChange = (val) => {
  emit('update:quantityUnit', val)
  emit('quantity-unit-change', val)
}

const onQuantityInputChange = (val) => {
  emit('update:quantityInput', val)
  emit('quantity-input-change', val)
}

const onDomesticCbmPriceChange = (val) => {
  emit('update:domesticCbmPrice', val)
  emit('domestic-cbm-price-change', val)
}
</script>
