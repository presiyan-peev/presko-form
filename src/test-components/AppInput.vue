<template>
  <div>
    <label :for="label">{{ label }}</label>
    <input
      v-bind="$attrs"
      :class="{ error: error }"
      v-model="modelValue"
      :id="label"
    />
    <div>{{ errorMessages }}</div>
  </div>
</template>

<script setup>
const { error, errorMessages, label } = defineProps([
  "error",
  "errorMessages",
  "label",
]);
const modelValue = defineModel();
</script>

<style scoped>
.error {
  background-color: ivory;
  border: none;
  outline: 2px solid red;
}
</style>
