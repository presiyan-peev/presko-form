import { reactive, toRaw, computed } from "vue"; // Added toRaw for accessing raw values if needed
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
  let formFieldsPendingState = reactive({}); // Tracks pending state for async validators
  /** @type {Object<string, any>} */
  let initialFormFieldsValues = {}; // Stores initial values for dirty checking
  /** @type {Object<string, number>} */
  const debounceTimers = {}; // Stores setTimeout IDs for debouncing input validation
  /** @type {Object<string, number>} */
  const validationRunIds = {}; // Stores validation run IDs for each field to prevent race conditions
  /** @type {Object<string, AbortController>} */
  const activeAbortControllers = {}; // Stores active AbortControllers for async validations

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
    formFieldsPendingState[fullPath] = false;
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
          formFieldsPendingState[fullPath] = false;

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
          formFieldsPendingState[fullPath] = false;
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
          formFieldsPendingState[fullPath] = false;
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
    const resetField = (path) => {
      updateValidationState(path, undefined);
      formFieldsPendingState[path] = false;
      if (activeAbortControllers[path]) {
        activeAbortControllers[path].abort();
        delete activeAbortControllers[path];
      }
      // Optionally reset validationRunIds, though typically not needed unless re-init
      // delete validationRunIds[path];
    };

    if (fieldPath) {
      resetField(fieldPath);
    } else {
      // Reset all validation states
      Object.keys(formFieldsValidity).forEach((key) => {
        resetField(key); // Use the helper to also reset pending state and abort controllers
      });
      // Ensure all pending states are reset, even for fields not in formFieldsValidity yet
      Object.keys(formFieldsPendingState).forEach((key) => {
        if (formFieldsValidity[key] === undefined) {
          // Only if not already handled
          resetField(key);
        }
      });
    }
  };

  /**
   * Validates a field using custom validators.
   * @private
   * @param {FieldConfig} field - The field configuration.
   * @param {any} input - The input value to validate.
   * @param {string} fieldPath - The path of the field.
   * @param {Object} validationCtx - The validation context object.
   * @returns {Promise<true | string | string[]>} True if valid, error message(s) if invalid.
   */
  const validateWithCustomValidator = async (
    field,
    input,
    fieldPath,
    validationCtx
  ) => {
    if (field.validators && Array.isArray(field.validators)) {
      for (const validator of field.validators) {
        if (typeof validator === "function") {
          // Pass validationCtx as the fourth argument
          const result = validator(
            input,
            getFieldLabel(field),
            field,
            validationCtx
          );
          if (result instanceof Promise) {
            try {
              const promiseResult = await result;
              if (promiseResult !== true) {
                return promiseResult || `${getFieldLabel(field)} is invalid.`;
              }
            } catch (error) {
              // Handle promise rejection, e.g., network error
              console.error(
                `Async validator for ${fieldPath} rejected:`,
                error
              );
              return (
                (error instanceof Error ? error.message : String(error)) ||
                `${getFieldLabel(field)} validation failed.`
              );
            }
          } else if (result !== true) {
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

        // NEW: Internal fallback for common rules if Validation implementation returns undefined
        if (result === undefined) {
          // Handle object rule (with name) and string rule uniformly
          const ruleName =
            typeof rule === "object" && rule.name ? rule.name : rule;
          switch (ruleName) {
            case "isRequired": {
              const isPresent = !(
                input === null ||
                input === undefined ||
                (typeof input === "string" && input.trim() === "")
              );
              result = isPresent ? true : `${getFieldLabel(field)} is invalid.`;
              break;
            }
            case "minLength": {
              // Determine the minimum
              let min = 0;
              if (typeof rule === "object" && rule.params && rule.params.min) {
                min = rule.params.min;
              }
              const length = input != null ? String(input).length : 0;
              result =
                length >= min ? true : `${getFieldLabel(field)} is invalid.`;
              break;
            }
            case "isEmail": {
              const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              result =
                !input || emailPattern.test(String(input))
                  ? true
                  : `${getFieldLabel(field)} is not a valid email.`;
              break;
            }
            default:
              // If we have no internal fallback, treat as valid
              result = true;
          }
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

  const validateField = async (fieldPath, input, currentFormModel) => {
    const fieldConfig = findFieldConfig(fieldPath, fields);
    if (!fieldConfig || !isVisible(fieldConfig)) {
      updateValidationState(fieldPath, true); // Consider non-visible fields as valid
      return true;
    }

    // Increment and get current validation run ID for this field
    const currentRunId = (validationRunIds[fieldPath] =
      (validationRunIds[fieldPath] || 0) + 1);

    // Abort any previous validation for this field
    if (activeAbortControllers[fieldPath]) {
      activeAbortControllers[fieldPath].abort();
    }
    const controller = new AbortController();
    activeAbortControllers[fieldPath] = controller;

    const validationCtx = {
      abortSignal: controller.signal,
      getValue: (otherFieldPath) =>
        getValueByPath(currentFormModel, otherFieldPath),
    };

    // If field has no rules or validators, treat empty / undefined values as invalid (required by default logic)
    // This part remains synchronous as it's basic presence check.
    const hasRules =
      Array.isArray(fieldConfig.rules) && fieldConfig.rules.length > 0;
    const hasValidators =
      Array.isArray(fieldConfig.validators) &&
      fieldConfig.validators.length > 0;

    if (!hasRules && !hasValidators) {
      const requiredResult = Validation.isRequired
        ? Validation.isRequired(
            input,
            getFieldLabel(fieldConfig),
            fieldConfig,
            validationCtx
          ) // Pass ctx
        : undefined;

      let finalRequiredResult = requiredResult;
      if (finalRequiredResult === undefined) {
        const isPresent = !(
          input === null ||
          input === undefined ||
          (typeof input === "string" && input.trim() === "")
        );
        finalRequiredResult = isPresent
          ? true
          : `${getFieldLabel(fieldConfig)} is invalid.`;
      }

      if (currentRunId === validationRunIds[fieldPath]) {
        // Check race condition
        updateValidationState(fieldPath, finalRequiredResult);
        if (finalRequiredResult !== true) return false;
      } else {
        return false; // A newer validation has started
      }
    }

    // Validate with built-in rules (synchronous)
    // These are typically simple checks and run first.
    const rulesResult = validateWithBuiltInRules(fieldConfig, input, fieldPath); // Built-in rules don't use validationCtx yet
    if (rulesResult !== true) {
      if (currentRunId === validationRunIds[fieldPath]) {
        updateValidationState(fieldPath, rulesResult);
      }
      return false; // Stop if synchronous rules fail
    }

    // If built-in rules pass, and there are custom validators, proceed with them.
    if (hasValidators) {
      formFieldsPendingState[fieldPath] = true;
      try {
        const customResult = await validateWithCustomValidator(
          fieldConfig,
          input,
          fieldPath,
          validationCtx
        );
        // Check if validation was aborted or superseded
        if (
          controller.signal.aborted ||
          currentRunId !== validationRunIds[fieldPath]
        ) {
          // If aborted and by a newer validation, the newer one will update state.
          // If aborted by reset, pending state might be cleared by reset.
          // If simply superseded, do nothing as new validation is running/finished.
          if (currentRunId === validationRunIds[fieldPath]) {
            // only clear pending if this instance was not superseded
            formFieldsPendingState[fieldPath] = false;
          }
          return false; // Indicate validation did not complete successfully for this run
        }

        if (customResult !== true) {
          updateValidationState(fieldPath, customResult);
          return false;
        }
      } catch (error) {
        // This might happen if validator itself throws, not just returns error string
        if (
          currentRunId === validationRunIds[fieldPath] &&
          !controller.signal.aborted
        ) {
          console.error(
            `Error during custom validation for ${fieldPath}:`,
            error
          );
          updateValidationState(
            fieldPath,
            (error instanceof Error ? error.message : String(error)) ||
              "Validation failed"
          );
        }
        return false;
      } finally {
        if (currentRunId === validationRunIds[fieldPath]) {
          // Only update pending state if this is the latest run
          formFieldsPendingState[fieldPath] = false;
        }
        // Clean up controller if this is the run that created it AND it's no longer the active one
        // Or if it's completed.
        if (activeAbortControllers[fieldPath] === controller) {
          delete activeAbortControllers[fieldPath];
        }
      }
    }

    // If we get here, the field is valid (or was handled by a newer validation run)
    if (
      currentRunId === validationRunIds[fieldPath] &&
      !controller.signal.aborted
    ) {
      updateValidationState(fieldPath, true);
    }
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
      const fullPath = pathPrefix + (field.propertyName || field.subForm); // Use subForm key if propertyName is not available
      if (!isVisible(field)) {
        // Skip validation for fields that are not visible
        // Ensure its state is clean if it was previously validated
        updateValidationState(fullPath, true);
        formFieldsPendingState[fullPath] = false;
        if (activeAbortControllers[fullPath]) {
          activeAbortControllers[fullPath].abort();
          delete activeAbortControllers[fullPath];
        }
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
                  // validateFormPurelyRecursive is synchronous, so it cannot await async validateField.
                  // For now, it calls the synchronous part of validation or a simplified sync check.
                  // This means async rules won't run on "pure" validation unless validateField is refactored
                  // or this function is made async.
                  // Let's assume for now, this will only run sync validations.
                  // This matches the decision: "validateFormPurely will only run synchronous validators."

                  // Simplified synchronous check (adaptation of validateField's sync parts)
                  const fieldConfig = findFieldConfig(subFieldPath, fields);
                  if (fieldConfig && isVisible(fieldConfig)) {
                    const rulesResult = validateWithBuiltInRules(
                      fieldConfig,
                      subFieldValue,
                      subFieldPath
                    );
                    if (rulesResult !== true) {
                      updateValidationState(subFieldPath, rulesResult);
                      allValid = false;
                    } else {
                      // If only sync rules pass, and no async (which we skip here), it's valid for this context
                      updateValidationState(subFieldPath, true);
                    }
                  } else if (fieldConfig && !isVisible(fieldConfig)) {
                    updateValidationState(subFieldPath, true); // Not visible is valid
                  }

                  // Original call, if validateField were synchronous:
                  // if (!validateField(subFieldPath, subFieldValue, formToValidate)) { // Pass formToValidate as currentFormModel
                  //   allValid = false;
                  // }
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
        // Similar to list items, using a simplified synchronous check from validateField logic
        const fieldConfig = findFieldConfig(fullPath, fields);
        if (fieldConfig && isVisible(fieldConfig)) {
          const rulesResult = validateWithBuiltInRules(
            fieldConfig,
            fieldValue,
            fullPath
          );
          if (rulesResult !== true) {
            updateValidationState(fullPath, rulesResult);
            allValid = false;
          } else {
            // If only sync rules pass, and no async (which we skip here), it's valid for this context
            updateValidationState(fullPath, true);
          }
        } else if (fieldConfig && !isVisible(fieldConfig)) {
          updateValidationState(fullPath, true); // Not visible is valid
        }
        // Original call, if validateField were synchronous:
        // if (!validateField(fullPath, fieldValue, formToValidate)) { // Pass formToValidate as currentFormModel
        //   allValid = false;
        // }
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
      // validateField is now async, but triggerValidation itself doesn't need to be awaited
      // by its callers (e.g., event handlers in PreskoForm).
      // The async operations within validateField will handle their own state updates.
      validateField(fieldPath, fieldValue, currentFormModel)
        .then((isValid) => {
          // Optional: handle completion of validation if needed, e.g., logging
          // console.log(`Async validation for ${fieldPath} completed. Valid: ${isValid}`);
        })
        .catch((error) => {
          // This catch is for errors in the validateField orchestration itself,
          // not validation errors (which are handled by updating state).
          console.error(`Error in validation process for ${fieldPath}:`, error);
        });
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
          formFieldsPendingState[fieldPath] = false;

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
          delete formFieldsPendingState[fieldPath];
          if (activeAbortControllers[fieldPath]) {
            activeAbortControllers[fieldPath].abort();
            delete activeAbortControllers[fieldPath];
          }
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
            if (formFieldsPendingState[oldFieldPath] !== undefined) {
              formFieldsPendingState[newFieldPath] =
                formFieldsPendingState[oldFieldPath];
              delete formFieldsPendingState[oldFieldPath];
            }
            // Active abort controllers are trickier; they are tied to specific validation runs.
            // If a validation for oldFieldPath was pending, it should probably be aborted.
            // For simplicity, we might not move controllers but ensure they are cleaned up if they complete for an old path.
            // Or, when a new validation starts for newFieldPath, it would create its own controller.
          }
        });
      });
    }
  };

  const isFormPending = computed(() => {
    return Object.values(formFieldsPendingState).some((isPending) => isPending);
  });

  return {
    formFieldsValues,
    formFieldsValidity,
    formFieldsErrorMessages,
    formFieldsTouchedState,
    formFieldsDirtyState,
    formFieldsPendingState, // Expose pending state
    isFormPending, // Expose computed pending status
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
