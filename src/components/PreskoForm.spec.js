import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import PreskoForm from './PreskoForm.vue';
import StubAppInput from '../__tests__/stubs/StubAppInput.vue';
import StubAppSubmit from '../__tests__/stubs/StubAppSubmit.vue';
import { nextTick, defineComponent, h } from 'vue';

// Helper to create a basic PreskoForm wrapper
const createFormWrapper = (props = {}, options = {}) => {
  return mount(PreskoForm, {
    props: {
      fields: [],
      modelValue: {},
      submitComponent: 'StubAppSubmit',
      ...props,
    },
    global: {
      components: {
        StubAppInput,
        StubAppSubmit,
        PreskoForm,
      },
      ...options.global,
    },
    ...options,
  });
};

describe('PreskoForm.vue', () => {
  describe('Basic Rendering', () => {
    // Applying .only for the diagnostic as per instruction for Part 1
    it.only('renders specified components for fields', async () => {
      const initialFields = [];
      const initialModelValue = {};

      const wrapper = createFormWrapper({
        fields: initialFields,
        modelValue: initialModelValue
      });

      console.log('[Test Part 1] Mounted with empty fields and modelValue.');
      await nextTick();
      console.log('[Test Part 1] After 1st nextTick post-mount.');

      const actualFields = [
        { propertyName: 'name', component: 'StubAppInput', props: { label: 'Name' }, value: 'DefaultNameInField' },
        { propertyName: 'email', component: 'StubAppInput', props: { label: 'Email' }, value: 'default.email@example.com' },
      ];
      const actualModelValue = {};

      console.log('[Test Part 1] Setting props with actualFields and actualModelValue:', JSON.stringify(actualFields), JSON.stringify(actualModelValue));
      await wrapper.setProps({ fields: actualFields, modelValue: actualModelValue });

      console.log('[Test Part 1] After setProps.');
      await nextTick(); // Original tick
      console.log('[Test Part 1] After 1st nextTick post-setProps.');
      await nextTick(); // Added tick 1
      console.log('[Test Part 1] After 2nd nextTick post-setProps.');
      await nextTick(); // Added tick 2
      console.log('[Test Part 1] After 3rd nextTick post-setProps.');
      // await new Promise(resolve => setTimeout(resolve, 100)); // Optional alternative
      // console.log('[Test Part 1] After potential timeout.');


      const inputComponents = wrapper.findAllComponents(StubAppInput);
      console.log('[Test Part 1] Number of StubAppInput components found:', inputComponents.length);

      expect(inputComponents.length).toBe(actualFields.length);
      if (inputComponents.length === actualFields.length) {
        console.log('[Test Part 1] Input 0 props:', inputComponents[0].props());
        expect(inputComponents[0].props('label')).toBe('Name');
        expect(inputComponents[0].props('modelValue')).toBe('DefaultNameInField');

        console.log('[Test Part 1] Input 1 props:', inputComponents[1].props());
        expect(inputComponents[1].props('label')).toBe('Email');
        expect(inputComponents[1].props('modelValue')).toBe('default.email@example.com');
      }
      // Not unmounting wrapper1 here as it's the main wrapper for this test case.
      // The second part of the original test (wrapper2) is removed for clarity of this focused test.
    });

    it('mounts successfully with minimal props', () => {
      const wrapper = createFormWrapper();
      expect(wrapper.exists()).toBe(true);
    });
    it('renders a title when title prop is provided', () => {
      const title = 'My Test Form';
      const wrapper = createFormWrapper({ title });
      expect(wrapper.text()).toContain(title);
    });
    it('renders the submit component', () => {
      const wrapper = createFormWrapper();
      expect(wrapper.findComponent(StubAppSubmit).exists()).toBe(true);
    });
  });

  describe('v-model integration', () => {
    it('updates input components when modelValue prop changes', async () => {
      const fields = [{ propertyName: 'name', component: 'StubAppInput', value: 'Initial' }];
      const initialModelValue = { name: 'Initial Name' };
      const wrapper = createFormWrapper({ fields, modelValue: initialModelValue });
      await nextTick();
      const input = wrapper.findComponent(StubAppInput);
      expect(input.props('modelValue')).toBe('Initial Name');
      const newName = 'Updated Name';
      await wrapper.setProps({ modelValue: { ...initialModelValue, name: newName } });
      await nextTick();
      expect(input.props('modelValue')).toBe(newName);
    });

    it('emits "update:modelValue" with the correct data when an input changes', async () => {
      const fields = [
        { propertyName: 'name', component: 'StubAppInput' },
        { propertyName: 'email', component: 'StubAppInput', value: 'test@example.com' },
      ];
      const initialModelValue = { };
      const wrapper = createFormWrapper({ fields, modelValue: initialModelValue });
      await nextTick(); await nextTick();
      const nameInputComponent = wrapper.findAllComponents(StubAppInput)[0];
      const newName = 'Jane';
      nameInputComponent.vm.$emit('update:modelValue', newName);
      await nextTick();
      const emittedUpdateEvents = wrapper.emitted('update:modelValue');
      expect(emittedUpdateEvents).toBeTruthy();
      expect(emittedUpdateEvents.length).toBeGreaterThanOrEqual(1);
      const expectedEmittedData = { name: newName, email: 'test@example.com' };
      expect(emittedUpdateEvents[emittedUpdateEvents.length - 1][0]).toEqual(expectedEmittedData);
    });

    it('correctly initializes modelValue from field default values if not in prop modelValue', async () => {
        const fields = [
            { propertyName: 'name', component: 'StubAppInput', value: 'Default Name' },
            { propertyName: 'email', component: 'StubAppInput', value: 'default@example.com' }
        ];
        const initialModelValue = { name: 'Override Name' };
        const wrapper = createFormWrapper({ fields, modelValue: initialModelValue });
        await nextTick(); await nextTick();
        const nameInput = wrapper.findAllComponents(StubAppInput)[0];
        const emailInput = wrapper.findAllComponents(StubAppInput)[1];
        expect(nameInput.props('modelValue')).toBe('Override Name');
        expect(emailInput.props('modelValue')).toBe('default@example.com');
    });
  });

  describe('Validation and Submission Flow', () => {
    let wrapper;
    const fields = [
      { propertyName: 'name', component: 'StubAppInput', rules: ['required'], props: { label: 'Name' } },
      { propertyName: 'email', component: 'StubAppInput', rules: ['required', 'email'], props: { label: 'Email' } },
    ];
    beforeEach(async () => {
      wrapper = createFormWrapper({ fields, modelValue: { name: '', email: '' } });
      await nextTick(); await nextTick();
    });

    it('emits "submit:reject" and displays errors when form is submitted with invalid data', async () => {
      const nameInput = wrapper.findAllComponents(StubAppInput)[0];
      const emailInput = wrapper.findAllComponents(StubAppInput)[1];
      await wrapper.find('form').trigger('submit.prevent');
      await nextTick();
      expect(wrapper.emitted('submit:reject')).toBeTruthy();
      expect(wrapper.emitted('submit')).toBeUndefined();
      expect(nameInput.props('error')).toBe(true);
      expect(nameInput.props('errorMessages')).toBe('Field Name is required.');
      expect(emailInput.props('error')).toBe(true);
      expect(emailInput.props('errorMessages')).toBe('Field Email is required.');
    });

    it('emits "submit" with form data when form is valid and submitted', async () => {
      const nameInput = wrapper.findAllComponents(StubAppInput)[0];
      const emailInput = wrapper.findAllComponents(StubAppInput)[1];
      nameInput.vm.$emit('update:modelValue', 'John Doe');
      await nextTick();
      emailInput.vm.$emit('update:modelValue', 'john.doe@example.com');
      await nextTick();
      await wrapper.setProps({ modelValue: { name: 'John Doe', email: 'john.doe@example.com' } });
      await nextTick();
      await wrapper.find('form').trigger('submit.prevent');
      await nextTick();
      expect(wrapper.emitted('submit')).toBeTruthy();
      expect(wrapper.emitted('submit')[0][0]).toEqual({ name: 'John Doe', email: 'john.doe@example.com' });
      expect(wrapper.emitted('submit:reject')).toBeUndefined();
      expect(nameInput.props('error')).toBe(false);
      expect(emailInput.props('error')).toBe(false);
    });

    it('clears errors when an invalid field becomes valid and form is re-validated (e.g. on next submit attempt)', async () => {
      await wrapper.find('form').trigger('submit.prevent');
      await nextTick();
      const nameInput = wrapper.findAllComponents(StubAppInput)[0];
      expect(nameInput.props('error')).toBe(true);
      nameInput.vm.$emit('update:modelValue', 'Valid Name');
      await nextTick();
      await wrapper.setProps({ modelValue: { name: 'Valid Name', email: '' } });
      await nextTick();
      await wrapper.find('form').trigger('submit.prevent');
      await nextTick();
      expect(nameInput.props('error')).toBe(false);
      expect(nameInput.props('errorMessages')).toBeUndefined();
      const emailInput = wrapper.findAllComponents(StubAppInput)[1];
      expect(emailInput.props('error')).toBe(true);
      expect(emailInput.props('errorMessages')).toBe('Field Email is required.');
    });

    it('handles custom error messages from validation rules', async () => {
        const fieldsWithCustomError = [ { propertyName: 'username', component: 'StubAppInput', rules: [{ name: 'required', customErrorMsg: 'Username must be provided.' }], props: { label: 'Username' }, value: '' } ];
        const customWrapper = createFormWrapper({ fields: fieldsWithCustomError, modelValue: { username: '' } });
        await nextTick(); await nextTick();
        await customWrapper.find('form').trigger('submit.prevent');
        await nextTick();
        const input = customWrapper.findComponent(StubAppInput);
        expect(input.props('error')).toBe(true);
        expect(input.props('errorMessages')).toBe('Username must be provided.');
        expect(customWrapper.emitted('submit:reject')).toBeTruthy();
    });
  });

  describe('Sub-form Functionality', () => {
    let subFormWrapper;
    const subFormFields = [
      { propertyName: 'street', component: 'StubAppInput', rules: ['required'], props: { label: 'Street' }, value: 'DefStreet' },
      { propertyName: 'city', component: 'StubAppInput', rules: ['required'], props: { label: 'City' }, value: 'DefCity' },
    ];
    const mainFieldsConfig = [
      { propertyName: 'fullName', component: 'StubAppInput', rules: ['required'], props: { label: 'Full Name' }, value: 'DefName' },
      { subForm: 'address', fields: subFormFields },
    ];
    const mountWithSubForm = async (modelValue = {}) => {
      const completeModelValue = { fullName: modelValue.fullName, address: typeof modelValue.address === 'object' ? modelValue.address : {}, ...modelValue };
      const wrapper = createFormWrapper({ fields: mainFieldsConfig, modelValue: completeModelValue });
      await nextTick(); await nextTick();
      return wrapper;
    };

    it('renders nested PreskoForm components for sub-form configurations', async () => {
      subFormWrapper = await mountWithSubForm();
      const allForms = subFormWrapper.findAllComponents(PreskoForm);
      expect(allForms.length).toBe(2);
      const nestedForm = allForms[1];
      expect(nestedForm.props('fields')).toEqual(subFormFields);
      const stubInputs = nestedForm.findAllComponents(StubAppInput);
      expect(stubInputs.length).toBe(2);
      expect(stubInputs[0].props('modelValue')).toBe('DefStreet');
      expect(stubInputs[1].props('modelValue')).toBe('DefCity');
    });

    it('binds v-model correctly for sub-forms (nested data structure)', async () => {
      subFormWrapper = await mountWithSubForm({ fullName: 'Parent Name', address: { street: '123 Main St', city: 'Anytown' } });
      const nestedForm = subFormWrapper.findAllComponents(PreskoForm)[1];
      const streetInput = nestedForm.findAllComponents(StubAppInput).find(c => c.props('label') === 'Street');
      await streetInput.vm.$emit('update:modelValue', '456 New Ave');
      await nextTick();
      const emittedUpdate = subFormWrapper.emitted('update:modelValue');
      expect(emittedUpdate).toBeTruthy();
      expect(emittedUpdate[emittedUpdate.length - 1][0]).toEqual({ fullName: 'Parent Name', address: { street: '456 New Ave', city: 'Anytown' } });
    });

    it('propagates modelValue changes from parent to sub-form inputs', async () => {
      subFormWrapper = await mountWithSubForm();
      await nextTick();
      await subFormWrapper.setProps({ modelValue: { fullName: 'Changed Name', address: { street: 'Updated Street', city: 'Updated City' } } });
      await nextTick();
      const nameInput = subFormWrapper.findAllComponents(StubAppInput).find(c => c.props('label') === 'Full Name');
      const nestedForm = subFormWrapper.findAllComponents(PreskoForm)[1];
      const streetInput = nestedForm.findAllComponents(StubAppInput).find(c => c.props('label') === 'Street');
      const cityInput = nestedForm.findAllComponents(StubAppInput).find(c => c.props('label') === 'City');
      expect(nameInput.props('modelValue')).toBe('Changed Name');
      expect(streetInput.props('modelValue')).toBe('Updated Street');
      expect(cityInput.props('modelValue')).toBe('Updated City');
    });

    it('validates sub-forms and rejects submission if sub-form is invalid', async () => {
      subFormWrapper = await mountWithSubForm({ fullName: 'Valid Name', address: { street: '', city: 'Anytown' } });
      await nextTick();
      await subFormWrapper.find('form').trigger('submit.prevent');
      await nextTick();
      expect(subFormWrapper.emitted('submit:reject')).toBeTruthy();
      const nestedForm = subFormWrapper.findAllComponents(PreskoForm)[1];
      const streetInputInSubForm = nestedForm.findAllComponents(StubAppInput).find(c => c.props('label') === 'Street');
      expect(streetInputInSubForm.props('error')).toBe(true);
      expect(streetInputInSubForm.props('errorMessages')).toBe('Field Street is required.');
    });

    it('emits submit with nested data when main and sub-forms are valid', async () => {
      subFormWrapper = await mountWithSubForm({ fullName: 'Another Valid Name', address: { street: '789 Good St', city: 'Validville' } });
      await nextTick();
      await subFormWrapper.setProps({ modelValue: { fullName: 'Another Valid Name', address: { street: '789 Good St', city: 'Validville' } } });
      await nextTick();
      await subFormWrapper.find('form').trigger('submit.prevent');
      await nextTick();
      expect(subFormWrapper.emitted('submit')).toBeTruthy();
      expect(subFormWrapper.emitted('submit')[0][0]).toEqual({ fullName: 'Another Valid Name', address: { street: '789 Good St', city: 'Validville' } });
    });
  });

  describe('Props Functionality', () => {
    it('uses the specified `submitComponent`', async () => {
      const DistinctSubmitButton = defineComponent({ template: '<button type="submit" class="distinct-submit-button">Distinct Submit</button>', name: 'DistinctSubmitButton' });
      const wrapper = createFormWrapper({ fields: [{ propertyName: 'test', component: 'StubAppInput', value:'' }], submitComponent: 'DistinctSubmitButton' }, { global: { components: { DistinctSubmitButton } } });
      await nextTick();
      expect(wrapper.findComponent(DistinctSubmitButton).exists()).toBe(true);
    });

    it('applies `submitBtnClasses` to the submit component', async () => {
      const wrapper = createFormWrapper({ submitBtnClasses: 'extra-class-1 extra-class-2' });
      await nextTick();
      expect(wrapper.findComponent(StubAppSubmit).classes()).toContain('extra-class-1');
    });

    it('passes `submitBtnProps` to the submit component', async () => {
      const wrapper = createFormWrapper({ submitBtnProps: { text: 'Go', disabled: true } });
      await nextTick();
      const submitButton = wrapper.findComponent(StubAppSubmit);
      expect(submitButton.props('text')).toBe('Go');
      expect(submitButton.attributes('disabled')).toBeDefined();
    });

    describe('errorProps functionality', () => {
      const CustomErrorPropInput = defineComponent({ name: 'CustomErrorPropInput', template: '<div><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /><div v-if="isInvalid && validationMsg" class="custom-error-display">{{ validationMsg }}</div></div>', props: ['modelValue', 'label', 'isInvalid', 'validationMsg'], emits: ['update:modelValue'] });
      it('passes custom error prop names to field items when `errorProps` is configured', async () => {
        const customErrorProps = { hasErrors: 'isInvalid', errorMessages: 'validationMsg', errorMessagesType: 'string' };
        const wrapper = createFormWrapper({ fields: [{ propertyName: 'field1', component: 'CustomErrorPropInput', rules: ['required'], value:'' }], modelValue: { field1: '' }, errorProps: customErrorProps }, { global: { components: { CustomErrorPropInput } } });
        await nextTick(); await nextTick();
        await wrapper.find('form').trigger('submit.prevent');
        await nextTick();
        const inputComponent = wrapper.findComponent(CustomErrorPropInput);
        expect(inputComponent.exists()).toBe(true);
        expect(inputComponent.props('isInvalid')).toBe(true);
        expect(inputComponent.props('validationMsg')).toBe('Field field1 is required.');
      });

      it('passes error messages as string even if errorMessagesType is "array"', async () => {
        const customErrorPropsArray = { hasErrors: 'error', errorMessages: 'errorMessages', errorMessagesType: 'array' };
        const wrapper = createFormWrapper({ fields: [{ propertyName: 'field1', component: 'StubAppInput', rules: ['required'], value:'' }], modelValue: { field1: '' }, errorProps: customErrorPropsArray });
        await nextTick(); await nextTick();
        await wrapper.find('form').trigger('submit.prevent');
        await nextTick();
        const input = wrapper.findComponent(StubAppInput);
        expect(typeof input.props('errorMessages')).toBe('string');
      });
    });
  });

  describe('Slots Functionality', () => {
    it('renders content in the "title" slot, overriding the title prop', async () => {
      const wrapper = createFormWrapper({ title: 'PropTitle' }, { slots: { title: `<h1 class="slotted-title">SlotTitle</h1>` } });
      await nextTick();
      expect(wrapper.find('.slotted-title').exists()).toBe(true);
      expect(wrapper.text()).not.toContain('PropTitle');
    });

    it('renders content in the "submit-row" slot, replacing default submit button', async () => {
      const wrapper = createFormWrapper({}, { slots: { 'submit-row': `<div class="custom-submit-area"><button>SlotSubmit</button></div>` } });
      await nextTick();
      expect(wrapper.find('.custom-submit-area').exists()).toBe(true);
      expect(wrapper.findComponent(StubAppSubmit).exists()).toBe(false);
    });

    it('renders content in the default slot at the end of the form', async () => {
      const wrapper = createFormWrapper({ fields: [{ propertyName: 'name', component: 'StubAppInput', value: 'test' }] }, { slots: { default: `<p class="default-slot-content">DefaultSlot</p>` } });
      await nextTick(); await nextTick();
      expect(wrapper.find('.default-slot-content').exists()).toBe(true);
    });
  });

  describe('Field and Form Interaction States (Touched/Dirty)', () => {
    let wrapper;
    const testFields = [
      { propertyName: 'name', component: 'StubAppInput', props: { label: 'Name' }, value: 'InitialName' },
      { propertyName: 'email', component: 'StubAppInput', props: { label: 'Email' }, value: '' },
    ];
    const initialModel = { name: 'InitialName', email: '' };

    beforeEach(async () => {
      wrapper = createFormWrapper({
        fields: testFields,
        modelValue: JSON.parse(JSON.stringify(initialModel)),
        submitComponent: 'StubAppSubmit',
      });
      await nextTick();
      await nextTick();
    });

    it('marks field as touched on blur and emits @field:touched', async () => {
      const nameInputWrapper = wrapper.findAllComponents(StubAppInput).find(c => c.props('label') === 'Name');
      expect(nameInputWrapper.props('touched')).toBe(false);

      await nameInputWrapper.vm.$emit('blur');
      await nextTick();

      expect(nameInputWrapper.props('touched')).toBe(true);
      const touchedEvents = wrapper.emitted('field:touched');
      expect(touchedEvents).toBeTruthy();
      expect(touchedEvents[0][0]).toEqual({ propertyName: 'name', touched: true });
    });

    it('updates isFormTouched computed property', async () => {
      expect(wrapper.vm.isFormTouched).toBe(false);
      const nameInputWrapper = wrapper.findAllComponents(StubAppInput).find(c => c.props('label') === 'Name');
      await nameInputWrapper.vm.$emit('blur');
      await nextTick();
      await nextTick();
      expect(wrapper.vm.isFormTouched).toBe(true);
    });

    it('marks field as dirty on value change and emits @field:dirty', async () => {
      const nameInputWrapper = wrapper.findAllComponents(StubAppInput).find(c => c.props('label') === 'Name');
      expect(nameInputWrapper.props('dirty')).toBe(false);

      nameInputWrapper.vm.$emit('update:modelValue', 'NewName');
      await nextTick();
      await wrapper.setProps({ modelValue: { ...wrapper.props('modelValue'), name: 'NewName' } });
      await nextTick();

      expect(nameInputWrapper.props('dirty')).toBe(true);
      const dirtyEvents = wrapper.emitted('field:dirty');
      expect(dirtyEvents).toBeTruthy();
      expect(dirtyEvents[dirtyEvents.length - 1][0]).toEqual({ propertyName: 'name', dirty: true });
    });

    it('marks field as not dirty if value reverts to initial and emits @field:dirty', async () => {
      const nameInputWrapper = wrapper.findAllComponents(StubAppInput).find(c => c.props('label') === 'Name');

      nameInputWrapper.vm.$emit('update:modelValue', 'NewName');
      await wrapper.setProps({ modelValue: { ...wrapper.props('modelValue'), name: 'NewName' } });
      await nextTick();
      expect(nameInputWrapper.props('dirty')).toBe(true);
      let initialDirtyEventsCount = wrapper.emitted('field:dirty')?.length || 0;

      nameInputWrapper.vm.$emit('update:modelValue', 'InitialName');
      await wrapper.setProps({ modelValue: { ...wrapper.props('modelValue'), name: 'InitialName' } });
      await nextTick();

      expect(nameInputWrapper.props('dirty')).toBe(false);
      const dirtyEvents = wrapper.emitted('field:dirty');
      expect(dirtyEvents).toBeTruthy();
      expect(dirtyEvents.length).toBeGreaterThan(initialDirtyEventsCount);
      expect(dirtyEvents[dirtyEvents.length - 1][0]).toEqual({ propertyName: 'name', dirty: false });
    });

    it('updates isFormDirty computed property', async () => {
      expect(wrapper.vm.isFormDirty).toBe(false);
      const nameInputWrapper = wrapper.findAllComponents(StubAppInput).find(c => c.props('label') === 'Name');
      nameInputWrapper.vm.$emit('update:modelValue', 'NewName');
      await wrapper.setProps({ modelValue: { ...wrapper.props('modelValue'), name: 'NewName' } });
      await nextTick();
      await nextTick();
      expect(wrapper.vm.isFormDirty).toBe(true);
    });

    it('passes custom prop names for touched/dirty via fieldStateProps', async () => {
      await wrapper.setProps({
        fieldStateProps: { isTouched: 'customTouched', isDirty: 'customDirty' }
      });
      await nextTick();

      const nameInputWrapper = wrapper.findAllComponents(StubAppInput).find(c => c.props('label') === 'Name');

      expect(nameInputWrapper.props('customTouched')).toBe(false);
      expect(nameInputWrapper.props('customDirty')).toBe(false);

      await nameInputWrapper.vm.$emit('blur');
      await nextTick();
      expect(nameInputWrapper.props('customTouched')).toBe(true);

      nameInputWrapper.vm.$emit('update:modelValue', 'NewNameForCustomProps');
      await wrapper.setProps({ modelValue: { ...wrapper.props('modelValue'), name: 'NewNameForCustomProps' } });
      await nextTick();
      expect(nameInputWrapper.props('customDirty')).toBe(true);
    });

    it('marks all fields as touched and emits events on form submit attempt', async () => {
      const nameInput = wrapper.findAllComponents(StubAppInput).find(c => c.props('label') === 'Name');
      const emailInput = wrapper.findAllComponents(StubAppInput).find(c => c.props('label') === 'Email');

      expect(nameInput.props('touched')).toBe(false);
      expect(emailInput.props('touched')).toBe(false);

      await wrapper.find('form').trigger('submit.prevent');
      await nextTick();

      expect(nameInput.props('touched')).toBe(true);
      expect(emailInput.props('touched')).toBe(true);

      const touchedEvents = wrapper.emitted('field:touched');
      expect(touchedEvents).toBeTruthy();
      expect(touchedEvents.length).toBeGreaterThanOrEqual(2);
      expect(touchedEvents).toEqual(
        expect.arrayContaining([
          [{ propertyName: 'name', touched: true }],
          [{ propertyName: 'email', touched: true }],
        ])
      );
      expect(wrapper.vm.isFormTouched).toBe(true);
    });

    it('exposes isFormDirty and isFormTouched via default scoped slot', async () => {
      const TestSlotComponent = defineComponent({
        template: `
          <div>
            <span data-testid="isFormDirtyInSlot">{{ slotProps.isFormDirty }}</span>
            <span data-testid="isFormTouchedInSlot">{{ slotProps.isFormTouched }}</span>
          </div>
        `,
        props: ['slotProps']
      });

      const slotWrapper = mount(PreskoForm, {
        props: { fields: testFields, modelValue: JSON.parse(JSON.stringify(initialModel)), submitComponent: 'StubAppSubmit' },
        global: { components: { StubAppInput, StubAppSubmit, PreskoForm } },
        slots: {
          default: (slotProps) => h(TestSlotComponent, { slotProps })
        }
      });
      await nextTick();
      await nextTick();

      expect(slotWrapper.find('[data-testid="isFormDirtyInSlot"]').text()).toBe('false');
      expect(slotWrapper.find('[data-testid="isFormTouchedInSlot"]').text()).toBe('false');

      const nameInputWrapper = slotWrapper.findAllComponents(StubAppInput).find(c => c.props('label') === 'Name');
      await nameInputWrapper.vm.$emit('blur');
      nameInputWrapper.vm.$emit('update:modelValue', 'NewName');
      await slotWrapper.setProps({ modelValue: { ...initialModel, name: 'NewName' }});
      await nextTick();
      await nextTick();

      expect(slotWrapper.find('[data-testid="isFormDirtyInSlot"]').text()).toBe('true');
      expect(slotWrapper.find('[data-testid="isFormTouchedInSlot"]').text()).toBe('true');
    });
  });
});
```
