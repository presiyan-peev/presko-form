# PRD: Asynchronous & Cross-Field Validation for PreskoForm

## 1 · Overview

Add first-class support for asynchronous and cross-field validation rules in PreskoForm so freelance and indie developers can implement use-cases like "is email taken?" or "passwords must match" without extra boilerplate. The feature introduces a Promise-aware validation pipeline, pending state flags, and accessible busy indicators.

## 2 · Problem Statement

Current validators must return synchronously; when a developer passes an `async` function it returns a Promise, which PreskoForm immediately treats as a failure. Users cannot perform server or multi-field checks, limiting adoption on real projects.

## 3 · Goals

1. Allow validators to be synchronous **or** return `Promise<true | string | string[]>`.
2. Expose `isPending` at field and form level so UI can show spinners / disable submit.
3. Avoid race conditions (latest value wins) and support abortable calls.
4. Remain headless, framework-agnostic, and keep bundle growth < 1 kB gzip.

## 4 · Non-Goals

• Building a full schema Validation DSL.  
• Providing network retry/back-off utilities.

## 5 · Target Users

Freelance/indie developers building SPA or SSR apps with Vue 3 who need lightweight but powerful form validation.

## 6 · User Stories

US-1 As a dev, I can write `async (value) => await api.checkEmail(value)` in `validators` and PreskoForm shows "Email already taken" only when the Promise resolves.

US-2 As a dev, I see a loading spinner on an input while async validation is in progress and the submit button is disabled when **any** field is pending.

US-3 As a dev, cross-field rules like `{validator: match("password", "confirm")}` run and update both fields' validity.

## 7 · Functional Requirements

F-1 Validator Signature `(value, label, field, ctx) => true | string | Promise<true|string>`  
F-2 Pipeline Run sync rules → start async validators → mark `isPending=true` → when resolved, update validity; ignore if value changed meanwhile.
F-3 Flags `formFieldsPendingState[fieldPath]`, computed `isFormPending`.
F-4 Events Emit `field:pending { propertyName, pending }` when status flips.
F-5 Aborts Expose `ctx.abortSignal` to validator; cancel when value changes or form unmounts.
F-6 Debounce Respect existing `inputDebounceMs` before firing async calls.
F-7 Cross-Field Helpers Provide helper `dependsOn("password")` to read sibling value.
F-8 Accessibility While `pending`, set `aria-busy="true"` on the input element (via PreskoFormItem default prop mapping).
F-9 Localization Error strings still flow through existing translation hook.

## 8 · Non-Functional Requirements

• Concurrency: handle rapid input changes without leaking promises.  
• Performance: extra runtime < 0.2 ms per validation on mid-range laptop.  
• Bundle size increase ≤ 1 kB gzip.

## 9 · API Changes (Draft)

```ts
// field config
{
  propertyName: "email",
  validators: [
    async (val, _label, _field, ctx) => {
      const res = await ctx.fetch(`/api/email?e=${val}`);
      return res.ok ? true : "Email already taken";
    },
  ],
}

// new context passed to validators
interface ValidationCtx {
  /* other utilities */
  abortSignal: AbortSignal;
  fetch: typeof fetch; // convenience wrapper
  getValue(path: string): any; // for cross-field
}
```

## 10 · Success Metrics

• ≥ 90 % of beta testers report that async validation "works out-of-the-box".  
• No open bugs about race-conditions one month after release.  
• Bundle size delta verified ≤ 1 kB gzip.

## 11 · Timeline & Milestones

1 Design review +1 day  
2 Spike & unit tests +3 days  
3 Implementation +5 days  
4 Docs & examples +1 day  
5 Public beta +?

## 12 · Risks & Mitigations

| Risk            | Impact                              | Mitigation                                            |
| --------------- | ----------------------------------- | ----------------------------------------------------- |
| Race conditions | Wrong error shows after fast typing | Track `validationRunId` per field; apply only latest. |
| Memory leaks    | Uncollected promises on unmount     | Abort controllers cleared in `onBeforeUnmount`.       |
| DX complexity   | Devs confused by pending state      | Provide high-level `useFormStatus()` helper & docs.   |

## 13 · Open Questions

1. Naming: `isPending` vs `isValidating`?
2. Do we expose `field:pending` event or just rely on reactive prop mapping?
