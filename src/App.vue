<script setup>
import PreskoForm from "./components/PreskoForm.vue";

const fields = [
  {
    propertyName: "email",
    label: "Email",
    component: "Input",
    type: "email",
    rules: ["required", "email"],
    value: "john@example.com",
  },
  {
    propertyName: "option",
    label: "Option",
    component: "select",
    options: ["Option 1", "Option 2"],
    rules: ["required"],
    value: "Option 2",
  },
  {
    propertyName: "password",
    label: "Password",
    component: "input",
    type: "password",
    rules: ["required"],
    value: "",
  },
];
</script>

<template>
  <PreskoForm title="Presko Form" :fields="fields" />
</template>
