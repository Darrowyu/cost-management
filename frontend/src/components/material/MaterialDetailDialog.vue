<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? '编辑原料' : '新增原料'"
    width="700px"
    class="material-detail-dialog"
    destroy-on-close
    append-to-body
    :close-on-click-modal="false"
    @update:model-value="handleClose"
  >
    <div class="dialog-content" v-loading="loading">
      <el-form 
        ref="formRef" 
        :model="form" 
        :rules="rules" 
        label-position="top"
        class="modern-form"
      >
        <!-- 统一表单区域 (基础 + 商务) -->
        <div class="form-section">
          <el-row :gutter="24">
            <!-- Row 1: Type | Subcategory -->
            <el-col :span="12">
              <el-form-item label="原料类型" prop="material_type">
                <el-radio-group v-model="form.material_type" @change="handleTypeChange" class="modern-radio w-full">
                  <el-radio value="general" border class="flex-1 mr-0 text-center">口罩</el-radio>
                  <el-radio value="half_mask" border class="flex-1 mr-0 text-center">半面罩</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="细分类" prop="subcategory">
                <el-input v-model="form.subcategory" placeholder="如：活性炭、配件" />
              </el-form-item>
            </el-col>

            <!-- Row 2: Item No | Name -->
            <el-col :span="12">
              <el-form-item label="品号" prop="item_no">
                <el-input 
                  v-model="form.item_no" 
                  placeholder="请输入唯一品号" 
                  :disabled="isEdit"
                />
              </el-form-item>
            </el-col>
             <el-col :span="12">
              <el-form-item label="原料名称" prop="name">
                <el-input 
                  v-model="form.name" 
                  placeholder="请输入原料名称"
                />
              </el-form-item>
            </el-col>

            <!-- Row 3 -->
            <el-col :span="12" v-if="!isHalfMaskView">
              <el-form-item label="品名类别" prop="category">
                <el-select v-model="form.category" placeholder="请选择类别" class="full-width">
                  <el-option label="原料" value="原料" />
                  <el-option label="包材" value="包材" />
                </el-select>
              </el-form-item>
            </el-col>
             <el-col :span="12">
              <el-form-item label="单位" prop="unit">
                <el-input v-model="form.unit" placeholder="PCS/KG" />
              </el-form-item>
            </el-col>

            <!-- Row 4 -->
            <el-col :span="12">
              <el-form-item :label="isHalfMaskView ? '供应商' : '厂商'" prop="supplier_info">
                <el-input 
                  v-if="isHalfMaskView" 
                  v-model="form.supplier" 
                  placeholder="请输入供应商名称"
                />
                <el-input 
                  v-else 
                  v-model="form.manufacturer" 
                  placeholder="请输入厂商名称"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="单价信息" required>
                <div class="flex gap-2">
                   <el-input-number 
                    v-model="form.price" 
                    :min="0" 
                    :precision="4" 
                    :controls="false" 
                    class="flex-1"
                    placeholder="单价"
                  />
                  <el-select v-model="form.currency" class="w-24">
                    <el-option label="CNY" value="CNY" />
                    <el-option label="USD" value="USD" />
                  </el-select>
                </div>
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- 半面罩生产配置 (保持独立卡片，仅去图标) -->
        <div class="form-section highlight-section" v-if="isHalfMaskView">
          <div class="section-title">
             生产配置 (半面罩)
          </div>
          <el-row :gutter="24">
            <el-col :span="24">
              <el-form-item label="绑定型号">
                <el-select 
                  v-model="form.product_desc" 
                  filterable 
                  clearable 
                  placeholder="选择要绑定的产品型号" 
                  class="full-width"
                >
                  <el-option 
                    v-for="model in modelList" 
                    :key="model.id" 
                    :label="model.model_name" 
                    :value="model.model_name" 
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="包装方式">
                <el-input v-model="form.packaging_mode" placeholder="请输入包装方式" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="默认用量">
                <el-input-number v-model="form.usage_amount" :controls="false" class="full-width" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="生产周期 (天)">
                <el-input v-model="form.production_cycle" placeholder="如：15" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="MOQ">
                <el-input-number v-model="form.moq" :controls="false" class="full-width" />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- 备注 (Full Width) -->
        <div class="form-section mt-4" v-if="!isHalfMaskView">
          <el-form-item label="备注">
            <el-input 
              v-model="form.remark" 
              type="textarea" 
              :rows="2" 
              placeholder="填写额外备注信息..." 
            />
          </el-form-item>
        </div>
      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose" class="cancel-btn">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="apiLoading" class="submit-btn">
          {{ isEdit ? '保存修改' : '立即创建' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import StatusBadge from '@/components/common/StatusBadge.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  initialData: { type: Object, default: null }, // 如果是 null 则是新增
  modelList: { type: Array, default: () => [] } // 传入型号列表
})

const emit = defineEmits(['update:modelValue', 'saved'])

const loading = ref(false)
const apiLoading = ref(false)
const formRef = ref(null)

// 表单初始状态
const defaultForm = {
  id: null,
  material_type: 'general',
  subcategory: '',
  item_no: '',
  name: '',
  unit: '',
  price: 0,
  currency: 'CNY',
  supplier: '',
  packaging_mode: '',
  product_desc: '',
  usage_amount: null,
  moq: null,
  production_cycle: '',
  manufacturer: '',
  category: '',
  remark: ''
}

let form = reactive({ ...defaultForm })

const isEdit = computed(() => !!props.initialData)
const isHalfMaskView = computed(() => form.material_type === 'half_mask')

// 校验规则
const rules = {
  material_type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  item_no: [{ required: true, message: '请输入品号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  unit: [{ required: true, message: '请输入单位', trigger: 'blur' }],
  price: [{ required: true, message: '请输入单价', trigger: 'blur' }],
  category: [{ 
    validator: (rule, value, callback) => {
      if (form.material_type !== 'half_mask' && !value) {
        callback(new Error('请选择品名类别'))
      } else {
        callback()
      }
    }, 
    trigger: 'change' 
  }],
  subcategory: [{ required: true, message: '请输入细分类', trigger: 'blur' }]
}

// 监听打开 loading data
watch(() => props.modelValue, (val) => {
  if (val) {
    if (props.initialData) {
      // 编辑模式
      Object.assign(form, props.initialData)
      form.price = parseFloat(props.initialData.price) || 0
    } else {
      // 新增模式：重置
      Object.assign(form, defaultForm)
      // 如果原来列表就在某个大类下，可以尝试保持那个大类，这里暂且重置为 general 或根据业务需要
      // 父组件可以通过 ref 调用方法来预设 material_type，或者增加一个 prop
    }
    //清除校验
    setTimeout(() => formRef.value?.clearValidate(), 0)
  }
})

// 类型切换处理
const handleTypeChange = (val) => {
  // 切换时可能需要清空特定字段，暂不做强制清空以保留用户输入
  if (val === 'half_mask') {
    form.category = '原料' // 半面罩通常归为原料？或者由用户填
  }
}

const handleClose = () => {
  emit('update:modelValue', false)
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (valid) {
      apiLoading.value = true
      try {
        if (isEdit.value) {
          await request.put(`/materials/${form.id}`, form)
          ElMessage.success('更新成功')
        } else {
          await request.post('/materials', form)
          ElMessage.success('创建成功')
        }
        emit('saved')
        handleClose()
      } catch (error) {
        // request util handles error message usually
      } finally {
        apiLoading.value = false
      }
    }
  })
}

// 暴露给父组件的方法 (例如预设类型)
defineExpose({
  setMaterialType: (type) => {
    if (type) form.material_type = type
  }
})
</script>

<style scoped>
.material-detail-dialog :deep(.el-dialog__header) {
  margin-right: 0;
  border-bottom: 1px solid #f0f2f5;
  padding: 20px 24px;
}

.material-detail-dialog :deep(.el-dialog__body) {
  padding: 0;
}

.material-detail-dialog :deep(.el-dialog__footer) {
  border-top: 1px solid #f0f2f5;
  padding: 16px 24px;
  background-color: #fcfcfc;
}

/* 顶部状态栏 - 已移除 */

.dialog-content {
  padding: 24px;
  max-height: 65vh;
  overflow-y: auto;
}

/* 现代表单样式 */
.modern-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: #606266;
  padding-bottom: 4px;
}

.form-section {
  margin-bottom: 32px;
}

.form-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 4px; /* Align visual weight */
}

/* 突出显示区域 */
.highlight-section {
  background-color: #f8fbff;
  border: 1px dashed #d9ecff;
  border-radius: 8px;
  padding: 16px 16px 0 16px; /* excluded bottom margin of row */
}
.highlight-section .section-title {
 margin-bottom: 12px;
}
.highlight-section :deep(.el-row) {
  margin-bottom: 16px; /* Compensate padding */
}

/* 输入框增强 */
.featured-input :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px #dcdfe6 inset;
  background-color: #fff;
}
.featured-input :deep(.el-input__inner) {
  font-weight: 500;
}

.full-width {
  width: 100%;
}

.modern-radio :deep(.el-radio.is-bordered.is-checked) {
  background-color: #ecf5ff;
}

/* 底部按钮 */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.submit-btn {
  min-width: 100px;
}
</style>
