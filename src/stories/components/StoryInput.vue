<template>
  <div class="story-input-field">
    <label :for="inputId" v-if="label">{{ label }}</label>
    <input
      :id="inputId"
      :type="type"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
      @blur="$emit('blur')"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="{ 'has-error': error, 'is-touched': touched, 'is-dirty': dirty }"
    />
    <div v-if="error && errorMessages" class="error-message">
      {{ Array.isArray(errorMessages) ? errorMessages.join(', ') : errorMessages }}
    </div>
    <div v-if="pending" class="pending-message">Validating...</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: [String, Number, Date],
  label: String,
  type: {
    type: String,
    default: 'text',
  },
  placeholder: String,
  error: Boolean,
  errorMessages: [String, Array],
  touched: Boolean,
  dirty: Boolean,
  pending: Boolean,
  disabled: Boolean,
  id: String,
});

defineEmits(['update:modelValue', 'blur']);

const inputId = computed(() => props.id || `input-${Math.random().toString(36).substring(7)}`);
</script>

<style scoped>
.story-input-field {
  margin-bottom: 1rem;
}
label {
  display: block;
  margin-bottom: 0.25rem;
  font-weight: bold;
}
input {
  width: calc(100% - 16px); /* Account for padding */
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}
input.has-error {
  border-color: red;
}
input.is-touched {
  /* border-color: orange; */ /* Example: if you want to show touched */
}
input.is-dirty {
  /* background-color: #f0f0f0; */ /* Example: if you want to show dirty */
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
