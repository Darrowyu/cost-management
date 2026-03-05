<template>
  <div
    class="inline-flex items-center transition-all duration-200"
    :class="containerClasses"
  >
    <span 
      v-if="showDot" 
      class="rounded-full" 
      :class="[currentConfig.dot, dotSizeClasses]"
    ></span>
    {{ displayLabel }}
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  type: {
    type: String, // 'status' | 'sales_type' | 'material_category'
    required: true
  },
  value: {
    type: [String, Number, Boolean],
    required: true
  },
  showDot: {
    type: Boolean,
    default: true
  },
  mode: {
    type: String,
    default: 'pill', // 'pill' | 'text'
    validator: (val) => ['pill', 'text'].includes(val)
  }
})

// 预定义色板 (Tailwind)
const colors = {
  slate: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', border: 'border-slate-200' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500', border: 'border-blue-200' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', border: 'border-emerald-200' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-500', border: 'border-rose-200' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-500', border: 'border-indigo-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500', border: 'border-amber-200' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', border: 'border-gray-200' }
}

// 业务映射配置
const configMap = {
  // 成本分析状态
  status: {
    draft: { label: '草稿', color: 'slate' },
    submitted: { label: '已提交', color: 'blue' },
    approved: { label: '已审核', color: 'emerald' },
    rejected: { label: '已退回', color: 'rose' },
    editing: { label: '编辑中', color: 'amber' }
  },
  // 销售类型
  sales_type: {
    domestic: { label: '内销', color: 'indigo' },
    export: { label: '外销', color: 'amber' }
  },
  // 原料品名类别
  material_category: {
    '原料': { label: '原料', color: 'emerald' },
    '包材': { label: '包材', color: 'amber' }
  },
  // 版本状态
  version_status: {
    current: { label: '当前版本', color: 'emerald' },
    history: { label: '历史版本', color: 'slate' }
  },
  // 包装类型
  packaging_type: {
    standard_box: { label: '标准彩盒', color: 'blue' },
    no_box: { label: '无彩盒', color: 'emerald' },
    blister_direct: { label: '泡壳直出', color: 'amber' },
    blister_bag: { label: '袋装泡壳', color: 'slate' }
  },
  // 启用状态
  active_status: {
    1: { label: '已启用', color: 'emerald' },
    0: { label: '已禁用', color: 'slate' }, // Regulation使用灰色表示禁用
    true: { label: '已启用', color: 'emerald' },
    false: { label: '已禁用', color: 'slate' }
  }
}

const currentConfig = computed(() => {
  const typeMap = configMap[props.type] || {}
  const item = typeMap[props.value]
  
  // 1. 如果有明确映射配置，使用配置的颜色
  if (item && item.color && colors[item.color]) {
    return colors[item.color]
  }
  
  // 2. 如果没有映射但有value，尝试根据value哈希分配一个颜色 (可选优化，目前暂用默认)
  // 3. Fallback 默认灰色
  return colors.gray
})

const containerClasses = computed(() => {
  if (props.mode === 'text') {
    return [
      'text-sm', // 稍微大一点的字体
      'text-slate-600' // 固定使用灰色文本，类似 Regulation 样式
    ]
  }
  return [
    'px-2.5 py-0.5 rounded-full border text-xs font-medium shadow-sm',
    currentConfig.value.bg,
    currentConfig.value.border,
    currentConfig.value.text
  ]
})

const dotSizeClasses = computed(() => {
  if (props.mode === 'text') {
    return 'w-2 h-2 mr-2' // Regulation 样式: 8px点, 较大的间距
  }
  return 'w-1.5 h-1.5 mr-1.5' // Pill 样式: 6px点, 较小间距
})

const displayLabel = computed(() => {
  const typeMap = configMap[props.type] || {}
  const item = typeMap[props.value]
  return item ? item.label : props.value
})
</script>
