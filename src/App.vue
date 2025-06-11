<script setup>
import { ref, reactive } from "vue";
import PreskoForm from "./components/PreskoForm.vue";
// Assuming AppInput and AppSubmit are globally registered or imported elsewhere if not standard HTML
// For this example, let's assume they are simple custom components.
// You might need to import them explicitly if they are in separate files:
// import AppInput from './test-components/AppInput.vue';
// import AppSubmit from './test-components/AppSubmit.vue';

const preskoFormRef = ref(null);

const fieldsConfig = ref([
  {
    propertyName: "eventName",
    component: "AppInput", // Using string names for components
    rules: ["required", "string"],
    value: "Tech Conference 2024",
    props: {
      label: "Event Name",
      placeholder: "Enter event name",
    },
  },
  {
    propertyName: "eventDate",
    component: "AppInput",
    type: "date", // Assuming AppInput can handle type="date"
    rules: ["required"],
    props: {
      label: "Event Date",
    },
  },
  {
    type: "list", // Indicates an array/list field
    propertyName: "attendees",
    label: "Attendees", // Label for the whole list section
    itemLabel: "Attendee", // Used for "Add Attendee" button
    defaultValue: { // Default values for a new item when added
      name: "",
      email: "",
      ticketType: "general",
      contact: { // Example of nested object within a list item
        phone: ""
      }
    },
    fields: [ // Field definitions for each item in the list
      {
        propertyName: "name",
        component: "AppInput",
        rules: ["required", "string"],
        props: {
          label: "Full Name",
          placeholder: "e.g., Jane Doe",
        },
      },
      {
        propertyName: "email",
        component: "AppInput",
        type: "email",
        rules: ["required", "email"],
        props: {
          label: "Email Address",
          placeholder: "e.g., jane.doe@example.com",
        },
      },
      {
        propertyName: "ticketType",
        component: "AppSelect", // Assuming a custom select component
        rules: ["required"],
        props: {
          label: "Ticket Type",
          options: [ // Example options for a select
            { value: "general", text: "General Admission" },
            { value: "vip", text: "VIP Pass" },
            { value: "student", text: "Student" },
          ],
        },
      },
      {
        // Example of a nested sub-object within a list item
        // This is not a sub-form in PreskoForm terms, but just nested data properties
        // PreskoFormItem would need to handle property paths like 'contact.phone'
        // or the component 'AppInputGroupForContact' would internally manage 'phone'.
        // For simplicity with current PreskoFormItem, direct nested paths might not work
        // out-of-the-box unless PreskoFormItem or the input components are designed for it.
        // The `useFormValidation` supports paths like `attendees[0].contact.phone`.
        // We'll assume AppInput can take a `name` prop that reflects this full path for now,
        // or that PreskoFormItem correctly constructs it.
        propertyName: "contact",
        // This could also be a "sub-group" of fields if PreskoForm supported that concept within items.
        // For now, let's assume `contact` is an object with properties.
        // To make it simpler for direct PreskoFormItem rendering, we'd typically flatten this
        // or have a custom component for 'contact'.
        // Let's try with a direct field for phone for now for simplicity with AppInput
        // propertyName: "contact.phone", // This would be ideal if AppInput could handle it directly
        // For now, let's make 'contact' an object and 'phone' a field within it.
        // The component would need to handle modelValue for `contact.phone`.
        // For this example, let's define `phone` directly under `contact` for clarity in the `modelValue`
        // and assume the rendering part can handle it.
        // PreskoForm itself doesn't have a "group" type for items, only "list" or "subForm".
        // So, `contact` will be an object, and its fields will be managed by their own `PreskoFormItem`s
        // if we were to expand on this.
        // For this example, let's simplify and put phone directly.
        // Re-evaluating: The PRD and implementation made list items like mini-forms.
        // So, `attendees[0].contact.phone` should work.
        // We'll make `contact` an object with a `phone` field inside the list item's `fields` array.
        // This means we need a mechanism to render this.
        // The current PreskoForm list rendering iterates over `field.fields` for `PreskoFormItem`.
        // It does not inherently support rendering "field groups" within items unless `PreskoFormItem` itself
        // can take a complex field definition.
        //
        // SIMPLIFICATION for this example:
        // Let's make `phone` a direct property of the attendee for now to keep App.vue simpler
        // and focus on the list mechanism itself.
        // Advanced nested structures within list items would require `PreskoFormItem` to be more powerful
        // or to use `PreskoForm` recursively if a list item could be a sub-form (not current design).
        // The state management in `useFormValidation` CAN handle `attendees[0].contact.phone`.
        // The rendering in `PreskoForm.vue` template for lists would need to be able to pass
        // the correct model path for `item[listItemField.propertyName]` when `listItemField.propertyName` is 'contact.phone'.
        // Current `PreskoForm.vue` template for lists: `item[listItemField.propertyName]`
        // This means `listItemField.propertyName` would need to be 'contact.phone'.
        // Let's try that structure for `fieldsConfig`.
        // No, `useFormValidation` expects `propertyName` to be a direct key.
        // The path is constructed.
        // So, `fields` for a list item are flat. For nested objects, the component itself must handle it.
        //
        // Let's stick to the PRD's concept: each item is a set of fields.
        // If 'contact' is an object, its fields would be defined if 'contact' itself was a sub-form or similar.
        // For a simple list item, we define primitive fields.
        // To represent contact.phone, we would typically do:
        // { propertyName: 'contactPhone', component: 'AppInput', props: {label: 'Contact Phone'} }
        // Or, the 'AppInput' for 'contact' would be a component that groups sub-fields.
        //
        // Let's go with a simple phone field for now.
        // If we want a nested object `contact: {phone: '123'}` in the model,
        // then the component for 'contact' would need to manage this structure.
        // PreskoForm by default with AppInput will expect a simple value.
        //
        // FINAL DECISION for App.vue example:
        // Add a "department" field (simple string) and a "sendNewsletter" (boolean, needs a checkbox component).
        // This keeps standard field types.
        propertyName: "department",
        component: "AppInput",
        rules: ["string"],
        props: {
          label: "Department (Optional)",
        },
      },
      {
        propertyName: "sendNewsletter",
        component: "AppCheckbox", // Assuming a custom checkbox component
        type: "checkbox",
        props: {
          label: "Subscribe to Newsletter",
        },
        value: true, // Default value for the checkbox
      }
    ],
  },
  {
    propertyName: "feedback",
    component: "AppTextarea", // Assuming a custom textarea component
    props: {
      label: "Feedback (Optional)",
      rows: 3
    }
  }
]);

// Initial form data
const formData = reactive({
  eventName: "PreskoForm Demo Launch",
  eventDate: new Date().toISOString().split('T')[0], // Today's date
  attendees: [
    { name: "Alice Wonderland", email: "alice@example.com", ticketType: "vip", department: "Marketing", sendNewsletter: true },
    { name: "Bob The Builder", email: "bob@example.com", ticketType: "general", department: "Engineering", sendNewsletter: false },
  ],
  feedback: "",
});

function handleFormSubmit(submittedData) {
  console.log("Form Submitted:", submittedData);
  alert("Form Submitted!\n" + JSON.stringify(submittedData, null, 2));
}

function handleFormReject() {
  console.log("Form Submission Rejected (Validation Failed)");
  alert("Validation Failed! Please check the form for errors.");
}

// Functions to interact with PreskoForm instance (optional, but good for demonstration)
function addAttendee() {
  if (preskoFormRef.value) {
    // preskoFormRef.value.addItem('attendees', { name: 'New Attendee', email: 'new@example.com', ticketType: 'general', sendNewsletter: true });
    // The addItem PRD specified it would use the list's `defaultValue` if no specific data is passed.
    // The `handleAddItem` in PreskoForm.vue now constructs this default value.
    preskoFormRef.value.addItem('attendees');
  }
}
</script>

<template>
  <div id="app-container">
    <h1>PreskoForm Array/List Handling Demo</h1>

    <PreskoForm
      ref="preskoFormRef"
      v-model="formData"
      :fields="fieldsConfig"
      title="Event Registration"
      submit-component="AppSubmit"
      @submit="handleFormSubmit"
      @submit:reject="handleFormReject"
      :error-props="{ errorMessagesType: 'string' }" <!-- To ensure single error string is passed -->
    >
      <template #title>
        <h2>Event Registration Form</h2>
      </template>

      <!-- Custom button to add attendee, demonstrates programmatic addItem -->
      <!-- We can also place this button inside the PreskoForm default slot if preferred -->
    </PreskoForm>

    <!-- This button is outside the form, shows how to call exposed methods -->
    <button type="button" @click="addAttendee" class="external-add-button">Add Attendee Programmatically</button>

    <div class="form-data-display">
      <h3>Current Form Data (formData):</h3>
      <pre>{{ JSON.stringify(formData, null, 2) }}</pre>
    </div>
  </div>
</template>

<style>
body {
  font-family: sans-serif;
  margin: 0;
  padding: 20px;
  background-color: #f4f7f6;
  color: #333;
}

#app-container {
  max-width: 700px;
  margin: 20px auto;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

h1, h2 {
  color: #2c3e50;
  text-align: center;
  margin-bottom: 20px;
}

/* Styles from original App.vue, can be kept or removed */
input:invalid {
  /* Consider using PreskoForm's error display rather than browser defaults */
  /* background-color: ivory; */
  /* border: none; */
  /* outline: 2px solid red; */
}

.form-data-display {
  margin-top: 30px;
  padding: 15px;
  background-color: #e8f0fe;
  border: 1px solid #d1e0fc;
  border-radius: 4px;
}

.form-data-display h3 {
  margin-top: 0;
  color: #1967d2;
}

.form-data-display pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: 0.9em;
  background-color: #fff;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.external-add-button {
  background-color: #4CAF50; /* Green */
  border: none;
  color: white;
  padding: 10px 20px;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  font-size: 16px;
  margin: 10px 0;
  cursor: pointer;
  border-radius: 4px;
}
.external-add-button:hover {
  background-color: #45a049;
}

/* Basic styles for PreskoForm elements (assuming they don't have global styles) */
.presko-form-title {
  font-size: 1.8em;
  margin-bottom: 1.2em;
  color: #333;
}

.presko-list-field {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 15px;
  background-color: #f9f9f9;
}

.presko-list-field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.presko-list-field-header > label {
  font-weight: bold;
  font-size: 1.1em;
}

.presko-list-item {
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  margin-bottom: 10px;
  background-color: #fff;
}

.presko-list-item-fields > div { /* Assuming PreskoFormItem renders in a div */
  margin-bottom: 8px;
}


.presko-list-add-btn,
.presko-list-remove-btn {
  padding: 6px 12px;
  font-size: 0.9em;
  cursor: pointer;
  border-radius: 4px;
  border: 1px solid transparent;
}

.presko-list-add-btn {
  background-color: #2196F3;
  color: white;
}
.presko-list-add-btn:hover {
  background-color: #1976D2;
}

.presko-list-remove-btn {
  background-color: #f44336;
  color: white;
  margin-top: 10px; /* Give it some space if fields are many */
}
.presko-list-remove-btn:hover {
  background-color: #D32F2F;
}

/* Assuming AppInput, AppSelect, AppCheckbox, AppTextarea are simple components */
/* For a real app, these would have more specific styling */
input[type="text"], input[type="email"], input[type="date"], input[type="password"], select, textarea {
  width: calc(100% - 22px); /* Full width minus padding and border */
  padding: 10px;
  margin-bottom: 5px; /* Space for error message */
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}
label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}
.app-checkbox-label { /* For AppCheckbox */
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: normal;
}

/* Error message styling - PreskoFormItem will need to render errors in a span/div */
.presko-form-item .error-message { /* Assuming PreskoFormItem has a class for error messages */
  color: red;
  font-size: 0.8em;
  margin-top: 4px;
}

</style>
