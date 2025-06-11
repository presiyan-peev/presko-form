# PreskoForm Feature Status (as of 2024-10-27)

This document tracks the implementation status of feature ideas for PreskoForm.

## 1. Advanced Validation
- **Status:** Partially Implemented
- **Details:** The system supports custom validator functions and regex-based rules via `useFormValidation.js`.
- **Gap:** Asynchronous rules and dedicated cross-field validation mechanisms are not explicitly present.

## 2. Enhanced Form State
- **Status:** Largely Implemented
- **Details:** `useFormValidation.js` manages:
    - Touched (`formFieldsTouchedState`) and dirty (`formFieldsDirtyState`) states for fields.
    - Validity status (`formFieldsValidity`) and error messages (`formFieldsErrorMessages`).
    - Different validation triggers (`onSubmit`, `onBlur`, `onInput`).
- **Note:** An `isSubmitting` state is not directly part of the composable but can be handled by the consuming component.

## 3. Array/List Handling
- **Status:** Implemented
- **Details:** Robust support for dynamic lists of fields within `useFormValidation.js`, including:
    - `addItem` and `removeItem` functions.
    - `FieldConfig` with `type: 'list'` and nested `fields` definition.
    - State management and validation for fields within list items.

## 4. Accessibility Helpers
- **Status:** Not Implemented
- **Gap:** No specific code for auto-generated ARIA links for errors or other accessibility helpers.

## 5. Validation Rule Plugin System
- **Status:** Implemented
- **Details:** The validation system (`src/validation/index.js` and its usage in `useFormValidation.js`) is extensible, allowing new global validation rules to be added by extending the `Validation` object.

## 6. Conditional/Dynamic Fields
- **Status:** Not Implemented
- **Gap:** No declarative system for showing or hiding fields based on other field values.
- **Next Steps:** Plan to define and implement this feature.

## 7. Focus Management
- **Status:** Not Implemented
- **Gap:** No functionality to programmatically focus on the first invalid field after validation.
