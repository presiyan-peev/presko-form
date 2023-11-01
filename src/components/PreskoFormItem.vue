<template>
  <component
    :is="field.component"
    class="presko-form-field"
    v-model="modelValue"
    v-bind="{ ...errorState, ...field.props }"
  />
</template>

<script setup>
import { computed } from "vue";

const { field, errorProps, validityState } = defineProps({
  field: Object,
  errorProps: Object,
  validityState: Object,
});

const emit = defineEmits(["input", "update:model-value"]);
const modelValue = defineModel();

const errorState = computed(() => ({
  [errorProps.hasErrors]: validityState.hasErrors,
  [errorProps.errorMessages]:
    errorProps.errorMessagesType !== "string" && validityState.errMsg.length > 0
      ? validityState.errMsg[0]
      : validityState.errMsg,
}));
</script>
