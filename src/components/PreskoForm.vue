<template>
  <div>
    <form class="presko-form" @submit.prevent.stop="handleFormSubmit">
      <slot name="title">
        <div class="presko-form-title">{{ title }}</div>
      </slot>
      <div class="presko-form-fields-wrapper">
        <component
          v-for="field in fields"
          :key="field.propertyName"
          :is="field.component"
          v-bind="field"
          class="presko-form-field"
          @input="emitInput"
        />
      </div>
      <slot name="submit-row">
        <component :is="submitComponent" />
      </slot>
    </form>
  </div>
</template>

<script setup>
import { reactive } from "vue";

const emit = defineEmits(["input"]);

const { fields, title, titleClass } = defineProps({
  fields: Array,
  title: String,
  submitComponent: String,
});

let form = reactive({});

fields.forEach((field) => {
  form[field.name] = field.value || "";
});

const emitInput = (e) => {
  emit("input", e);
};

// Handle Validation

// const updateErrorMessages = (validity) => {
//   if (validity !== true && validity != undefined) {
//     errorMessages.value.push(validity);
//   }
//   // else - input is valid
// };

// const validateWithCustomValidator = (e) => {
//   for (validationFn of validation) {
//     if (typeof validationFn == "function") {
//       const validity = validation(e);
//       updateErrorMessages(validity);
//     }
//   }
// };

// const validateWithBuiltInRules = (e) => {
//   if (!Array.isArray(rules)) return;
//   rules.forEach((rule) => {
//     console.log({ rule, v: Validation.required(e) });
//     if (typeof rule == "string") {
//       const validity = Validation[rule](e, label);
//       updateErrorMessages(validity);
//     }
//     if (typeof rule == "object") {
//       const { name, customErrorMsg } = rule;
//       const validity = Validation[name](e, label, customErrorMsg);
//       updateErrorMessages(validity);
//     }
//     if (typeof rule == RegExp) {
//       const validity = Validation.matchRegex(e, label, customErrorMsg, rule);
//       updateErrorMessages(validity);
//     }
//   });
// };

// const handleInput = (e) => {
//   const input = typeof e == "string" ? e : e.target.value;
//   if (!!validators) {
//     validateWithCustomValidator(input);
//   }
//   if (!!rules) {
//     validateWithBuiltInRules(input);
//   }
//   emit("input", input);
// };

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
