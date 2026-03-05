<template>
  <div class="model-manage">
    <CostPageHeader title="型号管理" :show-back="false">
      <template #actions>
        <div class="toolbar-wrapper">
          <el-button class="toolbar-toggle" :icon="showToolbar ? CaretRight : CaretLeft" circle @click="showToolbar = !showToolbar" :title="showToolbar ? '收起工具栏' : '展开工具栏'" />
          <transition name="toolbar-fade">
            <el-space v-if="showToolbar && canManageModel">
              <ActionButton type="download" @click="handleDownloadTemplate">下载模板</ActionButton>
              <el-upload action="#" :auto-upload="false" :on-change="handleFileChange" :show-file-list="false" accept=".xlsx,.xls">
                <ActionButton type="import">导入Excel</ActionButton>
              </el-upload>
              <ActionButton type="export" @click="handleExport">导出Excel</ActionButton>
              <ActionButton type="delete" :disabled="selectedModels.length === 0" @click="handleBatchDelete">批量删除</ActionButton>
              <ActionButton type="add" @click="handleAdd">新增型号</ActionButton>
            </el-space>
          </transition>
        </div>
      </template>
    </CostPageHeader>

    <el-card>
      <!-- 筛选区域 -->
      <div class="filter-section">
        <el-input v-model="searchKeyword" placeholder="搜索型号名称、法规类别..." :prefix-icon="Search" clearable @input="handleSearch" style="width: 250px" />
        <el-button-group class="view-toggle">
          <el-button :type="viewMode === 'card' ? 'primary' : 'default'" :icon="Grid" @click="viewMode = 'card'" />
          <el-button :type="viewMode === 'list' ? 'primary' : 'default'" :icon="List" @click="viewMode = 'list'" />
        </el-button-group>
      </div>

      <!-- 卡片视图 -->
      <div v-if="viewMode === 'card'" class="item-cards">
        <div v-if="paginatedModels.length === 0" class="empty-tip">暂无匹配数据</div>
        <div v-for="item in paginatedModels" :key="item.id" class="item-card">
          <div class="card-body">
            <div class="item-header">
              <el-image v-if="item.primary_image" :src="item.primary_image" :preview-src-list="[item.primary_image]" fit="cover" class="card-image" preview-teleported :z-index="3000" @error="handleImageError(item, 'primary_image')">
                <template #error>
                  <div class="card-image-placeholder"><el-icon :size="28" color="#c0c4cc"><Picture /></el-icon></div>
                </template>
              </el-image>
              <div v-else class="card-image-placeholder"><el-icon :size="28" color="#c0c4cc"><Picture /></el-icon></div>
              <div class="item-info">
                <div class="item-name">{{ item.model_name }}</div>
                <div class="item-sub">{{ item.regulation_name }}</div>
              </div>
            </div>
            <div class="item-details">
              <div class="detail-row" v-if="item.model_series">
                <span class="series-tag"><span class="label">系列:</span> {{ item.model_series }}</span>
              </div>
              <div class="detail-row">
                <span class="category-tag"><span class="label">分类:</span> {{ item.model_category || '暂无' }}</span>
              </div>
              <div class="divider"></div>
              <div class="bom-info bom-link" @click="handleConfigBom(item)">
                BOM: 共 {{ item.bom_count || 0 }} 项
              </div>
              <div class="status">
                <span :class="item.is_active ? 'status-active' : 'status-inactive'"></span>
                {{ item.is_active ? '已启用' : '已禁用' }}
              </div>
            </div>
          </div>
          <div class="card-actions" v-if="canManageModel">
            <el-button :icon="Setting" circle @click="handleConfigBom(item)" title="配置BOM" />
            <el-button :icon="EditPen" circle @click="handleEdit(item)" title="编辑" />
            <el-button :icon="Delete" circle class="delete-btn" @click="handleDelete(item)" title="删除" />
          </div>
        </div>
      </div>

      <!-- 列表视图 -->
      <el-table v-if="viewMode === 'list'" :data="paginatedModels" border stripe @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column label="产品图" width="80" align="center">
          <template #default="{ row }">
            <el-image v-if="row.primary_image" :src="row.primary_image" :preview-src-list="[row.primary_image]" fit="cover" style="width: 50px; height: 50px; border-radius: 4px;" preview-teleported :z-index="3000" @error="handleImageError(row, 'primary_image')">
              <template #error>
                <el-icon :size="24" color="#c0c4cc"><Picture /></el-icon>
              </template>
            </el-image>
            <el-icon v-else :size="24" color="#c0c4cc"><Picture /></el-icon>
          </template>
        </el-table-column>
        <el-table-column prop="regulation_name" label="法规类别" width="120" sortable />
        <el-table-column prop="model_name" label="型号名称" sortable />
        <el-table-column prop="model_series" label="产品系列" width="140" sortable />
        <el-table-column prop="model_category" label="型号分类" width="140" sortable />
        <el-table-column label="BOM明细" width="120" align="center">
          <template #default="{ row }">
            <el-link type="primary" underline="never" @click="handleConfigBom(row)">
              <span class="font-bold">共 {{ row.bom_count || 0 }} 项</span>
            </el-link>
          </template>
        </el-table-column>
        <el-table-column prop="is_active" label="状态" width="120" align="center">
          <template #default="{ row }">
            <div class="status">
              <span :class="row.is_active ? 'status-active' : 'status-inactive'"></span>
              {{ row.is_active ? '已启用' : '已禁用' }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" v-if="canManageModel">
          <template #default="{ row }">
            <el-button :icon="Setting" circle size="small" @click="handleConfigBom(row)" title="配置BOM" />
            <el-button :icon="EditPen" circle size="small" @click="handleEdit(row)" title="编辑" />
            <el-button :icon="Delete" circle size="small" class="delete-btn" @click="handleDelete(row)" title="删除" />
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <CommonPagination v-model:current-page="currentPage" v-model:page-size="pageSize" :total="filteredModels.length" />
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog 
      v-model="dialogVisible" 
      :title="dialogTitle" 
      width="500px" 
      class="minimal-dialog-auto" 
      append-to-body
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="法规类别" prop="regulation_id">
          <el-select v-model="form.regulation_id" filterable placeholder="请选择法规类别" style="width: 100%">
            <el-option v-for="reg in regulations" :key="reg.id" :label="reg.name" :value="reg.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="型号名称" prop="model_name">
          <el-input v-model="form.model_name" placeholder="请输入型号名称" />
        </el-form-item>
        <el-form-item label="产品系列" prop="model_series">
          <el-autocomplete
            v-model="form.model_series"
            :fetch-suggestions="querySearchSeries"
            placeholder="请输入产品系列（如：MK81）"
            clearable
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="型号分类" prop="model_category">
          <el-select v-model="form.model_category" placeholder="请选择型号分类" clearable style="width: 100%">
            <el-option label="口罩" value="口罩" />
            <el-option label="半面罩" value="半面罩" />
            <el-option label="全面罩" value="全面罩" />
            <el-option label="PPE产品" value="PPE产品" />
          </el-select>
        </el-form-item>
        <el-form-item label="计算类型" prop="calculation_type" v-if="form.model_category === '半面罩'">
          <el-select v-model="form.calculation_type" placeholder="请选择计算类型" clearable style="width: 100%">
            <el-option label="主体" value="主体" />
            <el-option label="配件" value="配件" />
            <el-option label="滤毒盒" value="滤毒盒" />
            <el-option label="滤棉" value="滤棉" />
            <el-option label="滤饼" value="滤饼" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" v-if="isEdit">
          <StatusSwitch v-model="form.is_active" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="禁用" />
        </el-form-item>
        <el-form-item label="产品图片" v-if="isEdit">
          <el-upload
            :action="`/api/models/${form.id}/images`"
            :headers="{ Authorization: `Bearer ${authStore.token}` }"
            :on-success="handleImageUploadSuccess"
            :on-error="handleImageUploadError"
            :before-upload="beforeImageUpload"
            list-type="picture-card"
            accept=".jpg,.jpeg,.png,.webp"
            multiple
            name="images"
            :file-list="imageList"
            :on-remove="handleImageRemove"
          >
            <el-icon><Plus /></el-icon>
          </el-upload>
          <div class="upload-tip">支持 JPG/PNG/WEBP，单张最大 5MB</div>
          <div class="image-list" v-if="modelImages.length > 0">
            <div v-for="img in modelImages" :key="img.id" class="image-item">
              <el-image :src="img.file_path" fit="cover" style="width: 100px; height: 100px;" :preview-src-list="modelImages.map(i => i.file_path)" preview-teleported :z-index="3000" @error="handleImageError(img, 'file_path')">
                <template #error>
                  <div style="width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; background: #f5f7fa;">
                    <el-icon :size="32" color="#c0c4cc"><Picture /></el-icon>
                  </div>
                </template>
              </el-image>
              <div class="image-actions">
                <el-tag v-if="img.is_primary" type="success" size="small">主图</el-tag>
                <el-button v-else size="small" link @click="setAsPrimary(img.id)">设为主图</el-button>
                <el-button size="small" link type="danger" @click="removeImage(img.id)">删除</el-button>
              </div>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="loading">确定</el-button>
      </template>
    </el-dialog>

    <!-- BOM配置弹窗 -->
    <BomConfigDialog v-model="bomDialogVisible" :model-id="currentBomModelId" :model-name="currentBomModelName" :regulation-name="currentBomRegulationName" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Delete, EditPen, Grid, List, CaretLeft, CaretRight, Setting, Plus, Picture } from '@element-plus/icons-vue'
import request from '../../utils/request'
import { useAuthStore } from '../../store/auth'
import { getRegulationColor } from '@/utils/color'
import logger from '@/utils/logger'
import CostPageHeader from '@/components/cost/CostPageHeader.vue'
import CommonPagination from '@/components/common/CommonPagination.vue'
import BomConfigDialog from '@/components/BomConfigDialog.vue'
import ActionButton from '@/components/common/ActionButton.vue'
import StatusSwitch from '@/components/common/StatusSwitch.vue'
import { usePagination } from '@/composables/usePagination'

defineOptions({ name: 'ModelManage' })

const authStore = useAuthStore()
const canManageModel = computed(() => authStore.hasPermission('master:model:manage'))
const showToolbar = ref(false)
const models = ref([])
const seriesList = ref([]) // 所有产品系列列表
const bomDialogVisible = ref(false)
const currentBomModelId = ref(null)
const currentBomModelName = ref('')
const currentBomRegulationName = ref('')
const filteredModels = ref([])
const selectedModels = ref([])
const regulations = ref([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增型号')
const isEdit = ref(false)
const loading = ref(false)
const searchKeyword = ref('')
const viewMode = ref('card')
const { currentPage, pageSize } = usePagination('model')
const formRef = ref(null)
const modelImages = ref([])
const imageList = ref([])

const paginatedModels = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredModels.value.slice(start, start + pageSize.value)
})

watch(viewMode, (newMode) => { if (newMode === 'card') selectedModels.value = [] })

let form = reactive({ id: null, regulation_id: null, model_name: '', model_category: '', model_series: '', calculation_type: '', is_active: 1 })
const formRules = {
  regulation_id: [{ required: true, message: '请选择法规类别', trigger: 'change' }],
  model_name: [{ required: true, message: '请输入型号名称', trigger: 'blur' }],
  model_series: [{ required: true, message: '请输入产品系列', trigger: 'change' }],
  model_category: [{ required: true, message: '请选择型号分类', trigger: 'change' }]
}

const fetchRegulations = async () => {
  try {
    const response = await request.get('/regulations/active')
    if (response.success) regulations.value = response.data
  } catch (error) { ElMessage.error('获取法规列表失败') }
}

const fetchSeries = async () => {
  try {
    const response = await request.get('/models/series')
    if (response.success) seriesList.value = response.data.map(item => ({ value: item }))
  } catch (error) { logger.error('获取产品系列失败', error) }
}

const querySearchSeries = (queryString, cb) => {
  const results = queryString
    ? seriesList.value.filter(item => item.value.toLowerCase().includes(queryString.toLowerCase()))
    : seriesList.value
  cb(results)
}

const fetchModels = async () => {
  try {
    const response = await request.get('/models')
    if (response.success) { models.value = response.data; doSearch() }
  } catch (error) { ElMessage.error('获取型号列表失败') }
}

let searchTimer = null
const handleSearch = () => { // 防抖搜索
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { doSearch(); currentPage.value = 1 }, 300)
}
const doSearch = () => {
  if (!searchKeyword.value) { filteredModels.value = models.value; return }
  const keyword = searchKeyword.value.toLowerCase()
  filteredModels.value = models.value.filter(item => 
    item.model_name.toLowerCase().includes(keyword) || 
    (item.regulation_name && item.regulation_name.toLowerCase().includes(keyword)) ||
    (item.model_series && item.model_series.toLowerCase().includes(keyword))
  )
}

const handleAdd = () => {
  isEdit.value = false; dialogTitle.value = '新增型号'
  form.id = null; form.regulation_id = null; form.model_name = ''; form.model_category = ''; form.model_series = ''; form.calculation_type = ''; form.is_active = 1
  dialogVisible.value = true
}

const handleEdit = async (row) => {
  isEdit.value = true; dialogTitle.value = '编辑型号'
  form.id = row.id; form.regulation_id = row.regulation_id; form.model_name = row.model_name; form.model_category = row.model_category; form.model_series = row.model_series || ''; form.calculation_type = row.calculation_type || ''; form.is_active = row.is_active ? 1 : 0
  imageList.value = []
  await fetchModelImages(row.id)
  dialogVisible.value = true
}

const fetchModelImages = async (modelId) => {
  try {
    const response = await request.get(`/models/${modelId}/images`)
    if (response.success) modelImages.value = response.data
  } catch (error) { logger.error('获取图片失败', error) }
}

// 处理图片加载错误 - 将图片路径置空显示占位符
const handleImageError = (item, field) => {
  item[field] = null
}

const beforeImageUpload = (file) => {
  const isAllowed = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  const isLt5M = file.size / 1024 / 1024 < 5
  if (!isAllowed) { ElMessage.error('只支持 JPG/PNG/WEBP 格式'); return false }
  if (!isLt5M) { ElMessage.error('图片大小不能超过 5MB'); return false }
  return true
}

const handleImageUploadSuccess = (response) => {
  if (response.success) { ElMessage.success('上传成功'); fetchModelImages(form.id) }
  else ElMessage.error(response.message || '上传失败')
}

const handleImageUploadError = () => { ElMessage.error('上传失败') }

const handleImageRemove = () => { /* el-upload 自带删除，此处留空 */ }

const setAsPrimary = async (imageId) => {
  try {
    const response = await request.put(`/models/${form.id}/images/${imageId}/primary`)
    if (response.success) { ElMessage.success('设置成功'); fetchModelImages(form.id); fetchModels() }
  } catch (error) { /* 错误已在拦截器处理 */ }
}

const removeImage = async (imageId) => {
  try {
    await ElMessageBox.confirm('确定要删除这张图片吗？', '提示', { type: 'warning' })
    const response = await request.delete(`/models/${form.id}/images/${imageId}`)
    if (response.success) { ElMessage.success('删除成功'); fetchModelImages(form.id); fetchModels() }
  } catch (error) { if (error !== 'cancel') { /* 错误已在拦截器处理 */ } }
}

// 配置BOM
const handleConfigBom = (row) => {
  currentBomModelId.value = row.id
  currentBomModelName.value = row.model_name
  currentBomRegulationName.value = row.regulation_name || ''
  bomDialogVisible.value = true
}

const fieldLabels = {
  regulation_id: '法规类别',
  model_name: '型号名称',
  model_category: '型号分类',
  model_series: '产品系列'
}

const handleSubmit = async () => {
  try {
    await formRef.value.validate()
  } catch (error) {
    if (error && typeof error === 'object') {
      const invalidFields = Object.keys(error).map(key => fieldLabels[key] || key).join('、')
      logger.warn('表单校验失败', error)
      ElMessage.error(`保存失败：请完善以下红色必填项：${invalidFields}`)
    }
    return
  }
  
  loading.value = true
  try {
    if (isEdit.value) { await request.put(`/models/${form.id}`, form); ElMessage.success('更新成功') }
    else { await request.post('/models', form); ElMessage.success('创建成功') }
    dialogVisible.value = false; fetchModels(); fetchSeries()
  } catch (error) { /* 错误已在拦截器处理 */ }
  finally { loading.value = false }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要删除型号"${row.model_name}"吗？`, '提示', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
    await request.delete(`/models/${row.id}`)
    ElMessage.success('删除成功'); fetchModels()
  } catch (error) { if (error !== 'cancel') { /* 错误已在拦截器处理 */ } }
}

const handleBatchDelete = async () => {
  if (selectedModels.value.length === 0) { ElMessage.warning('请先选择要删除的型号'); return }
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedModels.value.length} 条型号吗？`, '批量删除确认', { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' })
    const ids = selectedModels.value.map(item => item.id)
    const results = await Promise.allSettled(ids.map(id => request.delete(`/models/${id}`)))
    const successCount = results.filter(r => r.status === 'fulfilled').length
    const failCount = results.filter(r => r.status === 'rejected').length
    if (successCount > 0) { ElMessage.success(`成功删除 ${successCount} 条型号${failCount > 0 ? `，失败 ${failCount} 条` : ''}`); fetchModels() }
    else ElMessage.error('删除失败')
  } catch (error) { if (error !== 'cancel') { /* 错误已在拦截器处理 */ } }
}

const handleSelectionChange = (selection) => { selectedModels.value = selection }

const handleFileChange = async (file) => {
  const formData = new FormData(); formData.append('file', file.raw)
  try {
    const response = await request.post('/models/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    if (response.success) {
      const { created, updated, errors } = response.data
      let message = `导入成功！创建 ${created} 条，更新 ${updated} 条`
      if (errors?.length > 0) { message += `\n${errors.slice(0, 3).join('\n')}`; if (errors.length > 3) message += `\n...还有 ${errors.length - 3} 条错误` }
      ElMessage.success(message); fetchModels()
    }
  } catch (error) { /* 错误已在拦截器处理 */ }
}

const handleExport = async () => {
  if (selectedModels.value.length === 0) { ElMessage.warning('请先选择要导出的数据'); return }
  try {
    const ids = selectedModels.value.map(item => item.id)
    const response = await request.post('/models/export/excel', { ids }, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([response]))
    const link = document.createElement('a'); link.href = url; link.setAttribute('download', `型号清单_${Date.now()}.xlsx`)
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
    ElMessage.success('导出成功')
  } catch (error) { ElMessage.error('导出失败') }
}

const handleDownloadTemplate = async () => {
  try {
    const response = await request.get('/models/template/download', { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([response]))
    const link = document.createElement('a'); link.href = url; link.setAttribute('download', '型号导入模板.xlsx')
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
    ElMessage.success('下载成功')
  } catch (error) { ElMessage.error('下载失败') }
}

onMounted(() => { fetchRegulations(); fetchModels(); fetchSeries() })
</script>

<style scoped>
.filter-section { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.filter-section .view-toggle { margin-left: auto; }

/* 卡片视图样式 */
.item-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
@media (max-width: 1199px) { .item-cards { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 991px) { .item-cards { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 767px) { .item-cards { grid-template-columns: 1fr; } }

.empty-tip { grid-column: 1 / -1; text-align: center; color: #909399; padding: 40px 0; }
.item-card { border: 1px solid #ebeef5; border-radius: 8px; background: #fff; transition: box-shadow 0.3s, border-color 0.3s; display: flex; flex-direction: column; }
.item-card:hover { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
.item-card .card-body { padding: 16px; flex: 1; }

.item-header { display: flex; gap: 12px; margin-bottom: 16px; }
.card-image { width: 56px; height: 56px; border-radius: 6px; flex-shrink: 0; }
.card-image-placeholder { width: 56px; height: 56px; border-radius: 6px; background: #f5f7fa; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

.item-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.item-name { font-size: 16px; font-weight: 600; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-sub { font-size: 13px; color: #909399; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.item-details { display: flex; flex-direction: column; gap: 8px; }
.category { font-size: 14px; }
.category .el-tag { font-size: 13px; padding: 4px 10px; }
.no-category { color: #c0c4cc; font-size: 13px; }
.status { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #606266; }
.status-active { width: 8px; height: 8px; border-radius: 50%; background-color: #67c23a; }
.status-inactive { width: 8px; height: 8px; border-radius: 50%; background-color: #909399; }
.bom-info { font-size: 13px; color: #606266; display: flex; align-items: center; }
.bom-link { cursor: pointer; transition: color 0.2s; }
.bom-link:hover { color: #409EFF; }
.detail-row { display: flex; flex-wrap: wrap; gap: 12px; font-size: 13px; color: #606266; }
.series-tag, .category-tag { display: flex; align-items: center; gap: 4px; }
.series-tag .label, .category-tag .label { color: #909399; }
.divider { height: 1px; background-color: #ebeef5; margin: 4px 0; }

.card-actions { display: flex; justify-content: center; gap: 8px; padding: 12px; border-top: 1px solid #ebeef5; background: #fafafa; border-radius: 0 0 8px 8px; }
.card-actions .el-button { transition: transform 0.2s, box-shadow 0.2s; }
.card-actions .el-button:hover:not(:disabled) { transform: scale(1.1); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); }

.delete-btn { color: #F56C6C; }

/* 图片上传样式 */
.upload-tip { color: #909399; font-size: 12px; margin-top: 8px; }
.image-list { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
.image-item { position: relative; border: 1px solid #ebeef5; border-radius: 4px; overflow: hidden; }
.image-actions { display: flex; gap: 8px; padding: 4px; background: rgba(0,0,0,0.6); position: absolute; bottom: 0; left: 0; right: 0; justify-content: center; }
.image-actions .el-button { color: #fff; }
.image-actions .el-tag { margin: 0; }
.delete-btn:hover:not(:disabled) { color: #f78989; border-color: #f78989; }

/* 工具栏折叠 */
.toolbar-wrapper { display: flex; align-items: center; gap: 12px; }
.toolbar-toggle { flex-shrink: 0; }
.toolbar-fade-enter-active, .toolbar-fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.toolbar-fade-enter-from, .toolbar-fade-leave-to { opacity: 0; transform: translateX(10px); }
</style>


