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
      v-if="field.showErrorMessage !== false && validityState && validityState.hasErrors && validityState.errMsg"
      class="presko-error-message"
    >
      {{ Array.isArray(validityState.errMsg) ? validityState.errMsg.join(', ') : validityState.errMsg }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

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
]);

/**
 * Computed property for v-model binding on the dynamic child component.
 * Gets the current value from `props.modelValue` and emits `update:modelValue` on set.
 * @type {import('vue').WritableComputedRef<any>}
 */
const model = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
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
    [props.errorProps.errorMessages || 'errorMessages']: props.validityState.hasErrors ? props.validityState.errMsg : undefined,
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
};

/**
 * Handles the update:modelValue event from the child component.
 * This is primarily to allow the `v-model="model"` on the dynamic component to work.
 * The computed `model` setter already emits 'update:modelValue' to the parent.
 * @param {any} value - The new value from the child component.
 */
const handleModelValueUpdate = (value) => {
  // This is implicitly handled by `v-model="model"` which uses the computed `model`
  // The setter of `model` emits 'update:modelValue' to PreskoForm.
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
