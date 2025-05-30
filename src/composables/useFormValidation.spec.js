import { describe, it, expect, beforeEach } from "vitest";
import { useFormValidation } from "./useFormValidation"; // Adjust path as necessary
import { reactive, nextTick } from "vue";

// Mock fields configuration for testing
const getMockFields = () => [
  {
    propertyName: "name",
    component: "AppInput",
    rules: ["required"],
    value: "",
    label: "Name",
  },
  {
    propertyName: "email",
    component: "AppInput",
    rules: ["email"],
    value: "test@example.com",
    label: "Email",
  },
  {
    propertyName: "website",
    component: "AppInput",
    rules: [{ name: "domain", customErrorMsg: "Invalid domain format." }],
    label: "Website",
  },
  {
    propertyName: "custom",
    component: "AppInput",
    label: "Custom",
    validators: [(value) => value === "valid" || 'Must be "valid".'],
  },
  {
    propertyName: "regexField",
    component: "AppInput",
    label: "Regex Field",
    rules: [/^[a-z]+$/],
  },
  {
    propertyName: "ipv4Field",
    component: "AppInput",
    label: "IPv4 Field",
    rules: ["ipv4"],
  },
  {
    propertyName: "ipv6Field",
    component: "AppInput",
    label: "IPv6 Field",
    rules: ["ipv6"],
  },
];

describe("useFormValidation", () => {
  let fields;
  let formValidation;

  beforeEach(() => {
    fields = getMockFields();
    formValidation = useFormValidation(fields);
  });

  it("initializes formFieldsValues with initial field values", () => {
    expect(formValidation.formFieldsValues.name).toBe("");
    expect(formValidation.formFieldsValues.email).toBe("test@example.com");
    // Check for fields that might have undefined initial value from getMockFields if not specified
    expect(formValidation.formFieldsValues.ipv4Field).toBeUndefined(); // Assuming ipv4Field has no 'value' in getMockFields
  });

  it("initializes formFieldsValidity and formFieldsErrorMessages as empty", () => {
    fields.forEach((field) => {
      if (field.propertyName) {
        // Guard for malformed field entries
        expect(
          formValidation.formFieldsValidity[field.propertyName]
        ).toBeUndefined();
        expect(
          formValidation.formFieldsErrorMessages[field.propertyName]
        ).toBeUndefined();
      }
    });
  });

  // Test 'required' rule
  describe("required rule", () => {
    const field = getMockFields().find((f) => f.propertyName === "name");
    it("should be invalid if value is empty or whitespace", () => {
      formValidation.validateField(field, "");
      expect(formValidation.formFieldsValidity.name).toBe(false);
      expect(formValidation.formFieldsErrorMessages.name).toBe(
        "Name is required"
      );

      formValidation.validateField(field, "   ");
      expect(formValidation.formFieldsValidity.name).toBe(false);
      expect(formValidation.formFieldsErrorMessages.name).toBe(
        "Name is required"
      );
    });

    it("should be valid if value is provided", () => {
      formValidation.validateField(field, "John Doe");
      expect(formValidation.formFieldsValidity.name).toBeUndefined();
      expect(formValidation.formFieldsErrorMessages.name).toBeUndefined();
    });
  });

  // Test 'email' rule
  describe("email rule", () => {
    const field = getMockFields().find((f) => f.propertyName === "email");
    it("should be invalid for incorrect email format", () => {
      formValidation.validateField(field, "invalid-email");
      expect(formValidation.formFieldsValidity.email).toBe(false);
      expect(formValidation.formFieldsErrorMessages.email).toBe(
        "Email is not valid"
      );
    });

    it("should be valid for correct email format", () => {
      formValidation.validateField(field, "correct@example.com");
      expect(formValidation.formFieldsValidity.email).toBeUndefined();
      expect(formValidation.formFieldsErrorMessages.email).toBeUndefined();
    });
  });

  // Test 'domain' rule with custom message
  describe("domain rule", () => {
    const field = getMockFields().find((f) => f.propertyName === "website");
    it("should be invalid for incorrect domain format and use custom message", () => {
      formValidation.validateField(field, "invalid_domain");
      expect(formValidation.formFieldsValidity.website).toBe(false);
      expect(formValidation.formFieldsErrorMessages.website).toBe(
        "Invalid domain format."
      );
    });

    it("should be valid for correct domain format", () => {
      formValidation.validateField(field, "example.com");
      expect(formValidation.formFieldsValidity.website).toBeUndefined();
      expect(formValidation.formFieldsErrorMessages.website).toBeUndefined();
    });
  });

  // Test 'ipv4' rule
  describe("ipv4 rule", () => {
    const field = getMockFields().find((f) => f.propertyName === "ipv4Field");
    it("should be invalid for incorrect ipv4 format", () => {
      formValidation.validateField(field, "256.0.0.1");
      expect(formValidation.formFieldsValidity.ipv4Field).toBe(false);
      expect(formValidation.formFieldsErrorMessages.ipv4Field).toBe(
        "IPv4 Field is not valid."
      );
    });
    it("should be valid for correct ipv4 format", () => {
      formValidation.validateField(field, "192.168.1.1");
      expect(formValidation.formFieldsValidity.ipv4Field).toBeUndefined();
    });
  });

  // Test 'ipv6' rule
  describe("ipv6 rule", () => {
    const field = getMockFields().find((f) => f.propertyName === "ipv6Field");
    it("should be invalid for incorrect ipv6 format", () => {
      formValidation.validateField(field, "invalid-ipv6");
      expect(formValidation.formFieldsValidity.ipv6Field).toBe(false);
      expect(formValidation.formFieldsErrorMessages.ipv6Field).toBe(
        "IPv6 Field is not valid."
      );
    });
    it("should be valid for correct ipv6 format", () => {
      formValidation.validateField(
        field,
        "2001:0db8:85a3:0000:0000:8a2e:0370:7334"
      );
      expect(formValidation.formFieldsValidity.ipv6Field).toBeUndefined();
    });
  });

  // Test custom validator function
  describe("custom validator", () => {
    const field = getMockFields().find((f) => f.propertyName === "custom");
    it("should be invalid if custom validation fails", () => {
      formValidation.validateField(field, "invalid");
      expect(formValidation.formFieldsValidity.custom).toBe(false);
      expect(formValidation.formFieldsErrorMessages.custom).toBe(
        'Must be "valid".'
      );
    });

    it("should be valid if custom validation passes", () => {
      formValidation.validateField(field, "valid");
      expect(formValidation.formFieldsValidity.custom).toBeUndefined();
      expect(formValidation.formFieldsErrorMessages.custom).toBeUndefined();
    });
  });

  // Test regex rule
  describe("regex rule", () => {
    const field = getMockFields().find((f) => f.propertyName === "regexField");
    it("should be invalid if value does not match regex", () => {
      formValidation.validateField(field, "123");
      expect(formValidation.formFieldsValidity.regexField).toBe(false);
      expect(formValidation.formFieldsErrorMessages.regexField).toContain(
        "Field Regex Field is not valid."
      );
    });

    it("should be valid if value matches regex", () => {
      formValidation.validateField(field, "abc");
      expect(formValidation.formFieldsValidity.regexField).toBeUndefined();
      expect(formValidation.formFieldsErrorMessages.regexField).toBeUndefined();
    });
  });

  describe("validateFormPurely", () => {
    it("should validate all fields based on provided form data and reflect errors", () => {
      const currentFormData = {
        name: "",
        email: "invalid",
        website: "valid.com",
        custom: "invalid",
        regexField: "123",
        ipv4Field: "256.0.0.1",
        ipv6Field: "invalid-ipv6",
      };

      const isValid = formValidation.validateFormPurely(currentFormData);
      expect(isValid).toBe(false);

      expect(formValidation.formFieldsValidity.name).toBe(false);
      expect(formValidation.formFieldsValidity.email).toBe(false);
      expect(formValidation.formFieldsValidity.website).toBeUndefined(); // valid.com should pass domain validation
      expect(formValidation.formFieldsValidity.custom).toBe(false);
      expect(formValidation.formFieldsValidity.regexField).toBe(false);
      expect(formValidation.formFieldsValidity.ipv4Field).toBe(false);
      expect(formValidation.formFieldsValidity.ipv6Field).toBe(false);
    });

    it("should correctly identify a fully valid form", () => {
      const currentFormData = {
        name: "Valid Name",
        email: "valid@example.com",
        website: "valid.com",
        custom: "valid",
        regexField: "abc",
        ipv4Field: "1.2.3.4",
        ipv6Field: "2001:db8::1", // A valid compressed IPv6
      };
      const isValid = formValidation.validateFormPurely(currentFormData);
      expect(isValid).toBe(true);

      // Check that no field has errors
      Object.keys(currentFormData).forEach((key) => {
        expect(formValidation.formFieldsValidity[key]).toBeUndefined();
        expect(formValidation.formFieldsErrorMessages[key]).toBeUndefined();
      });
    });
  });

  describe("multiple rules", () => {
    const multiRuleField = {
      propertyName: "username",
      label: "Username",
      rules: ["required", /^[a-zA-Z0-9]+$/],
    };
    // Need to add this field to the 'fields' used by formValidation instance for these tests
    // Or create a new instance. For simplicity, let's create a new instance for this describe block.
    let multiRuleFormValidation;
    beforeEach(() => {
      multiRuleFormValidation = useFormValidation([multiRuleField]);
    });

    it("should fail if first rule (required) is not met", () => {
      multiRuleFormValidation.validateField(multiRuleField, "");
      expect(multiRuleFormValidation.formFieldsValidity.username).toBe(false);
      expect(multiRuleFormValidation.formFieldsErrorMessages.username).toBe(
        "Field Username is required."
      );
    });

    it("should fail if second rule (alphanumeric) is not met, even if first is met", () => {
      multiRuleFormValidation.validateField(multiRuleField, "User!");
      expect(multiRuleFormValidation.formFieldsValidity.username).toBe(false);
      expect(
        multiRuleFormValidation.formFieldsErrorMessages.username
      ).toContain("Field Username is not valid.");
    });

    it("should pass if all rules are met", () => {
      multiRuleFormValidation.validateField(multiRuleField, "User123");
      expect(
        multiRuleFormValidation.formFieldsValidity.username
      ).toBeUndefined();
      expect(
        multiRuleFormValidation.formFieldsErrorMessages.username
      ).toBeUndefined();
    });
  });
});

describe("Field Touched and Dirty States", () => {
  let fieldsConfig; // Renamed to avoid conflict with outer scope 'fields'
  let formValidationInstance; // Renamed to avoid conflict
  let initialProfileValue;

  beforeEach(() => {
    initialProfileValue = { nestedValue: "initial", unchanged: "data" };
    fieldsConfig = [
      { propertyName: "name", label: "Name", value: "Initial Name" },
      { propertyName: "email", label: "Email", value: "" },
      {
        propertyName: "profile",
        label: "Profile",
        value: JSON.parse(JSON.stringify(initialProfileValue)),
      },
      { propertyName: "noInitialValue", label: "No Initial" }, // Field with no initial value defined in config
    ];
    formValidationInstance = useFormValidation(fieldsConfig);
  });

  it("initializes all fields as not touched and not dirty", () => {
    expect(formValidationInstance.formFieldsTouchedState.name).toBe(false);
    expect(formValidationInstance.formFieldsTouchedState.email).toBe(false);
    expect(formValidationInstance.formFieldsTouchedState.profile).toBe(false);
    expect(formValidationInstance.formFieldsTouchedState.noInitialValue).toBe(
      false
    );

    expect(formValidationInstance.formFieldsDirtyState.name).toBe(false);
    expect(formValidationInstance.formFieldsDirtyState.email).toBe(false);
    expect(formValidationInstance.formFieldsDirtyState.profile).toBe(false);
    expect(formValidationInstance.formFieldsDirtyState.noInitialValue).toBe(
      false
    );
  });

  describe("setFieldTouched", () => {
    it("sets a field to touched and returns true if state changed", () => {
      const result = formValidationInstance.setFieldTouched("name", true);
      expect(formValidationInstance.formFieldsTouchedState.name).toBe(true);
      expect(result).toBe(true);
    });

    it("does not change state and returns false if already in target touched state", () => {
      formValidationInstance.setFieldTouched("name", true);
      const result = formValidationInstance.setFieldTouched("name", true);
      expect(formValidationInstance.formFieldsTouchedState.name).toBe(true);
      expect(result).toBe(false);
    });

    it("can set a field to not touched and returns true if state changed", () => {
      formValidationInstance.setFieldTouched("name", true);
      const result = formValidationInstance.setFieldTouched("name", false);
      expect(formValidationInstance.formFieldsTouchedState.name).toBe(false);
      expect(result).toBe(true);
    });

    it("defaults to setting touched to true", () => {
      const result = formValidationInstance.setFieldTouched("email");
      expect(formValidationInstance.formFieldsTouchedState.email).toBe(true);
      expect(result).toBe(true);
    });
  });

  describe("checkFieldDirty", () => {
    it("sets field as dirty and returns true if primitive value changes from initial", () => {
      const result = formValidationInstance.checkFieldDirty("name", "New Name");
      expect(formValidationInstance.formFieldsDirtyState.name).toBe(true);
      expect(result).toBe(true);
    });

    it("sets field as not dirty and returns true if primitive value reverts to initial", () => {
      formValidationInstance.checkFieldDirty("name", "New Name");
      const result = formValidationInstance.checkFieldDirty(
        "name",
        "Initial Name"
      );
      expect(formValidationInstance.formFieldsDirtyState.name).toBe(false);
      expect(result).toBe(true);
    });

    it("sets field as dirty and returns true if initially undefined field gets a value", () => {
      // 'noInitialValue' has an initial formFieldsValues[propertyName] of undefined
      // and initialFormFieldsValues[propertyName] of undefined
      const result = formValidationInstance.checkFieldDirty(
        "noInitialValue",
        "Some Value"
      );
      expect(formValidationInstance.formFieldsDirtyState.noInitialValue).toBe(
        true
      );
      expect(result).toBe(true);
    });

    it("sets field as not dirty and returns true if initially undefined field gets undefined again after being dirty", () => {
      formValidationInstance.checkFieldDirty("noInitialValue", "Some Value");
      const result = formValidationInstance.checkFieldDirty(
        "noInitialValue",
        undefined
      );
      expect(formValidationInstance.formFieldsDirtyState.noInitialValue).toBe(
        false
      );
      expect(result).toBe(true);
    });

    it("does not change dirty state and returns false if value is same as initial", () => {
      const result = formValidationInstance.checkFieldDirty(
        "name",
        "Initial Name"
      );
      expect(formValidationInstance.formFieldsDirtyState.name).toBe(false);
      expect(result).toBe(false);
    });

    it("sets field as dirty and returns true if object value changes (JSON.stringify comparison)", () => {
      const result = formValidationInstance.checkFieldDirty("profile", {
        nestedValue: "changed",
        unchanged: "data",
      });
      expect(formValidationInstance.formFieldsDirtyState.profile).toBe(true);
      expect(result).toBe(true);
    });

    it("sets field as not dirty and returns true if object value reverts to initial (JSON.stringify comparison)", () => {
      formValidationInstance.checkFieldDirty("profile", {
        nestedValue: "changed",
        unchanged: "data",
      });
      const result = formValidationInstance.checkFieldDirty(
        "profile",
        JSON.parse(JSON.stringify(initialProfileValue))
      );
      expect(formValidationInstance.formFieldsDirtyState.profile).toBe(false);
      expect(result).toBe(true);
    });

    it("does not change dirty state and returns false if object value remains the same (deep comparison by stringify)", () => {
      const result = formValidationInstance.checkFieldDirty(
        "profile",
        JSON.parse(JSON.stringify(initialProfileValue))
      );
      expect(formValidationInstance.formFieldsDirtyState.profile).toBe(false);
      expect(result).toBe(false);
    });

    it("sets field as dirty if new property added to object", () => {
      const newValue = JSON.parse(JSON.stringify(initialProfileValue));
      newValue.anotherProperty = "new data";
      const result = formValidationInstance.checkFieldDirty(
        "profile",
        newValue
      );
      expect(formValidationInstance.formFieldsDirtyState.profile).toBe(true);
      expect(result).toBe(true);
    });
  });
});
