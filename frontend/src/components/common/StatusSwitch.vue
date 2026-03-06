<template>
  <div class="status-switch-container" :class="{ 'is-disabled': disabled }">
    <label class="container">
      <input 
        type="checkbox" 
        class="checkbox" 
        :checked="isChecked" 
        :disabled="disabled"
        @change="onChange"
      >
      <div class="switch">
        <span class="slider"></span>
      </div>
    </label>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: [Boolean, String, Number],
    default: false
  },
  activeValue: {
    type: [Boolean, String, Number],
    default: true
  },
  inactiveValue: {
    type: [Boolean, String, Number],
    default: false
  },
  disabled: Boolean
})

const emit = defineEmits(['update:modelValue', 'change'])

const isChecked = computed(() => {
  return props.modelValue === props.activeValue
})

const onChange = (e) => {
  const checked = e.target.checked
  const val = checked ? props.activeValue : props.inactiveValue
  emit('update:modelValue', val)
  emit('change', val)
}
</script>

<style scoped>
.status-switch-container {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  vertical-align: middle;
}

.is-disabled {
  opacity: 0.6;
}
.is-disabled .container,
.is-disabled .switch,
.is-disabled .slider {
  cursor: not-allowed;
}

/* Compact size - scaled down */
/* The switch - the box around the slider */
.container {
  width: 36px;
  height: 20px;
  position: relative;
}

/* Hide default HTML checkbox */
.checkbox {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.switch {
  width: 100%;
  height: 100%;
  display: block;
  background-color: #e9e9eb;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease-out;
}

/* The slider */
.slider {
  width: 16px;
  height: 16px;
  position: absolute;
  left: 2px;
  top: calc(50% - 8px);
  border-radius: 50%;
  background: #FFFFFF;
  box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease-out;
  cursor: pointer;
}

.checkbox:checked + .switch {
  background-color: #34C759;
}

.checkbox:checked + .switch .slider {
  left: calc(100% - 18px);
  top: calc(50% - 8px);
}
</style>
