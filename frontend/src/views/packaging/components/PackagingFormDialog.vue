<template>
  <el-dialog
    v-model="visible"
    title="编辑包装配置"
    width="850px"
    top="5vh"
    class="minimal-dialog"
    append-to-body
    :close-on-click-modal="false"
  >
    <el-form :model="form" ref="formRef" label-position="top" class="px-2">

      <!-- 第一部分：基础信息 -->
      <div class="grid grid-cols-3 gap-6 mb-6">
        <el-form-item label="产品型号" required class="mb-0">
          <el-select
            v-model="form.model_id"
            placeholder="选择型号"
            :disabled="isEdit"
            filterable
            class="w-full"
          >
            <el-option
              v-for="model in models"
              :key="model.id"
              :label="`${model.model_name} (${model.regulation_name})`"
              :value="model.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="配置名称" required class="mb-0">
          <el-input v-model="form.config_name" placeholder="例如：美规标准包装" :disabled="isEdit" />
        </el-form-item>

        <el-form-item label="生产工厂" required class="mb-0">
           <el-select v-model="form.factory" placeholder="选择工厂" class="w-full" :disabled="isEdit">
            <el-option label="东莞迅安" value="dongguan_xunan" />
            <el-option label="湖北知腾" value="hubei_zhiteng" />
          </el-select>
        </el-form-item>
      </div>

      <!-- 第二部分：包装规格与参数 -->
      <div class="mb-6">
        <div class="text-sm font-bold text-slate-700 mb-3 pl-1 border-l-4 border-blue-500">包装规格定义</div>
        <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
           <PackagingSpecConfigurator :model-value="form" @update:model-value="$emit('update:form', $event)" :disabled="isPackagingSpecDisabled" />
        </div>
      </div>

      <!-- 第三部分：包材清单列表 -->
      <div class="mb-3 flex justify-between items-end">
        <div class="text-sm font-bold text-slate-700 pl-1 border-l-4 border-blue-500">包材清单</div>
        <div class="flex gap-2">
          <el-button type="info" plain size="small" @click="$emit('open-copy-dialog')">
            <el-icon class="mr-1"><CopyDocument /></el-icon> 复制包材
          </el-button>
          <el-button type="primary" plain size="small" @click="$emit('add-material')">
            <el-icon class="mr-1"><Plus /></el-icon> 添加包材
          </el-button>
        </div>
      </div>

      <div class="scrollable-table-container border border-slate-200 rounded-lg overflow-hidden mb-6">
        <el-table
          :data="form.materials"
          style="width: 100%"
          :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '500', fontSize: '12px' }"
          show-summary
          :summary-method="getSummaries"
        >
          <el-table-column label="包材名称" min-width="200">
            <template #default="{ row }">
              <el-autocomplete
                v-model="row.material_name"
                :fetch-suggestions="queryMaterials"
                placeholder="搜索包材..."
                size="small"
                class="w-full"
                @select="(item) => handleSelectMaterial(row, item)"
                clearable
              >
                <template #default="{ item }">
                  <div class="flex justify-between items-center py-1">
                    <span class="text-slate-700">{{ item.name }}</span>
                    <span class="text-xs text-slate-400">¥{{ formatNumber(item.price) }}/{{ item.unit }}</span>
                  </div>
                </template>
              </el-autocomplete>
            </template>
          </el-table-column>

          <el-table-column label="基本用量" width="90">
            <template #default="{ row }">
              <el-input-number
                v-model="row.basic_usage"
                :min="0"
                :precision="0"
                :step="1"
                :controls="false"
                size="small"
                class="w-full"
                placeholder="0"
              />
            </template>
          </el-table-column>

          <el-table-column label="单价" width="100">
            <template #default="{ row }">
              <el-input-number
                v-model="row.unit_price"
                :min="0"
                :precision="2"
                :step="0.01"
                :controls="false"
                size="small"
                class="w-full"
                placeholder="0.00"
              />
            </template>
          </el-table-column>

          <el-table-column label="小计" width="90" align="left">
            <template #default="{ row }">
              <span class="font-medium text-blue-600">¥{{ (row.basic_usage && row.basic_usage !== 0 ? ((row.unit_price || 0) / row.basic_usage) : 0).toFixed(2) }}</span>
            </template>
          </el-table-column>

          <el-table-column width="100">
            <template #header>
              <div class="flex items-center gap-1">
                <span>材积</span>
                <el-tooltip content="外箱材积用于计算CBM和运费，请务必填写" placement="top">
                  <el-icon class="text-blue-400 cursor-help"><InfoFilled /></el-icon>
                </el-tooltip>
              </div>
            </template>
            <template #default="{ row }">
              <el-input-number
                v-if="row.material_name && row.material_name.includes('外箱')"
                v-model="row.carton_volume"
                :min="0"
                :precision="2"
                :step="0.01"
                :controls="false"
                size="small"
                class="w-full"
                placeholder="必填"
              />
              <span v-else class="text-slate-400 text-xs">-</span>
            </template>
          </el-table-column>

          <el-table-column width="60" align="center">
            <template #default="{ $index }">
              <el-button
                text
                class="delete-icon-btn"
                @click="$emit('remove-material', $index)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div v-if="isEdit" class="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
         <span class="text-sm text-slate-600 font-medium">配置状态</span>
         <StatusSwitch
          v-model="form.is_active"
          :active-value="1"
          :inactive-value="0"
          active-text="启用中"
          inactive-text="已停用"
        />
      </div>

    </el-form>

    <template #footer>
      <div class="flex justify-end pt-4 border-t border-slate-100">
        <el-button @click="visible = false" size="large" class="w-32">取消</el-button>
        <el-button type="primary" @click="$emit('submit')" :loading="loading" size="large" class="w-32">保存变更</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue';
import { Plus, Delete, InfoFilled, CopyDocument } from '@element-plus/icons-vue';
import StatusSwitch from '@/components/common/StatusSwitch.vue';
import PackagingSpecConfigurator from '@/components/packaging/PackagingSpecConfigurator.vue';
import { formatNumber } from '@/utils/format';
import { useAuthStore } from '@/store/auth';

const props = defineProps({
  visible: { type: Boolean, required: true },
  form: { type: Object, required: true },
  formRef: { type: Object, default: null },
  isEdit: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  models: { type: Array, default: () => [] },
  queryMaterials: { type: Function, required: true },
  handleSelectMaterial: { type: Function, required: true },
  getSummaries: { type: Function, required: true }
});

const emit = defineEmits(['update:visible', 'update:form', 'add-material', 'remove-material', 'submit', 'open-copy-dialog']);

const authStore = useAuthStore();

// 采购员不能编辑包装规格（只能编辑包材）
const isPackagingSpecDisabled = computed(() => authStore.isPurchaser);

const visible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
});
</script>

<style scoped>
.scrollable-table-container {
  max-height: 480px;
  overflow-y: auto;
  border: 1px solid #ebeef5;
  border-bottom: none;
}
.scrollable-table-container::-webkit-scrollbar { width: 6px; }
.scrollable-table-container::-webkit-scrollbar-track { background: #f1f2f5; }
.scrollable-table-container::-webkit-scrollbar-thumb { background: #cdd0d6; border-radius: 3px; }

.delete-icon-btn {
  padding: 4px;
  height: auto;
  color: #909399;
  transition: color 0.2s;
}
.delete-icon-btn:hover {
  color: #f56c6c;
  background-color: transparent !important;
}

/* Allow text wrapping in material name autocomplete */
.scrollable-table-container :deep(.el-autocomplete) {
  width: 100%;
}
.scrollable-table-container :deep(.el-autocomplete .el-input__wrapper) {
  height: auto;
  min-height: 32px;
  padding: 4px 11px;
}
.scrollable-table-container :deep(.el-autocomplete .el-input__inner) {
  white-space: normal;
  word-break: break-word;
  line-height: 1.4;
  height: auto;
}
/* Auto row height for table */
.scrollable-table-container :deep(.el-table__row) {
  height: auto;
}
.scrollable-table-container :deep(.el-table__cell) {
  padding: 8px 4px;
  vertical-align: middle;
}
</style>
