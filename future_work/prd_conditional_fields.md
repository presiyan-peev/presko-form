# Product Requirements Document: Conditional/Dynamic Fields for PreskoForm

## 1. Introduction

This document outlines the requirements for the Conditional/Dynamic Fields feature in PreskoForm. This feature will allow form fields to be shown or hidden based on the values of other fields in the form, providing a more dynamic and user-friendly experience.

## 2. Goals

- Allow form designers to create forms that adapt to user input by showing or hiding fields dynamically.
- Improve user experience by only presenting relevant fields.
- Reduce form clutter and complexity.
- Ensure that validation and form submission logic correctly handle the visibility state of fields.

## 3. User Problem

Currently, PreskoForm displays all defined fields statically. Users may encounter forms where certain fields are only relevant if specific options are selected or data is entered in other parts of the form. Displaying irrelevant fields can confuse users, increase the perceived complexity of the form, and lead to errors.

**Example User Stories:**

- As a form designer, I want to show a "Shipping Address" section only if the user checks a "Ship to a different address" checkbox.
- As a form designer, I want to display an "Other reason" text input only when the user selects "Other" from a dropdown list of reasons.
- As a user, I only want to see and fill out fields that are relevant to my previous selections, so the form feels shorter and easier to complete.

## 4. Proposed Feature: Field Visibility Control

We will introduce a simple mechanism to control the visibility of form fields using a Boolean property `isShowing` in the `FieldConfig` object for each field.

### 4.1. Configuration (`FieldConfig` Enhancement)

A new optional property, `isShowing`, will be added to the `FieldConfig` interface.

```typescript
interface FieldConfig {
  // ... existing properties (propertyName, label, rules, etc.)
  isShowing?: boolean; // Determines if the field is visible. Defaults to true.
}
```

**Example Usage:**

```javascript
// Show 'otherReason' field only if custom logic sets isShowing to true (which is also the default value)
{
  propertyName: 'reason',
  label: 'Reason for contact',
  // ...
},
{
  propertyName: 'otherReason',
  label: 'Please specify other reason',
  isShowing: customLogicForOtherReason(),
}

// Show 'companyName' based on custom logic
{
  propertyName: 'companyName',
  label: 'Company Name',
  isShowing: customLogicForCompanyName(),
}
```

### 4.2. Core Behavior

- **Visibility Tracking:** `useFormValidation.js` will maintain a new reactive state, `formFieldsVisibility: { [fieldPath: string]: boolean }`.
- **Initial Evaluation:** When the form is initialized, the visibility of all fields will be evaluated based on the initial form model and custom logic.
- **Rendering:** The `PreskoFormItem.vue` component (or any component rendering fields) will use the `formFieldsVisibility` state to conditionally render fields (e.g., using `v-if`).
- **Validation:**
  - Fields that are hidden (visibility is `false`) will be excluded from validation. Their validation status will be cleared/reset.
  - The overall form validity (`validateFormPurely`) will only consider currently visible and applicable fields.
- **Value Handling for Hidden Fields:**
  - By default, when a field is hidden, its value will be retained in the form model.
  - If custom logic dictates, its value in the form model can be set to `undefined` or an appropriate empty state when it becomes hidden.
- **Dependencies:** The system must correctly handle dependencies on fields within nested structures (sub-forms) and array/list items. For example, a field `itemDetails[0].specificInfo` might depend on `itemDetails[0].type`.

### 4.3. Supported Logic

- Developers are responsible for implementing their own logic to determine the value of `isShowing` for each field.

## 5. Technical Considerations

- **`useFormValidation.js` Modifications:**
  - Introduce `formFieldsVisibility` reactive state.
  - Implement `evaluateFieldVisibility(fieldConfig, currentFormModel)` function using custom logic.
  - Implement logic to update dependent fields' visibility when a source field changes.
  - Modify `validateField` and `validateFormPurely` to respect field visibility.
  - Handle value clearing for hidden fields based on custom logic.
- **`PreskoForm.vue` / `PreskoFormItem.vue`:**
  - `PreskoFormItem` (or the component rendering the field slot) will need to access the visibility state for the field it's rendering and use `v-if` (or equivalent) to show/hide the field.
  - The `formFieldsVisibility` state will be passed down from `PreskoForm` or accessed from the composable.
- **Performance:**
  - Efficiently tracking dependencies and re-evaluating visibility is crucial. Avoid re-evaluating all fields on every model change if possible. A dependency map (which fields' visibility depends on which other fields) should be built on initialization.
- **Complexity of Conditions:** While the initial proposal is declarative, future iterations might consider supporting callback functions for very complex conditions if the declarative syntax becomes too cumbersome. This is out of scope for the initial implementation.
- **Testing:** Thorough unit and integration tests will be required to cover various condition types, logic (`AND`/`OR`), nested fields, and interactions with validation.

## 6. Non-Goals (Future Considerations)

- **Callback-based conditions:** Using functions for conditions (`condition: (formModel) => boolean`).
- **Animations for showing/hiding fields:** This can be handled by users with CSS transitions on their components.
- **Disabling fields instead of hiding:** The current focus is on visibility. Disabling could be a separate feature.
- **Server-side evaluation of conditions:** This PRD focuses on client-side conditional logic.

## 7. Acceptance Criteria

- An `isShowing` property can be added to `FieldConfig` as described.
- Fields are shown or hidden dynamically based on the evaluation of `isShowing` against the current form model.
- Hidden fields are excluded from validation, and their errors are cleared.
- The feature works correctly with nested fields (sub-forms) and fields within array/list items.
- Changes in a source field correctly trigger re-evaluation of visibility for dependent fields.
- The overall form validity considers only visible fields.
- Unit tests cover the visibility logic in `useFormValidation.js`.
- Integration/component tests verify the dynamic show/hide behavior and validation interaction.
- The `future_work/ideas.md` file is updated to reflect this feature as "In Progress" or "Implemented" upon completion.
