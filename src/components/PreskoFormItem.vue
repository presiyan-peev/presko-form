<template>
  <div class="presko-form-item" v-if="field.isShowing !== false">
    <component
      :is="field.component"
      v-if="field.component"
      v-model="model"
      class="presko-form-field"
      v-bind="combinedProps"
      @blur="handleBlur"
      @update:modelValue="handleModelValueUpdate"
    />
    <div
      v-if="
        field.showErrorMessage !== false &&
        validityState &&
        validityState.hasErrors &&
        validityState.errMsg &&
        showVisualError
      "
      class="presko-error-message"
    >
      {{
        Array.isArray(validityState.errMsg)
          ? validityState.errMsg.join(", ")
          : validityState.errMsg
      }}
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";

/**
 * @typedef {Object} FieldConfigMinimal
 * @property {string} component - The name of the component to render for this field.
 * @property {string} [propertyName] - The name of the property this field is bound to in the form model.
 * @property {Object} [props] - Additional props to pass to the rendered component.
 * @property {boolean} [showErrorMessage=true] - Whether to show error messages below the field.
 */

/**
 * @typedef {Object} ValidityState
 * @property {boolean} hasErrors - Whether the field currently has validation errors.
 * @property {string|string[]|undefined} errMsg - The error message(s) if any.
 */

/**
 * @typedef {Object} ErrorPropsConfig
 * @property {string} hasErrors - The prop name to pass the error status (boolean) to the child component.
 * @property {string} errorMessages - The prop name to pass the error message(s) to the child component.
 */

/**
 * @typedef {Object} FieldStatePropsConfig
 * @property {string} isTouched - The prop name to pass the touched status (boolean) to the child component.
 * @property {string} isDirty - The prop name to pass the dirty status (boolean) to the child component.
 */

const props = defineProps({
  /**
   * Configuration object for the field to be rendered.
   * @type {FieldConfigMinimal}
   * @required
   */
  field: {
    type: Object,
    required: true,
  },
  /**
   * The current value of the field, used for v-model binding.
   * @type {any}
   */
  modelValue: {
    // Type can be any, depending on the field
  },
  /**
   * Object representing the current validation state of the field.
   * @type {ValidityState}
   * @default { hasErrors: false, errMsg: undefined }
   */
  validityState: {
    type: Object,
    default: () => ({ hasErrors: false, errMsg: undefined }),
  },
  /**
   * Configuration for mapping error state to props on the child component.
   * @type {ErrorPropsConfig}
   * @default { hasErrors: "error", errorMessages: "errorMessages" }
   */
  errorProps: {
    type: Object,
    default: () => ({
      hasErrors: "error",
      errorMessages: "errorMessages",
    }),
  },
  /**
   * The touched state of the field.
   * @type {boolean}
   * @default false
   */
  isTouched: {
    type: Boolean,
    default: false,
  },
  /**
   * The dirty state of the field.
   * @type {boolean}
   * @default false
   */
  isDirty: {
    type: Boolean,
    default: false,
  },
  /**
   * Configuration for mapping touched and dirty states to props on the child component.
   * @type {FieldStatePropsConfig}
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
   * Emitted to update the parent's v-model when the field value changes.
   * @param {any} modelValue - The new value of the field.
   */
  "update:modelValue",
  /**
   * Emitted when the field loses focus (blur event).
   * @param {string} propertyName - The propertyName of the blurred field.
   */
  "field-blurred",
  /**
   * Emitted when the field's value changes due to user input.
   * This is typically used to signal the parent form to trigger 'onInput' validation.
   * @param {string} propertyName - The propertyName of the field that received input.
   */
  "field-input",
]);

/**
 * Controls whether the error message is visually displayed.
 * It's set to `true` when the field is touched or dirty, and there are validation errors.
 * @type {boolean}
 */
const showVisualError = computed(() => {
  return (props.isTouched || props.isDirty) && props.validityState.hasErrors;
});

/**
 * The current value of the field, used for v-model binding.
 * @type {any}
 */
const model = ref(props.modelValue);

/**
 * Combined props to be passed to the child component.
 * @type {Object}
 */
const combinedProps = computed(() => {
  return {
    ...props.field.props,
    [props.errorProps.hasErrors]: props.validityState.hasErrors,
    [props.errorProps.errorMessages]: props.validityState.errMsg,
    [props.fieldStateProps.isTouched]: props.isTouched,
    [props.fieldStateProps.isDirty]: props.isDirty,
  };
});

/**
 * Handles the blur event on the child component.
 * @param {Event} event - The blur event.
 */
function handleBlur(event) {
  emit("field-blurred", props.field.propertyName);
}

/**
 * Handles the update:modelValue event on the child component.
 * @param {any} value - The new value of the field.
 */
function handleModelValueUpdate(value) {
  model.value = value;
  emit("update:modelValue", value);
  emit("field-input", props.field.propertyName);
}

/**
 * Watch for changes to the modelValue prop and update the local model value.
 */
watch(
  () => props.modelValue,
  (newValue) => {
    model.value = newValue;
  }
);
</script>

<style scoped>
.presko-form-item {
  margin-bottom: 1rem;
}
.presko-error-message {
  color: red;
  font-size: 0.875em;
  margin-top: 0.25rem;
}
</style>
