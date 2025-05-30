<template>
  <div class="stub-app-input">
    <label v-if="label" :for="inputId">{{ label }}</label>
    <input
      :id="inputId"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
      @blur="$emit('blur')"
      v-bind="$attrs"
    />
    <div v-if="error && errorMessages" class="stub-error-message">
      {{
        typeof errorMessages === "string"
          ? errorMessages
          : errorMessages.join(", ")
      }}
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

defineProps({
  modelValue: [String, Number, Array, Object, Boolean],
  label: String,
  error: Boolean, // From errorProps.hasErrors
  errorMessages: [String, Array], // From errorProps.errorMessages
  touched: Boolean, // Field touched state
  dirty: Boolean, // Field dirty state
  customTouched: Boolean, // Custom field touched state
  customDirty: Boolean, // Custom field dirty state
});

defineEmits(["update:modelValue", "blur"]);

const inputId = computed(
  () => `stub-input-${Math.random().toString(36).substring(7)}`
);
</script>

<style scoped>
.stub-app-input {
  margin-bottom: 0.5rem;
}
.stub-error-message {
  color: red;
  font-size: 0.8em;
}
</style>
