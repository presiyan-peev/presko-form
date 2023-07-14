<template>
  <form>
    <slot name="title">{{ title }}</slot>
    <PreskoFormItem
      v-for="field in fields"
      :key="field.propertyName"
      v-bind="field"
      @input="emitInput"
    ></PreskoFormItem>
  </form>
</template>

<script setup>
import PreskoFormItem from "./PreskoFormItem.vue";
import { reactive } from "vue";

const emit = defineEmits(["input"]);

const { fields, title } = defineProps({
  fields: Array,
  title: String,
});

let form = reactive({});

fields.forEach((field) => {
  form[field.name] = field.value || "";
});

const emitInput = (e) => {
  emit("input", e);
};
</script>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
