<template>
  <div>
    <form class="presko-form" @submit.prevent.stop="handleFormSubmit">
      <slot name="title">
        <div class="presko-form-title">{{ title }}</div>
      </slot>
      <div class="presko-form-fields-wrapper">
        <div v-for="(field, i) in fields" :key="i">
          <PreskoForm
            v-if="field.subForm"
            v-model="modelValue[field.subForm]"
            :fields="field.fields"
          />
          <PreskoFormItem
            v-else
            v-model="modelValue[field.propertyName]"
            :field="field"
            :error-props="errorProps"
            :validity-state="{
              hasErrors: formFieldsValidity[field.propertyName] == false,
              errMsg: formFieldsErrorMessages[field.propertyName],
            }"
          ></PreskoFormItem>
        </div>
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
import { watch } from "vue";

const modelValue = defineModel("modelValue", { default: {}, local: true });

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

const emit = defineEmits([
  "input",
  "update:model-value",
  "submit",
  "submit:reject",
]);

watch(
  () => modelValue,
  (v) => {
    console.log({ v });
  }
);

const {
  formFieldsValues,
  formFieldsValidity,
  formFieldsErrorMessages,
  validateFormPurely,
} = useFormValidation(fields);

// Handle Submit

const handleFormSubmit = () => {
  validateFormPurely(modelValue.value);
  if (Object.values(formFieldsValidity).includes(false)) {
    emit("submit:reject");
  } else {
    emit("submit", JSON.parse(JSON.stringify(modelValue.value)));
  }
};
</script>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
