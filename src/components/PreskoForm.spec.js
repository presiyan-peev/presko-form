import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, defineComponent, reactive, ref } from "vue";
import PreskoForm from "./PreskoForm.vue";
// Assuming stubs are in src/__tests__/stubs/ as per typical project structure
// For PreskoForm.spec.js, we might not need the actual stubs from files if we define simple ones locally or use Teleport for complex children.
// However, the task implies using them, so let's assume they are simple pass-through components.
// If StubAppInput and StubAppSubmit are more complex, their behavior might affect these tests.

// Define local, simplified stubs for testing if actual file stubs are problematic or too complex
const LocalStubInput = defineComponent({
  name: "LocalStubInput",
  props: [
    "modelValue",
    "error",
    "errorMessages",
    "touched",
    "dirty",
    "label" /* any other props PreskoFormItem passes */,
  ],
  emits: ["update:modelValue", "blur", "input"],
  setup(props, { expose }) {
    const inputRef = ref(null);
    const focus = vi.fn();
    const scrollIntoView = vi.fn();

    // Expose focus and scrollIntoView to be callable on the component instance's $el or specific element
    // However, for spying, we'll likely spy on the actual DOM element's methods directly in tests.
    // This setup is more for if the component itself needed to call these.
    // For this test, we will retrieve the input element and spy on its methods.

    return {
      inputRef, // Not strictly needed for current test plan but good for completeness
    };
  },
  template: `
    <div>
      <label>{{ label }}</label>
      <input
        ref="inputRef"
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value); $emit('input', $event.target.value)"
        @blur="$emit('blur')"
      />
      <div v-if="error && errorMessages" class="custom-stub-error">{{ Array.isArray(errorMessages) ? errorMessages.join(', ') : errorMessages }}</div>
    </div>
  `,
});

const LocalStubSubmit = defineComponent({
  name: "LocalStubSubmit",
  template: '<button type="submit">Submit</button>',
});

const getBaseFieldsConfig = () => [
  {
    propertyName: "name",
    label: "Name",
    component: LocalStubInput,
    rules: ["isRequired", { name: "minLength", params: { min: 3 } }],
    value: "", // Initial value for the model
  },
  {
    propertyName: "email",
    label: "Email",
    component: LocalStubInput,
    rules: ["isRequired", "isEmail"],
    value: "",
  },
];

const getListFieldsConfig = () => [
  {
    propertyName: "contacts",
    type: "list",
    label: "Contacts",
    itemLabel: "Contact",
    initialValue: [],
    fields: [
      {
        propertyName: "name",
        label: "Contact Name",
        component: LocalStubInput,
        rules: ["isRequired"],
        value: "",
      },
      {
        propertyName: "email",
        label: "Contact Email",
        component: LocalStubInput,
        rules: ["isRequired", "isEmail"],
        value: "",
      },
    ],
  },
];

// Mock global Validation object used by useFormValidation
// This ensures that we control the validation outcomes directly.
vi.mock("../validation", () => ({
  default: {
    isRequired: vi.fn(),
    isEmail: vi.fn(),
    minLength: vi.fn(),
    matchRegex: vi.fn(), // Add any other rules used
  },
}));

describe("PreskoForm.vue", () => {
  let formModel;

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset global Validation mock implementations for each test
    // Note: Validation is already mocked via vi.mock above

    formModel = reactive({ name: "", email: "" }); // Ensure model is fresh for each test
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks(); // Clears mocks, including implementations
  });

  const createWrapper = (props = {}, initialModel = {}) => {
    // Ensure a fresh reactive model for each wrapper if not provided
    const currentModel = reactive({ name: "", email: "", ...initialModel });

    return mount(PreskoForm, {
      props: {
        fields: getBaseFieldsConfig(),
        submitComponent: LocalStubSubmit,
        modelValue: currentModel, // Pass the reactive model here
        ...props,
      },
      global: {
        // Stubs are not needed here if components are passed via field.component directly
      },
    });
  };

  const createFormWrapper = (props = {}, options = {}) => {
    const { initialModel = {}, fieldsConfig = getBaseFieldsConfig() } = options;
    const currentModel = reactive({ name: "", email: "", ...initialModel });

    return mount(PreskoForm, {
      props: {
        fields: fieldsConfig,
        submitComponent: LocalStubSubmit,
        modelValue: currentModel,
        ...props,
      },
      global: {
        stubs: {
          PreskoFormItem: true, // Stub PreskoFormItem if needed
        },
      },
    });
  };

  it("renders fields based on configuration", () => {
    const wrapper = createWrapper(
      {},
      { name: "test", email: "test@example.com" }
    );
    expect(wrapper.findAllComponents(LocalStubInput).length).toBe(2);
    expect(wrapper.findComponent(LocalStubSubmit).exists()).toBe(true);
  });

  it("updates modelValue on input", async () => {
    const wrapper = createWrapper({}, { name: "", email: "" });
    const nameInput = wrapper.findAllComponents(LocalStubInput).at(0);

    await nameInput.vm.$emit("update:modelValue", "John");

    expect(wrapper.emitted()["update:modelValue"]).toBeTruthy();
    expect(wrapper.emitted()["update:modelValue"][0][0]).toEqual({
      name: "John",
      email: "",
    });
  });

  describe("Default validationTrigger (onBlur)", () => {
    it("should not validate on input, then validate on blur and show error if invalid", async () => {
      const wrapper = createWrapper({}, { name: "J", email: "" });
      const nameInput = wrapper.findAllComponents(LocalStubInput).at(0);

      // Simulate input - PreskoFormItem should emit 'field-input'
      await nameInput.vm.$emit("update:modelValue", "J"); // This will trigger 'field-input' in PreskoFormItem
      await nameInput.vm.$emit("input"); // Explicitly emit 'input' if the component does that separately
      await nextTick();

      let errorDiv = wrapper.find(".presko-form-item .custom-stub-error"); // Look for error within the item
      expect(errorDiv.exists()).toBe(false); // No error visible yet

      await nameInput.vm.$emit("blur");
      await nextTick(); // Allow validation and re-render

      errorDiv = wrapper.find(".presko-form-item .custom-stub-error");
      expect(errorDiv.exists()).toBe(true);
      expect(errorDiv.text()).toContain("Name is invalid."); // Update to match actual message
    });

    it("should validate on submit", async () => {
      const wrapper = createWrapper({}, { name: "", email: "" });
      await wrapper.find("form").trigger("submit.prevent"); // Use .prevent if form has it
      await nextTick();

      const errorMessages = wrapper.findAll(
        ".presko-form-item .custom-stub-error"
      );
      expect(errorMessages.length).toBeGreaterThanOrEqual(1);
      expect(errorMessages.at(0).text()).toContain("Name is invalid."); // Update to match actual message
      expect(wrapper.emitted()["submit:reject"]).toBeTruthy();
    });
  });

  describe('validationTrigger="onInput"', () => {
    const onInputProps = { validationTrigger: "onInput", inputDebounceMs: 50 };

    it("should validate on input after debounce", async () => {
      // Initial model passed to createWrapper will be used by PreskoForm
      const wrapper = createWrapper(onInputProps, { name: "J", email: "" });
      const nameInput = wrapper.findAllComponents(LocalStubInput).at(0);

      // Simulate input event that PreskoFormItem listens to via v-model which then emits 'field-input'
      await nameInput.vm.$emit("update:modelValue", "Jo"); // value becomes 'Jo'
      await nextTick(); // Allow PreskoFormItem to react and emit 'field-input'

      // Error message might be hidden by PreskoFormItem's visual hiding logic
      // We check the validation state after debounce.
      vi.advanceTimersByTime(onInputProps.inputDebounceMs);
      await nextTick(); // Allow validation and re-render

      const errorDiv = wrapper.find(".presko-form-item .custom-stub-error");
      expect(errorDiv.exists()).toBe(true);
      expect(errorDiv.text()).toContain("Name is invalid."); // Update to match actual message
    });

    it("should debounce rapid inputs", async () => {
      const currentModel = reactive({ name: "", email: "" });
      const wrapper = createWrapper(
        { ...onInputProps, inputDebounceMs: 100 },
        currentModel
      );
      const nameInputVm = wrapper.findAllComponents(LocalStubInput).at(0).vm;

      currentModel.name = "J"; // Simulate external model update if PreskoForm relies on that
      await nameInputVm.$emit("update:modelValue", "J"); // Simulate input
      await nextTick();
      vi.advanceTimersByTime(50);

      currentModel.name = "Jo";
      await nameInputVm.$emit("update:modelValue", "Jo");
      await nextTick();
      vi.advanceTimersByTime(50);

      currentModel.name = "Joh"; // Valid input
      await nameInputVm.$emit("update:modelValue", "Joh");
      await nextTick();

      // Error should not have appeared for 'J' or 'Jo' due to debounce and visual error hiding
      let errorDiv = wrapper.find(".presko-form-item .custom-stub-error");
      expect(errorDiv.exists()).toBe(false);

      vi.advanceTimersByTime(100); // Full debounce for 'Joh'
      await nextTick(); // Allow validation and re-render

      errorDiv = wrapper.find(".presko-form-item .custom-stub-error");
      expect(errorDiv.exists()).toBe(false); // 'Joh' is valid
      // Validation was called (mocked in vi.mock above)
    });

    it("error message hides on input to an invalid field, then reappears if still invalid", async () => {
    const currentModel = reactive({ name: "J", email: "" }); // J is invalid (minLength 3)
    const Validation = await import("../validation");
    Validation.default.minLength.mockReturnValue(false); // Mock it to be invalid
    Validation.default.isRequired.mockReturnValue(true); // For other fields if any

      const wrapper = createWrapper(onInputProps, currentModel);
      const nameInputVm = wrapper.findAllComponents(LocalStubInput).at(0).vm;

      // Initial blur to make it invalid and show error
      await nameInputVm.$emit("blur");
      await nextTick();
      let errorDiv = wrapper.find(".presko-form-item .custom-stub-error");
      expect(errorDiv.exists()).toBe(true);
      expect(errorDiv.text()).toContain("Name is invalid.");

      // User starts typing again
      currentModel.name = "Jo"; // Still invalid
      await nameInputVm.$emit("update:modelValue", "Jo"); // Simulate input
      await nextTick();

      // Error should hide immediately (visual error hiding in PreskoFormItem)
      errorDiv = wrapper.find(".presko-form-item .custom-stub-error");
      // Depending on PreskoFormItem's internal logic for `temporarilyHideError`
      // and if `showVisualError` considers `isTouched` or `isDirty` which might not change here.
      // Let's assume it hides. If not, this assertion needs adjustment.
      expect(errorDiv.exists()).toBe(false);

      vi.advanceTimersByTime(onInputProps.inputDebounceMs);
      await nextTick();

      errorDiv = wrapper.find(".presko-form-item .custom-stub-error");
      expect(errorDiv.exists()).toBe(true);
      expect(errorDiv.text()).toContain("Name is invalid.");
      Validation.default.minLength.mockRestore(); // Clean up mock for this specific test
    });
  });

  describe('validationTrigger="onSubmit"', () => {
    const onSubmitProps = { validationTrigger: "onSubmit" };

    it("should not validate on input or blur", async () => {
      const wrapper = createWrapper(onSubmitProps, { name: "J", email: "" });
      const nameInputVm = wrapper.findAllComponents(LocalStubInput).at(0).vm;

      await nameInputVm.$emit("update:modelValue", "Jo");
      await nextTick();
      vi.advanceTimersByTime(200);
      let errorDiv = wrapper.find(".presko-form-item .custom-stub-error");
      expect(errorDiv.exists()).toBe(false);

      await nameInputVm.$emit("blur");
      await nextTick();
      errorDiv = wrapper.find(".presko-form-item .custom-stub-error");
      expect(errorDiv.exists()).toBe(false);
    });

    it("should only validate on submit", async () => {
      const wrapper = createWrapper(onSubmitProps, { name: "J", email: "" });
      await wrapper.find("form").trigger("submit.prevent");
      await nextTick();

      const errorMessages = wrapper.findAll(
        ".presko-form-item .custom-stub-error"
      );
      expect(errorMessages.length).toBeGreaterThanOrEqual(1);
      expect(wrapper.emitted()["submit:reject"]).toBeTruthy();
    });
  });

  describe("List Fields", () => {
    it("should render list fields with add button", () => {
      const wrapper = createFormWrapper(
        {},
        {
          fieldsConfig: getListFieldsConfig(),
          initialModel: { contacts: [] },
        }
      );

      expect(wrapper.find(".presko-list-field").exists()).toBe(true);
      expect(wrapper.find(".presko-list-add-btn").exists()).toBe(true);
      expect(wrapper.find(".presko-list-add-btn").text()).toContain(
        "Add Contact"
      );
    });

    it("should add new list item when add button is clicked", async () => {
      const wrapper = createFormWrapper(
        {},
        {
          fieldsConfig: getListFieldsConfig(),
          initialModel: { contacts: [] },
        }
      );

      const addButton = wrapper.find(".presko-list-add-btn");
      await addButton.trigger("click");
      await nextTick();

      expect(wrapper.emitted()["update:modelValue"]).toBeTruthy();
      const updatedModel = wrapper.emitted()["update:modelValue"][0][0];
      expect(updatedModel.contacts).toHaveLength(1);
      expect(updatedModel.contacts[0]).toEqual({ name: "", email: "" });
    });

    it("should remove list item when remove button is clicked", async () => {
      const wrapper = createFormWrapper(
        {},
        {
          fieldsConfig: getListFieldsConfig(),
          initialModel: {
            contacts: [
              { name: "John Doe", email: "john@example.com" },
              { name: "Jane Doe", email: "jane@example.com" },
            ],
          },
        }
      );

      expect(wrapper.findAll(".presko-list-item")).toHaveLength(2);

      const removeButton = wrapper.find(".presko-list-remove-btn");
      await removeButton.trigger("click");
      await nextTick();

      expect(wrapper.emitted()["update:modelValue"]).toBeTruthy();
      const updatedModel = wrapper.emitted()["update:modelValue"][0][0];
      expect(updatedModel.contacts).toHaveLength(1);
      expect(updatedModel.contacts[0]).toEqual({
        name: "Jane Doe",
        email: "jane@example.com",
      });
    });

    it("should handle list item field updates", async () => {
      const wrapper = createFormWrapper(
        {},
        {
          fieldsConfig: getListFieldsConfig(),
          initialModel: {
            contacts: [{ name: "John", email: "john@example.com" }],
          },
        }
      );

      // Simulate updating the first contact's name
      // This would be done through PreskoFormItem but we test the handler directly
      await wrapper.vm.handleListItemFieldModelUpdate(
        "contacts",
        0,
        "name",
        "John Doe"
      );
      await nextTick();

      expect(wrapper.emitted()["update:modelValue"]).toBeTruthy();
      const updatedModel = wrapper.emitted()["update:modelValue"][0][0];
      expect(updatedModel.contacts[0].name).toBe("John Doe");
      expect(updatedModel.contacts[0].email).toBe("john@example.com");
    });

    it("should handle list field touched events", async () => {
      const wrapper = createFormWrapper(
        {},
        {
          fieldsConfig: getListFieldsConfig(),
          initialModel: {
            contacts: [{ name: "John", email: "john@example.com" }],
          },
        }
      );

      // Test list item field blur
      await wrapper.vm.handleListItemFieldBlurred("contacts", 0, "name");
      await nextTick();

      expect(wrapper.emitted()["field:touched"]).toBeTruthy();
      const touchedEvents = wrapper.emitted()["field:touched"];
      expect(
        touchedEvents.some(
          (event) => event[0].propertyName === "contacts[0].name"
        )
      ).toBe(true);
    });

    it("should validate list items properly", async () => {
      // Allow PreskoForm's internal watch on modelValue to sync initial values to useFormValidation
      const wrapper = createFormWrapper(
        { validationTrigger: "onBlur" },
        {
          fieldsConfig: getListFieldsConfig(),
          initialModel: {
            contacts: [{ name: "", email: "invalid-email" }],
          },
        }
      );

      await nextTick(); // Allow initial setup

      // Simulate blur on list item field
      await wrapper.vm.handleListItemFieldBlurred("contacts", 0, "name");
      await nextTick();

      // Check if validation was triggered (would be handled by useFormValidation)
      expect(wrapper.emitted()["field:touched"]).toBeTruthy();

      // Test form submission with invalid list items
      await wrapper.find("form").trigger("submit.prevent");
      await nextTick();

      expect(wrapper.emitted()["submit:reject"]).toBeTruthy();
    });
  });

  describe("Integration - Form with Lists and Regular Fields", () => {
    const getMixedFieldsConfig = () => [
      {
        propertyName: "title",
        label: "Form Title",
        component: LocalStubInput,
        rules: ["isRequired"],
        value: "",
      },
      ...getListFieldsConfig(),
    ];

    it("should handle mixed field types correctly", async () => {
      const wrapper = createFormWrapper(
        {},
        {
          fieldsConfig: getMixedFieldsConfig(),
          initialModel: {
            title: "Test Form",
            contacts: [{ name: "John", email: "john@example.com" }],
          },
        }
      );

      // Test regular field update
      await wrapper.vm.handleFieldModelUpdate("title", "Updated Title");
      await nextTick();

      // Test list operation
      await wrapper.vm.handleAddItem("contacts");
      await nextTick();

      expect(wrapper.emitted()["update:modelValue"]).toBeTruthy();
      const events = wrapper.emitted()["update:modelValue"];
      const lastUpdate = events[events.length - 1][0];

      expect(lastUpdate.title).toBe("Updated Title");
      expect(lastUpdate.contacts).toHaveLength(2);
      expect(lastUpdate.contacts[1]).toEqual({ name: "", email: "" });
    });
  });

  describe("Sub-forms", () => {
    const getSubFormFieldsConfig = () => [
      {
        propertyName: "mainField",
        label: "Main Field",
        component: LocalStubInput,
        rules: ["isRequired"],
        value: "",
      },
      {
        subForm: "profile",
        fields: [
          {
            propertyName: "firstName",
            label: "First Name",
            component: LocalStubInput,
            rules: ["isRequired"],
            value: "",
          },
          {
            propertyName: "lastName",
            label: "Last Name",
            component: LocalStubInput,
            rules: ["isRequired"],
            value: "",
          },
        ],
      },
    ];

    it("should handle sub-form events correctly", async () => {
      const wrapper = createFormWrapper(
        {},
        {
          fieldsConfig: getSubFormFieldsConfig(),
          initialModel: {
            mainField: "test",
            profile: { firstName: "John", lastName: "Doe" },
          },
        }
      );

      // Test sub-form event handling
      await wrapper.vm.handleSubFormEvent("field:touched", "profile", {
        propertyName: "firstName",
        touched: true,
      });
      await nextTick();

      expect(wrapper.emitted()["field:touched"]).toBeTruthy();
      const touchedEvents = wrapper.emitted()["field:touched"];

      // Should emit both the sub-form container and the specific field
      expect(
        touchedEvents.some((event) => event[0].propertyName === "profile")
      ).toBe(true);
      expect(
        touchedEvents.some(
          (event) => event[0].propertyName === "profile.firstName"
        )
      ).toBe(true);
    });
  });

  describe("Field Visibility with isShowing", () => {
    it("should render a field when isShowing is true", () => {
      const wrapper = createWrapper({
        fields: [
          {
            propertyName: "visibleField",
            component: LocalStubInput,
            isShowing: true,
          },
        ],
      });
      expect(wrapper.findComponent(LocalStubInput).exists()).toBe(true);
    });

    it("should not render a field when isShowing is false", () => {
      const wrapper = createWrapper({
        fields: [
          {
            propertyName: "hiddenField",
            component: LocalStubInput,
            isShowing: false,
          },
        ],
      });
      expect(wrapper.findComponent(LocalStubInput).exists()).toBe(false);
    });

    it("should update field visibility when isShowing changes", async () => {
      const isShowingRef = ref(true);
      const wrapper = createWrapper({
        fields: [
          {
            propertyName: "dynamicField",
            component: LocalStubInput,
            isShowing: isShowingRef,
          },
        ],
      });

      expect(wrapper.findComponent(LocalStubInput).exists()).toBe(true);

      isShowingRef.value = false;
      await nextTick();

      expect(wrapper.findComponent(LocalStubInput).exists()).toBe(false);

      isShowingRef.value = true;
      await nextTick();

      expect(wrapper.findComponent(LocalStubInput).exists()).toBe(true);
    });

    it("should not include hidden fields in form submission", async () => {
      const wrapper = createWrapper(
        {
          fields: [
            {
              propertyName: "hiddenField",
              component: LocalStubInput,
              isShowing: false,
            },
            {
              propertyName: "visibleField",
              component: LocalStubInput,
              isShowing: true,
            },
          ],
        },
        { visibleField: "Visible" }
      );

      await wrapper.find("form").trigger("submit.prevent");
      await nextTick();

      expect(wrapper.emitted()["submit"]).toBeTruthy();
      const submittedData = wrapper.emitted()["submit"][0][0];
      expect(submittedData).toEqual({ visibleField: "Visible" });
      expect(submittedData.hiddenField).toBeUndefined();
    });
  });

  describe("Error Handling, Focus Management, and Accessibility", () => {
    let Validation;

    beforeEach(async () => {
      Validation = await import("../validation");
      // Default all validation rules to pass unless specified in a test
      Object.keys(Validation.default).forEach((key) => {
        Validation.default[key].mockReturnValue(true);
      });
    });

    it("should focus the first invalid field and scroll to it by default on submit failure", async () => {
      Validation.default.isRequired.mockImplementation((val) => !!val);
      Validation.default.minLength.mockImplementation((val, params) => val && val.length >= params.min);

      const model = reactive({ name: "J", email: "valid@example.com" }); // Name is invalid (minLength 3)
      const wrapper = createWrapper(
        { fields: getBaseFieldsConfig() }, // Ensure fields use LocalStubInput
        model
      );

      await nextTick(); // allow watcher for initial values to run if any

      // Find the PreskoFormItem for 'name'
      const nameFormItem = wrapper.findComponent('[data-pk-field="name"]');
      expect(nameFormItem.exists()).toBe(true);

      // Get the actual input element within the PreskoFormItem for 'name'
      const nameInputEl = nameFormItem.element.querySelector('input');
      expect(nameInputEl).toBeTruthy();

      const focusSpy = vi.spyOn(nameInputEl, "focus");
      const scrollIntoViewSpy = vi.spyOn(nameInputEl, "scrollIntoView");

      Validation.default.minLength.mockReturnValueOnce(false); // name "J" is too short

      await wrapper.find("form").trigger("submit.prevent");
      await nextTick(); // for submit processing
      vi.advanceTimersByTime(100); // for setTimeout in focus logic
      await nextTick(); // for DOM updates after timers

      expect(wrapper.emitted()["submit:reject"]).toBeTruthy();

      expect(scrollIntoViewSpy).toHaveBeenCalled();
      expect(focusSpy).toHaveBeenCalled();

      focusSpy.mockRestore();
      scrollIntoViewSpy.mockRestore();
    });

    it("should scroll to but not focus the first invalid field if autoFocusOnError is false", async () => {
      Validation.default.isRequired.mockImplementation((val) => !!val);
      Validation.default.minLength.mockImplementation((val, params) => val && val.length >= params.min);

      const model = reactive({ name: "J", email: "valid@example.com" });
      const wrapper = createWrapper(
        {
          fields: getBaseFieldsConfig(),
          autoFocusOnError: false
        },
        model
      );
      await nextTick();

      const nameFormItem = wrapper.findComponent('[data-pk-field="name"]');
      const nameInputEl = nameFormItem.element.querySelector('input');
      const focusSpy = vi.spyOn(nameInputEl, "focus");
      const scrollIntoViewSpy = vi.spyOn(nameInputEl, "scrollIntoView");

      Validation.default.minLength.mockReturnValueOnce(false); // name "J" is too short

      await wrapper.find("form").trigger("submit.prevent");
      await nextTick();
      vi.advanceTimersByTime(100);
      await nextTick();

      expect(scrollIntoViewSpy).toHaveBeenCalled();
      expect(focusSpy).not.toHaveBeenCalled();

      focusSpy.mockRestore();
      scrollIntoViewSpy.mockRestore();
    });

    it("calls scrollToError callback if provided and does not call default scrollIntoView", async () => {
      Validation.default.minLength.mockReturnValueOnce(false); // name "J" will be invalid
      const model = reactive({ name: "J", email: "valid@example.com" });
      const scrollToErrorMock = vi.fn();

      const wrapper = createWrapper(
        {
          fields: getBaseFieldsConfig(),
          scrollToError: scrollToErrorMock
        },
        model
      );
      await nextTick();

      const nameFormItem = wrapper.findComponent('[data-pk-field="name"]');
      const nameInputEl = nameFormItem.element.querySelector('input');
      // We are spying on the PreskoFormItem's element, but the callback receives the input
      const scrollIntoViewSpy = vi.spyOn(nameInputEl, "scrollIntoView");
      // The focus will still be called on the input element if autoFocusOnError is true (default)
      const focusSpy = vi.spyOn(nameInputEl, 'focus');


      await wrapper.find("form").trigger("submit.prevent");
      await nextTick();
      vi.advanceTimersByTime(100);
      await nextTick();

      expect(scrollToErrorMock).toHaveBeenCalled();
      // The argument to scrollToErrorMock should be the PreskoFormItem's root DOM element,
      // or the focusable element within it, depending on PreskoForm's implementation.
      // Current PreskoForm implementation passes the PreskoFormItem's $el (root div).
      expect(scrollToErrorMock.mock.calls[0][0]).toBe(nameFormItem.element);
      expect(scrollIntoViewSpy).not.toHaveBeenCalled();
      expect(focusSpy).toHaveBeenCalled(); // Default autoFocusOnError is true

      scrollIntoViewSpy.mockRestore();
      focusSpy.mockRestore();
    });

    it("emits submit:reject with firstInvalidPath and firstInvalidEl", async () => {
      Validation.default.minLength.mockReturnValueOnce(false); // name "J" will be invalid
      const model = reactive({ name: "J", email: "valid@example.com" });
      const wrapper = createWrapper({ fields: getBaseFieldsConfig() }, model);
      await nextTick();

      const nameFormItem = wrapper.findComponent('[data-pk-field="name"]');

      await wrapper.find("form").trigger("submit.prevent");
      await nextTick();

      expect(wrapper.emitted()["submit:reject"]).toBeTruthy();
      const rejectPayload = wrapper.emitted()["submit:reject"][0][0];
      expect(rejectPayload.firstInvalidPath).toBe("name");
      // firstInvalidEl is the PreskoFormItem's root DOM element
      expect(rejectPayload.firstInvalidEl).toBe(nameFormItem.element);
    });

    it("announces error message via ARIA live region using errorAnnouncement prop", async () => {
      Validation.default.minLength.mockReturnValueOnce(false);
      const model = reactive({ name: "J", email: "valid@example.com" });
      const customErrorAnnouncement = "Form has errors, please review.";

      const wrapper = createWrapper(
        {
          fields: getBaseFieldsConfig(),
          errorAnnouncement: customErrorAnnouncement
        },
        model
      );
      await nextTick();

      await wrapper.find("form").trigger("submit.prevent");
      await nextTick();

      const liveRegion = wrapper.find('[role="alert"]');
      expect(liveRegion.exists()).toBe(true);
      expect(liveRegion.text()).toBe(customErrorAnnouncement);
    });

    it("announces default error message if errorAnnouncement prop is not provided", async () => {
      Validation.default.minLength.mockReturnValueOnce(false);
      const model = reactive({ name: "J", email: "valid@example.com" });

      const wrapper = createWrapper({ fields: getBaseFieldsConfig() }, model);
      await nextTick();

      await wrapper.find("form").trigger("submit.prevent");
      await nextTick();

      const liveRegion = wrapper.find('[role="alert"]');
      expect(liveRegion.exists()).toBe(true);
      expect(liveRegion.text()).toBe("Please correct the highlighted field"); // Default message
    });
  });
});
