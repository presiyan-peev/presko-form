import { reactive, toRaw, watch } from "vue"; // Added toRaw for accessing raw values if needed, watch for reacting to model changes
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
 * @property {Object} [condition] - Configuration for conditional display of this field.
 * @property {'AND' | 'OR'} [condition.logic='AND'] - How to combine multiple rules. Defaults to 'AND'.
 * @property {Array<ConditionRule>} condition.rules - An array of rules that must be met for the field to be visible.
 * @property {boolean} [clearValueOnHide=false] - If true, the field's value will be reset when it's hidden. Defaults to false.
 */

/**
 * @typedef {Object} ConditionRule
 * @property {string} field - Path to the source field (e.g., 'user.type', 'notificationsEnabled', 'contactMethods[0].type').
 *                           Supports dot notation for nested objects and array indexing for list items.
 * @property {'equals'|'notEquals'|'in'|'notIn'|'greaterThan'|'lessThan'|'greaterThanOrEquals'|'lessThanOrEquals'|'defined'|'undefined'|'matchesRegex'} operator - The comparison operator.
 * @property {any} [value] - The value to compare against (required for most operators).
 *                         For 'in'/'notIn', if `value` is a string, it will be treated as a comma-separated list.
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
 * @property {Object<string, boolean>} formFieldsVisibility - Reactive object tracking the visibility state of each field.
 *   `true` if visible, `false` if hidden. Field names are used as keys.
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
  let formFieldsVisibility = reactive({});
  /** @type {Object<string, any>} */
  let initialFormFieldsValues = {}; // Stores initial values for dirty checking
  /** @type {Object<string, number>} */
  const debounceTimers = {}; // Stores setTimeout IDs for debouncing input validation
  /** @type {Object<string, string[]>} */
  const fieldDependencies = {}; // Stores which fields depend on others for conditional visibility

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

    // Ensure deep clone for objects/arrays when setting on formFieldsValues (targetValuesObject)
    if (typeof initialValue === 'object' && initialValue !== null) {
      targetValuesObject[fieldConfig.propertyName] = JSON.parse(JSON.stringify(initialValue));
    } else {
      targetValuesObject[fieldConfig.propertyName] = initialValue;
    }
    // targetInitialValuesObject already uses deep clone
    targetInitialValuesObject[fieldConfig.propertyName] =
      initialValue !== undefined
        ? JSON.parse(JSON.stringify(initialValue))
        : undefined;

    formFieldsTouchedState[fullPath] = false;
    formFieldsDirtyState[fullPath] = false;
    formFieldsValidity[fullPath] = undefined;
    formFieldsErrorMessages[fullPath] = undefined;
    formFieldsVisibility[fullPath] = true; // Default to visible
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
              ? JSON.parse(JSON.stringify(field.initialValue)) // Deep clone for formFieldsValues
              : [];
          currentInitialValuesTarget[key] =
            field.initialValue && Array.isArray(field.initialValue)
              ? JSON.parse(JSON.stringify(field.initialValue))
              : [];

          formFieldsTouchedState[fullPath] = false;
          formFieldsDirtyState[fullPath] = false;
          formFieldsVisibility[fullPath] = true; // List container itself is visible

          currentModelTarget[key].forEach((item, index) => {
            const itemPathPrefix = `${fullPath}[${index}].`;
            // Initialize visibility for list item fields
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
                  // Visibility for list item fields will be set during overall evaluation
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
          formFieldsVisibility[fullPath] = true; // Sub-form container itself is visible
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
          formFieldsVisibility[fullPath] = true; // Default to visible

          // Register dependencies for conditional fields
          if (field.condition && Array.isArray(field.condition.rules)) {
            const fieldBasePath = getBasePath(fullPath);
            field.condition.rules.forEach(rule => {
              if (rule.field) {
                let sourcePathKey = rule.field;
                // If rule.field is simple and fieldBasePath exists, resolve it
                if (!rule.field.includes('.') && !rule.field.includes('[') && fieldBasePath) {
                  sourcePathKey = fieldBasePath + rule.field;
                  // TODO: Consider if a global fallback for sourcePathKey definition is needed here too,
                  // similar to evaluateFieldVisibility. For now, assume relative paths are intended to be within the same basePath.
                  // If a global var with same simple name is also a dependency, it needs separate explicit rule.
                }
                // else, rule.field is already absolute or global-like

                if (!fieldDependencies[sourcePathKey]) {
                  fieldDependencies[sourcePathKey] = [];
                }
                if (!fieldDependencies[sourcePathKey].includes(fullPath)) {
                  fieldDependencies[sourcePathKey].push(fullPath);
                }
              }
            });
          }
        }
      });
    }
  };


  /**
   * Updates the stored initial value of a field. This is primarily used for dirty state calculation
   * when the parent form's model provides new baseline values.
   * @param {string} fieldPath - The path of the field (supports nested paths like 'profile.name' or 'contacts[0].name').
   * @param {any} value - The new initial value for the field.
   */
  const updateFieldInitialValue = (fieldPath, value) => {
    // This function might need to re-evaluate visibility if initial values change,
    // but typically initial values are set once.
    // For now, it primarily affects dirty checking.
    const fieldConfig = findFieldConfig(fieldPath, fields);
    if (fieldConfig && (fieldConfig.propertyName || fieldConfig.subForm || fieldConfig.type === 'list')) {
      const serializedValue =
        value !== undefined ? JSON.parse(JSON.stringify(value)) : undefined;

      setValueByPath(initialFormFieldsValues, fieldPath, serializedValue);

      if (getValueByPath(formFieldsValues, fieldPath) === undefined && value !== undefined) {
        setValueByPath(formFieldsValues, fieldPath, JSON.parse(JSON.stringify(value))); // Use a copy
        formFieldsDirtyState[fieldPath] = false; // Reset dirty state as it now matches the new initial value
      } else {
        // Re-check dirty state if the field already had a value
        checkFieldDirty(fieldPath, getValueByPath(formFieldsValues, fieldPath));
      }
    }
  };

  /**
   * Helper function to get a value by path from an object.
   * Handles dot notation for objects and bracket notation for arrays.
   * @private
   * @param {Object} obj - The object to get the value from.
   * @param {string} path - The path to the value (e.g., 'user.name', 'addresses[0].street').
   * @returns {any} The value at the path or undefined if not found.
   */
  const getValueByPath = (obj, path) => {
    if (!path || typeof path !== 'string') return undefined;
    // Adjusted to handle paths that might start with an array index if obj is an array itself
    // and to correctly parse paths like 'list[0].field' vs 'obj.list[0].field'
    return path.split(/[.[\]]+/).filter(Boolean).reduce((current, key) => {
        if (current === null || current === undefined) return undefined;
        if (Array.isArray(current) && /^\d+$/.test(key)) {
            return current[parseInt(key)];
        }
        return typeof current === 'object' ? current[key] : undefined;
    }, obj);
  };


  /**
   * Helper function to set a value by path in an object.
   * Handles dot notation for objects and bracket notation for arrays.
   * @private
   * @param {Object} obj - The object to set the value in.
   * @param {string} path - The path to set the value at (e.g., 'user.name', 'addresses[0].street').
   * @param {any} value - The value to set.
   */
  const setValueByPath = (obj, path, value) => {
    if (!path || typeof path !== 'string') return;

    const parts = path.split(/[.[\]]+/).filter(Boolean);
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      const nextKey = parts[i+1];
      const isNextKeyArrayIndex = /^\d+$/.test(nextKey);

      if (current[key] === undefined || current[key] === null) {
        current[key] = isNextKeyArrayIndex ? [] : {};
      }
      current = current[key];
    }
    if (parts.length > 0) {
        const finalKey = parts[parts.length - 1];
        if (Array.isArray(current[finalKey]) && Array.isArray(value) && value.length === 0) {
            current[finalKey].length = 0; // Clear existing array proxy in place
            // Optionally, if current[finalKey] should become a new empty array reference:
            // current[finalKey] = [];
            // But modifying length is often better for reactivity on existing array proxies.
        } else {
            current[finalKey] = value;
        }
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
   * @param {string} fieldPath - The path of the field to find (e.g., 'user.name', 'addresses[0].street').
   * @param {Array<FieldConfig>} searchFields - The array of field configurations to search within.
   * @param {string} [currentPathPrefix=""] - Used internally for recursion to build the full path.
   * @returns {FieldConfig|null} The field configuration or null if not found.
   */
  const findFieldConfig = (fieldPath, searchFields = fields, currentPathPrefix = "") => {
    if (!searchFields || !Array.isArray(searchFields)) return null;

    for (const field of searchFields) {
        const key = field.propertyName || field.subForm;
        if (!key) continue;

        const fullPath = currentPathPrefix ? `${currentPathPrefix}${key}` : key;

        if (fullPath === fieldPath) {
            return field;
        }

        if (field.type === 'list' && fieldPath.startsWith(fullPath + '[')) {
            // Path is like 'myList[0].subField'
            const listItemPathMatch = fieldPath.match(/\[\d+\]\.(.+)$/); // e.g., from "list[0].child" gets "child"
            if (listItemPathMatch && field.fields) {
                const childFieldName = listItemPathMatch[1];
                // Search for 'childFieldName' in the list item's field definitions
                const foundChild = findFieldConfig(childFieldName, field.fields);
                if (foundChild) return foundChild;
            }
            // If we're looking for the list itself (e.g. path is 'myList' or 'myList[0]' without further children specified for config lookup)
            // and fullPath matches fieldPath, it would have been caught by the `if (fullPath === fieldPath)` above.
            // This branch means fieldPath is like 'myList[0]' and we didn't find a specific child config,
            // or it's 'myList[0].nonExistentChild'. In this context, returning the list field 'field' itself might be problematic
            // if the caller expects a child's config.
            // However, if fieldPath is 'myList[0]', and that's what we are looking for, it should have matched earlier.
            // This part of logic implies we are trying to resolve a child of a list item.
            return null; // More accurate: if specific child not found, return null.
        }

        if (field.subForm && field.fields && fieldPath.startsWith(fullPath + '.')) {
            const remainingPath = fieldPath.substring(fullPath.length + 1);
            const foundInSubForm = findFieldConfig(remainingPath, field.fields, ""); // No prefix for sub-form's own context
            if (foundInSubForm) return foundInSubForm;
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

  /**
   * Validates a single field and updates its validation state.
   * @param {string} fieldPath - The path of the field to validate.
   * @param {any} input - The input value to validate.
   * @returns {boolean} True if the field is valid, false otherwise.
   */
  const validateField = (fieldPath, input) => {
    const fieldConfig = findFieldConfig(fieldPath, fields);
    if (!fieldConfig) {
      console.warn(`Field configuration not found for path: ${fieldPath}`);
      return true; // Assume valid if no config found
    }

    // If field is not visible, it's considered valid (or not applicable for validation)
    if (formFieldsVisibility[fieldPath] === false) {
        updateValidationState(fieldPath, true); // Clear any existing errors
        return true;
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
   * @returns {boolean} True if all VISIBLE fields are valid, false otherwise.
   */
  const validateFormPurelyRecursive = (
    formToValidate,
    currentFieldsConfig,
    pathPrefix = ""
  ) => {
    if (!currentFieldsConfig || !Array.isArray(currentFieldsConfig)) return true;
    let allValid = true;

    currentFieldsConfig.forEach((field) => {
      const key = field.propertyName || field.subForm;
      if (!key) return;

      const fullPath = pathPrefix + key;

      // Skip validation for non-visible fields
      if (formFieldsVisibility[fullPath] === false && !field.subForm && field.type !== 'list') { // Subforms and lists might have visible children
        return;
      }


      if (field.type === "list") {
        const listValue = getValueByPath(formToValidate, key); // Use getValueByPath for consistency
        if (Array.isArray(listValue) && Array.isArray(field.fields)) {
          listValue.forEach((item, index) => {
            if (typeof item === "object" && item !== null) {
              field.fields.forEach((subField) => {
                if (subField.propertyName) {
                  const subFieldPath = `${fullPath}[${index}].${subField.propertyName}`;
                  if (formFieldsVisibility[subFieldPath] === false) return; // Skip hidden list item fields
                  const subFieldValue = getValueByPath(item, subField.propertyName);
                  if (!validateField(subFieldPath, subFieldValue)) {
                    allValid = false;
                  }
                }
              });
            }
          });
        }
      } else if (field.subForm && field.fields) {
        const subFormValue = getValueByPath(formToValidate, key);
        if (typeof subFormValue === "object" && subFormValue !== null) {
           if (!validateFormPurelyRecursive(subFormValue, field.fields, `${fullPath}.`)) {
             allValid = false;
           }
        }
      } else if (field.propertyName) {
        // For regular fields, visibility is already checked at the start of the loop for this field.
        const fieldValue = getValueByPath(formToValidate, field.propertyName); // Access directly from current formToValidate scope
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
      (validationTrigger === "onBlur" && (triggerType === "blur" || triggerType === "submit")) ||
      (validationTrigger === "onInput" && (triggerType === "input" || triggerType === "blur" || triggerType === "submit")) ||
      (validationTrigger === "onSubmit" && triggerType === "submit");

    if (!shouldValidate) return;

    const fieldValue = getValueByPath(currentFormModel, fieldPath);

    const performValidation = () => {
      validateField(fieldPath, fieldValue); // fieldValue captured from outer scope
    };

    // Apply debouncing for input events when using onInput trigger
    if (triggerType === "input" && validationTrigger === "onInput") {
      debounceTimers[fieldPath] = setTimeout(performValidation, inputDebounceMs);
    } else {
      performValidation();
    }

    // After validation (or setting value), check for dependent fields and update their visibility
    if (fieldDependencies[fieldPath]) {
        fieldDependencies[fieldPath].forEach(dependentFieldPath => {
            updateFieldVisibility(dependentFieldPath, currentFormModel);
        });
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
    const initialVal = getValueByPath(initialFormFieldsValues, fieldPath);
    // Ensure consistent comparison, especially for objects/arrays
    const isDirty = JSON.stringify(currentValue) !== JSON.stringify(initialVal);

    if (formFieldsDirtyState[fieldPath] !== isDirty) {
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
          // Visibility will be set by updateFieldVisibility if it's conditional
          // For now, assume visible unless a condition makes it otherwise.
          // This requires the global model to be passed or accessible.
          // For simplicity, new list items are visible by default.
          // Their conditions will be evaluated if their source dependencies change.
          formFieldsVisibility[fieldPath] = true;


          // Update initial values for the new item's fields
          let listInitialValues = getValueByPath(initialFormFieldsValues, listFieldPath);
          if (!Array.isArray(listInitialValues)) {
            listInitialValues = [];
            setValueByPath(initialFormFieldsValues, listFieldPath, listInitialValues);
          }
          while (listInitialValues.length <= newIndex) {
            listInitialValues.push({});
          }
          setValueByPath(initialFormFieldsValues, `${listFieldPath}[${newIndex}].${field.propertyName}`,
            newItem[field.propertyName] !== undefined ? JSON.parse(JSON.stringify(newItem[field.propertyName])) : undefined
          );

          // If the new field has conditions, register its dependencies
           if (field.condition && Array.isArray(field.condition.rules)) {
            field.condition.rules.forEach(rule => {
              if (rule.field) { // rule.field is the source field this new fieldPath depends on
                // The source field path might be relative or absolute.
                // For simplicity, assume rule.field is an absolute path for now or relative to form root.
                // Proper resolution for rule.field within list items (e.g. depending on another field in the SAME item) needs careful path construction.
                // Example: rule.field = 'myList[INDEX].anotherProperty'
                // This part needs to be robust if conditions refer to fields within the same list item or other list items.
                // For now, we assume rule.field is a full path.
                if (!fieldDependencies[rule.field]) {
                  fieldDependencies[rule.field] = [];
                }
                if (!fieldDependencies[rule.field].includes(fieldPath)) {
                  fieldDependencies[rule.field].push(fieldPath);
                }
              }
            });
          }
        }
      });
    }
    // After adding an item, re-evaluate visibility of fields that might depend on list length or added item values if necessary.
    // This is complex; for now, direct dependencies on the added item's fields will be handled if those fields change value.
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
          delete formFieldsVisibility[fieldPath]; // Also remove visibility state

          // Clean up dependencies: if this field was a dependent, remove it
          Object.keys(fieldDependencies).forEach(sourceField => {
            const indexToRemove = fieldDependencies[sourceField].indexOf(fieldPath);
            if (indexToRemove > -1) {
              fieldDependencies[sourceField].splice(indexToRemove, 1);
            }
          });
          // If this field was a source for other dependencies (unlikely for list item fields themselves, but good practice)
          // delete fieldDependencies[fieldPath]; // This would be if fieldPath itself was a key in fieldDependencies
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
            if (formFieldsVisibility[oldFieldPath] !== undefined) {
                formFieldsVisibility[newFieldPath] = formFieldsVisibility[oldFieldPath];
                delete formFieldsVisibility[oldFieldPath];
            }

            // Update dependencies map if this fieldPath was part of any dependency rule
            // This is tricky because the field path itself changes.
            // It's often simpler to rebuild dependencies or ensure robust path matching.
            // For now, we assume direct path matches in fieldDependencies keys and values.
            // If oldFieldPath was a dependent:
            Object.keys(fieldDependencies).forEach(sourceField => {
                const depIndex = fieldDependencies[sourceField].indexOf(oldFieldPath);
                if (depIndex > -1) {
                    fieldDependencies[sourceField][depIndex] = newFieldPath; // Update to new path
                }
            });
            // If oldFieldPath was a source dependency (less common for list item fields):
            if (fieldDependencies[oldFieldPath]) {
                fieldDependencies[newFieldPath] = fieldDependencies[oldFieldPath];
                delete fieldDependencies[oldFieldPath];
            }

          }
        });
      });
    }
  };

  // --- Conditional Logic Implementation ---

  /**
   * Extracts the base path from a field path.
   * e.g., 'a.b.c[0].d' -> 'a.b.c[0].'
   * e.g., 'topLevel' -> ''
   * @private
   * @param {string} fieldPath - The full path of the field.
   * @returns {string} The base path, ending with a dot if not empty.
   */
  const getBasePath = (fieldPath) => {
    const lastDotIndex = fieldPath.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return ""; // Top-level field, no base path
    }
    return fieldPath.substring(0, lastDotIndex + 1); // Include the trailing dot
  };

  /**
   * Evaluates a single condition rule.
   * @private
   * @param {ConditionRule} rule - The condition rule to evaluate.
   * @param {any} sourceValue - The value of the source field defined in rule.field.
   * @returns {boolean} True if the rule is met, false otherwise.
   */
  const evaluateConditionRule = (rule, sourceValue) => {
    const targetValue = rule.value;
    switch (rule.operator) {
      case 'equals': return sourceValue === targetValue;
      case 'notEquals': return sourceValue !== targetValue;
      case 'in':
        if (Array.isArray(targetValue)) return targetValue.includes(sourceValue);
        if (typeof targetValue === 'string') return targetValue.split(',').map(s => s.trim()).includes(String(sourceValue));
        return false;
      case 'notIn':
        if (Array.isArray(targetValue)) return !targetValue.includes(sourceValue);
        if (typeof targetValue === 'string') return !targetValue.split(',').map(s => s.trim()).includes(String(sourceValue));
        return true;
      case 'greaterThan': return sourceValue > targetValue;
      case 'lessThan': return sourceValue < targetValue;
      case 'greaterThanOrEquals': return sourceValue >= targetValue;
      case 'lessThanOrEquals': return sourceValue <= targetValue;
      case 'defined': return sourceValue !== undefined && sourceValue !== null;
      case 'undefined': return sourceValue === undefined || sourceValue === null;
      case 'matchesRegex':
        try {
          return new RegExp(targetValue).test(String(sourceValue));
        } catch (e) {
          console.error("Invalid regex in condition:", targetValue, e);
          return false;
        }
      default: return false;
    }
  };

  /**
   * Evaluates the visibility of a field based on its conditions.
   * @private
   * @param {string} fieldPathToEvaluate - The path of the field whose visibility is being determined.
   * @param {Object} currentFormModel - The current state of the entire form model.
   * @returns {boolean} True if the field should be visible, false otherwise.
   */
  const evaluateFieldVisibility = (fieldPathToEvaluate, currentFormModel) => {
    const fieldConfig = findFieldConfig(fieldPathToEvaluate, fields);
    if (!fieldConfig || !fieldConfig.condition || !Array.isArray(fieldConfig.condition.rules) || fieldConfig.condition.rules.length === 0) {
      return true; // No conditions, so visible by default
    }

    const { rules, logic = 'AND' } = fieldConfig.condition;
    const basePath = getBasePath(fieldPathToEvaluate);
    let overallResult = logic === 'AND';

    for (const rule of rules) {
      let sourceValue;
      const conditionSourcePath = rule.field;

      if (conditionSourcePath.includes('.') || conditionSourcePath.includes('[')) {
        // Absolute-like path, resolve from root
        sourceValue = getValueByPath(currentFormModel, conditionSourcePath);
      } else {
        // Simple path (e.g., 'siblingField')
        if (basePath) {
          // Try relative path first if a basePath exists
          sourceValue = getValueByPath(currentFormModel, basePath + conditionSourcePath);
        }

        // If not found via relative path (or if no basePath), try as a global path
        if (sourceValue === undefined) {
          sourceValue = getValueByPath(currentFormModel, conditionSourcePath);
        }
      }

      const ruleResult = evaluateConditionRule(rule, sourceValue);

      if (logic === 'AND') {
        if (!ruleResult) {
          overallResult = false;
          break;
        }
      } else { // OR logic
        if (ruleResult) {
          overallResult = true;
          break;
        }
      }
    }
    return overallResult;
  };


  /**
   * Updates the visibility state of a field and handles side effects (validation reset, value clearing).
   * @private
   * @param {string} fieldPath - The path of the field to update.
   * @param {Object} currentFormModel - The current form model.
   */
  const updateFieldVisibility = (fieldPath, currentFormModel) => {
    const fieldConfig = findFieldConfig(fieldPath, fields);
    if (!fieldConfig) return;

    const oldVisibility = formFieldsVisibility[fieldPath];
    const newVisibility = evaluateFieldVisibility(fieldPath, currentFormModel);

    if (oldVisibility === newVisibility) return; // No change

    formFieldsVisibility[fieldPath] = newVisibility;

    if (!newVisibility) { // Field becomes hidden
      resetValidationState(fieldPath); // Clear validation errors and status

      if (fieldConfig.clearValueOnHide) {
        // Determine appropriate empty/initial value
        let resetValue = undefined; // Default reset value
        if (fieldConfig.type === 'list') {
          resetValue = [];
        } else if (fieldConfig.fields) { // It's a sub-form object
          resetValue = {};
        }
        // For simple fields, 'undefined' is the default reset.
        // The PRD mentioned "or its initial value if defined" - this part is being removed for clearer "clearing".
        // If a field needs to reset to a specific initial value rather than undefined,
        // that could be a separate feature or configuration like `resetToInitialValueOnHide`.

        setValueByPath(formFieldsValues, fieldPath, resetValue); // Update internal model
        // Note: Propagating this change to the parent component's v-model is complex.
        // PreskoForm would need to watch formFieldsValues or receive events.
        // For now, the internal model is updated. External sync is a larger architectural concern.
        // Re-check dirty state after clearing value
        checkFieldDirty(fieldPath, resetValue);
      }
      // If this hidden field itself is a dependency for others, they might need re-evaluation.
      // This creates a potential cascade. The current dependency tracking (source changes -> dependent updates)
      // should handle this if the hidden field's value change (due to clearValueOnHide) triggers further updates.
      // If clearValueOnHide is false, the value remains, so dependent fields shouldn't change based on this event alone.

    } else { // Field becomes visible
      // If field becomes visible, its current value is retained.
      // Validation might be triggered depending on form settings (e.g., validate on change/blur)
      // but this function itself doesn't trigger validation directly.
      // The user interaction or a subsequent validation pass would catch it.
    }

    // If the visibility of this field (fieldPath) changed, and *other* fields depend on *its* value (fieldPath is a source dependency)
    // then those other fields visibility should be re-evaluated.
    // This is handled by the watchEffect on formFieldsValues or when triggerValidation is called.
    // However, if `clearValueOnHide` changed its value, that change should trigger updates for its dependents.
    if (fieldDependencies[fieldPath]) {
        fieldDependencies[fieldPath].forEach(dependentFieldPath => {
            if (dependentFieldPath !== fieldPath) { // Avoid self-recursion if a field somehow depends on itself
                 updateFieldVisibility(dependentFieldPath, currentFormModel);
            }
        });
    }
  };

  // Initialize all field visibilities after states and dependencies are built
  const initializeAllVisibilities = (currentFields, pathPrefix = "", currentScopedModel, rootModelForConditionEvaluation) => {
    currentFields.forEach(field => {
      const key = field.propertyName || field.subForm;
      if (!key) return;
      const fullPath = pathPrefix + key;

      if (field.condition) {
        // ALWAYS use rootModelForConditionEvaluation for evaluating visibility conditions
        updateFieldVisibility(fullPath, rootModelForConditionEvaluation);
      }

      if (field.subForm && field.fields) {
        const subModel = getValueByPath(currentScopedModel, key) || {};
        // Pass currentScopedModel's relevant part for further recursion, but keep passing rootModelForConditionEvaluation
        initializeAllVisibilities(field.fields, `${fullPath}.`, subModel, rootModelForConditionEvaluation);
      } else if (field.type === 'list' && field.fields) {
        const listItems = getValueByPath(currentScopedModel, key) || [];
        listItems.forEach((item, index) => {
          const itemPathPrefix = `${fullPath}[${index}].`;
          const itemModel = item || {}; // itemModel here is for traversing the list structure
          initializeAllVisibilities(field.fields, itemPathPrefix, itemModel, rootModelForConditionEvaluation);
        });
      }
    });
  };

  // Initial setup
  initFormStates(fields); // Sets up states, including default visibility and dependency map
  // Use the reactive formFieldsValues for the first visibility evaluation
  // to ensure consistency with how the watcher will evaluate later.
  // And pass it as the rootModelForConditionEvaluation as well.
  initializeAllVisibilities(fields, "", formFieldsValues, formFieldsValues);


  // Watch for changes in any field value that is a source dependency
  // This is a simplified approach. A more granular watch on specific formFieldsValues paths
  // or integrating with how `triggerValidation` gets currentFormModel would be more robust.
  // This requires `formFieldsValues` to be accurately reflecting the overall form model.
  // In PreskoForm, the true model is often managed by the parent component via v-model.
  // This watch assumes `formFieldsValues` is kept in sync or is the source of truth.

  // This watch might be too broad. Consider making it more specific or integrating updates
  // into where field values are known to change (e.g., after `triggerValidation` or direct `formFieldsValues` mutation).
  watch(formFieldsValues, (newModel /*, oldModel */) => {
    // Re-evaluate all fields that have conditions. This is less efficient than precise dependency tracking
    // but can help overcome issues with complex change detection in the watcher.
    const reevaluateRecursive = (configFields, prefix, modelToUse) => {
        configFields.forEach(fieldConfig => {
            const key = fieldConfig.propertyName || fieldConfig.subForm;
            if (!key) return;
            const currentFullPath = prefix + key;

            if (fieldConfig.condition && fieldConfig.condition.rules && fieldConfig.condition.rules.length > 0) {
                updateFieldVisibility(currentFullPath, modelToUse);
            }

            if (fieldConfig.subForm && fieldConfig.fields) {
                reevaluateRecursive(fieldConfig.fields, `${currentFullPath}.`, modelToUse);
            } else if (fieldConfig.type === 'list' && fieldConfig.fields) {
                const listItems = getValueByPath(modelToUse, currentFullPath) || [];
                listItems.forEach((item, index) => {
                    // For children of list items, their full path includes the index
                    // and their conditions are evaluated against the root modelToUse.
                    // The field configs (fieldConfig.fields) are for properties *within* each item.
                    reevaluateRecursive(fieldConfig.fields, `${currentFullPath}[${index}].`, modelToUse);
                });
            }
        });
    };
    reevaluateRecursive(fields, "", newModel);

  }, { deep: true });


  return {
    formFieldsValues,
    formFieldsValidity,
    formFieldsErrorMessages,
    formFieldsTouchedState,
    formFieldsDirtyState,
    formFieldsVisibility, // Expose visibility state
    validateField,
    validateFormPurely,
    setFieldTouched,
    checkFieldDirty,
    updateFieldInitialValue,
    triggerValidation,
    resetValidationState,
    addItem,
    removeItem,
    // Potentially expose evaluateFieldVisibility or updateFieldVisibility if external manual control is needed
  };
}
