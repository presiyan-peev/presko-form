# PRD: Improved Array/List Handling in PreskoForm

## 1. Introduction/Problem Statement

PreskoForm currently offers robust functionality for handling individual form fields and simple form structures. However, it lacks dedicated, streamlined support for managing dynamic lists or arrays of fields/sub-forms. Users often need to represent collections of similar data, such as a list of contact persons, work experiences, or product items. Manually managing the state, validation, and rendering of such dynamic lists can be complex and error-prone with the current API, requiring significant boilerplate from the developer. This limitation makes it cumbersome to build forms that require users to input a variable number of similar items.

## 2. Proposed Solution

We propose to introduce first-class support for array/list fields within PreskoForm. This will allow developers to define a template for a group of fields (a "sub-form" or "field group") and then dynamically add, remove, and manage multiple instances of this template within their form.

The solution should provide:
- A clear way to define an array field in the `fields` configuration.
- A corresponding structure in the `modelValue` to hold the array data.
- Helper functions or methods to programmatically add and remove items from the list.
- Seamless integration with PreskoForm's existing validation and state management capabilities, applying validation rules to each item in the array.

This feature aims to simplify the developer experience significantly when working with dynamic lists, reducing boilerplate and making form logic more declarative.

## 3. Detailed Design

### 3.1. `fields` Configuration for Lists

To define a list, a new `type: 'list'` or `type: 'array'` could be introduced for a field configuration. This field would also require a `fields` property defining the structure of each item in the list.

**Example:**

```javascript
import { createForm } from 'preskoform';

const form = createForm({
  fields: {
    // ... other fields
    contacts: {
      type: 'list', // New type
      label: 'Contact Persons',
      // 'fields' here defines the structure of each item in the 'contacts' list
      fields: {
        name: {
          label: 'Name',
          rules: ['required', 'string'],
        },
        email: {
          label: 'Email',
          rules: ['required', 'email'],
        },
        phone: {
          label: 'Phone',
          rules: ['string'],
        },
      },
      // Optional: Default value for a new item (can also be an empty object)
      defaultValue: { name: '', email: '', phone: '' },
      // Optional: Initial number of items or initial data
      initialValue: [
        { name: 'John Doe', email: 'john@example.com', phone: '123456' }
      ]
    },
    // ... other fields
  },
  // ... other form options
});
```

In this example, `contacts` is a list field. Each item in the `contacts` list will be an object with `name`, `email`, and `phone` fields, each with its own label and validation rules.

### 3.2. `modelValue` Structure for Lists

The `modelValue` for a list field will be an array of objects, where each object corresponds to an item in the list and matches the structure defined in the list's `fields` configuration.

**Example based on the above configuration:**

```javascript
// Corresponding modelValue for the 'contacts' list
{
  // ... other field values
  contacts: [
    { name: 'John Doe', email: 'john@example.com', phone: '1234567890' },
    { name: 'Jane Smith', email: 'jane@example.com', phone: '0987654321' }
  ]
  // ... other field values
}
```

### 3.3. New Props or Events

- **Props on the `<PreskoForm>` component or returned by `useForm`:**
    - No new top-level props seem immediately necessary on the main component if the list definition is self-contained within the `fields` config.
- **Properties/Methods available for a list field (e.g., via `form.fields.contacts`):**
    - `items`: An array representing the current state of the list items. Each item in this array would be a reactive PreskoForm field group instance (similar to a sub-form), providing access to its own `value`, `errors`, `isValid`, `isDirty`, `isTouched`, etc.
    - `addItem(initialData?: object)`: A method to add a new item to the end of the list. Optionally accepts initial data for the new item; otherwise, uses the `defaultValue` from the list's configuration or an empty object.
    - `removeItem(index: number)`: A method to remove an item from the list at a specific index.
    - `insertItem(index: number, initialData?: object)`: A method to insert an item at a specific index.
    - `moveItem(fromIndex: number, toIndex: number)`: A method to reorder items.
    - `isDirty`: True if any item in the list is dirty.
    - `isTouched`: True if any item in the list has been touched.
    - `isValid`: True if all items in the list are valid.
    - `errors`: An array of error objects, where each object corresponds to an item in the list and contains errors for its fields. Or, potentially, an object mapping item indices to their error objects.
    - `reset()`: Resets all items in the list to their initial values or clears them if no initial values were provided.

- **Events:**
    - `@item-added({ index: number, value: object })`: Emitted when an item is added.
    - `@item-removed({ index: number, removedValue: object })`: Emitted when an item is removed.
    - `@item-moved({ fromIndex: number, toIndex: number })`: Emitted when an item is moved.

### 3.4. User Interaction: Adding/Removing Items

Users (developers using PreskoForm) would interact with the list field primarily through the methods provided on the list field object itself (as obtained from `form.fields.contacts` in the example).

**Example Usage (Conceptual):**

```vue
<template>
  <form @submit.prevent="form.submit()">
    <!-- ... other form fields ... -->

    <div v.for="(contactItem, index) in form.fields.contacts.items" :key="contactItem.id"> // Assuming each item gets a unique internal ID
      <h4>Contact {{ index + 1 }}</h4>
      <input v-model="contactItem.fields.name.value" placeholder="Name" />
      <span v-if="contactItem.fields.name.errors.length">{{ contactItem.fields.name.errors[0] }}</span>

      <input v-model="contactItem.fields.email.value" placeholder="Email" />
      <span v-if="contactItem.fields.email.errors.length">{{ contactItem.fields.email.errors[0] }}</span>

      <input v-model="contactItem.fields.phone.value" placeholder="Phone" />
      <span v-if="contactItem.fields.phone.errors.length">{{ contactItem.fields.phone.errors[0] }}</span>

      <button type="button" @click="form.fields.contacts.removeItem(index)">Remove Contact</button>
    </div>
    <button type="button" @click="form.fields.contacts.addItem()">Add Contact</button>

    <!-- ... submit button ... -->
  </form>
</template>

<script setup>
import { useForm } from 'preskoform'; // or however it's imported

const form = useForm({ /* fields config as above */ });
</script>
```
The `contactItem` in the loop would be a reactive object exposing the state and fields of that specific list item, similar to how `form.fields.fieldName` works for regular fields. Each `contactItem` would itself contain `fields`, `value`, `errors`, `isValid`, etc., scoped to that item.

### 3.5. Validation for List Items

Validation rules defined in the `fields` block of the list configuration (`contacts.fields` in the example) would automatically apply to each item in the list.

- When `form.validate()` is called, or when a field within a list item changes, validation for that item (and its fields) would trigger.
- The `errors` property of the list field (`form.fields.contacts.errors`) would aggregate validation errors from all items. It could be an array where each element is the error object for the corresponding item, or an object mapping indices to error objects. For example:
  ```javascript
  // Example: form.fields.contacts.errors
  [
    { name: [], email: ['Email is invalid'] }, // Errors for item at index 0
    { name: ['Name is required'], email: [] }  // Errors for item at index 1
  ]
  ```
- The overall `form.isValid` would only be true if all fields in all items of all lists are valid (along with all other top-level fields).
- Individual list items would also have their own `isValid` status (e.g., `form.fields.contacts.items[0].isValid`).

## 4. Future Considerations

- **Nested Lists:** Support for lists within lists. The proposed design should inherently support this if a list item's `fields` can itself contain another list field.
- **Cross-Item Validation:** Rules that validate based on relationships between items in the list (e.g., "at least one contact must be marked as primary," or "no duplicate email addresses in the contact list"). This might require a new type of validation rule or a way to define list-level validation functions.
- **Performance for Very Large Lists:** For extremely large lists, performance implications of deep reactivity and validation need to be considered and potentially optimized (e.g., virtualization strategies, though this is more of a rendering concern which is outside PreskoForm's core headless nature, but the data handling should be efficient).
- **Tuple-like Structures:** Support for fixed-size arrays with different field types at each position (tuples), though this is less common in forms than dynamic lists of identical structures.
- **Integration with `initialValue` and `modelValue` updates:** Ensuring robust behavior when the entire list's `initialValue` or `modelValue` is programmatically changed from outside the form instance.
- **Unique Keys for List Items:** While Vue's `v-for` requires a `:key`, PreskoForm should internally manage stable unique identifiers for each list item instance to correctly track its state, errors, and values, even when items are reordered, added, or removed. This ID should be accessible to the developer for use as a `:key`.

This PRD provides a foundational design for implementing array/list handling in PreskoForm. Further refinement and discussion will be needed during the implementation phase.
