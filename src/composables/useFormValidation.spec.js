import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useFormValidation } from './useFormValidation';
import { nextTick, reactive } from 'vue';

// Mock the ../validation module
const mockValidationLib = {
  isRequired: vi.fn((value, label) => value ? true : `${label} is required.`),
  isEmail: vi.fn((value, label) => /@/.test(value) ? true : `Invalid email format for ${label}.`),
  minLength: vi.fn((value, label, _c, params) => value && value.length >= params.min ? true : `${label} must be at least ${params.min} characters.`),
};
vi.mock('../validation', () => ({
  default: mockValidationLib
}));

const getSimpleFieldsConfig = () => ([
  {
    propertyName: 'name',
    label: 'Full Name',
    rules: ['isRequired', { name: 'minLength', params: { min: 3 } }],
    value: '',
  },
  {
    propertyName: 'email',
    label: 'Email Address',
    rules: ['isRequired', 'isEmail'],
    value: '',
  },
  {
    propertyName: 'bio',
    label: 'Biography',
    value: '', // No rules initially
  }
]);

const getNestedFieldsConfig = () => ([
  {
    propertyName: 'username',
    label: 'Username',
    rules: ['isRequired'],
    value: 'testuser',
  },
  {
    subForm: 'profile', // Key for the sub-form object in the model
    fields: [ // Field definitions for the sub-form
      {
        propertyName: 'firstName', // Actual property name for state tracking (e.g., formFieldsValidity.firstName)
        label: 'First Name',
        rules: ['isRequired'],
        value: '',
      },
      {
        propertyName: 'lastName',
        label: 'Last Name',
        rules: ['isRequired'],
        value: '',
      }
    ]
  }
]);


describe('useFormValidation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset mocks before each test
    mockValidationLib.isRequired.mockClear().mockImplementation((value, label) => value ? true : `${label} is required.`);
    mockValidationLib.isEmail.mockClear().mockImplementation((value, label) => /@/.test(value) ? true : `Invalid email format for ${label}.`);
    mockValidationLib.minLength.mockClear().mockImplementation((value, label, _c, params) => value && value.length >= params.min ? true : `${label} must be at least ${params.min} characters.`);
  });

  afterEach(() => {
    vi.restoreAllMocks(); // This also restores original module implementations if vi.mock was used.
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize states correctly for flat fields', () => {
      const fields = getSimpleFieldsConfig();
      const {
        formFieldsValidity,
        formFieldsErrorMessages,
        formFieldsTouchedState,
        formFieldsDirtyState,
        formFieldsValues,
      } = useFormValidation(fields);

      expect(formFieldsValues.name).toBe('');
      expect(formFieldsValidity.name).toBeUndefined();
      expect(formFieldsErrorMessages.name).toBeUndefined();
      expect(formFieldsTouchedState.name).toBe(false);
      expect(formFieldsDirtyState.name).toBe(false);

      expect(formFieldsValues.email).toBe('');
      expect(formFieldsValidity.email).toBeUndefined();
    });

    it('should initialize states correctly for nested fields (sub-forms)', () => {
        const fields = getNestedFieldsConfig();
        const { formFieldsValidity, formFieldsErrorMessages, formFieldsValues } = useFormValidation(fields);

        expect(formFieldsValues.username).toBe('testuser');
        expect(formFieldsValidity.username).toBeUndefined();

        // Sub-form container itself might not have direct validity unless rules are applied to the object
        expect(formFieldsValidity.profile).toBeUndefined();

        // Check structure of formFieldsValues for sub-forms
        expect(formFieldsValues.profile).toBeTypeOf('object');
        expect(formFieldsValues.profile.firstName).toBe('');
        expect(formFieldsValues.profile.lastName).toBe('');

        // Validity for sub-form fields is stored flatly using their propertyName
        expect(formFieldsValidity.firstName).toBeUndefined();
        expect(formFieldsValidity.lastName).toBeUndefined();
    });
  });

  describe('validateField', () => {
    it('should validate a field and update validity state', () => {
      const fields = getSimpleFieldsConfig();
      const { validateField, formFieldsValidity, formFieldsErrorMessages } = useFormValidation(fields);

      validateField('name', '');
      expect(formFieldsValidity.name).toBe(false);
      expect(formFieldsErrorMessages.name).toBe('Full Name is required.');
      expect(mockValidationLib.isRequired).toHaveBeenCalledWith('', 'Full Name');

      validateField('name', 'Te');
      expect(formFieldsValidity.name).toBe(false);
      expect(formFieldsErrorMessages.name).toBe('Full Name must be at least 3 characters.');
      expect(mockValidationLib.minLength).toHaveBeenCalledWith('Te', 'Full Name', undefined, {min: 3});

      validateField('name', 'Test');
      expect(formFieldsValidity.name).toBeUndefined();
      expect(formFieldsErrorMessages.name).toBeUndefined();
    });
  });

  describe('triggerValidation', () => {
    describe("validationTrigger: 'onInput'", () => {
      const options = { validationTrigger: 'onInput', inputDebounceMs: 50 };

      it('should validate field after inputDebounceMs on "input" trigger', () => {
        const fields = getSimpleFieldsConfig();
        const { triggerValidation, formFieldsValidity } = useFormValidation(fields, options);
        const model = reactive({ name: 'T', email: '', bio: '' });

        triggerValidation('name', 'input', model);

        expect(formFieldsValidity.name).toBeUndefined();
        vi.advanceTimersByTime(options.inputDebounceMs);
        expect(formFieldsValidity.name).toBe(false);
        expect(mockValidationLib.minLength).toHaveBeenCalledWith('T', 'Full Name', undefined, {min: 3});
      });

      it('should clear errorMessage immediately on input if field was invalid, but keep validity as false', () => {
        const fields = getSimpleFieldsConfig();
        const { triggerValidation, validateField, formFieldsValidity, formFieldsErrorMessages } = useFormValidation(fields, options);
        const model = reactive({ name: 'T', email: '', bio: '' });

        validateField('name', 'T'); // Initial validation
        expect(formFieldsValidity.name).toBe(false);
        expect(formFieldsErrorMessages.name).toBe('Full Name must be at least 3 characters.');

        model.name = 'Te';
        triggerValidation('name', 'input', model);

        expect(formFieldsErrorMessages.name).toBeUndefined(); // Cleared immediately
        expect(formFieldsValidity.name).toBe(false); // Stays false

        vi.advanceTimersByTime(options.inputDebounceMs);
        expect(formFieldsValidity.name).toBe(false); // Re-validated
        expect(formFieldsErrorMessages.name).toBe('Full Name must be at least 3 characters.');
      });

      it('should debounce rapid inputs and validate only once with the latest value', () => {
        const fields = getSimpleFieldsConfig();
        const { triggerValidation, formFieldsValidity } = useFormValidation(fields, options);
        const model = reactive({ name: '', email: '', bio: '' });

        model.name = 'T';
        triggerValidation('name', 'input', model); // Pass full model
        vi.advanceTimersByTime(options.inputDebounceMs / 2);

        model.name = 'Te';
        triggerValidation('name', 'input', model);
        vi.advanceTimersByTime(options.inputDebounceMs / 2);

        model.name = 'Tes';
        triggerValidation('name', 'input', model);

        expect(formFieldsValidity.name).toBeUndefined(); // Not validated yet due to previous error clearing
        expect(mockValidationLib.minLength).not.toHaveBeenCalled();

        vi.advanceTimersByTime(options.inputDebounceMs);
        expect(formFieldsValidity.name).toBeUndefined(); // "Tes" is valid (3 chars)
        expect(mockValidationLib.minLength).toHaveBeenCalledTimes(1);
        expect(mockValidationLib.minLength).toHaveBeenCalledWith('Tes', "Full Name", undefined, {"min": 3});
      });

      it('should also validate on "blur" trigger', () => {
        const fields = getSimpleFieldsConfig();
        const { triggerValidation, formFieldsValidity } = useFormValidation(fields, options);
        const model = reactive({ name: 'T', email: '', bio: '' });

        triggerValidation('name', 'blur', model);
        expect(formFieldsValidity.name).toBe(false);
      });
    });

    describe("validationTrigger: 'onBlur'", () => {
      const optionsOnBlur = { validationTrigger: 'onBlur' };

      it('should validate field on "blur" trigger', () => {
        const fields = getSimpleFieldsConfig();
        const { triggerValidation, formFieldsValidity } = useFormValidation(fields, optionsOnBlur);
        const model = reactive({ name: 'T', email: '', bio: '' });

        triggerValidation('name', 'blur', model);
        expect(formFieldsValidity.name).toBe(false);
      });

      it('should NOT validate field on "input" trigger', () => {
        const fields = getSimpleFieldsConfig();
        const { triggerValidation, formFieldsValidity } = useFormValidation(fields, optionsOnBlur);
        const model = reactive({ name: 'T', email: '', bio: '' });

        triggerValidation('name', 'input', model);
        vi.advanceTimersByTime(200);
        expect(formFieldsValidity.name).toBeUndefined();
      });
    });

    describe("validationTrigger: 'onSubmit'", () => {
      const optionsOnSubmit = { validationTrigger: 'onSubmit' };

      it('should NOT validate field on "input" trigger', () => {
        const fields = getSimpleFieldsConfig();
        const { triggerValidation, formFieldsValidity } = useFormValidation(fields, optionsOnSubmit);
        const model = reactive({ name: 'T', email: '', bio: '' });

        triggerValidation('name', 'input', model);
        vi.advanceTimersByTime(200);
        expect(formFieldsValidity.name).toBeUndefined();
      });

      it('should NOT validate field on "blur" trigger', () => {
        const fields = getSimpleFieldsConfig();
        const { triggerValidation, formFieldsValidity } = useFormValidation(fields, optionsOnSubmit);
        const model = reactive({ name: 'T', email: '', bio: '' });

        triggerValidation('name', 'blur', model);
        expect(formFieldsValidity.name).toBeUndefined();
      });
    });
  });

  describe('validateFormPurely', () => {
    it('should validate all fields and return true if all are valid', () => {
      const fields = getSimpleFieldsConfig();
      const { validateFormPurely, formFieldsValidity, formFieldsErrorMessages } = useFormValidation(fields);
      const model = { name: 'Valid Name', email: 'valid@example.com', bio: 'A bio' };

      const isValid = validateFormPurely(model);

      expect(isValid).toBe(true);
      expect(formFieldsValidity.name).toBeUndefined();
      expect(formFieldsValidity.email).toBeUndefined();
    });

    it('should validate all fields and return false if any is invalid', () => {
      const fields = getSimpleFieldsConfig();
      const { validateFormPurely, formFieldsValidity, formFieldsErrorMessages } = useFormValidation(fields);
      const model = { name: 'V', email: 'valid@example.com', bio: '' };

      const isValid = validateFormPurely(model);

      expect(isValid).toBe(false);
      expect(formFieldsValidity.name).toBe(false);
      expect(formFieldsErrorMessages.name).toBe('Full Name must be at least 3 characters.');
      expect(formFieldsValidity.email).toBeUndefined();
    });

    it('should validate nested fields correctly (sub-forms)', () => {
      const fields = getNestedFieldsConfig();
      const { validateFormPurely, formFieldsValidity, formFieldsErrorMessages } = useFormValidation(fields);

      const modelInvalid = {
        username: 'testuser',
        profile: {
          firstName: '',
          lastName: 'Doe'
        }
      };
      let isValid = validateFormPurely(modelInvalid);
      expect(isValid).toBe(false);
      expect(formFieldsValidity.username).toBeUndefined();
      expect(formFieldsValidity.firstName).toBe(false);
      expect(formFieldsErrorMessages.firstName).toBe('First Name is required.');
      expect(formFieldsValidity.lastName).toBeUndefined();

      const modelValid = {
        username: 'gooduser',
        profile: {
          firstName: 'John',
          lastName: 'Doe'
        }
      };
      isValid = validateFormPurely(modelValid);
      expect(isValid).toBe(true);
      expect(formFieldsValidity.username).toBeUndefined();
      expect(formFieldsValidity.firstName).toBeUndefined();
      expect(formFieldsValidity.lastName).toBeUndefined();
    });
  });
  // TODO: Add more tests for state management (touched, dirty, resetValidationState, updateFieldInitialValue)
});
