<template>
  <input v-bind="$attrs" :class="{ error: error }" v-model="modelValue" />
</template>

<script setup>
const { error } = defineProps(["error"]);
const modelValue = defineModel();
</script>

<style scoped>
.error {
  background-color: ivory;
  border: none;
  outline: 2px solid red;
}
</style>
