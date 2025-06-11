<template>
  <div>
    <!--
      @slot Default scoped slot for form content.
      @binding {boolean} isFormDirty - True if any field in the form is dirty.
      @binding {boolean} isFormTouched - True if any field in the form has been touched.
    -->
    <slot :isFormDirty="isFormDirty" :isFormTouched="isFormTouched">
      <form class="presko-form" @submit.prevent.stop="handleFormSubmit">
        <!--
          @slot Named slot for a custom form title.
        -->
        <slot name="title">
          <div v-if="title" class="presko-form-title">{{ title }}</div>
        </slot>

        <div class="presko-form-fields-wrapper">
          <div
            v-for="(field, i) in fields"
            :key="field.propertyName || field.subForm || i"
          >
            <!-- Sub-Form Rendering -->
            <PreskoForm
              v-if="field.subForm"
              :ref="(el) => el && subFormRefs.push(el)" {{/* Corrected ref handling for arrays */}}
              v-model="modelValue[field.subForm]"
              :fields="field.fields"
              :error-props="props.errorProps"
              :fieldStateProps="props.fieldStateProps"
              :submit-component="props.submitComponent"
              :submit-btn-classes="props.submitBtnClasses"
              :submit-btn-props="props.submitBtnProps"
              @update:modelValue="
                (value) => handleSubFormModelUpdate(field.subForm, value)
              "
              @field:touched="
                (eventData) => handleSubFormEvent('field:touched', field.subForm, eventData)
              "
              @field:dirty="
                (eventData) => handleSubFormEvent('field:dirty', field.subForm, eventData)
              "
              @submit:reject="handleSubFormSubmitReject"
            />
            <!-- List Field Rendering -->
            <div v-else-if="field.type === 'list'" class="presko-list-field">
              <div class="presko-list-field-header">
                <label>{{ field.label || field.propertyName }}</label>
                <button
                  type="button"
                  @click="handleAddItem(field.propertyName)"
                  class="presko-list-add-btn"
                >
                  Add {{ field.itemLabel || "Item" }}
                </button>
              </div>
              <div
                v-for="(item, index) in modelValue[field.propertyName]"
                :key="index" {{/* Consider a more robust key if items can be reordered significantly and have unique IDs */}}
                class="presko-list-item"
              >
                <div class="presko-list-item-fields">
                  <PreskoFormItem
                    v-for="listItemField in field.fields"
                    :key="listItemField.propertyName"
                    :modelValue="item[listItemField.propertyName]"
                    @update:modelValue="
                      (value) =>
                        handleListItemFieldModelUpdate(
                          field.propertyName,
                          index,
                          listItemField.propertyName,
                          value
                        )
                    "
                    :field="listItemField"
                    :error-props="props.errorProps"
                    :isTouched="
                      formFieldsTouchedState[
                        `${field.propertyName}[${index}].${listItemField.propertyName}`
                      ] || false
                    "
                    :isDirty="
                      formFieldsDirtyState[
                        `${field.propertyName}[${index}].${listItemField.propertyName}`
                      ] || false
                    "
                    :fieldStateProps="props.fieldStateProps"
                    :validity-state="{
                      hasErrors:
                        formFieldsValidity[
                          `${field.propertyName}[${index}].${listItemField.propertyName}`
                        ] === false,
                      errMsg:
                        formFieldsErrorMessages[
                          `${field.propertyName}[${index}].${listItemField.propertyName}`
                        ],
                    }"
                    @field-blurred="
                      () => {{/* Pass only necessary info, PreskoFormItem emits propertyName */}}
                        handleListItemFieldBlurred(
                          field.propertyName,
                          index,
                          listItemField.propertyName
                        )
                    "
                  ></PreskoFormItem>
                </div>
                <button
                  type="button"
                  @click="handleRemoveItem(field.propertyName, index)"
                  class="presko-list-remove-btn"
                >
                  Remove
                </button>
              </div>
            </div>
            <!-- Regular Field Rendering -->
            <PreskoFormItem
              v-else-if="field.propertyName"
              :modelValue="modelValue[field.propertyName]"
              @update:modelValue="
                (value) => handleFieldModelUpdate(field.propertyName, value)
              "
              :field="field"
              :error-props="props.errorProps"
              :isTouched="formFieldsTouchedState[field.propertyName] || false"
              :isDirty="formFieldsDirtyState[field.propertyName] || false"
              :fieldStateProps="props.fieldStateProps"
              :validity-state="{
                hasErrors: formFieldsValidity[field.propertyName] === false,
                errMsg: formFieldsErrorMessages[field.propertyName],
              }"
              @field-blurred="
                (emittedPropertyName) => handleFieldBlurred(emittedPropertyName, field.propertyName)
              "
            ></PreskoFormItem>
          </div>
        </div>

        <!--
          @slot Named scoped slot for the submit button area.
          @binding {boolean} isFormDirty - True if any field in the form is dirty.
          @binding {boolean} isFormTouched - True if any field in the form has been touched.
        -->
        <slot
          name="submit-row"
          :isFormDirty="isFormDirty"
          :isFormTouched="isFormTouched"
        >
          <component
            :is="props.submitComponent"
            v-bind="props.submitBtnProps"
            :class="props.submitBtnClasses"
          />
        </slot>
        <!--
          @slot Named scoped slot for additional content at the end of the form.
          @binding {boolean} isFormDirty - True if any field in the form is dirty.
          @binding {boolean} isFormTouched - True if any field in the form has been touched.
        -->
        <slot
          name="default-extra"
          :isFormDirty="isFormDirty"
          :isFormTouched="isFormTouched"
        ></slot>
      </form>
    </slot>
  </div>
</template>

<script setup>
import PreskoFormItem from "./PreskoFormItem.vue";
import { useFormValidation } from "../composables/useFormValidation";
import { watch, computed, ref } from "vue";

const props = defineProps({
  fields: { type: Array, default: () => [] },
  title: String,
  submitComponent: String,
  submitBtnClasses: String,
  submitBtnProps: Object,
  errorProps: {
    type: Object,
    default: () => ({
      hasErrors: "error",
      errorMessages: "errorMessages",
      errorMessagesType: "string",
    }),
  },
  fieldStateProps: {
    type: Object,
    default: () => ({
      isTouched: "touched",
      isDirty: "dirty",
    }),
  },
});

const emit = defineEmits([
  "update:modelValue",
  "submit",
  "submit:reject",
  "field:touched",
  "field:dirty",
]);

const modelValue = defineModel("modelValue", {
  default: () => ({}),
  local: true,
});

const subFormRefs = ref([]);

const {
  formFieldsValues, // Internal reactive state for values in useFormValidation
  formFieldsValidity,
  formFieldsErrorMessages,
  validateFormPurely,
  formFieldsTouchedState,
  formFieldsDirtyState,
  setFieldTouched,
  checkFieldDirty,
  updateFieldInitialValue,
  addItem,
  removeItem,
} = useFormValidation(props.fields);

/**
 * Initializes the modelValue with fields' default values or existing structure.
 */
const initializeModel = (fieldsToProcess) => {
  if (typeof modelValue.value !== "object" || modelValue.value === null) {
    modelValue.value = {};
  }
  let wasModelModified = false;
  const workingModel = JSON.parse(JSON.stringify(modelValue.value));

  const processFieldsRecursive = (currentFields, modelSegment) => {
    if (currentFields && Array.isArray(currentFields)) {
      currentFields.forEach((field) => {
        const key = field.propertyName || field.subForm;
        if (!key) return;

        if (field.type === "list") {
          if (!modelSegment.hasOwnProperty(key) || !Array.isArray(modelSegment[key])) {
            modelSegment[key] = field.initialValue && Array.isArray(field.initialValue)
              ? JSON.parse(JSON.stringify(field.initialValue))
              : [];
            wasModelModified = true;
          }
          const listFieldDefinition = field.fields;
          const listDefaultItemValue = field.defaultValue || {};
          modelSegment[key].forEach((item, index) => {
            let currentItem = modelSegment[key][index];
            if (typeof currentItem !== 'object' || currentItem === null) {
                currentItem = modelSegment[key][index] = JSON.parse(JSON.stringify(listDefaultItemValue));
                wasModelModified = true;
            }
            if (Array.isArray(listFieldDefinition)) {
              listFieldDefinition.forEach(listItemFieldDef => {
                if (listItemFieldDef.propertyName && !currentItem.hasOwnProperty(listItemFieldDef.propertyName)) {
                  currentItem[listItemFieldDef.propertyName] = listItemFieldDef.hasOwnProperty('value')
                    ? listItemFieldDef.value
                    : listDefaultItemValue.hasOwnProperty(listItemFieldDef.propertyName)
                      ? listDefaultItemValue[listItemFieldDef.propertyName]
                      : undefined;
                  wasModelModified = true;
                }
              });
            }
          });
        } else if (field.subForm) {
          if (!modelSegment.hasOwnProperty(key) || typeof modelSegment[key] !== "object" || modelSegment[key] === null) {
            modelSegment[key] = {};
            wasModelModified = true;
          }
          processFieldsRecursive(field.fields, modelSegment[key]);
        } else if (field.propertyName) {
          if (!modelSegment.hasOwnProperty(key)) {
            modelSegment[key] = field.hasOwnProperty("value") ? field.value : undefined;
            wasModelModified = true;
          }
        }
      });
    }
  };

  processFieldsRecursive(fieldsToProcess, workingModel);
  if (wasModelModified) {
    modelValue.value = workingModel;
  }
};

watch(() => props.fields, (newFields) => {
    initializeModel(newFields);
}, { deep: true, immediate: true });


watch(() => modelValue.value, (newModel, oldModel) => {
    const syncWithInternalStates = (currentFieldsConfig, currentNewModel, currentOldModel, pathPrefix = "") => {
      if (!currentFieldsConfig || typeof currentNewModel !== 'object' || currentNewModel === null) return;
      currentFieldsConfig.forEach(field => {
        const key = field.propertyName || field.subForm;
        if (!key) return;
        const fullPath = pathPrefix + key;
        const newValue = currentNewModel[key];
        // const oldValue = currentOldModel ? currentOldModel[key] : undefined; // Not always needed for this sync

        if (field.type === 'list') {
          if (formFieldsValues[fullPath] !== newValue && Array.isArray(newValue)) {
             formFieldsValues[fullPath] = newValue; // Sync internal array
          }
          updateFieldInitialValue(fullPath, JSON.parse(JSON.stringify(newValue || [])));
          if(checkFieldDirty(fullPath, newValue)) {
            emit("field:dirty", { propertyName: fullPath, dirty: formFieldsDirtyState[fullPath] });
          }
          if (Array.isArray(newValue) && Array.isArray(field.fields)) {
            newValue.forEach((item, index) => {
              const oldItem = Array.isArray(currentOldModel?.[key]) && currentOldModel[key][index] ? currentOldModel[key][index] : undefined;
              syncWithInternalStates(field.fields, item, oldItem, `${fullPath}[${index}].`);
            });
          }
        } else if (field.subForm) {
          if (newValue && typeof newValue === 'object') {
             if (formFieldsValues[fullPath] !== newValue) {
                formFieldsValues[fullPath] = newValue;
             }
            updateFieldInitialValue(fullPath, JSON.parse(JSON.stringify(newValue || {})));
            if(checkFieldDirty(fullPath, newValue)) {
              emit("field:dirty", { propertyName: fullPath, dirty: formFieldsDirtyState[fullPath] });
            }
            syncWithInternalStates(field.fields, newValue, currentOldModel ? currentOldModel[key] : undefined, `${fullPath}.`);
          }
        } else if (field.propertyName) {
           if (formFieldsValues[fullPath] !== newValue) {
             formFieldsValues[fullPath] = newValue;
           }
          updateFieldInitialValue(fullPath, newValue);
          if (checkFieldDirty(fullPath, newValue)) {
            emit("field:dirty", { propertyName: fullPath, dirty: formFieldsDirtyState[fullPath] });
          }
        }
      });
    };
    syncWithInternalStates(props.fields, newModel, oldModel, "");
  }, { deep: true, immediate: true }
);

const handleFieldBlurred = (emittedPropertyName, fullPath) => {
  if (setFieldTouched(fullPath, true)) {
    emit("field:touched", { propertyName: fullPath, touched: formFieldsTouchedState[fullPath] });
  }
};

const handleListItemFieldBlurred = (listName, itemIndex, itemFieldName) => {
  const fullPath = `${listName}[${itemIndex}].${itemFieldName}`;
  if (setFieldTouched(fullPath, true)) {
    emit("field:touched", { propertyName: fullPath, touched: formFieldsTouchedState[fullPath] });
  }
};

const handleSubFormEvent = (eventName, subFormKey, eventData) => {
  const fullPath = `${subFormKey}.${eventData.propertyName}`;
  if (eventName === "field:touched") {
    if (setFieldTouched(subFormKey, true)) {
       emit("field:touched", { propertyName: subFormKey, touched: formFieldsTouchedState[subFormKey] });
    }
    if (setFieldTouched(fullPath, eventData.touched)) {
      emit("field:touched", { propertyName: fullPath, touched: formFieldsTouchedState[fullPath] });
    }
  } else if (eventName === "field:dirty") {
    const subFormModel = modelValue.value[subFormKey];
    if (subFormModel && checkFieldDirty(fullPath, subFormModel[eventData.propertyName])) {
      emit("field:dirty", { propertyName: fullPath, dirty: formFieldsDirtyState[fullPath] });
    }
    if (checkFieldDirty(subFormKey, modelValue.value[subFormKey])) {
        emit("field:dirty", { propertyName: subFormKey, dirty: formFieldsDirtyState[subFormKey] });
    }
  }
};

const isFormDirty = computed(() => Object.values(formFieldsDirtyState).some(state => state === true));
const isFormTouched = computed(() => Object.values(formFieldsTouchedState).some(state => state === true));

const handleFormSubmit = () => {
  const touchAllFieldsRecursive = (fieldsToTouch, pathPrefix = "") => {
      if (!fieldsToTouch || !Array.isArray(fieldsToTouch)) return;
      fieldsToTouch.forEach((field) => {
        const key = field.propertyName || field.subForm;
        if (!key) return;
        const fullPath = pathPrefix + key;
        if (setFieldTouched(fullPath, true)) {
          emit("field:touched", { propertyName: fullPath, touched: formFieldsTouchedState[fullPath] });
        }
        if (field.type === "list" && Array.isArray(field.fields)) {
          const listItems = modelValue.value[key] || [];
          listItems.forEach((item, index) => {
            touchAllFieldsRecursive(field.fields, `${fullPath}[${index}].`);
          });
        } else if (field.subForm && Array.isArray(field.fields)) {
          touchAllFieldsRecursive(field.fields, `${fullPath}.`);
        }
      });
    };
  touchAllFieldsRecursive(props.fields);

  if (subFormRefs.value && subFormRefs.value.length > 0) {
    subFormRefs.value.forEach((subForm) => {
      if (subForm && typeof subForm.handleFormSubmit === "function") {
        subForm.handleFormSubmit(); // Should ideally not emit if parent is already submitting
      }
    });
  }
  const isValid = validateFormPurely(modelValue.value);
  if (!isValid) {
    emit("submit:reject");
  } else {
    emit("submit", JSON.parse(JSON.stringify(modelValue.value)));
  }
};

const handleSubFormModelUpdate = (subFormKey, newSubModelValue) => {
  if (typeof modelValue.value === "object" && modelValue.value !== null) {
    const updatedModel = { ...modelValue.value, [subFormKey]: newSubModelValue };
    modelValue.value = updatedModel;
    // Main watcher handles sync with useFormValidation and emits
  }
};

const handleSubFormSubmitReject = (eventData) => {
  emit("submit:reject", eventData);
};

const handleFieldModelUpdate = (propertyName, value) => {
  if (typeof modelValue.value === "object" && modelValue.value !== null) {
    const newMainModel = { ...modelValue.value, [propertyName]: value };
    modelValue.value = newMainModel;
    // Main watcher handles sync and dirty checks
  }
};

const handleListItemFieldModelUpdate = (listName, itemIndex, itemFieldName, value) => {
   if (
    typeof modelValue.value === "object" && modelValue.value !== null &&
    modelValue.value[listName] && Array.isArray(modelValue.value[listName]) &&
    modelValue.value[listName][itemIndex] !== undefined
  ) {
    const newList = [...modelValue.value[listName]];
    const newItem = { ...newList[itemIndex], [itemFieldName]: value };
    newList[itemIndex] = newItem;
    const newMainModel = { ...modelValue.value, [listName]: newList };
    modelValue.value = newMainModel; // Triggers main modelValue watcher
  }
};

const handleAddItem = (listPropertyName) => {
  const listFieldConfig = props.fields.find(f => f.propertyName === listPropertyName && f.type === 'list');
  if (!listFieldConfig) return;
  let newItemInitialData = {};
  if (listFieldConfig.defaultValue && typeof listFieldConfig.defaultValue === 'object') {
    newItemInitialData = JSON.parse(JSON.stringify(listFieldConfig.defaultValue));
  } else if (Array.isArray(listFieldConfig.fields)) {
    listFieldConfig.fields.forEach(subField => {
      if (subField.propertyName) {
        newItemInitialData[subField.propertyName] = subField.hasOwnProperty('value') ? subField.value : undefined;
      }
    });
  }
  addItem(listPropertyName, newItemInitialData);
  const newListArray = formFieldsValues[listPropertyName] ? [...formFieldsValues[listPropertyName]] : [];
  modelValue.value = { ...modelValue.value, [listPropertyName]: newListArray };
};

const handleRemoveItem = (listPropertyName, index) => {
  removeItem(listPropertyName, index);
  const newListArray = formFieldsValues[listPropertyName] ? [...formFieldsValues[listPropertyName]] : [];
  modelValue.value = { ...modelValue.value, [listPropertyName]: newListArray };
};

defineExpose({
  handleFormSubmit,
  addItem: handleAddItem,
  removeItem: handleRemoveItem,
});
</script>

<style scoped>
/* Basic styling for list items, customize as needed */
.presko-list-field {
  margin-bottom: 1rem;
  padding: 0.5rem;
  border: 1px solid #eee;
  border-radius: 4px;
}
.presko-list-field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.presko-list-item {
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  border: 1px dashed #ccc;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.presko-list-item-fields {
  flex-grow: 1;
  margin-right: 0.5rem; /* Space before remove button */
}

.presko-list-add-btn,
.presko-list-remove-btn {
  /* Add your button styles */
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  border: 1px solid #ccc;
  background-color: #f9f9f9;
  border-radius: 3px;
}
.presko-list-add-btn:hover,
.presko-list-remove-btn:hover {
  background-color: #f0f0f0;
}
.presko-form-title {
    font-size: 1.5em;
    margin-bottom: 1em;
}
.presko-form-fields-wrapper > div {
    margin-bottom: 1em; /* Add space between form items/groups */
}
.read-the-docs { /* From original scaffold, can be removed if not used */
  color: #888;
}
</style>
