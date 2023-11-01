<template>
  <div>
    <label :for="label">{{ label }}</label>
    <input
      v-bind="$attrs"
      :class="{ error: error }"
      :value="modelValue"
      @input.stop="emitInput"
      :id="label"
    />
    <div>{{ errorMessages }}</div>
  </div>
</template>

<script setup>
const { error, errorMessages, label, modelValue } = defineProps([
  "error",
  "errorMessages",
  "label",
  "modelValue",
]);

const emit = defineEmits("update:model-value");
function emitInput(e) {
  emit("update:model-value", e.target.value);
}
</script>

<style scoped>
.error {
  background-color: ivory;
  border: none;
  outline: 2px solid red;
}
</style>
