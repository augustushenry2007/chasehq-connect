

## Plan — Polish interactions + restructure flow to "value-first, account-last"

### Summary of changes

1. **Send button (testing mode)** — short-circuit the email send so it always "succeeds" with a warm confirmation, no error toast, and an animated success pill.
2. **Smoother transitions + tap feedback** — extend `animate-page-enter` to all routed pages, add `active:scale-[0.97] transition-transform duration-150 ease-out` to all primary CTAs.
3. **"Try it free" becomes the final onboarding step** — reorder onboarding so trial/pricing is the last visible step before they exit onboarding (no auth inside onboarding).
4. **Account creation deferred** — let unauthenticated users explore + create their first invoice locally. Prompt "Create an account to save…" *after* invoice creation. The locally-drafted invoice is then persisted to the user's account.

---

### 1. Send button — testing-mode success

**`src/components/invoice/AIDraftComposer.tsx`** — in `doSend()`, detect `isTestingMode()` (or always, since user said app is in testing). Skip the network call, set `sent=true`, show the existing warm toast `"Sent. We'll take it from here."` with a rotating warm description (e.g. "Done. Your reminder is on its way."). The success pill (already present via `Check` icon + `animate-scale-in`) covers the micro-interaction.

We'll also wrap the success in a soft 600ms easing — already handled by tailwind `animate-scale-in`. Add `transition-all duration-200 ease-out active:scale-[0.97]` to the Send button class.

### 2. Motion polish

**`src/index.css`** (or `tailwind.config.ts` if not present) — confirm `animate-page-enter` exists (it does). Apply to top-level wrapper of:
- `AuthScreen.tsx`
- `DashboardScreen.tsx`
- `InvoicesScreen.tsx`
- `InvoiceDetailScreen.tsx`
- `SettingsScreen.tsx`

**Button feedback** — add `active:scale-[0.97] transition-transform duration-150 ease-out` to the primary CTAs in: `OnboardingScreen` (all `next` buttons + auth submit), `WelcomeScreen` Start button, `AuthScreen` submit, `NewInvoiceModal` Create button (already done), `AIDraftComposer` Send/Generate, `PreDashboardDecisionScreen` (already done).

### 3. Reorder onboarding — trial as final step

Current step order: `0,1,2 questions · 3 made-for-you · 4 how it works · 5 pricing/trial · 6 auth`.

**New order (`TOTAL_STEPS = 6`)**: `0,1,2 questions · 3 made-for-you · 4 how it works · 5 pricing/trial (final, CTA = "Start free trial")`.

The auth step (old step 6) is **removed from onboarding entirely**. On step 5's "Start free trial" CTA, we:
- mark onboarding complete locally (no DB write yet — user has no account)
- call `sendFlow("ONBOARDING_DONE")` → goes to **AUTH state? No.** See §4 below.

### 4. Value-first flow: invoice before account

This is the structural change. New flow:

```text
LANDING → ONBOARDING (q0..q4..trial) → PRE_DASHBOARD_DECISION ("create your first invoice?")
   → CREATE_INVOICE (works without account — stored locally)
   → POST_INVOICE_AUTH ("Create account to save it") → AUTH success
   → DASHBOARD_ACTIVE (local invoice now persisted to backend)
```

If the user **skips** invoice creation, they go to a lightweight `DASHBOARD_EMPTY` (still no account) with an inline "Create account" prompt at the top — they can keep exploring.

#### Flow machine changes

**`src/flow/states.ts`** — add `POST_INVOICE_AUTH` state, route `/auth-after-invoice`.

**`src/flow/transitions.ts`** — new transition table:
- `ONBOARDING --ONBOARDING_DONE--> PRE_DASHBOARD_DECISION` (replaces ONBOARDING→AUTH)
- `PRE_DASHBOARD_DECISION --DECIDE_YES--> CREATE_INVOICE`
- `PRE_DASHBOARD_DECISION --DECIDE_SKIP--> DASHBOARD_EMPTY`
- `CREATE_INVOICE --INVOICE_CREATED--> POST_INVOICE_AUTH` (when unauth) **or** `DASHBOARD_ACTIVE` (when already auth)
- `POST_INVOICE_AUTH --AUTH_SUCCESS--> DASHBOARD_ACTIVE`
- `DASHBOARD_EMPTY --REQUEST_AUTH--> AUTH` and `AUTH --AUTH_SUCCESS--> DASHBOARD_ACTIVE`

#### Local invoice draft

**New: `src/lib/localInvoice.ts`** — small module that stores a single pending invoice draft in `localStorage` (`pending_invoice_v1`). Exposes `savePending(draft)`, `readPending()`, `clearPending()`.

**`NewInvoiceModal.tsx`** — when `!isAuthenticated`, on submit, save draft to local storage instead of inserting to DB. Then `sendFlow("INVOICE_CREATED")`. No data is lost.

**`AppContext.tsx`** — add a `useEffect` that, when a user becomes authenticated AND a pending local invoice exists, inserts it via `createInvoice(user.id, draft)` and clears the pending draft. This guarantees no data loss.

#### New screen: `POST_INVOICE_AUTH`

**New: `src/pages/PostInvoiceAuthScreen.tsx`** — friendly card:

> "Nice. Your first invoice is ready. Create an account to save it and let ChaseHQ chase for you."

Below it: the same auth UI block currently inside `OnboardingScreen` step 6 (Google + email/password), refactored into a small reusable `<AuthForm onSuccess={...} />` component.

**Refactor: `src/components/auth/AuthForm.tsx`** (extract from `OnboardingScreen` step 6 + `AuthScreen`) — single source of truth for the auth UI. Used by both `PostInvoiceAuthScreen` and existing `AuthScreen`.

On `AUTH_SUCCESS`: call `start-trial` edge function (currently in onboarding effect), then `sendFlow("AUTH_SUCCESS")`. The pending draft is auto-flushed by the AppContext effect → user lands on Dashboard with their invoice already persisted.

#### Empty dashboard prompt for unauth users

**`DashboardScreen.tsx`** + **`InvoicesScreen.tsx`** — when `!isAuthenticated`, show a non-blocking banner at top: *"You're exploring as a guest. Create an account to save your work →"* that triggers `sendFlow("REQUEST_AUTH")`.

#### RequireOnboarding adjustment

**`RequireOnboarding.tsx`** — currently redirects unauthenticated users to `/welcome`. Change to allow unauthenticated access to `/dashboard`, `/invoices`, `/pre-dashboard`, `/invoice/:id` if `hasCompletedOnboarding` is true (tracked locally for guest users via a `localStorage` flag `onboarding_complete_guest=1`).

**`AppContext.tsx`** — `hasCompletedOnboarding` becomes `(profile.onboarding_completed) || (localStorage.onboarding_complete_guest === "1")`.

### Edge cases

- **Sign-in (existing user) inside post-invoice-auth**: the AuthForm's `onSuccess` flushes the pending draft to *their* account. If they had existing invoices, the draft is added to them.
- **Refresh during guest flow**: pending invoice + `onboarding_complete_guest` survive; FlowMachine resumes at last persisted state.
- **Sign out**: clear `pending_invoice_v1` and `onboarding_complete_guest` (treat as fresh user).

### Files touched

**New**: `src/lib/localInvoice.ts`, `src/pages/PostInvoiceAuthScreen.tsx`, `src/components/auth/AuthForm.tsx`

**Edited**:
- `src/flow/states.ts` (add POST_INVOICE_AUTH)
- `src/flow/transitions.ts` (rewire transitions)
- `src/flow/FlowBootstrap.tsx` (handle guest-onboarded boot)
- `src/components/invoice/AIDraftComposer.tsx` (testing-mode send + button polish)
- `src/components/invoice/NewInvoiceModal.tsx` (guest-mode local save)
- `src/context/AppContext.tsx` (guest onboarding flag, pending-draft flush effect)
- `src/components/RequireOnboarding.tsx` (allow guest navigation)
- `src/pages/OnboardingScreen.tsx` (drop step 6 auth, finalize at trial step, mark guest-onboarded, send `ONBOARDING_DONE`)
- `src/pages/AuthScreen.tsx` (use shared `AuthForm`)
- `src/pages/DashboardScreen.tsx` + `InvoicesScreen.tsx` (guest banner, page-enter animation)
- `src/pages/InvoiceDetailScreen.tsx` + `SettingsScreen.tsx` (page-enter animation)
- `src/App.tsx` (register `/auth-after-invoice` route)

### Out of scope

- Changing the visual design of the trial step.
- Adding full localStorage support for *multiple* guest invoices (we cap at one to keep the post-invoice-auth prompt focused).
- Server-side enforcement that guest invoices flush correctly (handled client-side; user explicitly stated app is in testing mode).

