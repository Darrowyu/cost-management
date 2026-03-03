<template>
  <el-dialog
    :model-value="modelValue"
    title="成本分析审核"
    width="900px"
    top="5vh"
    :close-on-click-modal="false"
    :before-close="handleBeforeClose"
    destroy-on-close
    append-to-body
    class="minimal-dialog-auto"
  >
    <div v-loading="loading" class="review-detail-content">
      <template v-if="quotationDetail">
        <!-- 顶部核心标题 -->
        <div class="review-header">
          <span class="review-quotation-no">{{ quotationDetail.quotation_no }}</span>
          <StatusBadge type="status" :value="quotationDetail.status" />
          <StatusBadge type="sales_type" :value="quotationDetail.sales_type" />
        </div>

        <!-- 详细信息网格 -->
        <div class="review-info-grid">
          <div class="review-info-card">
            <div class="review-info-label">客户名称</div>
            <div class="review-info-value">{{ quotationDetail.customer_name }}</div>
          </div>
          <div class="review-info-card">
            <div class="review-info-label">客户地区</div>
            <div class="review-info-value">{{ quotationDetail.customer_region || '-' }}</div>
          </div>
          <div class="review-info-card">
            <div class="review-info-label">法规类别</div>
            <div class="review-info-value">{{ quotationDetail.regulation_name || '-' }}</div>
          </div>
          <div class="review-info-card">
            <div class="review-info-label">产品数量</div>
            <div class="review-info-value">{{ formatQuantity(quotationDetail.quantity) }}</div>
          </div>
          <div class="review-info-card">
            <div class="review-info-label">产品型号</div>
            <div class="review-info-value">{{ quotationDetail.model_name }}</div>
          </div>
          <div class="review-info-card">
            <div class="review-info-label">包装配置</div>
            <div class="review-info-value">
              <div class="text-ellipsis" :title="quotationDetail.packaging_config_name">
                {{ quotationDetail.packaging_config_name || '-' }}
              </div>
              <div class="review-info-sub" :title="formatPackagingSpec(quotationDetail)">
                {{ formatPackagingSpec(quotationDetail) }}
              </div>
            </div>
          </div>
          <div class="review-info-card">
            <div class="review-info-label">创建人</div>
            <div class="review-info-value">{{ quotationDetail.creator_name }}</div>
          </div>
          <div class="review-info-card">
            <div class="review-info-label">提交时间</div>
            <div class="review-info-value">{{ formatDateTime(quotationDetail.submitted_at).split(' ')[0] }}</div>
          </div>
        </div>

        <!-- 审核历史 -->
        <div v-if="reviewHistory.length > 0" class="review-section">
          <div class="review-section-title">
            审核历史
            <el-tag v-if="resubmissionCount > 0" type="warning" size="small" style="margin-left: 8px;">
              第 {{ resubmissionCount + 1 }} 次提交
            </el-tag>
          </div>
          <div class="review-history-timeline">
            <el-timeline>
              <el-timeline-item
                v-for="(record, index) in reviewHistory"
                :key="index"
                :type="record.action === 'rejected' ? 'danger' : record.action === 'approved' ? 'success' : 'primary'"
                :timestamp="formatDateTime(record.created_at)"
              >
                <div class="timeline-content">
                  <span class="timeline-action">{{ getActionText(record.action) }}</span>
                  <span class="timeline-operator">{{ record.operator_name }}</span>
                  <p v-if="record.comment" class="timeline-comment">{{ record.comment }}</p>
                </div>
              </el-timeline-item>
            </el-timeline>
          </div>
        </div>

        <!-- 上次退回原因提示 -->
        <el-alert
          v-if="lastRejectionReason"
          :title="`上次退回原因：${lastRejectionReason}`"
          type="warning"
          :closable="false"
          show-icon
          style="margin-bottom: 16px;"
        />

        <!-- 成本明细 -->
        <div class="review-section">
          <div class="review-section-title">成本明细（含差异对比）</div>
          <el-tabs v-model="activeTab" class="cost-tabs">
            <el-tab-pane label="原料" name="material">
              <div class="review-table-container">
                <el-table :data="materialItems" border size="small">
                  <el-table-column prop="item_name" label="原料名称" min-width="140" />
                  <el-table-column prop="usage_amount" label="用量" width="90">
                    <template #default="{ row }">{{ formatNumber(row.usage_amount) }}</template>
                  </el-table-column>
                  <el-table-column prop="unit_price" label="单价" width="90">
                    <template #default="{ row }">{{ formatNumber(row.unit_price, 2) }}</template>
                  </el-table-column>
                  <el-table-column prop="subtotal" label="小计" width="90">
                    <template #default="{ row }">{{ formatNumber(row.subtotal) }}</template>
                  </el-table-column>
                  <el-table-column label="标准值" width="90">
                    <template #default="{ row }">{{ getStandardValue(row, 'material') }}</template>
                  </el-table-column>
                  <el-table-column label="状态" width="90">
                    <template #default="{ row }">
                      <span :class="['review-diff-status', `review-diff-${getDiffStatus(row, 'material')}`]">
                        {{ getDiffStatusText(row, 'material') }}
                      </span>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
              <div class="review-subtotal-bar">
                <span>原料小计: <strong class="highlight">{{ formatNumber(materialSubtotal) }}</strong> 元</span>
                <span>标准小计: <strong class="highlight">{{ formatNumber(materialStandardSubtotal) }}</strong> 元</span>
                <span>差异: <strong :class="(materialSubtotal - materialStandardSubtotal) >= 0 ? 'text-green' : 'text-red'">{{ (materialSubtotal - materialStandardSubtotal) >= 0 ? '+' : '' }}{{ formatNumber(materialSubtotal - materialStandardSubtotal) }}</strong> 元</span>
              </div>
            </el-tab-pane>
            <el-tab-pane label="工序" name="process">
              <div class="review-table-container">
                <el-table :data="processItems" border size="small">
                  <el-table-column prop="item_name" label="工序名称" min-width="140" />
                  <el-table-column prop="usage_amount" label="用量" width="90">
                    <template #default="{ row }">{{ formatNumber(row.usage_amount) }}</template>
                  </el-table-column>
                  <el-table-column prop="unit_price" label="单价" width="90">
                    <template #default="{ row }">{{ formatNumber(row.unit_price, 2) }}</template>
                  </el-table-column>
                  <el-table-column prop="subtotal" label="小计" width="90">
                    <template #default="{ row }">{{ formatNumber(row.subtotal) }}</template>
                  </el-table-column>
                  <el-table-column label="标准值" width="90">
                    <template #default="{ row }">{{ getStandardValue(row, 'process') }}</template>
                  </el-table-column>
                  <el-table-column label="状态" width="90">
                    <template #default="{ row }">
                      <span :class="['review-diff-status', `review-diff-${getDiffStatus(row, 'process')}`]">
                        {{ getDiffStatusText(row, 'process') }}
                      </span>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
              <div class="review-subtotal-bar">
                <span>工序小计: <strong class="highlight">{{ formatNumber(processSubtotal) }}</strong> 元</span>
                <span>标准小计: <strong class="highlight">{{ formatNumber(processStandardSubtotal) }}</strong> 元</span>
                <span>差异: <strong :class="(processSubtotal - processStandardSubtotal) >= 0 ? 'text-green' : 'text-red'">{{ (processSubtotal - processStandardSubtotal) >= 0 ? '+' : '' }}{{ formatNumber(processSubtotal - processStandardSubtotal) }}</strong> 元</span>
              </div>
            </el-tab-pane>
            <el-tab-pane label="包材" name="packaging">
              <div class="review-table-container">
                <el-table :data="packagingItems" border size="small">
                  <el-table-column prop="item_name" label="包材名称" min-width="140" />
                  <el-table-column prop="usage_amount" label="用量" width="90">
                    <template #default="{ row }">{{ formatNumber(row.usage_amount) }}</template>
                  </el-table-column>
                  <el-table-column prop="unit_price" label="单价" width="90">
                    <template #default="{ row }">{{ formatNumber(row.unit_price, 2) }}</template>
                  </el-table-column>
                  <el-table-column prop="subtotal" label="小计" width="90">
                    <template #default="{ row }">{{ formatNumber(row.subtotal) }}</template>
                  </el-table-column>
                  <el-table-column label="标准值" width="90">
                    <template #default="{ row }">{{ getStandardValue(row, 'packaging') }}</template>
                  </el-table-column>
                  <el-table-column label="状态" width="90">
                    <template #default="{ row }">
                      <span :class="['review-diff-status', `review-diff-${getDiffStatus(row, 'packaging')}`]">
                        {{ getDiffStatusText(row, 'packaging') }}
                      </span>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
              <div class="review-subtotal-bar">
                <span>包材小计: <strong class="highlight">{{ formatNumber(packagingSubtotal) }}</strong> 元</span>
                <span>标准小计: <strong class="highlight">{{ formatNumber(packagingStandardSubtotal) }}</strong> 元</span>
                <span>差异: <strong :class="(packagingSubtotal - packagingStandardSubtotal) >= 0 ? 'text-green' : 'text-red'">{{ (packagingSubtotal - packagingStandardSubtotal) >= 0 ? '+' : '' }}{{ formatNumber(packagingSubtotal - packagingStandardSubtotal) }}</strong> 元</span>
              </div>
            </el-tab-pane>
          </el-tabs>

          <!-- 物流信息 -->
          <div class="review-section logistics-section">
            <div class="review-section-title">物流信息</div>
            <div class="review-logistics-panel">
              <!-- 3x3 明细布局 -->
              <div class="review-logistics-grid">
                <div class="review-logistics-item">
                  <div class="review-logistics-label">发货港口</div>
                  <div class="review-logistics-value">
                    <el-icon class="mr-1"><Location /></el-icon>
                    {{ quotationDetail.port || '深圳' }}
                  </div>
                </div>
                <div class="review-logistics-item">
                  <div class="review-logistics-label">运输方式</div>
                  <div class="review-logistics-value">
                    {{ getShippingMethodName(quotationDetail.shipping_method) }}
                  </div>
                </div>
                <div class="review-logistics-item">
                  <div class="review-logistics-label">运费计入成本</div>
                  <div class="review-logistics-value" :class="quotationDetail.include_freight_in_base ? 'text-blue' : 'text-gray'">
                    {{ quotationDetail.include_freight_in_base ? '是' : '否' }}
                  </div>
                </div>
                <div class="review-logistics-item">
                  <div class="review-logistics-label">单箱数量</div>
                  <div class="review-logistics-value">{{ getPcsPerCarton() }} pcs/箱</div>
                </div>
                <div class="review-logistics-item">
                  <div class="review-logistics-label">总箱数</div>
                  <div class="review-logistics-value">{{ calculateCartons() }} 箱</div>
                </div>
                <div class="review-logistics-item">
                  <div class="review-logistics-label">单箱材积</div>
                  <div class="review-logistics-value">{{ getCartonVolume() }} m³</div>
                </div>
                <div class="review-logistics-item">
                  <div class="review-logistics-label">总体积(CBM)</div>
                  <div class="review-logistics-value">{{ calculateCBM() }} m³</div>
                </div>
                <div class="review-logistics-item">
                  <div class="review-logistics-label">总运费</div>
                  <div class="review-logistics-value price">¥{{ formatNumber(quotationDetail.freight_total || 0, 2) }}</div>
                </div>
                <div class="review-logistics-item">
                  <div class="review-logistics-label">每片分摊</div>
                  <div class="review-logistics-value">{{ formatNumber(quotationDetail.freight_per_unit || 0, 4) }} 元/pc</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 价格汇总 -->
        <div class="review-section">
          <div class="review-section-title">价格汇总</div>
          <div class="review-pricing-panel">
            <!-- 成本与最终价 -->
            <div class="review-pricing-header">
              <div class="review-pricing-info">
                <div class="review-pricing-label">基础成本</div>
                <div class="review-pricing-value">{{ formatNumber(quotationDetail.base_cost) }}</div>
              </div>
              <div class="review-pricing-divider"></div>
              <div class="review-pricing-info">
                <div class="review-pricing-label">管销费用</div>
                <div class="review-pricing-value">{{ formatNumber(quotationDetail.overhead_price) }}</div>
              </div>
              <div class="review-pricing-divider"></div>
              <div class="review-pricing-info final">
                <div class="review-pricing-label">{{ quotationDetail.sales_type === 'export' ? '外销最终价' : '内销最终价' }}</div>
                <div class="review-pricing-final">
                  <span class="currency">{{ quotationDetail.currency }}</span>
                  <span class="amount">{{ formatNumber(quotationDetail.final_price) }}</span>
                </div>
              </div>
            </div>

            <!-- 利润区间表格 -->
            <div class="review-profit-section">
              <div class="review-profit-header">
                <span class="review-profit-title">利润区间</span>
                <span class="review-profit-subtitle">基于最终价格计算的不同利润率对应售价</span>
              </div>
              <div class="review-profit-table-wrapper">
                <table class="review-profit-table">
                  <thead>
                    <tr>
                      <th class="col-rate">利润率</th>
                      <th class="col-price">售价</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in profitPricing" :key="item.rate" :class="{ 'custom-tier': item.isCustom }">
                      <td class="col-rate">
                        <span class="rate-badge" :class="{ custom: item.isCustom }">
                        {{ item.rate }}%
                        </span>
                      </td>
                      <td class="col-price">
                        <span class="price-value">{{ formatNumber(item.price) }}</span>
                        <span class="price-unit">{{ quotationDetail.currency }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 审核意见区 -->
    <div class="review-feedback-section" v-if="quotationDetail">
      <div class="review-feedback-header">
        <el-icon><EditPen /></el-icon>
        审核意见
        <span class="review-feedback-hint">（通过时选填，退回时必填）</span>
      </div>
      <el-input
        v-model="reviewComment"
        type="textarea"
        :rows="2"
        placeholder="请输入审核批注或退回原因..."
        class="review-feedback-input"
        resize="none"
      />
    </div>

    <!-- 底部按钮 -->
    <template #footer>
      <div class="review-dialog-footer">
        <div v-if="isOwnQuotation" class="review-self-warning">
          <el-alert title="不能审核自己创建的成本分析" type="warning" :closable="false" show-icon />
        </div>
        <template v-else>
          <el-button type="danger" @click="handleReject" :loading="submitting">退回成本分析</el-button>
          <el-button type="success" @click="handleApprove" :loading="submitting">审核通过</el-button>
        </template>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useReviewStore } from '@/store/review'
import { useAuthStore } from '@/store/auth'
import request from '@/utils/request'
import logger from '@/utils/logger'
import {
  formatDateTime,
  formatAmount,
  formatQuantity,
  calculateProfitPricing
} from '@/utils/review'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { EditPen, Location, InfoFilled } from '@element-plus/icons-vue'

// 引入共享样式
import '@/styles/review-dialog.css'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  quotationId: { type: [Number, String], default: null }
})

const emit = defineEmits(['update:modelValue', 'approved', 'rejected'])

const reviewStore = useReviewStore()
const authStore = useAuthStore()

const loading = ref(false)
const activeTab = ref('material')
const isOwnQuotation = computed(() => {
  if (!quotationDetail.value || !authStore.user) return false
  return quotationDetail.value.created_by === authStore.user.id
})

const reviewComment = ref('')
const submitting = ref(false)
const quotationDetail = ref(null)
const items = ref([])
const standardItems = ref([])
const customProfitTiers = ref([])
const reviewHistory = ref([])

// 重新提交次数
const resubmissionCount = computed(() => reviewHistory.value.filter(h => h.action === 'resubmitted').length)

// 上次退回原因
const lastRejectionReason = computed(() => {
  for (let i = reviewHistory.value.length - 1; i >= 0; i--) {
    if (reviewHistory.value[i].action === 'rejected') {
      return reviewHistory.value[i].comment || ''
    }
  }
  return ''
})

watch(() => props.modelValue, (val) => {
  if (val && props.quotationId) loadDetail()
  if (!val) {
    quotationDetail.value = null
    items.value = []
    standardItems.value = []
    customProfitTiers.value = []
    reviewHistory.value = []
    activeTab.value = 'material'
    reviewComment.value = ''
  }
}, { immediate: true })

const handleBeforeClose = (done) => {
  emit('update:modelValue', false)
  done()
}

const materialItems = computed(() => items.value.filter(i => i.category === 'material'))
const processItems = computed(() => items.value.filter(i => i.category === 'process'))
const packagingItems = computed(() => items.value.filter(i => i.category === 'packaging'))

const materialSubtotal = computed(() => materialItems.value.reduce((sum, i) => sum + (parseFloat(i.subtotal) || 0), 0))
const processSubtotal = computed(() => processItems.value.reduce((sum, i) => sum + (parseFloat(i.subtotal) || 0), 0))
const packagingSubtotal = computed(() => packagingItems.value.reduce((sum, i) => sum + (parseFloat(i.subtotal) || 0), 0))

const materialStandardSubtotal = computed(() => standardItems.value.filter(i => i.category === 'material').reduce((sum, i) => sum + (parseFloat(i.subtotal) || 0), 0))
const processStandardSubtotal = computed(() => standardItems.value.filter(i => i.category === 'process').reduce((sum, i) => sum + (parseFloat(i.subtotal) || 0), 0))
const packagingStandardSubtotal = computed(() => standardItems.value.filter(i => i.category === 'packaging').reduce((sum, i) => sum + (parseFloat(i.subtotal) || 0), 0))

const profitPricing = computed(() => {
  if (!quotationDetail.value) return []
  const systemTiers = calculateProfitPricing(quotationDetail.value.final_price, quotationDetail.value.sales_type).map(tier => ({ ...tier, isCustom: false }))
  const customTiers = customProfitTiers.value.map(tier => ({
    rate: tier.profitRate * 100,
    price: parseFloat(tier.price),
    currency: quotationDetail.value.sales_type === 'export' ? 'USD' : 'CNY',
    isCustom: true
  }))
  const allTiers = [...systemTiers, ...customTiers]
  allTiers.sort((a, b) => a.rate - b.rate)
  return allTiers
})

const loadDetail = async () => {
  if (!props.quotationId) {
    logger.error('quotationId is required')
    return
  }
  loading.value = true
  try {
    const response = await request.get(`/review/${props.quotationId}/detail`)
    if (response.success) {
      quotationDetail.value = response.data.quotation
      items.value = response.data.items || []
      standardItems.value = response.data.standardItems || []
      reviewHistory.value = response.data.history || []
      if (quotationDetail.value.custom_profit_tiers) {
        try {
          customProfitTiers.value = JSON.parse(quotationDetail.value.custom_profit_tiers)
        } catch (e) {
          logger.error('解析自定义利润档位失败:', e)
          customProfitTiers.value = []
        }
      } else {
        customProfitTiers.value = []
      }
    } else {
      ElMessage.error(response.message || '加载详情失败')
    }
  } catch (error) {
    logger.error('加载审核详情失败:', error)
    ElMessage.error('加载详情失败: ' + (error.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

const formatNumber = (value, decimals = 4) => {
  if (value === null || value === undefined) return '-'
  const num = parseFloat(value)
  if (isNaN(num)) return '-'
  return num.toFixed(decimals)
}

const formatPackagingSpec = (row) => {
  if (!row.packaging_type) return ''
  if (row.packaging_type === 'no_box') return `${row.layer1_qty}pc/袋, ${row.layer2_qty}袋/箱`
  if (row.packaging_type === 'blister_direct') return `${row.layer1_qty}pc/泡壳, ${row.layer2_qty}泡壳/箱`
  if (row.packaging_type === 'blister_bag') return `${row.layer1_qty}pc/袋, ${row.layer2_qty}袋/泡壳, ${row.layer3_qty}泡壳/箱`
  return `${row.layer1_qty}片/袋, ${row.layer2_qty}袋/盒, ${row.layer3_qty}盒/箱`
}

const getStandardValue = (item, category) => {
  const std = standardItems.value.find(s => s.category === category && s.item_name === item.item_name)
  return std ? formatNumber(std.subtotal) : '-'
}

const getDiffStatus = (item, category) => {
  const std = standardItems.value.find(s => s.category === category && s.item_name === item.item_name)
  if (!std) return 'added'
  const diff = Math.abs(parseFloat(item.subtotal || 0) - parseFloat(std.subtotal || 0))
  return diff > 0.0001 ? 'modified' : 'unchanged'
}

const getDiffStatusText = (item, category) => {
  const status = getDiffStatus(item, category)
  const map = { unchanged: '一致', modified: '修改', added: '新增', deleted: '删除' }
  return map[status] || status
}

const getShippingMethodName = (method) => {
  const map = { fcl_40: '40GP 大柜', fcl_20: '20GP 小柜', lcl: 'LCL 散货' }
  return map[method] || method || '-'
}

const getActionText = (action) => {
  const map = {
    created: '创建',
    submitted: '提交审核',
    approved: '审核通过',
    rejected: '审核退回',
    resubmitted: '重新提交'
  }
  return map[action] || action
}

// 物流相关计算函数
const getPcsPerCarton = () => {
  if (!quotationDetail.value) return 0
  // 从包装配置计算每箱数量
  const { pc_per_bag, bags_per_box, boxes_per_carton, layer1_qty, layer2_qty, layer3_qty, packaging_type } = quotationDetail.value
  if (packaging_type === 'no_box') {
    return (layer1_qty || 0) * (layer2_qty || 1)
  }
  if (packaging_type === 'blister_direct') {
    return (layer1_qty || 0) * (layer2_qty || 1)
  }
  // 标准包装：pc/袋 × 袋/盒 × 盒/箱
  const pcsPerBag = pc_per_bag || layer1_qty || 0
  const bagsPerBox = bags_per_box || layer2_qty || 1
  const boxesPerCarton = boxes_per_carton || layer3_qty || 1
  return pcsPerBag * bagsPerBox * boxesPerCarton
}

const calculateCartons = () => {
  if (!quotationDetail.value) return 0
  const qty = parseFloat(quotationDetail.value.quantity) || 0
  const pcsPerCarton = getPcsPerCarton()
  if (!pcsPerCarton) return 0
  return Math.ceil(qty / pcsPerCarton)
}

const getCartonVolume = () => {
  // 从包材明细中获取外箱材积
  const cartonItem = items.value.find(i => i.category === 'packaging' && i.item_name?.includes('外箱'))
  if (cartonItem?.carton_volume) {
    return parseFloat(cartonItem.carton_volume).toFixed(2)
  }
  // 默认根据包装类型估算
  if (!quotationDetail.value) return '-'
  const { boxes_per_carton, layer3_qty } = quotationDetail.value
  const boxesPerCarton = boxes_per_carton || layer3_qty || 1
  // 假设标准外箱尺寸 60×40×40cm = 0.096 CBM
  const baseVolume = 0.096
  return (baseVolume * (boxesPerCarton > 1 ? 1 : 1)).toFixed(2)
}

const getCartonSpec = () => {
  // 尝试从包材中获取外箱规格
  const cartonItem = items.value.find(i => i.category === 'packaging' && i.item_name?.includes('外箱'))
  if (cartonItem?.item_spec) {
    return cartonItem.item_spec
  }
  // 默认规格
  return '60×40×40cm'
}

const calculateCBM = () => {
  const cartons = calculateCartons()
  const cartonVolume = parseFloat(getCartonVolume()) || 0
  if (!cartons || !cartonVolume) return '-'
  return (cartons * cartonVolume).toFixed(2)
}

const calculateFreightPerCarton = () => {
  const cartons = calculateCartons()
  const freightTotal = parseFloat(quotationDetail.value?.freight_total) || 0
  if (!cartons || !freightTotal) return '-'
  return (freightTotal / cartons).toFixed(2)
}

const closeDialog = () => {
  emit('update:modelValue', false)
  reviewComment.value = ''
}

const handleApprove = async () => {
  submitting.value = true
  try {
    await reviewStore.approveQuotation(props.quotationId, reviewComment.value)
    ElMessage.success('审核通过成功')
    emit('approved')
    closeDialog()
  } catch (error) {
    ElMessage.error('审核通过失败')
  } finally {
    submitting.value = false
  }
}

const handleReject = async () => {
  if (!reviewComment.value.trim()) {
    ElMessage.warning('请在下方填写退回原因')
    const input = document.querySelector('.review-feedback-input textarea')
    if (input) input.focus()
    return
  }
  submitting.value = true
  try {
    await reviewStore.rejectQuotation(props.quotationId, reviewComment.value)
    ElMessage.success('退回成功')
    emit('rejected')
    closeDialog()
  } catch (error) {
    ElMessage.error('退回失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
/* 组件特有样式 - 仅保留必要的scoped样式 */
.text-ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 审核历史时间线样式 */
.review-history-timeline {
  padding: 8px 16px;
}

.timeline-content {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.timeline-action {
  font-weight: 500;
  color: #303133;
}

.timeline-operator {
  color: #909399;
  font-size: 13px;
}

.timeline-comment {
  width: 100%;
  margin: 4px 0 0 0;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  color: #606266;
  font-size: 13px;
  line-height: 1.5;
}

.text-green {
  color: var(--review-accent-green);
}

.text-red {
  color: var(--review-accent-red);
}

.text-blue {
  color: var(--review-accent-blue);
}

.text-gray {
  color: var(--review-text-tertiary);
}
</style>
