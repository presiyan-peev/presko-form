<template>
  <div class="story-textarea-field">
    <label :for="textareaId" v-if="label">{{ label }}</label>
    <textarea
      :id="textareaId"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
      @blur="$emit('blur')"
      :placeholder="placeholder"
      :disabled="disabled"
      :rows="rows"
      :class="{ 'has-error': error, 'is-touched': touched, 'is-dirty': dirty }"
    ></textarea>
    <div v-if="error && errorMessages" class="error-message">
      {{ Array.isArray(errorMessages) ? errorMessages.join(', ') : errorMessages }}
    </div>
    <div v-if="pending" class="pending-message">Validating...</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: String,
  label: String,
  placeholder: String,
  rows: {
    type: Number,
    default: 3,
  },
  error: Boolean,
  errorMessages: [String, Array],
  touched: Boolean,
  dirty: Boolean,
  pending: Boolean,
  disabled: Boolean,
  id: String,
});

defineEmits(['update:modelValue', 'blur']);

const textareaId = computed(() => props.id || `textarea-${Math.random().toString(36).substring(7)}`);
</script>

<style scoped>
.story-textarea-field {
  margin-bottom: 1rem;
}
label {
  display: block;
  margin-bottom: 0.25rem;
  font-weight: bold;
}
textarea {
  width: calc(100% - 16px); /* Account for padding */
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
  resize: vertical;
}
textarea.has-error {
  border-color: red;
}
.error-message {
  color: red;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}
.pending-message {
  color: orange;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}
</style>
