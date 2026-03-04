<template>
  <div class="approved-review-container">
    <CostPageHeader title="已审核记录" :show-back="false" />

    <el-card>
      <!-- 搜索框 -->
      <div class="filter-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索成本分析编号、客户名称、型号"
          clearable
          @input="handleSearch"
          @clear="handleClearSearch"
          class="search-input"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <!-- 桌面端数据表格 -->
      <el-table :data="tableData" border v-loading="loading" style="width: 100%" class="hidden md:block" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column prop="quotation_no" label="成本分析编号" width="160" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <StatusBadge type="status" :value="row.status" />
          </template>
        </el-table-column>
        <el-table-column prop="latest_comment" label="批注" width="120">
          <template #default="{ row }">
            <el-tooltip
              v-if="row.latest_comment"
              :content="cleanComment(row.latest_comment)"
              popper-class="comment-tooltip"
              placement="top"
              :show-after="200"
              effect="light"
            >
              <span class="comment-text">{{ truncateComment(row.latest_comment) }}</span>
            </el-tooltip>
            <span v-else style="color: #C0C4CC;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="sales_type" label="销售类型" width="90">
          <template #default="{ row }">
            <StatusBadge type="sales_type" :value="row.sales_type" />
          </template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户名称" width="150" />
        <el-table-column prop="model_name" label="产品型号" width="150" />
        <el-table-column prop="config_name" label="包装方式" min-width="220">
          <template #default="{ row }">
            <div v-if="row.config_name">
              <div>{{ row.config_name }}</div>
              <div style="color: #909399; font-size: 12px;">
                {{ formatPackagingSpec(row) }}
              </div>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="订单数量" width="120">
          <template #default="{ row }">
            {{ formatQuantity(row.quantity) }}
          </template>
        </el-table-column>
        <el-table-column prop="final_price" label="最终成本价" width="150">
          <template #default="{ row }">
            {{ formatAmount(row.final_price, row.currency) }}
          </template>
        </el-table-column>
        <el-table-column prop="reviewer_name" label="审核人" width="100" />
        <el-table-column prop="reviewed_at" label="审核时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.reviewed_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button :icon="View" circle size="small" @click="handleView(row)" title="查看" />
            <el-button
              v-if="canDeleteAll"
              :icon="Delete"
              circle
              size="small"
              class="delete-btn"
              @click="handleDelete(row)"
              title="删除"
            />
          </template>
        </el-table-column>
      </el-table>

      <!-- 移动端卡片列表 -->
      <div class="md:hidden space-y-3" v-loading="loading">
        <div v-if="tableData.length === 0 && !loading" class="text-center py-8 text-slate-400">
          <i class="ri-inbox-line text-4xl mb-2"></i>
          <p>暂无已审核记录</p>
        </div>
        <div v-for="row in tableData" :key="row.id" class="mobile-card" @click="handleView(row)">
          <div class="mobile-card-header">
            <div class="mobile-card-title flex items-center">
              <span>{{ row.quotation_no }}</span>
              <StatusBadge type="status" :value="row.status" :show-dot="true" />
            </div>
          </div>
          <div class="mobile-card-body">
            <div class="flex justify-between">
              <span class="text-slate-500">{{ row.customer_name }}</span>
              <StatusBadge type="sales_type" :value="row.sales_type" :show-dot="true" />
            </div>
            <div class="flex justify-between mt-1">
              <span class="text-slate-600">{{ row.model_name }}</span>
              <span class="font-semibold text-primary-600">{{ formatAmount(row.final_price, row.currency) }}</span>
            </div>
          </div>
          <div class="mobile-card-footer">
            <span class="text-xs text-slate-400">{{ row.reviewer_name }} · {{ formatDateTime(row.reviewed_at) }}</span>
            <el-button type="primary" size="small" plain>查看</el-button>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <CommonPagination v-model:current-page="currentPage" v-model:page-size="pageSize" :total="total" />
    </el-card>

    <!-- 已审核详情弹窗 -->
    <ApprovedDetailDialog
      v-model="detailDialogVisible"
      :quotation-id="currentQuotationId"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, View, Delete } from '@element-plus/icons-vue'
import { useReviewStore } from '@/store/review'
import { useAuthStore } from '@/store/auth'
import CostPageHeader from '@/components/cost/CostPageHeader.vue'
import { usePagination } from '@/composables/usePagination'
import CommonPagination from '@/components/common/CommonPagination.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { 
  formatDateTime, 
  formatAmount, 
  formatQuantity 
} from '@/utils/review'
import ApprovedDetailDialog from '@/components/review/ApprovedDetailDialog.vue'

defineOptions({ name: 'ApprovedReview' })

const reviewStore = useReviewStore()
const authStore = useAuthStore()

// 搜索关键词
const searchKeyword = ref('')

// 表格数据（从后端获取的当前页数据）
const tableData = ref([])

// 分页状态
const { currentPage, pageSize, total } = usePagination('reviews_approved')

// 防抖定时器
let searchTimer = null

// 弹窗状态
const detailDialogVisible = ref(false)
const currentQuotationId = ref(null)

// 计算属性
const loading = computed(() => reviewStore.loading)
const canDeleteAll = computed(() => authStore.hasPermission('cost:delete:all'))

// 清理批注内容（去除【退回原因】前缀）
const cleanComment = (comment) => {
  if (!comment) return ''
  return comment.replace(/^【退回原因】/, '')
}

// 截取批语显示（10个字符，超过显示省略号）
const truncateComment = (comment) => {
  if (!comment) return '-'
  const cleaned = cleanComment(comment)
  return cleaned.length > 10 ? cleaned.slice(0, 10) + '...' : cleaned
}

// 格式化包装规格显示（根据二层或三层）
const formatPackagingSpec = (row) => {
  if (!row.packaging_type) return ''
  if (row.packaging_type === 'no_box') {
    return `${row.layer1_qty}pc/袋, ${row.layer2_qty}袋/箱`
  } else if (row.packaging_type === 'blister_direct') {
    return `${row.layer1_qty}pc/泡壳, ${row.layer2_qty}泡壳/箱`
  } else if (row.packaging_type === 'blister_bag') {
    return `${row.layer1_qty}pc/袋, ${row.layer2_qty}袋/泡壳, ${row.layer3_qty}泡壳/箱`
  }
  return `${row.layer1_qty}片/袋, ${row.layer2_qty}袋/盒, ${row.layer3_qty}盒/箱`
}

// 获取已审核列表（后端分页）
const fetchApprovedList = async () => {
  try {
    await reviewStore.fetchApprovedList({
      page: currentPage.value,
      page_size: pageSize.value,
      keyword: searchKeyword.value || undefined
    })
    tableData.value = reviewStore.approvedList
    total.value = reviewStore.approvedPagination.total
  } catch (error) {
    ElMessage.error('加载数据失败')
  }
}

// 防抖搜索（300ms）
const handleSearch = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    fetchApprovedList()
  }, 300)
}

// 清空搜索框时立即触发查询
const handleClearSearch = () => {
  if (searchTimer) clearTimeout(searchTimer)
  currentPage.value = 1
  fetchApprovedList()
}

// 监听分页参数变化
watch([currentPage, pageSize], () => {
  fetchApprovedList()
})

// 查看详情
const handleView = (row) => {
  currentQuotationId.value = row.id
  detailDialogVisible.value = true
}

// 删除
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除成本分析 ${row.quotation_no} 吗？此操作不可恢复。`,
      '删除确认',
      { type: 'warning' }
    )
    await reviewStore.deleteQuotation(row.id)
    ElMessage.success('删除成功')
    fetchApprovedList()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 处理表格选择
const handleSelectionChange = (val) => {
  // 预留批量操作功能
}

onMounted(() => {
  fetchApprovedList()
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<style scoped>
/* .approved-review-container { padding: 20px; } */

.filter-bar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}
.search-input { width: 100%; max-width: 350px; }

/* 操作按钮悬停效果 */
.el-table .el-button.is-circle {
  transition: transform 0.2s, box-shadow 0.2s;
}

.el-table .el-button.is-circle:hover:not(:disabled) {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* 操作按钮样式 */
.delete-btn { color: #F56C6C; }
.delete-btn:hover:not(:disabled) { color: #f78989; border-color: #f78989; }

/* 批语文本样式 */
.comment-text {
  cursor: pointer;
}
</style>

<style>
/* 自定义 tooltip 样式以支持自动换行 */
.comment-tooltip {
  max-width: 300px !important;
  white-space: pre-wrap !important;
  word-wrap: break-word !important;
  line-height: 1.5 !important;
}
</style>
