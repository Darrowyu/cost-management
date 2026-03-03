<template>
  <el-dialog
    :model-value="modelValue"
    :title="`📋 成本分析详情   ${quotationDetail?.quotation_no || ''}`"
    width="850px"
    top="5vh"
    :close-on-click-modal="false"
    :before-close="handleBeforeClose"
    destroy-on-close
    append-to-body
  >
    <template #header="{ titleId, titleClass }">
      <div class="dialog-header">
        <span :id="titleId" :class="titleClass">📋 成本分析详情   {{ quotationDetail?.quotation_no || '' }}</span>
        <div class="header-actions">
          <el-button type="primary" size="small" @click="handleEdit">编辑</el-button>
          <el-button type="success" size="small" @click="handleResubmit">重新提交</el-button>
        </div>
      </div>
    </template>

    <div v-loading="loading" class="rejected-detail-content">
      <template v-if="quotationDetail">
        <!-- 退回通知 -->
        <div class="section warning-section">
          <div class="section-title warning-title">⚠️ 退回通知</div>
          <div class="warning-content">
            <p class="warning-text">该成本分析已被退回，请根据以下原因修改后重新提交</p>
            <div class="reason-box">
              <div class="reason-label">退回原因：</div>
              <div class="reason-content">{{ rejectReason || '无' }}</div>
            </div>
          </div>
        </div>

        <!-- 基本信息 -->
        <div class="section">
          <div class="section-title">基本信息</div>
          <div class="info-grid">
            <div class="info-row">
              <div class="info-item">
                <span class="label">审核状态:</span>
                <StatusBadge type="status" :value="quotationDetail.status" />
              </div>
              <div class="info-item">
                <span class="label">销售类型:</span>
                <StatusBadge type="sales_type" :value="quotationDetail.sales_type" />
              </div>
            </div>
            <div class="info-row">
              <div class="info-item">
                <span class="label">客户名称:</span>
                <span class="value">{{ quotationDetail.customer_name }}</span>
              </div>
              <div class="info-item">
                <span class="label">客户地区:</span>
                <span class="value">{{ quotationDetail.customer_region || '-' }}</span>
              </div>
            </div>
            <div class="info-row">
              <div class="info-item">
                <span class="label">法规类别:</span>
                <span class="value">{{ quotationDetail.regulation_name || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">产品型号:</span>
                <span class="value">{{ quotationDetail.model_name }}</span>
              </div>
            </div>
            <div class="info-row">
              <div class="info-item">
                <span class="label">包装配置:</span>
                <span class="value">{{ formatPackaging(quotationDetail.packaging_config) }}</span>
              </div>
              <div class="info-item">
                <span class="label">订单数量:</span>
                <span class="value">{{ formatQuantity(quotationDetail.quantity) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 审核历史 -->
        <div class="section">
          <div class="section-title">审核历史</div>
          <div class="timeline">
            <div v-for="(history, index) in reviewHistory" :key="history.id" class="timeline-item">
              <div class="timeline-dot" :class="{ 'active': index === reviewHistory.length - 1 }"></div>
              <div class="timeline-content">
                <div class="timeline-action">{{ getReviewActionName(history.action) }}</div>
                <div class="timeline-operator">{{ history.operator_name }}</div>
                <div class="timeline-time">{{ formatDateTime(history.created_at) }}</div>
              </div>
              <div v-if="index < reviewHistory.length - 1" class="timeline-line"></div>
            </div>
            <!-- 当前状态 -->
            <div class="timeline-item">
              <div class="timeline-dot active"></div>
              <div class="timeline-content">
                <div class="timeline-action">待修改</div>
                <div class="timeline-operator">当前</div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 重新提交确认弹窗 -->
    <ResubmitConfirmDialog
      v-model="resubmitDialogVisible"
      :quotation="quotationDetail"
      :profit-pricing="profitPricing"
      @confirm="confirmResubmit"
    />
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { useReviewStore } from '@/store/review'
import {
  formatDateTime,
  formatQuantity,
  calculateProfitPricing,
  getReviewActionName
} from '@/utils/review'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ResubmitConfirmDialog from './ResubmitConfirmDialog.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  quotationId: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'resubmitted', 'edit'])

const router = useRouter()
const reviewStore = useReviewStore()

const loading = ref(false)
const resubmitDialogVisible = ref(false)

// 数据
const quotationDetail = ref(null)
const reviewHistory = ref([])
const rejectReason = ref('')

// 监听 modelValue
watch(() => props.modelValue, (val) => {
  if (val && props.quotationId) {
    loadDetail()
  }
  // 关闭时清空数据
  if (!val) {
    quotationDetail.value = null
    reviewHistory.value = []
    rejectReason.value = ''
  }
}, { immediate: true })

// 处理弹窗关闭前的回调
const handleBeforeClose = (done) => {
  emit('update:modelValue', false)
  done()
}

// 利润报价
const profitPricing = computed(() => {
  if (!quotationDetail.value) return []
  return calculateProfitPricing(
    quotationDetail.value.final_price,
    quotationDetail.value.sales_type
  )
})

// 清理批语内容（去除旧数据前缀）
const cleanComment = (comment) => {
  if (!comment) return ''
  return comment.replace(/^【退回原因】/, '')
}

// 加载详情
const loadDetail = async () => {
  loading.value = true
  try {
    const response = await reviewStore.fetchReviewDetail(props.quotationId)
    if (response.success) {
      quotationDetail.value = response.data.quotation
      reviewHistory.value = response.data.history || []
      // 获取退回原因（显示最后一条评论）
      const comments = response.data.comments || []
      const lastComment = comments[comments.length - 1]
      rejectReason.value = cleanComment(lastComment?.content)
    }
  } catch (error) {
    ElMessage.error('加载详情失败')
  } finally {
    loading.value = false
  }
}

// 格式化包装配置
const formatPackaging = (config) => {
  if (!config) return '-'
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config)
    } catch {
      return config
    }
  }
  const parts = []
  if (config.pieces_per_bag) parts.push(`${config.pieces_per_bag}片/袋`)
  if (config.bags_per_box) parts.push(`${config.bags_per_box}袋/盒`)
  if (config.boxes_per_carton) parts.push(`${config.boxes_per_carton}盒/箱`)
  return parts.join(', ') || '-'
}

// 编辑
const handleEdit = () => {
  closeDialog()
  emit('edit', props.quotationId)
  // 跳转到编辑页面
  router.push({ name: 'CostEdit', params: { id: props.quotationId }, query: { mode: 'rejected' } })
}

// 重新提交
const handleResubmit = () => {
  resubmitDialogVisible.value = true
}

const confirmResubmit = async () => {
  try {
    await reviewStore.resubmitQuotation(props.quotationId)
    resubmitDialogVisible.value = false
    ElMessage.success('重新提交成功')
    emit('resubmitted')
    emit('update:modelValue', false)
  } catch (error) {
    ElMessage.error('重新提交失败')
  }
}

// 关闭弹窗
const closeDialog = () => {
  emit('update:modelValue', false)
}
</script>

<style scoped>
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.header-actions {
  display: flex;
  gap: 8px;
  margin-right: 30px;
}

.rejected-detail-content {
  max-height: 65vh;
  overflow-y: auto;
}

.section {
  margin-bottom: 20px;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
}

.warning-section {
  background: #fef0f0;
  border: 1px solid #fde2e2;
}

.section-title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e4e7ed;
}

.warning-title {
  color: #f56c6c;
  border-bottom-color: #fde2e2;
}

.warning-content {
  padding: 8px 0;
}

.warning-text {
  color: #f56c6c;
  font-size: 14px;
  margin-bottom: 12px;
}

.reason-box {
  background: #fff;
  border: 1px solid #fde2e2;
  border-radius: 4px;
  padding: 12px;
}

.reason-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

.reason-content {
  font-size: 14px;
  color: #303133;
  line-height: 1.6;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  gap: 40px;
}

.info-item {
  flex: 1;
  display: flex;
  align-items: center;
}

.info-item .label {
  width: 70px;
  color: #909399;
  font-size: 13px;
}

.info-item .value {
  color: #303133;
  font-size: 13px;
}

.timeline {
  display: flex;
  align-items: flex-start;
  padding: 16px 0;
}

.timeline-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  flex: 1;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #dcdfe6;
  margin-bottom: 8px;
}

.timeline-dot.active {
  background: #409eff;
}

.timeline-content {
  text-align: center;
}

.timeline-action {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.timeline-operator {
  font-size: 12px;
  color: #606266;
  margin-top: 4px;
}

.timeline-time {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.timeline-line {
  position: absolute;
  top: 6px;
  left: 50%;
  width: 100%;
  height: 2px;
  background: #dcdfe6;
  z-index: -1;
}
</style>
