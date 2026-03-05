<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :title="isEdit ? '编辑角色' : '新增角色'"
    width="500px"
    class="minimal-dialog-auto"
    append-to-body
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
    >
      <el-form-item label="角色代码" prop="code">
        <el-input
          v-model="form.code"
          placeholder="请输入角色代码，如：custom_role"
          :disabled="isEdit"
        />
        <div class="form-tip">只能以字母开头，包含字母、数字和下划线</div>
      </el-form-item>

      <el-form-item label="角色名称" prop="name">
        <el-input
          v-model="form.name"
          placeholder="请输入角色名称，如：自定义角色"
        />
      </el-form-item>

      <el-form-item label="角色描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="请输入角色描述，说明该角色的职责和权限范围"
        />
      </el-form-item>

      <el-form-item label="排序" prop="sort_order">
        <el-input-number
          v-model="form.sort_order"
          :min="0"
          :max="999"
          placeholder="数值越小排序越靠前"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitForm">
        {{ isEdit ? '保存' : '创建' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import request from '../../utils/request'

const props = defineProps({
  modelValue: Boolean,
  isEdit: Boolean,
  roleData: Object
})

const emit = defineEmits(['update:modelValue', 'success'])

// 表单引用
const formRef = ref(null)
const submitting = ref(false)

// 表单数据
const form = reactive({
  code: '',
  name: '',
  description: '',
  sort_order: 0
})

// 表单验证规则
const rules = {
  code: [
    { required: true, message: '请输入角色代码', trigger: 'blur' },
    { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '只能以字母开头，包含字母、数字和下划线', trigger: 'blur' },
    { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  name: [
    { required: true, message: '请输入角色名称', trigger: 'blur' },
    { min: 2, max: 100, message: '长度在 2 到 100 个字符', trigger: 'blur' }
  ],
  description: [
    { max: 500, message: '描述不能超过 500 个字符', trigger: 'blur' }
  ]
}

// 监听弹窗打开，初始化表单
watch(() => props.modelValue, (visible) => {
  if (visible) {
    if (props.isEdit && props.roleData) {
      // 编辑模式，填充数据
      form.code = props.roleData.code
      form.name = props.roleData.name
      form.description = props.roleData.description || ''
      form.sort_order = props.roleData.sort_order || 0
    } else {
      // 创建模式，重置表单
      resetForm()
    }
  }
})

// 重置表单
const resetForm = () => {
  form.code = ''
  form.name = ''
  form.description = ''
  form.sort_order = 0
  if (formRef.value) {
    formRef.value.resetFields()
  }
}

// 关闭弹窗
const handleClose = () => {
  emit('update:modelValue', false)
  resetForm()
}

// 提交表单
const submitForm = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    submitting.value = true
    try {
      let response
      if (props.isEdit) {
        // 更新角色
        response = await request.put(`/roles/${props.roleData.id}`, {
          name: form.name,
          description: form.description,
          sort_order: form.sort_order
        })
      } else {
        // 创建角色
        response = await request.post('/roles', form)
      }

      if (response.success) {
        ElMessage.success(props.isEdit ? '角色更新成功' : '角色创建成功')
        emit('success')
        handleClose()
      }
    } catch (error) {
      // 错误已在拦截器处理
    } finally {
      submitting.value = false
    }
  })
}
</script>

<style scoped>
.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
</style>
