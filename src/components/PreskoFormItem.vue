<template>
  <component
    :is="field.component"
    class="presko-form-field"
    :model-value="modelValue"
    v-bind="errorState"
    @input="handleInput"
  />
</template>

<script setup>
import { computed, ref } from "vue";

const { field, errorProps, validityState } = defineProps({
  field: Object,
  errorProps: Object,
  validityState: Object,
});

const emit = defineEmits(["input"]);
const modelValue = ref(field.value);

const errorState = computed(() => ({
  [errorProps.hasErrors]: validityState.hasErrors,
  [errorProps.errorMessages]:
    errorProps.errorMessagesType !== "string" && validityState.errMsg.length > 0
      ? validityState.errMsg[0]
      : validityState.errMsg,
}));

const handleInput = (e) => {
  let input = null;
  try {
    input = typeof e == "string" ? e : e.target.value;
  } catch (error) {
    throw new Error(
      "Field component must return a string or a native input event object"
    );
  }
  console.log({ input });
  modelValue.value = input;

  emit("input", {
    input,
    field,
  });
};
</script>
