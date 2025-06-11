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

describe("useFormValidation - Basic Fields", () => {
  let fields;
  let formValidation;

  beforeEach(() => {
    fields = getMockFields();
    formValidation = useFormValidation(fields);
  });

  it("initializes formFieldsValues with initial field values", () => {
    expect(formValidation.formFieldsValues.name).toBe("");
    expect(formValidation.formFieldsValues.email).toBe("test@example.com");
    expect(formValidation.formFieldsValues.ipv4Field).toBeUndefined();
  });

  it("initializes formFieldsValidity and formFieldsErrorMessages as empty", () => {
    fields.forEach((field) => {
      if (field.propertyName) {
        expect(formValidation.formFieldsValidity[field.propertyName]).toBeUndefined();
        expect(formValidation.formFieldsErrorMessages[field.propertyName]).toBeUndefined();
      }
    });
  });

  describe("required rule", () => {
    const fieldName = "name";
    const fieldConfig = () => getMockFields().find(f => f.propertyName === fieldName);
    it("should be invalid if value is empty or whitespace", () => {
      formValidation.validateField(fieldConfig(), "", fieldName);
      expect(formValidation.formFieldsValidity[fieldName]).toBe(false);
      expect(formValidation.formFieldsErrorMessages[fieldName]).toBe("Field Name is required.");
    });
    it("should be valid if value is provided", () => {
      formValidation.validateField(fieldConfig(), "John Doe", fieldName);
      expect(formValidation.formFieldsValidity[fieldName]).toBeUndefined();
    });
  });

  describe("email rule", () => {
    const fieldName = "email";
    const fieldConfig = () => getMockFields().find(f => f.propertyName === fieldName);
    it("should be invalid for incorrect email format", () => {
      formValidation.validateField(fieldConfig(), "invalid-email", fieldName);
      expect(formValidation.formFieldsValidity[fieldName]).toBe(false);
    });
    it("should be valid for correct email format", () => {
      formValidation.validateField(fieldConfig(), "correct@example.com", fieldName);
      expect(formValidation.formFieldsValidity[fieldName]).toBeUndefined();
    });
  });

  describe("validateFormPurely with basic fields", () => {
    it("should validate all fields and reflect errors", () => {
      const currentFormData = { name: "", email: "invalid" };
      const isValid = formValidation.validateFormPurely(currentFormData);
      expect(isValid).toBe(false);
      expect(formValidation.formFieldsValidity.name).toBe(false);
      expect(formValidation.formFieldsValidity.email).toBe(false);
    });
  });
});

describe("Field Touched and Dirty States - Basic Fields", () => {
  let fieldsConfig;
  let formValidationInstance;

  beforeEach(() => {
    fieldsConfig = [ { propertyName: "name", label: "Name", value: "Initial Name" } ];
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
    formValidationInstance.checkFieldDirty("name", "New Name");
    expect(formValidationInstance.formFieldsDirtyState.name).toBe(true);
  });
});


describe("useFormValidation - List Fields", () => {
  let listFieldsConfig;
  let formListValidation;

  beforeEach(() => {
    listFieldsConfig = [
      {
        propertyName: "listField",
        type: "list",
        label: "My List",
        defaultValue: { itemText: "default", itemNum: 0 }, // Default for new items
        fields: [
          { propertyName: "itemText", label: "Item Text", rules: ["required"] },
          { propertyName: "itemNum", label: "Item Number", rules: ["required"] },
        ],
        initialValue: [ // Initial items for the list
          { itemText: "Initial item 1", itemNum: 1 },
        ],
      },
      { propertyName: "anotherField", label: "Another Field", value: "abc" }
    ];
    formListValidation = useFormValidation(listFieldsConfig);
  });

  it("initializes list field values and states correctly", () => {
    // Check main list field value
    expect(Array.isArray(formListValidation.formFieldsValues.listField)).toBe(true);
    expect(formListValidation.formFieldsValues.listField.length).toBe(1);
    expect(formListValidation.formFieldsValues.listField[0].itemText).toBe("Initial item 1");
    expect(formListValidation.formFieldsValues.listField[0].itemNum).toBe(1);

    // Check initial values store for the list
    expect(Array.isArray(formListValidation.initialFormFieldsValues.listField)).toBe(true);
    expect(formListValidation.initialFormFieldsValues.listField[0].itemText).toBe("Initial item 1");


    // Check states for the first item's fields
    const item0TextPath = "listField[0].itemText";
    const item0NumPath = "listField[0].itemNum";
    expect(formListValidation.formFieldsTouchedState[item0TextPath]).toBe(false);
    expect(formListValidation.formFieldsDirtyState[item0TextPath]).toBe(false);
    expect(formListValidation.formFieldsValidity[item0TextPath]).toBeUndefined();

    expect(formListValidation.formFieldsTouchedState[item0NumPath]).toBe(false);
    expect(formListValidation.formFieldsDirtyState[item0NumPath]).toBe(false);
    expect(formListValidation.formFieldsValidity[item0NumPath]).toBeUndefined();

    // Check list field itself touched/dirty (should be false initially)
    expect(formListValidation.formFieldsTouchedState.listField).toBe(false);
    expect(formListValidation.formFieldsDirtyState.listField).toBe(false);


    // Check another regular field
    expect(formListValidation.formFieldsValues.anotherField).toBe("abc");
  });

  describe("addItem", () => {
    it("adds a new item using defaultValue if no initialData provided", () => {
      formListValidation.addItem("listField");
      expect(formListValidation.formFieldsValues.listField.length).toBe(2);
      expect(formListValidation.formFieldsValues.listField[1].itemText).toBe("default");
      expect(formListValidation.formFieldsValues.listField[1].itemNum).toBe(0);

      // Check states for the new item's fields
      const item1TextPath = "listField[1].itemText";
      expect(formListValidation.formFieldsTouchedState[item1TextPath]).toBe(false);
      expect(formListValidation.formFieldsDirtyState[item1TextPath]).toBe(false); // Dirty because it's different from an "undefined" initial state if not explicitly set for this new item
      expect(formListValidation.initialFormFieldsValues.listField[1].itemText).toBe("default");


      // List itself should be dirty after adding an item
       expect(formListValidation.formFieldsDirtyState.listField).toBe(true);
    });

    it("adds a new item with provided initialData", () => {
      formListValidation.addItem("listField", { itemText: " spécifiques ", itemNum: 99 });
      expect(formListValidation.formFieldsValues.listField.length).toBe(2);
      expect(formListValidation.formFieldsValues.listField[1].itemText).toBe(" spécifiques ");
      expect(formListValidation.formFieldsValues.listField[1].itemNum).toBe(99);
      expect(formListValidation.initialFormFieldsValues.listField[1].itemNum).toBe(99);
    });
  });

  describe("removeItem", () => {
    beforeEach(() => {
      // Add a few items for removal tests
      formListValidation.addItem("listField", { itemText: "Item 2", itemNum: 2 }); // index 1
      formListValidation.addItem("listField", { itemText: "Item 3", itemNum: 3 }); // index 2
      // listField is now: [ {Initial item 1, 1}, {Item 2, 2}, {Item 3, 3} ]
      // Touch and make an item dirty to test state cleanup/shifting
      formListValidation.setFieldTouched("listField[1].itemText", true);
      formListValidation.checkFieldDirty("listField[1].itemText", "Changed Item 2");
      formListValidation.formFieldsValues.listField[1].itemText = "Changed Item 2"; // manual change to simulate input
      formListValidation.validateField(listFieldsConfig[0].fields[0], "", "listField[2].itemText"); // Make item 3 invalid
    });

    it("removes an item from the middle and shifts subsequent items and their states", () => {
      expect(formListValidation.formFieldsValues.listField.length).toBe(3);
      expect(formListValidation.formFieldsTouchedState["listField[1].itemText"]).toBe(true);
      expect(formListValidation.formFieldsDirtyState["listField[1].itemText"]).toBe(true);
      expect(formListValidation.formFieldsValidity["listField[2].itemText"]).toBe(false);


      formListValidation.removeItem("listField", 1); // Remove "Item 2"

      expect(formListValidation.formFieldsValues.listField.length).toBe(2);
      expect(formListValidation.formFieldsValues.listField[0].itemText).toBe("Initial item 1");
      expect(formListValidation.formFieldsValues.listField[1].itemText).toBe(""); // This was Item 3, which had an invalid empty text
      expect(formListValidation.formFieldsValues.listField[1].itemNum).toBe(3);

      // Check that states for "Item 2" (old index 1) are gone
      expect(formListValidation.formFieldsTouchedState["listField[1].itemText"]).toBeUndefined(); // This was the shifted item
      expect(formListValidation.formFieldsDirtyState["listField[1].itemText"]).toBeUndefined();

      // Check that states for "Item 3" (old index 2, now index 1) are shifted
      expect(formListValidation.formFieldsTouchedState["listField[1].itemText"]).toBeFalsy(); // It was not touched initially
      expect(formListValidation.formFieldsDirtyState["listField[1].itemText"]).toBe(true); // It was empty, initial was "Item 3"
      expect(formListValidation.formFieldsValidity["listField[1].itemText"]).toBe(false); // Invalid state shifted

      // List itself should be dirty
      expect(formListValidation.formFieldsDirtyState.listField).toBe(true);
    });

    it("removes the last item", () => {
      formListValidation.removeItem("listField", 2); // Remove "Item 3"
      expect(formListValidation.formFieldsValues.listField.length).toBe(2);
      expect(formListValidation.formFieldsValues.listField[1].itemText).toBe("Changed Item 2");
      expect(formListValidation.formFieldsErrorMessages["listField[2].itemText"]).toBeUndefined(); // Errors for removed item gone
    });

    it("removes the first item", () => {
      formListValidation.removeItem("listField", 0); // Remove "Initial item 1"
      expect(formListValidation.formFieldsValues.listField.length).toBe(2);
      expect(formListValidation.formFieldsValues.listField[0].itemText).toBe("Changed Item 2"); // Item 2 shifted to index 0
      expect(formListValidation.formFieldsTouchedState["listField[0].itemText"]).toBe(true); // State shifted
    });

    it("removes the only item", () => {
      const singleItemListConf = [{
        propertyName: "singleList", type: "list", defaultValue: {text: "a"}, fields: [{ propertyName: "text" }], initialValue: [{text: "item1"}]
      }];
      const singleListValidation = useFormValidation(singleItemListConf);
      singleListValidation.removeItem("singleList", 0);
      expect(singleListValidation.formFieldsValues.singleList.length).toBe(0);
      expect(singleListValidation.formFieldsTouchedState["singleList[0].text"]).toBeUndefined();
    });
  });

  describe("validateFormPurely with list fields", () => {
    it("validates all items in a list", () => {
      const formData = {
        listField: [
          { itemText: "Valid Text 1", itemNum: 10 },
          { itemText: "", itemNum: 20 }, // Invalid: itemText is required
        ],
        anotherField: "valid"
      };
      const isValid = formListValidation.validateFormPurely(formData);
      expect(isValid).toBe(false);
      expect(formListValidation.formFieldsValidity["listField[0].itemText"]).toBeUndefined();
      expect(formListValidation.formFieldsValidity["listField[1].itemText"]).toBe(false);
      expect(formListValidation.formFieldsErrorMessages["listField[1].itemText"]).toBe("Field Item Text is required.");
    });

    it("passes validation if all items in list are valid", () => {
       const formData = {
        listField: [
          { itemText: "Valid Text 1", itemNum: 10 },
          { itemText: "Valid Text 2", itemNum: 20 },
        ],
        anotherField: "valid"
      };
      const isValid = formListValidation.validateFormPurely(formData);
      expect(isValid).toBe(true);
      expect(formListValidation.formFieldsValidity["listField[0].itemText"]).toBeUndefined();
      expect(formListValidation.formFieldsValidity["listField[1].itemText"]).toBeUndefined();
    });
  });

  describe("State Propagation for List Items", () => {
    it("marks list field and form as touched when an item field is touched", () => {
      formListValidation.setFieldTouched("listField[0].itemText", true);
      expect(formListValidation.formFieldsTouchedState["listField[0].itemText"]).toBe(true);
      expect(formListValidation.formFieldsTouchedState.listField).toBe(true); // Parent list also touched
    });

    it("marks list field and form as dirty when an item field value changes", () => {
      formListValidation.checkFieldDirty("listField[0].itemNum", 123); // Initial was 1
      expect(formListValidation.formFieldsDirtyState["listField[0].itemNum"]).toBe(true);
      expect(formListValidation.formFieldsDirtyState.listField).toBe(true); // Parent list also dirty
    });

    it("list remains dirty if one item becomes non-dirty but another is still dirty", () => {
      formListValidation.checkFieldDirty("listField[0].itemText", "new text"); // item 0 dirty
      formListValidation.addItem("listField", { itemText: "another new", itemNum: 500 }); // item 1 added, list dirty
      formListValidation.checkFieldDirty("listField[1].itemText", "another new text"); // item 1 dirty

      expect(formListValidation.formFieldsDirtyState["listField[0].itemText"]).toBe(true);
      expect(formListValidation.formFieldsDirtyState["listField[1].itemText"]).toBe(true);
      expect(formListValidation.formFieldsDirtyState.listField).toBe(true);

      // Revert item 0 to initial state
      formListValidation.checkFieldDirty("listField[0].itemText", "Initial item 1");
      expect(formListValidation.formFieldsDirtyState["listField[0].itemText"]).toBe(false);
      // List should still be dirty because item 1 is dirty
      expect(formListValidation.formFieldsDirtyState.listField).toBe(true);
    });
  });
});

[end of src/composables/useFormValidation.spec.js]
