<template>
  <div class="regulation-manage">
    <CostPageHeader title="法规类别管理" :show-back="false">
      <template #actions>
        <div class="toolbar-wrapper">
          <el-button class="toolbar-toggle" :icon="showToolbar ? CaretRight : CaretLeft" circle @click="showToolbar = !showToolbar" :title="showToolbar ? '收起工具栏' : '展开工具栏'" />
          <transition name="toolbar-fade">
            <ActionButton v-if="showToolbar && canManageRegulation" type="add" @click="handleAdd">新增法规</ActionButton>
          </transition>
        </div>
      </template>
    </CostPageHeader>

    <el-card>
      <!-- 筛选区域 -->
      <div class="filter-section">
        <el-input v-model="searchKeyword" placeholder="搜索法规名称..." :prefix-icon="Search" clearable @input="handleSearch" style="width: 200px" />
        <el-button-group class="view-toggle">
          <el-button :type="viewMode === 'card' ? 'primary' : 'default'" :icon="Grid" @click="viewMode = 'card'" />
          <el-button :type="viewMode === 'list' ? 'primary' : 'default'" :icon="List" @click="viewMode = 'list'" />
        </el-button-group>
      </div>

      <!-- 卡片视图 -->
      <div v-if="viewMode === 'card'" class="item-cards">
        <div v-if="paginatedRegulations.length === 0" class="empty-tip">暂无匹配数据</div>
        <div v-for="item in paginatedRegulations" :key="item.id" class="item-card">
          <div class="card-body">
            <div class="item-header">
              <div class="avatar" :style="{ backgroundColor: getRegulationColor(item.name) }">
                {{ getInitial(item.name) }}
              </div>
              <div class="item-info">
                <div class="item-name">{{ item.name }}</div>
                <div class="description">{{ item.description || '暂无描述' }}</div>
              </div>
            </div>
            <div class="item-details">
              <div class="status">
                <span :class="item.is_active ? 'status-active' : 'status-inactive'"></span>
                {{ item.is_active ? '已启用' : '已禁用' }}
              </div>
            </div>
          </div>
          <div class="card-actions" v-if="canManageRegulation">
            <el-button :icon="EditPen" circle @click="handleEdit(item)" title="编辑" />
            <el-button :icon="Delete" circle class="delete-btn" @click="handleDelete(item)" title="删除" />
          </div>
        </div>
      </div>

      <!-- 列表视图 -->
      <el-table v-if="viewMode === 'list'" :data="paginatedRegulations" border stripe>
        <el-table-column prop="name" label="法规名称" />
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="is_active" label="状态" width="120" align="center">
          <template #default="{ row }">
            <div class="status">
              <span :class="row.is_active ? 'status-active' : 'status-inactive'"></span>
              {{ row.is_active ? '已启用' : '已禁用' }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" v-if="canManageRegulation">
          <template #default="{ row }">
            <el-button :icon="EditPen" circle size="small" @click="handleEdit(row)" title="编辑" />
            <el-button :icon="Delete" circle size="small" class="delete-btn" @click="handleDelete(row)" title="删除" />
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <CommonPagination v-model:current-page="currentPage" v-model:page-size="pageSize" :total="filteredRegulations.length" />
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
      <el-form :model="form" label-width="100px">
        <el-form-item label="法规名称" required>
          <el-input v-model="form.name" placeholder="请输入法规名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入描述" />
        </el-form-item>
        <el-form-item label="状态" v-if="isEdit">
          <StatusSwitch v-model="form.is_active" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="loading">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Grid, List, EditPen, Delete, CaretLeft, CaretRight } from '@element-plus/icons-vue'
import request from '../../utils/request'
import { useAuthStore } from '../../store/auth'
import { formatDateTime } from '@/utils/format'
import CostPageHeader from '@/components/cost/CostPageHeader.vue'
import { usePagination } from '@/composables/usePagination'
import CommonPagination from '@/components/common/CommonPagination.vue'
import ActionButton from '@/components/common/ActionButton.vue'
import StatusSwitch from '@/components/common/StatusSwitch.vue'

const authStore = useAuthStore()
const canManageRegulation = computed(() => authStore.hasPermission('master:regulation:manage'))
const showToolbar = ref(false)
const regulations = ref([])
const filteredRegulations = ref([])
const dialogVisible = ref(false)
const dialogTitle = ref('新增法规')
const isEdit = ref(false)
const loading = ref(false)
const searchKeyword = ref('')
const viewMode = ref('card')
const { currentPage, pageSize } = usePagination('regulation')

const paginatedRegulations = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredRegulations.value.slice(start, start + pageSize.value)
})

let form = reactive({ id: null, name: '', description: '', is_active: 1 })

// 法规颜色映射
const REGULATION_COLORS = { 'NIOSH': '#409EFF', 'GB': '#67C23A', 'CE': '#E6A23C', 'ASNZS': '#F56C6C', 'KN': '#9B59B6' }
const getRegulationColor = (name) => REGULATION_COLORS[name] || '#909399'
const getInitial = (name) => name ? name.charAt(0).toUpperCase() : '?'

const fetchRegulations = async () => {
  try {
    const response = await request.get('/regulations')
    if (response.success) { regulations.value = response.data; handleSearch() }
  } catch (error) { ElMessage.error('获取法规列表失败') }
}

const handleSearch = () => {
  if (!searchKeyword.value) { filteredRegulations.value = regulations.value; return }
  const keyword = searchKeyword.value.toLowerCase()
  filteredRegulations.value = regulations.value.filter(item => item.name.toLowerCase().includes(keyword))
}

const handleAdd = () => {
  isEdit.value = false; dialogTitle.value = '新增法规'
  form.id = null; form.name = ''; form.description = ''; form.is_active = 1
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true; dialogTitle.value = '编辑法规'
  form.id = row.id; form.name = row.name; form.description = row.description; form.is_active = row.is_active ? 1 : 0
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!form.name) { ElMessage.warning('请输入法规名称'); return }
  loading.value = true
  try {
    if (isEdit.value) { await request.put(`/regulations/${form.id}`, form); ElMessage.success('更新成功') }
    else { await request.post('/regulations', form); ElMessage.success('创建成功') }
    dialogVisible.value = false; fetchRegulations()
  } catch (error) { /* 错误已在拦截器处理 */ }
  finally { loading.value = false }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要删除法规"${row.name}"吗？`, '提示', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
    await request.delete(`/regulations/${row.id}`)
    ElMessage.success('删除成功'); fetchRegulations()
  } catch (error) { if (error !== 'cancel') { /* 错误已在拦截器处理 */ } }
}

onMounted(() => { fetchRegulations() })
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
.item-card { border: 1px solid #ebeef5; border-radius: 8px; background: #fff; transition: box-shadow 0.3s, border-color 0.3s; }
.item-card:hover { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
.item-card .card-body { padding: 16px; }

.item-header { display: flex; gap: 12px; margin-bottom: 16px; }
.avatar { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 20px; font-weight: 600; flex-shrink: 0; transition: transform 0.2s; }
.item-card:hover .avatar { transform: scale(1.05); }

.item-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; justify-content: center; }
.item-name { font-size: 16px; font-weight: 600; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.description { font-size: 13px; color: #909399; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.status { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #606266; }
.status-active { width: 8px; height: 8px; border-radius: 50%; background-color: #67c23a; }
.status-inactive { width: 8px; height: 8px; border-radius: 50%; background-color: #909399; }

.card-actions { display: flex; justify-content: center; gap: 8px; padding: 12px; border-top: 1px solid #ebeef5; background: #fafafa; border-radius: 0 0 8px 8px; }
.card-actions .el-button { transition: transform 0.2s, box-shadow 0.2s; }
.card-actions .el-button:hover:not(:disabled) { transform: scale(1.1); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); }

.delete-btn { color: #F56C6C; }
.delete-btn:hover:not(:disabled) { color: #f78989; border-color: #f78989; }

/* 工具栏折叠 */
.toolbar-wrapper { display: flex; align-items: center; gap: 12px; }
.toolbar-toggle { flex-shrink: 0; }
.toolbar-fade-enter-active, .toolbar-fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.toolbar-fade-enter-from, .toolbar-fade-leave-to { opacity: 0; transform: translateX(10px); }
</style>
