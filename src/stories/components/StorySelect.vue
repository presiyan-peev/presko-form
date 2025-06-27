<template>
  <div class="story-select-field">
    <label :for="selectId" v-if="label">{{ label }}</label>
    <select
      :id="selectId"
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)"
      @blur="$emit('blur')"
      :disabled="disabled"
      :class="{ 'has-error': error, 'is-touched': touched, 'is-dirty': dirty }"
    >
      <option disabled value="" v-if="placeholder">{{ placeholder }}</option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.text }}
      </option>
    </select>
    <div v-if="error && errorMessages" class="error-message">
      {{ Array.isArray(errorMessages) ? errorMessages.join(', ') : errorMessages }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: [String, Number],
  label: String,
  options: {
    type: Array,
    default: () => [], // Expected format: [{ value: 'val', text: 'Label' }]
  },
  placeholder: String,
  error: Boolean,
  errorMessages: [String, Array],
  touched: Boolean,
  dirty: Boolean,
  disabled: Boolean,
  id: String,
});

defineEmits(['update:modelValue', 'blur']);

const selectId = computed(() => props.id || `select-${Math.random().toString(36).substring(7)}`);
</script>

<style scoped>
.story-select-field {
  margin-bottom: 1rem;
}
label {
  display: block;
  margin-bottom: 0.25rem;
  font-weight: bold;
}
select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
  background-color: white;
}
select.has-error {
  border-color: red;
}
.error-message {
  color: red;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}
</style>
