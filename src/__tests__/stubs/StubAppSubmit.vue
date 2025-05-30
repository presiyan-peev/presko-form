<template>
  <button type="submit" class="stub-app-submit" v-bind="$attrs">
    <slot>{{ text || 'Submit' }}</slot>
  </button>
</template>

<script setup>
defineProps({
  text: String // Example prop that might be passed via submitBtnProps
});
</script>

<style scoped>
.stub-app-submit {
  padding: 8px 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.stub-app-submit:hover {
  background-color: #0056b3;
}
</style>
