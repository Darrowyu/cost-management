<template>
  <div class="standard-cost-container">
    <CostPageHeader title="标准成本" :show-back="false">
      <template #actions>
        <ActionButton type="compare" @click="goToStandardCostCompare" :disabled="selectedStandardCosts.length < 2">
          对比模式 ({{ selectedStandardCosts.length }})
        </ActionButton>
      </template>
    </CostPageHeader>

    <!-- 标准成本历史弹窗 -->
    <el-dialog
      v-model="historyDialogVisible"
      title="标准成本历史版本"
      width="900px"
      destroy-on-close
      append-to-body
      class="minimal-dialog-auto history-dialog"
    >
      <el-table :data="historyList" border v-loading="historyLoading">
        <el-table-column prop="version" label="版本" width="80" />
        <el-table-column prop="quantity" label="数量" width="100">
          <template #default="{ row }">
            {{ formatQuantity(row.quantity) }}
          </template>
        </el-table-column>
        <el-table-column label="最终价格" width="150">
          <template #default="{ row }">
            {{ formatNumber(row.sales_type === 'domestic' ? row.domestic_price : row.export_price) }} {{ row.currency }}
          </template>
        </el-table-column>
        <el-table-column prop="setter_name" label="设置人" width="100" />
        <el-table-column label="设置时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="140">
          <template #default="{ row }">
            <StatusBadge type="version_status" :value="row.is_current ? 'current' : 'history'" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button 
              v-if="!row.is_current" 
              size="small" 
              type="primary"
              @click="restoreVersion(row)"
            >
              恢复
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-card>
      <!-- 搜索框 -->
      <div class="filter-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索型号、包装配置、成本分析号"
          clearable
          @input="handleSearch"
          @clear="handleClearSearch"
          style="width: 350px"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="searchForm.model_category" placeholder="产品类别" clearable style="width: 150px; margin-left: 10px" @change="handleFilterChange">
          <el-option v-for="cat in modelCategories" :key="cat" :label="cat" :value="cat" />
        </el-select>
        <el-select v-model="filterSalesType" placeholder="销售类型" clearable style="width: 150px; margin-left: 10px" @change="handleFilterChange">
          <el-option v-for="item in salesTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </div>

      <!-- 标准成本表格 -->
      <el-table :data="standardCosts" border v-loading="loading" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column prop="quotation_no" label="成本分析编号" width="150">
          <template #default="{ row }">
            <span v-if="row.quotation_no">{{ row.quotation_no }}</span>
            <span v-else style="color: #909399;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="model_category" label="产品类别" width="100" />
        <el-table-column prop="model_name" label="产品型号" width="150" />
        <el-table-column prop="packaging_config_name" label="包装方式" width="220">
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
        <el-table-column prop="quantity" label="订单数量" width="100">
          <template #default="{ row }">
            {{ formatQuantity(row.quantity) }}
          </template>
        </el-table-column>
        <el-table-column prop="sales_type" label="销售类型" width="90">
          <template #default="{ row }">
            <StatusBadge type="sales_type" :value="row.sales_type" />
          </template>
        </el-table-column>
        <el-table-column label="最终成本价" width="140">
          <template #default="{ row }">
            {{ formatNumber(row.sales_type === 'domestic' ? row.domestic_price : row.export_price) }} {{ row.currency }}
          </template>
        </el-table-column>
        <el-table-column prop="version" label="版本" width="80">
          <template #default="{ row }">
            V{{ row.version }}
          </template>
        </el-table-column>
        <el-table-column prop="setter_name" label="设置人" width="100" />
        <el-table-column label="设置时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button :icon="View" circle size="small" @click="viewQuotation(row)" :disabled="!row.quotation_id" title="查看" />
            <el-button v-if="!canManage" :icon="CopyDocument" circle size="small" @click="copyStandardCost(row)" title="复制" />
            <el-button v-if="canManage" :icon="Clock" circle size="small" @click="showHistory(row)" title="历史" />
            <el-button v-if="canManage" :icon="Delete" circle size="small" class="delete-btn" @click="deleteStandardCost(row)" title="删除" />
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <CommonPagination v-model:current-page="currentPage" v-model:page-size="pageSize" :total="total" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, View, CopyDocument, Clock, Delete } from '@element-plus/icons-vue'
import request from '@/utils/request'
import { formatNumber, formatDateTime } from '@/utils/format'
import { formatQuantity } from '@/utils/review'
import { useAuthStore } from '@/store/auth'
import logger from '@/utils/logger'
import CommonPagination from '@/components/common/CommonPagination.vue'
import ActionButton from '@/components/common/ActionButton.vue'
import CostPageHeader from '@/components/cost/CostPageHeader.vue'
import { usePagination } from '@/composables/usePagination'
import StatusBadge from '@/components/common/StatusBadge.vue'

defineOptions({ name: 'StandardCost' })

const router = useRouter()

// 用户权限
const authStore = useAuthStore()
const canManage = computed(() => authStore.hasAnyPermission(['cost:manage', 'cost:edit']))

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

// 型号分类列表
const modelCategories = ref([])

// 标准成本数据
const standardCosts = ref([])
const loading = ref(false)
const searchForm = reactive({ model_category: '' })
const searchKeyword = ref('')
const filterSalesType = ref('')

// 销售类型选项
const salesTypeOptions = [
  { label: '内销', value: 'domestic' },
  { label: '外销', value: 'export' }
]

// 分页状态
const { currentPage, pageSize, total } = usePagination('standard_cost')

// 防抖定时器
let searchTimer = null

// 历史弹窗
const historyDialogVisible = ref(false)
const historyList = ref([])
const historyLoading = ref(false)
const currentStandardCost = ref(null)

// 标准成本选择（用于对比）
const selectedStandardCosts = ref([])

// 加载型号分类
const loadModelCategories = async () => {
  try {
    const res = await request.get('/models/categories')
    if (res.success) {
      modelCategories.value = res.data
    }
  } catch (error) {
    logger.error('加载型号分类失败:', error)
  }
}

// 加载标准成本列表（后端分页）
const loadStandardCosts = async () => {
  loading.value = true
  try {
    const res = await request.get('/standard-costs', {
      params: {
        page: currentPage.value,
        pageSize: pageSize.value,
        keyword: searchKeyword.value || undefined,
        model_category: searchForm.model_category || undefined,
        sales_type: filterSalesType.value || undefined
      }
    })
    if (res.success) {
      standardCosts.value = res.data
      total.value = res.total
    }
  } catch (error) {
    logger.error('加载标准成本列表失败:', error)
    ElMessage.error('加载标准成本列表失败')
  } finally {
    loading.value = false
  }
}

// 防抖搜索
const handleSearch = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    loadStandardCosts()
  }, 300)
}

// 清空搜索
const handleClearSearch = () => {
  if (searchTimer) clearTimeout(searchTimer)
  currentPage.value = 1
  loadStandardCosts()
}

// 筛选条件变化
const handleFilterChange = () => {
  currentPage.value = 1
  loadStandardCosts()
}

// 监听分页参数变化
watch([currentPage, pageSize], () => {
  loadStandardCosts()
})

// 查看关联的成本分析
const viewQuotation = (row) => {
  if (row.quotation_id) {
    router.push(`/cost/detail/${row.quotation_id}`)
  }
}

// 复制标准成本
const copyStandardCost = (row) => {
  router.push({
    path: '/cost/add',
    query: { 
      model_category: row.model_category,
      copyFromStandardCost: row.id 
    }
  })
  ElMessage.success('正在复制标准成本...')
}

// 显示历史版本
const showHistory = async (row) => {
  currentStandardCost.value = row
  historyDialogVisible.value = true
  historyLoading.value = true
  
  try {
    const res = await request.get(`/standard-costs/${row.id}/history`)
    if (res.success) {
      historyList.value = res.data
    }
  } catch (error) {
    logger.error('加载历史版本失败:', error)
    ElMessage.error('加载历史版本失败')
  } finally {
    historyLoading.value = false
  }
}

// 恢复历史版本
const restoreVersion = async (row) => {
  const maxVersion = Math.max(...historyList.value.map(h => h.version))
  const newVersion = maxVersion + 1
  
  try {
    await ElMessageBox.confirm(
      `确定要基于 V${row.version} 的内容创建新版本吗？将生成 V${newVersion} 作为当前版本。`,
      '恢复历史版本',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    
    const res = await request.post(`/standard-costs/${currentStandardCost.value.id}/restore/${row.version}`)
    if (res.success) {
      ElMessage.success(`已基于 V${row.version} 创建新版本 V${newVersion}`)
      historyDialogVisible.value = false
      loadStandardCosts()
    }
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('恢复版本失败:', error)
      ElMessage.error('恢复版本失败')
    }
  }
}

// 删除标准成本
const deleteStandardCost = async (row) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这个标准成本吗？这将删除所有历史版本，此操作不可恢复。',
      '警告',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const res = await request.delete(`/standard-costs/${row.packaging_config_id}`)
    if (res.success) {
      ElMessage.success('删除成功')
      loadStandardCosts()
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
  selectedStandardCosts.value = selection
}

// 进入对比模式
const goToStandardCostCompare = () => {
  if (selectedStandardCosts.value.length < 2) {
    ElMessage.warning('请至少选择2个标准成本进行对比')
    return
  }
  
  if (selectedStandardCosts.value.length > 4) {
    ElMessage.warning('最多只能同时对比4个标准成本')
    return
  }
  
  const ids = selectedStandardCosts.value.map(sc => sc.quotation_id).join(',')
  router.push({
    path: '/cost/compare',
    query: { ids, type: 'standard' }
  })
}



onMounted(() => {
  loadModelCategories()
  loadStandardCosts()
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<style scoped>




.filter-bar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
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
</style>
