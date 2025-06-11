import { reactive } from "vue";
import Validation from "../validation";

// Note: FieldConfig typedef is assumed to be understood by the linter/compiler from its usage.
// Or it can be explicitly kept if preferred. For brevity in this step, focusing on functional code.

export function useFormValidation(fields) {
  let formFieldsValues = reactive({});
  let formFieldsValidity = reactive({});
  let formFieldsErrorMessages = reactive({});
  let formFieldsTouchedState = reactive({});
  let formFieldsDirtyState = reactive({});
  let initialFormFieldsValues = {};

  const getFieldLabel = (field) => {
    return (
      field.label || (field.props && field.props.label) || field.propertyName
    );
  };

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

  const initFormStates = (currentFields, currentPathPrefix = "", currentModelTarget = formFieldsValues, currentInitialValuesTarget = initialFormFieldsValues) => {
    if (currentFields && Array.isArray(currentFields)) {
      currentFields.forEach((field) => {
        const key = field.propertyName || field.subForm;
        if (!key) return;

        const fullPath = currentPathPrefix + key;

        if (field.type === 'list') {
          currentModelTarget[key] = field.initialValue && Array.isArray(field.initialValue) ? [...field.initialValue] : [];
          currentInitialValuesTarget[key] = field.initialValue && Array.isArray(field.initialValue) ? JSON.parse(JSON.stringify(field.initialValue)) : [];

          formFieldsTouchedState[fullPath] = false;
          formFieldsDirtyState[fullPath] = false;

          currentModelTarget[key].forEach((item, index) => {
            const itemPathPrefix = `${fullPath}[${index}].`;
            if (typeof item !== 'object' || item === null) {
              currentModelTarget[key][index] = {};
            }
            if (typeof currentInitialValuesTarget[key][index] !== 'object' || currentInitialValuesTarget[key][index] === null) {
              currentInitialValuesTarget[key][index] = {};
            }
            if (Array.isArray(field.fields)) {
              field.fields.forEach(listItemField => {
                if (listItemField.propertyName) { // Ensure listItemField has a propertyName
                  initializeFieldState(listItemField, itemPathPrefix, currentModelTarget[key][index], currentInitialValuesTarget[key][index]);
                }
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

  initFormStates(fields);

  const updateFieldInitialValue = (fieldPath, value) => {
    const pathSegments = fieldPath.split(/\.|\[|\]/).filter(Boolean);
    let currentInitialRef = initialFormFieldsValues;
    let currentModelRef = formFieldsValues;

    for (let i = 0; i < pathSegments.length - 1; i++) {
        const segment = pathSegments[i];
        if (!currentInitialRef[segment] || !currentModelRef[segment]) {
            // console.warn(`Path segment ${segment} not found in initial values or model for ${fieldPath}`);
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
            currentModelRef[finalSegment] = value;
            if (formFieldsDirtyState[fieldPath] !== undefined) {
                 formFieldsDirtyState[fieldPath] = false;
            }
        }
    }
  };

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

  const resetValidationState = (fieldPath) => {
    if (fieldPath) {
      formFieldsValidity[fieldPath] = undefined;
      formFieldsErrorMessages[fieldPath] = undefined;
    }
  };

  const validateWithCustomValidator = (field, input, fieldPath) => {
    if (!Array.isArray(field.validators)) return;
    for (const validationFn of field.validators) {
      if (typeof validationFn === "function") {
        const validity = validationFn(input);
        updateValidationState(fieldPath, validity);
        if (typeof validity === "string") return;
      }
    }
  };

  const validateWithBuiltInRules = (field, input, fieldPath) => {
    if (!Array.isArray(field.rules)) return;
    const labelArg = getFieldLabel(field);

    for (const rule of field.rules) {
      let validity;
      if (typeof rule === "string") {
        if (Validation[rule]) validity = Validation[rule](input, labelArg);
        else { console.warn(`Unknown validation rule: ${rule}`); continue; }
      } else if (rule instanceof RegExp) {
        validity = Validation.matchRegex(input, labelArg, undefined, rule);
      } else if (typeof rule === "object" && rule !== null && rule.name) {
        const { name, customErrorMsg, regex } = rule;
        if (name === "matchRegex" && regex instanceof RegExp) validity = Validation.matchRegex(input, labelArg, customErrorMsg, regex);
        else if (Validation[name]) validity = Validation[name](input, labelArg, customErrorMsg);
        else { console.warn(`Unknown validation rule object: ${name}`); continue; }
      } else { console.warn("Invalid rule format:", rule); continue; }

      if (typeof validity === "string") { updateValidationState(fieldPath, validity); return; }
    }
    if (formFieldsValidity[fieldPath] === false) resetValidationState(fieldPath);
  };

  const validateField = (fieldConfig, input, fieldPath) => {
    if (!fieldConfig || !fieldConfig.propertyName) {
      // console.warn(`Field configuration not found or invalid for path: ${fieldPath}`);
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

  // This is the new primary validateForm function that was previously named validateFormPurely
  // It is list-aware and path-aware.
  const validateFormPurelyRecursive = (formToValidate, currentFieldsConfig, pathPrefix = "") => {
    let isSectionValid = true;
    if (currentFieldsConfig && Array.isArray(currentFieldsConfig)) {
      for (const field of currentFieldsConfig) {
        const fieldKey = field.propertyName || field.subForm;
        if (!fieldKey) continue;

        const currentFieldPath = pathPrefix + fieldKey;
        const fieldValue = formToValidate ? formToValidate[fieldKey] : undefined;

        if (field.type === 'list') {
          if (fieldValue && Array.isArray(fieldValue) && Array.isArray(field.fields)) {
            let isListValid = true;
            fieldValue.forEach((item, index) => {
              const itemPathPrefix = `${currentFieldPath}[${index}].`;
              if (!validateFormPurelyRecursive(item, field.fields, itemPathPrefix)) {
                isListValid = false;
              }
            });
            if (!isListValid) isSectionValid = false;
          }
        } else if (field.subForm) {
          if (fieldValue && typeof fieldValue === 'object' && Array.isArray(field.fields)) {
            if (!validateFormPurelyRecursive(fieldValue, field.fields, `${currentFieldPath}.`)) {
              isSectionValid = false;
            }
          }
        } else if (field.propertyName) {
          validateField(field, fieldValue, currentFieldPath);
          if (formFieldsValidity[currentFieldPath] === false) {
            isSectionValid = false;
          }
        }
      }
    }
    return isSectionValid;
  };

  const validateFormPurely = (formToValidate) => {
    Object.keys(formFieldsValidity).forEach(key => {
        formFieldsValidity[key] = undefined;
        formFieldsErrorMessages[key] = undefined;
    });
    return validateFormPurelyRecursive(formToValidate, fields);
  };

  // This is the deprecated validateForm, kept for compatibility if PreskoForm calls it.
  // It now correctly calls the new validateFormPurely.
  const validateForm = () => {
    return validateFormPurely(formFieldsValues);
  };

  const setFieldTouched = (fieldPath, touched = true) => {
    const segments = fieldPath.split(/[\[\].]+/).filter(Boolean);
    let currentAggPath = '';
    for (let i = 0; i < segments.length -1; i++) {
        currentAggPath = currentAggPath ? `${currentAggPath}${fieldPath.includes('[') && i === segments.length-2 ? '['+segments[i]+']' : '.'+segments[i]}` : segments[i];
         if (i === segments.length -2 && fieldPath.includes('['+segments[i]+']')) {
             currentAggPath = segments.slice(0, i+1).join('.').replace(/\.\[/g, '[');
         }
        if (formFieldsTouchedState.hasOwnProperty(currentAggPath) && formFieldsTouchedState[currentAggPath] !== touched) {
             formFieldsTouchedState[currentAggPath] = touched;
        } else if (!formFieldsTouchedState.hasOwnProperty(currentAggPath)) {
            formFieldsTouchedState[currentAggPath] = touched;
        }
    }
    if (formFieldsTouchedState.hasOwnProperty(fieldPath)) {
      if (formFieldsTouchedState[fieldPath] !== touched) {
        formFieldsTouchedState[fieldPath] = touched;
        return true;
      }
    } else {
      formFieldsTouchedState[fieldPath] = touched;
      return true;
    }
    return false;
  };

  const checkFieldDirty = (fieldPath, currentValue) => {
    let initialValue;
    try {
      const pathSegments = fieldPath.split(/\.|\[|\]/).filter(Boolean);
      let currentInitialRef = initialFormFieldsValues;
      for (const segment of pathSegments) {
        if (currentInitialRef === undefined || !currentInitialRef.hasOwnProperty(segment)) {
          currentInitialRef = undefined;
          break;
        }
        currentInitialRef = currentInitialRef[segment];
      }
      initialValue = currentInitialRef;
    } catch (e) {
      // console.warn(`Could not retrieve initial value for path: ${fieldPath}`, e);
      return false;
    }

    const oldIsDirty = formFieldsDirtyState[fieldPath];
    const newIsDirty = initialValue === undefined
        ? currentValue !== undefined
        : JSON.stringify(currentValue) !== JSON.stringify(initialValue);

    if (oldIsDirty !== newIsDirty) {
      formFieldsDirtyState[fieldPath] = newIsDirty;
        const segments = fieldPath.split(/[\[\].]+/).filter(Boolean);
        let currentAggPath = '';
        for (let i = 0; i < segments.length -1; i++) {
             currentAggPath = currentAggPath ? `${currentAggPath}${fieldPath.includes('[') && i === segments.length-2 ? '['+segments[i]+']' : '.'+segments[i]}` : segments[i];
             if (i === segments.length -2 && fieldPath.includes('['+segments[i]+']')) {
                 currentAggPath = segments.slice(0, i+1).join('.').replace(/\.\[/g, '[');
             }
            if (newIsDirty && formFieldsDirtyState[currentAggPath] !== true) {
                formFieldsDirtyState[currentAggPath] = true;
            }
        }
      return true;
    }
    return false;
  };

  const addItem = (listFieldPath, initialData) => {
    const listFieldConfig = fields.find(f => (f.propertyName === listFieldPath || f.subForm === listFieldPath) && f.type === 'list');
    if (!listFieldConfig) {
      console.warn(`List field configuration not found for: ${listFieldPath}`);
      return;
    }

    const newItem = {};
    const newItemInitialValues = {};
    const listInValues = formFieldsValues[listFieldPath] || [];
    const newItemIndex = listInValues.length;
    const itemPathPrefix = `${listFieldPath}[${newItemIndex}].`;

    if (Array.isArray(listFieldConfig.fields)) {
      listFieldConfig.fields.forEach(subField => {
        if (!subField.propertyName) return; // Skip if no propertyName
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

        const fullSubFieldPath = itemPathPrefix + subField.propertyName;
        formFieldsTouchedState[fullSubFieldPath] = false;
        formFieldsDirtyState[fullSubFieldPath] = false;
        formFieldsValidity[fullSubFieldPath] = undefined;
        formFieldsErrorMessages[fullSubFieldPath] = undefined;
      });
    }

    if (!formFieldsValues[listFieldPath] || !Array.isArray(formFieldsValues[listFieldPath])) {
      formFieldsValues[listFieldPath] = [];
    }
    if (!initialFormFieldsValues[listFieldPath] || !Array.isArray(initialFormFieldsValues[listFieldPath])) {
      initialFormFieldsValues[listFieldPath] = [];
    }
    formFieldsValues[listFieldPath].push(newItem);
    initialFormFieldsValues[listFieldPath].push(newItemInitialValues);
    if (formFieldsDirtyState[listFieldPath] !== true) {
        formFieldsDirtyState[listFieldPath] = true; // Adding an item makes the list dirty
    }
  };

  const removeItem = (listFieldPath, index) => {
    const listInValues = formFieldsValues[listFieldPath];
    const initialListInValues = initialFormFieldsValues[listFieldPath];

    if (listInValues && Array.isArray(listInValues) && listInValues.length > index) {
      listInValues.splice(index, 1);
      if (initialListInValues && Array.isArray(initialListInValues) && initialListInValues.length > index) {
           initialListInValues.splice(index, 1);
      }

      const listFieldConfig = fields.find(f => (f.propertyName === listFieldPath || f.subForm === listFieldPath) && f.type === 'list');
      if (!listFieldConfig || !Array.isArray(listFieldConfig.fields)) return;

      // Clean up states for the removed item and shift states for subsequent items
      const stateObjects = [formFieldsTouchedState, formFieldsDirtyState, formFieldsValidity, formFieldsErrorMessages];

      // Shift items from the end towards the removed index
      for (let i = index; i < listInValues.length; i++) {
        listFieldConfig.fields.forEach(subField => {
          if (!subField.propertyName) return;
          const oldPath = `${listFieldPath}[${i + 1}].${subField.propertyName}`;
          const newPath = `${listFieldPath}[${i}].${subField.propertyName}`;
          stateObjects.forEach(stateObj => {
            if (stateObj.hasOwnProperty(oldPath)) {
              stateObj[newPath] = stateObj[oldPath];
              delete stateObj[oldPath];
            } else {
              delete stateObj[newPath]; // Ensure new path doesn't have stale data if old didn't exist
            }
          });
        });
      }

      // Delete states for the item that no longer exists (was at the end of the original list length)
      const lastItemOldIndex = listInValues.length; // This is now the new length, which was old_length - 1
      listFieldConfig.fields.forEach(subField => {
        if (!subField.propertyName) return;
        const pathToDelete = `${listFieldPath}[${lastItemOldIndex}].${subField.propertyName}`;
        stateObjects.forEach(stateObj => {
          delete stateObj[pathToDelete];
        });
      });

      // Mark list as dirty
      const initialListForDirtyCheck = initialFormFieldsValues[listFieldPath] || [];
      if (JSON.stringify(listInValues) !== JSON.stringify(initialListForDirtyCheck)) {
          if (formFieldsDirtyState[listFieldPath] !== true) {
              formFieldsDirtyState[listFieldPath] = true;
          }
      } else {
           if (formFieldsDirtyState[listFieldPath] !== false) {
              formFieldsDirtyState[listFieldPath] = false;
          }
      }

    } else {
      console.warn(`Item at index ${index} not found in list ${listFieldPath}`);
    }
  };

  return {
    formFieldsValues,
    formFieldsValidity,
    formFieldsErrorMessages,
    formFieldsTouchedState,
    formFieldsDirtyState,
    validateField,
    validateForm, // Deprecated but available
    validateFormPurely, // Primary validation function
    setFieldTouched,
    checkFieldDirty,
    updateFieldInitialValue,
    addItem,
    removeItem,
  };
}
