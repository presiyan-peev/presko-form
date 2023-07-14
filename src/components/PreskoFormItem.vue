<template>
  <input type="text" :value="value" @input="handleInput" />
</template>

<script setup>
import { ref, watchEffect } from "vue";
import Validation from "../validation";

const { propertyName, label, component, type, rules, value, validators } =
  defineProps({
    propertyName: String,
    label: String,
    component: String,
    type: String,
    rules: Array,
    value: String,
    validators: Array,
  });

const emit = defineEmits(["input"]);

const errorMessages = ref([]);

watchEffect(() => {
  console.log(errorMessages.value);
});

const updateErrorMessages = (validity) => {
  if (validity !== true && validity != undefined) {
    errorMessages.value.push(validity);
  }
  // else - input is valid
};

const validateWithCustomValidator = (e) => {
  for (validationFn of validation) {
    if (typeof validationFn == "function") {
      const validity = validation(e);
      updateErrorMessages(validity);
    }
  }
};

const validateWithBuiltInRules = (e) => {
  if (!Array.isArray(rules)) return;
  rules.forEach((rule) => {
    console.log({ rule, v: Validation.required(e) });
    if (typeof rule == "string") {
      const validity = Validation[rule](e, label);
      updateErrorMessages(validity);
    }
    if (typeof rule == "object") {
      const { name, customErrorMsg } = rule;
      const validity = Validation[name](e, label, customErrorMsg);
      updateErrorMessages(validity);
    }
    if (typeof rule == RegExp) {
      const validity = Validation.matchRegex(e, label, customErrorMsg, rule);
      updateErrorMessages(validity);
    }
  });
};

const handleInput = (e) => {
  const input = typeof e == "string" ? e : e.target.value;
  if (!!validators) {
    validateWithCustomValidator(input);
  }
  if (!!rules) {
    validateWithBuiltInRules(input);
  }
  emit("input", input);
};
</script>
