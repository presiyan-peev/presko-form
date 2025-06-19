# PRD: First-Error Focus & Scroll Management for PreskoForm

## 1 · Overview

Provide an opinionated yet customizable mechanism that, upon failed form submission, scrolls to and focuses the first invalid field. Emit metadata so developers with custom scroll containers can implement bespoke behaviour. Feature must be keyboard-, screen-reader-, and mobile-friendly.

## 2 · Problem Statement

Users of long forms get lost when they press _Submit_ and nothing visible happens. Devs have to wire their own `scrollIntoView` logic for every project. PreskoForm should offer a sensible default (out-of-the-box focus & scroll) but stay headless so teams can override.

## 3 · Goals

1. Auto-focus the first visible invalid field on `submit:reject` (default on).
2. Emit the first invalid field's DOM element **and** fieldPath in the `submit:reject` payload.
3. Allow opt-out via prop and full override via callback.
4. Announce an ARIA live-region message so screen-reader users are informed.

## 4 · Non-Goals

• Animating the scroll beyond native behaviour (developers can override).  
• Handling virtualized lists outside the DOM (library can supply the element, consumer deals with virtualization).

## 5 · Target Users

Early adopters: freelancers building dashboards, admin panels, multi-step wizards where lost focus hurts conversion.

## 6 · User Stories

US-1 When a form submit fails, the viewport scrolls so that the first invalid field is centred and focus is placed inside it.  
US-2 As a developer with my own scrollable `<div>`, I can set `scrollToError={(el)=>myScroller.scrollTo({top:el.offsetTop-50})}` while still receiving the error element in `submit:reject`.  
US-3 Screen-reader users hear "Please correct the highlighted field" when focus moves.

## 7 · Functional Requirements

F-1 Prop `autoFocusOnError` _(boolean, default **true**)_ ‑ disable entirely when `false`.  
F-2 Prop `scrollToError` _(function)_ ‑ if supplied, library skips native scroll and calls the callback with `(element, path)`; return `false` to prevent default focus as well.  
F-3 DOM Identification ‑ each `PreskoFormItem` root div gains `data-pk-field="<fieldPath>"` and a `ref`, enabling fast lookup.  
F-4 Default behaviour uses `element.scrollIntoView({behavior:'smooth',block:'center'})` then `element.focus({preventScroll:true})`.  
F-5 Event Payload ‑ `submit:reject` fires `emit('submit:reject', { firstInvalidPath, firstInvalidEl })`.  
F-6 Accessibility ‑ After focusing, emit polite live-region message via hidden div `aria-live="polite"` once per submit. Message is localisable (`errorAnnouncement` prop, default "Please correct the highlighted field").

## 8 · Non-Functional Requirements

• Works in Chrome, Firefox, Safari, Edge, iOS Safari, Android Chrome.  
• Adds ≤ 0.5 kB gzip to bundle.  
• No extra re-renders beyond the single failed-submit cycle.

## 9 · API Changes (Draft)

```vue
<PreskoForm
  v-model="formData"
  :fields="fields"
  autoFocusOnError
  :scrollToError="
    (el, path) => {
      customScroller.scrollTo({ top: el.offsetTop - 80 });
    }
  "
/>
```

## 10 · Success Metrics

• 95 % of testers say "I didn't have to write my own scroll-to-error".  
• Lighthouse a11y score unaffected or improved.  
• No open GH issues about lost focus within one month.

## 11 · Timeline & Milestones

1 Spike & API finalisation +1 day  
2 Implementation +2 days  
3 Unit & e2e tests +2 days  
4 Docs & examples +1 day

## 12 · Risks & Mitigations

| Risk                        | Impact           | Mitigation                                     |
| --------------------------- | ---------------- | ---------------------------------------------- |
| Virtualised / hidden inputs | Focus call fails | Provide callback escape-hatch; docs.           |
| Over-scroll on mobile       | Janky UX         | Use `center` block and allow override.         |
| Screen-reader spam          | Confusion        | Debounce announcement, use polite live-region. |

## 13 · Open Questions

1. Should `scrollToError` callback returning `false` also cancel focusing?
2. Default ARIA message localisation strategy—re-use existing translation hook?
