<template>
  <div class="story-checkbox-field">
    <label :for="checkboxId" class="checkbox-label">
      <input
        :id="checkboxId"
        type="checkbox"
        :checked="modelValue"
        @change="$emit('update:modelValue', $event.target.checked)"
        @blur="$emit('blur')"
        :disabled="disabled"
        :class="{ 'has-error': error, 'is-touched': touched, 'is-dirty': dirty }"
      />
      <span v-if="label">{{ label }}</span>
    </label>
    <div v-if="error && errorMessages" class="error-message">
      {{ Array.isArray(errorMessages) ? errorMessages.join(', ') : errorMessages }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: Boolean,
  label: String,
  error: Boolean,
  errorMessages: [String, Array],
  touched: Boolean,
  dirty: Boolean,
  disabled: Boolean,
  id: String,
});

defineEmits(['update:modelValue', 'blur']);

const checkboxId = computed(() => props.id || `checkbox-${Math.random().toString(36).substring(7)}`);
</script

<style scoped>
.story-checkbox-field {
  margin-bottom: 1rem;
}
.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
}
input[type="checkbox"] {
  margin-right: 0.5rem;
}
input[type="checkbox"].has-error {
 outline: 1px solid red; /* Checkboxes don't have borders typically */
}
.error-message {
  color: red;
  font-size: 0.875rem;
  margin-top: 0.25rem;
  margin-left: 1.7rem; /* Align with text if label is present */
}
</style>
