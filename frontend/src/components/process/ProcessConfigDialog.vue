<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? '编辑工序配置' : '新增工序配置'"
    width="850px"
    class="minimal-dialog"
    destroy-on-close
    append-to-body
    :close-on-click-modal="false"
    @update:model-value="handleClose"
  >
    <div class="dialog-content" v-loading="loading">
      <el-form
        ref="formRef"
        :model="formData"
        label-position="top"
        class="modern-form"
      >
        <!-- Section 1: 基础信息 (3-Column Compact) -->
        <div class="form-section">
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="产品型号" required>
                <el-select
                  v-model="form.model_id"
                  placeholder="选择产品型号"
                  :disabled="isEdit"
                  filterable
                  class="w-full"
                >
                  <el-option
                    v-for="model in models"
                    :key="model.id"
                    :label="`${model.model_name} (${model.regulation_name})`"
                    :value="model.id"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="配置名称" required>
                <el-input v-model="formData.config_name" placeholder="例如：C5标准包装" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="生产工厂" required>
                <el-select v-model="formData.factory" placeholder="选择工厂" class="w-full">
                  <el-option label="东莞迅安" value="dongguan_xunan" />
                  <el-option label="湖北知腾" value="hubei_zhiteng" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="状态">
                <StatusSwitch
                  v-model="formData.is_active"
                  :active-value="1"
                  :inactive-value="0"
                  active-text="启用"
                  inactive-text="停用"
                />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- Section 2: Packaging Spec Configuration (Shared Component) -->
        <div class="highlight-section">
          <div class="section-title">包装规格定义</div>
          <PackagingSpecConfigurator v-model="form" :disabled="isPackagingSpecDisabled" />
        </div>

        <!-- Section 3: 工序列表 -->
        <div class="form-section">
          <div class="flex justify-between items-center mb-3">
             <div class="section-title mb-0">工序列表</div>
             <div class="flex gap-2">
                <el-button type="info" plain size="small" @click="openProcessCopyDialog">
                  从其他配置复制
                </el-button>
                <el-button type="primary" plain size="small" @click="addProcess">
                  添加工序
                </el-button>
             </div>
          </div>

          <div class="process-table-container" ref="processTableContainer">
            <el-table
              ref="processTableRef"
              :data="formData.processes || []"
              border
              class="process-table"
              height="240"
              :header-cell-style="{ background: '#f8fafc', fontWeight: '500', color: '#64748b' }"
            >
              <el-table-column label="序号" width="60" type="index" align="center" fixed />
              <el-table-column label="工序名称" min-width="180" fixed>
                <template #default="{ row }">
                  <el-input v-model="row.process_name" placeholder="工序名称" size="small" />
                </template>
              </el-table-column>
              <el-table-column label="单价 (¥)" width="140">
                <template #default="{ row, $index }">
                  <div class="price-input-wrapper">
                    <el-input-number
                      v-model="row.unit_price"
                      :min="0" :precision="4" :step="0.01" :controls="false"
                      size="small" class="w-full" placeholder="0.00"
                    />
                    <el-button
                      v-if="row.isNew"
                      text
                      class="confirm-add-btn"
                      :disabled="!row.process_name || row.unit_price === null || row.unit_price === undefined || row.unit_price === ''"
                      @click="confirmProcess(row)"
                      title="确认添加"
                    >
                      <el-icon><Check /></el-icon>
                    </el-button>
                  </div>
                </template>
              </el-table-column>
              <el-table-column width="60" align="center" fixed="right">
                <template #default="{ $index }">
                  <el-button
                    text
                    class="delete-icon-btn"
                    @click="removeProcess($index)"
                  >
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- Summary & Info -->
          <div class="summary-section">
            <div v-if="isEdit && lastModifiedInfo" class="last-modified-info">
              <el-icon class="info-icon"><Clock /></el-icon>
              <span class="info-text">
                {{ lastModifiedInfo.operator_name || lastModifiedInfo.username || '未知用户' }} · {{ formatDateTime(lastModifiedInfo.operated_at) }}
                <span class="info-price">上次 ¥{{ formatNumber(lastModifiedInfo.new_process_total || 0) }}</span>
              </span>
            </div>
            <div class="price-summary">
              <div class="item">工序小计: ¥{{ formatNumber(formProcessSubtotal) }}</div>
              <div class="item total">
                含系数 ({{ configStore.getProcessCoefficient() }}):
                <span class="price">¥{{ formatNumber(formTotalProcessPrice) }}</span>
              </div>
            </div>
          </div>
        </div>

      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose" class="cancel-btn">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="apiLoading" class="submit-btn">
          {{ isEdit ? '保存配置' : '立即创建' }}
        </el-button>
      </div>
    </template>

    <!-- 一键复制弹窗 (内嵌) -->
    <el-dialog
      v-model="showProcessCopyDialog"
      title="复制工序"
      width="500px"
      append-to-body
      class="nested-dialog"
    >
      <el-form label-position="top">
        <el-form-item label="选择源配置">
           <el-select 
              v-model="copySourceConfigId" 
              filterable 
              placeholder="搜索配置..." 
              class="w-full"
              @change="handleCopySourceChange"
              :loading="copyConfigsLoading"
            >
              <el-option 
                v-for="c in configsWithProcesses" 
                :key="c.id" 
                :label="`${c.model_name} - ${c.config_name}`" 
                :value="c.id" 
              >
                 <div class="flex justify-between">
                   <span>{{ c.model_name }} - {{ c.config_name }}</span>
                   <span class="text-gray-400 text-xs">{{ c.process_count }}项</span>
                 </div>
              </el-option>
           </el-select>
        </el-form-item>
        
        <el-form-item label="预览" v-if="copySourcePreview.length">
          <div class="flex flex-wrap gap-2 p-2 bg-gray-50 rounded">
            <el-tag v-for="p in copySourcePreview.slice(0,5)" :key="p.id" size="small" type="info">{{ p.process_name }}</el-tag>
            <span v-if="copySourcePreview.length > 5" class="text-xs text-gray-400 self-center">+{{ copySourcePreview.length - 5 }}</span>
          </div>
        </el-form-item>

        <el-form-item label="模式">
          <el-radio-group v-model="copyMode">
            <el-radio value="replace">覆盖 (清空当前)</el-radio>
            <el-radio value="merge">追加 (保留当前)</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showProcessCopyDialog = false">取消</el-button>
          <el-button type="primary" @click="handleCopyProcesses" :loading="copyLoading">确认复制</el-button>
        </div>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, Clock } from '@element-plus/icons-vue'
import request from '@/utils/request'
import { getLatestProcessConfigHistory } from '@/api/process'
import { useConfigStore } from '@/store/config'
import StatusSwitch from '@/components/common/StatusSwitch.vue'
import PackagingSpecConfigurator from '@/components/packaging/PackagingSpecConfigurator.vue' // Import Shared Component
import { formatNumber, formatDateTime } from '@/utils/format'
import { useAuthStore } from '@/store/auth'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  initialData: { type: Object, default: null }, // Editing data
  models: { type: Array, required: true }
})

const emit = defineEmits(['update:modelValue', 'saved'])
const configStore = useConfigStore()
const authStore = useAuthStore()

const loading = ref(false)
const apiLoading = ref(false)
const formRef = ref(null)
const processTableRef = ref(null)
const processTableContainer = ref(null)

// Copy Dialog State
const showProcessCopyDialog = ref(false)
const copySourceConfigId = ref(null)
const copyMode = ref('replace')
const copyLoading = ref(false)
const copyConfigsLoading = ref(false)
const allConfigsForCopy = ref([])
const copySourcePreview = ref([])
const lastModifiedInfo = ref(null)

const defaultForm = {
  id: null,
  model_id: null,
  config_name: '',
  packaging_type: 'standard_box',
  layer1_qty: null,
  layer2_qty: null,
  layer3_qty: null,
  factory: 'dongguan_xunan',
  is_active: 1,
  processes: []
}

const form = ref({ ...defaultForm })
// 使用计算属性包装form.value，确保始终返回一个有效对象
const formData = computed({
  get: () => form.value || defaultForm,
  set: (val) => { form.value = val }
})
const isEdit = computed(() => !!props.initialData)

// Computed
const formProcessSubtotal = computed(() => {
  return (formData.processes || []).reduce((total, p) => total + (parseFloat(p.unit_price) || 0), 0)
})

// 采购员不能编辑包装规格（只能编辑包材）
const isPackagingSpecDisabled = computed(() => authStore.isPurchaser)

const formTotalProcessPrice = computed(() => {
  const coefficient = configStore.getProcessCoefficient()
  return formProcessSubtotal.value * coefficient
})

const configsWithProcesses = computed(() => {
  return allConfigsForCopy.value.filter(c => c.id !== formData.id && c.process_count > 0)
})

// For validation in submitForm
import { getPackagingTypeByKey } from '@/config/packagingTypes'
const currentPackagingTypeConfig = computed(() => getPackagingTypeByKey(form.value?.packaging_type || 'standard_box'))

// Lifecycle
watch(() => props.modelValue, (val) => {
  if (val) {
    if (props.initialData) {
      // Deep copy to break reference
      const data = JSON.parse(JSON.stringify(props.initialData))
      Object.assign(form, data)
      // Ensure numeric types
      form.processes = (data.processes || []).map(p => ({
        ...p,
        unit_price: Number(p.unit_price) || 0
      }))
      form.is_active = data.is_active ? 1 : 0
      // 加载最后修改信息
      loadLastModifiedInfo()
    } else {
      Object.assign(form, defaultForm)
      lastModifiedInfo.value = null
      // If parent passed a model_id context (not implemented yet in prop, but good practice)
    }
  }
})

// Methods
const handleClose = () => emit('update:modelValue', false)

// Definition of types for UI
const packagingTypes = [
  { key: 'standard_box', name: '标准彩盒' },
  { key: 'no_box', name: '无彩盒' },
  { key: 'blister_direct', name: '泡壳直出' },
  { key: 'blister_bag', name: '泡壳袋装' },
]

const setPackagingType = (type) => {
  if (form.value.packaging_type === type) return
  form.value.packaging_type = type
  // Reset Qtys
  form.value.layer1_qty = null
  form.value.layer2_qty = null
  form.value.layer3_qty = null
}

const addProcess = () => {
  if (!form.value.processes) {
    form.value.processes = []
  }
  const newIndex = form.value.processes.length
  form.value.processes.push({
    process_name: '',
    unit_price: null,
    sort_order: newIndex,
    isNew: true // 标记为新添加的行
  })
  // 滚动到新添加的行
  nextTick(() => {
    // 使用 el-table 的滚动方法
    const tableRef = processTableRef.value
    if (tableRef) {
      // Element Plus table 的滚动方法
      const scrollWrapper = tableRef.$el.querySelector('.el-scrollbar__wrap') ||
                           tableRef.$el.querySelector('.el-table__body-wrapper')
      if (scrollWrapper) {
        // 获取表格行
        const rows = tableRef.$el.querySelectorAll('.el-table__row')
        if (rows[newIndex]) {
          rows[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center' })
        } else {
          // 如果找不到具体行，滚动到底部
          scrollWrapper.scrollTop = scrollWrapper.scrollHeight
        }
      }
    }
  })
}

const confirmProcess = (row) => {
  // 移除新行标记
  delete row.isNew
}

const removeProcess = async (index) => {
  try {
    await ElMessageBox.confirm('确定要删除该工序吗？', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    form.value.processes.splice(index, 1)
    ElMessage.success('删除成功')
  } catch {
    // 用户取消删除
  }
}

const submitForm = async () => {
    if (!form.model_id) return ElMessage.warning('请选择型号')
    if (!form.config_name) return ElMessage.warning('请输入配置名称')

    // Validate Packaging Spec
    if (!form.layer1_qty) return ElMessage.warning('请填写包装规格')
    if (currentPackagingTypeConfig.value.layers >= 2 && !form.layer2_qty) return ElMessage.warning('请填写完整包装规格')

    apiLoading.value = true
    try {
        // 根据权限组装提交数据
        let payload
        const hasMaterialManage = authStore.hasPermission('master:material:manage')
        const hasProcessManage = authStore.hasPermission('master:process:manage')

        if (hasMaterialManage && !hasProcessManage) {
            // 只有原料管理权限：只提交包材和基本信息
            payload = {
                id: form.id,
                materials: form.materials
            }
        } else {
            // 有工序管理权限：提交完整数据
            payload = { ...form }
            // Clean up unneeded layers
            if (currentPackagingTypeConfig.value.layers < 3) payload.layer3_qty = null
        }

        let res
        if (isEdit.value) {
            res = await request.put(`/processes/packaging-configs/${data.id}`, payload)
        } else {
            res = await request.post('/processes/packaging-configs', payload)
        }

        if (res.success || (res && !res.error)) {
             ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
             emit('saved')
             handleClose()
        }
    } catch(e) {
        // error handled by request interceptor
    } finally {
        apiLoading.value = false
    }
}

// Copy Logic
const loadConfigsForCopy = async () => {
  copyConfigsLoading.value = true
  try {
    const response = await request.get('/processes/packaging-configs/with-process-count')
    if (response.success) {
      allConfigsForCopy.value = response.data
    }
  } catch (error) {
  } finally {
    copyConfigsLoading.value = false
  }
}

const openProcessCopyDialog = async () => {
    copySourceConfigId.value = null
    copySourcePreview.value = []
    copyMode.value = 'replace'
    showProcessCopyDialog.value = true
    await loadConfigsForCopy()
}

const handleCopySourceChange = async (id) => {
    if(!id) {
        copySourcePreview.value = []
        return
    }
    try {
        const res = await request.get(`/processes/packaging-configs/${id}`)
        if(res.success) copySourcePreview.value = res.data.processes || []
    } catch(e) {}
}

const handleCopyProcesses = () => {
    if(!copySourcePreview.value.length) return

    const newItems = copySourcePreview.value.map((p, idx) => ({
        process_name: p.process_name,
        unit_price: Number(p.unit_price) || 0,
        sort_order: idx
    }))

    if(copyMode.value === 'replace') {
        form.value.processes = newItems
    } else {
        // Merge
        const currentProcesses = form.value.processes || []
        const existingNames = new Set(currentProcesses.map(p => p.process_name))
        const toAdd = newItems.filter(p => !existingNames.has(p.process_name))
        form.value.processes = [...currentProcesses, ...toAdd]
        ElMessage.success(`追加了 ${toAdd.length} 项工序`)
    }
    showProcessCopyDialog.value = false
}

// 加载最后修改信息
const loadLastModifiedInfo = async () => {
  if (!isEdit.value || !form.id) return
  try {
    const res = await getLatestProcessConfigHistory(form.id)
    if (res.success && res.data) {
      lastModifiedInfo.value = res.data
    }
  } catch (e) {
    // 错误静默处理
  }
}
</script>

<style scoped>
.process-config-dialog :deep(.el-dialog__header),
.nested-dialog :deep(.el-dialog__header) {
  margin-right: 0;
  border-bottom: 1px solid #f0f2f5;
  padding: 16px 24px;
}

.process-config-dialog :deep(.el-dialog__body) {
  padding: 0;
}

.dialog-content {
  padding: 20px;
}

.modern-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: #64748b;
  padding-bottom: 6px;
}

.form-section {
  margin-bottom: 16px;
}
.form-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 12px;
}

/* Highlight Section (Compact) */
.highlight-section {
  border: none;
  border-radius: 8px;
  padding: 12px 16px;
  background-color: #f8fafc;
  overflow: visible;
}

/* Process Table Styling - Single scrollbar */
.process-table-container {
  border: 1px solid #ebeef5;
  border-bottom: none; /* Table has border */
}

.delete-icon-btn {
  padding: 4px;
  height: auto;
  color: #909399;
  transition: color 0.2s;
}
.delete-icon-btn:hover {
  color: #f56c6c;
  background-color: transparent;
}

/* Price Input with Confirm Button */
.price-input-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.price-input-wrapper .el-input-number {
  flex: 1;
}

.confirm-add-btn {
  padding: 2px;
  height: 20px;
  width: 20px;
  min-width: 20px;
  color: #909399;
  transition: color 0.2s;
}

.confirm-add-btn:hover {
  color: #67c23a;
}

/* Modern Radio */
.modern-radio :deep(.el-radio.is-bordered) {
    margin-right: 0;
    width: 100%;
    margin-right: 12px;
}
.modern-radio :deep(.el-radio.is-bordered:last-child) {
    margin-right: 0;
}

/* Footer */
.dialog-footer {
  padding: 16px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid #f0f2f5;
  background-color: #fcfcfc;
}
.submit-btn {
  min-width: 100px;
}

/* Summary Section (Merged) */
.summary-section {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* Price Summary */
.price-summary {
    display: flex;
    justify-content: flex-end;
    gap: 24px;
    padding: 10px 12px;
    background: #f8fafc;
    border-radius: 6px;
}
.price-summary .item {
    font-size: 13px;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 8px;
}
.price-summary .total {
    color: #334155;
    font-weight: 600;
}
.price-summary .price {
    font-size: 16px;
    color: #3b82f6;
}

/* Last Modified Info */
.last-modified-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #f0f9ff;
    border-radius: 6px;
    border-left: 3px solid #3b82f6;
}

.last-modified-info .info-icon {
    color: #3b82f6;
    font-size: 14px;
}

.last-modified-info .info-text {
    font-size: 12px;
    color: #475569;
}

.last-modified-info .info-price {
    margin-left: 8px;
    color: #059669;
    font-weight: 500;
}
</style>
