import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import PreskoForm from './PreskoForm.vue'; // Adjust path if necessary
import StubAppInput from '../__tests__/stubs/StubAppInput.vue';
import StubAppSubmit from '../__tests__/stubs/StubAppSubmit.vue';
import { nextTick, defineComponent } from 'vue';

// Helper to create a basic PreskoForm wrapper
const createFormWrapper = (props = {}, options = {}) => {
  return mount(PreskoForm, {
    props: {
      fields: [],
      modelValue: {},
      submitComponent: 'StubAppSubmit', // Default submit component for tests
      ...props,
    },
    global: {
      components: {
        StubAppInput, // Register stub for tests
        StubAppSubmit, // Register stub for tests
        // If PreskoFormItem is used internally and globally registered, it might be fine.
        // Otherwise, we might need to stub/register it too if it causes issues.
        // For now, assuming PreskoFormItem is internally handled or globally available.
      },
      ...options.global,
    },
    ...options,
  });
};

describe('PreskoForm.vue', () => {
  describe('Basic Rendering', () => {
    it('mounts successfully with minimal props', () => {
      const wrapper = createFormWrapper();
      expect(wrapper.exists()).toBe(true);
    });

    it('renders a title when title prop is provided', () => {
      const title = 'My Test Form';
      const wrapper = createFormWrapper({ title });
      expect(wrapper.text()).toContain(title);
    });

    it('renders specified components for fields', () => {
      const fields = [
        { propertyName: 'name', component: 'StubAppInput', props: { label: 'Name' } },
        { propertyName: 'email', component: 'StubAppInput', props: { label: 'Email' } },
      ];
      const wrapper = createFormWrapper({ fields });

      const inputComponents = wrapper.findAllComponents(StubAppInput);
      expect(inputComponents.length).toBe(fields.length);
      expect(inputComponents[0].props('label')).toBe('Name');
      expect(inputComponents[1].props('label')).toBe('Email');
    });

    it('renders the submit component', () => {
      const wrapper = createFormWrapper();
      expect(wrapper.findComponent(StubAppSubmit).exists()).toBe(true);
    });
  });

  describe('v-model integration', () => {
    it('updates input components when modelValue prop changes', async () => {
      const fields = [{ propertyName: 'name', component: 'StubAppInput' }];
      const initialModelValue = { name: 'Initial Name' };
      const wrapper = createFormWrapper({ fields, modelValue: initialModelValue });

      const input = wrapper.findComponent(StubAppInput);
      expect(input.props('modelValue')).toBe('Initial Name');

      // Simulate external change to modelValue
      const newName = 'Updated Name';
      await wrapper.setProps({ modelValue: { ...initialModelValue, name: newName } });
      await nextTick(); // Wait for Vue to process prop updates

      expect(input.props('modelValue')).toBe(newName);
    });

    it('emits "update:modelValue" with the correct data when an input changes', async () => {
      const fields = [
        { propertyName: 'name', component: 'StubAppInput' },
        { propertyName: 'email', component: 'StubAppInput', value: 'test@example.com' },
      ];
      const initialModelValue = { name: 'John' }; // email will be from field.value
      const wrapper = createFormWrapper({ fields, modelValue: initialModelValue });

      // Wait for initial values to propagate if necessary (PreskoForm initializes modelValue internally)
      await nextTick();
      await nextTick(); // Sometimes need a couple of ticks for complex initializations or watchers

      const nameInput = wrapper.findAllComponents(StubAppInput)[0];

      // Simulate user typing in the name input
      const newName = 'Jane';
      // StubAppInput should emit 'update:modelValue' when its internal input's value changes
      nameInput.vm.$emit('update:modelValue', newName);
      await nextTick();

      // Check emitted event
      const updateModelValueEvents = wrapper.emitted('update:modelValue');
      expect(updateModelValueEvents).toBeTruthy();
      expect(updateModelValueEvents.length).toBeGreaterThanOrEqual(1);

      // The PreskoForm's modelValue is updated internally.
      // The emitted event should contain the full updated form data.
      // The internal modelValue of PreskoForm combines initial props.modelValue and field.value defaults.
      // So, if email had an initial value from `fields[1].value`, it should be part of the emitted data.
      const expectedEmittedData = { name: newName, email: 'test@example.com' };
      // The last event should have the most up-to-date data
      expect(updateModelValueEvents[updateModelValueEvents.length - 1][0]).toEqual(expectedEmittedData);


      // Also verify the internal modelValue of PreskoForm (if accessible, or by checking props again)
      // This is implicitly tested by the emitted event, but good to be aware of.
    });

    it('correctly initializes modelValue from field default values if not in prop modelValue', async () => {
        const fields = [
            { propertyName: 'name', component: 'StubAppInput', value: 'Default Name' },
            { propertyName: 'email', component: 'StubAppInput', value: 'default@example.com' }
        ];
        const initialModelValue = { name: 'Override Name' }; // Only name is in prop
        const wrapper = createFormWrapper({ fields, modelValue: initialModelValue });

        await nextTick(); // Allow PreskoForm to initialize its internal model

        const nameInput = wrapper.findAllComponents(StubAppInput)[0];
        const emailInput = wrapper.findAllComponents(StubAppInput)[1];

        expect(nameInput.props('modelValue')).toBe('Override Name'); // From prop
        expect(emailInput.props('modelValue')).toBe('default@example.com'); // From field default

        // Check that an update:modelValue event is emitted with the fully merged initial state
        // PreskoForm initializes its local `modelValue` and emits it if it differs from the prop.
        const emittedUpdate = wrapper.emitted('update:modelValue');
        if (emittedUpdate) { // It might not emit if the prop already matched the fully initialized state
             expect(emittedUpdate[emittedUpdate.length-1][0]).toEqual({
                name: 'Override Name',
                email: 'default@example.com'
            });
        } else {
            // If no event, means the prop was already what PreskoForm considers fully initialized.
            // This can happen if the parent component already has the complete modelValue.
            // For this test, we ensure the inputs have the correct values.
            // And if we trigger an input, the next emitted value should be correct.
        }
    });
  });

  describe('Validation and Submission Flow', () => {
    let wrapper;
    const fields = [
      {
        propertyName: 'name',
        component: 'StubAppInput',
        rules: ['required'],
        props: { label: 'Name' },
      },
      {
        propertyName: 'email',
        component: 'StubAppInput',
        rules: ['required', 'email'],
        props: { label: 'Email' },
      },
    ];

    beforeEach(() => {
      // Reset wrapper for each test in this block
      wrapper = mount(PreskoForm, {
        props: {
          fields,
          modelValue: { name: '', email: '' }, // Start with empty, invalid values
          submitComponent: 'StubAppSubmit',
        },
        global: {
          components: { StubAppInput, StubAppSubmit },
        },
      });
    });

    it('emits "submit:reject" and displays errors when form is submitted with invalid data', async () => {
      // Initial state: name and email are empty, which violates 'required'
      const nameInput = wrapper.findAllComponents(StubAppInput)[0];
      const emailInput = wrapper.findAllComponents(StubAppInput)[1];

      // Attempt to submit the form
      await wrapper.find('form').trigger('submit.prevent');
      await nextTick();

      // Check for submit:reject event
      expect(wrapper.emitted('submit:reject')).toBeTruthy();
      expect(wrapper.emitted('submit:reject').length).toBe(1);
      expect(wrapper.emitted('submit')).toBeUndefined(); // No 'submit' event

      // Check if error messages are displayed in StubAppInput
      // (StubAppInput should receive 'error' and 'errorMessages' props)
      expect(nameInput.props('error')).toBe(true);
      expect(nameInput.props('errorMessages')).toBe('Field Name is required.');
      // Email is also required, but the first error for it would be 'required'
      expect(emailInput.props('error')).toBe(true);
      expect(emailInput.props('errorMessages')).toBe('Field Email is required.');
    });

    it('emits "submit" with form data when form is valid and submitted', async () => {
      // Set valid data
      await wrapper.setProps({ modelValue: { name: 'John Doe', email: 'john.doe@example.com' } });
      await nextTick();

      // Clear previous validation states if any (though a fresh mount helps)
      // Or ensure inputs reflect the new valid state and don't show old errors
      const nameInput = wrapper.findAllComponents(StubAppInput)[0];
      const emailInput = wrapper.findAllComponents(StubAppInput)[1];

      // Manually reset error props on stubs for this test if PreskoForm doesn't automatically clear them on valid input
      // This depends on PreskoForm's internal logic for clearing errors when inputs become valid *before* submit.
      // For now, we assume that on providing valid data, errors should not be present before submit.
      // A more robust test would interact with inputs, then submit.

      // Let's simulate filling the form via input interactions for a more E2E feel for this test
      nameInput.vm.$emit('update:modelValue', 'John Doe');
      await nextTick();
      emailInput.vm.$emit('update:modelValue', 'john.doe@example.com');
      await nextTick();

      // Update the modelValue on the wrapper to reflect these changes, as PreskoForm would have emitted them
      await wrapper.setProps({ modelValue: { name: 'John Doe', email: 'john.doe@example.com' } });
      await nextTick();


      // Attempt to submit the form
      await wrapper.find('form').trigger('submit.prevent');
      await nextTick();

      // Check for submit event
      expect(wrapper.emitted('submit')).toBeTruthy();
      expect(wrapper.emitted('submit').length).toBe(1);
      expect(wrapper.emitted('submit')[0][0]).toEqual({ name: 'John Doe', email: 'john.doe@example.com' });
      expect(wrapper.emitted('submit:reject')).toBeUndefined(); // No 'submit:reject' event

      // Errors should not be displayed
      expect(nameInput.props('error')).toBe(false); // Or undefined, depending on how StubAppInput handles it
      expect(emailInput.props('error')).toBe(false);
    });

    it('clears errors when an invalid field becomes valid and form is re-validated (e.g. on next submit attempt)', async () => {
      // 1. Initial invalid submission
      await wrapper.find('form').trigger('submit.prevent');
      await nextTick();
      const nameInput = wrapper.findAllComponents(StubAppInput)[0];
      expect(nameInput.props('error')).toBe(true);
      expect(nameInput.props('errorMessages')).toBe('Field Name is required.');

      // 2. Correct the field
      nameInput.vm.$emit('update:modelValue', 'Valid Name');
      await nextTick();
      // PreskoForm should emit update:modelValue, so update the prop
      await wrapper.setProps({ modelValue: { name: 'Valid Name', email: '' } });
      await nextTick();

      // At this point, the 'name' field's error prop might still be true because validation typically runs on submit.
      // Some forms clear errors on input, PreskoForm's useFormValidation seems to validate on demand (submit or direct call).
      // Let's check the error state *after* another submit attempt (email is still invalid).

      await wrapper.find('form').trigger('submit.prevent');
      await nextTick();

      // Name field should now be valid (no error prop or error message)
      expect(nameInput.props('error')).toBe(false); // Or undefined
      expect(nameInput.props('errorMessages')).toBeUndefined();

      // Email field should still show an error
      const emailInput = wrapper.findAllComponents(StubAppInput)[1];
      expect(emailInput.props('error')).toBe(true);
      expect(emailInput.props('errorMessages')).toBe('Field Email is required.');
      expect(wrapper.emitted('submit:reject').length).toBe(2); // Rejected again
    });

    it('handles custom error messages from validation rules', async () => {
        const fieldsWithCustomError = [
            {
                propertyName: 'username',
                component: 'StubAppInput',
                rules: [{ name: 'required', customErrorMsg: 'Username must be provided.' }],
                props: { label: 'Username' },
            }
        ];
        wrapper = mount(PreskoForm, { // Re-mount for this specific field config
            props: {
                fields: fieldsWithCustomError,
                modelValue: { username: '' },
                submitComponent: 'StubAppSubmit',
            },
            global: { components: { StubAppInput, StubAppSubmit } },
        });

        await wrapper.find('form').trigger('submit.prevent');
        await nextTick();

        const input = wrapper.findComponent(StubAppInput);
        expect(input.props('error')).toBe(true);
        expect(input.props('errorMessages')).toBe('Username must be provided.');
        expect(wrapper.emitted('submit:reject')).toBeTruthy();
    });
  });

  describe('Sub-form Functionality', () => {
    let wrapper;
    const subFormFields = [
      { propertyName: 'street', component: 'StubAppInput', rules: ['required'], props: { label: 'Street' } },
      { propertyName: 'city', component: 'StubAppInput', rules: ['required'], props: { label: 'City' } },
    ];
    const mainFieldsConfig = [
      { propertyName: 'fullName', component: 'StubAppInput', rules: ['required'], props: { label: 'Full Name' } },
      {
        subForm: 'address', // This propertyName will hold the sub-form's data
        fields: subFormFields,
      },
    ];

    // Helper to mount with sub-form config
    const mountWithSubForm = (modelValue = { fullName: '', address: { street: '', city: '' } }) => {
      return mount(PreskoForm, {
        props: {
          fields: mainFieldsConfig,
          modelValue: modelValue,
          submitComponent: 'StubAppSubmit',
        },
        global: {
          components: { StubAppInput, StubAppSubmit, PreskoForm }, // PreskoForm needs to be available for itself
        },
      });
    };

    it('renders nested PreskoForm components for sub-form configurations', () => {
      wrapper = mountWithSubForm();
      const mainForm = wrapper.findComponent(PreskoForm); // The main instance
      expect(mainForm.exists()).toBe(true);

      // Find all PreskoForm instances; there should be one main and one nested
      const allForms = wrapper.findAllComponents(PreskoForm);
      expect(allForms.length).toBe(2); // Main form + 1 sub-form

      // The nested form should receive its part of the modelValue and fields
      const nestedForm = allForms[1]; // Assuming the second one is the nested one
      expect(nestedForm.props('fields')).toEqual(subFormFields);
    });

    it('binds v-model correctly for sub-forms (nested data structure)', async () => {
      wrapper = mountWithSubForm({ fullName: 'Parent Name', address: { street: '123 Main St', city: 'Anytown' } });
      await nextTick();

      const allStubInputs = wrapper.findAllComponents(StubAppInput);
      // fullName input, then street, then city
      expect(allStubInputs[0].props('modelValue')).toBe('Parent Name');
      expect(allStubInputs[1].props('modelValue')).toBe('123 Main St');
      expect(allStubInputs[2].props('modelValue')).toBe('Anytown');

      // Simulate change in sub-form input
      const streetInput = allStubInputs[1];
      await streetInput.vm.$emit('update:modelValue', '456 New Ave');
      await nextTick();

      const emittedUpdate = wrapper.emitted('update:modelValue');
      expect(emittedUpdate).toBeTruthy();
      const lastEmittedData = emittedUpdate[emittedUpdate.length - 1][0];
      expect(lastEmittedData).toEqual({
        fullName: 'Parent Name',
        address: { street: '456 New Ave', city: 'Anytown' },
      });
    });

    it('propagates modelValue changes from parent to sub-form inputs', async () => {
      wrapper = mountWithSubForm();
      await nextTick();

      await wrapper.setProps({
        modelValue: { fullName: 'Changed Name', address: { street: 'Updated Street', city: 'Updated City' } }
      });
      await nextTick();

      const allStubInputs = wrapper.findAllComponents(StubAppInput);
      expect(allStubInputs[0].props('modelValue')).toBe('Changed Name');
      expect(allStubInputs[1].props('modelValue')).toBe('Updated Street');
      expect(allStubInputs[2].props('modelValue')).toBe('Updated City');
    });

    it('validates sub-forms and rejects submission if sub-form is invalid', async () => {
      wrapper = mountWithSubForm({ fullName: 'Valid Name', address: { street: '', city: 'Anytown' } }); // Street is required but empty
      await nextTick();

      await wrapper.find('form').trigger('submit.prevent'); // Find the main form
      await nextTick();

      expect(wrapper.emitted('submit:reject')).toBeTruthy();
      expect(wrapper.emitted('submit')).toBeUndefined();

      // Check if error is shown on the sub-form's input
      // The second PreskoForm instance is the sub-form
      const subFormWrapper = wrapper.findAllComponents(PreskoForm)[1];
      const streetInputInSubForm = subFormWrapper.findAllComponents(StubAppInput)[0];
      expect(streetInputInSubForm.props('error')).toBe(true);
      expect(streetInputInSubForm.props('errorMessages')).toBe('Field Street is required.');
    });

    it('emits submit with nested data when main and sub-forms are valid', async () => {
      wrapper = mountWithSubForm({
        fullName: 'Another Valid Name',
        address: { street: '789 Good St', city: 'Validville' },
      });
      await nextTick();

      // Ensure inputs are updated if not already via modelValue prop initialization
      const allStubInputs = wrapper.findAllComponents(StubAppInput);
      allStubInputs[0].vm.$emit('update:modelValue', 'Another Valid Name');
      allStubInputs[1].vm.$emit('update:modelValue', '789 Good St');
      allStubInputs[2].vm.$emit('update:modelValue', 'Validville');
      await nextTick();
      await wrapper.setProps({  // Simulate parent reflecting these changes
         modelValue: {
            fullName: 'Another Valid Name',
            address: { street: '789 Good St', city: 'Validville' },
          }
      });
      await nextTick();


      await wrapper.find('form').trigger('submit.prevent');
      await nextTick();

      expect(wrapper.emitted('submit')).toBeTruthy();
      const submittedData = wrapper.emitted('submit')[0][0];
      expect(submittedData).toEqual({
        fullName: 'Another Valid Name',
        address: { street: '789 Good St', city: 'Validville' },
      });
      expect(wrapper.emitted('submit:reject')).toBeUndefined();
    });
  });

  describe('Props Functionality', () => {
    // `title` prop is implicitly tested in 'Basic Rendering'

    it('uses the specified `submitComponent`', () => {
      // Define a distinct submit component for this test
      const DistinctSubmitButton = defineComponent({
        template: '<button type="submit" class="distinct-submit-button">Distinct Submit</button>',
        name: 'DistinctSubmitButton'
      });
      const wrapper = mount(PreskoForm, {
        props: {
          fields: [{ propertyName: 'test', component: 'StubAppInput' }],
          modelValue: { test: '' },
          submitComponent: 'DistinctSubmitButton',
        },
        global: {
          components: { StubAppInput, DistinctSubmitButton },
        },
      });
      expect(wrapper.findComponent(DistinctSubmitButton).exists()).toBe(true);
      expect(wrapper.find('.distinct-submit-button').exists()).toBe(true);
    });

    it('applies `submitBtnClasses` to the submit component', () => {
      const wrapper = mount(PreskoForm, {
        props: {
          fields: [], modelValue: {},
          submitComponent: 'StubAppSubmit',
          submitBtnClasses: 'extra-class-1 extra-class-2',
        },
        global: { components: { StubAppInput, StubAppSubmit } },
      });
      const submitButton = wrapper.findComponent(StubAppSubmit);
      expect(submitButton.classes()).toContain('extra-class-1');
      expect(submitButton.classes()).toContain('extra-class-2');
    });

    it('passes `submitBtnProps` to the submit component', () => {
      const wrapper = mount(PreskoForm, {
        props: {
          fields: [], modelValue: {},
          submitComponent: 'StubAppSubmit',
          submitBtnProps: { text: 'Go', disabled: true }, // StubAppSubmit accepts 'text'
        },
        global: { components: { StubAppInput, StubAppSubmit } },
      });
      const submitButton = wrapper.findComponent(StubAppSubmit);
      expect(submitButton.props('text')).toBe('Go');
      expect(submitButton.attributes('disabled')).toBeDefined();
    });

    describe('errorProps functionality', () => {
      const fieldsForErrorProps = [
        { propertyName: 'field1', component: 'StubAppInput', rules: ['required'], props: { label: 'Field 1' } }
      ];

      // StubInput that expects custom error prop names
      const CustomErrorPropInput = defineComponent({
        name: 'CustomErrorPropInput',
        template: `
          <div>
            <input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />
            <div v-if="isInvalid && validationMsg" class="custom-error-display">
              {{ typeof validationMsg === 'string' ? validationMsg : validationMsg.join(', ') }}
            </div>
          </div>
        `,
        props: ['modelValue', 'label', 'isInvalid', 'validationMsg'], // Custom names
        emits: ['update:modelValue']
      });

      it('passes custom error prop names to field items when `errorProps` is configured', async () => {
        const customErrorProps = {
          hasErrors: 'isInvalid',       // Custom prop name for boolean error state
          errorMessages: 'validationMsg', // Custom prop name for error message(s)
          errorMessagesType: 'string',  // Can be 'string' or 'array'
        };

        const wrapper = mount(PreskoForm, {
          props: {
            fields: [{ propertyName: 'field1', component: 'CustomErrorPropInput', rules: ['required'] }],
            modelValue: { field1: '' }, // Invalid state
            submitComponent: 'StubAppSubmit',
            errorProps: customErrorProps,
          },
          global: {
            components: { CustomErrorPropInput, StubAppSubmit },
          },
        });

        await wrapper.find('form').trigger('submit.prevent');
        await nextTick();

        const inputComponent = wrapper.findComponent(CustomErrorPropInput);
        expect(inputComponent.exists()).toBe(true);

        // Check that CustomErrorPropInput received the props with the custom names
        expect(inputComponent.props('isInvalid')).toBe(true);
        expect(inputComponent.props('validationMsg')).toBe('Field field1 is required.'); // Default message from useFormValidation
        expect(wrapper.emitted('submit:reject')).toBeTruthy();
      });

      it('passes error messages as string (current behavior) even if errorMessagesType is "array"', async () => {
        const customErrorPropsArray = {
          hasErrors: 'error', // Using default name for boolean for simplicity here
          errorMessages: 'errorMessages', // Default name for messages
          errorMessagesType: 'array',
        };

        const wrapper = mount(PreskoForm, {
          props: {
            fields: [{ propertyName: 'field1', component: 'StubAppInput', rules: ['required'] }],
            modelValue: { field1: '' }, // Invalid state
            submitComponent: 'StubAppSubmit',
            errorProps: customErrorPropsArray, // type: 'array'
          },
          global: {
            components: { StubAppInput, StubAppSubmit },
          },
        });

        await wrapper.find('form').trigger('submit.prevent');
        await nextTick();

        const input = wrapper.findComponent(StubAppInput);
        // Even if type is 'array', useFormValidation currently sends string. StubAppInput handles string or array.
        expect(typeof input.props('errorMessages')).toBe('string');
        expect(input.props('errorMessages')).toBe('Field field1 is required.');
      });
    });
  });

  describe('Slots Functionality', () => {
    it('renders content in the "title" slot, overriding the title prop', () => {
      const titleProp = 'Title Prop';
      const slotTitleText = 'Custom Title via Slot';
      const wrapper = mount(PreskoForm, {
        props: {
          fields: [], modelValue: {},
          title: titleProp,
          submitComponent: 'StubAppSubmit',
        },
        slots: {
          title: `<h1 class="slotted-title">${slotTitleText}</h1>`,
        },
        global: { components: { StubAppInput, StubAppSubmit } },
      });

      expect(wrapper.find('.slotted-title').exists()).toBe(true);
      expect(wrapper.find('.slotted-title').text()).toBe(slotTitleText);
      // Default title rendering should not be present if slot is used
      expect(wrapper.text()).not.toContain(titleProp); // Assuming default title render includes the text directly
    });

    it('renders content in the "submit-row" slot, replacing default submit button rendering', () => {
      const slotSubmitRowText = 'Custom Submit Row Content';
      const wrapper = mount(PreskoForm, {
        props: {
          fields: [], modelValue: {},
          submitComponent: 'StubAppSubmit', // This would normally be rendered
        },
        slots: {
          'submit-row': `<div class="custom-submit-area">${slotSubmitRowText} <button type="submit" class="slotted-submit-btn">Slotted Submit</button></div>`,
        },
        global: { components: { StubAppInput, StubAppSubmit } },
      });

      expect(wrapper.find('.custom-submit-area').exists()).toBe(true);
      expect(wrapper.find('.custom-submit-area').text()).toContain(slotSubmitRowText);
      expect(wrapper.find('.slotted-submit-btn').exists()).toBe(true);
      // Default submit component should not be rendered if slot is used
      expect(wrapper.findComponent(StubAppSubmit).exists()).toBe(false);
    });

    it('renders content in the default slot at the end of the form', () => {
      const defaultSlotText = 'This is default slot content.';
      const wrapper = mount(PreskoForm, {
        props: {
          fields: [{ propertyName: 'name', component: 'StubAppInput' }],
          modelValue: { name: 'test' },
          submitComponent: 'StubAppSubmit',
        },
        slots: {
          default: `<p class="default-slot-content">${defaultSlotText}</p>`,
        },
        global: { components: { StubAppInput, StubAppSubmit } },
      });

      const defaultSlotElement = wrapper.find('.default-slot-content');
      expect(defaultSlotElement.exists()).toBe(true);
      expect(defaultSlotElement.text()).toBe(defaultSlotText);

      // Ensure it's rendered after fields and submit component (if submit-row slot is not used)
      const form = wrapper.find('form');
      const formChildren = form.element.children;
      // This assertion is a bit brittle as it depends on internal structure.
      // A more robust way might be to check order relative to known elements.
      // For now, checking existence is the primary goal.
      // Example: expect form's last child to be the default slot content, if no other slots are at the very end.
      // The default slot appears *inside* the form tag, after fields and submit row.
      expect(formChildren[formChildren.length - 1].classList.contains('default-slot-content')).toBe(true);
    });
  });
});
