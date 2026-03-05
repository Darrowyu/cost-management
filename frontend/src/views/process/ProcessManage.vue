<template>
  <div class="process-management">
    <CostPageHeader title="工序管理" :show-back="false">
      <template #actions>
        <div class="toolbar-wrapper">
          <el-button class="toolbar-toggle" :icon="showToolbar ? CaretRight : CaretLeft" circle @click="showToolbar = !showToolbar" :title="showToolbar ? '收起工具栏' : '展开工具栏'" />
          <transition name="toolbar-fade">
            <el-space v-if="showToolbar && canEdit">
              <ActionButton type="download" @click="handleDownloadTemplate">下载模板</ActionButton>
              <el-upload action="#" :auto-upload="false" :on-change="handleFileChange" :show-file-list="false" accept=".xlsx,.xls">
                <ActionButton type="import">导入Excel</ActionButton>
              </el-upload>
              <ActionButton type="export" @click="handleExport">导出Excel</ActionButton>
              <ActionButton type="delete" :disabled="selectedConfigs.length === 0" @click="handleBatchDelete">批量删除</ActionButton>
              <ActionButton type="add" @click="showCreateDialog">新增工序配置</ActionButton>
            </el-space>
          </transition>
        </div>
      </template>
    </CostPageHeader>

    <el-card>
      <!-- 筛选栏 -->
      <div class="filter-bar">
        <!-- 产品类别筛选 -->
        <el-select 
          v-model="selectedCategory" 
          placeholder="选择产品类别" 
          @change="onCategoryChange" 
          clearable
          style="width: 150px; margin-right: 16px"
        >
          <el-option
            v-for="cat in categories"
            :key="cat"
            :label="cat"
            :value="cat"
          />
        </el-select>

        <el-select 
          v-model="selectedModelId" 
          placeholder="选择型号筛选" 
          @change="loadPackagingConfigs" 
          clearable
          filterable
          style="width: 300px; margin-right: 16px"
        >
          <el-option
            v-for="model in filteredModels"
            :key="model.id"
            :label="`${model.model_name} (${model.regulation_name})`"
            :value="model.id"
          />
        </el-select>
        
        <!-- 包装类型筛选 -->
        <el-select 
          v-model="selectedPackagingType" 
          placeholder="选择包装类型筛选" 
          @change="loadPackagingConfigs" 
          clearable
          style="width: 200px"
        >
          <el-option
            v-for="type in packagingTypeOptions"
            :key="type.value"
            :label="type.label"
            :value="type.value"
          />
        </el-select>

        <!-- 视图切换按钮 -->
        <el-button-group class="view-toggle">
          <el-button
            :type="viewMode === 'card' ? 'primary' : 'default'"
            :icon="Grid"
            @click="viewMode = 'card'"
          />
          <el-button
            :type="viewMode === 'list' ? 'primary' : 'default'"
            :icon="List"
            @click="viewMode = 'list'"
          />
        </el-button-group>
      </div>

      <!-- 卡片视图 -->
      <div v-if="viewMode === 'card'" class="config-cards" v-loading="loading">
        <div v-if="paginatedConfigs.length === 0" class="empty-tip">
          暂无匹配数据
        </div>
        <ManagementCard
          v-for="config in paginatedConfigs"
          :key="config.id"
          :config="config"
          type="process"
          :can-edit="canEdit"
          :can-delete="canEdit"
          @view="viewProcesses"
          @edit="editConfig"
          @delete="deleteConfig"
        />
      </div>

      <!-- 包装配置列表 -->
      <el-table 
        v-if="viewMode === 'list'" 
        :data="paginatedConfigs" 
        border 
        stripe 
        v-loading="loading"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="model_category" label="产品类别" width="110" sortable />
        <el-table-column prop="model_name" label="型号" width="150" sortable />
        <el-table-column prop="config_name" label="配置名称" width="160" sortable />
        <el-table-column label="生产工厂" width="120" sortable sort-by="factory">
          <template #default="{ row }">
            {{ getFactoryName(row.factory) }}
          </template>
        </el-table-column>
        <!-- 包装类型列 -->
        <el-table-column label="包装类型" width="120" sortable sort-by="packaging_type">
          <template #default="{ row }">
            <StatusBadge type="packaging_type" :value="row.packaging_type" />
          </template>
        </el-table-column>
        <el-table-column label="包装方式" min-width="250" sortable>
          <template #default="{ row }">
            <span class="packaging-info">
              {{ formatPackagingMethodFromConfig(row) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="每箱数量(PCS)" width="120" align="right">
          <template #default="{ row }">
            {{ calculateTotalFromConfig(row) }}
          </template>
        </el-table-column>
        <el-table-column label="工序总价" width="130" align="right" sortable sort-by="process_total_price">
          <template #default="{ row }">
            <span class="price-info">¥{{ formatNumber(row.process_total_price || 0) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center" sortable sort-by="is_active">
          <template #default="{ row }">
            <StatusBadge type="active_status" :value="row.is_active" mode="text" />
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160" sortable>
          <template #default="{ row }">
            {{ formatDateTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button :icon="View" circle size="small" @click="viewProcesses(row)" title="查看" />
            <el-button :icon="EditPen" circle size="small" @click="editConfig(row)" v-if="canEdit" title="编辑" />
            <el-button :icon="Delete" circle size="small" class="delete-btn" @click="deleteConfig(row)" v-if="canEdit" title="删除" />
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <CommonPagination v-model:current-page="currentPage" v-model:page-size="pageSize" :total="filteredByViewMode.length" />
    </el-card>

    <!-- 创建/编辑包装配置对话框 (重构为组件) -->
    <ProcessConfigDialog
      v-model="dialogVisible"
      :initial-data="editingConfig"
      :models="models"
      @saved="loadPackagingConfigs"
    />

    <!-- 查看工序对话框 (已组件化) -->
    <ManagementDetailDialog
      v-model="processDialogVisible"
      :config="currentConfig"
      :items="currentProcesses"
      type="process"
    />
  </div>
</template>


<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Grid, List, View, EditPen, CaretLeft, CaretRight, CopyDocument, Box } from '@element-plus/icons-vue' // 引入图标
import request from '../../utils/request'
import { useAuthStore } from '../../store/auth'
import { useConfigStore } from '../../store/config'
import { formatNumber, formatDateTime } from '../../utils/format'
import { getRegulationColor } from '../../utils/color'
import logger from '@/utils/logger'
import CostPageHeader from '@/components/cost/CostPageHeader.vue'
import CommonPagination from '@/components/common/CommonPagination.vue'
import ActionButton from '@/components/common/ActionButton.vue'
import StatusSwitch from '@/components/common/StatusSwitch.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ManagementCard from '@/components/management/ManagementCard.vue'
import ManagementDetailDialog from '@/components/management/ManagementDetailDialog.vue'
import ProcessConfigDialog from '@/components/process/ProcessConfigDialog.vue'
import { 
  getPackagingTypeOptions, 
  getPackagingTypeName, 
  formatPackagingMethodFromConfig,
  calculateTotalFromConfig
} from '../../config/packagingTypes'
import { usePagination } from '@/composables/usePagination'

const getFactoryName = (factory) => {
  const map = {
    'dongguan_xunan': '东莞迅安',
    'hubei_zhiteng': '湖北知腾'
  }
  return map[factory] || factory || '-'
}

defineOptions({ name: 'ProcessManage' })

const router = useRouter()
const authStore = useAuthStore()
const configStore = useConfigStore()
const showToolbar = ref(false)

// 权限检查
const canEdit = computed(() => authStore.hasPermission('master:process:manage'))

// 包装类型选项
const packagingTypeOptions = getPackagingTypeOptions()

// 数据
const models = ref([])
const categories = ref([])
const packagingConfigs = ref([])
const selectedConfigs = ref([])
const selectedCategory = ref(null)
const selectedModelId = ref(null)
const selectedPackagingType = ref(null)
const loading = ref(false)

// 根据产品类别过滤型号
const filteredModels = computed(() => {
  if (!selectedCategory.value) return models.value
  return models.value.filter(m => m.model_category === selectedCategory.value)
})

// 产品类别变化
const onCategoryChange = () => {
  selectedModelId.value = null
  loadPackagingConfigs()
}

// 视图切换状态: 'card' | 'list'
const viewMode = ref('card')

// 切换视图时清空选择
watch(viewMode, (newMode) => {
  if (newMode === 'card') {
    selectedConfigs.value = []
  }
})

// 分页状态
const { currentPage, pageSize } = usePagination('process')

// 根据视图模式获取数据源（卡片视图只显示启用的，列表视图显示全部）
const filteredByViewMode = computed(() => {
  if (viewMode.value === 'card') {
    return packagingConfigs.value.filter(c => c.is_active) // 卡片视图过滤禁用项
  }
  return packagingConfigs.value // 列表视图显示全部
})

// 分页后的数据
const paginatedConfigs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredByViewMode.value.slice(start, end)
})

// 对话框
const dialogVisible = ref(false)
const processDialogVisible = ref(false)
const editingConfig = ref(null) // Pass to child component

// 当前查看的配置
const currentConfig = ref(null)
const currentProcesses = ref([])

// 包装类型标签颜色
const getPackagingTypeTagType = (type) => {
  const typeMap = {
    standard_box: 'primary',
    no_box: 'success',
    blister_direct: 'warning',
    blister_bag: 'info'
  }
  return typeMap[type] || 'info'
}

// 加载型号列表
const loadModels = async () => {
  try {
    const response = await request.get('/models/active')
    if (response.success) {
      models.value = response.data
    }
  } catch (error) {
    // 错误已在拦截器处理
  }
}

// 加载产品类别
const loadCategories = async () => {
  try {
    const response = await request.get('/models/categories')
    if (response.success) {
      categories.value = response.data
    }
  } catch (error) {
    // 错误已在拦截器处理
  }
}

// 加载包装配置（包含禁用记录，前端根据视图模式过滤）
const loadPackagingConfigs = async () => {
  loading.value = true
  try {
    let url = '/processes/packaging-configs'
    const params = new URLSearchParams()
    params.append('include_inactive', 'true') // 请求包含禁用记录
    
    if (selectedModelId.value) {
      url = `/processes/packaging-configs/model/${selectedModelId.value}`
    }
    
    if (selectedPackagingType.value) {
      params.append('packaging_type', selectedPackagingType.value)
    }
    
    const queryString = params.toString()
    url += '?' + queryString
    
    const response = await request.get(url)
    
    if (response.success) {
      let data = response.data
      // 按产品类别过滤
      if (selectedCategory.value && !selectedModelId.value) {
        data = data.filter(item => item.model_category === selectedCategory.value)
      }
      packagingConfigs.value = data
    }
  } catch (error) {
    ElMessage.error('加载包装配置失败')
  } finally {
    loading.value = false
  }
}

// 显示创建对话框
const showCreateDialog = () => {
  editingConfig.value = null
  dialogVisible.value = true
}

// 编辑配置
const editConfig = async (row) => {
  try {
    const response = await request.get(`/processes/packaging-configs/${row.id}`)
    
    if (response.success) {
      editingConfig.value = response.data
      dialogVisible.value = true
    }
  } catch (error) {
    // 错误已在拦截器处理
  }
}


// 查看工序
const viewProcesses = async (row) => {
  try {
    const response = await request.get(`/processes/packaging-configs/${row.id}`)
    
    if (response.success) {
      currentConfig.value = response.data
      currentProcesses.value = response.data.processes || []
      processDialogVisible.value = true
    }
  } catch (error) {
    // 错误已在拦截器处理
  }
}

// 删除配置
const deleteConfig = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要删除包装配置"${row.config_name}"吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await request.delete(`/processes/packaging-configs/${row.id}`)
    ElMessage.success('删除成功')
    loadPackagingConfigs()
  } catch (error) {
    if (error !== 'cancel') {
      // 错误已在拦截器处理
    }
  }
}

// 批量删除（使用批量删除API，显示详细结果）
const handleBatchDelete = async () => {
  if (selectedConfigs.value.length === 0) { ElMessage.warning('请先选择要删除的配置'); return }
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedConfigs.value.length} 条配置吗？`, '批量删除确认', { type: 'warning' })
    const ids = selectedConfigs.value.map(item => item.id)
    const response = await request.post('/processes/packaging-configs/batch-delete', { ids })
    if (response.success) {
      const { deleted, failed } = response.data
      if (failed?.length > 0) {
        const reasons = failed.map(f => `${f.name}: ${f.reason}`).join('\n')
        ElMessageBox.alert(`成功删除 ${deleted} 条\n以下配置无法删除:\n${reasons}`, '删除结果', { type: 'warning' })
      } else {
        ElMessage.success(`成功删除 ${deleted} 条配置`)
      }
      loadPackagingConfigs()
    }
  } catch (error) { if (error !== 'cancel') { /* 错误已在拦截器处理 */ } }
}

// 选择变化
const handleSelectionChange = (selection) => {
  selectedConfigs.value = selection
}

// 文件选择
const handleFileChange = async (file) => {
  const formData = new FormData()
  formData.append('file', file.raw)

  try {
    const response = await request.post('/processes/process-configs/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    
    if (response.success) {
      const { created, updated, errors } = response.data
      let message = `导入成功！创建 ${created} 条，更新 ${updated} 条`
      if (errors && errors.length > 0) {
        message += `\n${errors.slice(0, 3).join('\n')}`
        if (errors.length > 3) {
          message += `\n...还有 ${errors.length - 3} 条错误`
        }
      }
      ElMessage.success(message)
      loadPackagingConfigs()
    }
  } catch (error) {
    // 错误已在拦截器处理
  }
}

// 导出
const handleExport = async () => {
  if (selectedConfigs.value.length === 0) {
    ElMessage.warning('请先选择要导出的数据')
    return
  }

  try {
    const ids = selectedConfigs.value.map(item => item.id)
    const response = await request.post('/processes/process-configs/export/excel', 
      { ids },
      { responseType: 'blob' }
    )
    
    const url = window.URL.createObjectURL(new Blob([response]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `工序清单_${Date.now()}.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

// 下载模板
const handleDownloadTemplate = async () => {
  try {
    const response = await request.get('/processes/process-configs/template/download', {
      responseType: 'blob'
    })
    
    const url = window.URL.createObjectURL(new Blob([response]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', '工序导入模板.xlsx')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    ElMessage.success('下载成功')
  } catch (error) {
    ElMessage.error('下载失败')
  }
}

onMounted(async () => {
  await configStore.loadConfig()
  loadModels()
  loadCategories()
  loadPackagingConfigs()
})
</script>

<style scoped>
.filter-bar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}

.view-toggle {
  margin-left: auto;
}

/* 卡片视图样式 */
.config-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 1199px) {
  .config-cards {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 991px) {
  .config-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 767px) {
  .config-cards {
    grid-template-columns: 1fr;
  }
}

.empty-tip {
  grid-column: 1 / -1;
  text-align: center;
  color: #909399;
  padding: 40px 0;
}

/* 查看对话框样式 */
:deep(.view-dialog .el-dialog__body) {
  max-height: 70vh;
  overflow-y: auto;
}

.packaging-info {
  color: #606266;
  font-weight: 500;
}

.price-info {
  color: #409EFF;
  font-weight: 600;
  font-size: 14px;
}

.status-tag {
  min-width: 48px;
  text-align: center;
}

.total-per-carton {
  font-size: 18px;
  font-weight: bold;
  color: #409EFF;
}

/* 查看对话框样式 */
:deep(.view-dialog .el-dialog__body) {
  max-height: 60vh;
  overflow-y: auto;
}

/* 工具栏折叠 */
.toolbar-wrapper { display: flex; align-items: center; gap: 12px; }
.toolbar-toggle { flex-shrink: 0; }
.toolbar-fade-enter-active, .toolbar-fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.toolbar-fade-enter-from, .toolbar-fade-leave-to { opacity: 0; transform: translateX(10px); }

</style>


