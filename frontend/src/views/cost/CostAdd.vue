<template>
  <div class="cost-page-wrapper">
    <!-- 顶部导航栏 -->
    <CostPageHeader :title="pageTitle" :show-back="true" @back="goBack">
      <template #after-title>
        <StatusBadge v-if="isEditMode" type="status" value="editing" />
      </template>
      <template #actions>
        <div v-if="form.packaging_config_id || form.customer_name" class="flex items-center gap-2">
          <span v-if="form.packaging_config_id" class="meta-tag">{{ selectedConfigInfo }}</span>
          <span v-if="form.packaging_config_id" class="meta-tag meta-tag-accent">{{ selectedConfigMethod }}</span>
          <span v-if="form.customer_name" class="meta-tag">{{ form.customer_name }}</span>
        </div>
      </template>
    </CostPageHeader>

    <!-- 退回原因提示（仅编辑已退回的报价单时显示） -->
    <el-alert
      v-if="showRejectionAlert"
      :title="rejectionReason || '该成本分析已被审核退回，请根据审核意见修改后重新提交'"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 16px;"
    />

    <!-- 左右分栏主体 -->
    <div class="cost-page-body">
      <!-- 左侧表单区 -->
      <div class="cost-form-panel">
        <el-form :model="form" :rules="rules" ref="formRef" label-width="100px" class="cost-form">
      <!-- 基本信息 -->
      <div class="cost-section">
        <div class="cost-section-header">
          <h3 class="cost-section-title">基本信息</h3>
          <el-tag v-if="isEstimationMode" type="warning" size="small">新产品预估模式</el-tag>
        </div>
        <div class="cost-section-body">

        <!-- 预估模式：新产品型号选择 -->
        <el-row v-if="isEstimationMode" :gutter="24" class="estimation-row">
          <el-col :span="12">
            <el-form-item label="新产品型号" prop="model_id" :rules="[{ required: true, message: '请选择新产品型号', trigger: 'change' }]">
              <el-select v-model="form.model_id" placeholder="请选择新产品型号" @change="onNewProductModelChange" style="width: 100%" filterable :disabled="isEditMode">
                <el-option v-for="model in newProductModels" :key="model.id" :label="`${model.model_name} (${model.model_category})`" :value="model.id">
                  <div class="model-option"><span>{{ model.model_name }}</span><span class="model-category">{{ model.model_category }}</span></div>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="参考标准成本">
              <el-select v-model="referenceStandardCostId" placeholder="请选择参考标准成本" @change="onReferenceStandardCostChange" style="width: 100%" filterable clearable :disabled="!form.model_id || isEditMode" :loading="referenceStandardCostsLoading">
                <el-option v-for="sc in referenceStandardCosts" :key="sc.id" :label="`${sc.model_name} - ${sc.customer_name}`" :value="sc.id">
                  <div class="reference-sc-option">
                    <span class="sc-model">{{ sc.model_name }}</span>
                    <span class="sc-customer">{{ sc.customer_name }}</span>
                    <span class="sc-price">¥{{ formatNumber(sc.base_cost) }}</span>
                  </div>
                </el-option>
              </el-select>
              <div v-if="form.model_id && referenceStandardCosts.length === 0 && !referenceStandardCostsLoading" class="no-reference-tip">暂无同法规同分类的标准成本可参考</div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="法规标准" prop="regulation_id">
              <el-select v-model="form.regulation_id" placeholder="请选择法规标准" @change="onRegulationChange" style="width: 100%" :disabled="isEditMode || isEstimationMode">
                <el-option v-for="reg in regulations" :key="reg.id" :label="reg.name" :value="reg.id" />
              </el-select>
            </el-form-item>
          </el-col>

          <el-col :span="12">
            <el-form-item label="型号配置" prop="packaging_config_id" v-if="!isEstimationMode">
              <el-select v-model="form.packaging_config_id" placeholder="请选择型号和包装配置" @change="onPackagingConfigChange" style="width: 100%" :disabled="!form.regulation_id || isEditMode" filterable>
                <el-option-group v-for="group in groupedPackagingConfigs" :key="group.type" :label="group.typeName">
                  <el-option v-for="config in group.configs" :key="config.id" :label="`${config.model_name} - ${config.config_name} (${formatPackagingMethodFromConfig(config)})`" :value="config.id">
                    <div class="config-option">
                      <span><strong>{{ config.model_name }}</strong> - {{ config.config_name }}</span>
                      <span class="config-method">{{ formatPackagingMethodFromConfig(config) }}</span>
                    </div>
                  </el-option>
                </el-option-group>
              </el-select>
            </el-form-item>
            <el-form-item label="产品分类" v-else>
              <el-input :value="selectedNewProductCategory" disabled placeholder="选择新产品型号后自动显示" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="客户名称" prop="customer_name">
              <el-autocomplete v-model="form.customer_name" :fetch-suggestions="handleCustomerSearch" :loading="customerSearchLoading" placeholder="输入客户名称搜索或新建" clearable value-key="name" style="width: 100%" @select="handleCustomerAutoSelect" @clear="handleCustomerClear">
                <template #default="{ item }">
                  <div class="customer-suggestion" :class="{ 'other-salesperson': !item.is_mine && item.user_id }">
                    <span class="customer-suggestion-name">{{ item.name }}</span>
                    <span class="customer-suggestion-code">{{ item.vc_code }}</span>
                    <span v-if="!item.is_mine && item.salesperson_name" class="customer-suggestion-owner">{{ item.salesperson_name }}</span>
                    <span v-else-if="item.region" class="customer-suggestion-region">{{ item.region }}</span>
                  </div>
                </template>
                <template #append v-if="isNewCustomer && form.customer_name">
                  <el-tag size="small" type="success">新客户</el-tag>
                </template>
                <template #append v-else-if="isOtherSalespersonCustomer">
                  <el-tag size="small" type="warning">他人客户</el-tag>
                </template>
              </el-autocomplete>
            </el-form-item>
          </el-col>

          <el-col :span="12">
            <el-form-item label="客户地区" prop="customer_region">
              <el-autocomplete v-model="form.customer_region" :fetch-suggestions="suggestRegions" placeholder="请输入客户地区" clearable :disabled="!!selectedCustomerId" style="width: 100%">
                <template #default="{ item }">{{ item.value }}</template>
              </el-autocomplete>
            </el-form-item>
          </el-col>
        </el-row>
        </div>
      </div>

      <!-- 销售类型 -->
      <div class="cost-section">
        <div class="cost-section-header">
          <h3 class="cost-section-title">销售类型</h3>
        </div>
        <div class="cost-section-body">

        <div class="sales-type-group">
          <div class="sales-type-card" :class="{ active: form.sales_type === 'domestic' }" @click="form.sales_type = 'domestic'; onSalesTypeChange()">
            <div class="sales-type-header">
              <span class="sales-type-title">内销</span>
              <span class="sales-type-badge">CNY</span>
            </div>
            <div class="sales-type-desc">含 {{ ((form.vat_rate || 0.13) * 100).toFixed(0) }}% 增值税</div>
          </div>
          <div class="sales-type-card" :class="{ active: form.sales_type === 'export' }" @click="form.sales_type = 'export'; onSalesTypeChange()">
            <div class="sales-type-header">
              <span class="sales-type-title">外销</span>
              <span class="sales-type-badge">USD</span>
            </div>
            <div class="sales-type-desc">FOB 条款 / 0% 税率</div>
          </div>
        </div>

        <!-- 内销增值税率选择 -->
        <div v-if="form.sales_type === 'domestic'" class="vat-rate-section">
          <el-form-item label="增值税率" prop="vat_rate">
            <el-select v-model="form.vat_rate" placeholder="请选择增值税率" @change="handleCalculateCost" style="width: 200px">
              <el-option v-for="rate in vatRateOptions" :key="rate" :label="`${(rate * 100).toFixed(0)}%`" :value="rate" />
            </el-select>
          </el-form-item>
        </div>

        <!-- 外销运费明细 -->
        <ExportFreightSection
          v-if="form.sales_type === 'export'"
          :shipping-info="shippingInfo"
          :freight-calculation="freightCalculation"
          :pcs-per-carton="shippingInfo.pcsPerCarton"
          @shipping-method-change="handleShippingMethodChange"
          @port-type-change="handlePortTypeChange"
          @quantity-unit-change="handleQuantityUnitChange"
          @quantity-input-change="handleQuantityInputChange"
          @calculate="handleCalculateCost"
        />

        <!-- 内销数量输入 -->
        <DomesticSection
          v-if="form.sales_type === 'domestic'"
          :shipping-info="shippingInfo"
          :pcs-per-carton="shippingInfo.pcsPerCarton"
          @quantity-unit-change="handleQuantityUnitChange"
          @quantity-input-change="handleQuantityInputChange"
          @cbm-price-change="handleDomesticCbmPriceChange"
          @calculate="handleCalculateCost"
        />
        </div>
      </div>

      <!-- 成本明细 -->
      <CostDetailTabs
        :materials="form.materials"
        :processes="form.processes"
        :packaging="form.packaging"
        :edit-mode="editMode"
        :material-search-options="materialSearchOptions"
        :material-search-loading="materialSearchLoading"
        :process-coefficient="configStore.config.process_coefficient || 1.56"
        :default-tab="activeDetailTab"
        @toggle-edit-mode="toggleEditMode"
        @add-row="handleAddRow"
        @remove-row="handleRemoveRow"
        @item-change="handleItemSubtotalChange"
        @calculate="handleCalculateCost"
        @search-material="handleSearchMaterial"
        @select-material="handleMaterialSelect"
        @select-packaging="handlePackagingMaterialSelect"
      />

        </el-form>
      </div>

      <!-- 右侧成本预览面板 -->
      <CostPreviewPanel
        :calculation="calculation"
        :sales-type="form.sales_type"
        :vat-rate="form.vat_rate"
        :overhead-rate="configStore.config.overhead_rate"
        :include-freight-in-base="form.include_freight_in_base"
        :custom-fees-with-values="customFeesWithValues"
        :all-profit-tiers="allProfitTiers"
        :slider-profit-rate="sliderProfitRate"
        :saving="saving"
        :submitting="submitting"
        @show-add-fee-dialog="showAddFeeDialog"
        @remove-custom-fee="handleRemoveCustomFee"
        @add-custom-profit-tier="handleAddCustomProfitTier"
        @remove-custom-profit-tier="handleRemoveCustomProfitTier"
        @update-custom-tier-price="handleUpdateCustomTierPrice"
        @update-tier-sort="handleUpdateTierSort"
        @submit="handleSubmitQuotation"
        @save-draft="handleSaveDraft"
        @cancel="handleCancel"
      />
    </div>

    <!-- 移动端底部栏 -->
    <div class="cost-mobile-footer">
      <div class="sticky-footer-left">
        <template v-if="calculation">
          <div class="sticky-price-item primary">
            <span class="sticky-price-label">最终成本价</span>
            <span class="sticky-price-value"><template v-if="form.sales_type === 'domestic'">{{ formatNumber(calculation.domesticPrice) }} CNY</template><template v-else>{{ formatNumber(calculation.insurancePrice) }} USD</template></span>
          </div>
          <div class="sticky-price-divider"></div>
          <div class="sticky-price-item secondary"><span class="sticky-price-label">基础成本</span><span class="sticky-price-value">{{ formatNumber(calculation.baseCost) }}</span></div>
          <div class="sticky-price-item secondary"><span class="sticky-price-label">运费</span><span class="sticky-price-value">{{ formatNumber(calculation.freightCost) }}</span></div>
          <div class="sticky-price-item secondary"><span class="sticky-price-label">管销价</span><span class="sticky-price-value">{{ formatNumber(calculation.overheadPrice) }}</span></div>
        </template>
        <span v-else class="sticky-placeholder">请完成表单填写以计算成本</span>
      </div>
      <div class="sticky-footer-right">
        <el-button @click="goBack" size="large">取消</el-button>
        <el-button type="info" @click="handleSaveDraft" :loading="saving" size="large">保存草稿</el-button>
        <el-button type="primary" @click="handleSubmitQuotation" :loading="submitting" size="large">提交审核</el-button>
      </div>
    </div>

    <!-- 添加自定义费用对话框 -->
    <el-dialog v-model="addFeeDialogVisible" title="添加管销后费用项" width="400px" class="minimal-dialog-auto" :close-on-click-modal="false" append-to-body>
      <el-form :model="newFee" :rules="feeRules" ref="feeFormRef" label-width="80px">
        <el-form-item label="费用项" prop="name"><el-input v-model="newFee.name" placeholder="输入在管销后计算的费用项目" /></el-form-item>
        <el-form-item label="费率" prop="rate">
          <el-input-number v-model="customFeeRatePercent" :controls="false" :precision="2" :min="0" :max="100" placeholder="输入数字" style="width: 180px;" />
          <span style="margin-left: 10px; color: #409eff;">%</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addFeeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmAddFee">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import CostPageHeader from '@/components/cost/CostPageHeader.vue'
import CostPreviewPanel from './components/CostPreviewPanel.vue'
import CostDetailTabs from './components/CostDetailTabs.vue'
import ExportFreightSection from './components/ExportFreightSection.vue'
import DomesticSection from './components/DomesticSection.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { formatNumber } from '@/utils/format'
import { useConfigStore } from '@/store/config'
import { useFreightCalculation, useCostCalculation, useQuotationData, useCustomerSearch, useMaterialSearch, useCustomFees, useQuotationDraft } from '@/composables'
import { AUTO_SAVE_INTERVAL, COMMON_REGIONS } from './config/costAddConfig'
import { useDetailRows, useRegionSuggestion } from './composables/useDetailRows'
import { useCostFormStore } from '@/store/costForm'

// New Composables
import { useCostForm } from './composables/useCostForm'
import { useEstimationLogic } from './composables/useEstimationLogic'
import { usePackagingLogic } from './composables/usePackagingLogic'
import { useCustomerLogic } from './composables/useCustomerLogic'
import { useDataFill } from './composables/useDataFill'
import { useFormSubmit } from './composables/useFormSubmit'
import { useDraftLogic } from './composables/useDraftLogic'

defineOptions({ name: 'CostAdd' })

const router = useRouter()
const route = useRoute()
const configStore = useConfigStore()
const costFormStore = useCostFormStore()
const activeDetailTab = ref('materials')

// 1. 基础表单逻辑
const {
  formRef, rules, editMode, currentModelCategory, regulations, packagingConfigs,
  isEditMode, vatRateOptions, resetForm: resetFormBase, validateForm
} = useCostForm()

// 使用 store 的 form 作为源，父子组件共享同一状态
const form = costFormStore.form

// 2. 通用业务逻辑 Hooks
const {
  freightCalculation, systemConfig, shippingInfo, domesticCbmPrice,
  currentFactory, loadSystemConfig, setShippingInfoFromConfig, calculateShippingInfo,
  resetShippingInfo
} = useFreightCalculation()

// 使用 store 的 quantityUnit 和 quantityInput，确保父子组件同步（使用 storeToRefs 保持响应式）
const { quantityUnit, quantityInput } = storeToRefs(costFormStore)

const { 
  calculation, customProfitTiers, modelCategory: costModelCategory, materialCoefficient, 
  materialCoefficientsCache, loadMaterialCoefficients, calculateItemSubtotal, calculateCost, 
  addCustomProfitTier, updateCustomTierPrice, updateTierSort, removeCustomProfitTier, 
  prepareCustomProfitTiersForSave, getAllProfitTiers 
} = useCostCalculation()

const { 
  saving, submitting, isSaved, loadRegulations, loadPackagingConfigs, loadBomMaterials, 
  loadPackagingConfigDetails, loadQuotationData, loadStandardCostData, saveQuotation, submitQuotation 
} = useQuotationData()

const { 
  isNewCustomer, selectedCustomerId, customerOptions, customerSearchLoading, 
  customerSelectFocused, onCustomerTypeChange, searchCustomers, onCustomerSelect 
} = useCustomerSearch()

const { 
  allMaterials, materialSearchOptions, materialSearchLoading, loadAllMaterials, 
  searchMaterials, onMaterialSelect, onPackagingMaterialSelect 
} = useMaterialSearch()

const { 
  hasDraft, getDraftInfo, saveDraft, loadDraft, clearDraft, startAutoSave, stopAutoSave 
} = useQuotationDraft()

// 3. 处理函数定义 (需要传递给后续 Logic Hooks)
const handleCalculateCost = () => calculateCost(form)

// 4. 拆分出的业务逻辑 Hooks
const { 
  newProductModels, referenceStandardCosts, referenceStandardCostsLoading, referenceStandardCostId,
  isEstimationMode, selectedNewProductCategory, loadNewProductModels, loadReferenceStandardCosts,
  onNewProductModelChange, onReferenceStandardCostChange: onReferenceStandardCostChangeLogic, fillReferenceStandardCostData: fillReferenceStandardCostDataLogic
} = useEstimationLogic({ 
  form, currentModelCategory, materialCoefficient, materialCoefficientsCache, 
  quantityInput, quantityUnit, loadMaterialCoefficients, setShippingInfoFromConfig, 
  calculateShippingInfo, handleCalculateCost 
})

// Wrappers for Estimation Logic
const onReferenceStandardCostChange = () => onReferenceStandardCostChangeLogic(loadStandardCostData, shippingInfo)
const fillReferenceStandardCostData = (data) => fillReferenceStandardCostDataLogic(data, shippingInfo)

const {
  selectedConfigInfo, selectedConfigMethod, filteredPackagingConfigs, groupedPackagingConfigs,
  formatPackagingMethodFromConfig, onPackagingConfigChange
} = usePackagingLogic({ 
  form, packagingConfigs, currentModelCategory, materialCoefficientsCache, materialCoefficient, 
  loadMaterialCoefficients, loadPackagingConfigDetails, currentFactory, loadBomMaterials, 
  editMode, setShippingInfoFromConfig, quantityInput, quantityUnit, calculateShippingInfo, 
  handleCalculateCost 
})

const { 
  isOtherSalespersonCustomer, selectedCustomerOwner, handleCustomerSearch, 
  handleCustomerAutoSelect: handleCustomerAutoSelectLogic, handleCustomerClear: handleCustomerClearLogic 
} = useCustomerLogic({ form, searchCustomers, customerOptions })

// Wrappers for Customer Logic
const handleCustomerAutoSelect = (item) => handleCustomerAutoSelectLogic(item, { selectedCustomerId, isNewCustomer })
const handleCustomerClear = () => handleCustomerClearLogic({ selectedCustomerId, isNewCustomer })

// 5. 剩余的胶水逻辑和页面特有逻辑

// 常用地区建议
const { suggestRegions } = useRegionSuggestion(COMMON_REGIONS)

// 退回原因（当编辑已退回的报价单时显示）
const rejectionReason = ref('')
const isRejected = ref(false)

// 是否显示退回原因提示
const showRejectionAlert = computed(() => {
  return isRejected.value || rejectionReason.value
})

// 明细行操作
const { addMaterialRow, addProcessRow, addPackagingRow, removeMaterialRow, removeProcessRow, removePackagingRow } = useDetailRows(form, handleCalculateCost)

// 自定义费用
const { addFeeDialogVisible, feeFormRef, newFee, feeRules, customFeeSummary, customFeesWithValues, showAddFeeDialog, confirmAddFee, removeCustomFee } = useCustomFees(form, calculation)

// hasFormData 需要在 composables 初始化前定义
const hasFormData = computed(() => form.customer_name || form.model_id || form.materials.length > 0 || form.processes.length > 0 || form.packaging.length > 0)

// 6. 数据填充逻辑 (从 composable 获取)
const { fillQuotationData, fillStandardCostData } = useDataFill({
  form, packagingConfigs, currentModelCategory, materialCoefficient, materialCoefficientsCache,
  currentFactory, customProfitTiers, shippingInfo, quantityUnit, quantityInput, allMaterials,
  configStore, setShippingInfoFromConfig, calculateShippingInfo, handleCalculateCost: () => calculateCost(form)
})

// 7. 表单提交逻辑 (从 composable 获取)
const { fieldLabels, prepareData, handleSaveDraft, handleSubmitQuotation } = useFormSubmit({
  form, route, router, validateForm, prepareCustomProfitTiersForSave,
  saveQuotation, submitQuotation, clearDraft, stopAutoSave
})

// 8. 草稿逻辑 (从 composable 获取)
const { formatDraftTime, getFormDataForDraft, restoreDraft, checkAndRestoreDraft } = useDraftLogic({
  form, route, currentModelCategory, quantityUnit, quantityInput, domesticCbmPrice,
  customProfitTiers, editMode, hasFormData, getDraftInfo, loadDraft, saveDraft, clearDraft,
  handleCalculateCost: () => calculateCost(form)
})

// Wrappers for Template Events
const handleQuantityUnitChange = () => {
  // 更新 form.quantity
  if (quantityUnit.value === 'carton' && shippingInfo.pcsPerCarton) {
    form.quantity = quantityInput.value * shippingInfo.pcsPerCarton
  } else {
    form.quantity = quantityInput.value
  }
  calculateShippingInfo(form, handleCalculateCost)
  handleCalculateCost()
}
const handleQuantityInputChange = () => {
  // 更新 form.quantity
  if (quantityUnit.value === 'carton' && shippingInfo.pcsPerCarton) {
    form.quantity = quantityInput.value * shippingInfo.pcsPerCarton
  } else {
    form.quantity = quantityInput.value
  }
  calculateShippingInfo(form, handleCalculateCost)
  handleCalculateCost()
}
const handleDomesticCbmPriceChange = () => {
  if (domesticCbmPrice.value > 0 && shippingInfo.cbm) {
    const ceiledCbm = Math.ceil(parseFloat(shippingInfo.cbm))
    form.freight_total = Math.round(domesticCbmPrice.value * ceiledCbm * 100) / 100
  }
  handleCalculateCost()
}
const handleShippingMethodChange = () => {
  form.port = ''
  freightCalculation.value = null
  calculateShippingInfo(form, handleCalculateCost)
  handleCalculateCost()
}
const handlePortTypeChange = () => {
  if (form.port_type === 'fob_shenzhen') {
    form.port = ''
  }
  calculateShippingInfo(form, handleCalculateCost)
  handleCalculateCost()
}

const handleMaterialSelectHelper = (row, index) => { onMaterialSelect(row, materialCoefficient.value, (r) => { calculateItemSubtotal(r); handleCalculateCost() }) }
const handlePackagingMaterialSelectHelper = (row, index) => { onPackagingMaterialSelect(row, (r) => { calculateItemSubtotal(r); handleCalculateCost() }) }
// Template uses handleMaterialSelect and handlePackagingMaterialSelect
const handleMaterialSelect = handleMaterialSelectHelper
const handlePackagingMaterialSelect = handlePackagingMaterialSelectHelper

const handleItemSubtotalChange = (row) => { calculateItemSubtotal(row); handleCalculateCost() }
const handleAddRow = (type) => { if (type === 'materials') addMaterialRow(); else if (type === 'processes') addProcessRow(); else if (type === 'packaging') addPackagingRow() }
const handleRemoveRow = (type, index) => { if (type === 'materials') removeMaterialRow(index); else if (type === 'processes') removeProcessRow(index); else if (type === 'packaging') removePackagingRow(index) }
const handleSearchMaterial = (query, category) => searchMaterials(query, category)
const handleAddCustomProfitTier = () => { if (!addCustomProfitTier()) ElMessage.warning('请先完成基础信息填写') }
const handleUpdateCustomTierPrice = (tier) => updateCustomTierPrice(tier)
const handleUpdateTierSort = (tier) => updateTierSort(tier)
const handleRemoveCustomProfitTier = (index) => removeCustomProfitTier(index)
const handleConfirmAddFee = () => confirmAddFee(handleCalculateCost)
const handleRemoveCustomFee = (index) => removeCustomFee(index, handleCalculateCost)

// Computed: Page Title
const pageTitle = computed(() => {
  if (route.params.id) return '编辑成本分析'
  if (route.query.copyFrom) return '复制成本分析'
  if (isEstimationMode.value) return '新产品成本预估'
  if (currentModelCategory.value) return '新增成本分析 - ' + currentModelCategory.value
  return '新增成本分析'
})

// Computed Helpers
const materialBeforeOverheadTotal = computed(() => form.materials.filter(item => !item.after_overhead).reduce((sum, item) => sum + item.subtotal, 0))
const materialAfterOverheadTotal = computed(() => form.materials.filter(item => item.after_overhead).reduce((sum, item) => sum + item.subtotal, 0))
const processSubtotal = computed(() => form.processes.reduce((sum, item) => sum + item.subtotal, 0))
const packagingTotal = computed(() => form.packaging.reduce((sum, item) => sum + item.subtotal, 0))
const allProfitTiers = getAllProfitTiers

// Slider Logic
const sliderProfitRate = ref(25)
const sliderPrice = computed(() => {
  if (!calculation.value) return 0
  const basePrice = form.sales_type === 'domestic' ? calculation.value.domesticPrice : calculation.value.insurancePrice
  return basePrice / (1 - sliderProfitRate.value / 100)
})
const setSliderFromTier = (tier) => {
  const rate = parseInt(tier.profitPercentage) || 0
  sliderProfitRate.value = rate
}

// Custom Fee Wrapper
const customFeeRatePercent = computed({
  get: () => {
    if (newFee.rate === null || newFee.rate === undefined) return undefined
    return parseFloat((newFee.rate * 100).toFixed(4))
  },
  set: (val) => {
    if (val === null || val === undefined || val === '') {
      newFee.rate = null
    } else {
      newFee.rate = val / 100
    }
  }
})

// Regulation Change Orchestration
const onRegulationChange = () => {
  form.packaging_config_id = null
  form.model_id = null
  form.materials = []
  form.processes = []
  form.packaging = []
  calculation.value = null
  // 预估模式下重置参考标准成本
  if (isEstimationMode.value) {
    referenceStandardCostId.value = null
    referenceStandardCosts.value = []
  }
}

// Sales Type Change Orchestration
const onSalesTypeChange = () => {
  if (form.sales_type === 'domestic') {
    form.shipping_method = ''
    form.port_type = 'fob_shenzhen'
    form.port = ''
    freightCalculation.value = null
  } else {
    // 外销默认按箱
    quantityUnit.value = 'carton'
    onQuantityUnitChange(form, handleCalculateCost)
  }
  handleCalculateCost()
}

// Reset Form Full
const resetForm = () => {
  resetFormBase()
  calculation.value = null
  customProfitTiers.value = []
  isNewCustomer.value = true
  selectedCustomerId.value = null
  resetShippingInfo()
}

const handleCancel = async () => {
  if (!hasFormData.value) return
  try {
    await ElMessageBox.confirm('确定要取消当前成本分析填写吗？已填写的内容将被清除。', '取消成本分析', { confirmButtonText: '确定取消', cancelButtonText: '继续填写', type: 'warning' })
    resetForm()
    clearDraft()
    ElMessage.success('已清除填写内容')
  } catch { /* 用户选择继续填写 */ }
}

const toggleEditMode = (section) => { editMode[section] = !editMode[section]; if (editMode[section]) ElMessage.success(`${section === 'materials' ? '原料' : section === 'processes' ? '工序' : '包材'}名称已解锁，编辑后请锁定保存`) }
const goBack = () => router.back()

// Lifecycle
onMounted(async () => {
  await configStore.loadConfig()
  await loadSystemConfig()
  regulations.value = await loadRegulations()
  packagingConfigs.value = await loadPackagingConfigs()
  await loadAllMaterials()
  await loadMaterialCoefficients(currentModelCategory.value)
  form.vat_rate = configStore.config.vat_rate || 0.13
  
  if (route.query.mode === 'estimation') {
    form.is_estimation = true
    await loadNewProductModels()
  }
  
  if (route.query.model_category) {
    currentModelCategory.value = route.query.model_category
    if (materialCoefficientsCache.value[route.query.model_category]) materialCoefficient.value = materialCoefficientsCache.value[route.query.model_category]
  }
  if (route.params.id) {
    const data = await loadQuotationData(route.params.id)
    if (data) {
      await fillQuotationData(data, false)
      // 如果报价单被退回，获取退回原因
      if (data.quotation?.status === 'rejected') {
        isRejected.value = true
        try {
          const reviewRes = await request.get(`/review/${route.params.id}/detail`)
          if (reviewRes.success) {
            const comments = reviewRes.data.comments || []
            const lastComment = comments[comments.length - 1]
            if (lastComment?.content) {
              rejectionReason.value = `审核退回原因：${lastComment.content.replace(/^【退回原因】/, '')}`
            }
          }
        } catch (e) {
          logger.debug('获取退回原因失败:', e)
        }
      }
    }
  } else if (route.query.copyFromStandardCost) {
    const data = await loadStandardCostData(route.query.copyFromStandardCost)
    if (data) await fillStandardCostData(data)
  } else if (route.query.copyFrom) {
    const data = await loadQuotationData(route.query.copyFrom)
    if (data) await fillQuotationData(data, true)
  } else {
    await checkAndRestoreDraft()
  }
  if (!route.params.id) startAutoSave(getFormDataForDraft, AUTO_SAVE_INTERVAL)
})

watch(currentModelCategory, (val) => {
  costModelCategory.value = val
})

watch(() => route.query.mode, async (newMode, oldMode) => {
  if (route.path !== '/cost/add' || route.params.id || route.query.copyFromStandardCost) return
  resetForm()
  referenceStandardCostId.value = null
  referenceStandardCosts.value = []
  if (newMode === 'estimation') {
    form.is_estimation = true
    await loadNewProductModels()
  } else {
    form.is_estimation = false
  }
})

onBeforeRouteLeave(async (to, from, next) => {
  stopAutoSave()
  if (isSaved.value || !hasFormData.value || route.params.id) { next(); return }
  try {
    await ElMessageBox.confirm('是否保存为草稿以便下次继续？', '您有未保存的成本分析数据', { distinguishCancelAndClose: true, confirmButtonText: '保存草稿', cancelButtonText: '放弃', type: 'warning' })
    const { form: f, extras } = getFormDataForDraft()
    saveDraft(f, extras)
    ElMessage.success('草稿已保存')
    next()
  } catch (action) {
    if (action === 'cancel') { clearDraft(); next() }
    else next(false)
  }
})
</script>


<style scoped>
/* ========== 页面容器 - 左右分栏布局 ========== */
.cost-page-wrapper { max-width: 1400px; margin: 0; }

.cost-page-body {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 20px;
  align-items: start;
}

/* 左侧表单面板 */
.cost-form-panel { min-width: 0; }

/* 右侧预览面板 - 样式已移至 CostPreviewPanel.vue */
.cost-preview-panel { position: relative; }

/* ========== 智能客户搜索 ========== */
.customer-suggestion {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.customer-suggestion-name {
  font-weight: 500;
  color: #303133;
}
.customer-suggestion-code {
  font-size: 12px;
  color: #909399;
}
.customer-suggestion-region {
  font-size: 12px;
  color: #67c23a;
  margin-left: auto;
}
.customer-suggestion-owner {
  font-size: 12px;
  color: #e6a23c;
  margin-left: auto;
}
.customer-suggestion.other-salesperson {
  background: #fef3c7;
  margin: -4px -8px;
  padding: 8px;
  border-radius: 4px;
}

/* ========== 移动端底部栏（仅小屏显示） ========== */
.cost-mobile-footer {
  display: none;
  position: sticky;
  bottom: 0;
  background: #fff;
  border-top: 1px solid #e4e7ed;
  padding: 12px 16px;
  z-index: 50;
}

/* ========== 响应式 ========== */
@media (max-width: 1024px) {
  .cost-page-body { grid-template-columns: 1fr; }
  .cost-preview-panel { display: none; }
  .cost-mobile-footer { display: flex; justify-content: space-between; align-items: center; }
}

@media (max-width: 768px) {
  .cost-page-header { flex-direction: column; align-items: flex-start; gap: 8px; }
  .cost-header-right { flex-wrap: wrap; }
  .cost-section-body { padding: 12px !important; }
  .cost-section-body .el-row { margin: 0 !important; }
  .cost-section-body .el-col { padding: 0 !important; margin-bottom: 12px; }
  .cost-section-body .el-col-12, .cost-section-body .el-col-8, .cost-section-body .el-col-6, .cost-section-body .el-col-4 { 
    flex: 0 0 100% !important; max-width: 100% !important; 
  }
  .cost-form .el-form-item { margin-bottom: 16px; }
  .cost-form .el-form-item__label { float: none; text-align: left; padding: 0 0 4px 0; }
  .sales-type-group { flex-direction: column; }
  .sales-type-card { flex: none; }
}

/* ========== 原有样式保留 ========== */
.config-option { display: flex; justify-content: space-between; width: 100%; }
.config-method { color: #8492a6; font-size: 12px; }

/* 预估模式样式 */
.estimation-row { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px dashed #e4e7ed; background: #fffbeb; margin: -16px -16px 16px; padding: 16px; border-radius: 8px 8px 0 0; }
.model-option { display: flex; justify-content: space-between; width: 100%; }
.model-category { color: #8492a6; font-size: 12px; }
.reference-sc-option { display: flex; align-items: center; gap: 12px; width: 100%; }
.sc-model { font-weight: 500; }
.sc-customer { color: #606266; font-size: 13px; }
.sc-price { margin-left: auto; color: #67c23a; font-size: 12px; }
.no-reference-tip { color: #909399; font-size: 12px; margin-top: 4px; }
.customer-region { float: right; color: #8492a6; font-size: 12px; }
.vat-rate-section { margin-top: 16px; padding-top: 16px; border-top: 1px dashed #e4e7ed; }
.subtotal-row { display: flex; justify-content: flex-end; gap: 24px; padding: 8px 0; font-size: 14px; color: #606266; }
.subtotal-row strong { color: #409eff; }
.subtotal-row .after-overhead strong { color: #e6a23c; }
.subtotal-row .process-total .highlight { color: #67c23a; }
.material-option { display: flex; justify-content: space-between; width: 100%; }
.material-price { color: #8492a6; font-size: 13px; }
.help-cursor { cursor: help; }
:deep(.el-input-number) { width: 100%; }

/* 底部栏样式（移动端） */
.sticky-footer-left { display: flex; align-items: center; gap: 16px; }
.sticky-price-item { display: flex; flex-direction: column; }
.sticky-price-item.secondary .sticky-price-value { font-size: 14px; color: #606266; }
.sticky-price-label { font-size: 11px; color: #909399; }
.sticky-price-value { font-size: 16px; font-weight: 600; color: #409eff; }
.sticky-price-divider { width: 1px; height: 32px; background: #e4e7ed; }
.sticky-placeholder { font-size: 13px; color: #909399; }
.sticky-footer-right { display: flex; align-items: center; gap: 8px; }

/* ========== 新增布局样式 ========== */
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

.mb-0 { margin-bottom: 0 !important; }

/* 智能装箱提示（内销） */
.smart-packing-tip.domestic {
  margin: 12px 0 20px 0;
  border-radius: 6px;
  background: #fdf6ec;
  border: 1px solid #faecd8;
  padding: 12px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.smart-packing-tip.domestic .el-icon {
  color: #e6a23c;
  margin-top: 2px;
}
.smart-packing-tip.domestic .tip-title {
  color: #e6a23c;
  font-weight: 600;
  margin-bottom: 4px;
}

/* CBM过大警告样式 */
.smart-packing-tip.warning {
  margin: 12px 0 20px 0;
  border-radius: 6px;
  background: #fef0f0;
  border: 1px solid #fde2e2;
  padding: 12px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.smart-packing-tip.warning .el-icon {
  color: #f56c6c;
  margin-top: 2px;
}
.smart-packing-tip.warning .tip-title {
  color: #f56c6c;
  font-weight: 600;
  margin-bottom: 4px;
}</style>
