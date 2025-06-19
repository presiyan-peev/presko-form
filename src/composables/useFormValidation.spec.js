import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useFormValidation } from "./useFormValidation";
import { nextTick, reactive } from "vue";
import Validation from "../validation"; // Import the mocked module

// Mock the ../validation module
vi.mock("../validation", () => ({
  default: {
    isRequired: vi.fn((value, label) =>
      value ? true : `${label} is required.`
    ),
    isEmail: vi.fn((value, label) =>
      /@/.test(value) ? true : `Invalid email format for ${label}.`
    ),
    minLength: vi.fn((value, label, _c, params) =>
      value && value.length >= params.min
        ? true
        : `${label} must be at least ${params.min} characters.`
    ),
    domain: vi.fn((value, label) =>
      value === "valid.com" ? true : "Invalid domain format."
    ),
    ipv4: vi
      .fn()
      .mockImplementation((value, label) =>
        value === "1.1.1.1" ? true : `Invalid IPv4 format for ${label}.`
      ),
    ipv6: vi
      .fn()
      .mockImplementation((value, label) =>
        value === "2001:0db8:85a3:0000:0000:8a2e:0370:7334"
          ? true
          : `Invalid IPv6 format for ${label}.`
      ),
    validate: vi.fn((value, rules, label, fieldConfig) => {
      for (const rule of rules) {
        if (typeof rule === "string") {
          if (rule === "isRequired" && (!value || !value.trim()))
            return `${label} is required.`;
          if (rule === "isEmail" && !/@/.test(value))
            return `Invalid email format for ${label}.`;
        } else if (rule.name === "minLength") {
          if (!value || value.length < rule.params.min)
            return `${label} must be at least ${rule.params.min} characters.`;
        }
      }
      return true;
    }),
  },
}));

const getSimpleFieldsConfig = () => [
  {
    propertyName: "name",
    label: "Full Name",
    rules: ["isRequired", { name: "minLength", params: { min: 3 } }],
    value: "",
  },
  {
    propertyName: "email",
    label: "Email Address",
    rules: ["isRequired", "isEmail"],
    value: "",
  },
  {
    propertyName: "bio",
    label: "Biography",
    value: "", // No rules initially
  },
];

const getNestedFieldsConfig = () => [
  {
    propertyName: "username",
    label: "Username",
    rules: ["isRequired"],
    value: "testuser",
  },
  {
    subForm: "profile", // Key for the sub-form object in the model
    fields: [
      // Field definitions for the sub-form
      {
        propertyName: "firstName", // Actual property name for state tracking (e.g., formFieldsValidity.firstName)
        label: "First Name",
        rules: ["isRequired"],
        value: "",
      },
      {
        propertyName: "lastName",
        label: "Last Name",
        rules: ["isRequired"],
        value: "",
      },
    ],
  },
];

const getVariousRulesFieldsConfig = () => [
  {
    propertyName: "name",
    rules: ["isRequired"],
    value: "",
    label: "Name",
  },
  {
    propertyName: "email",
    rules: ["isEmail"],
    value: "test@example.com",
    label: "Email",
  },
  {
    propertyName: "website",
    rules: [{ name: "domain", customErrorMsg: "Invalid domain format." }],
    label: "Website",
    value: "",
  },
  {
    propertyName: "custom",
    label: "Custom",
    validators: [(value) => value === "valid" || 'Must be "valid".'],
    value: "",
  },
  {
    propertyName: "regexField",
    label: "Regex Field",
    rules: [/^[a-z]+$/],
    value: "",
  },
  {
    propertyName: "ipv4Field",
    label: "IPv4 Field",
    rules: ["ipv4"],
    value: "",
  },
  {
    propertyName: "ipv6Field",
    label: "IPv6 Field",
    rules: ["ipv6"],
    value: "",
  },
];

const getListFieldsConfig = () => [
  {
    propertyName: "contacts",
    type: "list",
    label: "Contacts",
    initialValue: [],
    defaultValue: { name: "Default Contact", email: "default@example.com" },
    fields: [
      {
        propertyName: "name",
        label: "Contact Name",
        rules: ["isRequired"],
        value: "",
      },
      {
        propertyName: "email",
        label: "Contact Email",
        rules: ["isRequired", "isEmail"],
        value: "",
      },
    ],
  },
];

describe("useFormValidation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset mocks before each test
    vi.clearAllMocks();

    // Configure mock implementations for each test
    Validation.isRequired.mockImplementation((value, label) =>
      value && value.trim() ? true : `${label} is required.`
    );
    Validation.isEmail.mockImplementation((value, label) =>
      /@/.test(value) ? true : `Invalid email format for ${label}.`
    );
    Validation.minLength.mockImplementation((value, label, _c, params) =>
      value && value.length >= params.min
        ? true
        : `${label} must be at least ${params.min} characters.`
    );
    Validation.ipv4.mockImplementation((value, label) =>
      value === "1.1.1.1" ? true : `Invalid IPv4 format for ${label}.`
    );
    Validation.ipv6.mockImplementation((value, label) =>
      value === "2001:0db8:85a3:0000:0000:8a2e:0370:7334"
        ? true
        : `Invalid IPv6 format for ${label}.`
    );
    Validation.validate.mockImplementation(
      (value, rules, label, fieldConfig) => {
        for (const rule of rules) {
          if (typeof rule === "string") {
            if (rule === "isRequired" && (!value || !value.trim()))
              return `${label} is required.`;
            if (rule === "isEmail" && !/@/.test(value))
              return `Invalid email format for ${label}.`;
          } else if (rule.name === "minLength") {
            if (!value || value.length < rule.params.min)
              return `${label} must be at least ${rule.params.min} characters.`;
          }
        }
        return true;
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks(); // This also restores original module implementations if vi.mock was used.
    vi.useRealTimers();
  });

  describe("Initialization", () => {
    it("should initialize states correctly for flat fields", () => {
      const fields = getSimpleFieldsConfig();
      const {
        formFieldsValidity,
        formFieldsErrorMessages,
        formFieldsTouchedState,
        formFieldsDirtyState,
        formFieldsValues,
      } = useFormValidation(fields);

      expect(formFieldsValues.name).toBe("");
      expect(formFieldsValidity.name).toBeUndefined();
      expect(formFieldsErrorMessages.name).toBeUndefined();
      expect(formFieldsTouchedState.name).toBe(false);
      expect(formFieldsDirtyState.name).toBe(false);

      expect(formFieldsValues.email).toBe("");
      expect(formFieldsValidity.email).toBeUndefined();
    });

    it("should initialize states correctly for nested fields (sub-forms)", () => {
      const fields = getNestedFieldsConfig();
      const { formFieldsValidity, formFieldsErrorMessages, formFieldsValues } =
        useFormValidation(fields);

      expect(formFieldsValues.username).toBe("testuser");
      expect(formFieldsValidity.username).toBeUndefined();

      // Sub-form container itself might not have direct validity unless rules are applied to the object
      expect(formFieldsValidity.profile).toBeUndefined();

      // Check structure of formFieldsValues for sub-forms
      expect(formFieldsValues.profile).toBeTypeOf("object");
      expect(formFieldsValues.profile.firstName).toBe("");
      expect(formFieldsValues.profile.lastName).toBe("");

      // Validity for sub-form fields is stored flatly using their propertyName
      expect(formFieldsValidity.firstName).toBeUndefined();
      expect(formFieldsValidity.lastName).toBeUndefined();
    });

    it("should initialize states correctly for list fields", () => {
      const fields = getListFieldsConfig();
      const {
        formFieldsValues,
        formFieldsValidity,
        formFieldsTouchedState,
        formFieldsDirtyState,
      } = useFormValidation(fields);

      expect(formFieldsValues.contacts).toEqual([]);
      expect(formFieldsValidity.contacts).toBeUndefined();
      expect(formFieldsTouchedState.contacts).toBe(false);
      expect(formFieldsDirtyState.contacts).toBe(false);
    });
  });

  describe("validateField", () => {
    it("should validate a field and update validity state", () => {
      const fields = getSimpleFieldsConfig();
      const { validateField, formFieldsValidity, formFieldsErrorMessages } =
        useFormValidation(fields);

      const isValid = validateField("name", "");
      expect(isValid).toBe(false);
      expect(formFieldsValidity.name).toBe(false);
      expect(formFieldsErrorMessages.name).toBe("Full Name is required.");
    });

    it("should validate field with custom validators", () => {
      const fields = getVariousRulesFieldsConfig();
      const { validateField, formFieldsValidity, formFieldsErrorMessages } =
        useFormValidation(fields);

      let isValid = validateField("custom", "invalid");
      expect(isValid).toBe(false);
      expect(formFieldsValidity.custom).toBe(false);
      expect(formFieldsErrorMessages.custom).toBe('Must be "valid".');

      isValid = validateField("custom", "valid");
      expect(isValid).toBe(true);
      expect(formFieldsValidity.custom).toBeUndefined();
    });

    it("should validate field with regex rules", () => {
      const fields = getVariousRulesFieldsConfig();
      const { validateField, formFieldsValidity, formFieldsErrorMessages } =
        useFormValidation(fields);

      let isValid = validateField("regexField", "ABC123");
      expect(isValid).toBe(false);
      expect(formFieldsValidity.regexField).toBe(false);

      isValid = validateField("regexField", "abc");
      expect(isValid).toBe(true);
      expect(formFieldsValidity.regexField).toBeUndefined();
    });
  });

  describe("Validation Triggers", () => {
    describe("validationTrigger: 'onInput'", () => {
      const options = { validationTrigger: "onInput", inputDebounceMs: 50 };

      it('should validate field after inputDebounceMs on "input" trigger', () => {
        const fields = getSimpleFieldsConfig();
        const { triggerValidation, formFieldsValidity } = useFormValidation(
          fields,
          options
        );
        const model = reactive({ name: "T", email: "", bio: "" });

        triggerValidation("name", "input", model);

        expect(formFieldsValidity.name).toBeUndefined();
        vi.advanceTimersByTime(options.inputDebounceMs);
        expect(formFieldsValidity.name).toBe(false);
      });

      it("should debounce rapid inputs and validate only once with the latest value", async () => {
        const fields = getSimpleFieldsConfig();
        const { triggerValidation, formFieldsValidity } = useFormValidation(
          fields,
          options
        );
        const model = reactive({ name: "", email: "", bio: "" });

        model.name = "T";
        triggerValidation("name", "input", model); // Pass full model
        vi.advanceTimersByTime(options.inputDebounceMs / 2);

        model.name = "Te";
        triggerValidation("name", "input", model);
        vi.advanceTimersByTime(options.inputDebounceMs / 2);

        model.name = "Tes";
        triggerValidation("name", "input", model);
        await nextTick();

        expect(formFieldsValidity.name).toBeUndefined(); // Not validated yet

        vi.advanceTimersByTime(options.inputDebounceMs);
        await nextTick();

        expect(formFieldsValidity.name).toBeUndefined(); // "Tes" is valid (3 chars)
      });

      it('should also validate on "blur" trigger', () => {
        const fields = getSimpleFieldsConfig();
        const { triggerValidation, formFieldsValidity } = useFormValidation(
          fields,
          options
        );
        const model = reactive({ name: "T", email: "", bio: "" });

        triggerValidation("name", "blur", model);
        expect(formFieldsValidity.name).toBe(false);
      });
    });

    describe("validationTrigger: 'onBlur'", () => {
      const optionsOnBlur = { validationTrigger: "onBlur" };

      it('should validate field on "blur" trigger', () => {
        const fields = getSimpleFieldsConfig();
        const { triggerValidation, formFieldsValidity } = useFormValidation(
          fields,
          optionsOnBlur
        );
        const model = reactive({ name: "T", email: "", bio: "" });

        triggerValidation("name", "blur", model);
        expect(formFieldsValidity.name).toBe(false);
      });

      it('should NOT validate field on "input" trigger', () => {
        const fields = getSimpleFieldsConfig();
        const { triggerValidation, formFieldsValidity } = useFormValidation(
          fields,
          optionsOnBlur
        );
        const model = reactive({ name: "T", email: "", bio: "" });

        triggerValidation("name", "input", model);
        vi.advanceTimersByTime(200);
        expect(formFieldsValidity.name).toBeUndefined();
      });
    });

    describe("validationTrigger: 'onSubmit'", () => {
      const optionsOnSubmit = { validationTrigger: "onSubmit" };

      it('should NOT validate field on "input" trigger', () => {
        const fields = getSimpleFieldsConfig();
        const { triggerValidation, formFieldsValidity } = useFormValidation(
          fields,
          optionsOnSubmit
        );
        const model = reactive({ name: "T", email: "", bio: "" });

        triggerValidation("name", "input", model);
        vi.advanceTimersByTime(200);
        expect(formFieldsValidity.name).toBeUndefined();
      });

      it('should NOT validate field on "blur" trigger', () => {
        const fields = getSimpleFieldsConfig();
        const { triggerValidation, formFieldsValidity } = useFormValidation(
          fields,
          optionsOnSubmit
        );
        const model = reactive({ name: "T", email: "", bio: "" });

        triggerValidation("name", "blur", model);
        expect(formFieldsValidity.name).toBeUndefined();
      });
    });
  });

  describe("validateFormPurely", () => {
    it("should validate all fields and return true if all are valid", () => {
      const fields = getSimpleFieldsConfig();
      const { validateFormPurely } = useFormValidation(fields);
      const model = {
        name: "Valid Name",
        email: "valid@example.com",
        bio: "A bio",
      };

      const isValid = validateFormPurely(model);

      expect(isValid).toBe(true);
    });

    it("should validate all fields and return false if any is invalid", () => {
      const fields = getSimpleFieldsConfig();
      const {
        validateFormPurely,
        formFieldsValidity,
        formFieldsErrorMessages,
      } = useFormValidation(fields);
      const model = { name: "V", email: "valid@example.com", bio: "" };

      const isValid = validateFormPurely(model);

      expect(isValid).toBe(false);
      expect(formFieldsValidity.name).toBe(false);
      expect(formFieldsErrorMessages.name).toBe(
        "Full Name must be at least 3 characters."
      );
      expect(formFieldsValidity.email).toBeUndefined(); // is valid in model
    });

    it("should validate nested fields correctly (sub-forms)", () => {
      const fields = getNestedFieldsConfig();
      const {
        validateFormPurely,
        formFieldsValidity,
        formFieldsErrorMessages,
      } = useFormValidation(fields);

      const modelInvalid = {
        username: "testuser",
        profile: {
          firstName: "",
          lastName: "Doe",
        },
      };
      let isValid = validateFormPurely(modelInvalid);
      expect(isValid).toBe(false);
      expect(formFieldsValidity.username).toBeUndefined();
      expect(formFieldsValidity.firstName).toBe(false);
      expect(formFieldsErrorMessages.firstName).toBe("First Name is required.");
      expect(formFieldsValidity.lastName).toBeUndefined();

      const modelValid = {
        username: "gooduser",
        profile: {
          firstName: "John",
          lastName: "Doe",
        },
      };
      isValid = validateFormPurely(modelValid);
      expect(isValid).toBe(true);
      expect(formFieldsValidity.username).toBeUndefined();
      expect(formFieldsValidity.firstName).toBeUndefined();
      expect(formFieldsValidity.lastName).toBeUndefined();
    });

    it("should validate list fields correctly", () => {
      const fields = getListFieldsConfig();
      const {
        validateFormPurely,
        formFieldsValidity,
        formFieldsErrorMessages,
      } = useFormValidation(fields);

      // Test with invalid list data
      const modelInvalid = {
        contacts: [
          { name: "", email: "valid@example.com" },
          { name: "John", email: "invalid-email" },
        ],
      };

      let isValid = validateFormPurely(modelInvalid);
      expect(isValid).toBe(false);
      expect(formFieldsValidity["contacts[0].name"]).toBe(false);
      expect(formFieldsErrorMessages["contacts[0].name"]).toBe(
        "Contact Name is required."
      );
      expect(formFieldsValidity["contacts[1].email"]).toBe(false);

      // Test with valid list data
      const modelValid = {
        contacts: [
          { name: "Alice", email: "alice@example.com" },
          { name: "Bob", email: "bob@example.com" },
        ],
      };

      isValid = validateFormPurely(modelValid);
      expect(isValid).toBe(true);
    });
  });

  describe("List Field Operations", () => {
    let fieldsConfig;
    let formValidationInstance;

    beforeEach(() => {
      fieldsConfig = getListFieldsConfig();
      formValidationInstance = useFormValidation(fieldsConfig);
    });

    it("should add item to list with default values", () => {
      const { addItem, formFieldsValues } = formValidationInstance;

      addItem("contacts");

      expect(formFieldsValues.contacts).toHaveLength(1);
      expect(formFieldsValues.contacts[0]).toEqual({
        name: "Default Contact",
        email: "default@example.com",
      });
    });

    it("should add item to list with custom data", () => {
      const { addItem, formFieldsValues } = formValidationInstance;

      addItem("contacts", { name: "Custom Name", email: "custom@example.com" });

      expect(formFieldsValues.contacts).toHaveLength(1);
      expect(formFieldsValues.contacts[0]).toEqual({
        name: "Custom Name",
        email: "custom@example.com",
      });
    });

    it("should remove item from list", () => {
      const { addItem, removeItem, formFieldsValues } = formValidationInstance;

      // Add two items
      addItem("contacts", { name: "Alice", email: "alice@example.com" });
      addItem("contacts", { name: "Bob", email: "bob@example.com" });

      expect(formFieldsValues.contacts).toHaveLength(2);

      // Remove first item
      removeItem("contacts", 0);

      expect(formFieldsValues.contacts).toHaveLength(1);
      expect(formFieldsValues.contacts[0]).toEqual({
        name: "Bob",
        email: "bob@example.com",
      });
    });

    it("should properly handle validation state for list items", () => {
      const {
        addItem,
        validateField,
        formFieldsValidity,
        formFieldsErrorMessages,
      } = formValidationInstance;

      // Add an item
      addItem("contacts", { name: "", email: "invalid-email" });

      // Validate the list item fields
      validateField("contacts[0].name", "");
      validateField("contacts[0].email", "invalid-email");

      expect(formFieldsValidity["contacts[0].name"]).toBe(false);
      expect(formFieldsErrorMessages["contacts[0].name"]).toBe(
        "Contact Name is required."
      );
      expect(formFieldsValidity["contacts[0].email"]).toBe(false);
    });

    it("should clean up validation state when removing list items", () => {
      const { addItem, removeItem, validateField, formFieldsValidity } =
        formValidationInstance;

      // Add two items and validate them
      addItem("contacts", { name: "", email: "" });
      addItem("contacts", { name: "", email: "" });

      validateField("contacts[0].name", "");
      validateField("contacts[1].name", "");

      expect(formFieldsValidity["contacts[0].name"]).toBe(false);
      expect(formFieldsValidity["contacts[1].name"]).toBe(false);

      // Remove first item
      removeItem("contacts", 0);

      // First item validation state should be cleaned up
      expect(formFieldsValidity["contacts[0].name"]).toBe(false); // This was contacts[1] before
      expect(formFieldsValidity["contacts[1].name"]).toBeUndefined(); // Should be cleaned up
    });
  });

  describe("Field Touched and Dirty States", () => {
    let fieldsConfig;
    let formValidationInstance;

    beforeEach(() => {
      fieldsConfig = [
        { propertyName: "name", label: "Name", value: "Initial Name" },
      ];
      formValidationInstance = useFormValidation(fieldsConfig);
    });

    it("initializes fields as not touched and not dirty", () => {
      expect(formValidationInstance.formFieldsTouchedState.name).toBe(false);
      expect(formValidationInstance.formFieldsDirtyState.name).toBe(false);
    });

    it("setFieldTouched marks field as touched", () => {
      formValidationInstance.setFieldTouched("name", true);
      expect(formValidationInstance.formFieldsTouchedState.name).toBe(true);
    });

    it("checkFieldDirty marks field as dirty if value changes", () => {
      const changed = formValidationInstance.checkFieldDirty(
        "name",
        "New Name"
      );
      expect(changed).toBe(true);
      expect(formValidationInstance.formFieldsDirtyState.name).toBe(true);
    });

    it("checkFieldDirty does not mark field as dirty if value is same", () => {
      const changed = formValidationInstance.checkFieldDirty(
        "name",
        "Initial Name"
      );
      expect(changed).toBe(false);
      expect(formValidationInstance.formFieldsDirtyState.name).toBe(false);
    });

    it("resetValidationState resets validation state", () => {
      const {
        validateField,
        resetValidationState,
        formFieldsValidity,
        formFieldsErrorMessages,
      } = formValidationInstance;

      // Make field invalid
      validateField("name", "");
      expect(formFieldsValidity.name).toBe(false);
      expect(formFieldsErrorMessages.name).toBeTruthy();

      // Reset validation state
      resetValidationState("name");

      expect(formFieldsValidity.name).toBeUndefined();
      expect(formFieldsErrorMessages.name).toBeUndefined();
    });

    it("updateFieldInitialValue updates the initial value for dirty checking", () => {
      const { checkFieldDirty, updateFieldInitialValue } =
        formValidationInstance;

      let changed = checkFieldDirty("name", "New Name");
      expect(changed).toBe(true); // dirty because different from "Initial Name"

      updateFieldInitialValue("name", "New Name");
      changed = checkFieldDirty("name", "New Name"); // re-check
      expect(changed).toBe(true); // State changed from dirty to not dirty
      expect(formValidationInstance.formFieldsDirtyState.name).toBe(false); // not dirty anymore
    });
  });
});

// --- BEGIN ASYNC VALIDATION TESTS ---
describe("useFormValidation - Asynchronous Validation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks(); // Clear mocks, including any previous implementations
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const getAsyncFieldsConfig = (asyncValidatorMock) => [
    {
      propertyName: "asyncField",
      label: "Async Field",
      validators: [asyncValidatorMock],
      value: "",
    },
    {
      propertyName: "otherField",
      label: "Other Field",
      value: "initialOtherValue",
    },
    {
      propertyName: "anotherAsyncField",
      label: "Another Async Field",
      validators: [asyncValidatorMock], // Can use the same mock or a different one
      value: "",
    }
  ];

  it("should correctly update state for a successful async validator", async () => {
    const asyncValidatorMock = vi.fn().mockResolvedValue(true);
    const fields = getAsyncFieldsConfig(asyncValidatorMock);
    const {
      validateField,
      formFieldsValidity,
      formFieldsErrorMessages,
      formFieldsPendingState,
      isFormPending,
    } = useFormValidation(fields);

    const model = reactive({ asyncField: "test" });
    const validationPromise = validateField("asyncField", model.asyncField, model);

    expect(formFieldsPendingState.asyncField).toBe(true);
    expect(isFormPending.value).toBe(true); // isFormPending is a computed ref

    await vi.advanceTimersByTimeAsync(0); // Allow promises to start resolving
    await validationPromise;             // Wait for the validation to complete

    expect(asyncValidatorMock).toHaveBeenCalled();
    expect(formFieldsValidity.asyncField).toBeUndefined(); // Valid
    expect(formFieldsErrorMessages.asyncField).toBeUndefined();
    expect(formFieldsPendingState.asyncField).toBe(false);
    expect(isFormPending.value).toBe(false);
  });

  it("should correctly update state for a failing async validator (resolves with error message)", async () => {
    const errorMsg = "Async validation failed";
    const asyncValidatorMock = vi.fn().mockResolvedValue(errorMsg);
    const fields = getAsyncFieldsConfig(asyncValidatorMock);
    const {
      validateField,
      formFieldsValidity,
      formFieldsErrorMessages,
      formFieldsPendingState,
      isFormPending,
    } = useFormValidation(fields);

    const model = reactive({ asyncField: "test" });
    const validationPromise = validateField("asyncField", model.asyncField, model);

    expect(formFieldsPendingState.asyncField).toBe(true);
    expect(isFormPending.value).toBe(true);

    await vi.advanceTimersByTimeAsync(0);
    await validationPromise;

    expect(formFieldsValidity.asyncField).toBe(false); // Invalid
    expect(formFieldsErrorMessages.asyncField).toBe(errorMsg);
    expect(formFieldsPendingState.asyncField).toBe(false);
    expect(isFormPending.value).toBe(false);
  });

  it("should correctly update state when an async validator promise rejects", async () => {
    const rejectionError = new Error("Network Failure");
    const asyncValidatorMock = vi.fn().mockRejectedValue(rejectionError);
    const fields = getAsyncFieldsConfig(asyncValidatorMock);
    const {
      validateField,
      formFieldsValidity,
      formFieldsErrorMessages,
      formFieldsPendingState,
      isFormPending,
    } = useFormValidation(fields);

    const model = reactive({ asyncField: "test" });
    const validationPromise = validateField("asyncField", model.asyncField, model);

    expect(formFieldsPendingState.asyncField).toBe(true);
    expect(isFormPending.value).toBe(true);

    await vi.advanceTimersByTimeAsync(0); // Allow promises to start processing
    // No need to `await validationPromise` here if we want to test the state after rejection is handled internally
    // However, validateField itself might not throw, but handle the rejection.
    // Let's await it to ensure all internal handling is done.
    try {
      await validationPromise;
    } catch (e) {
      // This catch block might not be reached if validateField handles the rejection internally.
    }


    expect(formFieldsValidity.asyncField).toBe(false); // Invalid due to rejection
    expect(formFieldsErrorMessages.asyncField).toBe(rejectionError.message); // Or a generic message
    expect(formFieldsPendingState.asyncField).toBe(false);
    expect(isFormPending.value).toBe(false);
  });

  it("isFormPending should reflect multiple pending fields", async () => {
    const validator1 = vi.fn(() => new Promise(resolve => setTimeout(() => resolve(true), 50)));
    const validator2 = vi.fn(() => new Promise(resolve => setTimeout(() => resolve(true), 100)));

    const fields = [
      { propertyName: "field1", validators: [validator1], value: "" },
      { propertyName: "field2", validators: [validator2], value: "" },
    ];
    const { validateField, formFieldsPendingState, isFormPending } = useFormValidation(fields);
    const model = reactive({ field1: "val1", field2: "val2" });

    const promise1 = validateField("field1", model.field1, model);
    expect(isFormPending.value).toBe(true);
    expect(formFieldsPendingState.field1).toBe(true);

    const promise2 = validateField("field2", model.field2, model);
    expect(isFormPending.value).toBe(true);
    expect(formFieldsPendingState.field1).toBe(true);
    expect(formFieldsPendingState.field2).toBe(true);

    await vi.advanceTimersByTimeAsync(50); // validator1 resolves
    await promise1;
    expect(formFieldsPendingState.field1).toBe(false);
    expect(formFieldsPendingState.field2).toBe(true); // field2 still pending
    expect(isFormPending.value).toBe(true);

    await vi.advanceTimersByTimeAsync(50); // validator2 resolves
    await promise2;
    expect(formFieldsPendingState.field1).toBe(false);
    expect(formFieldsPendingState.field2).toBe(false);
    expect(isFormPending.value).toBe(false);
  });

  it("ValidationCtx.getValue should provide access to other field values", async () => {
    const otherFieldValue = "expected value from other field";
    const asyncValidatorMock = vi.fn(async (value, label, field, ctx) => {
      const otherVal = ctx.getValue("otherField");
      expect(otherVal).toBe(otherFieldValue);
      return true;
    });

    const fields = getAsyncFieldsConfig(asyncValidatorMock);
    const { validateField } = useFormValidation(fields);
    const model = reactive({ asyncField: "test", otherField: otherFieldValue });

    await validateField("asyncField", model.asyncField, model);
    expect(asyncValidatorMock).toHaveBeenCalled();
  });

  it("resetValidationState should abort pending async validations and reset pending states", async () => {
    const abortFn = vi.fn();
    const asyncValidatorMock = vi.fn(async (value, label, field, ctx) => {
      ctx.abortSignal.addEventListener('abort', abortFn);
      return new Promise(resolve => setTimeout(() => resolve(true), 100)); // Long running
    });

    const fields = getAsyncFieldsConfig(asyncValidatorMock);
    const { validateField, resetValidationState, formFieldsPendingState, isFormPending } = useFormValidation(fields);
    const model = reactive({ asyncField: "test" });

    const validationPromise = validateField("asyncField", model.asyncField, model);
    expect(formFieldsPendingState.asyncField).toBe(true);
    expect(isFormPending.value).toBe(true);

    resetValidationState("asyncField");

    expect(abortFn).toHaveBeenCalled();
    expect(formFieldsPendingState.asyncField).toBe(false);
    expect(isFormPending.value).toBe(false);

    // The original promise might still resolve/reject but its result should be ignored by validateField
    // due to validationRunId or abort signal checks.
    await vi.advanceTimersByTimeAsync(100);
    await validationPromise.catch(() => {}); // Catch if it rejects due to abort, or wait if it resolves
  });

  it("ValidationCtx.abortSignal should abort previous validation when a new one starts", async () => {
    const firstValidationAbortHandler = vi.fn();
    let firstValidatorResolver;
    const firstValidator = vi.fn(async (value, label, field, ctx) => {
      ctx.abortSignal.addEventListener("abort", firstValidationAbortHandler);
      return new Promise((resolve) => { firstValidatorResolver = resolve; }); // Doesn't resolve immediately
    });

    const secondValidator = vi.fn().mockResolvedValue("Second validation done");

    const fields = [
      { propertyName: "testField", validators: [firstValidator], value: "initial" }
    ];
    const { validateField, formFieldsErrorMessages } = useFormValidation(fields);
    const model = reactive({ testField: "initial" });

    // Start first validation
    const firstPromise = validateField("testField", model.testField, model);

    // Immediately start second validation for the same field, but with a different validator setup for this test
    // In a real scenario, it would be the same field config, but validateField is called again.
    fields[0].validators = [secondValidator]; // Swap validator for the second call
    model.testField = "newValue";
    const secondPromise = validateField("testField", model.testField, model);

    // The first validator's abort signal should have been triggered
    expect(firstValidationAbortHandler).toHaveBeenCalled();

    // Resolve the first validator (e.g. if it didn't handle abort internally and still resolved)
    if (firstValidatorResolver) firstValidatorResolver(true);

    await firstPromise.catch(()=>{}); // Catch potential abort error if it throws
    await secondPromise;

    // The state should reflect the second validation's outcome
    expect(formFieldsErrorMessages.testField).toBe("Second validation done");
    expect(secondValidator).toHaveBeenCalled();
  });

  it("should handle race conditions, applying only the result of the latest validation", async () => {
    let resolveFirstValidation;
    const firstValidator = vi.fn(async () => {
      return new Promise(resolve => {
        resolveFirstValidation = () => resolve("Error from first"); // Slower, resolves to error
      });
    });

    const secondValidator = vi.fn(async () => {
      await new Promise(r => setTimeout(r, 10)); // Faster, resolves to valid
      return true;
    });

    const fields = [
      { propertyName: "raceField", validators: [firstValidator], value: "value1" }
    ];

    const { validateField, formFieldsValidity, formFieldsErrorMessages, formFieldsPendingState } = useFormValidation(fields);
    const model = reactive({ raceField: "value1" });

    // Trigger first validation (slower)
    const promise1 = validateField("raceField", model.raceField, model);

    // Immediately trigger second validation (faster) for the same field but with different validator logic for the test
    fields[0].validators = [secondValidator]; // Change validator for second call
    model.raceField = "value2"; // Change value for second call
    const promise2 = validateField("raceField", model.raceField, model);

    // Resolve the first validation (slower one) AFTER the second one has already started and potentially finished
    if(resolveFirstValidation) resolveFirstValidation();

    await promise2; // Second (faster) promise should complete
    await promise1.catch(() => {}); // First (slower) promise might be aborted or its result ignored

    // The state should reflect the outcome of the LATEST validation call (secondValidator -> true)
    expect(formFieldsValidity.raceField).toBeUndefined(); // Valid
    expect(formFieldsErrorMessages.raceField).toBeUndefined();
    expect(formFieldsPendingState.raceField).toBe(false);
  });

  describe("List Fields with Async Validators", () => {
    it("should handle async validation for fields within list items", async () => {
      const asyncListValidator = vi.fn();
      const listFieldsConfig = [
        {
          propertyName: "items",
          type: "list",
          fields: [
            { propertyName: "name", label: "Item Name", validators: [asyncListValidator], value: "" }
          ],
        },
      ];
      const { validateField, formFieldsValidity, formFieldsPendingState, addItem } = useFormValidation(listFieldsConfig);

      addItem("items", { name: "Test Item 1" }); // Adds one item
      const model = reactive({ items: [{ name: "Test Item 1" }] });


      asyncListValidator.mockResolvedValueOnce(true);
      const p1 = validateField("items[0].name", model.items[0].name, model);
      expect(formFieldsPendingState["items[0].name"]).toBe(true);
      await p1;
      expect(formFieldsPendingState["items[0].name"]).toBe(false);
      expect(formFieldsValidity["items[0].name"]).toBeUndefined();


      addItem("items", { name: "Test Item 2" });
      model.items.push({ name: "Test Item 2" });

      asyncListValidator.mockResolvedValueOnce("Item 2 is invalid");
      const p2 = validateField("items[1].name", model.items[1].name, model);
      expect(formFieldsPendingState["items[1].name"]).toBe(true);
      await p2;
      expect(formFieldsPendingState["items[1].name"]).toBe(false);
      expect(formFieldsValidity["items[1].name"]).toBe(false);
    });

    it("removeItem should clean up pending state and abort controller for list item fields", async () => {
      const abortFn = vi.fn();
      const asyncListValidator = vi.fn(async (value, label, field, ctx) => {
        ctx.abortSignal.addEventListener('abort', abortFn);
        return new Promise(resolve => setTimeout(() => resolve(true), 100));
      });

      const listFieldsConfig = [
        {
          propertyName: "items",
          type: "list",
          fields: [ { propertyName: "name", validators: [asyncListValidator], value: "" } ],
        },
      ];
      const { validateField, removeItem, formFieldsPendingState, addItem } = useFormValidation(listFieldsConfig);

      addItem("items", { name: "Item To Remove" });
      const model = reactive({ items: [{ name: "Item To Remove" }] });

      validateField("items[0].name", model.items[0].name, model);
      expect(formFieldsPendingState["items[0].name"]).toBe(true);

      removeItem("items", 0); // Remove the item while its validation is pending

      expect(abortFn).toHaveBeenCalled();
      expect(formFieldsPendingState["items[0].name"]).toBe(false); // Or undefined if key is deleted
    });
  });
});
// --- END ASYNC VALIDATION TESTS ---
