<script setup>
import PreskoForm from "./components/PreskoForm.vue";

const fields = [
  {
    propertyName: "poshta",
    label: "Email",
    component: "AppInput",
    rules: ["required", "email"],
    value: "john@example.com",
    props: {
      label: "Email",
    },
  },
  // {
  //   propertyName: "option",
  //   label: "Option",
  //   component: "select",
  //   options: ["Option 1", "Option 2"],
  //   rules: ["required"],
  //   value: "Option 2",
  // },
  {
    propertyName: "password",
    label: "Password",
    component: "AppInput",
    type: "password",
    rules: ["required"],
    value: "",
    props: {
      label: "Password",
    },
  },
];

function alertSubmit(e) {
  alert(JSON.stringify(e));
}

function alertFormValidationFail() {
  alert("validation failed");
}
</script>

<template>
  <PreskoForm
    title="Presko Form"
    :fields="fields"
    submit-component="AppSubmit"
    @submit="alertSubmit"
    @submit:reject="alertFormValidationFail"
  />
</template>

<style>
input:invalid {
  background-color: ivory;
  border: none;
  outline: 2px solid red;
}
</style>
