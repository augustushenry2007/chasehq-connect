

Let me explore the relevant files before planning.
<lov-tool-use id="toolu_vrtx_01SS7AFuJaFoVWogGVy7EDxD" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/OnboardingScreen.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01JbHuPTomzSCFxvWq1KocFP" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/OnboardingScreen.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_015EtEbyBySEqbzb6sZrT6JD" name="code--view" integration-id="code" data="{\"file_path\": \"src/App.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_015R9RUMgb4U6izMucv8RVRB" name="code--view" integration-id="code" data="{\"file_path\": \"src/hooks/useGmailConnection.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_0179X2uKBki98tN6Zs3X7YLw" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/gmail-oauth-start/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Rzkopi88L7wot6VebPhJn2" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/gmail-oauth-callback/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_013HF38WAyUi992taRcrAHad" name="code--view" integration-id="code" data="{\"file_path\": \"src/context/AppContext.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01JEYZDkMtv6Xn9vNHW3iw7j" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/RootRedirect.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_014d2k8zxU6rK9owa5aQCQU1" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/invoice/AIDraftComposer.tsx\", \"lines\": \"1-80\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01DExc9CStm7X6zxum16vn3a" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/AuthScreen.tsx\", \"lines\": \"1-60\"}">
</lov-tool-use>
I have enough context. Let me check the followups table for the smart messaging logic.
<lov-tool-use id="toolu_vrtx_01RsVT9RZ8uv2MwNPNUsVqrG" name="code--exec" integration-id="code" data="{\"command\": \"echo \\\"checking redirect URI config\\\"\", \"user_facing_description\": \"Quick check\"}">
</lov-tool-use>
<lov-plan>

## Plan — UX & flow improvements

### 1. "Made for You" loading gate (OnboardingScreen step 3)
- Disable & grey out the "Show me how" CTA while `personalizing === true` or before `personalization` is set.
- Also disable the top-right ChevronRight skip button during loading on step 3.
- CTA only enables after `personalization` renders (or after error fallback so user isn't stuck).

### 2. Onboarding restructure — auth at the end
Current: `Auth → Onboarding → Dashboard`. New: `Onboarding (anonymous) → Pricing → Auth → Dashboard`.

- **RootRedirect**: if not authenticated AND no onboarding-progress flag in `localStorage`, send to `/onboarding` (not `/auth`). If authenticated but onboarding incomplete, still send to `/onboarding` so they resume at the auth step.
- **OnboardingScreen**: 
  - Steps 0–4 stay the same and run without auth (no DB calls; `generate-personalization` already works anonymously since it's an AI gateway call — will pass an `Authorization: anon` header explicitly).
  - Persist answers + step to `localStorage` under `onboarding_state` so progress survives the auth round-trip.
  - Add **new step 5: Pricing/Trial** (replaces current "all set"). Shows: "30-day free trial", what's included (AI follow-ups, Gmail send, smart timing), "$5/month after — cancel anytime", "Billing starts day 31". CTA: "Start Free Trial".
  - Add **new step 6: Auth**. Embeds existing AuthScreen logic (Google + email/password). On success, calls `start-trial` edge function, then `completeOnboarding()`, then routes to `/dashboard`.
- **AuthScreen**: keep as standalone for "Sign in" link; add a back-link to `/onboarding` if state exists.
- Clear `onboarding_state` on `completeOnboarding()`.

### 3. Free trial + plan selection
Already covered by the new step 5 above. Reuses existing `start-trial` edge function (creates `subscriptions` row with `trialing` for 30 days). Copy emphasizes: trial length, included features, billing date (computed `today + 30 days`), "Cancel anytime in Settings → Billing".

### 4. Permission flow 403 fix
Root cause: `gmail-oauth-start` requires a valid JWT. The 403 happens when called with stale/missing session. Also the OAuth callback can return without success if redirect URI isn't whitelisted in Google Cloud.

Fixes:
- `useGmailConnection.connectGmail`: explicitly fetch session via `supabase.auth.getSession()`, attach `Authorization: Bearer <token>` to the invoke. If no session, navigate to `/auth` instead of failing silently.
- Read `gmail_error` query param on return, surface as a toast with retry CTA.
- Add console-friendly error log + `toast.error` showing exact message from edge function (currently silently fails).
- Document for user (in chat after impl): the OAuth callback URL `https://smkvskatoblrfgplntqe.supabase.co/functions/v1/gmail-oauth-callback` must be in their Google Cloud OAuth client's "Authorized redirect URIs". This is the most common 403 cause and we'll show a clear toast pointing to it.

### 5. Smart follow-up confirmation message
In `AIDraftComposer.doSend()` after `success === true`:
- Query `followups` table for count of prior sends for this invoice (`invoice_id` + `sent_at IS NOT NULL`).
- Compute next-follow-up message based on:
  - `followupCount === 0` (first): "We'll follow up in 3 days if there's no reply."
  - `followupCount === 1`: "We'll send a firmer reminder in 3 days."
  - `followupCount === 2`: "We'll escalate the tone in 2 days if unpaid."
  - `followupCount >= 3` OR overdue > 30: "Consider a Final Notice next — we'll remind you in 2 days."
  - If `invoice.status === 'Paid'`: "Marked as paid — no further reminders will be sent."
  - If `invoice.daysPastDue > 0`: prepend "Sent. " and use firmer copy.
- Show via `toast.success(title, { description })` with a calm, professional tone — no aggressive language.
- Keep the existing inline "Sent ✓" button state for 2.5s.

### Files

**Edited**
- `src/pages/OnboardingScreen.tsx` — gate CTA, persist state, add pricing step + auth step.
- `src/pages/RootRedirect.tsx` — route unauthenticated users to `/onboarding` first.
- `src/pages/AuthScreen.tsx` — minor: back link to onboarding if in-progress.
- `src/context/AppContext.tsx` — expose helper to clear onboarding state on complete.
- `src/hooks/useGmailConnection.ts` — explicit session token, navigate-to-auth fallback, error surfacing.
- `src/components/invoice/AIDraftComposer.tsx` — smart confirmation toast based on followup history.
- `supabase/functions/gmail-oauth-start/index.ts` — better error message when no auth (already returns 401 — improve message clarity for the toast).

**No DB changes, no new edge functions.**

### Out of scope
- Building a separate pricing comparison page (single trial plan only).
- Reworking the AuthScreen UI itself (just embedding within onboarding flow).

