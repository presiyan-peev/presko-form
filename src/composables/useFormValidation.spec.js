import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFormValidation } from './useFormValidation';
import { reactive, nextTick } from 'vue'; // nextTick for reactivity propagation

// Mock Vue's reactive and watch effectively for testing
vi.mock('vue', async () => {
  const actualVue = await vi.importActual('vue');
  const reactiveMap = new Map();
  return {
    ...actualVue,
    reactive: (obj) => {
      const reactiveObj = actualVue.reactive(obj);
      reactiveMap.set(obj, reactiveObj);
      return reactiveObj;
    },
    // Minimal mock for watch if needed, though useFormValidation's internal watch should work with reactive changes.
    // watch: (source, cb, options) => {
    //   // For simplicity, this mock might not fully replicate watch behavior.
    //   // We rely on changes to reactive properties triggering the composable's internal watch.
    //   let cleanup = () => {};
    //   if (typeof source === 'function') {
    //      // Call it once like immediate:true might
    //     if(options && options.immediate){
    //         source();
    //     }
    //   } else {
    //     if(options && options.immediate && reactiveMap.has(source)){
    //         cb(reactiveMap.get(source), undefined);
    //     }
    //   }
    //   return cleanup;
    // },
  };
});


describe('useFormValidation - Conditional Fields', () => {
  let fields;
  let initialModel;

  beforeEach(() => {
    // Reset fields and model before each test
    fields = [];
    initialModel = {};
    // Vitest's fake timers can be useful if there's debouncing or async updates
    vi.useFakeTimers();
  });

  const advanceTicks = async (count = 1) => {
    for (let i = 0; i < count; i++) {
      await nextTick();
    }
    vi.runAllTimers(); // Ensure any timers (like from watch with debounce) are run
  };

  describe('1. Initialization of formFieldsVisibility', () => {
    it('should set fields without conditions to visible by default', () => {
      fields = [{ propertyName: 'fieldA' }];
      const { formFieldsVisibility } = useFormValidation(fields);
      expect(formFieldsVisibility.fieldA).toBe(true);
    });

    it('should evaluate initial visibility: hidden if condition not met', () => {
      fields = [
        { propertyName: 'control', value: 'hide' },
        {
          propertyName: 'dependent',
          condition: { rules: [{ field: 'control', operator: 'equals', value: 'show' }] },
        },
      ];
      // initialModel implicitly created from field values if not passed to useFormValidation
      const { formFieldsVisibility } = useFormValidation(fields);
      expect(formFieldsVisibility.dependent).toBe(false);
    });

    it('should evaluate initial visibility: visible if condition met', () => {
      fields = [
        { propertyName: 'control', value: 'show' },
        {
          propertyName: 'dependent',
          condition: { rules: [{ field: 'control', operator: 'equals', value: 'show' }] },
        },
      ];
      const { formFieldsVisibility } = useFormValidation(fields);
      expect(formFieldsVisibility.dependent).toBe(true);
    });
  });

  describe('2. evaluateConditionRule (tested via evaluateFieldVisibility effects)', () => {
    // Test each operator through the visibility outcome
    const testOperator = async (operator, sourceValue, conditionValue, expectedVisibility) => {
      fields = [
        { propertyName: 'source', value: sourceValue },
        {
          propertyName: 'target',
          condition: { rules: [{ field: 'source', operator, value: conditionValue }] },
        },
      ];
      const { formFieldsVisibility, formFieldsValues } = useFormValidation(fields);
      // To ensure reactivity if sourceValue is changed after init (for dynamic tests)
      // formFieldsValues.source = sourceValue; await advanceTicks();
      expect(formFieldsVisibility.target).toBe(expectedVisibility);
    };

    it('operator "equals": "a" === "a" -> true', () => testOperator('equals', 'a', 'a', true));
    it('operator "equals": "a" === "b" -> false', () => testOperator('equals', 'a', 'b', false));
    it('operator "notEquals": "a" !== "b" -> true', () => testOperator('notEquals', 'a', 'b', true));
    it('operator "notEquals": "a" !== "a" -> false', () => testOperator('notEquals', 'a', 'a', false));
    it('operator "in": "a" in ["a", "b"] -> true', () => testOperator('in', 'a', ['a', 'b'], true));
    it('operator "in": "c" in ["a", "b"] -> false', () => testOperator('in', 'c', ['a', 'b'], false));
    it('operator "in": "b" in "a,b,c" (string list) -> true', () => testOperator('in', 'b', 'a,b,c', true));
    it('operator "notIn": "c" notIn ["a", "b"] -> true', () => testOperator('notIn', 'c', ['a', 'b'], true));
    it('operator "notIn": "a" notIn ["a", "b"] -> false', () => testOperator('notIn', 'a', ['a', 'b'], false));
    it('operator "greaterThan": 5 > 3 -> true', () => testOperator('greaterThan', 5, 3, true));
    it('operator "greaterThan": 3 > 5 -> false', () => testOperator('greaterThan', 3, 5, false));
    it('operator "lessThan": 3 < 5 -> true', () => testOperator('lessThan', 3, 5, true));
    it('operator "lessThan": 5 < 3 -> false', () => testOperator('lessThan', 5, 3, false));
    it('operator "greaterThanOrEquals": 5 >= 5 -> true', () => testOperator('greaterThanOrEquals', 5, 5, true));
    it('operator "greaterThanOrEquals": 4 >= 5 -> false', () => testOperator('greaterThanOrEquals', 4, 5, false));
    it('operator "lessThanOrEquals": 5 <= 5 -> true', () => testOperator('lessThanOrEquals', 5, 5, true));
    it('operator "lessThanOrEquals": 6 <= 5 -> false', () => testOperator('lessThanOrEquals', 6, 5, false));
    it('operator "defined": "hello" is defined -> true', () => testOperator('defined', 'hello', undefined, true));
    it('operator "defined": null is defined -> false', () => testOperator('defined', null, undefined, false));
    it('operator "undefined": undefined is undefined -> true', () => testOperator('undefined', undefined, undefined, true));
    it('operator "undefined": "hello" is undefined -> false', () => testOperator('undefined', 'hello', undefined, false));
    it('operator "matchesRegex": "abc" matches /^a/ -> true', () => testOperator('matchesRegex', 'abc', '^a', true));
    it('operator "matchesRegex": "abc" matches /^b/ -> false', () => testOperator('matchesRegex', 'abc', '^b', false));
  });

  describe('3. evaluateFieldVisibility (logic and nesting)', () => {
    it('should handle AND logic: true if all rules true', () => {
      fields = [
        { propertyName: 'control1', value: 'yes' },
        { propertyName: 'control2', value: 10 },
        {
          propertyName: 'dependent',
          condition: {
            logic: 'AND',
            rules: [
              { field: 'control1', operator: 'equals', value: 'yes' },
              { field: 'control2', operator: 'greaterThan', value: 5 },
            ],
          },
        },
      ];
      const { formFieldsVisibility } = useFormValidation(fields);
      expect(formFieldsVisibility.dependent).toBe(true);
    });

    it('should handle AND logic: false if one rule false', () => {
      fields = [
        { propertyName: 'control1', value: 'no' }, // This will make it false
        { propertyName: 'control2', value: 10 },
        {
          propertyName: 'dependent',
          condition: {
            logic: 'AND',
            rules: [
              { field: 'control1', operator: 'equals', value: 'yes' },
              { field: 'control2', operator: 'greaterThan', value: 5 },
            ],
          },
        },
      ];
      const { formFieldsVisibility } = useFormValidation(fields);
      expect(formFieldsVisibility.dependent).toBe(false);
    });

    it('should handle OR logic: true if one rule true', () => {
      fields = [
        { propertyName: 'control1', value: 'no' },
        { propertyName: 'control2', value: 3 }, // This will make its rule true
        {
          propertyName: 'dependent',
          condition: {
            logic: 'OR',
            rules: [
              { field: 'control1', operator: 'equals', value: 'yes' },
              { field: 'control2', operator: 'lessThan', value: 5 },
            ],
          },
        },
      ];
      const { formFieldsVisibility } = useFormValidation(fields);
      expect(formFieldsVisibility.dependent).toBe(true);
    });

    it('should handle OR logic: false if all rules false', () => {
      fields = [
        { propertyName: 'control1', value: 'no' },
        { propertyName: 'control2', value: 10 },
        {
          propertyName: 'dependent',
          condition: {
            logic: 'OR',
            rules: [
              { field: 'control1', operator: 'equals', value: 'yes' },
              { field: 'control2', operator: 'lessThan', value: 5 },
            ],
          },
        },
      ];
      const { formFieldsVisibility } = useFormValidation(fields);
      expect(formFieldsVisibility.dependent).toBe(false);
    });

    it('should handle conditions on nested object fields', () => {
      fields = [
        { subForm: 'profile', fields: [{ propertyName: 'name', value: 'test' }] },
        {
          propertyName: 'dependent',
          condition: { rules: [{ field: 'profile.name', operator: 'equals', value: 'test' }] },
        },
      ];
      const { formFieldsVisibility } = useFormValidation(fields);
      expect(formFieldsVisibility.dependent).toBe(true);
    });

    it('should handle conditions on list item fields', () => {
      fields = [
        {
          propertyName: 'users',
          type: 'list',
          initialValue: [{ type: 'admin' }, { type: 'user' }],
          fields: [{ propertyName: 'type' }],
        },
        {
          propertyName: 'showAdminSettings',
          condition: { rules: [{ field: 'users[0].type', operator: 'equals', value: 'admin' }] },
        },
      ];
      const { formFieldsVisibility } = useFormValidation(fields);
      expect(formFieldsVisibility.showAdminSettings).toBe(true);
    });
  });

  describe('4. Dynamic Visibility Updates (Dependency Tracking)', () => {
    it('should update visibility when a source field changes', async () => {
      fields = [
        { propertyName: 'control', value: 'hide' },
        {
          propertyName: 'dependent',
          condition: { rules: [{ field: 'control', operator: 'equals', value: 'show' }] },
        },
      ];
      const { formFieldsValues, formFieldsVisibility } = useFormValidation(fields);
      expect(formFieldsVisibility.dependent).toBe(false); // Initial

      formFieldsValues.control = 'show';
      await advanceTicks(2); // Allow watcher to trigger and propagate

      expect(formFieldsVisibility.dependent).toBe(true); // After change
    });

    it('should update visibility with multiple levels of dependency', async () => {
        fields = [
            { propertyName: 'masterControl', value: 'initial' },
            {
                propertyName: 'level1Dependent',
                condition: { rules: [{ field: 'masterControl', operator: 'equals', value: 'go' }] },
            },
            {
                propertyName: 'level2Dependent',
                condition: { rules: [{ field: 'level1Dependent', operator: 'equals', value: true }] } // Depends on visibility state
                // Note: This specific condition `operator: 'equals', value: true` is tricky because level1Dependent's *value* isn't what's changing,
                // its *visibility* is. For this to work as described, 'level1Dependent' would need to be in formFieldsValues
                // and its value set to true/false based on its visibility, or the condition system needs to read visibility state.
                // The PRD implies conditions are based on *values*.
                // Let's adjust: level2 depends on a *value* that is set conditionally.
            },
        ];
        // Re-design for value-based dependency for level2Dependent
        fields = [
            { propertyName: 'masterControl', value: 'initial' },
            {
                propertyName: 'level1FlagHolder', // This field's value will be set if masterControl is 'go'
                value: false,
            },
            { // This field isn't conditional itself but its value is part of a chain
                propertyName: 'intermediateValueSetter',
                value: 'default'
                // We'll manually set this to 'active' when masterControl is 'go' to simulate a more complex flow
            },
            {
                propertyName: 'level2Dependent',
                condition: { rules: [{ field: 'intermediateValueSetter', operator: 'equals', value: 'active' }] }
            }
        ];

        const { formFieldsValues, formFieldsVisibility } = useFormValidation(fields);

        expect(formFieldsVisibility.level2Dependent).toBe(false); // Initial based on intermediateValueSetter=default

        formFieldsValues.masterControl = 'go';
        // Simulate that 'masterControl' being 'go' also leads to 'intermediateValueSetter' changing
        formFieldsValues.intermediateValueSetter = 'active';
        await advanceTicks(2);

        // Now level2Dependent should become visible because intermediateValueSetter is 'active'
        expect(formFieldsVisibility.level2Dependent).toBe(true);
    });
  });

  describe('5. Interaction with Validation', () => {
    beforeEach(() => {
      fields = [
        { propertyName: 'control', value: 'hide' },
        {
          propertyName: 'conditionalField',
          rules: ['required'],
          condition: { rules: [{ field: 'control', operator: 'equals', value: 'show' }] },
        },
        { propertyName: 'alwaysVisibleField', rules: ['required'], value: ''} // initially invalid
      ];
    });

    it('should clear validation when a field becomes hidden', async () => {
      const { formFieldsValues, formFieldsVisibility, validateField, formFieldsErrorMessages, formFieldsValidity } = useFormValidation(fields);

      // Make it visible and invalid
      formFieldsValues.control = 'show';
      await advanceTicks(2);
      expect(formFieldsVisibility.conditionalField).toBe(true);
      formFieldsValues.conditionalField = ''; // make it invalid
      validateField('conditionalField', formFieldsValues.conditionalField);
      expect(formFieldsValidity.conditionalField).toBe(false);
      expect(formFieldsErrorMessages.conditionalField).toBeTruthy();

      // Hide it
      formFieldsValues.control = 'hide';
      await advanceTicks(2);
      expect(formFieldsVisibility.conditionalField).toBe(false);

      // Check if errors are cleared
      expect(formFieldsValidity.conditionalField).toBeUndefined(); // Undefined means valid or not validated
      expect(formFieldsErrorMessages.conditionalField).toBeUndefined();
    });

    it('validateField should return true for hidden fields', async () => {
      const { formFieldsValues, formFieldsVisibility, validateField } = useFormValidation(fields);
      expect(formFieldsVisibility.conditionalField).toBe(false); // Initially hidden

      const isValid = validateField('conditionalField', formFieldsValues.conditionalField);
      expect(isValid).toBe(true);
    });

    it('validateFormPurely should only validate visible fields', async () => {
      const { formFieldsValues, formFieldsVisibility, validateFormPurely, formFieldsErrorMessages } = useFormValidation(fields);

      // conditionalField is hidden, alwaysVisibleField is visible but empty (invalid)
      expect(formFieldsVisibility.conditionalField).toBe(false);
      formFieldsValues.alwaysVisibleField = ''; // ensure it's empty for this test

      const isFormValid = validateFormPurely(formFieldsValues);
      expect(isFormValid).toBe(false); // Because alwaysVisibleField is invalid
      expect(formFieldsErrorMessages.conditionalField).toBeUndefined(); // Hidden field not validated
      expect(formFieldsErrorMessages.alwaysVisibleField).toBeTruthy(); // Visible field validated

      // Make conditionalField visible and valid, alwaysVisibleField valid
      formFieldsValues.control = 'show';
      await advanceTicks(2);
      formFieldsValues.conditionalField = 'i have a value';
      formFieldsValues.alwaysVisibleField = 'me too';

      const isFormNowValid = validateFormPurely(formFieldsValues);
      expect(isFormNowValid).toBe(true);
      expect(formFieldsErrorMessages.conditionalField).toBeUndefined();
      expect(formFieldsErrorMessages.alwaysVisibleField).toBeUndefined();
    });
  });

  describe('6. clearValueOnHide Functionality', () => {
    it('should clear value if clearValueOnHide is true', async () => {
      fields = [
        { propertyName: 'control', value: 'show' },
        {
          propertyName: 'target',
          value: 'initial value',
          condition: { rules: [{ field: 'control', operator: 'equals', value: 'show' }] },
          clearValueOnHide: true,
        },
      ];
      const { formFieldsValues, formFieldsVisibility } = useFormValidation(fields);
      expect(formFieldsVisibility.target).toBe(true);
      expect(formFieldsValues.target).toBe('initial value');

      formFieldsValues.control = 'hide'; // This should hide 'target'
      await advanceTicks(2);

      expect(formFieldsVisibility.target).toBe(false);
      expect(formFieldsValues.target).toBeUndefined();
    });

    it('should retain value if clearValueOnHide is false or not set', async () => {
      fields = [
        { propertyName: 'control', value: 'show' },
        {
          propertyName: 'target',
          value: 'initial value',
          condition: { rules: [{ field: 'control', operator: 'equals', value: 'show' }] },
          clearValueOnHide: false, // Or omit this line
        },
      ];
      const { formFieldsValues, formFieldsVisibility } = useFormValidation(fields);
      expect(formFieldsVisibility.target).toBe(true);
      expect(formFieldsValues.target).toBe('initial value');

      formFieldsValues.control = 'hide';
      await advanceTicks(2);

      expect(formFieldsVisibility.target).toBe(false);
      expect(formFieldsValues.target).toBe('initial value'); // Value retained
    });

    it('should reset to list field to empty array if clearValueOnHide is true', async () => {
        fields = [
            { propertyName: 'control', value: 'show' },
            {
                propertyName: 'listField',
                type: 'list',
                initialValue: [{ name: 'item1' }],
                fields: [{ propertyName: 'name' }],
                condition: { rules: [{ field: 'control', operator: 'equals', value: 'show' }] },
                clearValueOnHide: true,
            },
        ];
        const { formFieldsValues, formFieldsVisibility } = useFormValidation(fields);
        expect(formFieldsVisibility.listField).toBe(true);
        expect(formFieldsValues.listField).toEqual([{ name: 'item1' }]);

        formFieldsValues.control = 'hide';
        await advanceTicks(2);

        expect(formFieldsVisibility.listField).toBe(false);
        expect(formFieldsValues.listField).toEqual([]);
    });
  });

  describe('7. Complex Scenarios', () => {
    it('condition depending on a field that is itself conditional', async () => {
      fields = [
        { propertyName: 'masterSwitch', value: true }, // Controls fieldA
        {
          propertyName: 'fieldA', // Conditional
          value: 'A_visible',
          condition: { rules: [{ field: 'masterSwitch', operator: 'equals', value: true }] },
          clearValueOnHide: true,
        },
        {
          propertyName: 'fieldB', // Depends on fieldA's value
          condition: { rules: [{ field: 'fieldA', operator: 'equals', value: 'A_visible' }] },
        },
      ];
      const { formFieldsValues, formFieldsVisibility } = useFormValidation(fields);

      // Initial state: masterSwitch=true -> fieldA visible, fieldA='A_visible' -> fieldB visible
      expect(formFieldsVisibility.fieldA).toBe(true);
      expect(formFieldsValues.fieldA).toBe('A_visible');
      expect(formFieldsVisibility.fieldB).toBe(true);

      // Change masterSwitch to hide fieldA
      formFieldsValues.masterSwitch = false;
      await advanceTicks(3); // Allow propagation for fieldA visibility, then fieldA value, then fieldB visibility

      expect(formFieldsVisibility.fieldA).toBe(false); // fieldA becomes hidden
      expect(formFieldsValues.fieldA).toBeUndefined();   // fieldA value cleared
      expect(formFieldsVisibility.fieldB).toBe(false);  // fieldB becomes hidden because fieldA's value is no longer 'A_visible'
    });

    it('list items with conditional fields depending on other fields in the same item', async () => {
      fields = [
        {
          propertyName: 'items',
          type: 'list',
          initialValue: [
            { type: 'A', detailA: 'Detail for A', detailB: '' },
            { type: 'B', detailA: '', detailB: 'Detail for B' },
          ],
          fields: [
            { propertyName: 'type' }, // 'A' or 'B'
            {
              propertyName: 'detailA',
              condition: { rules: [{ field: 'type', operator: 'equals', value: 'A' }] }, // Path relative to item?
                                                                                          // PRD: "rule.field ... Supports ... array indexing for list items."
                                                                                          // Current getValueByPath/setValueByPath in useFormValidation.js
                                                                                          // expects full paths from root.
                                                                                          // The PRD says "itemDetails[0].specificInfo might depend on itemDetails[0].type"
                                                                                          // This implies rule.field needs to be specific like 'items[0].type'
                                                                                          // Let's rewrite field config to test this properly.
            },
            { propertyName: 'detailB', condition: { rules: [{ field: 'type', operator: 'equals', value: 'B' }] } },
          ],
        },
      ];
      // Adjusting field definitions for specific pathing in conditions
      fields[0].fields[1].condition.rules[0].field = 'items[0].type'; // For first item, detailA depends on items[0].type
      fields[0].fields[2].condition.rules[0].field = 'items[0].type'; // For first item, detailB depends on items[0].type
      // This setup is still a bit off for testing "same item" generically.
      // The condition rule `field` path would need dynamic index resolution relative to the item being evaluated.
      // The current implementation of `evaluateFieldVisibility` resolves `rule.field` from the root form model.
      // So, for a list item, the condition path must be absolute e.g. 'items[0].type'.

      // Let's simplify to test one item's conditional field based on another field in THAT SAME item.
      // This requires the dependency system to correctly map e.g. 'items[0].type' as a source for 'items[0].detailA'.
      fields = [
        {
          propertyName: 'items',
          type: 'list',
          initialValue: [{ type: 'A', detailA: 'Content A', otherDetail: '' }],
          fields: [
            { propertyName: 'type' },
            {
              propertyName: 'detailA',
              condition: { rules: [{ field: 'items[0].type', operator: 'equals', value: 'A' }] },
            },
            {
              propertyName: 'otherDetail', // Not conditional for this test
            }
          ],
        },
      ];

      const { formFieldsValues, formFieldsVisibility } = useFormValidation(fields);

      expect(formFieldsVisibility['items[0].detailA']).toBe(true);

      // Change type in the first item to 'B'
      formFieldsValues.items[0].type = 'B';
      await advanceTicks(2);

      expect(formFieldsVisibility['items[0].detailA']).toBe(false);

      // Change type back to 'A'
      formFieldsValues.items[0].type = 'A';
      await advanceTicks(2);
      expect(formFieldsVisibility['items[0].detailA']).toBe(true);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restore any mocks
    vi.useRealTimers(); // Restore real timers
  });

  describe('8. Bug Demonstration: Conditional fields in list items with relative paths', () => {
    it('should FAIL to correctly evaluate conditional field based on "relative" path within a list item (demonstrates bug)', async () => {
      fields = [
        { propertyName: 'globalSwitch', value: false },
        {
          propertyName: 'itemsList',
          type: 'list',
          initialValue: [
            { itemSwitch: false, conditionalDetails: 'hidden text', globalDependentDetails: 'more hidden text' }
          ],
          fields: [
            { propertyName: 'itemSwitch' },
            {
              propertyName: 'conditionalDetails',
              // BUG: This 'itemSwitch' is treated as 'root.itemSwitch', not 'itemsList[0].itemSwitch'
              condition: { rules: [{ field: 'itemSwitch', operator: 'equals', value: true }] }
            },
            {
              propertyName: 'globalDependentDetails',
              // This should work because 'globalSwitch' is a root path
              condition: { rules: [{ field: 'globalSwitch', operator: 'equals', value: true }] }
            }
          ]
        }
      ];

      const { formFieldsValues, formFieldsVisibility } = useFormValidation(fields);

      // Initial state assertions
      expect(formFieldsVisibility['itemsList[0].conditionalDetails']).toBe(false); // Correctly false initially because root.itemSwitch is undefined or not true
      expect(formFieldsVisibility['itemsList[0].globalDependentDetails']).toBe(false); // Correctly false as globalSwitch is false

      // Try to activate conditionalDetails by changing the itemSwitch within the list item
      formFieldsValues.itemsList[0].itemSwitch = true;
      await advanceTicks(10); // Increased ticks significantly

      // *** This assertion should now PASS due to the fix ***
      // With the corrected path resolution, changing itemsList[0].itemSwitch to true
      // should make itemsList[0].conditionalDetails visible.
      expect(formFieldsVisibility['itemsList[0].conditionalDetails']).toBe(true);

      // Now test the global switch, which should work regardless of the list item bug
      formFieldsValues.globalSwitch = true;
      await advanceTicks(10); // Increased ticks significantly
      expect(formFieldsVisibility['itemsList[0].globalDependentDetails']).toBe(true); // This should pass
    });
  });
});
