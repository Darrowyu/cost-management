<template>
  <el-dialog 
    v-model="visible" 
    :title="type === 'packaging' ? '包材配置详情' : '工序配置详情'" 
    width="800px" 
    class="minimal-dialog-auto" 
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
  >
    <div v-if="config" class="dialog-layout">
      
      <!-- 1. 顶部核心信息 (Header) -->
      <div class="header-section">
        <div class="flex items-start justify-between">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <span class="text-xl font-bold text-slate-900 tracking-tight">{{ config.model_name }}</span>
              <el-tag effect="plain" type="info" size="small" class="factory-tag">
                {{ getFactoryName(config.factory) }}
              </el-tag>
            </div>
            <div class="text-sm font-medium text-slate-500">{{ config.config_name }}</div>
          </div>
          <div class="flex items-center gap-2">
            <StatusBadge type="active_status" :value="config.is_active" />
          </div>
        </div>
      </div>

      <!-- 2. 数据仪表盘磁贴 (Metrics Tiles) -->
      <div class="metrics-grid">
        <!-- Tile 1: 包装方式 -->
        <div class="metric-tile">
          <div class="tile-icon bg-blue-50 text-blue-600">
            <el-icon><Box /></el-icon>
          </div>
          <div class="tile-content" style="min-width: 0;"> <!-- Fix flex child truncation -->
            <div class="tile-label">包装方式</div>
            <div class="tile-value font-semibold whitespace-nowrap overflow-hidden text-ellipsis" style="font-size: 14px;" :title="formatPackagingMethodFromConfig(config)">
              {{ formatPackagingMethodFromConfig(config) }}
            </div>
            <!-- Restore Badge for completeness as seen in screenshot -->
            <div class="mt-1" v-if="type === 'packaging'">
               <StatusBadge type="packaging_type" :value="config.packaging_type" size="small" />
            </div>
          </div>
        </div>

        <!-- Tile 2: 容量/系数 -->
        <div class="metric-tile">
          <div class="tile-icon bg-indigo-50 text-indigo-600">
            <el-icon><Operation /></el-icon>
          </div>
          <div class="tile-content">
            <div class="tile-label">{{ type === 'packaging' ? '装箱数量' : '工序系数' }}</div>
            <div class="tile-value">
              <span class="font-bold text-slate-800">
                {{ type === 'packaging' ? calculateTotalFromConfig(config) : configStore.getProcessCoefficient() }}
              </span>
              <span class="text-xs font-normal text-slate-400 ml-1">
                {{ type === 'packaging' ? 'pcs/箱' : 'x' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Tile 3: 总成本 -->
        <div class="metric-tile highlighted">
          <div class="tile-icon bg-emerald-50 text-emerald-600">
            <el-icon><Money /></el-icon>
          </div>
          <div class="tile-content">
            <div class="tile-label">配置总价</div>
            <div class="tile-value text-emerald-600">
              <span class="text-xs mr-0.5">¥</span>{{ formatNumber(totalAmount) }}
            </div>
          </div>
        </div>
      </div>
      
      <!-- 3. 明细表格 (Detail Table) -->
      <div class="table-container">
        <div class="table-header-label">
          <span class="text-sm font-bold text-slate-800">
            {{ type === 'packaging' ? `包材清单 (${items.length})` : `工序清单 (${items.length})` }}
          </span>
        </div>
        
        <el-table 
          :data="items" 
          border 
          height="360"
          show-summary
          :summary-method="getSummaries"
          class="custom-table"
          header-cell-class-name="table-header-cell"
        >
          <el-table-column label="序号" width="60" type="index" align="center" />
          
          <!-- 包材特有列 -->
          <template v-if="type === 'packaging'">
            <el-table-column prop="material_name" label="包材名称" min-width="180">
              <template #default="{ row }">
                <span class="font-medium text-slate-700">{{ row.material_name }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="basic_usage" label="基本用量" width="100" align="right">
              <template #default="{ row }">
                <span class="text-slate-600">{{ formatNumber(row.basic_usage) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="unit_price" label="单价" width="100" align="right">
              <template #default="{ row }">
                <span class="text-slate-500">¥{{ formatNumber(row.unit_price) }}</span>
              </template>
            </el-table-column>
          </template>

          <!-- 工序特有列 -->
          <template v-else>
            <el-table-column prop="process_name" label="工序名称" min-width="180">
              <template #default="{ row }">
                <span class="font-medium text-slate-700">{{ row.process_name }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="unit_price" label="基础单价" width="120" align="right">
              <template #default="{ row }">
                <span class="text-slate-600">¥{{ formatNumber(row.unit_price) }}</span>
              </template>
            </el-table-column>
          </template>

          <!-- 共有小计列 -->
          <el-table-column label="小计" width="120" align="right">
            <template #default="{ row }">
              <span class="font-bold text-slate-800">
                ¥{{ formatNumber(calculateRowTotal(row)) }}
              </span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 4. 历史时间线 (仅工序配置) -->
      <div v-if="type === 'process'" class="history-section">
        <div class="history-header" @click="showHistory = !showHistory">
          <div class="history-title">
            <el-icon class="history-icon"><Clock /></el-icon>
            <span class="font-semibold text-slate-800">配置变更历史</span>
            <el-tag size="small" type="info" class="ml-2">{{ historyList.length }}</el-tag>
          </div>
          <el-icon class="history-toggle-icon" :class="{ 'is-open': showHistory }">
            <ArrowDown v-if="showHistory" />
            <ArrowRight v-else />
          </el-icon>
        </div>

        <div v-show="showHistory" class="history-content">
          <el-timeline v-if="historyList.length > 0" class="custom-timeline">
            <el-timeline-item
              v-for="(item, index) in historyList"
              :key="index"
              :type="getHistoryItemType(item.action)"
              :timestamp="formatDateTime(item.operated_at)"
              placement="top"
            >
              <div class="history-item">
                <div class="history-item-header">
                  <span class="history-operator">{{ item.operator_name || '-' }}</span>
                  <el-tag
                    size="small"
                    :type="getHistoryActionType(item.action)"
                    class="history-action-tag"
                  >
                    {{ getHistoryActionLabel(item.action) }}
                  </el-tag>
                </div>
                <div class="history-item-detail">
                  <span class="detail-label">总价:</span>
                  <span class="detail-value">¥{{ formatNumber(item.new_process_total || 0) }}</span>
                  <span v-if="item.new_data?.processes" class="detail-label ml-3">工序数:</span>
                  <span v-if="item.new_data?.processes" class="detail-value">{{ item.new_data.processes.length }}</span>
                </div>
                <div v-if="item.remark" class="history-remark">
                  {{ item.remark }}
                </div>
              </div>
            </el-timeline-item>
          </el-timeline>

          <el-empty v-else-if="!historyLoading" description="暂无历史记录" :image-size="60" />

          <div v-if="historyLoading" class="history-loading">
            <el-skeleton :rows="3" animated />
          </div>
        </div>
      </div>

    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { formatNumber, formatDateTime } from '@/utils/format'
import { formatPackagingMethodFromConfig, calculateTotalFromConfig } from '@/config/packagingTypes'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { useConfigStore } from '@/store/config'
import { getProcessConfigHistory } from '@/api/process'
import { Box, Money, Operation, Clock, ArrowDown, ArrowRight } from '@element-plus/icons-vue'

const configStore = useConfigStore()

// 历史记录状态
const historyList = ref([])
const historyLoading = ref(false)
const showHistory = ref(false)

// 加载历史记录
const loadHistory = async () => {
  if (props.type !== 'process' || !props.config?.id) return
  historyLoading.value = true
  try {
    const res = await getProcessConfigHistory(props.config.id)
    historyList.value = res.data || []
  } finally {
    historyLoading.value = false
  }
}

// 获取时间线项类型
const getHistoryItemType = (action: string) => {
  const map: Record<string, string> = {
    'create': 'primary',
    'update': 'warning',
    'delete': 'danger',
    'activate': 'success',
    'deactivate': 'info'
  }
  return map[action] || 'info'
}

// 获取操作标签类型
const getHistoryActionType = (action: string) => {
  const map: Record<string, string> = {
    'create': 'success',
    'update': 'warning',
    'delete': 'danger',
    'activate': 'primary',
    'deactivate': 'info'
  }
  return map[action] || 'info'
}

// 获取操作标签文本
const getHistoryActionLabel = (action: string) => {
  const map: Record<string, string> = {
    'create': '创建',
    'update': '更新',
    'delete': '删除',
    'batch_update': '批量更新',
    'activate': '启用',
    'deactivate': '停用'
  }
  return map[action] || action
}

// 管理配置接口
interface ManagementConfig {
  id: number
  model_name: string
  config_name: string
  factory: 'dongguan_xunan' | 'hubei_zhiteng' | string
  regulation_name?: string
  packaging_type?: string
  is_active: boolean | number
  material_total_price?: number
  process_total_price?: number
}

// 包材明细项接口
interface PackagingItem {
  material_name: string
  basic_usage: number
  unit_price: number
}

// 工序明细项接口
interface ProcessItem {
  process_name: string
  unit_price: number
}

// 明细项联合类型
type ManagementItem = PackagingItem | ProcessItem

// ElTable 合计行参数接口
interface SummaryMethodParam {
  columns: Array<{ property: string; label: string }>
  data: any[]
}

interface Props {
  modelValue: boolean
  config: ManagementConfig
  type: 'packaging' | 'process'
  items: ManagementItem[]
}

const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// 监听对话框打开，加载历史记录
watch(() => props.modelValue, (val) => {
  if (val && props.type === 'process') {
    loadHistory()
  }
})

const getFactoryName = (factory: string) => {
  const map: Record<string, string> = {
    'dongguan_xunan': '东莞迅安',
    'hubei_zhiteng': '湖北知腾'
  }
  return map[factory] || factory || '-'
}

// 计算单行数值
const calculateRowTotal = (row: ManagementItem) => {
  if (props.type === 'packaging') {
    return row.basic_usage !== 0 ? (row.unit_price || 0) / row.basic_usage : 0
  } else {
    return (row.unit_price || 0) * configStore.getProcessCoefficient()
  }
}

// 总计数值
const totalAmount = computed(() => {
  return props.items.reduce((sum, item) => sum + calculateRowTotal(item), 0)
})

// 表格合计行
const getSummaries = (param: SummaryMethodParam) => {
  const { columns } = param
  const sums: string[] = []
  columns.forEach((column, index: number) => {
    if (index === 0) {
      sums[index] = '合计'
      return
    }
    // 只在最后一列（小计列）显示总金额
    if (index === columns.length - 1) {
      sums[index] = `¥${formatNumber(totalAmount.value)}`
    } else {
      sums[index] = ''
    }
  })
  return sums
}
</script>

<style scoped>
.dialog-layout {
  padding: 0 4px;
}

/* Header */
.header-section {
  margin-bottom: 24px;
  padding-bottom: 0px;
}

.factory-tag {
  background-color: #F1F5F9;
  border-color: #E2E8F0;
  color: #64748B;
}

/* Metrics Grid - The Dashboard Look */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}

.metric-tile {
  background-color: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: all 0.2s ease;
}

.metric-tile:hover {
  border-color: #CBD5E1;
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.metric-tile.highlighted {
  border-color: #D1FAE5; /* Emerald-100 */
  background-color: #F0FDF4; /* Emerald-50 */
}

.tile-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.tile-content {
  overflow: hidden;
}

.tile-label {
  font-size: 12px;
  color: #64748B;
  margin-bottom: 2px;
  font-weight: 500;
}

.tile-value {
  font-size: 18px;
  font-weight: 700;
  color: #1E293B;
  line-height: 1.2;
}

/* Table container styling */
.table-container {
  background: #FFF;
  border-radius: 8px;
}

.table-header-label {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
}

.custom-table {
  --el-table-border-color: #F1F5F9;
  --el-table-header-bg-color: #F8FAFC;
  --el-table-row-hover-bg-color: #F8FAFC;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

:deep(.table-header-cell) {
  color: #475569 !important;
  font-weight: 600 !important;
  font-size: 13px !important;
  background-color: #F8FAFC !important;
  height: 44px;
}

:deep(.el-table__cell) {
  padding: 10px 0;
}

/* Dialog Cleanup */
:deep(.el-dialog__header) {
  margin-right: 0;
  border-bottom: 1px solid #F1F5F9;
  padding: 16px 24px;
}

:deep(.el-dialog__body) {
  padding: 24px;
}

:deep(.el-dialog__title) {
  font-size: 16px;
  font-weight: 600;
  color: #1E293B;
}

/* History Section */
.history-section {
  margin-top: 24px;
  background: #FAFAFA;
  border-radius: 12px;
  overflow: hidden;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  user-select: none;
}

.history-header:hover {
  background-color: #F1F5F9;
}

.history-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.history-icon {
  font-size: 18px;
  color: #64748B;
}

.history-toggle-icon {
  font-size: 16px;
  color: #94A3B8;
  transition: transform 0.2s;
}

.history-toggle-icon.is-open {
  transform: rotate(0deg);
}

.history-content {
  padding: 0 16px 16px;
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Custom Timeline */
.custom-timeline {
  padding-top: 8px;
}

.custom-timeline :deep(.el-timeline-item__node) {
  width: 10px;
  height: 10px;
}

.custom-timeline :deep(.el-timeline-item__timestamp) {
  color: #94A3B8;
  font-size: 12px;
}

.history-item {
  background: #FFFFFF;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #E2E8F0;
}

.history-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.history-operator {
  font-weight: 600;
  color: #1E293B;
  font-size: 14px;
}

.history-action-tag {
  font-size: 11px;
}

.history-item-detail {
  font-size: 13px;
  color: #475569;
  margin-bottom: 6px;
}

.detail-label {
  color: #94A3B8;
  margin-right: 4px;
}

.detail-value {
  font-weight: 600;
  color: #1E293B;
}

.history-remark {
  font-size: 12px;
  color: #64748B;
  background: #F8FAFC;
  padding: 8px;
  border-radius: 6px;
  margin-top: 8px;
}

.history-loading {
  padding: 16px;
}
</style>

