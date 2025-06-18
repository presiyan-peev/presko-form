<template>
  <div>
    <div role="alert" aria-live="assertive" class="presko-sr-only">
      {{ liveErrorAnnouncement }}
    </div>
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
            <!-- Skip rendering if field is hidden -->
            <template v-if="isFieldVisible(field)">
              <!-- Sub-Form Rendering -->
              <!-- Corrected ref handling for arrays -->
              <PreskoForm
                v-if="field.subForm"
                :ref="(el) => el && subFormRefs.push(el)"
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
                  (eventData) =>
                    handleSubFormEvent(
                      'field:touched',
                      field.subForm,
                      eventData
                    )
                "
                @field:dirty="
                  (eventData) =>
                    handleSubFormEvent('field:dirty', field.subForm, eventData)
                "
                @submit:reject="handleSubFormSubmitReject"
              ></PreskoForm>
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
                <!-- Consider a more robust key if items can be reordered significantly and have unique IDs -->
                <div
                  v-for="(item, index) in modelValue[field.propertyName]"
                  :key="index"
                  class="presko-list-item"
                >
                  <div class="presko-list-item-fields">
                    <PreskoFormItem
                      v-for="listItemField in field.fields"
                      :key="listItemField.propertyName"
                      :ref="
                        (el) => {
                          if (el)
                            formItemRefs[
                              `${field.propertyName}[${index}].${listItemField.propertyName}`
                            ] = el;
                        }
                      "
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
                      :fieldPath="`${field.propertyName}[${index}].${listItemField.propertyName}`"
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
                        () =>
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
                :ref="
                  (el) => {
                    if (el) formItemRefs[field.propertyName] = el;
                  }
                "
                :modelValue="modelValue[field.propertyName]"
                @update:modelValue="
                  (value) => handleFieldModelUpdate(field.propertyName, value)
                "
                :field="field"
                :error-props="props.errorProps"
                :isTouched="formFieldsTouchedState[field.propertyName] || false"
                :isDirty="formFieldsDirtyState[field.propertyName] || false"
                :fieldStateProps="props.fieldStateProps"
                :fieldPath="field.propertyName"
                :validity-state="{
                  hasErrors: formFieldsValidity[field.propertyName] === false,
                  errMsg: formFieldsErrorMessages[field.propertyName],
                }"
                @field-blurred="
                  (emittedPropertyName) =>
                    handleFieldBlurred(emittedPropertyName, field.propertyName)
                "
                @field-input="handleFieldInput"
              ></PreskoFormItem>
            </template>
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
  submitComponent: [String, Object],

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
  /**
   * Automatically focus the first invalid field on submission error.
   * @type {boolean}
   * @default true
   */
  autoFocusOnError: {
    type: Boolean,
    default: true,
  },
  /**
   * Custom function to scroll to the first invalid field.
   * Receives the DOM element of the first invalid field as an argument.
   * If not provided, `element.scrollIntoView()` is used.
   * @type {Function | null}
   * @default null
   */
  scrollToError: {
    type: Function,
    default: null,
  },
  /**
   * Message to be announced by screen readers when a validation error occurs on submit.
   * @type {string}
   * @default "Please correct the highlighted field"
   */
  errorAnnouncement: {
    type: String,
    default: "Please correct the highlighted field",
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
const liveErrorAnnouncement = ref("");
const formItemRefs = ref({}); // To store refs to PreskoFormItem components

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

      let keyNeedsInitialization = !Object.prototype.hasOwnProperty.call(
        tempModel,
        key
      );

      if (field.type === "list") {
        if (keyNeedsInitialization || !Array.isArray(tempModel[key])) {
          tempModel[key] =
            field.initialValue && Array.isArray(field.initialValue)
              ? [...field.initialValue]
              : [];
          modelWasModified = true;
        }
      } else if (field.subForm) {
        if (
          keyNeedsInitialization ||
          typeof tempModel[key] !== "object" ||
          tempModel[key] === null
        ) {
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
          tempModel[key] = field.hasOwnProperty("value")
            ? field.value
            : undefined;
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
  formFieldsValues, // Internal reactive state for values in useFormValidation
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
        if (
          field.propertyName &&
          newModelValue.hasOwnProperty(field.propertyName)
        ) {
          const oldValueForDirtyCheck =
            oldModelValue && typeof oldModelValue === "object"
              ? oldModelValue[field.propertyName]
              : undefined;

          // Update initial value in useFormValidation if this is the first time we get a real value
          if (
            updateFieldInitialValue &&
            oldValueForDirtyCheck === undefined &&
            newModelValue[field.propertyName] !== undefined
          ) {
            updateFieldInitialValue(
              field.propertyName,
              newModelValue[field.propertyName]
            );
          }

          // Check and emit dirty state
          if (
            checkFieldDirty &&
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
    if (setFieldTouched(subFormKey, true)) {
      // Mark the sub-form container as touched
      emit("field:touched", { propertyName: subFormKey, touched: true });
    }
    emit("field:touched", {
      // Relay the granular event
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
      if (key) {
        // Ensure key exists
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

  liveErrorAnnouncement.value = ""; // Clear previous error messages

  if (isValid) {
    // Build object that only includes visible/configured fields
    const buildSubmittable = (currentModel, currentFields) => {
      const result = {};
      currentFields.forEach((fld) => {
        if (!isFieldVisible(fld)) return;

        if (fld.type === "list" && fld.propertyName) {
          if (Array.isArray(currentModel[fld.propertyName])) {
            result[fld.propertyName] = currentModel[fld.propertyName].map(
              (item) => {
                const itemObj = {};
                if (Array.isArray(fld.fields)) {
                  fld.fields.forEach((subF) => {
                    if (!isFieldVisible(subF)) return;
                    itemObj[subF.propertyName] = item[subF.propertyName];
                  });
                }
                return itemObj;
              }
            );
          }
        } else if (fld.subForm && fld.fields) {
          const subVal = currentModel[fld.subForm] || {};
          const subResult = buildSubmittable(subVal, fld.fields);
          if (Object.keys(subResult).length) {
            result[fld.subForm] = subResult;
          }
        } else if (fld.propertyName) {
          result[fld.propertyName] = currentModel[fld.propertyName];
        }
      });
      return result;
    };

    const cleanData = buildSubmittable(modelValue.value, props.fields);
    emit("submit", JSON.parse(JSON.stringify(cleanData)));
  } else {
    let firstInvalidPath = null;
    let firstInvalidEl = null;

    // Flatten fields to respect defined order, including list items
    const fieldsToIterate = [];
    if (props.fields && Array.isArray(props.fields)) {
      props.fields.forEach((field) => {
        // Skip non-visible top-level fields early
        if (!isFieldVisible(field)) return;

        if (field.propertyName) {
          fieldsToIterate.push({ path: field.propertyName, fieldDef: field });
        } else if (
          field.type === "list" &&
          field.propertyName &&
          Array.isArray(modelValue.value[field.propertyName])
        ) {
          modelValue.value[field.propertyName].forEach((_item, i) => {
            if (Array.isArray(field.fields)) {
              field.fields.forEach((listItemField) => {
                // Skip non-visible list item fields
                if (!isFieldVisible(listItemField)) return;
                fieldsToIterate.push({
                  path: `${field.propertyName}[${i}].${listItemField.propertyName}`,
                  fieldDef: listItemField,
                });
              });
            }
          });
        } else if (field.subForm) {
          // Add subform itself for potential direct errors on the subform object
          fieldsToIterate.push({
            path: field.subForm,
            fieldDef: field,
            isSubFormContainer: true,
          });
        }
      });
    }

    for (const { path, fieldDef, isSubFormContainer } of fieldsToIterate) {
      if (formFieldsValidity[path] === false) {
        firstInvalidPath = path;
        if (!isSubFormContainer) {
          const itemRef = formItemRefs.value[path];
          firstInvalidEl = itemRef?.$el || itemRef;
        }
        // else for isSubFormContainer, firstInvalidEl remains null, sub-form handles its own focus.
        break;
      }
    }

    // This secondary check for subForm errors is more of a fallback,
    // if the primary iteration didn't catch a subForm container marked invalid.
    if (!firstInvalidPath && props.fields && Array.isArray(props.fields)) {
      for (const field of props.fields) {
        if (
          field.subForm &&
          isFieldVisible(field) &&
          formFieldsValidity[field.subForm] === false
        ) {
          firstInvalidPath = field.subForm;
          // firstInvalidEl will remain null as we expect sub-form to handle its internal focus
          break;
        }
      }
    }

    emit("submit:reject", { firstInvalidPath, firstInvalidEl });
    liveErrorAnnouncement.value = props.errorAnnouncement;

    // firstInvalidEl is expected to be the PreskoFormItem's root DOM element here,
    // obtained from itemRef.$el. Let's rename it for clarity in this block.
    const formItemElement = firstInvalidEl;

    if (formItemElement) {
      // Scroll logic should target the PreskoFormItem's root element.
      if (typeof props.scrollToError === "function") {
        props.scrollToError(formItemElement);
      } else if (typeof formItemElement.scrollIntoView === "function") {
        formItemElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }

      if (props.autoFocusOnError) {
        let focusableElementToTarget = null;
        const preskoItemInstance = formItemRefs.value[firstInvalidPath];

        if (
          preskoItemInstance &&
          typeof preskoItemInstance.interactiveElement !== "undefined"
        ) {
          // interactiveElement is a computed ref, so access its .value
          // and ensure it's not null before attempting to use it.
          const exposedInteractiveElement =
            preskoItemInstance.interactiveElement;
          if (exposedInteractiveElement) {
            focusableElementToTarget = exposedInteractiveElement;
          }
        }

        // Fallback if PreskoFormItem doesn't expose interactiveElement or it's null
        if (!focusableElementToTarget && formItemElement.querySelector) {
          focusableElementToTarget = formItemElement.querySelector(
            'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
          );
        } else if (
          !focusableElementToTarget &&
          typeof formItemElement.focus === "function" &&
          !formItemElement.disabled
        ) {
          // If the formItemElement itself is focusable (e.g. if it were an input directly, though it's a div)
          focusableElementToTarget = formItemElement;
        }

        if (
          focusableElementToTarget &&
          typeof focusableElementToTarget.focus === "function"
        ) {
          setTimeout(() => {
            try {
              focusableElementToTarget.focus();
            } catch (e) {
              // console.error("Focus failed:", e);
            }
          }, 50);
        }
      }
    }
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

/**
 * Handles adding a new item to a list field.
 * @param {string} listPropertyName - The propertyName of the list field.
 */
const handleAddItem = (listPropertyName) => {
  const listFieldConfig = props.fields.find(
    (f) => f.propertyName === listPropertyName && f.type === "list"
  );
  if (!listFieldConfig) return;

  let newItemInitialData = {};
  if (
    listFieldConfig.defaultValue &&
    typeof listFieldConfig.defaultValue === "object"
  ) {
    newItemInitialData = JSON.parse(
      JSON.stringify(listFieldConfig.defaultValue)
    );
  } else if (Array.isArray(listFieldConfig.fields)) {
    listFieldConfig.fields.forEach((subField) => {
      if (subField.propertyName) {
        newItemInitialData[subField.propertyName] = subField.hasOwnProperty(
          "value"
        )
          ? subField.value
          : undefined;
      }
    });
  }

  const currentList = modelValue.value[listPropertyName] || [];
  const newList = [...currentList, newItemInitialData];
  const updatedModel = { ...modelValue.value, [listPropertyName]: newList };
  modelValue.value = updatedModel;
  emit("update:modelValue", updatedModel);
};

/**
 * Handles removing an item from a list field.
 * @param {string} listPropertyName - The propertyName of the list field.
 * @param {number} index - The index of the item to remove.
 */
const handleRemoveItem = (listPropertyName, index) => {
  const currentList = modelValue.value[listPropertyName] || [];
  if (index < 0 || index >= currentList.length) return;

  const newList = currentList.filter((_, i) => i !== index);
  const updatedModel = { ...modelValue.value, [listPropertyName]: newList };
  modelValue.value = updatedModel;
  emit("update:modelValue", updatedModel);
};

/**
 * Handles updates to the model value of a field within a list item.
 * @param {string} listName - The propertyName of the list field.
 * @param {number} itemIndex - The index of the item in the list.
 * @param {string} itemFieldName - The propertyName of the field within the list item.
 * @param {any} value - The new value for the field.
 */
const handleListItemFieldModelUpdate = (
  listName,
  itemIndex,
  itemFieldName,
  value
) => {
  if (
    typeof modelValue.value === "object" &&
    modelValue.value !== null &&
    modelValue.value[listName] &&
    Array.isArray(modelValue.value[listName]) &&
    modelValue.value[listName][itemIndex] !== undefined
  ) {
    const newList = [...modelValue.value[listName]];
    const newItem = { ...newList[itemIndex], [itemFieldName]: value };
    newList[itemIndex] = newItem;
    const newMainModel = { ...modelValue.value, [listName]: newList };
    modelValue.value = newMainModel;
    emit("update:modelValue", newMainModel);
  }
};

/**
 * Handles the blur event for a field within a list item.
 * @param {string} listName - The propertyName of the list field.
 * @param {number} itemIndex - The index of the item in the list.
 * @param {string} itemFieldName - The propertyName of the field within the list item.
 */
const handleListItemFieldBlurred = (listName, itemIndex, itemFieldName) => {
  const fullPath = `${listName}[${itemIndex}].${itemFieldName}`;
  const touchedChanged = setFieldTouched(fullPath, true);
  if (touchedChanged) {
    emit("field:touched", {
      propertyName: fullPath,
      touched: formFieldsTouchedState[fullPath],
    });
  }
  if (typeof triggerValidation === "function") {
    triggerValidation(fullPath, "blur", modelValue.value);
  }
};

/**
 * Utility to evaluate a field's `isShowing` property which can be:
 *  - undefined (default visible)
 *  - boolean
 *  - a ref<boolean>
 *  - a function returning boolean
 */
const isFieldVisible = (field) => {
  const flag = field.isShowing;
  if (flag === undefined) return true;
  if (typeof flag === "boolean") return flag;
  if (typeof flag === "function") return !!flag();
  // Handle Vue ref
  if (flag && typeof flag === "object" && "value" in flag) return !!flag.value;
  return !!flag;
};

// Expose methods for parent components, e.g., for programmatic submission.
defineExpose({
  submit: handleFormSubmit,
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
.read-the-docs {
  /* From original scaffold, can be removed if not used */
  color: #888;
}
.presko-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
