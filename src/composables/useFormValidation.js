import { reactive } from "vue";
import Validation from "../validation";

/**
 * @typedef {Object} FieldConfig
 * @property {string} propertyName - The key used to identify the field in the model and state objects.
 * @property {any} [value] - The initial value of the field.
 * @property {string} [label] - A human-readable label for the field, used in error messages.
 * @property {Object} [props] - Additional props to pass to the field's component; `props.label` can also be used for error messages.
 * @property {Array<string|Object|RegExp>} [rules] - An array of validation rules.
 * @property {Array<Function>} [validators] - An array of custom validator functions.
 */

/**
 * Composable for managing form validation, field values, and interaction states.
 * @param {Array<FieldConfig>} fields - An array of field configuration objects that define the form structure.
 * @returns {Object} An object containing reactive states and methods to manage the form.
 * @property {Object<string, any>} formFieldsValues - Reactive object holding the current values of form fields.
 * @property {Object<string, boolean|undefined>} formFieldsValidity - Reactive object holding the validity state of fields (false if invalid, undefined if valid).
 * @property {Object<string, string|undefined>} formFieldsErrorMessages - Reactive object holding error messages for invalid fields.
 * @property {Object<string, boolean>} formFieldsTouchedState - Reactive object holding the touched state of fields.
 * @property {Object<string, boolean>} formFieldsDirtyState - Reactive object holding the dirty state of fields.
 * @property {Function} validateField - Function to validate a single field.
 * @property {Function} validateForm - Function to validate all fields in the form based on current `formFieldsValues`.
 * @property {Function} validateFormPurely - Function to validate a provided data object against field configurations and update reactive validation states.
 * @property {Function} setFieldTouched - Function to set the touched state of a field.
 * @property {Function} checkFieldDirty - Function to check and update the dirty state of a field.
 */
export function useFormValidation(fields) {
  /** @type {Object<string, any>} */
  let formFieldsValues = reactive({});
  /** @type {Object<string, boolean|undefined>} */
  let formFieldsValidity = reactive({});
  /** @type {Object<string, string|undefined>} */
  let formFieldsErrorMessages = reactive({});
  /** @type {Object<string, boolean>} */
  let formFieldsTouchedState = reactive({});
  /** @type {Object<string, boolean>} */
  let formFieldsDirtyState = reactive({});
  /** @type {Object<string, any>} */
  let initialFormFieldsValues = {};

  /**
   * Gets the label for a field, preferring `field.label`, then `field.props.label`, then `field.propertyName`.
   * @param {FieldConfig} field - The field configuration object.
   * @returns {string} The resolved label for the field.
   */
  const getFieldLabel = (field) => {
    return (
      field.label || (field.props && field.props.label) || field.propertyName
    );
  };

  /**
   * Initializes all form field states (values, initial values, touched, dirty, validity, error messages).
   * Populates `initialFormFieldsValues` with a deep copy of initial field values.
   * @private
   */
  const initFormStates = () => {
    const initialValuesTemp = {};
    if (fields && Array.isArray(fields)) {
      fields.forEach((field) => {
        if (field.propertyName) {
          const initialValue = field.hasOwnProperty("value")
            ? field.value
            : undefined;

          formFieldsValues[field.propertyName] = initialValue;
          initialValuesTemp[field.propertyName] =
            initialValue !== undefined
              ? JSON.parse(JSON.stringify(initialValue))
              : undefined;

          formFieldsTouchedState[field.propertyName] = false;
          formFieldsDirtyState[field.propertyName] = false;

          formFieldsValidity[field.propertyName] = undefined;
          formFieldsErrorMessages[field.propertyName] = undefined;
        }
      });
    }
    initialFormFieldsValues = initialValuesTemp;
  };

  initFormStates();

  /**
   * Updates the validation state (validity and error message) for a given field.
   * @private
   * @param {FieldConfig} field - The field configuration object.
   * @param {boolean|string|undefined} validity - True if valid, an error message string if invalid, or undefined.
   */
  const updateValidationState = (field, validity) => {
    if (typeof validity === "string") {
      formFieldsValidity[field.propertyName] = false;
      formFieldsErrorMessages[field.propertyName] = validity;
    } else if (validity === true || validity === undefined) {
      if (formFieldsValidity[field.propertyName] === false) {
        formFieldsValidity[field.propertyName] = undefined;
        formFieldsErrorMessages[field.propertyName] = undefined;
      }
    }
  };

  /**
   * Resets the validation state (validity and error message) for a given field.
   * @private
   * @param {FieldConfig} field - The field configuration object.
   */
  const resetValidationState = (field) => {
    if (field && field.propertyName) {
      formFieldsValidity[field.propertyName] = undefined;
      formFieldsErrorMessages[field.propertyName] = undefined;
    }
  };

  /**
   * Validates a field using its custom validator functions.
   * @private
   * @param {FieldConfig} field - The field configuration object.
   * @param {any} input - The current value of the field.
   */
  const validateWithCustomValidator = (field, input) => {
    if (!Array.isArray(field.validators)) return;
    for (const validationFn of field.validators) {
      if (typeof validationFn === "function") {
        const validity = validationFn(input);
        updateValidationState(field, validity);
        if (typeof validity === "string") {
          return;
        }
      }
    }
  };

  /**
   * Validates a field using its built-in validation rules.
   * @private
   * @param {FieldConfig} field - The field configuration object.
   * @param {any} input - The current value of the field.
   */
  const validateWithBuiltInRules = (field, input) => {
    if (!Array.isArray(field.rules)) return;
    const labelArg = getFieldLabel(field);

    for (const rule of field.rules) {
      let validity;
      if (typeof rule === "string") {
        if (Validation[rule]) {
          validity = Validation[rule](input, labelArg);
        } else {
          console.warn(`Unknown validation rule: ${rule}`);
          continue;
        }
      } else if (rule instanceof RegExp) {
        validity = Validation.matchRegex(input, labelArg, undefined, rule);
      } else if (typeof rule === "object" && rule !== null && rule.name) {
        const { name, customErrorMsg, regex } = rule;
        if (name === "matchRegex" && regex instanceof RegExp) {
          validity = Validation.matchRegex(
            input,
            labelArg,
            customErrorMsg,
            regex
          );
        } else if (Validation[name]) {
          validity = Validation[name](input, labelArg, customErrorMsg);
        } else {
          console.warn(`Unknown validation rule object: ${name}`);
          continue;
        }
      } else {
        console.warn("Invalid rule format:", rule);
        continue;
      }

      if (typeof validity === "string") {
        updateValidationState(field, validity);
        return;
      }
    }
    if (formFieldsValidity[field.propertyName] === false) {
      resetValidationState(field);
    }
  };

  /**
   * Validates a single field based on its configuration (rules and custom validators).
   * Updates reactive validation states.
   * @param {FieldConfig|string} field - The field configuration object or the propertyName of the field.
   * @param {any} input - The current value of the field.
   */
  const validateField = (field, input) => {
    const fieldConfig =
      typeof field === "string"
        ? fields.find((f) => f.propertyName === field)
        : field;
    if (!fieldConfig || !fieldConfig.propertyName) {
      console.warn(`Field configuration not found or invalid for: ${field}`);
      return;
    }
    resetValidationState(fieldConfig);

    if (fieldConfig.validators && Array.isArray(fieldConfig.validators)) {
      validateWithCustomValidator(fieldConfig, input);
      if (formFieldsValidity[fieldConfig.propertyName] === false) return;
    }

    if (fieldConfig.rules && Array.isArray(fieldConfig.rules)) {
      validateWithBuiltInRules(fieldConfig, input);
    }
  };

  /**
   * Validates all fields in the form based on their current values in `formFieldsValues`.
   * Updates reactive validation states.
   * @returns {boolean} True if all fields are valid, false otherwise.
   */
  const validateForm = () => {
    let isFormValid = true;
    if (fields && Array.isArray(fields)) {
      fields.forEach((field) => {
        if (field.propertyName) {
          validateField(field, formFieldsValues[field.propertyName]);
          if (formFieldsValidity[field.propertyName] === false) {
            isFormValid = false;
          }
        }
      });
    }
    return isFormValid;
  };

  /**
   * Validates a given data object against the form's field configurations.
   * Updates the composable's reactive validation states.
   * @param {Object<string, any>} formToValidate - An object where keys are field propertyNames and values are their current values.
   * @returns {boolean} True if all validated fields in `formToValidate` are valid, false otherwise.
   */
  const validateFormPurely = (formToValidate) => {
    let isFormValid = true;
    if (fields && Array.isArray(fields)) {
      for (const propertyName in formToValidate) {
        if (formToValidate.hasOwnProperty(propertyName)) {
          const fieldConfig = fields.find(
            (f) => f.propertyName === propertyName
          );
          if (fieldConfig) {
            validateField(fieldConfig, formToValidate[propertyName]);
            if (formFieldsValidity[propertyName] === false) {
              isFormValid = false;
            }
          }
        }
      }
    }
    return isFormValid;
  };

  /**
   * Sets the touched state for a given field.
   * @param {string} fieldName - The property name of the field.
   * @param {boolean} [touched=true] - The touched state to set.
   * @returns {boolean} True if the state was changed, false otherwise.
   */
  const setFieldTouched = (fieldName, touched = true) => {
    if (formFieldsTouchedState.hasOwnProperty(fieldName)) {
      if (formFieldsTouchedState[fieldName] !== touched) {
        formFieldsTouchedState[fieldName] = touched;
        return true;
      }
    }
    return false;
  };

  /**
   * Checks if a field's current value differs from its initial value and updates its dirty state.
   * Uses JSON.stringify for basic deep comparison of non-primitive values.
   * @param {string} fieldName - The property name of the field.
   * @param {any} currentValue - The current value of the field.
   * @returns {boolean} True if the dirty state was changed, false otherwise.
   */
  const checkFieldDirty = (fieldName, currentValue) => {
    if (initialFormFieldsValues.hasOwnProperty(fieldName)) {
      const oldIsDirty = formFieldsDirtyState[fieldName];
      const newIsDirty =
        JSON.stringify(currentValue) !==
        JSON.stringify(initialFormFieldsValues[fieldName]);
      if (oldIsDirty !== newIsDirty) {
        formFieldsDirtyState[fieldName] = newIsDirty;
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
    validateForm,
    validateFormPurely,
    setFieldTouched,
    checkFieldDirty,
  };
}
