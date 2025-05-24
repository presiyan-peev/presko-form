# Presko Form

A Vue.js library for effortlessly creating dynamic forms with powerful built-in validation.

[![NPM Version](https://img.shields.io/npm/v/presko-form.svg)](https://www.npmjs.com/package/presko-form) <!-- Placeholder - replace 'presko-form' if actual npm name is different -->
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) <!-- Placeholder - Assuming MIT license -->

## Features

- **Dynamic Form Generation:** Effortlessly create complex forms from JavaScript configuration objects.
- **Seamless Data Binding:** Intuitive two-way data binding using `v-model`.
- **Flexible Component System:** Integrate your own custom Vue components for form inputs.
- **Built-in Validation Rules:** Includes common rules like `required`, `email`, `domain`, IP formats, and regex matching.
- **Customizable Validation:** Define custom validation logic and error messages.
- **Nested Forms (Sub-Forms):** Structure complex forms by nesting configurations.
- **Clear Event Handling:** Manage form submissions with `@submit` and validation failures with `@submit:reject`.
- **Vue 3 Composition API:** Modern, lightweight, and composable architecture.

## Installation

Install `presko-form` in your Vue.js project using npm or yarn:

```bash
# Using npm
npm install presko-form

# Using yarn
yarn add presko-form
```

You may also need to ensure Vue 3 is installed in your project:
```bash
# Using npm
npm install vue@^3.3.4

# Using yarn
yarn add vue@^3.3.4
```

## Basic Usage

Here's a quick example to get you started with Presko Form:

```vue
<template>
  <PreskoForm
    v-model="formData"
    :fields="formFields"
    title="My First Presko Form"
    submit-component="MyCustomSubmitButton"
    @submit="handleSubmit"
    @submit:reject="handleValidationFailure"
  />
  <pre>Form Data: {{ formData }}</pre>
</template>

<script setup>
import { ref } from 'vue';
import PreskoForm from 'presko-form'; // Assuming 'presko-form' is the installed package name
// You'll also need to import your custom components if you use them.
// For example, if you have a global submit button component:
// import MyCustomSubmitButton from './components/MyCustomSubmitButton.vue';
// Or register it globally in your main.js:
// app.component('MyCustomSubmitButton', MyCustomSubmitButton);


// 1. Define your form data structure
const formData = ref({
  name: '',
  email: 'test@example.com', // You can set initial values
});

// 2. Configure your form fields
const formFields = ref([
  {
    propertyName: 'name',
    component: 'AppInput', // Replace with your actual input component e.g. 'input', 'CustomInput'
    rules: ['required'],
    props: {
      label: 'Full Name',
      // type: 'text' // Pass any props your input component accepts
    },
  },
  {
    propertyName: 'email',
    component: 'AppInput', // Replace with your actual input component
    rules: ['required', 'email'],
    props: {
      label: 'Email Address',
      // type: 'email'
    },
  },
]);

// 3. Define your submit component (globally registered or imported)
// This is a placeholder. You should have a component named 'MyCustomSubmitButton'
// or whatever you specified in the `submit-component` prop.
// For example, a simple button:
// const MyCustomSubmitButton = { template: '<button type="submit">Submit</button>' };


// 4. Handle form submission
const handleSubmit = (submittedData) => {
  console.log('Form submitted successfully!', submittedData);
  alert('Form Data: ' + JSON.stringify(submittedData));
};

// 5. Handle validation errors (optional)
const handleValidationFailure = () => {
  console.warn('Form validation failed.');
  alert('Please correct the errors in the form.');
};
</script>

<style>
/* Add your styles for PreskoForm or your custom input components here */
/* For example, to style AppInput if it adds a class 'app-input-wrapper': */
.app-input-wrapper {
  margin-bottom: 1rem;
}
.app-input-wrapper label {
  display: block;
  margin-bottom: 0.25rem;
}
.app-input-wrapper input {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 100%;
}

/* Example styling for error states (PreskoFormItem applies these by default via props) */
input:invalid, .has-errors input { /* Example, actual class might differ based on errorProps */
  border-color: red;
  background-color: #fff0f0;
}

.error-message { /* Example, actual class might differ based on errorProps */
  color: red;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}
</style>
```

**Explanation:**

1.  **`v-model="formData"`:** Binds the form's input values to the `formData` reactive object. `PreskoForm` will automatically update `formData` as the user types.
2.  **`:fields="formFields"`:** This crucial prop takes an array of field configuration objects. Each object defines an input in your form.
    *   `propertyName`: The key in your `formData` object that this field corresponds to.
    *   `component`: The name of the Vue component to render for this input (e.g., a custom `AppInput` or a globally registered component like `'input'`). You'll need to ensure these components are registered globally in your Vue app or imported and registered locally.
    *   `rules`: An array of validation rules to apply (e.g., `'required'`, `'email'`).
    *   `props`: An object of additional properties to pass directly to the rendered input component (e.g., `label`, `type`).
3.  **`title="My First Presko Form"`:** An optional title for the form.
4.  **`submit-component="MyCustomSubmitButton"`:** Specifies the component to use for the submit button. This component will receive a `type="submit"` attribute implicitly.
5.  **`@submit="handleSubmit"`:** Event emitted when the form is submitted and all validations pass. The handler receives the valid form data.
6.  **`@submit:reject="handleValidationFailure"`:** Event emitted if any validation rule fails upon submission.

Remember to replace `'AppInput'` and `'MyCustomSubmitButton'` with the actual components you intend to use in your project. These components need to be designed to accept a `v-model` (for `AppInput`) and relevant props. `AppInput` should also handle displaying validation errors if desired (though `PreskoFormItem` handles error display logic based on `errorProps`).

You will need to make sure that `PreskoForm` and any custom components like `AppInput` and `MyCustomSubmitButton` are correctly imported and registered in your Vue application.

For `AppInput` to work with `v-model` from `PreskoFormItem` (which `PreskoForm` uses internally), it should typically define:
```javascript
// Inside your AppInput.vue or similar custom input component
defineProps(['modelValue', 'label', /* other props */]);
defineEmits(['update:modelValue']);
```
And in its template:
```html
<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />
```

This is a simplified example. `PreskoForm` offers more customization for validation messages and error display.

## Form Configuration (`fields` Prop)

The `fields` prop is an array of objects, where each object configures a field in your form. Here's a breakdown of the properties for each field object:

*   **`propertyName`** (String, required)
    *   The key used to store this field's value within the `v-model` data object. For example, if `v-model` is bound to `formData`, and `propertyName` is `'username'`, the field's value will be accessible as `formData.username`.

*   **`component`** (String, required unless `subForm` is used)
    *   The name of the Vue component to be rendered for this form field. This component must be registered globally in your Vue application (e.g., in `main.js`) or imported and registered locally in the component where you're using `PreskoForm`.
    *   The specified component will be wrapped by `PreskoFormItem`, which provides `v-model` binding, validation state, and error message display.
    *   Your custom input component should generally accept `modelValue` as a prop and emit `update:modelValue` for `v-model` to work correctly.

*   **`rules`** (Array, optional)
    *   An array defining validation rules for the field. Rules can be:
        *   **Strings:** For built-in rules (e.g., `'required'`, `'email'`).
        *   **Objects:** For built-in rules with custom error messages:
            ```javascript
            { name: 'required', customErrorMsg: 'This field cannot be empty.' }
            ```
        *   **Regular Expressions:** For direct regex validation:
            ```javascript
            /^[a-zA-Z]+$/ // Example: only letters
            ```
            A default error message is provided, or you can use an object format for a custom message with regex:
            ```javascript
            { name: 'matchRegex', customErrorMsg: 'Only letters are allowed.', regex: /^[a-zA-Z]+$/ }
            ```
    *   See the "Validation" section for more details on available rules and custom validators.

*   **`value`** (any, optional)
    *   The initial value for this form field. This will populate the corresponding `propertyName` in your `v-model` data object when the form is initialized. If a value already exists in the `v-model` data for this `propertyName`, the `v-model` data takes precedence.

*   **`props`** (Object, optional)
    *   An object of additional props to be passed directly to the specified `component`. For example:
        ```javascript
        props: {
          label: 'Your Name',
          type: 'text', // For an <input> component
          placeholder: 'Enter your full name'
        }
        ```

*   **`subForm`** (String, optional)
    *   If you want to nest a form within another, provide a `propertyName` here. This propertyName in the main form's `v-model` data will hold the data for the sub-form (as an object).
    *   When `subForm` is used, instead of `component`, `rules`, `value`, and `props`, you should provide another `fields` array to define the structure of the sub-form.
    *   Example:
        ```javascript
        {
          subForm: 'contactDetails', // formData.contactDetails will be the v-model for the sub-form
          fields: [
            {
              propertyName: 'email',
              component: 'AppInput',
              rules: ['required', 'email'],
              props: { label: 'Email' }
            },
            {
              propertyName: 'phone',
              component: 'AppInput',
              rules: ['required'],
              props: { label: 'Phone' }
            }
          ]
        }
        ```

*   **`label`** (String, optional, often placed in `props`)
    *   While not a direct top-level property consumed by `PreskoForm` itself for rendering (as `PreskoFormItem` passes most things via `field.props` to the actual input component), it's a common piece of data you might want for your fields.
    *   It's typically passed within the `props` object to your input component, e.g., `props: { label: 'Username' }`. The `useFormValidation` composable can use `field.label` in default error messages if a specific label prop is not found within `field.props`.

*   **`validators`** (Array of Functions, optional)
    *   For more complex or custom validation logic not covered by built-in rules or simple regex. Each function in the array receives the field's current value as an argument.
    *   The function should return:
        *   `true` if the value is valid.
        *   A string containing the error message if the value is invalid.
        *   `undefined` or `null` if the validation doesn't apply or passes (treated as valid).
    *   Example:
        ```javascript
        validators: [
          (value) => value === 'expectedValue' || 'Value must be "expectedValue".'
        ]
        ```

This structure allows for highly flexible and dynamic form creation.

## Validation

`PreskoForm` provides a robust validation system that can be configured through the `rules` and `validators` properties in your `fields` definition.

### Using Validation Rules (`rules` Array)

The `rules` array in a field's configuration can include:

1.  **Built-in Rule Names (Strings):**
    *   Simply add the string name of the rule.
    *   Example: `rules: ['required', 'email']`

2.  **Built-in Rules with Custom Error Messages (Objects):**
    *   Specify the rule's `name` and your `customErrorMsg`.
    *   Example: `rules: [{ name: 'required', customErrorMsg: 'This field must not be blank.' }]`

3.  **Regular Expressions:**
    *   Provide a JavaScript regular expression directly.
    *   Example: `rules: [/^[0-9]+$/]` (for numbers only)
    *   For a custom message with a regex:
        ```javascript
        rules: [{
          name: 'matchRegex', // Special name to indicate regex validation
          regex: /^[a-zA-Z\s]+$/,
          customErrorMsg: 'Only letters and spaces are allowed.'
        }]
        ```

### Available Built-in Rules

The following validation rules are available out-of-the-box:

*   **`required`**: Ensures the field is not empty. For strings, it checks for non-empty trimmed values.
*   **`email`**: Validates if the input is a correctly formatted email address.
*   **`domain`**: Validates if the input is a correctly formatted domain name.
*   **`ipv4`**: Validates for a correct IPv4 address format.
*   **`ipv6`**: Validates for a correct IPv6 address format.
*   **`matchRegex`**: (Used internally when you provide a regex literal or an object with `name: 'matchRegex'`). Validates the input against the provided regular expression.

These rules are sourced from `src/validation/index.js`. The default error messages are generally descriptive (e.g., "Field [field.label] is required"), but using the object format for custom messages is recommended for a better user experience.

### Custom Validation Functions (`validators` Array)

For validation logic that goes beyond the built-in rules or simple regex, you can use the `validators` array in a field's configuration.

*   Each element in the `validators` array should be a function.
*   This function receives the current value of the field as its argument.
*   The function should return:
    *   `true` if the validation passes.
    *   A `String` (the error message) if the validation fails.
    *   `undefined` or `null` is also treated as a pass.

**Example:**

```javascript
fields: [
  {
    propertyName: 'customField',
    component: 'AppInput',
    props: { label: 'Custom Validated Field' },
    validators: [
      (value) => {
        if (value && value.length < 5) {
          return 'Must be at least 5 characters long.';
        }
        return true;
      },
      (value) => {
        if (value && !value.startsWith('PF_')) {
          return 'Must start with "PF_".';
        }
        return true;
      }
    ],
    // You can combine with 'rules' too
    rules: ['required']
  }
]
```

Validation is triggered on form submission. The `PreskoFormItem` component (which wraps your input components) receives the validation status and error messages, which can then be displayed. How errors are displayed can be influenced by the `errorProps` prop on `PreskoForm`.

## Styling and Customization

`PreskoForm` provides several ways to customize its appearance and behavior:

### 1. CSS Styling

You can style `PreskoForm` and its child elements using standard CSS. The main form element has the class `presko-form`.

```css
/* Main form container */
.presko-form {
  /* Your styles here */
  padding: 20px;
  border: 1px solid #eee;
  border-radius: 8px;
}

/* Form title (if not using the slot) */
.presko-form-title {
  font-size: 1.5em;
  margin-bottom: 1em;
  font-weight: bold;
}

/* Wrapper for all fields */
.presko-form-fields-wrapper {
  /* Your styles here */
}

/* Individual form items generated by PreskoFormItem might not have a specific
   wrapper class by default unless your custom component adds one.
   Styling is often best applied to your custom input components directly. */
```

Your custom input components (e.g., `AppInput`) will have their own structure that you can target with CSS.

### 2. Slots

`PreskoForm` offers slots for replacing or augmenting parts of its structure:

*   **`title`**: Allows you to provide a custom title component or structure.
    ```vue
    <PreskoForm :fields="myFields" v-model="myData">
      <template #title>
        <h2>My Custom Form Title</h2>
      </template>
    </PreskoForm>
    ```

*   **`submit-row`**: Allows you to customize the entire row where the submit button is rendered. This is useful if you need additional buttons or elements next to the submit button.
    ```vue
    <PreskoForm :fields="myFields" v-model="myData" submit-component="MySubmit">
      <template #submit-row>
        <div class="custom-submit-area">
          <MySubmit />
          <button type="button" @click="handleCancel">Cancel</button>
        </div>
      </template>
    </PreskoForm>
    ```
    If you use this slot, you are responsible for rendering the submit button itself (using your `submit-component` or a standard button).

*   **Default Slot**: Any content placed directly inside `<PreskoForm></PreskoForm>` that isn't part of a named slot will be rendered at the end of the form, after the submit row.

### 3. Submit Button Customization

You can customize the submit button using these props on `PreskoForm`:

*   **`submitComponent`** (String, required): The name of the Vue component to use for the submit button.
*   **`submitBtnClasses`** (String, optional): CSS classes to apply directly to the submit component.
*   **`submitBtnProps`** (Object, optional): Props to pass to the submit component.

Example:
```vue
<PreskoForm
  ...
  submit-component="MyCoolButton"
  submit-btn-classes="btn btn-primary"
  :submit-btn-props="{ icon: 'send', text: 'Submit Application' }"
/>
```
Your `MyCoolButton` component would then need to be able to accept and use `icon` and `text` props.

### 4. Error Display and Styling (`errorProps`)

The `errorProps` prop on `PreskoForm` controls how validation state (error status and messages) is passed to each `PreskoFormItem` and subsequently to your custom input components. This indirectly affects how you style errors.

Default `errorProps`:
```javascript
{
  hasErrors: "error", // Prop name on your component that receives a boolean
  errorMessages: "errorMessages", // Prop name for the error message(s)
  errorMessagesType: "string" // Can be "string" or "array"
}
```

If your custom input component (e.g., `AppInput`) is set up to receive an `error` prop (boolean) and an `errorMessages` prop (string/array), you can use these to conditionally apply styles or display messages.

**Example in your custom input component (`AppInput.vue`):**
```vue
<template>
  <div :class="{ 'has-error-style': error }">
    <label>{{ label }}</label>
    <input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />
    <div v-if="error && errorMessages" class="error-text-style">
      {{ typeof errorMessages === 'string' ? errorMessages : errorMessages.join(', ') }}
    </div>
  </div>
</template>

<script setup>
defineProps(['modelValue', 'label', 'error', 'errorMessages']);
defineEmits(['update:modelValue']);
</script>

<style scoped>
.has-error-style input {
  border-color: red;
  background-color: #ffe0e0;
}
.error-text-style {
  color: red;
  font-size: 0.875em;
  margin-top: 4px;
}
</style>
```
You can change the prop names `PreskoForm` uses by providing a different `errorProps` object. For instance, if your components expect `isInvalid` and `validationText`:
```vue
<PreskoForm
  ...
  :error-props="{
    hasErrors: 'isInvalid',
    errorMessages: 'validationText',
    errorMessagesType: 'string'
  }"
/>
```
This gives you flexibility in integrating `PreskoForm`'s validation feedback with your existing component designs.

## API Reference (`PreskoForm`)

This section details the props, events, and slots for the main `<PreskoForm>` component.

### Props

| Prop                 | Type     | Default                                     | Required | Description                                                                                                                              |
| -------------------- | -------- | ------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `modelValue`         | Object   | `{}`                                        | Yes      | The reactive object to bind form data to using `v-model`.                                                                                |
| `fields`             | Array    | `[]`                                        | Yes      | The array of field configuration objects that defines the form structure. See "Form Configuration (`fields` Prop)" for details.          |
| `title`              | String   | `undefined`                                 | No       | An optional title displayed at the top of the form. Can be overridden by the `title` slot.                                               |
| `submitComponent`    | String   | `undefined`                                 | Yes      | The name of the Vue component to be used for the submit button.                                                                          |
| `submitBtnClasses`   | String   | `undefined`                                 | No       | CSS classes to apply to the `submitComponent`.                                                                                           |
| `submitBtnProps`     | Object   | `undefined`                                 | No       | An object of props to pass to the `submitComponent`.                                                                                     |
| `errorProps`         | Object   | `{ hasErrors: "error", errorMessages: "errorMessages", errorMessagesType: "string" }` | No       | Configures the prop names used to pass validation state (error status and messages) to each `PreskoFormItem` and thus to your custom input components. |

### Events

| Event                | Payload                                       | Description                                                                                                |
| -------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `update:modelValue`  | `Object` (updated form data)                  | Emitted by `v-model` when form data changes.                                                               |
| `submit`             | `Object` (valid form data, deep cloned)       | Emitted when the form is submitted and all fields pass validation. The payload is the complete form data.    |
| `submit:reject`      | `undefined`                                   | Emitted when the form is submitted but fails validation.                                                   |

### Slots

| Name          | Scoped | Description                                                                                                                                 |
| ------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`       | No     | Allows providing a custom component or HTML structure for the form's title, replacing the default display via the `title` prop.             |
| `submit-row`  | No     | Allows providing a custom layout for the entire row containing the submit button. Useful for adding other controls like a "Cancel" button. |
| (default)     | No     | Any content passed directly into `<PreskoForm>` that is not in a named slot will be rendered at the very end of the form, after the submit row. |

## Advanced Usage (Placeholder)

This section can be expanded with more complex use cases and customization examples. Potential topics include:

*   **Creating Complex Custom Input Components:**
    *   In-depth guide on building custom input components that fully integrate with `PreskoForm`'s validation and `v-model` (e.g., components with their own internal state, complex UI, or specific data transformation needs).
    *   Examples of components like custom select/dropdowns with search, date pickers, or file uploads.

*   **Advanced Validation Scenarios:**
    *   Implementing asynchronous validation rules.
    *   Cross-field validation (validating one field based on the value of another).
    *   Dynamically changing validation rules based on other form states.

*   **Integrating with State Management Libraries:**
    *   Patterns for using `PreskoForm` with state management solutions like Pinia or Vuex.

*   **Performance Considerations for Very Large Forms:**
    *   Tips and best practices if dealing with exceptionally large or complex form configurations.

*   **Extending `useFormValidation`:**
    *   Guidance on potentially extending or wrapping the `useFormValidation` composable for highly specific needs.

*(Contributions and suggestions for this section are welcome!)*
