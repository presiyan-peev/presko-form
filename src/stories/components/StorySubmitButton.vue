<template>
  <button
    type="submit"
    class="story-submit-button"
    :disabled="disabled"
  >
    <slot>{{ text }}</slot>
  </button>
</template>

<script setup>
defineProps({
  text: {
    type: String,
    default: 'Submit',
  },
  disabled: Boolean,
});
</script>

<style scoped>
.story-submit-button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  color: white;
  background-color: #007bff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;
}
.story-submit-button:hover:not(:disabled) {
  background-color: #0056b3;
}
.story-submit-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}
</style>
