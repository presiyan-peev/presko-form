import { ref, reactive } from 'vue';
import { action } from '@storybook/addon-actions';

// PreskoForm and the UI components (AppInput, AppSubmit etc.) are globally registered in .storybook/preview.js

export default {
  title: 'Forms/PreskoForm',
  component: 'PreskoForm', // Use string name due to global registration
  argTypes: {
    fields: { control: 'object' },
    title: { control: 'text' },
    submitComponent: { control: 'text' },
    // modelValue: { control: 'object' }, // modelValue is better controlled by the story's local state
    onSubmit: { action: 'submitted' },
    'onSubmit:reject': { action: 'rejected' },
    'onField:touched': { action: 'fieldTouched' },
    'onField:dirty': { action: 'fieldDirty' },
    'onField:pending': { action: 'fieldPending' },
  },
  args: { // Default args for all stories
    submitComponent: 'AppSubmit', // Using the globally registered stub
    title: 'Storybook Form Demo',
  },
};

// Vue imports are already at the top of the file. This one was a duplicate.
// import { ref, reactive, watch, computed } from 'vue';

// Template for all stories
const Template = (args, { updateArgs }) => ({
  setup() {
    const initialData = args.initialFormData || {};
    const formData = reactive(JSON.parse(JSON.stringify(initialData)));
    const preskoFormRef = ref(null);

    // --- Logic for conditional fields ---
    // Store the reactive refs for isShowing props
    const conditionalVisibilityRefs = {};

    // Create computed fields that will be passed to PreskoForm
    const processedFields = computed(() => {
      // Deep clone args.fields to avoid modifying the original story args
      const clonedFields = JSON.parse(JSON.stringify(args.fields || []));

      return clonedFields.map(field => {
        if (field.visibilityController && formData.hasOwnProperty(field.visibilityController)) {
          const controllerFieldName = field.visibilityController;

          // Create a reactive ref for this field's visibility if it doesn't exist
          if (!conditionalVisibilityRefs[field.propertyName]) {
            conditionalVisibilityRefs[field.propertyName] = ref(!!formData[controllerFieldName]);

            // Watch the controller field in formData and update the ref
            watch(() => formData[controllerFieldName], (newValue) => {
              if (conditionalVisibilityRefs[field.propertyName]) {
                conditionalVisibilityRefs[field.propertyName].value = !!newValue;
              }
            });
          }
          // Replace isShowing with the reactive ref
          field.isShowing = conditionalVisibilityRefs[field.propertyName];
        }
        return field;
      });
    });
    // --- End logic for conditional fields ---

    const handleUpdateModelValue = (newVal) => {
      for (const key in newVal) {
        formData[key] = newVal[key];
      }
      for (const key in formData) {
        if (!newVal.hasOwnProperty(key)) {
          delete formData[key];
        }
      }
    };

    const handleSubmit = (data) => {
      action('submit')(data);
      alert('Form Submitted! Check actions tab.\n' + JSON.stringify(data, null, 2));
    };

    const handleReject = (data) => {
      action('submit:reject')(data);
      alert('Form Rejected! Check actions tab or console.\n' + JSON.stringify(data, null, 2));
    };

    return {
      args,
      formData,
      processedFields, // Use processedFields in the template
      handleUpdateModelValue,
      handleSubmit,
      handleReject,
      preskoFormRef,
      logEvent: action,
    };
  },
  template: `
    <div>
      <PreskoForm
        ref="preskoFormRef"
        v-model="formData"
        :fields="processedFields" // Use the dynamically processed fields
        :title="args.title"
        :submit-component="args.submitComponent"
        :submit-btn-props="args.submitBtnProps"
        :error-props="args.errorProps"
        :validation-trigger="args.validationTrigger || 'onBlur'"
        @submit="handleSubmit"
        @submit:reject="handleReject"
        @field:touched="logEvent('field:touched')"
        @field:dirty="logEvent('field:dirty')"
        @field:pending="logEvent('field:pending')"
        style="border: 1px solid #eee; padding: 20px; border-radius: 5px;"
      >
        <!-- You can add slots here if needed for specific stories -->
      </PreskoForm>
      <div style="margin-top: 20px; padding: 10px; background-color: #f0f0f0; border-radius: 5px;">
        <h3>Live Form Data (v-model):</h3>
        <pre>{{ JSON.stringify(formData, null, 2) }}</pre>
      </div>
    </div>
  `,
});

export const SimpleForm = Template.bind({});
SimpleForm.args = {
  title: 'Simple Contact Form',
  initialFormData: {
    fullName: 'Jules Verne',
    email: 'jules@example.com',
    message: '',
  },
  fields: [
    {
      propertyName: 'fullName',
      component: 'AppInput', // Uses StoryInput.vue via global registration
      label: 'Full Name',
      rules: ['required', 'string'],
      props: {
        placeholder: 'Enter your full name',
      },
    },
    {
      propertyName: 'email',
      component: 'AppInput',
      type: 'email',
      label: 'Email Address',
      rules: ['required', 'email'],
      props: {
        placeholder: 'Enter your email',
      },
    },
    {
      propertyName: 'message',
      component: 'AppTextarea', // Now using the dedicated StoryTextarea
      label: 'Message (Optional)',
      props: {
        placeholder: 'Enter your message (min. 10 chars if filled)',
        rows: 3,
      },
      // Example of a rule that allows empty value but validates if not empty
      rules: [
        (value) => {
          if (!value) return true; // Allow empty
          return value.length >= 10 || 'Message must be at least 10 characters long if provided.';
        }
      ],
    },
  ],
  submitBtnProps: {
    text: 'Send Message',
  },
};
SimpleForm.storyName = '1. Simple Form with Basic Validation';
SimpleForm.parameters = {
  docs: {
    description: {
      story: 'Demonstrates a basic form with a few input fields (text, email, textarea) and standard validation rules like `required` and `email`. Shows how `fieldsConfig` is defined and how submitted data is handled. The `AppTextarea` component is used for the message field.',
    },
  },
};

// ----- Story 2: Form with Various Validations (will be added next) -----

export const ValidationForm = Template.bind({});

const checkAvailability = (value) => {
  action('asyncValidator')(`Checking availability for: ${value}`);
  return new Promise((resolve) => {
    if (!value) {
      resolve(true); // Don't validate if empty, let 'required' handle it
      return;
    }
    setTimeout(() => {
      if (value.toLowerCase() === 'taken') {
        resolve('This username is already taken.');
      } else if (value.length < 5) {
        resolve('Username must be at least 5 characters long (async check).');
      } else {
        resolve(true);
      }
    }, 1500);
  });
};

const customSyncValidator = (value, label, fieldConfig) => {
  if (!value) return true; // Don't validate if empty
  if (value.toLowerCase() !== 'presko') {
    return `${label} must be 'Presko' (case-insensitive).`;
  }
  return true;
};


ValidationForm.args = {
  title: 'Advanced Validation Demo',
  initialFormData: {
    username: '',
    email: 'test@example', // Intentionally invalid to show initial validation on blur/submit
    secretCode: '',
    feedback: '',
    eventDate: new Date().toISOString().split("T")[0],
  },
  fields: [
    {
      propertyName: 'username',
      component: 'AppInput',
      label: 'Username (type "taken" or short value for async error)',
      rules: ['required', { name: 'minLength', params: { min: 3, message: 'Username must be at least 3 characters (sync check).' } }],
      validators: [checkAvailability],
      props: {
        placeholder: 'e.g., user123',
      },
    },
    {
      propertyName: 'email',
      component: 'AppInput',
      type: 'email',
      label: 'Email Address',
      rules: ['required', 'email'],
      props: {
        placeholder: 'your.email@example.com',
      },
    },
    {
      propertyName: 'secretCode',
      component: 'AppInput',
      label: 'Secret Code (must be "Presko")',
      rules: ['required'],
      validators: [customSyncValidator],
      props: {
        placeholder: 'Hint: Presko',
      },
    },
    {
      propertyName: 'eventDate',
      component: 'AppInput',
      type: 'date',
      label: 'Event Date (must be in the future)',
      rules: ['required', (value) => {
        if (!value) return true; // Handled by required
        const today = new Date();
        today.setHours(0,0,0,0); // Compare dates only
        return new Date(value) > today || 'Event date must be in the future.';
      }],
      props: {},
    },
     {
      propertyName: 'feedback',
      component: 'AppTextarea',
      label: 'Feedback (Optional, max 50 chars)',
      rules: [{ name: 'maxLength', params: { max: 50 } }],
      props: {
        placeholder: 'Let us know your thoughts',
        rows: 2,
      },
    },
  ],
  submitBtnProps: {
    text: 'Validate & Submit',
  },
  validationTrigger: 'onInput', // More interactive for demoing validation
};
ValidationForm.storyName = '2. Form with Various Validations';
ValidationForm.parameters = {
  docs: {
    description: {
      story: 'Showcases advanced validation scenarios including: synchronous custom validators, asynchronous validators with pending states, built-in rules like `minLength` and `email`, and custom functional rules (e.g., date must be in the future). Set to `validationTrigger: onInput` for immediate feedback.',
    },
  },
};


// ----- Story 3: Form with List/Array Fields (will be added next) -----

export const ListFieldsForm = Template.bind({});
ListFieldsForm.args = {
  title: 'Event Registration with Attendees List',
  initialFormData: {
    eventName: 'Storybook Users Meetup',
    attendees: [
      { name: 'Alice L.', email: 'alice@example.com', ticketType: 'vip' },
      { name: 'Bob C.', email: 'bob@example.com', ticketType: 'general' },
    ],
  },
  fields: [
    {
      propertyName: 'eventName',
      component: 'AppInput',
      label: 'Event Name',
      rules: ['required', 'string'],
      props: { placeholder: 'Name of the event' },
    },
    {
      type: 'list',
      propertyName: 'attendees',
      label: 'Attendees',
      itemLabel: 'Attendee', // Used for "Add Attendee" button in PreskoForm
      // Default values for a new item when added by PreskoForm's internal button
      // or by calling addItem('attendees') without specific data.
      defaultValue: {
        name: '',
        email: '',
        ticketType: 'general',
      },
      fields: [ // Field definitions for each item in the list
        {
          propertyName: 'name',
          component: 'AppInput',
          label: 'Full Name',
          rules: ['required', 'string'],
          props: { placeholder: 'e.g., Jane Doe' },
        },
        {
          propertyName: 'email',
          component: 'AppInput',
          type: 'email',
          label: 'Email Address',
          rules: ['required', 'email'],
          props: { placeholder: 'e.g., jane.doe@example.com' },
        },
        {
          propertyName: 'ticketType',
          component: 'AppSelect', // Uses StorySelect.vue
          label: 'Ticket Type',
          rules: ['required'],
          props: {
            options: [
              { value: 'general', text: 'General Admission' },
              { value: 'vip', text: 'VIP Pass' },
              { value: 'student', text: 'Student Pass' },
            ],
            placeholder: 'Select a ticket type',
          },
        },
      ],
    },
  ],
  submitBtnProps: {
    text: 'Register Event',
  },
};
ListFieldsForm.storyName = '3. Form with List/Array Fields';
ListFieldsForm.parameters = {
  docs: {
    description: {
      story: "Illustrates how to use `type: 'list'` to manage a list of complex objects (attendees in this case), each with its own set of fields and validations. Demonstrates adding and removing items from the list. `PreskoForm` internally handles the 'Add Item' and 'Remove' buttons for list fields.",
    },
  },
};

// ----- Story 4: Conditional Field Rendering -----

export const ConditionalFieldsForm = Template.bind({});
ConditionalFieldsForm.args = {
  title: 'Conditional Field Demo',
  initialFormData: {
    mainField: 'Some data',
    extraInfo: '',
    toggleExtra: false, // This will control the visibility
  },
  fields: [
    {
      propertyName: 'mainField',
      component: 'AppInput',
      label: 'Main Field',
      rules: ['required'],
    },
    {
      propertyName: 'toggleExtra',
      component: 'AppCheckbox',
      label: 'Show Extra Information Field?',
      // This field is marked by the story to control another field's visibility
      // The Template's setup function will look for this `controlsVisibilityOf` prop.
      controlsVisibilityOf: 'extraInfo', // Custom marker
    },
    {
      propertyName: 'extraInfo',
      component: 'AppTextarea',
      label: 'Extra Information (Conditional)',
      rules: ['required'], // Required only if shown
      props: { placeholder: 'This field is conditional' },
      // `isShowing` will be dynamically replaced by a ref in the Template setup
      // based on the `toggleExtra` field's value.
      // For the static definition, we can set it to true or false,
      // it will be overwritten by the reactive ref.
      isShowing: false, // Placeholder, will be made reactive
      visibilityController: 'toggleExtra', // Links to the controlling field
    },
  ],
  submitBtnProps: {
    text: 'Submit Conditional Data',
  },
};
ConditionalFieldsForm.storyName = '4. Conditional Field Rendering';

// The main `Template` function will need to be updated to handle
// `controlsVisibilityOf` and `visibilityController` logic.
ConditionalFieldsForm.parameters = {
  docs: {
    description: {
      story: "Demonstrates conditional rendering of form fields using the `isShowing` property. A checkbox (`toggleExtra`) controls the visibility of a textarea (`extraInfo`). The story's template setup includes logic to make `isShowing` reactive based on the controlling field's value.",
    },
  },
};
