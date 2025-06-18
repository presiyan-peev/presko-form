# PRD: Enhanced Form-State (Touched / Dirty / Pending & Snapshots) for PreskoForm

## 1 · Overview

Introduce an explicit state-tracking layer that exposes _field-level_ and _form-level_ flags such as `isTouched`, `isDirty`, `isPending`, and aggregates like `isFormDirty` and `dirtyFields`. Provide events, helper APIs, and reset/revert utilities so developers can easily build Save-buttons, inline warnings, and "unsaved changes" guards without wiring Redux or Vuex.

## 2 · Problem Statement

PreskoForm already emits `field:touched` and `field:dirty` events, but developers still need to memoise the states, derive form-level summaries, and reset them manually after a successful submit. A first-class API will lower cognitive load and promote consistent UX across projects.

## 3 · Goals

1. Surface reactive flags on both field and form scopes (`isTouched`, `isDirty`, `isPending`).
2. Provide aggregate selectors (`isFormDirty`, `dirtyFields`, `isFormPending`, etc.).
3. Offer convenience methods `resetTouched()`, `resetDirty()`, `resetAll()`, and `revertChanges()` (restore initial snapshot).
4. Make it easy to subscribe to state changes via events _and_ a `useFormStatus()` composable.
5. Keep implementation framework-agnostic and add ≤1.5 kB gzip.

## 4 · Non-Goals

• Persisting state to LocalStorage / session.  
• Building history/undo stacks beyond single "revert to initial".

## 5 · Target Users

Freelancers and indie devs who want a drop-in headless form engine yet need production-grade UX (disable Save until dirty, show unsaved banner on route-leave, etc.).

## 6 · User Stories

US-1 As a dev I can write:

```vue
<template>
  <PreskoForm ref="form" v-model="data" :fields="fields" />
  <button :disabled="!formStatus.isFormDirty">Save</button>
</template>
<script setup>
import { useFormStatus } from "presko-form";
const form = ref();
const formStatus = useFormStatus(form);
</script>
```

and the Save button is only enabled when _any_ field changed.

US-2 When a user focuses → blurs a field it becomes `isTouched=true`; if they reset the form we can call `resetTouched()` and flags clear automatically.

US-3 When async validation is running the field shows a spinner because `isPending=true` and the global submit button is disabled while `isFormPending` is true.

## 7 · Functional Requirements

F-1 Reactive Stores  
 • `formFieldsTouchedState[path] : boolean`  
 • `formFieldsDirtyState[path]   : boolean`  
 • `formFieldsPendingState[path] : boolean` (ties into async-validation PRD).  
F-2 Aggregates `isFormTouched`, `isFormDirty`, `isFormPending`, `dirtyFields[]`, `touchedFields[]`.  
F-3 Events Emit when any flag flips:  
 • `field:touched { propertyName, touched }`  
 • `field:dirty   { propertyName, dirty   }`  
 • `field:pending { propertyName, pending }`  
 • `form:state    { dirty, touched, pending }` (debounced).  
F-4 Helpers  
 • `resetTouched()` – set all touched flags to false.  
 • `resetDirty()` – set all dirty flags to false & update baselines to current values.  
 • `revertChanges()` – restore all fields to initial snapshot.  
 • `getState()` – return immutable snapshot (useful for route-guards).
F-5 Composable `useFormStatus(formRef, { debounce?: number })` returns reactive aggregates and helpers.
F-6 JSDoc Provide comprehensive JSDoc documentation with type annotations for all functions and objects.
F-7 Documentation Cookbook section "Unsaved changes banner", "Disable Save until dirty".

## 8 · Non-Functional Requirements

• Extra CPU cost <0.2 ms per dirty-check on mid-range laptop.  
• Bundle growth ≤1.5 kB gzip.  
• 100 % unit test coverage for helpers.

## 9 · API Changes (Draft)

```js
// inside useFormValidation return value (breaking change minor)
{
  ...previous,
  formFieldsPendingState,
  resetTouched: () => void,
  resetDirty:   () => void,
  revertChanges:() => void,
  getState:     () => FormStateSnapshot,
}

// useFormStatus composable
const status = useFormStatus(formRef);
status.isFormDirty; // boolean
status.dirtyFields; // string[]
status.resetDirty();
```

## 10 · Success Metrics

• 90 % beta feedback: "tracking dirty/touched was trivial".  
• At least one community plugin replaces bespoke Vuex store with new helpers.  
• No performance regressions in Lighthouse TTI or JS profile.

## 11 · Timeline & Milestones

1 Design review +1 day  
2 Implementation +4 days  
3 Unit tests +2 days  
4 Docs & examples +1 day  
5 Public beta +?

## 12 · Risks & Mitigations

| Risk                               | Impact              | Mitigation                                          |
| ---------------------------------- | ------------------- | --------------------------------------------------- |
| Deep clone cost on large forms     | Freeze UI on revert | Use incremental diff + JSON cloning gate on size.   |
| Flag churn causes re-renders       | Perf regression     | Memoise selectors, expose computed refs.            |
| API confusion with existing events | DX friction         | Deprecate old events in docs but keep them working. |

## 13 · Open Questions

1. Should `resetDirty()` also reset _touched_ by default?
2. Should `getState()` include raw field values or only flags?
