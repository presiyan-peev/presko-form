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
            <PreskoForm
              v-if="field.subForm"
              ref="subFormRefs"
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
                handleSubFormEvent('field:touched', field.subForm, $event)
              "
              @field:dirty="
                handleSubFormEvent('field:dirty', field.subForm, $event)
              "
              @submit:reject="handleSubFormSubmitReject"
            />
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
              @field-blurred="handleFieldBlurred"
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
  /**
   * The reactive object to bind form data to using `v-model`.
   * This is typically defined in the parent component.
   * @type {Object}
   * @default () => ({})
   * @required
   */
  // modelValue: is defined by defineModel

  /**
   * Array of field configuration objects that defines the form structure.
   * Each object configures a field or a sub-form.
   * @type {Array<Object>}
   * @default () => []
   * @required
   */
  fields: { type: Array, default: () => [] },

  /**
   * An optional title displayed at the top of the form.
   * Can be overridden by the `title` slot.
   * @type {string}
   */
  title: String,

  /**
   * The name of the Vue component to be used for the submit button.
   * This component will receive a `type="submit"` attribute implicitly.
   * @type {string}
   * @required
   */
  submitComponent: String,

  /**
   * CSS classes to apply directly to the `submitComponent`.
   * @type {string}
   */
  submitBtnClasses: String,

  /**
   * An object of props to pass to the `submitComponent`.
   * @type {Object}
   */
  submitBtnProps: Object,

  /**
   * Configures the prop names used to pass validation state (error status and messages)
   * to each `PreskoFormItem` and subsequently to your custom input components.
   * @type {Object}
   * @default { hasErrors: "error", errorMessages: "errorMessages", errorMessagesType: "string" }
   */
  errorProps: {
    type: Object,
    default: () => ({
      hasErrors: "error",
      errorMessages: "errorMessages",
      errorMessagesType: "string",
    }),
  },

  /**
   * Configures the prop names used to pass `isTouched` and `isDirty` boolean states
   * to each rendered field component via `PreskoFormItem`.
   * @type {Object}
   * @default { isTouched: 'touched', isDirty: 'dirty' }
   */
  fieldStateProps: {
    type: Object,
    default: () => ({
      isTouched: "touched",
      isDirty: "dirty",
    }),
  },
});

const emit = defineEmits([
  /**
   * Emitted by `v-model` on `PreskoForm` when form data changes.
   * @param {Object} modelValue - The updated form data object.
   */
  "update:modelValue",
  /**
   * Emitted when the form is submitted and all fields pass validation.
   * @param {Object} submittedData - The complete and valid form data (deep cloned).
   */
  "submit",
  /**
   * Emitted when the form is submitted but fails validation.
   */
  "submit:reject",
  /**
   * Emitted when a field's touched state changes.
   * @param {{ propertyName: string, touched: boolean }} payload - Object containing the field's propertyName and its new touched state.
   */
  "field:touched",
  /**
   * Emitted when a field's dirty state changes.
   * @param {{ propertyName: string, dirty: boolean }} payload - Object containing the field's propertyName and its new dirty state.
   */
  "field:dirty",
]);

/**
 * Two-way bound model for the form data.
 * Uses `local: true` to create a local copy that syncs with the parent.
 * @type {import('vue').ModelRef<Object>}
 */
const modelValue = defineModel("modelValue", {
  default: () => ({}),
  local: true,
});

// Template refs for sub-forms
const subFormRefs = ref([]);

/**
 * Initializes the model with fields' default values.
 * This function is called reactively when fields change.
 */
const initializeModel = (fields) => {
  if (typeof modelValue.value !== "object" || modelValue.value === null) {
    modelValue.value = {};
  }

  let tempModel = { ...modelValue.value };
  let modelWasModified = false;

  if (fields && Array.isArray(fields)) {
    fields.forEach((field) => {
      const key = field.propertyName || field.subForm;
      if (key) {
        let keyNeedsInitialization = !Object.prototype.hasOwnProperty.call(
          tempModel,
          key
        );
        if (keyNeedsInitialization) {
          if (field.subForm) {
            tempModel[key] = {};
          } else {
            tempModel[key] = field.hasOwnProperty("value")
              ? field.value
              : undefined;
          }
          modelWasModified = true;
        } else if (
          field.subForm &&
          (typeof tempModel[key] !== "object" || tempModel[key] === null)
        ) {
          tempModel[key] = {};
          modelWasModified = true;
        }

        if (field.subForm && Array.isArray(field.fields)) {
          let subFormObject = { ...(tempModel[key] || {}) };
          let subFormItselfChanged = false;
          field.fields.forEach((subField) => {
            if (
              subField.propertyName &&
              !Object.prototype.hasOwnProperty.call(
                subFormObject,
                subField.propertyName
              )
            ) {
              subFormObject[subField.propertyName] = subField.hasOwnProperty(
                "value"
              )
                ? subField.value
                : undefined;
              subFormItselfChanged = true;
            }
          });
          if (subFormItselfChanged) {
            tempModel[key] = subFormObject;
            if (!keyNeedsInitialization) modelWasModified = true;
          }
        }
      }
    });
  }

  if (modelWasModified) {
    modelValue.value = tempModel;
  }
};

// Initialize model immediately with current fields
initializeModel(props.fields);

// Initialize form validation with current fields
const {
  formFieldsValidity,
  formFieldsErrorMessages,
  validateFormPurely,
  formFieldsTouchedState,
  formFieldsDirtyState,
  setFieldTouched,
  checkFieldDirty,
  updateFieldInitialValue,
} = useFormValidation(props.fields);

// Set initial values for dirty checking after model initialization
watch(
  () => modelValue.value,
  (newModelValue, oldModelValue) => {
    if (newModelValue && typeof newModelValue === "object") {
      // Update initial values in the validation composable for each field
      props.fields.forEach((field) => {
        if (
          field.propertyName &&
          newModelValue.hasOwnProperty(field.propertyName)
        ) {
          // If this is the first time we have a real value, update the initial value
          const oldValue =
            oldModelValue && typeof oldModelValue === "object"
              ? oldModelValue[field.propertyName]
              : undefined;
          if (
            oldValue === undefined &&
            newModelValue[field.propertyName] !== undefined
          ) {
            updateFieldInitialValue(
              field.propertyName,
              newModelValue[field.propertyName]
            );
          } else if (
            oldValue !== undefined ||
            newModelValue[field.propertyName] !== undefined
          ) {
            // Check dirty state for any field that has changed
            if (
              JSON.stringify(newModelValue[field.propertyName]) !==
              JSON.stringify(oldValue)
            ) {
              if (
                checkFieldDirty(
                  field.propertyName,
                  newModelValue[field.propertyName]
                )
              ) {
                emit("field:dirty", {
                  propertyName: field.propertyName,
                  dirty: formFieldsDirtyState[field.propertyName],
                });
              }
            }
          }
        }
      });
    }
  },
  { deep: true, immediate: true }
);

// Watch for changes in fields and reinitialize model
watch(
  () => props.fields,
  (newFields) => {
    initializeModel(newFields);
  },
  { deep: true, immediate: false }
);

/**
 * Handles the field-blurred event from PreskoFormItem.
 * Sets the field as touched and emits a field:touched event if the state changed.
 * @param {string} propertyName - The propertyName of the field that was blurred.
 */
const handleFieldBlurred = (propertyName) => {
  if (setFieldTouched(propertyName, true)) {
    emit("field:touched", {
      propertyName,
      touched: formFieldsTouchedState[propertyName],
    });
  }
};

/**
 * Handles events bubbled up from nested PreskoForm instances (sub-forms).
 * @param {string} eventName - The name of the event (e.g., 'field:touched', 'field:dirty').
 * @param {string} subFormKey - The propertyName of the sub-form in the main form's model.
 * @param {Object} eventData - The payload from the sub-form's event.
 */
const handleSubFormEvent = (eventName, subFormKey, eventData) => {
  const fullPropertyName = `${subFormKey}.${eventData.propertyName}`;
  if (eventName === "field:touched") {
    if (setFieldTouched(subFormKey, true)) {
      emit("field:touched", { propertyName: subFormKey, touched: true });
    }
    emit("field:touched", {
      propertyName: fullPropertyName,
      touched: eventData.touched,
    });
  } else if (eventName === "field:dirty") {
    // The parent's watcher on modelValue.value will handle the dirty state for the subFormKey (the object).
    // This emits the more granular sub-field dirty state.
    emit("field:dirty", {
      propertyName: fullPropertyName,
      dirty: eventData.dirty,
    });
  }
};

/**
 * Computed property indicating if any field in the form is dirty.
 * @type {import('vue').ComputedRef<boolean>}
 */
const isFormDirty = computed(() => {
  return Object.values(formFieldsDirtyState).some((state) => state === true);
});

/**
 * Computed property indicating if any field in the form has been touched.
 * @type {import('vue').ComputedRef<boolean>}
 */
const isFormTouched = computed(() => {
  return Object.values(formFieldsTouchedState).some((state) => state === true);
});

/**
 * Handles the form submission process.
 * Marks all fields as touched, validates the form, and emits 'submit' or 'submit:reject'.
 */
const handleFormSubmit = () => {
  if (props.fields && Array.isArray(props.fields)) {
    props.fields.forEach((field) => {
      const key = field.propertyName || field.subForm;
      if (key) {
        if (setFieldTouched(key, true)) {
          emit("field:touched", { propertyName: key, touched: true });
        }
        // Note: Deeply touching fields within sub-forms on parent submit is not yet implemented here.
        // The sub-form itself would handle touching its own fields if it were submitted independently.
      }
    });
  }

  // Trigger validation on sub-forms to ensure they show their own validation errors
  if (subFormRefs.value && subFormRefs.value.length > 0) {
    subFormRefs.value.forEach((subForm) => {
      if (subForm && typeof subForm.handleFormSubmit === "function") {
        subForm.handleFormSubmit();
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

/**
 * Handles the model update for sub-forms.
 * @param {string} subFormKey - The propertyName of the sub-form in the main form's model.
 * @param {Object} newModelValue - The new model value for the sub-form.
 */
const handleSubFormModelUpdate = (subFormKey, newModelValue) => {
  if (typeof modelValue.value === "object" && modelValue.value !== null) {
    // Create a new object to trigger reactivity properly
    const updatedModel = {
      ...modelValue.value,
      [subFormKey]: newModelValue,
    };
    modelValue.value = updatedModel;
    // Also emit the update manually to ensure parent gets notified
    emit("update:modelValue", updatedModel);
  }
};

/**
 * Handles the submit reject event for sub-forms.
 * @param {Object} eventData - The payload from the sub-form's submit reject event.
 */
const handleSubFormSubmitReject = (eventData) => {
  emit("submit:reject", eventData);
};

/**
 * Handles the model update for fields.
 * @param {string} propertyName - The propertyName of the field to be updated.
 * @param {any} value - The new value for the field.
 */
const handleFieldModelUpdate = (propertyName, value) => {
  if (typeof modelValue.value === "object" && modelValue.value !== null) {
    // Create a new object to trigger reactivity properly
    const updatedModel = {
      ...modelValue.value,
      [propertyName]: value,
    };
    modelValue.value = updatedModel;
    // Also emit the update manually to ensure parent gets notified
    emit("update:modelValue", updatedModel);
  }
};

// Expose methods for parent components
defineExpose({
  handleFormSubmit,
});
</script>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
