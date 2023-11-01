<template>
  <div>
    <form class="presko-form" @submit.prevent.stop="handleFormSubmit">
      <slot name="title">
        <div class="presko-form-title">{{ title }}</div>
      </slot>
      <div class="presko-form-fields-wrapper">
        <PreskoFormItem
          v-for="field in fields"
          :key="field.propertyName"
          :field="field"
          :error-props="errorProps"
          :validity-state="{
            hasErrors: formFieldsValidity[field.propertyName] == false,
            errMsg: formFieldsErrorMessages[field.propertyName],
          }"
          @input="handleInput"
        ></PreskoFormItem>
      </div>
      <slot name="submit-row">
        <component
          :is="submitComponent"
          v-bind="submitBtnProps"
          :class="submitBtnClasses"
        />
      </slot>
      <slot></slot>
    </form>
  </div>
</template>

<script setup>
import PreskoFormItem from "./PreskoFormItem.vue";
import { useFormValidation } from "../composables/useFormValidation";

const { fields, title, submitComponent, errorProps } = defineProps({
  fields: Array,
  title: String,
  submitComponent: String,
  submitBtnClasses: String,
  submitBtnProps: Object,
  errorProps: {
    type: Object,
    default: () => ({
      hasErrors: "error",
      errorMessages: "errorMessages",
      errorMessagesType: "string", // Can be string or array
    }),
  },
});

const emit = defineEmits(["input", "submit", "submit:reject"]);

const {
  formFieldsValues,
  formFieldsValidity,
  formFieldsErrorMessages,
  validateField,
  validateForm,
} = useFormValidation(fields);

const handleInput = ({ input, field }) => {
  Object.assign(formFieldsValues, { [field.propertyName]: input });
  validateField(field, input);
  emit("input", { [field.propertyName]: input });
  emit(`update:${field.propertyName}`, input);
};

// Handle Submit

const handleFormSubmit = () => {
  validateForm();
  if (Object.values(formFieldsValidity).includes(false)) {
    emit("submit:reject");
  } else {
    emit("submit", JSON.parse(JSON.stringify(formFieldsValues)));
  }
};
</script>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
