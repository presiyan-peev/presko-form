<script setup>
import PreskoForm from "./components/PreskoForm.vue";

const fields = [
  {
    propertyName: "name",
    component: "AppInput",
    rules: ["required"],
    value: "",
    props: {
      label: "Name",
    },
  },
  {
    propertyName: "last-name",
    component: "AppInput",
    rules: ["required"],
    value: "",
    props: {
      label: "Last Name",
    },
  },
  {
    subForm: "contacts",
    fields: [
      {
        propertyName: "poshta",
        component: "AppInput",
        rules: ["required", "email"],
        value: "john@example.com",
        props: {
          label: "Email",
        },
      },
      {
        propertyName: "phone",
        component: "AppInput",
        rules: ["required"],
        value: "0883",
        props: {
          label: "Phone",
        },
      },
    ],
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
    component: "AppInput",
    type: "password",
    rules: ["required"],
    value: "",
    props: {
      label: "Password",
    },
  },
];

let form = {
  name: "dido",
  contacts: {},
};

function alertSubmit(e) {
  console.log({ form });
  alert(JSON.stringify(e));
}

function alertFormValidationFail() {
  alert("validation failed");
}
</script>

<template>
  <PreskoForm
    v-model="form"
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
