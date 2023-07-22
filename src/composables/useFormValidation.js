import { reactive, computed } from "vue";
import Validation from "../validation";

export function useFormValidation() {
  // key: value
  let formFieldsValues = reactive({});
  // key: isValid
  let formFieldsValidity = reactive({});
  // key: errMsg
  let formFieldsErrorMessages = reactive({});

  const updateValidationState = (field, validity) => {
    if (validity !== true && validity != undefined) {
      formFieldsValidity[field.propertyName] = false;
      formFieldsErrorMessages[field.propertyName] = validity;
    }
    // else - input passed validation check
  };

  const resetValidationState = (field) => {
    formFieldsValidity[field.propertyName] = true;
    formFieldsErrorMessages[field.propertyName] = undefined;
  };

  const validateWithCustomValidator = (field, input) => {
    for (validationFn of field.validators) {
      if (typeof validationFn == "function") {
        const validity = field.validators(input);
        updateValidationState(field, validity);
      }
    }
  };

  const validateWithBuiltInRules = (field, input) => {
    if (!Array.isArray(field.rules)) return;
    field.rules.forEach((rule) => {
      if (typeof rule == "string") {
        const validity = Validation[rule](input, field.label);
        updateValidationState(field, validity);
      }
      if (typeof rule == "object") {
        const { name, customErrorMsg } = rule;
        const validity = Validation[name](input, field.label, customErrorMsg);
        updateValidationState(field, validity);
      }
      if (typeof rule == RegExp) {
        const validity = Validation.matchRegex(
          input,
          field.label,
          customErrorMsg,
          rule
        );
        updateValidationState(field, validity);
      }
    });
  };

  const validateField = (field, input) => {
    resetValidationState(field);
    if (!!field.validators) {
      validateWithCustomValidator(field, input);
    }
    if (!!field.rules) {
      validateWithBuiltInRules(field, input);
    }
  };

  const validateForm = (field, input) => {};

  return {
    formFieldsValues,
    formFieldsValidity,
    formFieldsErrorMessages,
    validateField,
    validateForm,
  };
}
