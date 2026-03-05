<template>
  <div class="material-manage">
    <CostPageHeader :title="currentTitle" :show-back="false">
      <template #actions>
        <div class="toolbar-wrapper">
          <el-button class="toolbar-toggle" :icon="showToolbar ? CaretRight : CaretLeft" circle @click="showToolbar = !showToolbar" :title="showToolbar ? '收起工具栏' : '展开工具栏'" />
          <transition name="toolbar-fade">
            <el-space v-if="showToolbar">
              <ActionButton type="download" @click="handleDownloadTemplate">下载模板</ActionButton>
              <el-upload action="#" :auto-upload="false" :on-change="handleFileChange" :show-file-list="false" accept=".xlsx,.xls">
                <ActionButton type="import">导入Excel</ActionButton>
              </el-upload>
              <ActionButton type="export" @click="handleExport">导出Excel</ActionButton>
              <ActionButton type="delete" :disabled="selectedMaterials.length === 0" @click="handleBatchDelete">批量删除</ActionButton>
              <ActionButton type="add" @click="handleAdd">新增原料</ActionButton>
            </el-space>
          </transition>
        </div>
      </template>
    </CostPageHeader>

    <el-card>
      <!-- 筛选区域 -->
      <div class="filter-container">
        <!-- 搜索框 -->
        <div class="search-row">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索品号、名称、厂商"
            clearable
            @input="handleSearch"
            style="width: 300px"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          
          <el-select 
            v-model="filterCategory" 
            placeholder="品名类别" 
            clearable 
            style="width: 120px"
            @change="handleSearch"
          >
            <el-option label="原料" value="原料" />
            <el-option label="包材" value="包材" />
          </el-select>
        </div>

        <!-- 子分类筛选（仅在特定类型下显示） -->
        <div v-if="currentType" class="category-row">
          <el-radio-group 
            v-model="currentSubcategory" 
            @change="handleSubcategoryChange" 
            size="default"
            class="sortable-radio-group"
          >
            <el-radio-button value="" class="static-tab">全部</el-radio-button>
            <el-radio-button
              v-for="(sub, index) in (currentType === 'half_mask' ? categoryStructure.half_mask : categoryStructure.general)"
              :key="sub"
              :value="sub"
              draggable="true"
              @dragstart="handleDragStart($event, index)"
              @dragover.prevent
              @drop="handleDrop($event, index)"
              class="draggable-tab"
             >
              {{ sub }}
            </el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <el-table 
        :data="tableData" 
        border 
        stripe 
        v-loading="loading" 
        @selection-change="handleSelectionChange" 
        empty-text="暂无原料数据"
      >
        <el-table-column type="selection" width="55" align="center" />
        
        <!-- 半面罩类视图 -->
        <template v-if="isHalfMaskView">
           <el-table-column prop="category" label="品名类别" width="100">
             <template #default="{ row }">
               <div class="category-cell">
                 <StatusBadge type="material_category" :value="row.category" />
               </div>
             </template>
           </el-table-column>
           <el-table-column prop="subcategory" label="细分类" width="120" />
           <el-table-column prop="item_no" label="品号" width="120" />
           <el-table-column prop="name" label="原料名称" width="200" show-overflow-tooltip />
           <el-table-column prop="supplier" label="供应商" width="150" show-overflow-tooltip />
           <el-table-column prop="price" label="单价" width="100" sortable>
             <template #default="{ row }">{{ formatMoney(row.price, row.currency) }}</template>
           </el-table-column>
           <el-table-column prop="currency" label="币别" width="70" align="center" />
           <el-table-column prop="unit" label="单位" width="70" align="center" />
           <el-table-column prop="product_desc" label="绑定型号" width="160" show-overflow-tooltip />
           <el-table-column prop="packaging_mode" label="包装方式" width="100" />
           <el-table-column prop="usage_amount" label="用量" width="80" />
           <el-table-column prop="production_cycle" label="生产周期" width="100" />
           <el-table-column prop="moq" label="MOQ" width="80" />
        </template>

        <!-- 非半面罩类视图 (口罩类/通用) -->
        <template v-else>
           <el-table-column prop="category" label="品名类别" width="100">
             <template #default="{ row }">
               <div class="category-cell">
                 <StatusBadge type="material_category" :value="row.category" />
               </div>
             </template>
           </el-table-column>
           <el-table-column prop="subcategory" label="细分类" width="120" />
           <el-table-column prop="item_no" label="品号" width="120" />
           <el-table-column prop="name" label="原料名称" width="220" show-overflow-tooltip />
           
           <el-table-column prop="manufacturer" label="厂商" width="120" show-overflow-tooltip />
        </template>

        <!-- 非半面罩类 公共列 -->
        <template v-if="!isHalfMaskView">
          <el-table-column prop="price" label="单价" width="120" sortable>
            <template #default="{ row }">{{ formatMoney(row.price, row.currency) }}</template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="80" align="center" />
          <el-table-column prop="currency" label="币别" width="80" align="center" />
          <el-table-column prop="remark" label="备注" width="200" show-overflow-tooltip />
        </template>
        
        <el-table-column prop="updated_at" label="更新时间" width="160">
           <template #default="{ row }">{{ formatDateTime(row.updated_at) }}</template>
        </el-table-column>

        <el-table-column label="操作" width="100" fixed="right" align="center" v-if="canEdit">
          <template #default="{ row }">
            <el-button :icon="EditPen" circle size="small" @click="handleEdit(row)" title="编辑" />
            <el-button :icon="Delete" circle size="small" class="delete-btn" @click="handleDelete(row)" title="删除" />
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <CommonPagination v-model:current-page="currentPage" v-model:page-size="pageSize" :total="total" />
    </el-card>

    <!-- 新增/编辑对话框 (全新升级) -->
    <MaterialDetailDialog
      v-model="dialogVisible"
      ref="materialDialogRef"
      :initial-data="currentMaterial"
      :model-list="modelList"
      @saved="handleSaved"
    />


    <!-- 导入重复确认弹窗 -->
    <el-dialog
      v-model="importConfirmVisible"
      title="发现重复品号"
      width="500px"
      append-to-body
      :close-on-click-modal="false"
    >
      <div class="import-confirm-content">
        <p class="warning-text">检测到 {{ importDuplicates.length }} 条数据在系统中已存在（品号重复）。</p>
        <div class="duplicate-list">
          <p v-for="(item, index) in importDuplicates.slice(0, 5)" :key="index" class="duplicate-item">
            {{ item.item_no }} - {{ item.name }} <span class="exist-tag">(系统已有: {{ item.existing_name }})</span>
          </p>
          <p v-if="importDuplicates.length > 5" class="more-text">...等 {{ importDuplicates.length }} 条</p>
        </div>
        <p class="prompt-text">请选择处理方式：</p>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="importConfirmVisible = false">取消导入</el-button>
          <el-button type="warning" @click="handleImportConfirm('skip')">跳过重复项</el-button>
          <el-button type="primary" @click="handleImportConfirm('update')">覆盖更新</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Search, EditPen, CaretLeft, CaretRight } from '@element-plus/icons-vue'
import request from '../../utils/request'
import { formatNumber, formatDateTime, downloadBlob } from '../../utils/format'
import CostPageHeader from '@/components/cost/CostPageHeader.vue'
import ActionButton from '@/components/common/ActionButton.vue'
import CommonPagination from '@/components/common/CommonPagination.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import MaterialDetailDialog from '@/components/material/MaterialDetailDialog.vue'
import { usePagination } from '@/composables/usePagination'

import { useAuthStore } from '@/store/auth'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// 状态定义
const showToolbar = ref(true)
const currentType = ref(null) // 'half_mask' | 'general' | null (all)
const currentSubcategory = ref('') // 子分类筛选（如活性炭）
const categoryStructure = reactive({ half_mask: [], general: [] })

const searchKeyword = ref('')
const filterCategory = ref('')
const tableData = ref([])
const loading = ref(false)
const selectedMaterials = ref([])
const dialogVisible = ref(false)
// 弹窗状态
const currentMaterial = ref(null) // 编辑时的当前数据
const materialDialogRef = ref(null)
const modelList = ref([]) // 型号列表（用于绑定型号下拉）
const searchTimer = ref(null)

// 导入确认状态
const importConfirmVisible = ref(false)
const importDuplicates = ref([])
const currentImportId = ref(null)

// 分页
const { currentPage, pageSize, total } = usePagination('material')

// 格式化工具
const formatMoney = (val, currency = 'CNY') => {
  const symbol = currency === 'USD' ? '$' : '¥'
  return val || val === 0 ? `${symbol}${formatNumber(val)}` : '-'
}
const formatDate = (val) => val ? dayjs(val).format('YYYY-MM-DD') : '-'

// 计算属性
const isHalfMaskView = computed(() => currentType.value === 'half_mask')
const canEdit = computed(() => authStore.hasPermission('master:material:manage'))
const currentTitle = computed(() => {
  if (currentType.value === 'half_mask') return '原料管理 - 半面罩类'
  if (currentType.value === 'general') return '原料管理 - 口罩类(通用)'
  return '原料管理 - 全部'
})


// 获取分类结构
const fetchCategoryStructure = async () => {
  try {
    const res = await request.get('/materials/structure')
    if (res.success) {
      // 默认排序：将"其他"放到最后
      const sortDefault = (list) => {
        const others = list.filter(i => i === '其他' || i === 'Other')
        const normal = list.filter(i => i !== '其他' && i !== 'Other')
        return [...normal, ...others]
      }

      let halfMask = sortDefault(res.data.half_mask || [])
      let general = sortDefault(res.data.general || [])

      // 应用本地存储的自定义排序
      categoryStructure.half_mask = applyCustomSort(halfMask, 'half_mask')
      categoryStructure.general = applyCustomSort(general, 'general')
    }
  } catch (e) { console.error(e) }
}

// 应用自定义排序
const applyCustomSort = (list, type) => {
  const savedOrder = localStorage.getItem(`material_sort_${type}`)
  if (!savedOrder) return list

  try {
    const order = JSON.parse(savedOrder)
    const orderedList = []
    const remaining = [...list]

    // 按保存的顺序添加存在的项
    order.forEach(item => {
      const idx = remaining.indexOf(item)
      if (idx > -1) {
        orderedList.push(item)
        remaining.splice(idx, 1)
      }
    })

    // 添加剩余的新项
    return [...orderedList, ...remaining]
  } catch (e) {
    return list
  }
}

// 拖拽相关状态
const draggedIndex = ref(null)

const handleDragStart = (event, index) => {
  draggedIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
}

const handleDrop = (event, targetIndex) => {
  if (draggedIndex.value === null || draggedIndex.value === targetIndex) return

  const type = currentType.value
  const list = categoryStructure[type]
  const item = list[draggedIndex.value]

  // 移动数组元素
  list.splice(draggedIndex.value, 1)
  list.splice(targetIndex, 0, item)

  // 保存新顺序
  localStorage.setItem(`material_sort_${type}`, JSON.stringify(list))
  draggedIndex.value = null
}

// 获取型号列表（用于绑定型号下拉）
const fetchModelList = async () => {
  try {
    const res = await request.get('/models')
    if (res.success) modelList.value = res.data || []
  } catch (e) { console.error(e) }
}

// 获取列表数据
const fetchMaterials = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: searchKeyword.value || undefined,
      category: filterCategory.value || undefined,
      material_type: currentType.value || undefined,
      subcategory: currentSubcategory.value || undefined // 只有当 currentSubcategory 不为空时才传
    }
    const res = await request.get('/materials', { params })
    if (res.success) {
      tableData.value = res.data
      total.value = res.total
    }
  } catch (error) { ElMessage.error('获取失败') } 
  finally { loading.value = false }
}

// 搜索
const handleSearch = () => {
  if (searchTimer.value) clearTimeout(searchTimer.value)
  searchTimer.value = setTimeout(() => { currentPage.value = 1; fetchMaterials() }, 300)
}

// 子分类筛选变化
const handleSubcategoryChange = () => {
  currentPage.value = 1
  fetchMaterials()
}

// 分页监听
watch([currentPage, pageSize], fetchMaterials)

// 导出
const handleExport = async () => {
  try {
    const payload = { ids: selectedMaterials.value.map(i => i.id) } 
    if (payload.ids.length === 0) { return ElMessage.warning('请先选择要导出的数据') }
    const res = await request.post('/materials/export/excel', payload, { responseType: 'blob' })
    downloadBlob(res, `原料清单_${dayjs().format('YYYYMMDD')}.xlsx`)
    ElMessage.success('导出成功')
  } catch (e) { ElMessage.error('导出失败') }
}

// 导入
const handleFileChange = async (file) => {
  const formData = new FormData()
  formData.append('file', file.raw)
  try {
    // 改为调用 precheck 接口进行预检查
    const res = await request.post('/materials/import/precheck', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    if (res.success) {
      if (res.data.duplicates && res.data.duplicates.length > 0) {
         importDuplicates.value = res.data.duplicates
         currentImportId.value = res.data.importId
         importConfirmVisible.value = true
      } else {
         // 无重复，直接确认导入 (mode=skip 也没关系，因为没重复)
         await performImportConfirm(res.data.importId, 'skip')
      }
    }
  } catch (e) {
    // 错误处理由拦截器负责，但在上传组件中可能捕获不到
    console.error(e)
  }
}

const handleImportConfirm = async (mode) => {
  if (!currentImportId.value) return
  await performImportConfirm(currentImportId.value, mode)
  importConfirmVisible.value = false
}

const performImportConfirm = async (importId, mode) => {
  try {
    const res = await request.post('/materials/import/confirm', { importId, mode })
    if (res.success) {
      const { created, updated, skipped } = res.data
      let msg = `导入完成`
      if (created) msg += `，新增 ${created} 条`
      if (updated) msg += `，更新 ${updated} 条`
      if (skipped) msg += `，跳过 ${skipped} 条`
      ElMessage.success(msg)
      fetchCategoryStructure()
      fetchMaterials()
    }
  } catch(e) {
    ElMessage.error('导入处理失败')
  }
}

const handleTypeChange = () => { }

// 新增/编辑
const handleAdd = () => {
  currentMaterial.value = null
  dialogVisible.value = true
  nextTick(() => {
    materialDialogRef.value?.setMaterialType(currentType.value || 'general')
  })
}

const handleEdit = (row) => {
  currentMaterial.value = { ...row }
  dialogVisible.value = true
}

const handleSaved = () => {
  fetchMaterials()
  fetchCategoryStructure()
}


const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该原料吗？', '警告', { type: 'warning' })
    await request.delete(`/materials/${row.id}`)
    ElMessage.success('删除成功')
    fetchMaterials()
    fetchCategoryStructure()
  } catch (e) {}
}

const handleBatchDelete = async () => {
  if (!selectedMaterials.value.length) return
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${selectedMaterials.value.length} 条数据吗？`, '警告', { type: 'warning' })
    const ids = selectedMaterials.value.map(i => i.id)
    const res = await request.post('/materials/batch-delete', { ids })
    if (res.success) {
      ElMessage.success(res.message || '删除成功')
      fetchMaterials()
      fetchCategoryStructure()
    }
  } catch (e) {}
}

const handleSelectionChange = (val) => selectedMaterials.value = val
const handleDownloadTemplate = async () => {
  try {
    const typeParam = currentType.value || ''
    const res = await request.get('/materials/template/download', { 
      params: { type: typeParam },
      responseType: 'blob' 
    })
    
    let filename = '原料导入模板.xlsx'
    if (currentType.value === 'half_mask') filename = '原料（半面罩）导入模板.xlsx'
    if (currentType.value === 'general') filename = '原料（口罩类）导入模板.xlsx'
    
    downloadBlob(res, filename)
  } catch (e) { ElMessage.error('下载失败') }
}

// 监听路由参数变化
watch(
  () => route.query.type,
  (newType) => {
    // 只有当参数真正改变时才重置
    if (currentType.value !== newType) {
      currentType.value = newType || null
      currentSubcategory.value = '' // 切换大类时重置子分类筛选
      filterCategory.value = '' // 切换大类时重置品名类别筛选
      fetchMaterials()
    }
  },
  { immediate: true }
)

onMounted(() => {
  fetchCategoryStructure()
  fetchModelList() // 获取型号列表
})

onUnmounted(() => { if (searchTimer.value) clearTimeout(searchTimer.value) })
</script>

<style scoped>
.material-manage {
  /* page content */
}

.toolbar-wrapper { display: flex; align-items: center; gap: 12px; }
.toolbar-toggle { flex-shrink: 0; }
.toolbar-fade-enter-active, .toolbar-fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.toolbar-fade-enter-from, .toolbar-fade-leave-to { opacity: 0; transform: translateX(10px); }

/* 筛选与搜索样式 */
.filter-container {
  margin-bottom: 20px;
}

.search-row {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.category-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.material-form :deep(.el-form-item) {
  margin-bottom: 22px;
}

/* 操作按钮样式同步 */
.delete-btn { color: #F56C6C; }
.delete-btn:hover:not(:disabled) { color: #f78989; border-color: #f78989; }
.el-table .el-button.is-circle { transition: transform 0.2s, box-shadow 0.2s; }
.el-table .el-button.is-circle:hover:not(:disabled) { transform: scale(1.1); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); }
:deep(.el-table th.el-table__cell) { background-color: #f5f7fa; }

/* 导入确认样式 */
.warning-text { color: #e6a23c; font-weight: bold; margin-bottom: 10px; }
.duplicate-list { background: #fdf6ec; padding: 10px; border-radius: 4px; max-height: 200px; overflow-y: auto; margin-bottom: 15px; }
.duplicate-item { font-size: 13px; margin: 4px 0; color: #606266; }
.exist-tag { color: #909399; font-size: 12px; margin-left: 5px; }
.more-text { color: #909399; font-size: 12px; margin-top: 5px; text-align: center; }
.prompt-text { font-weight: 500; margin-bottom: 10px; }
.dialog-footer { display: flex; justify-content: flex-end; gap: 10px; }

/* Status Badge Style (Soft Pill) */
.category-cell { display: flex; align-items: center; }


/* 拖拽样式 */

/* 拖拽样式 */
.draggable-tab {
  cursor: grab; /* 提示可拖动 */
}
.draggable-tab:active {
  cursor: grabbing;
}
/* 禁用 "全部" 标签的拖拽样式影响 */
.static-tab {
  cursor: pointer;
}
</style>
