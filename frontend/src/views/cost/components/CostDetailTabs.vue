<template>
  <div class="cost-section">
    <div class="cost-section-header">
      <h3 class="text-sm font-semibold text-gray-900 mb-0 flex items-center gap-2">
        <div class="w-1 h-4 bg-green-500 rounded-full"></div>
        成本明细
      </h3>
    </div>
    <div class="cost-section-body p-0">
      <el-tabs v-model="activeTab" class="cost-detail-tabs">
        <!-- 原料明细 Tab -->
        <el-tab-pane name="materials">
          <template #label><span class="tab-label">原料 <el-badge :value="materials.length" :max="99" class="tab-badge" /></span></template>
          <div class="tab-pane-content">
            <div class="tab-pane-actions" v-if="!readOnly">
              <el-button v-if="!editMode.materials && materials.some(p => p.from_standard)" type="warning" size="small" @click="$emit('toggleEditMode', 'materials')">解锁编辑</el-button>
              <el-button v-if="editMode.materials" type="success" size="small" @click="$emit('toggleEditMode', 'materials')">锁定编辑</el-button>
              <el-button type="primary" size="small" @click="$emit('addRow', 'materials')">添加原料</el-button>
            </div>
            <div class="table-scroll-container">
              <el-table :data="materials" border size="small">
              <el-table-column width="60" align="center">
                <template #header><el-tooltip content="勾选后，该原料将在管销价计算后再加入成本" placement="top"><span class="cursor-help text-xs whitespace-nowrap">管销后</span></el-tooltip></template>
                <template #default="{ row }"><el-checkbox v-model="row.after_overhead" @change="$emit('calculate')" :disabled="(!!row.from_standard && !editMode.materials) || readOnly" /></template>
              </el-table-column>
              <el-table-column label="原料名称" min-width="200">
                <template #default="{ row, $index }">
                  <el-select v-if="!readOnly && (!row.from_standard || editMode.materials)" v-model="row.material_id" filterable remote reserve-keyword clearable :remote-method="(q) => $emit('searchMaterial', q, '原料')" :loading="materialSearchLoading" :placeholder="row.item_name || '输入名称或料号搜索'" @change="$emit('selectMaterial', row, $index)" style="width: 100%">
                    <el-option v-if="row.material_id && row.item_name && !materialSearchOptions.some(o => o.id === row.material_id)" :label="row.item_name" :value="row.material_id" />
                    <el-option v-for="material in materialSearchOptions" :key="material.id" :label="`${material.name} (${material.item_no})`" :value="material.id">
                      <div class="flex justify-between w-full"><span>{{ material.name }}</span><span class="text-slate-400 text-xs">¥{{ material.price }}/{{ material.unit }}</span></div>
                    </el-option>
                  </el-select>
                  <span v-else>{{ row.item_name }}</span>
                </template>
              </el-table-column>
              <el-table-column label="基本用量" width="100">
                <template #default="{ row }"><el-input-number v-model="row.usage_amount" :min="0" :max="99999999" :precision="4" :controls="false" @change="$emit('itemChange', row)" size="small" style="width: 100%" :disabled="(!!row.from_standard && !editMode.materials) || readOnly" /></template>
              </el-table-column>
              <el-table-column label="单价(CNY)" width="100"><template #default="{ row }">{{ formatNumber(row.unit_price) || '-' }}</template></el-table-column>
              <el-table-column label="小计" width="100"><template #default="{ row }">{{ formatNumber(row.subtotal) || '-' }}</template></el-table-column>
              <el-table-column label="操作" width="70" fixed="right" v-if="!readOnly">
                <template #default="{ $index, row }">
                  <el-button v-if="!row.from_standard || editMode.materials" size="small" link class="text-gray-400 hover:text-red-500 transition-colors" @click="$emit('removeRow', 'materials', $index)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </template>
              </el-table-column>
              </el-table>
            </div>
            <div class="tab-pane-footer">
              <span>∑ 管销前原料: <strong class="text-blue-600">{{ formatNumber(materialBeforeOverheadTotal) }}</strong></span>
              <span>管销后原料: <strong class="text-amber-600">{{ formatNumber(materialAfterOverheadTotal) }}</strong></span>
            </div>
          </div>
        </el-tab-pane>

        <!-- 工序明细 Tab -->
        <el-tab-pane name="processes">
          <template #label><span class="tab-label">工序 <el-badge :value="processes.length" :max="99" class="tab-badge" /></span></template>
          <div class="tab-pane-content">
            <div class="tab-pane-actions" v-if="!readOnly">
              <el-button v-if="!editMode.processes && processes.some(p => p.from_standard)" type="warning" size="small" @click="$emit('toggleEditMode', 'processes')">解锁编辑</el-button>
              <el-button v-if="editMode.processes" type="success" size="small" @click="$emit('toggleEditMode', 'processes')">锁定编辑</el-button>
              <el-button type="primary" size="small" @click="$emit('addRow', 'processes')">添加工序</el-button>
            </div>
            <div class="table-scroll-container">
              <el-table :data="processes" border size="small">
              <el-table-column label="工序名称" min-width="150">
                <template #default="{ row }">
                   <span v-if="readOnly" class="text-gray-700">{{ row.item_name }}</span>
                   <el-input v-else v-model="row.item_name" @change="$emit('itemChange', row)" size="small" :disabled="!!row.from_standard && !editMode.processes" />
                </template>
              </el-table-column>
              <el-table-column label="基本用量" width="100">
                <template #default="{ row }"><el-input-number v-model="row.usage_amount" :min="0" :max="99999999" :precision="4" :controls="false" @change="$emit('itemChange', row)" size="small" style="width: 100%" :disabled="(!!row.from_standard && !editMode.processes) || readOnly" /></template>
              </el-table-column>
              <el-table-column label="工价(CNY)" width="100">
                <template #default="{ row }"><el-input-number v-model="row.unit_price" :min="0" :max="99999999.99" :precision="4" :controls="false" @change="$emit('itemChange', row)" size="small" style="width: 100%" :disabled="(!!row.from_standard && !editMode.processes) || readOnly" /></template>
              </el-table-column>
              <el-table-column label="小计" width="100"><template #default="{ row }">{{ formatNumber(row.subtotal) }}</template></el-table-column>
              <el-table-column label="操作" width="70" fixed="right" v-if="!readOnly">
                <template #default="{ $index, row }">
                  <el-button v-if="!row.from_standard || editMode.processes" size="small" link class="text-gray-400 hover:text-red-500 transition-colors" @click="$emit('removeRow', 'processes', $index)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </template>
              </el-table-column>
              </el-table>
            </div>
            <div class="tab-pane-footer">
              <span>∑ 工序小计: <strong>{{ formatNumber(processSubtotal) }}</strong></span>
              <span>工价系数({{ processCoefficient }}): <strong class="text-blue-600">{{ formatNumber(processSubtotal * processCoefficient) }}</strong></span>
            </div>
          </div>
        </el-tab-pane>

        <!-- 包材明细 Tab -->
        <el-tab-pane name="packaging">
          <template #label><span class="tab-label">包材 <el-badge :value="packaging.length" :max="99" class="tab-badge" /></span></template>
          <div class="tab-pane-content">
            <div class="tab-pane-actions" v-if="!readOnly">
              <el-button v-if="!editMode.packaging && packaging.some(p => p.from_standard)" type="warning" size="small" @click="$emit('toggleEditMode', 'packaging')">解锁编辑</el-button>
              <el-button v-if="editMode.packaging" type="success" size="small" @click="$emit('toggleEditMode', 'packaging')">锁定编辑</el-button>
              <el-button type="primary" size="small" @click="$emit('addRow', 'packaging')">添加包材</el-button>
            </div>
            <div class="table-scroll-container">
              <el-table :data="packaging" border size="small">
              <el-table-column label="包材名称" min-width="180">
                <template #default="{ row, $index }">
                  <el-select v-if="!readOnly && (!row.from_standard || editMode.packaging)" v-model="row.material_id" filterable remote reserve-keyword clearable :remote-method="(q) => $emit('searchMaterial', q, '包材')" :loading="materialSearchLoading" :placeholder="row.item_name || '输入名称或料号搜索'" @change="$emit('selectPackaging', row, $index)" style="width: 100%">
                    <el-option v-if="row.material_id && row.item_name && !materialSearchOptions.some(o => o.id === row.material_id)" :label="row.item_name" :value="row.material_id" />
                    <el-option v-for="material in materialSearchOptions" :key="material.id" :label="`${material.name} (${material.item_no})`" :value="material.id">
                      <div class="flex justify-between w-full"><span>{{ material.name }}</span><span class="text-slate-400 text-xs">¥{{ material.price }}/{{ material.unit }}</span></div>
                    </el-option>
                  </el-select>
                  <span v-else>{{ row.item_name }}</span>
                </template>
              </el-table-column>
              <el-table-column label="基本用量" width="100">
                <template #default="{ row }"><el-input-number v-model="row.usage_amount" :min="0" :max="99999999" :precision="4" :controls="false" @change="$emit('itemChange', row)" size="small" style="width: 100%" :disabled="(!!row.from_standard && !editMode.packaging) || readOnly" /></template>
              </el-table-column>
              <el-table-column label="外箱材积" width="100">
                <template #default="{ row }">
                  <span v-if="row.carton_volume">{{ row.carton_volume }}</span>
                  <span v-else class="text-gray-400">-</span>
                </template>
              </el-table-column>
              <el-table-column label="单价(CNY)" width="100"><template #default="{ row }">{{ formatNumber(row.unit_price) || '-' }}</template></el-table-column>
              <el-table-column label="小计" width="100"><template #default="{ row }">{{ formatNumber(row.subtotal) || '-' }}</template></el-table-column>
              <el-table-column label="操作" width="70" fixed="right" v-if="!readOnly">
                <template #default="{ $index, row }">
                  <el-button v-if="!row.from_standard || editMode.packaging" size="small" link class="text-gray-400 hover:text-red-500 transition-colors" @click="$emit('removeRow', 'packaging', $index)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </template>
              </el-table-column>
              </el-table>
            </div>
            <div class="tab-pane-footer"><span>∑ 包材小计: <strong class="text-blue-600">{{ formatNumber(packagingTotal) }}</strong></span></div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { formatNumber } from '@/utils/format'

defineOptions({ name: 'CostDetailTabs' })

const props = defineProps({
  materials: { type: Array, default: () => [] },
  processes: { type: Array, default: () => [] },
  packaging: { type: Array, default: () => [] },
  editMode: { type: Object, default: () => ({ materials: false, processes: false, packaging: false }) },
  materialSearchOptions: { type: Array, default: () => [] },
  materialSearchLoading: { type: Boolean, default: false },
  processCoefficient: { type: Number, default: 1.56 },
  defaultTab: { type: String, default: 'materials' },
  readOnly: { type: Boolean, default: false }
})

defineEmits(['toggleEditMode', 'addRow', 'removeRow', 'itemChange', 'calculate', 'searchMaterial', 'selectMaterial', 'selectPackaging'])

const activeTab = ref(props.defaultTab)
watch(() => props.defaultTab, (val) => { activeTab.value = val })

const materialBeforeOverheadTotal = computed(() => props.materials.filter(item => !item.after_overhead).reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0))
const materialAfterOverheadTotal = computed(() => props.materials.filter(item => item.after_overhead).reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0))
const processSubtotal = computed(() => props.processes.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0))
const packagingTotal = computed(() => props.packaging.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0))
</script>

<style scoped>
.cost-section { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
.cost-section-header { padding: 20px 20px 16px 20px; border-bottom: 1px solid #e5e7eb; background: #fff; }
.cost-section-body.p-0 { padding: 0; }

.tab-pane-content { padding: 16px; }
.tab-pane-actions { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 12px; }
.tab-pane-footer { display: flex; justify-content: flex-end; gap: 24px; padding: 12px 0 0; font-size: 13px; color: #606266; }

.tab-label { display: inline-flex; align-items: center; gap: 6px; }
.cursor-help { cursor: help; }
.text-gray-400 { color: #9ca3af; }
.text-gray-700 { color: #374151; }
.text-amber-600 { color: #d97706; }
.text-emerald-600 { color: #059669; }
.text-slate-400 { color: #94a3b8; }
.text-xs { font-size: 12px; }
.text-blue-600 { color: #2563eb; }

/* Modern Tab Styling */
:deep(.el-tabs__header) {
  margin: 0;
  padding: 16px 20px 0 20px;
  background: linear-gradient(to bottom, #fff 0%, #fafafa 100%);
  border-bottom: 1px solid #e5e7eb;
}

:deep(.el-tabs__nav-wrap::after) {
  display: none; /* Remove default bottom border */
}

:deep(.el-tabs__nav) {
  display: flex;
  gap: 8px;
}

:deep(.el-tabs__item) {
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  border: none;
  border-radius: 8px 8px 0 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

:deep(.el-tabs__item:hover) {
  color: #3b82f6;
  background: #eff6ff;
}

:deep(.el-tabs__item.is-active) {
  color: #3b82f6;
  background: #fff;
  font-weight: 600;
}

/* Smooth sliding indicator */
:deep(.el-tabs__active-bar) {
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.el-tabs__content) {
  padding: 0;
  overflow: visible;
}

/* Badge styling - Enhanced visibility */
:deep(.el-badge__content) {
  background-color: #9ca3af; /* Gray for inactive tabs */
  border: none;
  height: 18px;
  line-height: 18px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 9px;
  color: #fff;
  transition: all 0.3s ease;
}

:deep(.el-tabs__item.is-active .el-badge__content) {
  background-color: #3b82f6; /* Blue for active tab */
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

/* Table scroll container - Max 10 rows */
.table-scroll-container {
  max-height: 460px; /* Approx header (40px) + 10 rows (42px each) */
  overflow-y: auto;
  overflow-x: hidden;
}

.table-scroll-container::-webkit-scrollbar {
  width: 6px;
}

.table-scroll-container::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 3px;
}

.table-scroll-container::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.table-scroll-container::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style>
