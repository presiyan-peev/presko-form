import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, defineComponent, reactive } from 'vue';
import PreskoForm from './PreskoForm.vue';
// Assuming stubs are in src/__tests__/stubs/ as per typical project structure
// For PreskoForm.spec.js, we might not need the actual stubs from files if we define simple ones locally or use Teleport for complex children.
// However, the task implies using them, so let's assume they are simple pass-through components.
// If StubAppInput and StubAppSubmit are more complex, their behavior might affect these tests.

// Define local, simplified stubs for testing if actual file stubs are problematic or too complex
const LocalStubInput = defineComponent({
  name: 'LocalStubInput',
  props: ['modelValue', 'error', 'errorMessages', 'touched', 'dirty', 'label', /* any other props PreskoFormItem passes */],
  emits: ['update:modelValue', 'blur', 'input'], // 'input' is crucial for 'onInput' validation trigger
  template: `
    <div>
      <label>{{ label }}</label>
      <input
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value); $emit('input', $event.target.value)"
        @blur="$emit('blur')"
      />
      <div v-if="error && errorMessages" class="custom-stub-error">{{ Array.isArray(errorMessages) ? errorMessages.join(', ') : errorMessages }}</div>
    </div>
  `,
});

const LocalStubSubmit = defineComponent({
  name: 'LocalStubSubmit',
  template: '<button type="submit">Submit</button>',
});


const getBaseFieldsConfig = () => ([
  {
    propertyName: 'name',
    label: 'Name',
    component: LocalStubInput,
    rules: ['isRequired', { name: 'minLength', params: { min: 3 } }],
    value: '', // Initial value for the model
  },
  {
    propertyName: 'email',
    label: 'Email',
    component: LocalStubInput,
    rules: ['isRequired', 'isEmail'],
    value: '',
  }
]);

// Mock global Validation object used by useFormValidation
// This ensures that we control the validation outcomes directly.
const mockValidationLibGlobal = {
  isRequired: vi.fn(),
  isEmail: vi.fn(),
  minLength: vi.fn(),
  matchRegex: vi.fn(), // Add any other rules used
};
vi.mock('../validation', () => ({ // This path should match where useFormValidation imports Validation from
  default: mockValidationLibGlobal
}));


describe('PreskoForm.vue', () => {
  let formModel;

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset global Validation mock implementations for each test
    mockValidationLibGlobal.isRequired.mockImplementation((val, label) => val ? true : `${label} is required.`);
    mockValidationLibGlobal.isEmail.mockImplementation((val, label) => /@/.test(val) ? true : `Invalid ${label}.`);
    mockValidationLibGlobal.minLength.mockImplementation((val, label, _, params) => val && val.length >= params.min ? true : `${label} min ${params.min}.`);

    formModel = reactive({ name: '', email: '' }); // Ensure model is fresh for each test
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks(); // Clears mocks, including implementations
  });

  const createWrapper = (props = {}, initialModel = {}) => {
    // Ensure a fresh reactive model for each wrapper if not provided
    const currentModel = reactive({ name: '', email: '', ...initialModel });

    return mount(PreskoForm, {
      props: {
        fields: getBaseFieldsConfig(),
        submitComponent: LocalStubSubmit,
        modelValue: currentModel, // Pass the reactive model here
        ...props,
      },
      global: {
        // Stubs are not needed here if components are passed via field.component directly
      }
    });
  };

  it('renders fields based on configuration', () => {
    const wrapper = createWrapper({}, { name: 'test', email: 'test@example.com' });
    expect(wrapper.findAllComponents(LocalStubInput).length).toBe(2);
    expect(wrapper.findComponent(LocalStubSubmit).exists()).toBe(true);
  });

  it('updates modelValue on input', async () => {
    const wrapper = createWrapper({}, { name: '', email: '' });
    const nameInput = wrapper.findAllComponents(LocalStubInput).at(0);

    await nameInput.vm.$emit('update:modelValue', 'John');

    expect(wrapper.emitted()['update:modelValue']).toBeTruthy();
    expect(wrapper.emitted()['update:modelValue'][0][0]).toEqual({ name: 'John', email: '' });
  });

  describe('Default validationTrigger (onBlur)', () => {
    it('should not validate on input, then validate on blur and show error if invalid', async () => {
      const wrapper = createWrapper({}, { name: 'J', email: '' });
      const nameInput = wrapper.findAllComponents(LocalStubInput).at(0);

      // Simulate input - PreskoFormItem should emit 'field-input'
      // PreskoForm's handleFieldInput calls triggerValidation, but 'onBlur' mode won't validate on 'input' type
      await nameInput.vm.$emit('update:modelValue', 'J'); // This will trigger 'field-input' in PreskoFormItem
      await nameInput.vm.$emit('input'); // Explicitly emit 'input' if the component does that separately
      await nextTick();

      let errorDiv = wrapper.find('.presko-form-item .custom-stub-error'); // Look for error within the item
      expect(errorDiv.exists()).toBe(false); // No error visible yet

      await nameInput.vm.$emit('blur');
      await nextTick(); // Allow validation and re-render

      errorDiv = wrapper.find('.presko-form-item .custom-stub-error');
      expect(errorDiv.exists()).toBe(true);
      expect(errorDiv.text()).toContain('Name min 3');
    });

    it('should validate on submit', async () => {
      const wrapper = createWrapper({}, { name: '', email: '' });
      await wrapper.find('form').trigger('submit.prevent'); // Use .prevent if form has it
      await nextTick();

      const errorMessages = wrapper.findAll('.presko-form-item .custom-stub-error');
      expect(errorMessages.length).toBeGreaterThanOrEqual(1);
      expect(errorMessages.at(0).text()).toContain('Name is required');
      expect(wrapper.emitted()['submit:reject']).toBeTruthy();
    });
  });

  describe('validationTrigger="onInput"', () => {
    const onInputProps = { validationTrigger: 'onInput', inputDebounceMs: 50 };

    it('should validate on input after debounce', async () => {
      // Initial model passed to createWrapper will be used by PreskoForm
      const wrapper = createWrapper(onInputProps, { name: 'J', email: '' });
      const nameInput = wrapper.findAllComponents(LocalStubInput).at(0);

      // Simulate input event that PreskoFormItem listens to via v-model which then emits 'field-input'
      await nameInput.vm.$emit('update:modelValue', 'Jo'); // value becomes 'Jo'
      await nextTick(); // Allow PreskoFormItem to react and emit 'field-input'

      // Error message might be hidden by PreskoFormItem's visual hiding logic
      // We check the validation state after debounce.
      vi.advanceTimersByTime(onInputProps.inputDebounceMs);
      await nextTick(); // Allow validation and re-render

      const errorDiv = wrapper.find('.presko-form-item .custom-stub-error');
      expect(errorDiv.exists()).toBe(true);
      expect(errorDiv.text()).toContain('Name min 3'); // 'Jo' is 2 chars
    });

    it('should debounce rapid inputs', async () => {
      const currentModel = reactive({ name: '', email: '' });
      const wrapper = createWrapper({ ...onInputProps, inputDebounceMs: 100 }, currentModel);
      const nameInputVm = wrapper.findAllComponents(LocalStubInput).at(0).vm;

      currentModel.name = 'J'; // Simulate external model update if PreskoForm relies on that
      await nameInputVm.$emit('update:modelValue', 'J'); // Simulate input
      await nextTick();
      vi.advanceTimersByTime(50);

      currentModel.name = 'Jo';
      await nameInputVm.$emit('update:modelValue', 'Jo');
      await nextTick();
      vi.advanceTimersByTime(50);

      currentModel.name = 'Joh'; // Valid input
      await nameInputVm.$emit('update:modelValue', 'Joh');
      await nextTick();

      // Error should not have appeared for 'J' or 'Jo' due to debounce and visual error hiding
      let errorDiv = wrapper.find('.presko-form-item .custom-stub-error');
      expect(errorDiv.exists()).toBe(false);

      vi.advanceTimersByTime(100); // Full debounce for 'Joh'
      await nextTick(); // Allow validation and re-render

      errorDiv = wrapper.find('.presko-form-item .custom-stub-error');
      expect(errorDiv.exists()).toBe(false); // 'Joh' is valid
      expect(mockValidationLibGlobal.minLength).toHaveBeenCalledTimes(1); // Called once for 'Joh'
    });

    it('error message hides on input to an invalid field, then reappears if still invalid', async () => {
      const currentModel = reactive({ name: 'J', email: '' });
      const wrapper = createWrapper(onInputProps, currentModel);
      const nameInputVm = wrapper.findAllComponents(LocalStubInput).at(0).vm;

      // Initial blur to make it invalid and show error
      await nameInputVm.$emit('blur');
      await nextTick();
      let errorDiv = wrapper.find('.presko-form-item .custom-stub-error');
      expect(errorDiv.exists()).toBe(true);
      expect(errorDiv.text()).toContain('Name min 3');

      // User starts typing again
      currentModel.name = 'Jo'; // Update model
      await nameInputVm.$emit('update:modelValue', 'Jo'); // Simulate input
      await nextTick();

      // Error should hide immediately (visual error hiding in PreskoFormItem)
      errorDiv = wrapper.find('.presko-form-item .custom-stub-error');
      expect(errorDiv.exists()).toBe(false);

      vi.advanceTimersByTime(onInputProps.inputDebounceMs);
      await nextTick();

      errorDiv = wrapper.find('.presko-form-item .custom-stub-error');
      expect(errorDiv.exists()).toBe(true);
      expect(errorDiv.text()).toContain('Name min 3'); // 'Jo' is still invalid
    });
  });

  describe('validationTrigger="onSubmit"', () => {
    const onSubmitProps = { validationTrigger: 'onSubmit' };

    it('should not validate on input or blur', async () => {
      const wrapper = createWrapper(onSubmitProps, { name: 'J', email: '' });
      const nameInputVm = wrapper.findAllComponents(LocalStubInput).at(0).vm;

      await nameInputVm.$emit('update:modelValue', 'Jo');
      await nextTick();
      vi.advanceTimersByTime(200);
      let errorDiv = wrapper.find('.presko-form-item .custom-stub-error');
      expect(errorDiv.exists()).toBe(false);

      await nameInputVm.$emit('blur');
      await nextTick();
      errorDiv = wrapper.find('.presko-form-item .custom-stub-error');
      expect(errorDiv.exists()).toBe(false);
    });

    it('should validate on submit', async () => {
      const wrapper = createWrapper(onSubmitProps, { name: 'J', email: '' });
      await wrapper.find('form').trigger('submit.prevent');
      await nextTick();

      const errorDiv = wrapper.find('.presko-form-item .custom-stub-error');
      expect(errorDiv.exists()).toBe(true);
      expect(errorDiv.text()).toContain('Name min 3');
      expect(wrapper.emitted()['submit:reject']).toBeTruthy();
    });
  });

  it('inputDebounceMs prop affects timing for onInput trigger', async () => {
    const currentModel = reactive({ name: 'J', email: '' });
    const wrapper = createWrapper({
      validationTrigger: 'onInput',
      inputDebounceMs: 200
    }, currentModel);
    const nameInputVm = wrapper.findAllComponents(LocalStubInput).at(0).vm;

    currentModel.name = 'Jo';
    await nameInputVm.$emit('update:modelValue', 'Jo');
    await nextTick();

    vi.advanceTimersByTime(100); // Less than custom debounce
    // Error message should be hidden by PreskoFormItem's visual error logic.
    // Validation in useFormValidation has not run yet.
    let errorDiv = wrapper.find('.presko-form-item .custom-stub-error');
    expect(errorDiv.exists()).toBe(false);

    vi.advanceTimersByTime(100); // Total 200ms
    await nextTick();
    errorDiv = wrapper.find('.presko-form-item .custom-stub-error');
    expect(errorDiv.exists()).toBe(true);
    expect(errorDiv.text()).toContain('Name min 3');
  });

  describe('Event Emission', () => {
    it('emits "submit" with valid data', async () => {
      const wrapper = createWrapper({}, { name: 'ValidName', email: 'valid@email.com' });
      await wrapper.find('form').trigger('submit.prevent');
      await nextTick();

      expect(wrapper.emitted()['submit']).toBeTruthy();
      expect(wrapper.emitted()['submit'][0][0]).toEqual({ name: 'ValidName', email: 'valid@email.com' });
    });

    it('emits "submit:reject" with invalid data', async () => {
      const wrapper = createWrapper({}, { name: 'V', email: 'valid@email.com' });
      await wrapper.find('form').trigger('submit.prevent');
      await nextTick();
      expect(wrapper.emitted()['submit:reject']).toBeTruthy();
    });

    it('emits "field:touched" on blur', async () => {
      const wrapper = createWrapper({}, { name: '', email: '' });
      const nameInputVm = wrapper.findAllComponents(LocalStubInput).at(0).vm;

      await nameInputVm.$emit('blur');
      await nextTick();

      expect(wrapper.emitted()['field:touched']).toBeTruthy();
      expect(wrapper.emitted()['field:touched'][0][0]).toEqual({ propertyName: 'name', touched: true });
    });

    it('emits "field:dirty" when value changes from initial', async () => {
        const initialModel = { name: 'Initial', email: '' };
        // Mount with initial model values
        const wrapper = createWrapper({}, initialModel);
        // Allow PreskoForm's internal watch on modelValue to sync initial values to useFormValidation
        await nextTick();
        await nextTick();


        const nameInputVm = wrapper.findAllComponents(LocalStubInput).at(0).vm;
        // Simulate user changing the input value
        await nameInputVm.$emit('update:modelValue', 'Changed');
        await nextTick(); // Allow PreskoForm to react and emit 'field:dirty'

        const dirtyEvent = wrapper.emitted()['field:dirty'];
        expect(dirtyEvent).toBeTruthy();
        const nameDirtyEvent = dirtyEvent.find(e => e[0].propertyName === 'name');
        expect(nameDirtyEvent).toBeTruthy();
        expect(nameDirtyEvent[0].dirty).toBe(true);
    });
  });
});
