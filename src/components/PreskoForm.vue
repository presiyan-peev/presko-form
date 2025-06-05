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
              :validation-trigger="props.validationTrigger"
              :input-debounce-ms="props.inputDebounceMs"
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
              @field-input="handleFieldInput"
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

  /**
   * Determines when validation should be triggered for a field.
   * - 'onSubmit': Validation occurs only when the form is submitted.
   * - 'onBlur': Validation occurs when a field loses focus (blur event) and on submit.
   * - 'onInput': Validation occurs as the user types (debounced) in a field, on blur, and on submit.
   * @type {'onSubmit' | 'onBlur' | 'onInput'}
   * @default 'onBlur'
   */
  validationTrigger: {
    type: String,
    default: "onBlur",
    validator: (value) => ["onSubmit", "onBlur", "onInput"].includes(value),
  },

  /**
   * Debounce time in milliseconds for 'onInput' validation.
   * This is only applicable when `validationTrigger` is set to 'onInput'.
   * @type {number}
   * @default 100
   */
  inputDebounceMs: {
    type: Number,
    default: 100,
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
 * Initializes the model with fields' default values if they are not already present.
 * This function is called reactively when the `fields` prop changes.
 */
const initializeModel = (fieldsToInit) => {
  if (typeof modelValue.value !== "object" || modelValue.value === null) {
    modelValue.value = {}; // Ensure modelValue is an object
  }

  let tempModel = { ...modelValue.value };
  let modelWasModified = false;

  if (fieldsToInit && Array.isArray(fieldsToInit)) {
    fieldsToInit.forEach((field) => {
      const key = field.propertyName || field.subForm;
      if (!key) return;

      let keyNeedsInitialization = !Object.prototype.hasOwnProperty.call(tempModel, key);

      if (field.subForm) {
        if (keyNeedsInitialization || typeof tempModel[key] !== "object" || tempModel[key] === null) {
          tempModel[key] = {};
          modelWasModified = true;
        }
        // Recursively initialize sub-form fields if they are defined
        if (Array.isArray(field.fields)) {
          // This part is tricky if sub-model was modified. For simplicity,
          // we assume sub-form initialization happens primarily if key itself was missing.
          // Deeper merge or more complex init might be needed for all edge cases.
          // The useFormValidation's init is more comprehensive for its own state.
        }
      } else if (field.propertyName) {
        if (keyNeedsInitialization) {
          tempModel[key] = field.hasOwnProperty("value") ? field.value : undefined;
          modelWasModified = true;
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

// Initialize form validation composable
const {
  formFieldsValidity,
  formFieldsErrorMessages,
  validateFormPurely,
  formFieldsTouchedState,
  formFieldsDirtyState,
  setFieldTouched,
  checkFieldDirty,
  updateFieldInitialValue,
  triggerValidation,
} = useFormValidation(props.fields, {
  validationTrigger: props.validationTrigger,
  inputDebounceMs: props.inputDebounceMs,
});

// Watch for changes in the modelValue to update initial values for dirty checking
// and to check dirty state on subsequent changes.
watch(
  () => modelValue.value,
  (newModelValue, oldModelValue) => {
    if (newModelValue && typeof newModelValue === "object") {
      props.fields.forEach((field) => {
        if (field.propertyName && newModelValue.hasOwnProperty(field.propertyName)) {
          const oldValueForDirtyCheck = oldModelValue && typeof oldModelValue === "object"
            ? oldModelValue[field.propertyName]
            : undefined;

          // Update initial value in useFormValidation if this is the first time we get a real value
          if (updateFieldInitialValue && oldValueForDirtyCheck === undefined && newModelValue[field.propertyName] !== undefined) {
            updateFieldInitialValue(field.propertyName, newModelValue[field.propertyName]);
          }

          // Check and emit dirty state
          if (checkFieldDirty && checkFieldDirty(field.propertyName, newModelValue[field.propertyName])) {
            emit("field:dirty", {
              propertyName: field.propertyName,
              dirty: formFieldsDirtyState[field.propertyName],
            });
          }
        }
        // Similar logic for sub-forms could be added here if needed,
        // though sub-forms manage their own dirty state internally.
      });
    }
  },
  { deep: true, immediate: true }
);

// Watch for changes in the `fields` prop to re-initialize the model if fields are dynamically changed.
watch(
  () => props.fields,
  (newFields) => {
    initializeModel(newFields);
    // Note: useFormValidation might need to be re-initialized or made reactive to `fields`
    // if the entire field structure changes significantly post-setup.
    // The current setup primarily initializes based on the initial `fields` prop.
  },
  { deep: true } // `immediate: false` is default for watch, which is fine here.
);

/**
 * Handles the `field-blurred` event from a `PreskoFormItem`.
 * Sets the field as touched and triggers validation for the 'blur' event type.
 * Emits a `field:touched` event if the field's touched state changed.
 * @param {string} propertyName - The `propertyName` of the field that was blurred.
 */
const handleFieldBlurred = (propertyName) => {
  const touchedChanged = setFieldTouched(propertyName, true);
  if (touchedChanged) {
    emit("field:touched", {
      propertyName,
      touched: formFieldsTouchedState[propertyName], // Emit the reactive state
    });
  }
  if (typeof triggerValidation === "function") {
    triggerValidation(propertyName, "blur", modelValue.value);
  }
};

/**
 * Handles the `field-input` event from a `PreskoFormItem`.
 * Triggers validation for the 'input' event type for the specified field.
 * @param {string} propertyName - The `propertyName` of the field that received input.
 */
const handleFieldInput = (propertyName) => {
  if (typeof triggerValidation === "function") {
    triggerValidation(propertyName, "input", modelValue.value);
  }
};

/**
 * Handles events bubbled up from nested `PreskoForm` instances (sub-forms).
 * It relays `field:touched` and `field:dirty` events with prefixed property names.
 * It also marks the sub-form container itself as touched when a nested field is touched.
 * @param {'field:touched' | 'field:dirty'} eventName - The name of the event.
 * @param {string} subFormKey - The `propertyName` of the sub-form in the main form's model.
 * @param {object} eventData - The payload from the sub-form's event.
 * @param {string} eventData.propertyName - The `propertyName` of the field within the sub-form.
 * @param {boolean} eventData.touched - The new touched state (for 'field:touched').
 * @param {boolean} eventData.dirty - The new dirty state (for 'field:dirty').
 */
const handleSubFormEvent = (eventName, subFormKey, eventData) => {
  const fullPropertyName = `${subFormKey}.${eventData.propertyName}`;
  if (eventName === "field:touched") {
    if (setFieldTouched(subFormKey, true)) { // Mark the sub-form container as touched
      emit("field:touched", { propertyName: subFormKey, touched: true });
    }
    emit("field:touched", { // Relay the granular event
      propertyName: fullPropertyName,
      touched: eventData.touched,
    });
  } else if (eventName === "field:dirty") {
     // For sub-form dirty state, PreskoForm primarily relies on changes to its modelValue.
     // However, emitting granular dirty events can be useful for consumers.
     // The sub-form container's dirty state is managed by `checkFieldDirty` on `modelValue.value` changes.
    emit("field:dirty", {
      propertyName: fullPropertyName,
      dirty: eventData.dirty,
    });
  }
};

/**
 * Computed property indicating if any field in the form (including sub-form containers) is dirty.
 * @type {import('vue').ComputedRef<boolean>}
 */
const isFormDirty = computed(() => {
  return Object.values(formFieldsDirtyState).some((state) => state === true);
});

/**
 * Computed property indicating if any field in the form (including sub-form containers) has been touched.
 * @type {import('vue').ComputedRef<boolean>}
 */
const isFormTouched = computed(() => {
  return Object.values(formFieldsTouchedState).some((state) => state === true);
});

/**
 * Handles the form submission process.
 * Marks all direct fields and sub-form containers of this form instance as touched.
 * Calls `handleFormSubmit` on any sub-forms to trigger their own validation and field touching.
 * Then, validates the current form's entire model using `validateFormPurely`.
 * Emits 'submit' with the deep cloned form data if valid, or 'submit:reject' if invalid.
 */
const handleFormSubmit = () => {
  // Mark all fields (including sub-form containers) of this form instance as touched.
  if (props.fields && Array.isArray(props.fields)) {
    props.fields.forEach((field) => {
      const key = field.propertyName || field.subForm;
      if (key) { // Ensure key exists
        if (setFieldTouched(key, true)) {
          emit("field:touched", {
            propertyName: key,
            touched: formFieldsTouchedState[key], // Emit current reactive state
          });
        }
      }
    });
  }

  // Trigger submit on sub-forms. They will manage their own fields' touched state and validation.
  if (subFormRefs.value && subFormRefs.value.length > 0) {
    subFormRefs.value.forEach((subForm) => {
      if (subForm && typeof subForm.handleFormSubmit === "function") {
        subForm.handleFormSubmit();
      }
    });
  }

  // Validate the entire current form's model.
  const isValid = validateFormPurely(modelValue.value);

  if (isValid) {
    emit("submit", JSON.parse(JSON.stringify(modelValue.value)));
  } else {
    emit("submit:reject");
  }
};

/**
 * Handles updates to the model value of a sub-form.
 * @param {string} subFormKey - The `propertyName` of the sub-form in the main form's model.
 * @param {Object} newSubFormModelValue - The new model value for the sub-form.
 */
const handleSubFormModelUpdate = (subFormKey, newSubFormModelValue) => {
  if (typeof modelValue.value === "object" && modelValue.value !== null) {
    const updatedModel = {
      ...modelValue.value,
      [subFormKey]: newSubFormModelValue,
    };
    modelValue.value = updatedModel; // Update local model
    // Emit update for v-model binding on PreskoForm itself
    // This was previously missing, could be important for parent component if it directly watches modelValue changes.
    emit("update:modelValue", updatedModel);
  }
};

/**
 * Handles the `submit:reject` event bubbled up from a sub-form.
 * Relays the `submit:reject` event to the parent of this `PreskoForm` instance.
 * @param {Object} [eventData] - Optional payload from the sub-form's `submit:reject` event.
 */
const handleSubFormSubmitReject = (eventData) => {
  emit("submit:reject", eventData); // Relay the event
};

/**
 * Handles updates to the model value of a direct field within this form.
 * @param {string} propertyName - The `propertyName` of the field to be updated.
 * @param {any} value - The new value for the field.
 */
const handleFieldModelUpdate = (propertyName, value) => {
  if (typeof modelValue.value === "object" && modelValue.value !== null) {
    const updatedModel = {
      ...modelValue.value,
      [propertyName]: value,
    };
    modelValue.value = updatedModel; // Update local model
     // Emit update for v-model binding on PreskoForm itself
    emit("update:modelValue", updatedModel);
  }
};

// Expose methods for parent components, e.g., for programmatic submission.
defineExpose({
  handleFormSubmit,
});
</script>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
