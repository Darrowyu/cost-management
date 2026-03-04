<template>
  <div class="cost-records-container">
    <CostPageHeader title="成本记录" :show-back="false">
      <template #actions>
        <ActionButton type="compare" @click="goToCompare" :disabled="selectedQuotations.length < 2">
          对比模式 ({{ selectedQuotations.length }})
        </ActionButton>
        <ActionButton v-if="canCreate" type="add" @click="showCategoryModal">新增成本分析</ActionButton>
      </template>
    </CostPageHeader>

    <!-- 产品类别选择弹窗 -->
    <ProductCategoryModal
      v-model="categoryModalVisible"
      @confirm="onCategoryConfirm"
    />

    <el-card>
      <!-- 搜索框 -->
      <div class="filter-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索成本分析编号、客户名称、型号"
          clearable
          @input="handleSearch"
          @clear="handleClearSearch"
          class="search-input mr-4"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>

        <el-select
          v-model="filterStatus"
          placeholder="状态"
          clearable
          class="w-32 mr-4"
          @change="handleSearch"
        >
          <el-option
            v-for="item in statusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>

        <el-select
          v-model="filterSalesType"
          placeholder="销售类型"
          clearable
          class="w-32"
          @change="handleSearch"
        >
          <el-option
            v-for="item in salesTypeOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>

      <!-- 桌面端数据表格 -->
      <el-table :data="tableData" border v-loading="loading" @selection-change="handleSelectionChange" style="width: 100%" class="hidden md:block">
        <el-table-column type="selection" width="55" :selectable="checkSelectable" />
        <el-table-column prop="quotation_no" label="成本分析编号" width="180">
          <template #default="{ row }">
            <div class="quotation-no-cell">
              <span>{{ row.quotation_no }}</span>
              <el-tag v-if="row.is_estimation" size="small" effect="plain" class="cost-type-tag">预估</el-tag>
              <el-tag v-if="row.is_standard_cost" type="warning" size="small" effect="plain" class="cost-type-tag">标准</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <StatusBadge type="status" :value="row.status" />
          </template>
        </el-table-column>
        <el-table-column prop="sales_type" label="销售类型" width="100">
          <template #default="{ row }">
            <StatusBadge type="sales_type" :value="row.sales_type" />
          </template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户名称" width="150" />
        <el-table-column prop="customer_region" label="客户地区" width="100" />
        <el-table-column prop="model_category" label="产品类别" width="100" />
        <el-table-column prop="model_name" label="产品型号" width="140" />
        <el-table-column prop="packaging_config_name" label="包装方式" width="200">
          <template #default="{ row }">
            <div v-if="row.packaging_config_name">
              <div>{{ row.packaging_config_name }}</div>
              <div style="color: #909399; font-size: 12px;">
                {{ formatPackagingSpec(row) }}
              </div>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="订单数量" width="140">
          <template #default="{ row }">
            {{ formatQuantity(row.quantity) }}
          </template>
        </el-table-column>
        <el-table-column prop="final_price" label="最终成本价" width="140">
          <template #default="{ row }">
            {{ formatNumber(row.final_price) }} {{ row.currency }}
          </template>
        </el-table-column>
        <el-table-column prop="creator_name" label="创建人" width="100" />
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" :width="canCreate ? 160 : 100" fixed="right">
          <template #default="{ row }">
            <el-button :icon="View" circle size="small" @click="viewDetail(row.id)" title="查看" />
            <el-button v-if="canEdit(row)" :icon="EditPen" circle size="small" @click="editQuotation(row.id)" title="编辑" />
            <el-button v-if="canCreate" :icon="CopyDocument" circle size="small" @click="copyQuotation(row.id)" title="复制" />
            <el-button v-if="canDelete(row)" :icon="Delete" circle size="small" class="delete-btn" @click="deleteQuotation(row.id)" title="删除" />
          </template>
        </el-table-column>
      </el-table>

      <!-- 移动端卡片列表 -->
      <div class="md:hidden space-y-3" v-loading="loading">
        <div v-if="tableData.length === 0 && !loading" class="text-center py-8 text-slate-400">
          <i class="ri-inbox-line text-4xl mb-2"></i>
          <p>暂无数据</p>
        </div>
        <div v-for="row in tableData" :key="row.id" class="mobile-card" @click="viewDetail(row.id)">
          <div class="mobile-card-header">
            <div class="mobile-card-title flex items-center gap-1">
              <span>{{ row.quotation_no }}</span>
              <el-tag v-if="row.is_estimation" size="small" effect="plain">预估</el-tag>
              <el-tag v-if="row.is_standard_cost" type="warning" size="small" effect="plain">标准</el-tag>
            </div>
            <StatusBadge type="status" :value="row.status" />
          </div>
          <div class="mobile-card-body">
            <div class="flex justify-between">
              <span class="text-slate-500">{{ row.customer_name }}</span>
              <StatusBadge type="sales_type" :value="row.sales_type" />
            </div>
            <div class="flex justify-between mt-1">
              <span class="text-slate-600">{{ row.model_name }}</span>
              <span class="font-semibold text-primary-600">{{ formatNumber(row.final_price) }} {{ row.currency }}</span>
            </div>
          </div>
          <div class="mobile-card-footer">
            <span class="text-xs text-slate-400">{{ formatDateTime(row.created_at) }}</span>
            <div class="flex gap-2" @click.stop>
              <el-button :icon="View" circle size="small" @click="viewDetail(row.id)" />
              <el-button v-if="canEdit(row)" :icon="EditPen" circle size="small" @click="editQuotation(row.id)" />
              <el-button v-if="canCreate" :icon="CopyDocument" circle size="small" @click="copyQuotation(row.id)" />
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <CommonPagination v-model:current-page="currentPage" v-model:page-size="pageSize" :total="total" />
    </el-card>
  </div>
</template>


<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, View, EditPen, CopyDocument, Delete } from '@element-plus/icons-vue'
import request from '@/utils/request'
import { formatNumber, formatDateTime } from '@/utils/format'
import { formatQuantity } from '@/utils/review'
import { useAuthStore } from '@/store/auth'
import ProductCategoryModal from '@/components/ProductCategoryModal.vue'
import CommonPagination from '@/components/common/CommonPagination.vue'
import ActionButton from '@/components/common/ActionButton.vue'
import logger from '@/utils/logger'
import CostPageHeader from '@/components/cost/CostPageHeader.vue'
import { usePagination } from '@/composables/usePagination'
import StatusBadge from '@/components/common/StatusBadge.vue'

const router = useRouter()

// 产品类别选择弹窗
const categoryModalVisible = ref(false)

// 用户权限
const authStore = useAuthStore()
const canCreate = computed(() => authStore.hasPermission('cost:create'))
const canDeleteAll = computed(() => authStore.hasPermission('cost:delete:all'))

// 搜索关键词
const searchKeyword = ref('')
const filterStatus = ref('')
const filterSalesType = ref('')

// 状态选项
const statusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '已提交', value: 'submitted' },
  { label: '已审核', value: 'approved' },
  { label: '已退回', value: 'rejected' }
]

// 销售类型选项
const salesTypeOptions = [
  { label: '内销', value: 'domestic' },
  { label: '外销', value: 'export' }
]

// 表格数据（从后端获取的当前页数据）
const tableData = ref([])

// 分页状态
const { currentPage, pageSize, total } = usePagination('cost_records')

// 防抖定时器
let searchTimer = null

// 格式化包装规格显示（根据二层或三层）
const formatPackagingSpec = (row) => {
  if (!row.packaging_type) return ''
  // 二层包装类型：no_box, blister_direct
  if (row.packaging_type === 'no_box') {
    return `${row.layer1_qty}pc/袋, ${row.layer2_qty}袋/箱`
  } else if (row.packaging_type === 'blister_direct') {
    return `${row.layer1_qty}pc/泡壳, ${row.layer2_qty}泡壳/箱`
  } else if (row.packaging_type === 'blister_bag') {
    return `${row.layer1_qty}pc/袋, ${row.layer2_qty}袋/泡壳, ${row.layer3_qty}泡壳/箱`
  }
  // 默认三层：standard_box
  return `${row.layer1_qty}片/袋, ${row.layer2_qty}袋/盒, ${row.layer3_qty}盒/箱`
}

const loading = ref(false)
const selectedQuotations = ref([])

// 获取报价单列表（后端分页）
const fetchQuotations = async () => {
  loading.value = true
  try {
    const res = await request.get('/cost/quotations', {
      params: {
        page: currentPage.value,
        pageSize: pageSize.value,
        keyword: searchKeyword.value || undefined,
        status: filterStatus.value || undefined,
        sales_type: filterSalesType.value || undefined
      }
    })
    if (res.success) {
      tableData.value = res.data
      total.value = res.total
    }
  } catch (error) {
    logger.error('加载成本分析列表失败:', error)
    ElMessage.error('加载成本分析列表失败')
  } finally {
    loading.value = false
  }
}

// 防抖搜索（300ms）
const handleSearch = () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(() => {
    currentPage.value = 1 // 搜索时重置到第一页
    fetchQuotations()
  }, 300)
}

// 清空搜索框时立即触发查询
const handleClearSearch = () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  currentPage.value = 1
  fetchQuotations()
}

// 监听筛选条件变化
watch([filterStatus, filterSalesType], () => {
  currentPage.value = 1
  fetchQuotations()
})


// 监听分页参数变化
watch([currentPage, pageSize], () => {
  fetchQuotations()
})






// 显示产品类别选择弹窗
const showCategoryModal = () => {
  categoryModalVisible.value = true
}

// 产品类别选择确认
const onCategoryConfirm = (category) => {
  router.push({
    path: '/cost/add',
    query: { model_category: category }
  })
}

// 判断是否可以编辑
const canEdit = (row) => {
  return (row.status === 'draft' || row.status === 'rejected') && authStore.hasPermission('cost:edit')
}

// 判断是否可以删除
const canDelete = (row) => {
  if (canDeleteAll.value) return true
  return row.status === 'draft' && authStore.hasPermission('cost:delete')
}

// 查看详情
const viewDetail = (id) => {
  router.push(`/cost/detail/${id}`)
}

// 编辑成本分析
const editQuotation = (id) => {
  router.push(`/cost/edit/${id}`)
}

// 复制成本分析
const copyQuotation = async (id) => {
  try {
    await ElMessageBox.confirm('确定要复制这个成本分析吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'info'
    })

    const res = await request.get(`/cost/quotations/${id}`)
    
    if (res.success) {
      router.push({
        path: '/cost/add',
        query: { copyFrom: id }
      })
      ElMessage.success('正在复制成本分析...')
    }
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('复制失败:', error)
      ElMessage.error('复制失败')
    }
  }
}

// 删除成本分析
const deleteQuotation = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除这个成本分析吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const res = await request.delete(`/cost/quotations/${id}`)
    
    if (res.success) {
      ElMessage.success('删除成功')
      fetchQuotations()
    }
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

// 处理选择变化
const handleSelectionChange = (selection) => {
  selectedQuotations.value = selection
}

// 检查是否可选择
const checkSelectable = (row) => {
  return row.status === 'approved' || row.status === 'submitted'
}

// 进入对比模式
const goToCompare = () => {
  if (selectedQuotations.value.length < 2) {
    ElMessage.warning('请至少选择2个成本分析进行对比')
    return
  }

  if (selectedQuotations.value.length > 4) {
    ElMessage.warning('最多只能同时对比4个成本分析')
    return
  }
  
  const ids = selectedQuotations.value.map(q => q.id).join(',')
  router.push({
    path: '/cost/compare',
    query: { ids }
  })
}

onMounted(() => {
  fetchQuotations()
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<style scoped>
/* 搜索框响应式 */
.search-input { width: 100%; max-width: 350px; }

.filter-bar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}

/* 分页样式 */
.pagination-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

.pagination-total {
  font-size: 14px;
  color: #606266;
}

.pagination-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.pagination-info {
  font-size: 14px;
  color: #606266;
}

/* 操作按钮悬停效果 */
.el-table .el-button.is-circle {
  transition: transform 0.2s, box-shadow 0.2s;
}

.el-table .el-button.is-circle:hover:not(:disabled) {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* 删除按钮样式 */
.delete-btn {
  color: #F56C6C;
}

.delete-btn:hover:not(:disabled) {
  color: #f78989;
  border-color: #f78989;
}

/* 成本分析编号单元格 */
.quotation-no-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 成本类型标签 */
.cost-type-tag {
  flex-shrink: 0;
  font-size: 11px;
  padding: 0 6px;
  height: 18px;
  line-height: 16px;
}
</style>
