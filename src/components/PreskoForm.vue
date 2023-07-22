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
          v-bind="field"
          :error-props="errorProps"
          @input="handleInput"
        ></PreskoFormItem>
      </div>
      <slot name="submit-row">
        <component :is="submitComponent" />
      </slot>
    </form>
  </div>
</template>

<script setup>
import PreskoFormItem from "./PreskoFormItem.vue";
import { ref, reactive } from "vue";

const emit = defineEmits(["input"]);
const isFormValid = ref(null);

const { fields, title, submitComponent, errorProps } = defineProps({
  fields: Array,
  title: String,
  submitComponent: String,
  errorProps: {
    type: Object,
    default: () => ({
      hasErrors: "error",
      errorMessages: "errorMessages",
      errorMessagesType: "string", // Can be string or array
    }),
  },
});

// key: value
let formFieldsValues = {};
// key: isValid
let formFieldsValidity;

const handleInput = ({ propertyName, input, isValid }) => {
  formFieldsValues[propertyName] = input;
  formFieldsValues[propertyName] = isValid;
  emit("input", { [propertyName]: input });
};

// Handle Submit

const handleFormSubmit = () => {
  console.log("inside submit");
};
</script>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
