<template>
  <div class="presko-form-item">
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
      v-if="field.showErrorMessage !== false && validityState && validityState.hasErrors && validityState.errMsg && showVisualError"
      class="presko-error-message"
    >
      {{ Array.isArray(validityState.errMsg) ? validityState.errMsg.join(', ') : validityState.errMsg }}
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';

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
      isTouched: 'touched',
      isDirty: 'dirty',
    }),
  },
});

const emit = defineEmits([
    /**
     * Emitted to update the parent's v-model when the field value changes.
     * @param {any} modelValue - The new value of the field.
     */
    'update:modelValue',
    /**
     * Emitted when the field loses focus (blur event).
     * @param {string} propertyName - The propertyName of the blurred field.
     */
    'field-blurred',
    /**
     * Emitted when the field's value changes due to user input.
     * This is typically used to signal the parent form to trigger 'onInput' validation.
     * @param {string} propertyName - The propertyName of the field that received input.
     */
    'field-input',
]);

/**
 * Controls whether the error message is visually displayed.
 * It's set to `false` when the user starts typing while an error is visible,
 * and reset to `true` when the error state changes.
 * @type {import('vue').Ref<boolean>}
 */
const showVisualError = ref(true);

/**
 * Computed property for v-model binding on the dynamic child component.
 * Gets the current value from `props.modelValue`.
 * On set, it emits `update:modelValue` to the parent (for v-model functionality),
 * emits `field-input` to signal parent form about the input,
 * and hides the current error message visually if one was present.
 * @type {import('vue').WritableComputedRef<any>}
 */
const model = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:modelValue', value);

    if (props.field && props.field.propertyName) {
      emit('field-input', props.field.propertyName);
    }

    // If an error was being shown, hide it on input
    if (props.validityState.hasErrors) {
      showVisualError.value = false;
    }
  },
});

/**
 * Watches for changes in `props.validityState.hasErrors`.
 * When `hasErrors` changes (e.g., a new validation result comes in, or errors are cleared),
 * `showVisualError` is reset to `true`. This ensures that any new error messages
 * are immediately visible, and the visual state is reset if the field becomes valid.
 */
watch(() => props.validityState.hasErrors, (newHasErrors, oldHasErrors) => {
  // Always reset to true when hasErrors changes.
  // If newHasErrors is true, the error should be shown.
  // If newHasErrors is false, this resets the state for any future errors.
  showVisualError.value = true;
});


/**
 * Computes the target prop name for the 'isTouched' state based on `props.fieldStateProps`.
 * @type {import('vue').ComputedRef<string>}
 */
const mappedTouchedPropName = computed(() => props.fieldStateProps?.isTouched || 'touched');
/**
 * Computes the target prop name for the 'isDirty' state based on `props.fieldStateProps`.
 * @type {import('vue').ComputedRef<string>}
 */
const mappedDirtyPropName = computed(() => props.fieldStateProps?.isDirty || 'dirty');

/**
 * Computes a combined object of props to be passed to the dynamic child component.
 * This includes custom props from `field.props`, error state props, and field interaction state props.
 * @type {import('vue').ComputedRef<object>}
 */
const combinedProps = computed(() => {
  const errorState = {
    [props.errorProps.hasErrors || 'error']: props.validityState.hasErrors,
    // Only pass error messages if they should be visually shown (relevant for child components that might also display errors)
    [props.errorProps.errorMessages || 'errorMessages']: props.validityState.hasErrors && showVisualError.value ? props.validityState.errMsg : undefined,
  };

  const fieldInteractionState = {
    [mappedTouchedPropName.value]: props.isTouched,
    [mappedDirtyPropName.value]: props.isDirty,
  };

  return {
    ...props.field.props,
    ...errorState,
    ...fieldInteractionState,
  };
});

/**
 * Handles the blur event from the child component.
 * Emits a 'field-blurred' event with the field's propertyName.
 */
const handleBlur = () => {
  if (props.field && props.field.propertyName) {
    emit('field-blurred', props.field.propertyName);
  }
  // When the field is blurred, if there was an error that was hidden due to typing,
  // we should make it visible again, as blur often triggers validation.
  // The watcher on `props.validityState.hasErrors` will also set this to true
  // if validation on blur changes `hasErrors`. This ensures it becomes visible
  // if `hasErrors` was already true and didn't change.
  if (props.validityState.hasErrors) {
     showVisualError.value = true;
  }
};

/**
 * Handles the update:modelValue event from the child component.
 * The primary logic for emitting 'update:modelValue' to the parent,
 * emitting 'field-input', and managing `showVisualError` on input
 * is centralized in the setter of the `model` computed property.
 * This function is called by the `@update:modelValue` listener on the dynamic component
 * which triggers the `model` computed property's setter.
 * @param {any} _value - The new value from the child component (unused here as logic is in `model` setter).
 */
const handleModelValueUpdate = (_value) => {
  // Logic is handled by the `model` computed property's setter.
  // This function's presence ensures the @update:modelValue listener is set up,
  // which in turn triggers the `model` setter.
};

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
