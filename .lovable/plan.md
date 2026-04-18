

## Plan — Centralized state machine + flow hardening

### Architecture

Introduce a single `FlowMachine` (reducer-based, no new deps) that owns the canonical app state and is the **only** way to transition between major screens. React Router becomes a thin renderer driven by the machine — direct `navigate()` calls outside the machine are removed from flow-critical paths.

```text
APP_LAUNCH → LANDING → ONBOARDING → PERSONALIZATION → AUTH
   → PRE_DASHBOARD_DECISION → {CREATE_INVOICE | DASHBOARD_EMPTY}
   → DASHBOARD_ACTIVE → INVOICE_DETAIL
```

### New files

- **`src/flow/states.ts`** — `FlowState` enum + route map (`STATE → path`).
- **`src/flow/transitions.ts`** — Allowed `(FROM, EVENT) → TO` table. Unknown transitions are rejected and logged.
- **`src/flow/FlowMachine.tsx`** — Reducer + Provider + `useFlow()` hook. Exposes `send(event, payload?)`. Persists `{state, onboardingPayload}` to `localStorage` (`flow_state_v1`). Logs every transition `[FLOW] FROM → TO @ timestamp`.
- **`src/flow/FlowRouter.tsx`** — Subscribes to machine; calls `navigate(routeFor(state), {replace:true})` declaratively. Mounted once inside `BrowserRouter`.
- **`src/flow/guards.ts`** — Pure guard fns: `hasSession`, `onboardingComplete`, `personalizationComplete`, `hasInvoices`.
- **`src/pages/PersonalizationScreen.tsx`** — Split out from current `OnboardingScreen` (the post-questions / pre-auth slice). Keeps existing UI, wires "Continue" → `send('PERSONALIZATION_DONE')`.
- **`src/pages/PreDashboardDecisionScreen.tsx`** — The "Create your first invoice now?" prompt, extracted from onboarding step 7. Buttons send `DECIDE_YES` / `DECIDE_SKIP`.

### Edited files

- **`src/App.tsx`** — Wrap routes in `<FlowProvider>` + `<FlowRouter/>`. Routes become pure renderers; remove `RequireOnboarding` (machine guards replace it). Add `/personalization` and `/pre-dashboard` routes.
- **`src/pages/RootRedirect.tsx`** — Becomes a no-op that just shows a splash while machine boots, then machine drives navigation.
- **`src/pages/OnboardingScreen.tsx`** — Strip auth + decision steps. On final question → `send('ONBOARDING_DONE', payload)`. Removes self-driving `useEffect`s that jump steps.
- **`src/pages/AuthScreen.tsx`** — On successful sign-in/up → `send('AUTH_SUCCESS')`. Stop calling `navigate()` directly.
- **`src/pages/DashboardScreen.tsx`** — Reads `invoices.length` from context; if zero, renders empty-state component with illustration + "Create your first invoice" CTA → `send('CREATE_INVOICE')`. Otherwise full dashboard. Skeleton cards during `invoicesLoading`.
- **`src/pages/InvoicesScreen.tsx`** — Remove `?new=1` query handling; opens modal when `flow.state === CREATE_INVOICE`. On success → `send('INVOICE_CREATED')`.
- **`src/components/invoice/NewInvoiceModal.tsx`** — Wrap insert in `withRetry()` helper that does one silent `refreshSession()` retry on auth errors. Never surface "session expired" / "not signed up" to authed users — show generic *"Something went wrong. Please try again."* Preserve form state on error; show inline retry banner. Disable submit button while in-flight (already partially done).
- **`src/context/AppContext.tsx`** — Stop force-resetting onboarding state on token refresh (already fixed). Expose `sessionReady` for guards. Remove imperative onboarding navigation logic (machine owns it now).
- **`src/components/ui/button.tsx`** — Confirm `active:scale-[0.97] transition-transform duration-150 ease-out` is in base classes (add if missing).
- **`tailwind.config.ts`** — Add `slide-up-fade` keyframes (`opacity 0→1`, `translateY 8px→0`, 250ms ease-in-out) and `animate-page-enter` utility. Apply to top-level `<div>` of each routed page.
- **`src/index.css`** — Add `.skeleton` shimmer utility used by Dashboard empty/loading.

### Transition table (core)

| From | Event | To | Guard |
|---|---|---|---|
| APP_LAUNCH | BOOT | LANDING | !hasSession && !onboardingComplete |
| APP_LAUNCH | BOOT | PRE_DASHBOARD_DECISION | hasSession && onboardingComplete && firstRunThisSession |
| APP_LAUNCH | BOOT | DASHBOARD_ACTIVE/EMPTY | hasSession && onboardingComplete |
| LANDING | START | ONBOARDING | — |
| ONBOARDING | ONBOARDING_DONE(payload) | PERSONALIZATION | all answers present |
| PERSONALIZATION | CONTINUE | AUTH | — |
| AUTH | AUTH_SUCCESS | PRE_DASHBOARD_DECISION | hasSession |
| PRE_DASHBOARD_DECISION | DECIDE_YES | CREATE_INVOICE | — |
| PRE_DASHBOARD_DECISION | DECIDE_SKIP | DASHBOARD_EMPTY/ACTIVE | by invoice count |
| CREATE_INVOICE | INVOICE_CREATED | DASHBOARD_ACTIVE | — |
| DASHBOARD_EMPTY | CREATE_INVOICE | CREATE_INVOICE | — |
| DASHBOARD_ACTIVE | OPEN_INVOICE(id) | INVOICE_DETAIL | — |
| INVOICE_DETAIL | BACK | DASHBOARD_ACTIVE | — |
| * | SIGN_OUT | LANDING | — |

Any unlisted `(state, event)` → reject + `console.warn('[FLOW] rejected', …)`.

### Edge-case handling

- **Session expired mid-action**: shared `withAuthRetry(fn)` util: run → on `PGRST301`/auth error → `refreshSession()` → retry once → on second failure show generic message. Used by Create Invoice and Send.
- **Bypass**: machine ignores route changes that don't match current state's allowed route; `FlowRouter` re-corrects via `navigate(replace:true)`.
- **Rapid taps**: `useTransitionLock()` hook in machine returns `pending` boolean; CTAs read it.
- **Form preservation**: NewInvoiceModal moves form state into a `useRef`-backed store keyed by session, restored on re-mount.
- **Empty dashboard**: dedicated component with inline SVG illustration + CTA.

### Logging

`logTransition(from, to, event)` in machine — `console.info` in dev, no-op stub in prod (analytics hook left as TODO comment).

### Out of scope
- XState dependency (reducer is sufficient).
- Framer Motion (CSS keyframes meet the 250ms ease-in-out spec).
- Visual redesign beyond empty-state illustration.

