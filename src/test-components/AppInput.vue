<template>
  <input v-bind="$attrs" v-model="modelValue" />
</template>

<script setup>
const modelValue = defineModel();
</script>
