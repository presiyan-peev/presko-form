import { reactive, toRaw } from "vue"; // Added toRaw for accessing raw values if needed
import Validation from "../validation";

/**
 * @typedef {Object} FieldConfig
 * @property {string} propertyName - The key used to identify the field in the model and state objects.
 * @property {any} [value] - The initial value of the field.
 * @property {string} [label] - A human-readable label for the field, used in error messages.
 * @property {Object} [props] - Additional props to pass to the field's component; `props.label` can also be used for error messages.
 * @property {Array<string|Object|RegExp>} [rules] - An array of validation rules.
 * @property {Array<Function>} [validators] - An array of custom validator functions.
 * @property {Array<FieldConfig>} [fields] - If this field represents a sub-form, this contains its field configurations. Used for recursive processing.
 * @property {string} [subForm] - If this field configuration object represents a sub-form container, this is its key in the parent model.
 */

/**
 * @typedef {Object} UseFormValidationOptions
 * @property {'onSubmit' | 'onBlur' | 'onInput'} [validationTrigger='onBlur'] - Defines when validation logic is triggered for fields.
 *   - 'onSubmit': Validation runs only when the entire form is submitted.
 *   - 'onBlur': Validation runs when a field loses focus (blur event) and on form submit.
 *   - 'onInput': Validation runs as the user types into a field (debounced), on blur, and on form submit.
 * @property {number} [inputDebounceMs=100] - Debounce time in milliseconds for 'onInput' validation.
 *   This helps prevent excessive validation calls while the user is actively typing.
 */

/**
 * Composable for managing form validation, field values, and interaction states (touched, dirty).
 * It is designed to work with a form structure defined by an array of `FieldConfig` objects,
 * supporting both flat field layouts and nested sub-forms.
 *
 * @param {Array<FieldConfig>} fields - An array of field configuration objects that define the form structure.
 *   Each object describes a field or a sub-form container.
 * @param {UseFormValidationOptions} [options] - Options to configure validation behavior, such as trigger type and debounce time.
 * @returns {Object} An object containing reactive states for form data and validation, along with methods to manage the form.
 * @property {Object<string, any>} formFieldsValues - Reactive object intended to hold the current values of form fields.
 *   Note: In integration with `PreskoForm`, the primary model is managed by `PreskoForm`'s `v-model`. This internal state
 *   is used for consistency if `useFormValidation` needs direct access to values, but `currentFormModel` passed to functions like
 *   `triggerValidation` or `validateFormPurely` should be the source of truth from the parent component.
 * @property {Object<string, boolean|undefined>} formFieldsValidity - Reactive object storing the validity state of each field.
 *   `false` if invalid, `undefined` if valid or not yet validated. Field names are used as keys.
 * @property {Object<string, string|string[]|undefined>} formFieldsErrorMessages - Reactive object holding error messages for invalid fields.
 *   Messages can be a single string or an array of strings. Field names are used as keys.
 * @property {Object<string, boolean>} formFieldsTouchedState - Reactive object tracking the touched state of each field.
 *   `true` if the field has been interacted with (e.g., blurred). Field names are used as keys.
 * @property {Object<string, boolean>} formFieldsDirtyState - Reactive object tracking the dirty state of each field (whether its value has changed from its initial value).
 *   `true` if the field's value has changed. Field names are used as keys.
 * @property {Function} validateField - Validates a single field's value against its configured rules and updates reactive validation states.
 * @property {Function} validateFormPurely - Validates a provided data object (representing the entire form's current model) against all field configurations.
 *   This is typically used for form submission. Updates reactive validation states.
 * @property {Function} setFieldTouched - Sets the touched state of a specified field.
 * @property {Function} checkFieldDirty - Checks if a field's current value differs from its initial value and updates its dirty state.
 * @property {Function} updateFieldInitialValue - Updates the stored initial value of a field, used as a baseline for dirty checking.
 * @property {Function} triggerValidation - Triggers validation for a specific field based on an event type (e.g., 'input', 'blur'),
 *   respecting configured validation triggers and debounce settings.
 * @property {Function} resetValidationState - Resets the validation state (validity and error messages) for a specific field or all fields if no field name is provided.
 */
export function useFormValidation(fields, options = {}) {
  const {
    validationTrigger = "onBlur",
    inputDebounceMs = 100,
  } = options;

  /** @type {Object<string, any>} */
  let formFieldsValues = reactive({});
  /** @type {Object<string, boolean|undefined>} */
  let formFieldsValidity = reactive({});
  /** @type {Object<string, string|string[]|undefined>} */
  let formFieldsErrorMessages = reactive({});
  /** @type {Object<string, boolean>} */
  let formFieldsTouchedState = reactive({});
  /** @type {Object<string, boolean>} */
  let formFieldsDirtyState = reactive({});
  /** @type {Object<string, any>} */
  let initialFormFieldsValues = {}; // Stores initial values for dirty checking
  /** @type {Object<string, number>} */
  const debounceTimers = {}; // Stores setTimeout IDs for debouncing input validation

  /**
   * Gets the display label for a field.
   * Prioritizes `field.label`, then `field.props.label`, then falls back to `field.propertyName`.
   * @private
   * @param {FieldConfig} field - The field configuration object.
   * @returns {string} The resolved label for the field.
   */
  const getFieldLabel = (field) => {
    return (
      field.label || (field.props && field.props.label) || field.propertyName || ""
    );
  };

  /**
   * Recursively initializes reactive states (values, validity, errors, touched, dirty)
   * for all fields and sub-form fields based on their configuration.
   * @private
   * @param {Array<FieldConfig>} currentFields - The array of field configurations to process.
   * @param {Object<string, any>} initialValuesContainer - The object to populate with initial field values for dirty checking.
   * @param {Object<string, any>} currentValuesContainer - The reactive object to populate with current field values.
   */
  const initializeStatesRecursive = (currentFields, initialValuesContainer, currentValuesContainer) => {
    if (currentFields && Array.isArray(currentFields)) {
      currentFields.forEach((field) => {
        const key = field.propertyName || field.subForm;
        if (!key) return;

        if (field.subForm && field.fields) {
          initialValuesContainer[key] = {};
          currentValuesContainer[key] = reactive({});
          formFieldsTouchedState[key] = false;
          formFieldsDirtyState[key] = false;
          formFieldsValidity[key] = undefined;
          formFieldsErrorMessages[key] = undefined;
          initializeStatesRecursive(field.fields, initialValuesContainer[key], currentValuesContainer[key]);
        } else if (field.propertyName) {
          const initialValue = field.hasOwnProperty("value") ? field.value : undefined;
          currentValuesContainer[field.propertyName] = initialValue;
          initialValuesContainer[field.propertyName] = initialValue !== undefined ? JSON.parse(JSON.stringify(initialValue)) : undefined;
          formFieldsTouchedState[field.propertyName] = false;
          formFieldsDirtyState[field.propertyName] = false;
          formFieldsValidity[field.propertyName] = undefined;
          formFieldsErrorMessages[field.propertyName] = undefined;
        }
      });
    }
  };

  /**
   * Initializes all form field states upon composable setup.
   * @private
   */
  const initFormStates = () => {
    initializeStatesRecursive(fields, initialFormFieldsValues, formFieldsValues);
  };

  initFormStates();

  /**
   * Updates the stored initial value of a field. This is primarily used for dirty state calculation
   * when the parent form's model provides new baseline values.
   * Note: Current implementation primarily supports top-level fields.
   * @param {string} fieldName - The `propertyName` of the field.
   * @param {any} value - The new initial value for the field.
   */
  const updateFieldInitialValue = (fieldName, value) => {
     const fieldConfig = findFieldConfig(fieldName, fields); // Find the config to ensure we're dealing with a defined field
     if (fieldConfig && fieldConfig.propertyName) { // Ensure it's a direct field property
        const serializedValue = value !== undefined ? JSON.parse(JSON.stringify(value)) : undefined;
        initialFormFieldsValues[fieldConfig.propertyName] = serializedValue;

        // If the reactive formFieldsValues was undefined (e.g. field added dynamically or init with no value),
        // set it and reset dirty state.
        if (formFieldsValues[fieldConfig.propertyName] === undefined && value !== undefined) {
          formFieldsValues[fieldConfig.propertyName] = value;
          formFieldsDirtyState[fieldConfig.propertyName] = false;
        }
      }
  };

  /**
   * Updates the validation state (validity and error message) for a given field.
   * @private
   * @param {string} fieldName - The `propertyName` of the field.
   * @param {boolean|string|string[]|undefined} validityOrMsg - `true` if valid, an error message (string or array of strings) if invalid, or `undefined` to clear existing errors.
   */
  const updateValidationState = (fieldName, validityOrMsg) => {
    if (typeof validityOrMsg === "string" || Array.isArray(validityOrMsg)) {
      formFieldsValidity[fieldName] = false;
      formFieldsErrorMessages[fieldName] = validityOrMsg;
    } else if (validityOrMsg === true || validityOrMsg === undefined) {
      if (formFieldsValidity[fieldName] === false) { // Only clear if previously invalid
        formFieldsValidity[fieldName] = undefined;
        formFieldsErrorMessages[fieldName] = undefined;
      }
    }
  };

  /**
   * Resets the validation state (validity and error message) for a specific field, or all fields if no field name is provided.
   * @param {string} [fieldName] - The `propertyName` of the field to reset. If omitted, resets all fields.
   */
  const resetValidationState = (fieldName) => {
    if (fieldName && formFieldsValidity.hasOwnProperty(fieldName)) {
      formFieldsValidity[fieldName] = undefined;
      formFieldsErrorMessages[fieldName] = undefined;
    } else if (!fieldName) {
      Object.keys(formFieldsValidity).forEach(key => {
        formFieldsValidity[key] = undefined;
        formFieldsErrorMessages[key] = undefined;
      });
    }
  };

  /**
   * Finds a field configuration object by its `propertyName` (or `subForm` key).
   * Supports basic dot-notation for accessing fields within sub-forms (e.g., "address.street").
   * This is used internally, primarily by `validateField`, to retrieve the rules and settings for a field.
   * @private
   * @param {string} fieldPath - The property name or path of the field to find.
   * @param {Array<FieldConfig>} [searchFields=fields] - The array of field configurations to search within.
   * @returns {FieldConfig|undefined} The field configuration object if found, otherwise `undefined`.
   */
  const findFieldConfig = (fieldPath, searchFields = fields) => {
    const parts = fieldPath.split('.');
    let currentLevelFields = searchFields;
    let config;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        // Find field by propertyName (for actual fields) or subForm (for sub-form containers)
        config = currentLevelFields.find(f => (f.propertyName === part) || (f.subForm === part));
        if (!config) return undefined; // Path part not found

        if (config.subForm && config.fields && i < parts.length - 1) {
            currentLevelFields = config.fields; // Move into sub-form's fields for next part
        } else if (i < parts.length - 1) {
            // Path indicates deeper nesting, but current config is not a sub-form with fields
            return undefined;
        }
    }
    return config; // Return the final config found at the end of the path
  };

  /**
   * Validates a single field based on its configuration (rules and custom validators).
   * Updates reactive validation states: `formFieldsValidity[fieldName]` and `formFieldsErrorMessages[fieldName]`.
   * The `fieldName` should correspond to a `propertyName` in a `FieldConfig`, even for nested fields.
   * @param {string} fieldName - The `propertyName` of the field to validate. For nested fields, this is the actual property name, not the full path.
   * @param {any} value - The current value of the field to validate.
   * @returns {boolean} True if the field is valid, false otherwise.
   */
  const validateField = (fieldName, value) => {
    // `findFieldConfig` is used to get the rules. `fieldName` here should be the actual property key.
    // If `fieldName` includes '.', `findFieldConfig` will trace it. The `stateKey` will be the final property.
    const fieldConfig = findFieldConfig(fieldName);

    if (!fieldConfig || !fieldConfig.propertyName) { // Ensure it's a field with a propertyName to store state against
      // console.warn(`Validation attempt on a field without propertyName or config: ${fieldName}`);
      // If it's a subForm container without its own rules, it's considered valid by default.
      // Actual sub-field validation happens via validateFormPurely's recursion.
      return true;
    }

    const stateKey = fieldConfig.propertyName; // Validation state is stored against the final propertyName.

    resetValidationState(stateKey);
    let isValid = true;
    let errorMessage = undefined;
    const labelArg = getFieldLabel(fieldConfig);

    if (fieldConfig.validators && Array.isArray(fieldConfig.validators)) {
      for (const validationFn of fieldConfig.validators) {
        if (typeof validationFn === "function") {
          const result = validationFn(value, labelArg);
          if (typeof result === "string" || (Array.isArray(result) && result.length > 0)) {
            errorMessage = result; isValid = false; break;
          }
        }
      }
    }

    if (isValid && fieldConfig.rules && Array.isArray(fieldConfig.rules)) {
      for (const rule of fieldConfig.rules) {
        let ruleResult;
        if (typeof rule === "string") {
          ruleResult = Validation[rule] ? Validation[rule](value, labelArg) : undefined;
        } else if (rule instanceof RegExp) {
          ruleResult = Validation.matchRegex(value, labelArg, undefined, rule);
        } else if (typeof rule === "object" && rule !== null && rule.name) {
          const { name, customErrorMsg, regex, ...otherParams } = rule;
          if (name === "matchRegex" && regex instanceof RegExp) {
            ruleResult = Validation.matchRegex(value, labelArg, customErrorMsg, regex);
          } else if (Validation[name]) {
            ruleResult = Validation[name](value, labelArg, customErrorMsg, otherParams);
          }
        }
        if (typeof ruleResult === "string" || (Array.isArray(ruleResult) && ruleResult.length > 0)) {
          errorMessage = ruleResult; isValid = false; break;
        }
      }
    }

    updateValidationState(stateKey, isValid ? true : errorMessage);
    return isValid;
  };

  /**
   * Triggers validation for a specific field, typically in response to user interaction like 'input' or 'blur'.
   * Behavior depends on the `validationTrigger` option and debounce settings.
   * @param {string} fieldName - The `propertyName` of the field to validate. This should be the specific field key, e.g., "email" or "address.street".
   * @param {'input' | 'blur'} triggerType - The type of event that triggered this validation.
   * @param {Object<string, any>} currentFormModel - The complete current model of the form (e.g., `modelValue.value` from `PreskoForm`).
   *   This is used to extract the field's current value for validation.
   */
  const triggerValidation = (fieldName, triggerType, currentFormModel) => {
    // Extract the field's value from the provided currentFormModel
    // Handles basic dot notation for nested field values.
    let fieldValue;
    const nameParts = fieldName.split('.');
    if (nameParts.length > 1) {
        fieldValue = nameParts.reduce((obj, part) => obj && obj[part], currentFormModel);
    } else {
        fieldValue = currentFormModel[fieldName];
    }

    const fieldConfig = findFieldConfig(fieldName); // Find config to ensure we operate on a defined field property
    if (!fieldConfig || !fieldConfig.propertyName) {
      // console.warn(`triggerValidation called for unconfigured field or subForm container: ${fieldName}`);
      return;
    }
    const stateKey = fieldConfig.propertyName; // Use the actual propertyName for state management and timers

    if (triggerType === "input") {
      if (options.validationTrigger === "onInput") {
        if (debounceTimers[stateKey]) {
          clearTimeout(debounceTimers[stateKey]);
        }
        if (formFieldsValidity[stateKey] === false) {
            formFieldsErrorMessages[stateKey] = undefined; // Clear visual error immediately
        }
        debounceTimers[stateKey] = setTimeout(() => {
          validateField(stateKey, fieldValue);
        }, options.inputDebounceMs);
      }
    } else if (triggerType === "blur") {
      if (options.validationTrigger === "onBlur" || options.validationTrigger === "onInput") {
        if (debounceTimers[stateKey]) {
            clearTimeout(debounceTimers[stateKey]);
        }
        validateField(stateKey, fieldValue);
      }
    }
  };

  /**
   * Validates a given data object (representing the entire form's current model) against all field configurations.
   * This is typically used for form submission. Updates reactive validation states.
   * @param {Object<string, any>} formToValidate - The complete form model object to validate.
   * @returns {boolean} `true` if all fields (including those in sub-forms) are valid, `false` otherwise.
   */
  const validateFormPurely = (formToValidate) => {
    let isOverallFormValid = true;

    // Recursive function to validate fields at current level and within sub-forms
    function validateRecursive(currentFieldsConfig, currentModelSlice) {
        if (!currentFieldsConfig || !Array.isArray(currentFieldsConfig)) return;

        for (const field of currentFieldsConfig) {
            const key = field.propertyName || field.subForm;
            if (!key) continue;

            const valueToValidate = currentModelSlice ? currentModelSlice[key] : undefined;

            if (field.subForm && field.fields) { // This is a sub-form container
                if (typeof valueToValidate === 'object' && valueToValidate !== null) {
                    validateRecursive(field.fields, valueToValidate); // Recurse into sub-form
                } else {
                    // console.warn(`Sub-form data for '${key}' is missing or not an object.`);
                    // Potentially validate the sub-form key itself if it has rules (e.g. isRequired for the object)
                    // For now, if sub-form data is not an object, its fields are not validated.
                }
            } else if (field.propertyName) { // This is an actual field with a propertyName
                if (!validateField(field.propertyName, valueToValidate)) {
                    isOverallFormValid = false; // Mark overall form as invalid
                }
            }
        }
    }

    validateRecursive(fields, formToValidate);
    return isOverallFormValid;
  };

  /**
   * Sets the touched state for a given field.
   * @param {string} fieldName - The `propertyName` of the field (can be a sub-form key).
   * @param {boolean} [touched=true] - The touched state to set.
   * @returns {boolean} `true` if the state was changed, `false` otherwise.
   */
  const setFieldTouched = (fieldName, touched = true) => {
    if (formFieldsTouchedState.hasOwnProperty(fieldName)) {
      if (formFieldsTouchedState[fieldName] !== touched) {
        formFieldsTouchedState[fieldName] = touched;
        return true;
      }
    } else { // If fieldName was not in state (e.g. newly added or subform container), add it.
      formFieldsTouchedState[fieldName] = touched;
      return true;
    }
    return false;
  };

  /**
   * Checks if a field's current value differs from its stored initial value and updates its dirty state.
   * Uses `JSON.stringify` for a basic deep comparison.
   * Note: Current implementation primarily supports top-level fields for `fieldName`.
   * @param {string} fieldName - The `propertyName` of the field.
   * @param {any} currentValue - The current value of the field.
   * @returns {boolean} `true` if the dirty state was changed, `false` otherwise.
   */
  const checkFieldDirty = (fieldName, currentValue) => {
    const fieldConfig = findFieldConfig(fieldName, fields);
    if (fieldConfig && fieldConfig.propertyName && initialFormFieldsValues.hasOwnProperty(fieldConfig.propertyName)) {
      const stateKey = fieldConfig.propertyName;
      const oldIsDirty = formFieldsDirtyState[stateKey];
      const newIsDirty = JSON.stringify(currentValue) !== JSON.stringify(initialFormFieldsValues[stateKey]);
      if (oldIsDirty !== newIsDirty) {
        formFieldsDirtyState[stateKey] = newIsDirty;
        return true;
      }
    }
    return false;
  };

  return {
    formFieldsValues,
    formFieldsValidity,
    formFieldsErrorMessages,
    formFieldsTouchedState,
    formFieldsDirtyState,
    validateField,
    validateFormPurely,
    setFieldTouched,
    checkFieldDirty,
    updateFieldInitialValue,
    triggerValidation,
    resetValidationState,
  };
}
