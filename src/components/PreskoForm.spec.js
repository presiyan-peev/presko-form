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
        submitComponent: 'SubmitStub',
        errorProps: { hasErrors: "error", errorMessages: "errorMessages", errorMessagesType: "string" },
        fieldStateProps: { isTouched: 'touched', isDirty: 'dirty' },
      },
      global: {
        components: { SubmitStub, InputStub },
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

      expect(wrapper.findAllComponents(InputStub).length).toBe(2);
      expect(wrapper.text()).not.toContain('DF1');
      expect(wrapper.text()).toContain('DF2'); // This will fail if only submit button is rendered
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
      expect(wrapper.findAllComponents(InputStub).length).toBe(2);
      expect(wrapper.text()).toContain('DF1'); // This will fail if only submit button is rendered
    });
  });

  describe('2. Dynamic Field Rendering (Show/Hide)', () => {
    it('should show a hidden field when its condition becomes true', async () => {
      wrapper = mountForm(defaultFieldsConfig);
      let allInputs = wrapper.findAllComponents(PreskoFormItem); // Look for PreskoFormItem
      expect(allInputs.filter(c => c.props().field.label === 'Dependent Field 1').length).toBe(0);

      const controlFieldWrapper = wrapper.findAllComponents(PreskoFormItem).find(w => w.props().field.propertyName === 'controlField');
      const controlInput = controlFieldWrapper.findComponent(InputStub);
      await controlInput.vm.$emit('update:modelValue', 'show');
      await nextTick();
      await nextTick();

      allInputs = wrapper.findAllComponents(PreskoFormItem);
      expect(allInputs.filter(c => c.props().field.label === 'Dependent Field 1').length).toBe(1);
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
      expect(wrapper.findAllComponents(PreskoFormItem).filter(c => c.props().field.label === 'Dependent').length).toBe(1);

      const controlFieldWrapper = wrapper.findAllComponents(PreskoFormItem).find(w => w.props().field.propertyName === 'control');
      const controlInput = controlFieldWrapper.findComponent(InputStub);
      await controlInput.vm.$emit('update:modelValue', 'hide');
      await nextTick();
      await nextTick();

      expect(wrapper.findAllComponents(PreskoFormItem).filter(c => c.props().field.label === 'Dependent').length).toBe(0);
    });
  });

  describe('3. Interaction with Form Submission', () => {
    it('submitted data should reflect visible fields, respecting clearValueOnHide', async () => {
      wrapper = mountForm(defaultFieldsConfig);

      let model = {
        ...wrapper.props().modelValue,
        dependentField1: "I exist",
        dependentField2: "I also exist"
      };
      await wrapper.setProps({ modelValue: model });
      await nextTick();

      await wrapper.find('form').trigger('submit');
      // Check if submit event was emitted. If form is invalid, it might not be.
      // PreskoForm only emits 'submit' if validateFormPurely(modelValue.value) is true.
      // We need to ensure the form is valid for this test part or adjust expectations.
      // For this test, let's assume it might be invalid due to other fields.
      // The core check is what data *would* be submitted.
      // So, we'll directly check the modelValue which reflects the data.
      // If clearValueOnHide works, the modelValue itself should be changed.

      // Initial state of model for submission (df1, df2 are hidden but retain values if clearValueOnHide is false)
      let currentModelForSubmit = wrapper.props().modelValue;
      expect(currentModelForSubmit.dependentField1).toBe("I exist");
      expect(currentModelForSubmit.dependentField2).toBe("I also exist");

      // Make df1 visible, df2 hidden (controlField='show', anotherControl='no')
      model = { ...wrapper.props().modelValue, controlField: 'show', anotherControl: 'no', dependentField1: "DF1 Visible" };
      await wrapper.setProps({ modelValue: model });
      await nextTick(); await nextTick();

      // To test clearValueOnHide for df2, it must first be visible, then hidden.
      // Make df2 visible
      model = { ...wrapper.props().modelValue, controlField: 'show', anotherControl: 'yes', dependentField2: "DF2 Visible" };
      await wrapper.setProps({ modelValue: model });
      await nextTick(); await nextTick();
      expect(wrapper.props().modelValue.dependentField2).toBe("DF2 Visible");

      // Now, hide df2 by changing 'anotherControl', which should trigger clearValueOnHide
      model = { ...wrapper.props().modelValue, anotherControl: 'no_again' };
      await wrapper.setProps({ modelValue: model });
      await nextTick(); await nextTick();
      await nextTick();

      // Assert the model itself has changed due to clearValueOnHide
      expect(wrapper.props().modelValue.dependentField1).toBe("DF1 Visible"); // Should still be there
      expect(wrapper.props().modelValue.dependentField2).toBeUndefined(); // Cleared because clearValueOnHide is true for dependentField2
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

      let emailFieldItem = wrapper.findAllComponents(PreskoFormItem).find(w => w.props().field.propertyName === 'email');
      expect(emailFieldItem).toBeUndefined(); // Initially hidden

      await wrapper.setProps({ modelValue: { ...wrapper.props().modelValue, control: 'show', email: '' } });
      await nextTick(); await nextTick();

      emailFieldItem = wrapper.findAllComponents(PreskoFormItem).find(w => w.props().field.propertyName === 'email');
      expect(emailFieldItem).toBeDefined();
      expect(emailFieldItem.find('.presko-error-message').exists()).toBe(false); // Not yet validated / blurred

      await wrapper.find('form').trigger('submit');
      await nextTick();
      emailFieldItem = wrapper.findAllComponents(PreskoFormItem).find(w => w.props().field.propertyName === 'email');
      expect(emailFieldItem.find('.presko-error-message').exists()).toBe(true);
      expect(emailFieldItem.find('.presko-error-message').text()).toContain('Email is required');

      await wrapper.setProps({ modelValue: { ...wrapper.props().modelValue, control: 'hide' } });
      await nextTick(); await nextTick();

      emailFieldItem = wrapper.findAllComponents(PreskoFormItem).find(w => w.props().field.propertyName === 'email');
      expect(emailFieldItem).toBeUndefined();
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

      const togglerWrapper = wrapper.findAllComponents(PreskoFormItem).find(w => w.props().field.propertyName === 'toggler');
      const togglerInput = togglerWrapper.findComponent(InputStub);
      await togglerInput.vm.$emit('update:modelValue', 'HIDDEN');
      await nextTick();
      await nextTick();
      await nextTick(); // For PreskoForm's model update

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

      const togglerWrapper = wrapper.findAllComponents(PreskoFormItem).find(w => w.props().field.propertyName === 'toggler');
      const togglerInput = togglerWrapper.findComponent(InputStub);
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

        expect(wrapper.text()).not.toContain('Sub Field 1');
        let subFormWrappers = wrapper.findAllComponents(PreskoForm).filter(w => w.vm !== wrapper.vm);
        expect(subFormWrappers.length).toBe(0);

        const controlWrapper = wrapper.findAllComponents(PreskoFormItem).find(w => w.props().field.propertyName === 'showSubForm');
        const controlInput = controlWrapper.findComponent(InputStub);
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

        const controlWrapper = wrapper.findAllComponents(PreskoFormItem).find(w => w.props().field.propertyName === 'showList');
        const controlInput = controlWrapper.findComponent(InputStub);
        await controlInput.vm.$emit('update:modelValue', 'yes');
        await nextTick(); await nextTick();

        expect(wrapper.text()).toContain('My List');
        expect(wrapper.text()).toContain('Item Field');
        // expect(wrapper.text()).toContain('Value 1'); // InputStub doesn't render value directly in text
    });

    it('should hide/show individual fields within a list item', async () => {
        const fields = [
            {
                propertyName: 'items',
                type: 'list',
                label: 'Items List',
                initialValue: [{ type: 'A', detailA: 'Detail A data', detailB: 'Detail B data' }],
                fields: [
                    { propertyName: 'type', component: 'InputStub', label: 'Type' },
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

        let itemFormItems = wrapper.findAllComponents(PreskoFormItem);
        expect(itemFormItems.filter(c => c.props().field.label === 'Detail A').length).toBe(1);
        expect(itemFormItems.filter(c => c.props().field.label === 'Detail B').length).toBe(0);

        const typeFieldWrapper = itemFormItems.find(w => w.props().field.label === 'Type');
        const typeInputStub = typeFieldWrapper.findComponent(InputStub);

        await typeInputStub.vm.$emit('update:modelValue', 'B');
        await nextTick(); await nextTick(); await nextTick();

        itemFormItems = wrapper.findAllComponents(PreskoFormItem);
        expect(itemFormItems.filter(c => c.props().field.label === 'Detail A').length).toBe(0);
        expect(itemFormItems.filter(c => c.props().field.label === 'Detail B').length).toBe(1);
    });
  });
});
