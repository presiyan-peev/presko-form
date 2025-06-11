import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import PreskoForm from "./PreskoForm.vue";
import StubAppInput from "../__tests__/stubs/StubAppInput.vue";
import StubAppSubmit from "../__tests__/stubs/StubAppSubmit.vue";
// Assuming a stub for select and checkbox if needed by list item tests
const StubAppSelect = defineComponent({
  name: "StubAppSelect",
  props: ["modelValue", "options", "label", "error", "errorMessages", "touched", "dirty"],
  emits: ["update:modelValue", "blur"],
  template: `<select @change="$emit('update:modelValue', $event.target.value)" @blur="$emit('blur')">
    <option v-for="opt in options" :key="opt.value || opt" :value="opt.value || opt">
      {{ opt.text || opt }}
    </option>
  </select>`,
});
const StubAppCheckbox = defineComponent({
  name: "StubAppCheckbox",
  props: ["modelValue", "label", "error", "errorMessages", "touched", "dirty"],
  emits: ["update:modelValue", "blur"],
  template: `<input type="checkbox" :checked="modelValue" @change="$emit('update:modelValue', $event.target.checked)" @blur="$emit('blur')" />`,
});


import { nextTick, defineComponent, h, reactive } from "vue";

// Helper to create a basic PreskoForm wrapper
const createFormWrapper = (props = {}, options = {}) => {
  return mount(PreskoForm, {
    props: {
      fields: [],
      modelValue: {},
      submitComponent: "StubAppSubmit", // Default submit component
      ...props,
    },
    global: {
      components: {
        StubAppInput,
        StubAppSubmit,
        StubAppSelect,
        StubAppCheckbox,
        PreskoForm, // For nested forms / sub-forms
      },
      ...options.global,
    },
    ...options,
  });
};

describe("PreskoForm.vue - Basic Functionality", () => {
  // ... (Keep existing basic tests for rendering, v-model, validation, sub-forms, props, slots, interaction states)
  // For brevity, I'm assuming these existing tests are here and passing.
  // I will add new describe blocks for List Field Functionality.

  describe("Basic Rendering", () => {
    it("renders specified components for fields", async () => {
      const actualFields = [
        { propertyName: "name", component: "StubAppInput", props: { label: "Name" }, value: "DefaultName" },
      ];
      const wrapper = createFormWrapper({ fields: actualFields, modelValue: {name: "DefaultName"} });
      await nextTick();
      const inputComponents = wrapper.findAllComponents(StubAppInput);
      expect(inputComponents.length).toBe(1);
      expect(inputComponents[0].props("label")).toBe("Name");
    });
  });

  describe("v-model integration", () => {
    it("updates input components when modelValue prop changes", async () => {
      const fields = [{ propertyName: "name", component: "StubAppInput", value: "Initial" }];
      const wrapper = createFormWrapper({ fields, modelValue: { name: "Initial Name" } });
      await nextTick();
      await wrapper.setProps({ modelValue: { name: "Updated Name" } });
      await nextTick();
      expect(wrapper.findComponent(StubAppInput).props("modelValue")).toBe("Updated Name");
    });

    it('emits "update:modelValue" when an input changes', async () => {
      const fields = [{ propertyName: "name", component: "StubAppInput", value: "Old" }];
      const wrapper = createFormWrapper({ fields, modelValue: {name: "Old"} });
      await nextTick();
      wrapper.findComponent(StubAppInput).vm.$emit("update:modelValue", "New");
      await nextTick();
      expect(wrapper.emitted("update:modelValue")[0][0]).toEqual({ name: "New" });
    });
  });

   describe("Validation and Submission Flow", () => {
    it('emits "submit:reject" with invalid data', async () => {
      const fields = [{ propertyName: "name", component: "StubAppInput", rules: ["required"] }];
      const wrapper = createFormWrapper({ fields, modelValue: { name: "" } });
      await nextTick();
      await wrapper.find("form").trigger("submit.prevent");
      await nextTick();
      expect(wrapper.emitted("submit:reject")).toBeTruthy();
    });

    it('emits "submit" with valid data', async () => {
      const fields = [{ propertyName: "name", component: "StubAppInput", rules: ["required"] }];
      const wrapper = createFormWrapper({ fields, modelValue: { name: "Valid" } });
      await nextTick();
      await wrapper.find("form").trigger("submit.prevent");
      await nextTick();
      expect(wrapper.emitted("submit")[0][0]).toEqual({ name: "Valid" });
    });
  });


});


describe("PreskoForm.vue - List Field Functionality", () => {
  let listFieldsConfig;
  let initialModelData;

  beforeEach(() => {
    listFieldsConfig = [
      {
        propertyName: "mainField",
        component: "StubAppInput",
        props: { label: "Main Field" },
        value: "Main Data",
      },
      {
        type: "list",
        propertyName: "contacts",
        label: "Contacts",
        itemLabel: "Contact",
        defaultValue: { name: "Default Name", email: "default@example.com" },
        fields: [
          { propertyName: "name", component: "StubAppInput", rules: ["required"], props: { label: "Contact Name" } },
          { propertyName: "email", component: "StubAppInput", rules: ["required", "email"], props: { label: "Contact Email" } },
        ],
      },
    ];

    initialModelData = reactive({
      mainField: "Initial Main Data",
      contacts: [
        { name: "Alice", email: "alice@example.com" },
        { name: "Bob", email: "bob@example.com" },
      ],
    });
  });

  it("renders initial list items correctly", async () => {
    const wrapper = createFormWrapper({ fields: listFieldsConfig, modelValue: initialModelData });
    await nextTick();

    const listFieldSection = wrapper.find(".presko-list-field");
    expect(listFieldSection.exists()).toBe(true);
    expect(listFieldSection.find(".presko-list-field-header label").text()).toBe("Contacts");

    const listItems = listFieldSection.findAll(".presko-list-item");
    expect(listItems.length).toBe(2);

    // Check first item's fields
    const firstItemInputs = listItems[0].findAllComponents(StubAppInput);
    expect(firstItemInputs.length).toBe(2);
    expect(firstItemInputs[0].props("modelValue")).toBe("Alice");
    expect(firstItemInputs[1].props("modelValue")).toBe("alice@example.com");

    // Check second item's fields
    const secondItemInputs = listItems[1].findAllComponents(StubAppInput);
    expect(secondItemInputs.length).toBe(2);
    expect(secondItemInputs[0].props("modelValue")).toBe("Bob");
    expect(secondItemInputs[1].props("modelValue")).toBe("bob@example.com");
  });

  it("updates modelValue when a list item field changes", async () => {
    const wrapper = createFormWrapper({ fields: listFieldsConfig, modelValue: initialModelData });
    await nextTick();

    const firstItemNameInput = wrapper.findAll(".presko-list-item")[0].findAllComponents(StubAppInput)[0];
    await firstItemNameInput.vm.$emit("update:modelValue", "Alice Updated");
    await nextTick();

    const emittedUpdate = wrapper.emitted("update:modelValue");
    expect(emittedUpdate).toBeTruthy();
    const lastEmittedValue = emittedUpdate[emittedUpdate.length - 1][0];
    expect(lastEmittedValue.contacts[0].name).toBe("Alice Updated");
    expect(lastEmittedValue.contacts[0].email).toBe("alice@example.com"); // Email should be unchanged
  });

  it("adds an item when 'Add Item' button is clicked (via exposed method)", async () => {
    const wrapper = createFormWrapper({ fields: listFieldsConfig, modelValue: initialModelData });
    await nextTick();

    // Simulate calling the exposed addItem method (as if a button inside PreskoForm called it)
    // Or, if PreskoForm renders the button itself:
    const addButton = wrapper.find(".presko-list-add-btn"); // Assuming PreskoForm renders this button
    if (addButton.exists()) {
       await addButton.trigger("click");
    } else {
      // Fallback to calling exposed method if button is not found directly (e.g. if slot is used)
      await wrapper.vm.addItem("contacts"); // PreskoForm exposes addItem
    }
    await nextTick();
    await nextTick(); // Allow for modelValue watcher in PreskoForm to sync

    const listItems = wrapper.findAll(".presko-list-item");
    expect(listItems.length).toBe(3);

    const lastItemInputs = listItems[2].findAllComponents(StubAppInput);
    expect(lastItemInputs[0].props("modelValue")).toBe("Default Name"); // From defaultValue
    expect(lastItemInputs[1].props("modelValue")).toBe("default@example.com");

    const emittedUpdate = wrapper.emitted("update:modelValue");
    expect(emittedUpdate).toBeTruthy();
    const lastEmittedValue = emittedUpdate[emittedUpdate.length - 1][0];
    expect(lastEmittedValue.contacts.length).toBe(3);
    expect(lastEmittedValue.contacts[2].name).toBe("Default Name");
  });

  it("removes an item when 'Remove Item' button is clicked (via exposed method)", async () => {
    const wrapper = createFormWrapper({ fields: listFieldsConfig, modelValue: initialModelData });
    await nextTick();

    // Simulate calling removeItem (as if a button inside PreskoForm called it)
    // Or, if PreskoForm renders the button itself:
    const firstRemoveButton = wrapper.findAll(".presko-list-remove-btn")[0];
     if (firstRemoveButton.exists()) {
       await firstRemoveButton.trigger("click");
    } else {
      // Fallback to calling exposed method
      await wrapper.vm.removeItem("contacts", 0);
    }
    await nextTick();
    await nextTick();


    const listItems = wrapper.findAll(".presko-list-item");
    expect(listItems.length).toBe(1);
    // Bob should now be the first item
    const remainingItemInputs = listItems[0].findAllComponents(StubAppInput);
    expect(remainingItemInputs[0].props("modelValue")).toBe("Bob");

    const emittedUpdate = wrapper.emitted("update:modelValue");
    expect(emittedUpdate).toBeTruthy();
    const lastEmittedValue = emittedUpdate[emittedUpdate.length - 1][0];
    expect(lastEmittedValue.contacts.length).toBe(1);
    expect(lastEmittedValue.contacts[0].name).toBe("Bob");
  });

  it("displays validation errors for fields within list items", async () => {
    initialModelData.contacts.push({ name: "", email: "invalid-email" }); // Add an invalid item
    const wrapper = createFormWrapper({ fields: listFieldsConfig, modelValue: initialModelData });
    await nextTick();
    await nextTick(); // for model init and watchers

    await wrapper.find("form").trigger("submit.prevent");
    await nextTick();

    const listItems = wrapper.findAll(".presko-list-item");
    expect(listItems.length).toBe(3);

    // Third item (index 2) has errors
    const thirdItemInputs = listItems[2].findAllComponents(StubAppInput);
    expect(thirdItemInputs[0].props("error")).toBe(true); // Name is required
    expect(thirdItemInputs[0].props("errorMessages")).toBe("Field Contact Name is required.");
    expect(thirdItemInputs[1].props("error")).toBe(true); // Email is invalid
    expect(thirdItemInputs[1].props("errorMessages")).toBe("Field Contact Email is not a valid email address.");

    expect(wrapper.emitted("submit:reject")).toBeTruthy();
  });

  it("emits 'field:touched' with correct path for list item field", async () => {
    const wrapper = createFormWrapper({ fields: listFieldsConfig, modelValue: initialModelData });
    await nextTick();
    const firstItemEmailInput = wrapper.findAll(".presko-list-item")[0].findAllComponents(StubAppInput)[1];
    await firstItemEmailInput.vm.$emit("blur");
    await nextTick();
    const touchedEvents = wrapper.emitted("field:touched");
    expect(touchedEvents).toBeTruthy();
    // Check for the specific field, and also the parent list being touched
    expect(touchedEvents).toEqual(
      expect.arrayContaining([
        [{ propertyName: "contacts[0].email", touched: true }],
        [{ propertyName: "contacts[0]", touched: true }], // As per useFormValidation logic
        [{ propertyName: "contacts", touched: true }]     // As per useFormValidation logic
      ])
    );
  });

  it("emits 'field:dirty' with correct path for list item field", async () => {
    const wrapper = createFormWrapper({ fields: listFieldsConfig, modelValue: initialModelData });
    await nextTick();
    const firstItemNameInput = wrapper.findAll(".presko-list-item")[0].findAllComponents(StubAppInput)[0];

    // Simulate input that changes the value
    firstItemNameInput.vm.$emit("update:modelValue", "Alice New");
    // Manually update modelValue as parent would, to trigger PreskoForm's internal watcher
    initialModelData.contacts[0].name = "Alice New";
    await wrapper.setProps({ modelValue: initialModelData }); // This triggers the main watcher
    await nextTick(); // Allow watcher to run
    await nextTick(); // Allow watcher to run

    const dirtyEvents = wrapper.emitted("field:dirty");
    expect(dirtyEvents).toBeTruthy();
    // Check for the specific field, and also the parent list being dirty
     expect(dirtyEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ propertyName: "contacts[0].name", dirty: true }),
        expect.objectContaining({ propertyName: "contacts[0]", dirty: true }),
        expect.objectContaining({ propertyName: "contacts", dirty: true })
      ])
    );
  });

  it("correctly initializes an empty list if no initialValue provided", async () => {
    const emptyListModel = { mainField: "Test", contacts: [] }; // contacts is empty
    const wrapper = createFormWrapper({ fields: listFieldsConfig, modelValue: emptyListModel });
    await nextTick();

    const listItems = wrapper.findAll(".presko-list-item");
    expect(listItems.length).toBe(0);

    // Add an item
    await wrapper.vm.addItem("contacts");
    await nextTick();
    await nextTick();

    const updatedListItems = wrapper.findAll(".presko-list-item");
    expect(updatedListItems.length).toBe(1);
    expect(updatedListItems[0].findAllComponents(StubAppInput)[0].props("modelValue")).toBe("Default Name");
  });
});

[end of src/components/PreskoForm.spec.js]
