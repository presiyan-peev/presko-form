<template>
  <div>
    <input v-bind="$attrs" :class="{ error: error }" v-model="modelValue" />
    <div>{{ errorMessages }}</div>
  </div>
</template>

<script setup>
const { error, errorMessages } = defineProps(["error", "errorMessages"]);
const modelValue = defineModel();
</script>

<style scoped>
.error {
  background-color: ivory;
  border: none;
  outline: 2px solid red;
}
</style>
