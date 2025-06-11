# Product Requirements Document: Conditional/Dynamic Fields for PreskoForm

## 1. Introduction

This document outlines the requirements for the Conditional/Dynamic Fields feature in PreskoForm. This feature will allow form fields to be shown or hidden based on the values of other fields in the form, providing a more dynamic and user-friendly experience.

## 2. Goals

*   Allow form designers to create forms that adapt to user input by showing or hiding fields dynamically.
*   Improve user experience by only presenting relevant fields.
*   Reduce form clutter and complexity.
*   Ensure that validation and form submission logic correctly handle the visibility state of fields.

## 3. User Problem

Currently, PreskoForm displays all defined fields statically. Users may encounter forms where certain fields are only relevant if specific options are selected or data is entered in other parts of the form. Displaying irrelevant fields can confuse users, increase the perceived complexity of the form, and lead to errors.

**Example User Stories:**

*   As a form designer, I want to show a "Shipping Address" section only if the user checks a "Ship to a different address" checkbox.
*   As a form designer, I want to display an "Other reason" text input only when the user selects "Other" from a dropdown list of reasons.
*   As a user, I only want to see and fill out fields that are relevant to my previous selections, so the form feels shorter and easier to complete.

## 4. Proposed Feature: Conditional Field Display

We will introduce a mechanism to define conditions for when a form field should be visible. This will be configured directly within the `FieldConfig` object for each field.

### 4.1. Configuration (`FieldConfig` Enhancement)

A new optional property, `condition`, will be added to the `FieldConfig` interface.

```typescript
interface ConditionRule {
  field: string;         // Path to the source field (e.g., 'user.type', 'notificationsEnabled', 'contactMethods[0].type').
                         // Supports dot notation for nested objects and array indexing for list items.
  operator:             // The comparison operator.
    | 'equals'           // value === sourceValue
    | 'notEquals'        // value !== sourceValue
    | 'in'               // value.includes(sourceValue) (sourceValue must be one of the array elements in `value`)
    | 'notIn'            // !value.includes(sourceValue)
    | 'greaterThan'      // sourceValue > value
    | 'lessThan'         // sourceValue < value
    | 'greaterThanOrEquals' // sourceValue >= value
    | 'lessThanOrEquals' // sourceValue <= value
    | 'defined'          // sourceValue is not undefined and not null
    | 'undefined'        // sourceValue is undefined or null
    | 'matchesRegex';    // new RegExp(value).test(sourceValue)
  value?: any;           // The value to compare against (required for most operators).
                         // For 'in'/'notIn', if `value` is a string, it will be treated as a comma-separated list.
}

interface FieldConfig {
  // ... existing properties (propertyName, label, rules, etc.)
  condition?: {
    logic?: 'AND' | 'OR'; // How to combine multiple rules. Defaults to 'AND'.
    rules: ConditionRule[]; // An array of rules that must be met for the field to be visible.
  };
  clearValueOnHide?: boolean; // If true, the field's value will be reset when it's hidden. Defaults to false.
}
```

**Example Usage:**

```javascript
// Show 'otherReason' field only if 'reason' field is 'other'
{
  propertyName: 'reason',
  label: 'Reason for contact',
  // ...
},
{
  propertyName: 'otherReason',
  label: 'Please specify other reason',
  condition: {
    rules: [{ field: 'reason', operator: 'equals', value: 'other' }]
  },
  clearValueOnHide: true
}

// Show 'companyName' if 'userType' is 'business' AND 'country' is 'US'
{
  propertyName: 'companyName',
  label: 'Company Name',
  condition: {
    logic: 'AND', // Explicitly AND, though it's the default
    rules: [
      { field: 'userType', operator: 'equals', value: 'business' },
      { field: 'country', operator: 'equals', value: 'US' }
    ]
  }
}
```

### 4.2. Core Behavior

*   **Visibility Tracking:** `useFormValidation.js` will maintain a new reactive state, `formFieldsVisibility: { [fieldPath: string]: boolean }`.
*   **Initial Evaluation:** When the form is initialized, the visibility of all fields with conditions will be evaluated based on the initial form model.
*   **Dynamic Re-evaluation:**
    *   Whenever a field's value changes, the system will identify any other fields whose visibility conditions depend on the changed field.
    *   The visibility of these dependent fields will be re-evaluated.
*   **Rendering:** The `PreskoFormItem.vue` component (or any component rendering fields) will use the `formFieldsVisibility` state to conditionally render fields (e.g., using `v-if`).
*   **Validation:**
    *   Fields that are hidden (visibility is `false`) will be excluded from validation. Their validation status will be cleared/reset.
    *   The overall form validity (`validateFormPurely`) will only consider currently visible and applicable fields.
*   **Value Handling for Hidden Fields:**
    *   By default, when a field is hidden, its value will be retained in the form model.
    *   If `clearValueOnHide: true` is set in the field's configuration, its value in the form model will be set to `undefined` (or its initial `value` if defined, or an appropriate empty state like `[]` for lists or `{}` for objects if that's more suitable – TBD during implementation) when it becomes hidden.
*   **Dependencies:** The system must correctly handle dependencies on fields within nested structures (sub-forms) and array/list items. For example, a field `itemDetails[0].specificInfo` might depend on `itemDetails[0].type`.

### 4.3. Supported Operators

The following operators will be supported initially:

*   `equals`: Strict equality (`===`).
*   `notEquals`: Strict inequality (`!==`).
*   `in`: Checks if the source field's value is one of the values in the `condition.value` array. If `condition.value` is a string, it's treated as a comma-separated list.
*   `notIn`: The opposite of `in`.
*   `greaterThan`: `sourceValue > condition.value`.
*   `lessThan`: `sourceValue < condition.value`.
*   `greaterThanOrEquals`: `sourceValue >= condition.value`.
*   `lessThanOrEquals`: `sourceValue <= condition.value`.
*   `defined`: The source field's value is not `undefined` and not `null`. `condition.value` is not used.
*   `undefined`: The source field's value is `undefined` or `null`. `condition.value` is not used.
*   `matchesRegex`: `new RegExp(condition.value).test(sourceValue)`. `condition.value` must be a string representing the regex pattern.

## 5. Technical Considerations

*   **`useFormValidation.js` Modifications:**
    *   Introduce `formFieldsVisibility` reactive state.
    *   Implement `evaluateFieldVisibility(fieldConfig, currentFormModel)` function.
    *   Implement logic to update dependent fields' visibility when a source field changes. This will likely involve creating a map of dependencies during initialization.
    *   Modify `validateField` and `validateFormPurely` to respect field visibility.
    *   Handle value clearing for hidden fields if `clearValueOnHide` is true.
*   **`PreskoForm.vue` / `PreskoFormItem.vue`:**
    *   `PreskoFormItem` (or the component rendering the field slot) will need to access the visibility state for the field it's rendering and use `v-if` (or equivalent) to show/hide the field.
    *   The `formFieldsVisibility` state will be passed down from `PreskoForm` or accessed from the composable.
*   **Performance:**
    *   Efficiently tracking dependencies and re-evaluating visibility is crucial. Avoid re-evaluating all conditional fields on every model change if possible. A dependency map (which fields' visibility depends on which other fields) should be built on initialization.
*   **Complexity of Conditions:** While the initial proposal is declarative, future iterations might consider supporting callback functions for very complex conditions if the declarative syntax becomes too cumbersome. This is out of scope for the initial implementation.
*   **Testing:** Thorough unit and integration tests will be required to cover various condition types, logic (`AND`/`OR`), nested fields, and interactions with validation.

## 6. Non-Goals (Future Considerations)

*   **Callback-based conditions:** Using functions for conditions (`condition: (formModel) => boolean`).
*   **Animations for showing/hiding fields:** This can be handled by users with CSS transitions on their components.
*   **Disabling fields instead of hiding:** The current focus is on visibility. Disabling could be a separate feature.
*   **Server-side evaluation of conditions:** This PRD focuses on client-side conditional logic.

## 7. Acceptance Criteria

*   A `condition` property can be added to `FieldConfig` as described.
*   Fields are shown or hidden dynamically based on the evaluation of these conditions against the current form model.
*   Supported operators (`equals`, `notEquals`, `in`, `notIn`, `greaterThan`, `lessThan`, `greaterThanOrEquals`, `lessThanOrEquals`, `defined`, `undefined`, `matchesRegex`) work correctly.
*   `AND` and `OR` logic for multiple rules within a condition works as expected.
*   Hidden fields are excluded from validation, and their errors are cleared.
*   The `clearValueOnHide` option correctly resets a field's value when it's hidden.
*   The feature works correctly with nested fields (sub-forms) and fields within array/list items.
*   Changes in a source field correctly trigger re-evaluation of visibility for dependent fields.
*   The overall form validity considers only visible fields.
*   Unit tests cover the conditional logic in `useFormValidation.js`.
*   Integration/component tests verify the dynamic show/hide behavior and validation interaction.
*   The `future_work/ideas.md` file is updated to reflect this feature as "In Progress" or "Implemented" upon completion.
