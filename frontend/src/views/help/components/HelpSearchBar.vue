<template>
  <div class="relative">
    <div class="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-2 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
      <i class="ri-search-line text-slate-400 mr-2"></i>
      <input
        v-model="localQuery"
        type="text"
        placeholder="搜索帮助文档..."
        class="flex-1 outline-none text-sm text-slate-700 placeholder:text-slate-400"
        @input="handleInput"
        @focus="showResults = localQuery.length > 0"
      >
      <i
        v-if="localQuery"
        class="ri-close-line text-slate-400 cursor-pointer hover:text-slate-600"
        @click="clearSearch"
      ></i>
    </div>

    <!-- 搜索结果下拉 -->
    <div
      v-if="showResults && searchResults.length > 0"
      class="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-80 overflow-y-auto z-50"
    >
      <div
        v-for="result in searchResults"
        :key="result.path"
        class="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
        @click="goToResult(result)"
      >
        <div class="text-sm font-medium text-slate-800">{{ result.title }}</div>
        <div class="text-xs text-slate-500 mt-1 line-clamp-2">{{ result.snippet }}</div>
      </div>
    </div>

    <!-- 无结果提示 -->
    <div
      v-if="showResults && localQuery && searchResults.length === 0"
      class="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg p-4 text-center text-slate-500 text-sm"
    >
      未找到相关内容
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  modelValue: { type: String, default: '' },
  searchResults: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue', 'search'])

const router = useRouter()
const localQuery = ref(props.modelValue)
const showResults = ref(false)

watch(() => props.modelValue, (val) => {
  localQuery.value = val
})

let searchTimeout = null
const handleInput = () => {
  emit('update:modelValue', localQuery.value)
  showResults.value = true

  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    emit('search', localQuery.value)
  }, 500)  // 防抖时间从300ms改为500ms，减少搜索频率
}

const clearSearch = () => {
  localQuery.value = ''
  emit('update:modelValue', '')
  emit('search', '')
  showResults.value = false
}

const goToResult = (result) => {
  router.push(result.path)
  showResults.value = false
  localQuery.value = ''
  emit('update:modelValue', '')
}

// 点击外部关闭结果
const handleClickOutside = (e) => {
  if (!e.target.closest('.relative')) {
    showResults.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  clearTimeout(searchTimeout)
})
</script>
