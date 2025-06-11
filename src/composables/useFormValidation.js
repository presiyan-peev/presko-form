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
 * @property {Function} updateFieldInitialValue - Function to update the initial value of a field.
 */
export function useFormValidation(fields) {
  /** @type {Object<string, any>} */
  let formFieldsValues = reactive({}); // Holds form field values, including arrays for lists
  /** @type {Object<string, boolean|undefined>} */
  let formFieldsValidity = reactive({}); // Holds validity states, using paths like 'listName[0].fieldName'
  /** @type {Object<string, string|undefined>} */
  let formFieldsErrorMessages = reactive({}); // Holds error messages, using paths like 'listName[0].fieldName'
  /** @type {Object<string, boolean>} */
  let formFieldsTouchedState = reactive({}); // Holds touched states, using paths like 'listName[0].fieldName'
  /** @type {Object<string, boolean>} */
  let formFieldsDirtyState = reactive({}); // Holds dirty states, using paths like 'listName[0].fieldName'
  /** @type {Object<string, any>} */
  let initialFormFieldsValues = {}; // Holds initial values for dirty checking, including arrays and their item values

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
   * Initializes a single field's state (value, initial value, touched, dirty, validity, error message).
   * @param {FieldConfig} fieldConfig - The configuration for the field.
   * @param {string} pathPrefix - The prefix for the field's path (e.g., 'listName[0].').
   * @param {object} targetValuesObject - The object to store the field's value in (e.g., an item in a list).
   * @param {object} targetInitialValuesObject - The object to store the field's initial value.
   */
  const initializeFieldState = (fieldConfig, pathPrefix, targetValuesObject, targetInitialValuesObject) => {
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
   * Initializes all form field states (values, initial values, touched, dirty, validity, error messages).
   * Populates `initialFormFieldsValues` with a deep copy of initial field values.
   * This function is recursive for sub-forms and iterates for lists.
   * @private
   */
  const initFormStates = (currentFields, currentPathPrefix = "", currentModelTarget = formFieldsValues, currentInitialValuesTarget = initialFormFieldsValues) => {
    if (currentFields && Array.isArray(currentFields)) {
      currentFields.forEach((field) => {
        const key = field.propertyName || field.subForm;
        if (!key) return;

        const fullPath = currentPathPrefix + key;

        if (field.type === 'list') {
          currentModelTarget[key] = field.initialValue && Array.isArray(field.initialValue) ? [...field.initialValue] : [];
          currentInitialValuesTarget[key] = field.initialValue && Array.isArray(field.initialValue) ? JSON.parse(JSON.stringify(field.initialValue)) : [];

          formFieldsTouchedState[fullPath] = false; // Touched state for the list itself
          formFieldsDirtyState[fullPath] = false;   // Dirty state for the list itself

          currentModelTarget[key].forEach((item, index) => {
            const itemPathPrefix = `${fullPath}[${index}].`;
            // Ensure item is an object if it's coming from initialValue
            if (typeof item !== 'object' || item === null) {
              currentModelTarget[key][index] = {};
            }
            if (typeof currentInitialValuesTarget[key][index] !== 'object' || currentInitialValuesTarget[key][index] === null) {
              currentInitialValuesTarget[key][index] = {};
            }
            if (Array.isArray(field.fields)) {
              field.fields.forEach(listItemField => {
                initializeFieldState(listItemField, itemPathPrefix, currentModelTarget[key][index], currentInitialValuesTarget[key][index]);
              });
            }
          });
        } else if (field.subForm) {
          currentModelTarget[key] = currentModelTarget[key] || {};
          currentInitialValuesTarget[key] = currentInitialValuesTarget[key] || {};
          initFormStates(field.fields, `${fullPath}.`, currentModelTarget[key], currentInitialValuesTarget[key]);
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

  initFormStates(fields); // Initial call with top-level fields

  /**
   * Updates the initial value for a field - used when the form's modelValue changes.
   * Handles nested paths for list items and sub-forms.
   * @param {string} fieldPath - The full path to the field (e.g., 'fieldName', 'subForm.fieldName', 'listName[0].fieldName').
   * @param {any} value - The new initial value.
   */
  const updateFieldInitialValue = (fieldPath, value) => {
    // This function needs to carefully navigate the initialFormFieldsValues structure
    // For simplicity in this step, we'll assume direct paths for now, complex path parsing might be needed
    const pathSegments = fieldPath.split(/\.|\[|\]/).filter(Boolean);
    let currentInitialRef = initialFormFieldsValues;
    let currentModelRef = formFieldsValues; // Assuming formFieldsValues is kept in sync by Vue's reactivity

    for (let i = 0; i < pathSegments.length - 1; i++) {
        const segment = pathSegments[i];
        if (!currentInitialRef[segment] || !currentModelRef[segment]) {
            console.warn(`Path segment ${segment} not found in initial values or model for ${fieldPath}`);
            return;
        }
        currentInitialRef = currentInitialRef[segment];
        currentModelRef = currentModelRef[segment];
    }
    const finalSegment = pathSegments[pathSegments.length - 1];

    if (currentInitialRef && currentInitialRef.hasOwnProperty(finalSegment)) {
        const serializedValue = value !== undefined ? JSON.parse(JSON.stringify(value)) : undefined;
        currentInitialRef[finalSegment] = serializedValue;

        if (currentModelRef && currentModelRef[finalSegment] === undefined && value !== undefined) {
            currentModelRef[finalSegment] = value; // Keep model in sync if it was undefined
            if (formFieldsDirtyState[fieldPath] !== undefined) {
                 formFieldsDirtyState[fieldPath] = false;
            }
        }
    }
  };

  /**
   * Updates the validation state (validity and error message) for a given field path.
   * @private
   * @param {string} fieldPath - The full path to the field (e.g., 'listName[0].fieldName').
   * @param {boolean|string|undefined} validity - True if valid, an error message string if invalid, or undefined.
   */
  const updateValidationState = (fieldPath, validity) => {
    if (typeof validity === "string") {
      formFieldsValidity[fieldPath] = false;
      formFieldsErrorMessages[fieldPath] = validity;
    } else if (validity === true || validity === undefined) {
      if (formFieldsValidity[fieldPath] === false) {
        formFieldsValidity[fieldPath] = undefined;
        formFieldsErrorMessages[fieldPath] = undefined;
      }
    }
  };

  /**
   * Resets the validation state (validity and error message) for a given field path.
   * @private
   * @param {string} fieldPath - The full path to the field.
   */
  const resetValidationState = (fieldPath) => {
    if (fieldPath) {
      formFieldsValidity[fieldPath] = undefined;
      formFieldsErrorMessages[fieldPath] = undefined;
    }
  };

  /**
   * Validates a field using its custom validator functions.
   * @private
   * @param {FieldConfig} field - The field configuration object.
   * @param {any} input - The current value of the field.
   * @param {string} fieldPath - The full path to the field for state updates.
   */
  const validateWithCustomValidator = (field, input, fieldPath) => {
    if (!Array.isArray(field.validators)) return;
    for (const validationFn of field.validators) {
      if (typeof validationFn === "function") {
        const validity = validationFn(input);
        updateValidationState(fieldPath, validity);
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
   * @param {string} fieldPath - The full path to the field for state updates.
   */
  const validateWithBuiltInRules = (field, input, fieldPath) => {
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
        updateValidationState(fieldPath, validity);
        return;
      }
    }
    if (formFieldsValidity[fieldPath] === false) { // Check with full path
      resetValidationState(fieldPath);
    }
  };

  /**
   * Validates a single field based on its configuration (rules and custom validators).
   * Updates reactive validation states using the fieldPath.
   * @param {FieldConfig} fieldConfig - The field configuration object.
   * @param {any} input - The current value of the field.
   * @param {string} fieldPath - The full path to the field (e.g., 'listName[0].fieldName').
   */
  const validateField = (fieldConfig, input, fieldPath) => {
    if (!fieldConfig || !fieldConfig.propertyName) {
      console.warn(`Field configuration not found or invalid for path: ${fieldPath}`);
      return;
    }
    resetValidationState(fieldPath);

    if (fieldConfig.validators && Array.isArray(fieldConfig.validators)) {
      validateWithCustomValidator(fieldConfig, input, fieldPath);
      if (formFieldsValidity[fieldPath] === false) return;
    }

    if (fieldConfig.rules && Array.isArray(fieldConfig.rules)) {
      validateWithBuiltInRules(fieldConfig, input, fieldPath);
    }
  };

  /**
   * Validates all fields in the form based on their current values in `formFieldsValues`.
   * This function is now a wrapper around validateFormPurely, using the current formFieldsValues.
   * @deprecated Prefer validateFormPurely with explicit model.
   * @returns {boolean} True if all fields are valid, false otherwise.
   */
  const validateForm = () => {
    // This function's direct use is discouraged as PreskoForm.vue passes modelValue to validateFormPurely.
    // However, it can be kept for internal use or if direct validation of internal state is needed.
    return validateFormPurely(formFieldsValues);
  };

  /**
   * Validates a given data object against the form's field configurations.
   * Updates the composable's reactive validation states.
   * @param {Object<string, any>} formToValidate - An object where keys are field propertyNames and values are their current values.
   * @param {Array<FieldConfig>} currentFieldsConfig - The fields configuration to use for validation (e.g. props.fields or list item fields).
   * @param {string} pathPrefix - The prefix for constructing field paths (e.g., 'myList[0].').
   * @returns {boolean} True if all validated fields in `formToValidate` are valid, false otherwise.
   */
  const validateFormPurelyRecursive = (formToValidate, currentFieldsConfig, pathPrefix = "") => {
    let isSectionValid = true;
    if (currentFieldsConfig && Array.isArray(currentFieldsConfig)) {
      for (const field of currentFieldsConfig) {
        const fieldKey = field.propertyName || field.subForm;
        if (!fieldKey) continue;

        const currentFieldPath = pathPrefix + fieldKey;
        const fieldValue = formToValidate ? formToValidate[fieldKey] : undefined;

        if (field.type === 'list') {
          if (fieldValue && Array.isArray(fieldValue)) {
            let isListValid = true;
            fieldValue.forEach((item, index) => {
              const itemPathPrefix = `${currentFieldPath}[${index}].`;
              const itemIsValid = validateFormPurelyRecursive(item, field.fields, itemPathPrefix);
              if (!itemIsValid) {
                isListValid = false;
              }
            });
            if (!isListValid) isSectionValid = false;
            // We might want a way to set validity for the list itself, e.g. if min/max items rule exists
            // For now, list validity is an aggregation of its items.
          }
        } else if (field.subForm) {
          if (fieldValue && typeof fieldValue === 'object') {
            if (!validateFormPurelyRecursive(fieldValue, field.fields, `${currentFieldPath}.`)) {
              isSectionValid = false;
            }
          }
        } else if (field.propertyName) {
          // Validate regular fields
          validateField(field, fieldValue, currentFieldPath);
          if (formFieldsValidity[currentFieldPath] === false) {
            isSectionValid = false;
          }
        }
      }
    }
    return isSectionValid;
  };


  /**
   * Validates a given data object against the form's field configurations.
   * Updates the composable's reactive validation states.
   * This is the main entry point for form validation.
   * @param {Object<string, any>} formToValidate - An object where keys are field propertyNames and values are their current values.
   * @returns {boolean} True if all validated fields in `formToValidate` are valid, false otherwise.
   */
  const validateFormPurely = (formToValidate) => {
    // Reset all validity states before starting full validation
    // This is important because fields might be removed (e.g. list items)
    // and their old validation states should not persist.
    Object.keys(formFieldsValidity).forEach(key => {
        formFieldsValidity[key] = undefined;
        formFieldsErrorMessages[key] = undefined;
    });
    return validateFormPurelyRecursive(formToValidate, fields); // `fields` is the top-level form config from props
  };

  /**
   * Sets the touched state for a given field path.
   * @param {string} fieldPath - The full path to the field (e.g., 'listName[0].fieldName').
   * @param {boolean} [touched=true] - The touched state to set.
   * @returns {boolean} True if the state was changed, false otherwise.
   */
  const setFieldTouched = (fieldPath, touched = true) => {
    // Also mark parent list/subform as touched
    const segments = fieldPath.split(/[\[\].]+/).filter(Boolean);
    let currentAggPath = '';
    for (let i = 0; i < segments.length -1; i++) { // Iterate up to the parent
        currentAggPath = currentAggPath ? `${currentAggPath}${fieldPath.includes('[') && i === segments.length-2 ? '['+segments[i]+']' : '.'+segments[i]}` : segments[i];
         if (i === segments.length -2 && fieldPath.includes('['+segments[i]+']')) { // handle array index correctly
             currentAggPath = segments.slice(0, i+1).join('.').replace(/\.\[/g, '['); // reconstruct path with index
         }

        if (formFieldsTouchedState.hasOwnProperty(currentAggPath) && formFieldsTouchedState[currentAggPath] !== touched) {
             formFieldsTouchedState[currentAggPath] = touched;
        } else if (!formFieldsTouchedState.hasOwnProperty(currentAggPath)) { // For list/subform itself
            formFieldsTouchedState[currentAggPath] = touched;
        }
    }


    if (formFieldsTouchedState.hasOwnProperty(fieldPath)) {
      if (formFieldsTouchedState[fieldPath] !== touched) {
        formFieldsTouchedState[fieldPath] = touched;
        return true;
      }
    } else {
      // If path was not there (e.g. new list item), set it
      formFieldsTouchedState[fieldPath] = touched;
      return true;
    }
    return false;
  };

  /**
   * Checks if a field's current value differs from its initial value and updates its dirty state.
   * Uses JSON.stringify for basic deep comparison of non-primitive values.
   * @param {string} fieldPath - The full path to the field (e.g., 'listName[0].fieldName').
   * @param {any} currentValue - The current value of the field.
   * @returns {boolean} True if the dirty state was changed, false otherwise.
   */
  const checkFieldDirty = (fieldPath, currentValue) => {
    let initialValue;
    try {
      const pathSegments = fieldPath.split(/\.|\[|\]/).filter(Boolean);
      let currentInitialRef = initialFormFieldsValues;
      for (const segment of pathSegments) {
        if (currentInitialRef === undefined || !currentInitialRef.hasOwnProperty(segment)) {
          // This can happen if the structure was modified (e.g. list item added)
          // and initialFormFieldsValues doesn't have this path yet.
          // A newly added item field should be considered not dirty initially against its own default.
          currentInitialRef = undefined;
          break;
        }
        currentInitialRef = currentInitialRef[segment];
      }
      initialValue = currentInitialRef;
    } catch (e) {
      console.warn(`Could not retrieve initial value for path: ${fieldPath}`, e);
      return false; // Cannot determine dirty state
    }

    const oldIsDirty = formFieldsDirtyState[fieldPath];
    // If initialValue is undefined (e.g. new field in a list item not in original initial values),
    // it's dirty if currentValue is not undefined.
    const newIsDirty = initialValue === undefined
        ? currentValue !== undefined
        : JSON.stringify(currentValue) !== JSON.stringify(initialValue);

    if (oldIsDirty !== newIsDirty) {
      formFieldsDirtyState[fieldPath] = newIsDirty;
      // Propagate dirty state up to parent list/subform
        const segments = fieldPath.split(/[\[\].]+/).filter(Boolean);
        let currentAggPath = '';
        for (let i = 0; i < segments.length -1; i++) {
             currentAggPath = currentAggPath ? `${currentAggPath}${fieldPath.includes('[') && i === segments.length-2 ? '['+segments[i]+']' : '.'+segments[i]}` : segments[i];
             if (i === segments.length -2 && fieldPath.includes('['+segments[i]+']')) {
                 currentAggPath = segments.slice(0, i+1).join('.').replace(/\.\[/g, '[');
             }
            if (newIsDirty && formFieldsDirtyState[currentAggPath] !== true) { // Only set to true, don't unset if other children are dirty
                formFieldsDirtyState[currentAggPath] = true;
            }
            // Note: setting parent to false if all children become non-dirty is more complex and handled by re-evaluation or specific logic
        }
      return true;
    }
    return false;
  };

  /**
   * Adds an item to a list field.
   * @param {string} listFieldPath - The path to the list field (e.g., 'contacts').
   * @param {object} [initialData] - Optional data for the new item. If not provided, defaultValue from list config is used.
   */
  const addItem = (listFieldPath, initialData) => {
    const listFieldConfig = fields.find(f => f.propertyName === listFieldPath && f.type === 'list'); // Assuming top-level list for now
    if (!listFieldConfig) {
      console.warn(`List field configuration not found for: ${listFieldPath}`);
      return;
    }

    const newItem = {};
    const newItemInitialValues = {};
    const newItemIndex = formFieldsValues[listFieldPath] ? formFieldsValues[listFieldPath].length : 0;
    const itemPathPrefix = `${listFieldPath}[${newItemIndex}].`;

    // Populate new item with default values or provided initialData
    if (Array.isArray(listFieldConfig.fields)) {
      listFieldConfig.fields.forEach(subField => {
        let valueToSet;
        if (initialData && initialData.hasOwnProperty(subField.propertyName)) {
          valueToSet = initialData[subField.propertyName];
        } else if (listFieldConfig.defaultValue && listFieldConfig.defaultValue.hasOwnProperty(subField.propertyName)) {
          valueToSet = listFieldConfig.defaultValue[subField.propertyName];
        } else if (subField.hasOwnProperty('value')) {
          valueToSet = subField.value;
        } else {
          valueToSet = undefined;
        }
        newItem[subField.propertyName] = valueToSet;
        newItemInitialValues[subField.propertyName] = valueToSet !== undefined ? JSON.parse(JSON.stringify(valueToSet)) : undefined;

        // Initialize states for the new item's fields
        const fullSubFieldPath = itemPathPrefix + subField.propertyName;
        formFieldsTouchedState[fullSubFieldPath] = false;
        formFieldsDirtyState[fullSubFieldPath] = false;
        formFieldsValidity[fullSubFieldPath] = undefined;
        formFieldsErrorMessages[fullSubFieldPath] = undefined;
      });
    }

    if (!formFieldsValues[listFieldPath] || !Array.isArray(formFieldsValues[listFieldPath])) {
      formFieldsValues[listFieldPath] = [];
      initialFormFieldsValues[listFieldPath] = [];
    }
    formFieldsValues[listFieldPath].push(newItem);
    initialFormFieldsValues[listFieldPath].push(newItemInitialValues); // Store initial values for dirty check of new item
     // Mark list as dirty if an item is added
    if (formFieldsDirtyState[listFieldPath] !== true) {
        formFieldsDirtyState[listFieldPath] = true;
    }
  };

  /**
   * Removes an item from a list field.
   * @param {string} listFieldPath - The path to the list field (e.g., 'contacts').
   * @param {number} index - The index of the item to remove.
   */
  const removeItem = (listFieldPath, index) => {
    if (formFieldsValues[listFieldPath] && Array.isArray(formFieldsValues[listFieldPath]) && formFieldsValues[listFieldPath].length > index) {
      formFieldsValues[listFieldPath].splice(index, 1);
      if (initialFormFieldsValues[listFieldPath] && initialFormFieldsValues[listFieldPath].length > index) {
           initialFormFieldsValues[listFieldPath].splice(index, 1);
      }

      // Clean up states for the removed item and shift states for subsequent items
      const listFieldConfig = fields.find(f => f.propertyName === listFieldPath && f.type === 'list'); // Find relevant config
      if (!listFieldConfig) return;

      const keysToDelete = [];
      const keysToShift = {};

      // Identify keys to delete (belonging to the removed item)
      // and keys to shift (belonging to items after the removed one)
      Object.keys(formFieldsTouchedState).forEach(key => {
        const match = key.match(new RegExp(`^${listFieldPath.replace(/\[/g, '\\[').replace(/\]/g, '\\]')}\\[(\\d+)\\]\\.(.+)`));
        if (match) {
          const itemIndex = parseInt(match[1]);
          const subFieldPath = match[2];
          if (itemIndex === index) {
            keysToDelete.push(key);
          } else if (itemIndex > index) {
            const newKey = `${listFieldPath}[${itemIndex - 1}].${subFieldPath}`;
            keysToShift[key] = newKey;
          }
        }
      });

      const stateObjects = [formFieldsTouchedState, formFieldsDirtyState, formFieldsValidity, formFieldsErrorMessages];
      stateObjects.forEach(stateObj => {
        keysToDelete.forEach(key => delete stateObj[key]);
        Object.entries(keysToShift).forEach(([oldKey, newKey]) => {
          if (stateObj.hasOwnProperty(oldKey)) {
            stateObj[newKey] = stateObj[oldKey];
            delete stateObj[oldKey];
          }
        });
      });
       // Mark list as dirty if an item is removed and list is not empty
      if (formFieldsValues[listFieldPath].length > 0 && formFieldsDirtyState[listFieldPath] !== true) {
          formFieldsDirtyState[listFieldPath] = true;
      } else if (formFieldsValues[listFieldPath].length === 0) {
          // Potentially check against initial state of the list itself if it was initially empty.
          // For now, if empty, consider it not dirty or matching its new initial state (empty array).
          formFieldsDirtyState[listFieldPath] = JSON.stringify([]) !== JSON.stringify(initialFormFieldsValues[listFieldPath] || []);
      }
    } else {
      console.warn(`Item at index ${index} not found in list ${listFieldPath}`);
    }
  };


  return {
    formFieldsValues, // Note: This is directly mutated for lists. Parent component should rely on modelValue for reaction.
    formFieldsValidity,
    formFieldsErrorMessages,
    formFieldsTouchedState,
    formFieldsDirtyState,
    validateField, // Becomes less primary, validateFormPurely is key
    validateForm, // Legacy, or for simple non-pure validation
    validateFormPurely,
    setFieldTouched,
    checkFieldDirty,
    updateFieldInitialValue,
    addItem,
    removeItem,
  };
}
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
      for (const field of fields) {
        if (
          field.propertyName &&
          formToValidate.hasOwnProperty(field.propertyName)
        ) {
          // Validate regular fields
          validateField(field, formToValidate[field.propertyName]);
          if (formFieldsValidity[field.propertyName] === false) {
            isFormValid = false;
          }
        } else if (
          field.subForm &&
          formToValidate.hasOwnProperty(field.subForm)
        ) {
          // Validate sub-form fields
          const subFormData = formToValidate[field.subForm];
          if (
            field.fields &&
            Array.isArray(field.fields) &&
            typeof subFormData === "object" &&
            subFormData !== null
          ) {
            for (const subField of field.fields) {
              if (
                subField.propertyName &&
                subFormData.hasOwnProperty(subField.propertyName)
              ) {
                validateField(subField, subFormData[subField.propertyName]);
                if (formFieldsValidity[subField.propertyName] === false) {
                  isFormValid = false;
                }
              }
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
    updateFieldInitialValue,
  };
}
