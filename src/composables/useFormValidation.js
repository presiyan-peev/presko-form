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
 * @property {string} [type] - Type of field, e.g., 'list' for list fields.
 * @property {Array} [initialValue] - Initial value for list fields.
 * @property {Object} [defaultValue] - Default value template for new list items.
 * @property {boolean} [isShowing] - Indicates whether the field is visible and should be validated.
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
 * supporting both flat field layouts, nested sub-forms, and list fields.
 *
 * @param {Array<FieldConfig>} fields - An array of field configuration objects that define the form structure.
 *   Each object describes a field, a sub-form container, or a list field.
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
 * @property {Function} addItem - Adds an item to a list field.
 * @property {Function} removeItem - Removes an item from a list field.
 */
export function useFormValidation(fields, options = {}) {
  const { validationTrigger = "onBlur", inputDebounceMs = 100 } = options;

  /** @type {Object<string, any>} */
  let formFieldsValues = reactive({});
  let formFieldsValidity = reactive({});
  /** @type {Object<string, string|string[]|undefined>} */
  let formFieldsErrorMessages = reactive({});
  let formFieldsTouchedState = reactive({});
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
      field.label ||
      (field.props && field.props.label) ||
      field.propertyName ||
      ""
    );
  };

  /**
   * Initializes a single field's state.
   * @private
   * @param {FieldConfig} fieldConfig - The field configuration object.
   * @param {string} pathPrefix - The path prefix for nested fields.
   * @param {Object} targetValuesObject - The target object to set values on.
   * @param {Object} targetInitialValuesObject - The target object to set initial values on.
   */
  const initializeFieldState = (
    fieldConfig,
    pathPrefix,
    targetValuesObject,
    targetInitialValuesObject
  ) => {
    const fullPath = pathPrefix + fieldConfig.propertyName;
    const initialValue = fieldConfig.hasOwnProperty("value")
      ? fieldConfig.value
      : undefined;

    targetValuesObject[fieldConfig.propertyName] = initialValue;
    targetInitialValuesObject[fieldConfig.propertyName] =
      initialValue !== undefined
        ? JSON.parse(JSON.stringify(initialValue))
        : undefined;

    formFieldsTouchedState[fullPath] = false;
    formFieldsDirtyState[fullPath] = false;
    formFieldsValidity[fullPath] = undefined;
    formFieldsErrorMessages[fullPath] = undefined;
  };

  /**
   * Recursively initializes reactive states (values, validity, errors, touched, dirty)
   * for all fields and sub-form fields based on their configuration.
   * @private
   * @param {Array<FieldConfig>} currentFields - The array of field configurations to process.
   * @param {string} currentPathPrefix - The current path prefix for nested structures.
   * @param {Object} currentModelTarget - The current target object for field values.
   * @param {Object} currentInitialValuesTarget - The current target object for initial values.
   */
  const initFormStates = (
    currentFields,
    currentPathPrefix = "",
    currentModelTarget = formFieldsValues,
    currentInitialValuesTarget = initialFormFieldsValues
  ) => {
    if (currentFields && Array.isArray(currentFields)) {
      currentFields.forEach((field) => {
        const key = field.propertyName || field.subForm;
        if (!key) return;

        const fullPath = currentPathPrefix + key;

        if (field.type === "list") {
          currentModelTarget[key] =
            field.initialValue && Array.isArray(field.initialValue)
              ? [...field.initialValue]
              : [];
          currentInitialValuesTarget[key] =
            field.initialValue && Array.isArray(field.initialValue)
              ? JSON.parse(JSON.stringify(field.initialValue))
              : [];

          formFieldsTouchedState[fullPath] = false;
          formFieldsDirtyState[fullPath] = false;

          currentModelTarget[key].forEach((item, index) => {
            const itemPathPrefix = `${fullPath}[${index}].`;
            if (typeof item !== "object" || item === null) {
              currentModelTarget[key][index] = {};
            }
            if (
              typeof currentInitialValuesTarget[key][index] !== "object" ||
              currentInitialValuesTarget[key][index] === null
            ) {
              currentInitialValuesTarget[key][index] = {};
            }
            if (Array.isArray(field.fields)) {
              field.fields.forEach((listItemField) => {
                if (listItemField.propertyName) {
                  // Ensure listItemField has a propertyName
                  initializeFieldState(
                    listItemField,
                    itemPathPrefix,
                    currentModelTarget[key][index],
                    currentInitialValuesTarget[key][index]
                  );
                }
              });
            }
          });
        } else if (field.subForm && field.fields) {
          currentModelTarget[key] = currentModelTarget[key] || {};
          currentInitialValuesTarget[key] =
            currentInitialValuesTarget[key] || {};
          formFieldsTouchedState[fullPath] = false;
          formFieldsDirtyState[fullPath] = false;
          formFieldsValidity[fullPath] = undefined;
          formFieldsErrorMessages[fullPath] = undefined;
          initFormStates(
            field.fields,
            `${fullPath}.`,
            currentModelTarget[key],
            currentInitialValuesTarget[key]
          );
        } else if (field.propertyName) {
          const initialValue = field.hasOwnProperty("value")
            ? field.value
            : undefined;
          currentModelTarget[field.propertyName] = initialValue;
          currentInitialValuesTarget[field.propertyName] =
            initialValue !== undefined
              ? JSON.parse(JSON.stringify(initialValue))
              : undefined;
          formFieldsTouchedState[fullPath] = false;
          formFieldsDirtyState[fullPath] = false;
          formFieldsValidity[fullPath] = undefined;
          formFieldsErrorMessages[fullPath] = undefined;
        }
      });
    }
  };

  initFormStates(fields);

  /**
   * Updates the stored initial value of a field. This is primarily used for dirty state calculation
   * when the parent form's model provides new baseline values.
   * @param {string} fieldPath - The path of the field (supports nested paths like 'profile.name' or 'contacts[0].name').
   * @param {any} value - The new initial value for the field.
   */
  const updateFieldInitialValue = (fieldPath, value) => {
    const fieldConfig = findFieldConfig(fieldPath, fields); // Find the config to ensure we're dealing with a defined field
    if (fieldConfig && fieldConfig.propertyName) {
      // Ensure it's a direct field property
      const serializedValue =
        value !== undefined ? JSON.parse(JSON.stringify(value)) : undefined;

      // Handle nested paths
      const pathParts = fieldPath.split(".");
      let currentTarget = initialFormFieldsValues;

      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!currentTarget[part]) {
          currentTarget[part] = {};
        }
        currentTarget = currentTarget[part];
      }

      const finalKey = pathParts[pathParts.length - 1];
      currentTarget[finalKey] = serializedValue;

      // If the reactive formFieldsValues was undefined (e.g. field added dynamically or init with no value),
      // set it and reset dirty state.
      if (
        getValueByPath(formFieldsValues, fieldPath) === undefined &&
        value !== undefined
      ) {
        setValueByPath(formFieldsValues, fieldPath, value);
        formFieldsDirtyState[fieldPath] = false;
      }
    }
  };

  /**
   * Helper function to get a value by path from an object.
   * @private
   * @param {Object} obj - The object to get the value from.
   * @param {string} path - The path to the value.
   * @returns {any} The value at the path.
   */
  const getValueByPath = (obj, path) => {
    return path.split(".").reduce((current, key) => {
      if (current === null || current === undefined) return undefined;

      // Handle array notation like 'contacts[0]'
      const arrayMatch = key.match(/^([^[]+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayKey, index] = arrayMatch;
        return current[arrayKey] && current[arrayKey][parseInt(index)];
      }

      return current[key];
    }, obj);
  };

  /**
   * Helper function to set a value by path in an object.
   * @private
   * @param {Object} obj - The object to set the value in.
   * @param {string} path - The path to set the value at.
   * @param {any} value - The value to set.
   */
  const setValueByPath = (obj, path, value) => {
    const pathParts = path.split(".");
    let current = obj;

    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];

      // Handle array notation
      const arrayMatch = part.match(/^([^[]+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayKey, index] = arrayMatch;
        if (!current[arrayKey]) current[arrayKey] = [];
        if (!current[arrayKey][parseInt(index)])
          current[arrayKey][parseInt(index)] = {};
        current = current[arrayKey][parseInt(index)];
      } else {
        if (!current[part]) current[part] = {};
        current = current[part];
      }
    }

    const finalPart = pathParts[pathParts.length - 1];
    const arrayMatch = finalPart.match(/^([^[]+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, arrayKey, index] = arrayMatch;
      if (!current[arrayKey]) current[arrayKey] = [];
      current[arrayKey][parseInt(index)] = value;
    } else {
      current[finalPart] = value;
    }
  };

  /**
   * Updates the validation state (validity and error message) for a given field.
   * @private
   * @param {string} fieldPath - The path of the field (supports nested paths).
   * @param {boolean|string|string[]|undefined} validityOrMsg - `true` if valid, an error message (string or array of strings) if invalid, or `undefined` to clear existing errors.
   */
  const updateValidationState = (fieldPath, validityOrMsg) => {
    if (typeof validityOrMsg === "string" || Array.isArray(validityOrMsg)) {
      formFieldsValidity[fieldPath] = false;
      formFieldsErrorMessages[fieldPath] = validityOrMsg;
    } else if (validityOrMsg === true) {
      formFieldsValidity[fieldPath] = undefined; // Clear validity (valid state)
      formFieldsErrorMessages[fieldPath] = undefined; // Clear error messages
    } else {
      // validityOrMsg is undefined, clear both validity and error messages
      formFieldsValidity[fieldPath] = undefined;
      formFieldsErrorMessages[fieldPath] = undefined;
    }
  };

  /**
   * Finds the field configuration for a given field path.
   * @private
   * @param {string} fieldPath - The path of the field to find.
   * @param {Array<FieldConfig>} searchFields - The fields to search in.
   * @returns {FieldConfig|null} The field configuration or null if not found.
   */
  const findFieldConfig = (fieldPath, searchFields = fields) => {
    if (!searchFields || !Array.isArray(searchFields)) return null;

    // Handle nested paths like 'profile.firstName' or 'contacts[0].name'
    const pathParts = fieldPath.split(".");
    const firstPart = pathParts[0];

    // Check for array notation in the first part
    const arrayMatch = firstPart.match(/^([^[]+)\[(\d+)\](.*)$/);
    if (arrayMatch) {
      const [, listName] = arrayMatch;
      const listField = searchFields.find(
        (f) => f.propertyName === listName && f.type === "list"
      );
      if (listField && pathParts.length > 1) {
        // Look for the sub-field in the list's field configuration
        const subFieldName = pathParts[1];
        return (
          listField.fields?.find((f) => f.propertyName === subFieldName) || null
        );
      }
      return listField || null;
    }

    // Handle regular nested paths
    if (pathParts.length === 1) {
      // Direct field at any nesting level
      const direct = searchFields.find(
        (f) => f.propertyName === fieldPath || f.subForm === fieldPath
      );
      if (direct) return direct;
      // Recursively search sub-forms and list fields
      for (const f of searchFields) {
        if (f.subForm && Array.isArray(f.fields)) {
          const found = findFieldConfig(fieldPath, f.fields);
          if (found) return found;
        }
        if (f.type === "list" && Array.isArray(f.fields)) {
          const found = findFieldConfig(fieldPath, f.fields);
          if (found) return found;
        }
      }
      return null;
    } else {
      // Nested field - find the parent first
      const parentKey = pathParts[0];
      const parentField = searchFields.find((f) => f.subForm === parentKey);
      if (parentField && parentField.fields) {
        const remainingPath = pathParts.slice(1).join(".");
        // Find the field in the sub-form
        const subField = parentField.fields.find(
          (f) => f.propertyName === remainingPath
        );
        return subField || null;
      }
    }

    return null;
  };

  /**
   * Resets the validation state for a specific field or all fields.
   * @param {string} [fieldPath] - The path of the field to reset. If not provided, resets all fields.
   */
  const resetValidationState = (fieldPath) => {
    if (fieldPath) {
      updateValidationState(fieldPath, undefined);
    } else {
      // Reset all validation states
      Object.keys(formFieldsValidity).forEach((key) => {
        formFieldsValidity[key] = undefined;
      });
      Object.keys(formFieldsErrorMessages).forEach((key) => {
        formFieldsErrorMessages[key] = undefined;
      });
    }
  };

  /**
   * Validates a field using custom validators.
   * @private
   * @param {FieldConfig} field - The field configuration.
   * @param {any} input - The input value to validate.
   * @param {string} fieldPath - The path of the field.
   * @returns {boolean|string} True if valid, error message if invalid.
   */
  const validateWithCustomValidator = (field, input, fieldPath) => {
    if (field.validators && Array.isArray(field.validators)) {
      for (const validator of field.validators) {
        if (typeof validator === "function") {
          const result = validator(input, getFieldLabel(field), field);
          if (result !== true) {
            return result || `${getFieldLabel(field)} is invalid.`;
          }
        }
      }
    }
    return true;
  };

  /**
   * Validates a field using built-in rules.
   * @private
   * @param {FieldConfig} field - The field configuration.
   * @param {any} input - The input value to validate.
   * @param {string} fieldPath - The path of the field.
   * @returns {boolean|string} True if valid, error message if invalid.
   */
  const validateWithBuiltInRules = (field, input, fieldPath) => {
    if (field.rules && Array.isArray(field.rules)) {
      for (const rule of field.rules) {
        let result;
        if (typeof rule === "string") {
          // Simple string rule
          if (Validation[rule] && typeof Validation[rule] === "function") {
            result = Validation[rule](input, getFieldLabel(field), field);
          }
        } else if (typeof rule === "object" && rule.name) {
          // Object rule with parameters
          if (
            Validation[rule.name] &&
            typeof Validation[rule.name] === "function"
          ) {
            result = Validation[rule.name](
              input,
              getFieldLabel(field),
              field,
              rule.params || {}
            );
          }
        } else if (rule instanceof RegExp) {
          // Regular expression rule
          result =
            rule.test(String(input)) ||
            `${getFieldLabel(field)} format is invalid.`;
        }

        if (result !== true) {
          return result || `${getFieldLabel(field)} is invalid.`;
        }
      }
    }
    return true;
  };

  // Helper to evaluate field visibility supporting ref / function / boolean.
  const isVisible = (fld) => {
    const flag = fld?.isShowing;
    if (flag === undefined) return true;
    if (typeof flag === "boolean") return flag;
    if (typeof flag === "function") return !!flag();
    if (flag && typeof flag === "object" && "value" in flag)
      return !!flag.value;
    return !!flag;
  };

  const validateField = (fieldPath, input) => {
    const fieldConfig = findFieldConfig(fieldPath, fields);
    if (!fieldConfig || !isVisible(fieldConfig)) {
      // Skip validation if the field is not configured or not visible
      return;
    }

    // If field has no rules or validators, treat empty / undefined values as invalid (required by default)
    const hasRules =
      Array.isArray(fieldConfig.rules) && fieldConfig.rules.length > 0;
    const hasValidators =
      Array.isArray(fieldConfig.validators) &&
      fieldConfig.validators.length > 0;

    if (!hasRules && !hasValidators) {
      const requiredResult = Validation.isRequired
        ? Validation.isRequired(input, getFieldLabel(fieldConfig), fieldConfig)
        : input
        ? true
        : `${getFieldLabel(fieldConfig)} is required.`;

      if (requiredResult !== true) {
        updateValidationState(fieldPath, requiredResult);
        return false;
      }
    }

    // Validate with custom validators first
    const customResult = validateWithCustomValidator(
      fieldConfig,
      input,
      fieldPath
    );
    if (customResult !== true) {
      updateValidationState(fieldPath, customResult);
      return false;
    }

    // Validate with built-in rules
    const rulesResult = validateWithBuiltInRules(fieldConfig, input, fieldPath);
    if (rulesResult !== true) {
      updateValidationState(fieldPath, rulesResult);
      return false;
    }

    // If we get here, the field is valid
    updateValidationState(fieldPath, true);
    return true;
  };

  /**
   * Recursively validates form data against field configurations.
   * @private
   * @param {Object} formToValidate - The form data to validate.
   * @param {Array<FieldConfig>} currentFieldsConfig - The current field configurations.
   * @param {string} pathPrefix - The current path prefix for nested structures.
   * @returns {boolean} True if all fields are valid, false otherwise.
   */
  const validateFormPurelyRecursive = (
    formToValidate,
    currentFieldsConfig,
    pathPrefix = ""
  ) => {
    if (!currentFieldsConfig || !Array.isArray(currentFieldsConfig))
      return true;

    let allValid = true;

    currentFieldsConfig.forEach((field) => {
      const fullPath = pathPrefix + field.propertyName;
      if (!isVisible(field)) {
        // Skip validation for fields that are not visible
        return;
      }
      const key = field.propertyName || field.subForm;
      if (!key) return;

      if (field.type === "list") {
        // Validate list field
        const listValue = formToValidate[key];
        if (Array.isArray(listValue) && Array.isArray(field.fields)) {
          listValue.forEach((item, index) => {
            if (typeof item === "object" && item !== null) {
              field.fields.forEach((subField) => {
                if (subField.propertyName) {
                  const subFieldPath = `${pathPrefix}${key}[${index}].${subField.propertyName}`;
                  const subFieldValue = item[subField.propertyName];
                  if (!validateField(subFieldPath, subFieldValue)) {
                    allValid = false;
                  }
                }
              });
            }
          });
        }
      } else if (field.subForm && field.fields) {
        // Recursively validate sub-form but without adding the parent path so that
        // sub-form fields are tracked by their own propertyName (tests expect this)
        const subFormValue = formToValidate[key] || {};
        if (
          !validateFormPurelyRecursive(subFormValue, field.fields, pathPrefix)
        ) {
          allValid = false;
        }
      } else if (field.propertyName) {
        // Validate regular field
        const fieldValue = formToValidate[field.propertyName];
        if (!validateField(fullPath, fieldValue)) {
          allValid = false;
        }
      }
    });

    return allValid;
  };

  /**
   * Triggers validation for a specific field based on event type and validation settings.
   * @param {string} fieldPath - The path of the field to validate.
   * @param {string} triggerType - The type of trigger ('input', 'blur', 'submit').
   * @param {Object} currentFormModel - The current form model to validate against.
   */
  const triggerValidation = (fieldPath, triggerType, currentFormModel) => {
    // Clear any existing debounce timer for this field
    if (debounceTimers[fieldPath]) {
      clearTimeout(debounceTimers[fieldPath]);
      delete debounceTimers[fieldPath];
    }

    const shouldValidate =
      triggerType === "submit" || // Always validate on submit
      (validationTrigger === "onBlur" &&
        (triggerType === "blur" || triggerType === "submit")) ||
      (validationTrigger === "onInput" &&
        (triggerType === "input" ||
          triggerType === "blur" ||
          triggerType === "submit")) ||
      (validationTrigger === "onSubmit" && triggerType === "submit");

    if (!shouldValidate) return;

    const performValidation = () => {
      const fieldValue = getValueByPath(currentFormModel, fieldPath);
      validateField(fieldPath, fieldValue);
    };

    // Apply debouncing for input events when using onInput trigger
    if (triggerType === "input" && validationTrigger === "onInput") {
      debounceTimers[fieldPath] = setTimeout(
        performValidation,
        inputDebounceMs
      );
    } else {
      performValidation();
    }
  };

  /**
   * Validates the entire form purely (without side effects to internal state).
   * @param {Object} formToValidate - The form data to validate.
   * @returns {boolean} True if the entire form is valid, false otherwise.
   */
  const validateFormPurely = (formToValidate) => {
    return validateFormPurelyRecursive(formToValidate, fields);
  };

  /**
   * Sets the touched state of a field.
   * @param {string} fieldPath - The path of the field.
   * @param {boolean} touched - The touched state to set.
   * @returns {boolean} True if the touched state changed, false otherwise.
   */
  const setFieldTouched = (fieldPath, touched = true) => {
    const currentTouchedState = formFieldsTouchedState[fieldPath];
    if (currentTouchedState !== touched) {
      formFieldsTouchedState[fieldPath] = touched;
      return true; // State changed
    }
    return false; // State didn't change
  };

  /**
   * Checks if a field's current value differs from its initial value and updates dirty state.
   * @param {string} fieldPath - The path of the field.
   * @param {any} currentValue - The current value of the field.
   * @returns {boolean} True if the dirty state changed, false otherwise.
   */
  const checkFieldDirty = (fieldPath, currentValue) => {
    const initialValue = getValueByPath(initialFormFieldsValues, fieldPath);
    const isDirty =
      JSON.stringify(currentValue) !== JSON.stringify(initialValue);
    const currentDirtyState = formFieldsDirtyState[fieldPath];

    if (currentDirtyState !== isDirty) {
      formFieldsDirtyState[fieldPath] = isDirty;
      return true; // State changed
    }
    return false; // State didn't change
  };

  /**
   * Adds an item to a list field.
   * @param {string} listFieldPath - The path of the list field.
   * @param {Object} [itemData] - The data for the new item. If not provided, uses default values.
   */
  const addItem = (listFieldPath, itemData) => {
    const listFieldConfig = findFieldConfig(listFieldPath, fields);
    if (!listFieldConfig || listFieldConfig.type !== "list") {
      console.warn(
        `List field configuration not found for path: ${listFieldPath}`
      );
      return;
    }

    const currentList = formFieldsValues[listFieldPath] || [];
    let newItem = {};

    if (itemData && typeof itemData === "object") {
      newItem = { ...itemData };
    } else if (
      listFieldConfig.defaultValue &&
      typeof listFieldConfig.defaultValue === "object"
    ) {
      newItem = JSON.parse(JSON.stringify(listFieldConfig.defaultValue));
    } else if (Array.isArray(listFieldConfig.fields)) {
      // Build default item from field configurations
      listFieldConfig.fields.forEach((field) => {
        if (field.propertyName) {
          newItem[field.propertyName] = field.hasOwnProperty("value")
            ? field.value
            : undefined;
        }
      });
    }

    const newList = [...currentList, newItem];
    formFieldsValues[listFieldPath] = newList;

    // Initialize validation states for the new item's fields
    const newIndex = newList.length - 1;
    if (Array.isArray(listFieldConfig.fields)) {
      listFieldConfig.fields.forEach((field) => {
        if (field.propertyName) {
          const fieldPath = `${listFieldPath}[${newIndex}].${field.propertyName}`;
          formFieldsTouchedState[fieldPath] = false;
          formFieldsDirtyState[fieldPath] = false;
          formFieldsValidity[fieldPath] = undefined;
          formFieldsErrorMessages[fieldPath] = undefined;

          // Update initial values
          if (!initialFormFieldsValues[listFieldPath]) {
            initialFormFieldsValues[listFieldPath] = [];
          }
          if (!initialFormFieldsValues[listFieldPath][newIndex]) {
            initialFormFieldsValues[listFieldPath][newIndex] = {};
          }
          initialFormFieldsValues[listFieldPath][newIndex][field.propertyName] =
            newItem[field.propertyName] !== undefined
              ? JSON.parse(JSON.stringify(newItem[field.propertyName]))
              : undefined;
        }
      });
    }
  };

  /**
   * Removes an item from a list field.
   * @param {string} listFieldPath - The path of the list field.
   * @param {number} index - The index of the item to remove.
   */
  const removeItem = (listFieldPath, index) => {
    const listFieldConfig = findFieldConfig(listFieldPath, fields);
    if (!listFieldConfig || listFieldConfig.type !== "list") {
      console.warn(
        `List field configuration not found for path: ${listFieldPath}`
      );
      return;
    }

    const currentList = formFieldsValues[listFieldPath] || [];
    if (index < 0 || index >= currentList.length) return;

    // Clean up validation states for the removed item's fields
    if (Array.isArray(listFieldConfig.fields)) {
      listFieldConfig.fields.forEach((field) => {
        if (field.propertyName) {
          const fieldPath = `${listFieldPath}[${index}].${field.propertyName}`;
          delete formFieldsTouchedState[fieldPath];
          delete formFieldsDirtyState[fieldPath];
          delete formFieldsValidity[fieldPath];
          delete formFieldsErrorMessages[fieldPath];
        }
      });
    }

    // Remove the item
    const newList = currentList.filter((_, i) => i !== index);
    formFieldsValues[listFieldPath] = newList;

    // Update initial values
    if (
      initialFormFieldsValues[listFieldPath] &&
      Array.isArray(initialFormFieldsValues[listFieldPath])
    ) {
      initialFormFieldsValues[listFieldPath].splice(index, 1);
    }

    // Re-index validation states for remaining items
    if (Array.isArray(listFieldConfig.fields)) {
      const itemsToReindex = newList.slice(index);
      itemsToReindex.forEach((_, relativeIndex) => {
        const oldIndex = index + relativeIndex + 1; // +1 because we removed one item
        const newIndex = index + relativeIndex;

        listFieldConfig.fields.forEach((field) => {
          if (field.propertyName) {
            const oldFieldPath = `${listFieldPath}[${oldIndex}].${field.propertyName}`;
            const newFieldPath = `${listFieldPath}[${newIndex}].${field.propertyName}`;

            // Move validation states
            if (formFieldsTouchedState[oldFieldPath] !== undefined) {
              formFieldsTouchedState[newFieldPath] =
                formFieldsTouchedState[oldFieldPath];
              delete formFieldsTouchedState[oldFieldPath];
            }
            if (formFieldsDirtyState[oldFieldPath] !== undefined) {
              formFieldsDirtyState[newFieldPath] =
                formFieldsDirtyState[oldFieldPath];
              delete formFieldsDirtyState[oldFieldPath];
            }
            if (formFieldsValidity[oldFieldPath] !== undefined) {
              formFieldsValidity[newFieldPath] =
                formFieldsValidity[oldFieldPath];
              delete formFieldsValidity[oldFieldPath];
            }
            if (formFieldsErrorMessages[oldFieldPath] !== undefined) {
              formFieldsErrorMessages[newFieldPath] =
                formFieldsErrorMessages[oldFieldPath];
              delete formFieldsErrorMessages[oldFieldPath];
            }
          }
        });
      });
    }
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
    addItem,
    removeItem,
  };
}
