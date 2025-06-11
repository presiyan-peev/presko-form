import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import PreskoForm from './PreskoForm.vue';
import PreskoFormItem from './PreskoFormItem.vue'; // Will be stubbed usually
import { nextTick, defineComponent } from 'vue';

// Simple stub for any component used within PreskoFormItem slots
const InputStub = defineComponent({
  name: 'InputStub',
  props: ['modelValue', 'label', 'error', 'errorMessages', 'touched', 'dirty'],
  emits: ['update:modelValue', 'blur', 'input'],
  template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" />',
});

// Stub for the submit component
const SubmitStub = defineComponent({
    name: 'SubmitStub',
    template: '<button type="submit">Submit</button>'
});


describe('PreskoForm.vue - Conditional Fields Integration Tests', () => {
  let wrapper;

  const defaultFieldsConfig = [
    { propertyName: 'controlField', component: 'InputStub', value: 'initial' },
    {
      propertyName: 'dependentField1',
      component: 'InputStub',
      label: 'Dependent Field 1',
      condition: { rules: [{ field: 'controlField', operator: 'equals', value: 'show' }] },
    },
    {
      propertyName: 'dependentField2',
      component: 'InputStub',
      label: 'Dependent Field 2',
      condition: {
        logic: 'AND',
        rules: [
          { field: 'controlField', operator: 'equals', value: 'show' },
          { field: 'anotherControl', operator: 'equals', value: 'yes' },
        ],
      },
      clearValueOnHide: true,
    },
    { propertyName: 'anotherControl', component: 'InputStub', value: 'no' },
    { propertyName: 'alwaysVisible', component: 'InputStub', label: 'Always Visible', rules:['required'] },
  ];

  const mountForm = (fields, initialModel = {}, provideStubs = true) => {
    const globalStubs = provideStubs ? { PreskoFormItem: false, InputStub: InputStub } : {}; // PreskoFormItem is deeply integrated

    // Ensure initialModel reflects field values if not explicitly provided
    const model = { ...initialModel };
    fields.forEach(field => {
      if (field.propertyName && !model.hasOwnProperty(field.propertyName) && field.hasOwnProperty('value')) {
        model[field.propertyName] = field.value;
      }
      if (field.subForm && !model.hasOwnProperty(field.subForm)) {
        model[field.subForm] = {}; // Initialize sub-form model
        if (field.fields) {
          field.fields.forEach(sf => {
            if (sf.propertyName && sf.hasOwnProperty('value')) {
              model[field.subForm][sf.propertyName] = sf.value;
            }
          });
        }
      }
      if (field.type === 'list' && !model.hasOwnProperty(field.propertyName)) {
         model[field.propertyName] = field.initialValue || [];
      }
    });

    return mount(PreskoForm, {
      props: {
        fields: fields,
        modelValue: model,
        submitComponent: 'SubmitStub', // Using stub
         // Provide default errorProps and fieldStateProps as PreskoForm expects them
        errorProps: { hasErrors: "error", errorMessages: "errorMessages", errorMessagesType: "string" },
        fieldStateProps: { isTouched: 'touched', isDirty: 'dirty' },
      },
      global: {
        components: { SubmitStub, InputStub }, // Register stubs globally for this mount
        // stubs: globalStubs // stubs for child components if needed
      },
    });
  };

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
    vi.clearAllMocks();
  });

  describe('1. Initial Field Rendering', () => {
    it('should show/hide fields based on initial model values', () => {
      const fields = [
        { propertyName: 'control', component: 'InputStub', value: 'hide_df1' },
        {
          propertyName: 'df1', component: 'InputStub', label: 'DF1',
          condition: { rules: [{ field: 'control', operator: 'equals', value: 'show_df1' }] }
        },
        { propertyName: 'df2', component: 'InputStub', label: 'DF2' } // Always visible
      ];
      wrapper = mountForm(fields);

      // df1 depends on 'control' which is 'hide_df1', so condition 'show_df1' is false
      expect(wrapper.findAllComponents(InputStub).length).toBe(2); // control, df2
      expect(wrapper.text()).not.toContain('DF1');
      expect(wrapper.text()).toContain('DF2');
    });

    it('should show field if initial condition is met', () => {
      const fields = [
        { propertyName: 'control', component: 'InputStub', value: 'show_df1' },
        {
          propertyName: 'df1', component: 'InputStub', label: 'DF1',
          condition: { rules: [{ field: 'control', operator: 'equals', value: 'show_df1' }] }
        }
      ];
      wrapper = mountForm(fields);
      expect(wrapper.findAllComponents(InputStub).length).toBe(2); // control, df1
      expect(wrapper.text()).toContain('DF1');
    });
  });

  describe('2. Dynamic Field Rendering (Show/Hide)', () => {
    it('should show a hidden field when its condition becomes true', async () => {
      wrapper = mountForm(defaultFieldsConfig);
      // dependentField1 is initially hidden (controlField='initial', condition needs 'show')
      let allInputs = wrapper.findAllComponents(InputStub);
      expect(allInputs.filter(c => c.props().label === 'Dependent Field 1').length).toBe(0);

      // Find the controlField input (assuming propertyName can be used to identify it)
      const controlInput = allInputs.filter(c => c.props().label === undefined && wrapper.props().modelValue.controlField !== undefined)[0];
      await controlInput.vm.$emit('update:modelValue', 'show'); // Simulate input leading to model update
      await nextTick(); // Allow PreskoForm's model watcher to update
      await nextTick(); // Allow useFormValidation's watcher to update visibility

      allInputs = wrapper.findAllComponents(InputStub);
      expect(allInputs.filter(c => c.props().label === 'Dependent Field 1').length).toBe(1);
    });

    it('should hide a visible field when its condition becomes false', async () => {
      const fields = [
        { propertyName: 'control', component: 'InputStub', value: 'show' },
        {
          propertyName: 'dependent', component: 'InputStub', label: 'Dependent',
          condition: { rules: [{ field: 'control', operator: 'equals', value: 'show' }] }
        }
      ];
      wrapper = mountForm(fields);
      expect(wrapper.findAllComponents(InputStub).filter(c => c.props().label === 'Dependent').length).toBe(1);

      const controlInput = wrapper.findAllComponents(InputStub)[0];
      await controlInput.vm.$emit('update:modelValue', 'hide');
      await nextTick();
      await nextTick();

      expect(wrapper.findAllComponents(InputStub).filter(c => c.props().label === 'Dependent').length).toBe(0);
    });
  });

  describe('3. Interaction with Form Submission', () => {
    it('submitted data should reflect visible fields, respecting clearValueOnHide', async () => {
      // dependentField1 (clearValueOnHide=false by default)
      // dependentField2 (clearValueOnHide=true)
      wrapper = mountForm(defaultFieldsConfig);
      const submitSpy = vi.fn();
      wrapper.vm.$on('submit', submitSpy);

      // Initial: controlField='initial', anotherControl='no'
      // df1 hidden, df2 hidden
      wrapper.props().modelValue.dependentField1 = "I exist"; // Set value while potentially hidden
      wrapper.props().modelValue.dependentField2 = "I also exist";

      await wrapper.find('form').trigger('submit');
      expect(submitSpy).toHaveBeenCalledTimes(1);
      let submittedData = submitSpy.mock.calls[0][0];
      expect(submittedData.dependentField1).toBe("I exist"); // Retained because clearValueOnHide is false
      expect(submittedData.dependentField2).toBe("I also exist"); // Retained for same reason (value was set before hiding)

      // Make df1 visible, df2 hidden (controlField='show', anotherControl='no')
      await wrapper.setProps({ modelValue: { ...wrapper.props().modelValue, controlField: 'show', anotherControl: 'no' } });
      await nextTick(); await nextTick();

      wrapper.props().modelValue.dependentField1 = "DF1 Visible";
      // df2 is still hidden, its value should be cleared on hide if it was visible then hidden.
      // Let's ensure it was visible then hidden to test clearValueOnHide properly.
      // First, make df2 visible
      await wrapper.setProps({ modelValue: { ...wrapper.props().modelValue, controlField: 'show', anotherControl: 'yes' } });
      await nextTick(); await nextTick();
      wrapper.props().modelValue.dependentField2 = "DF2 Visible";

      // Now, hide df2 by changing 'anotherControl'
      await wrapper.setProps({ modelValue: { ...wrapper.props().modelValue, anotherControl: 'no_again' } });
      await nextTick(); await nextTick(); // df2 becomes hidden, value should be cleared

      await wrapper.find('form').trigger('submit');
      expect(submitSpy).toHaveBeenCalledTimes(2);
      submittedData = submitSpy.mock.calls[1][0];
      expect(submittedData.dependentField1).toBe("DF1 Visible");
      expect(submittedData.dependentField2).toBeUndefined(); // Cleared because clearValueOnHide is true
    });
  });

  describe('4. Interaction with Validation UI', () => {
    it('should show/hide validation errors based on visibility', async () => {
      const fields = [
        { propertyName: 'control', component: 'InputStub', value: 'hide' },
        {
          propertyName: 'email', component: 'InputStub', label: 'Email', rules: ['required', 'email'],
          condition: { rules: [{ field: 'control', operator: 'equals', value: 'show' }] }
        }
      ];
      wrapper = mountForm(fields);

      // Initially, email field is hidden, no error message
      expect(wrapper.find('.presko-error-message').exists()).toBe(false);

      // Make email field visible
      await wrapper.setProps({ modelValue: { ...wrapper.props().modelValue, control: 'show', email: '' } });
      await nextTick(); await nextTick();

      // Trigger validation (e.g., by form submit or blur)
      await wrapper.find('form').trigger('submit'); // This triggers validateFormPurely
      await nextTick();
      expect(wrapper.find('.presko-error-message').exists()).toBe(true);
      expect(wrapper.find('.presko-error-message').text()).toContain('Email is required');

      // Hide email field again
      await wrapper.setProps({ modelValue: { ...wrapper.props().modelValue, control: 'hide' } });
      await nextTick(); await nextTick();

      // Error message should disappear because the field is no longer rendered / validated
      // We need to check if the PreskoFormItem for 'email' is not rendered
      const emailFieldItem = wrapper.findAllComponents(PreskoFormItem).find(w => w.props().field.propertyName === 'email');
      expect(emailFieldItem).toBeUndefined(); // The item itself should be gone
    });
  });


  describe('5. clearValueOnHide UI Behavior', () => {
    it('should clear model value when clearValueOnHide is true', async () => {
      const fields = [
        { propertyName: 'toggler', component: 'InputStub', value: 'VISIBLE' },
        {
          propertyName: 'target', component: 'InputStub', label: 'Target',
          condition: { rules: [{ field: 'toggler', operator: 'equals', value: 'VISIBLE'}] },
          clearValueOnHide: true
        }
      ];
      const initialModel = { toggler: 'VISIBLE', target: 'Hello There' };
      wrapper = mountForm(fields, initialModel);

      expect(wrapper.props().modelValue.target).toBe('Hello There');

      // Find toggler input and change its value to hide 'target'
      const togglerInput = wrapper.findAllComponents(InputStub)[0];
      await togglerInput.vm.$emit('update:modelValue', 'HIDDEN');
      await nextTick(); // model update in PreskoForm
      await nextTick(); // useFormValidation watcher
      await nextTick(); // DOM update (if any)

      expect(wrapper.props().modelValue.target).toBeUndefined();
    });

    it('should retain model value when clearValueOnHide is false', async () => {
      const fields = [
        { propertyName: 'toggler', component: 'InputStub', value: 'VISIBLE' },
        {
          propertyName: 'target', component: 'InputStub', label: 'Target',
          condition: { rules: [{ field: 'toggler', operator: 'equals', value: 'VISIBLE'}] },
          clearValueOnHide: false
        }
      ];
      const initialModel = { toggler: 'VISIBLE', target: 'Hello There' };
      wrapper = mountForm(fields, initialModel);
      expect(wrapper.props().modelValue.target).toBe('Hello There');

      const togglerInput = wrapper.findAllComponents(InputStub)[0];
      await togglerInput.vm.$emit('update:modelValue', 'HIDDEN');
      await nextTick(); await nextTick(); await nextTick();

      expect(wrapper.props().modelValue.target).toBe('Hello There');
    });
  });

  describe('6. Complex Scenarios (UI perspective)', () => {
    it('should hide/show entire sub-form based on condition', async () => {
        const fields = [
            { propertyName: 'showSubForm', component: 'InputStub', value: 'no' },
            {
                subForm: 'mySubForm',
                condition: { rules: [{ field: 'showSubForm', operator: 'equals', value: 'yes' }] },
                fields: [
                    { propertyName: 'subField1', component: 'InputStub', label: 'Sub Field 1' }
                ]
            }
        ];
        wrapper = mountForm(fields);

        // Initially sub-form should be hidden
        expect(wrapper.text()).not.toContain('Sub Field 1');
        // Check if the nested PreskoForm instance for 'mySubForm' exists
        let subFormWrappers = wrapper.findAllComponents(PreskoForm).filter(w => w.vm !== wrapper.vm); // Exclude self
        expect(subFormWrappers.length).toBe(0);


        // Change 'showSubForm' to 'yes'
        const controlInput = wrapper.findAllComponents(InputStub)[0]; // Assuming it's the first one
        await controlInput.vm.$emit('update:modelValue', 'yes');
        await nextTick(); await nextTick();

        expect(wrapper.text()).toContain('Sub Field 1');
        subFormWrappers = wrapper.findAllComponents(PreskoForm).filter(w => w.vm !== wrapper.vm);
        expect(subFormWrappers.length).toBe(1);
    });

    it('should hide/show entire list field based on condition', async () => {
        const fields = [
            { propertyName: 'showList', component: 'InputStub', value: 'no' },
            {
                propertyName: 'myList',
                type: 'list',
                label: 'My List',
                itemLabel: 'Item',
                condition: { rules: [{ field: 'showList', operator: 'equals', value: 'yes' }] },
                initialValue: [{ itemField: 'Value 1' }],
                fields: [{ propertyName: 'itemField', component: 'InputStub', label: 'Item Field' }]
            }
        ];
        wrapper = mountForm(fields);

        expect(wrapper.text()).not.toContain('My List');
        expect(wrapper.text()).not.toContain('Item Field');

        const controlInput = wrapper.findAllComponents(InputStub)[0];
        await controlInput.vm.$emit('update:modelValue', 'yes');
        await nextTick(); await nextTick();

        expect(wrapper.text()).toContain('My List');
        expect(wrapper.text()).toContain('Item Field');
        expect(wrapper.text()).toContain('Value 1'); // Check for item value
    });

    it('should hide/show individual fields within a list item', async () => {
        const fields = [
            {
                propertyName: 'items',
                type: 'list',
                label: 'Items List',
                initialValue: [{ type: 'A', detailA: 'Detail A data', detailB: 'Detail B data' }],
                fields: [
                    { propertyName: 'type', component: 'InputStub', label: 'Type' }, // e.g., 'A' or 'B'
                    {
                        propertyName: 'detailA', component: 'InputStub', label: 'Detail A',
                        condition: { rules: [{ field: 'items[0].type', operator: 'equals', value: 'A' }] }
                    },
                    {
                        propertyName: 'detailB', component: 'InputStub', label: 'Detail B',
                        condition: { rules: [{ field: 'items[0].type', operator: 'equals', value: 'B' }] }
                    }
                ]
            }
        ];
        wrapper = mountForm(fields);

        // Initial: type is 'A', so detailA is visible, detailB is hidden
        expect(wrapper.text()).toContain('Detail A');
        expect(wrapper.text()).not.toContain('Detail B');
        let itemInputs = wrapper.findAllComponents(PreskoFormItem);
        expect(itemInputs.filter(c => c.props().field.label === 'Detail A').length).toBe(1);
        expect(itemInputs.filter(c => c.props().field.label === 'Detail B').length).toBe(0);

        // Find the 'type' input for the first item
        // This is tricky as PreskoFormItem wraps the actual InputStub. We need to find the InputStub for 'type'.
        const typeInputStub = wrapper.findAllComponents(InputStub).find(c => c.props().label === 'Type');

        await typeInputStub.vm.$emit('update:modelValue', 'B');
        await nextTick(); await nextTick(); await nextTick();

        // Now detailA should be hidden, detailB visible
        expect(wrapper.text()).not.toContain('Detail A');
        expect(wrapper.text()).toContain('Detail B');
        itemInputs = wrapper.findAllComponents(PreskoFormItem);
        expect(itemInputs.filter(c => c.props().field.label === 'Detail A').length).toBe(0);
        expect(itemInputs.filter(c => c.props().field.label === 'Detail B').length).toBe(1);
    });
  });
});
