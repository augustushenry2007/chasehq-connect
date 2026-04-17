

## Plan — Subscription system for ChaseHQ (iOS)

### Scope decisions

- **Apple IAP is the source of truth on iOS** (App Store policy requires it for digital subscriptions). Stripe is **not** used in parallel for iOS users — adding it creates double-billing risk and violates App Store guidelines for iOS-purchased subs. I'll wire Stripe as an **optional path for the web/PWA build only**, gated by platform detection. For this iteration, I recommend shipping iOS-only and deferring web Stripe to phase 2.
- **Lovable preview runs in a browser**, not in iOS. So during development you'll test the paywall UI + backend in the web preview using a **mock IAP layer** (returns fake receipts). Real StoreKit integration only runs in the native iOS build via Capacitor + the `@capgo/capacitor-purchases` plugin (RevenueCat-compatible). 
- **Receipt validation**: done server-side via an edge function calling Apple's `verifyReceipt` / App Store Server API. Never trust the client.
- **Trial enforcement**: backend computes entitlement from `subscriptions` table — client only reads it. No localStorage flags.

### Architecture

```text
iOS app (Capacitor)
    │
    ├─ @capgo/capacitor-purchases  →  Apple StoreKit  →  App Store
    │                                                         │
    │                                                         ▼
    │                                              Apple Server-to-Server
    │                                              Notifications (V2)
    │                                                         │
    ▼                                                         ▼
  edge fn: validate-receipt   ◄──────────────  edge fn: apple-webhook
              │                                               │
              ▼                                               ▼
         subscriptions table  (single source of truth for entitlement)
              │
              ▼
         useEntitlement() hook  →  gates UI + send-email function
```

### Database (one migration)

New table `subscriptions`:
- `user_id` (uuid, unique, FK to auth.users)
- `status` enum: `trialing | active | past_due | canceled | expired | none`
- `plan` text (default `chasehq_pro_monthly`)
- `trial_ends_at` timestamptz
- `current_period_end` timestamptz
- `canceled_at` timestamptz nullable
- `apple_original_transaction_id` text nullable (links to Apple)
- `apple_latest_receipt` text nullable (encrypted at rest via column or just stored — RLS-protected)
- `stripe_customer_id`, `stripe_subscription_id` nullable (future web use)
- `last_event_at` timestamptz
- RLS: user can SELECT own row; only service role can INSERT/UPDATE (writes happen exclusively in edge functions).

New table `subscription_events` (audit + analytics):
- `id, user_id, event_type, payload jsonb, created_at`
- Events: `trial_started, trial_ending_soon, converted, renewed, payment_failed, canceled, expired, restored`

Server-side function `public.has_active_entitlement(_user uuid) returns boolean` — checks `status in ('trialing','active') AND (trial_ends_at > now() OR current_period_end > now())`. Used by `send-email` edge function to hard-gate sending.

### Edge functions

1. **`start-trial`** — called when user taps "Start Free Trial" before any purchase. Creates `subscriptions` row with `status=trialing`, `trial_ends_at = now() + 30 days`. Idempotent (won't re-trigger if user already has a row). Logs `trial_started`.
2. **`validate-apple-receipt`** — accepts `{ receipt, productId }` from client after StoreKit purchase. Calls Apple's verifyReceipt endpoint, parses, upserts subscription row with real `current_period_end`. Logs `converted` or `renewed`.
3. **`apple-notifications`** — public endpoint (verify_jwt=false) for Apple Server-to-Server Notifications V2. Verifies the signed JWS payload using Apple's public keys, then updates the subscription row based on `notificationType` (`DID_RENEW`, `EXPIRED`, `GRACE_PERIOD_EXPIRED`, `DID_FAIL_TO_RENEW`, `CANCEL`, `REFUND`, etc.). Logs corresponding events.
4. **`get-entitlement`** — returns the user's current entitlement state (status, days left in trial, next billing date, can_send: bool).
5. **Update `send-email`** — at the top, call `has_active_entitlement(auth.uid())`. If false, return 402 with `{ error: 'subscription_required' }`. This is the actual access enforcement.

### Secrets needed (will request via add_secret after plan approval)

- `APPLE_SHARED_SECRET` (App Store Connect → app-specific shared secret for receipt validation)
- `APPLE_BUNDLE_ID` (already known: `app.lovable.ded4d25121ff41a498f3e10fd0fa9c51`)
- `APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (App Store Server API — needed for V2 notifications signature verification)

### Frontend

**New files**:
- `src/hooks/useEntitlement.ts` — fetches from `subscriptions` table (with realtime subscription so UI reacts to webhook updates instantly), returns `{ status, daysLeftInTrial, nextBillingDate, canSend, loading }`.
- `src/lib/iap.ts` — abstraction layer. On native: calls `@capgo/capacitor-purchases`. On web: returns mock results so paywall flow is testable in Lovable preview.
- `src/pages/PaywallScreen.tsx` — calm, minimal: headline "Keep follow-ups flowing", price "$5/month after 30-day free trial", "Cancel anytime", primary CTA "Start Free Trial", small "Restore purchases" link, legal links to Terms + Privacy.
- `src/pages/BillingScreen.tsx` — Settings → Billing subpage. Shows current status, trial countdown or next billing date, "Manage subscription" button (deep-links to `itms-apps://apps.apple.com/account/subscriptions` on iOS), "Restore purchases" button.
- `src/components/TrialBanner.tsx` — inline banner shown when `daysLeftInTrial <= 7`: "Your trial ends in N days. Keep your account active." with CTA. Auto-hides on paid status.

**Edited files**:
- `src/App.tsx` — add `/paywall` and `/settings/billing` routes.
- `src/pages/SettingsScreen.tsx` — add "Billing" row under Account section, shows current status badge.
- `src/components/invoice/AIDraftComposer.tsx` — wrap "Send" handler: if `!canSend`, navigate to `/paywall` instead of sending. Show subtle lock icon + tooltip on the button when locked.
- `src/pages/legal/PrivacyPolicy.tsx` and `TermsOfUse.tsx` — append subscription/billing sections (Apple IAP processing, no card storage, auto-renewal disclosure required by Apple, refund policy points to Apple, cancellation instructions).

### Paywall trigger logic

No paywall at signup. Triggers:
1. **Time-based**: when trial ends and user attempts a gated action (sending a follow-up).
2. **Reminder-based**: trial banner appears at T-7, T-3, T-1 days. At T-1, banner becomes prominent.
3. **Hard gate**: post-trial without active subscription → "Send" button opens paywall.

Read-only access is preserved: viewing invoices, dashboard, and history all stay unrestricted. Only **outbound actions** (send follow-up, send final notice) are gated.

### Native build steps (documented for user)

After this lands, the user runs locally:
```
npm install @capgo/capacitor-purchases
npx cap sync ios
```
Then in App Store Connect: create the `chasehq_pro_monthly` auto-renewable subscription product, set 30-day intro free trial, configure Server-to-Server notifications V2 URL pointing to the deployed `apple-notifications` edge function URL.

### Analytics

Every state change writes to `subscription_events`. Phase-2 dashboard could read from it; for now the audit table is enough and queryable.

### Edge cases handled

- **Failed payment** → Apple sends `DID_FAIL_TO_RENEW` → status set to `past_due`, grace period read from Apple's `gracePeriodExpiresDate`. UI shows banner "Payment issue — update your billing in App Store settings." Send is allowed during grace.
- **Expired trial, no purchase** → status flips to `expired` via daily-cron-less approach: `has_active_entitlement` checks `trial_ends_at > now()` live, so no cron needed.
- **Cancellation** → status stays `active` until `current_period_end`, then `apple-notifications` flips it to `canceled` then `expired`.
- **Refund** → `REFUND` notification → immediate `expired`.
- **Restore purchases** on a new device → calls `validate-apple-receipt` with the restored receipt → re-links to user.
- **Lovable preview testing** → mock IAP returns success, real DB row gets created, full flow testable end-to-end without iOS.

### What I'll request from you after approval

1. The 4 Apple secrets above (I'll send the `add_secret` prompts with instructions on where to find each one in App Store Connect).
2. Confirmation that `chasehq_pro_monthly` is the product ID you want me to wire (you can rename later in App Store Connect — the code uses a single constant).

### Out of scope for this iteration

- Stripe web checkout (deferred — would only matter once you ship a non-iOS client).
- Promo codes / annual plan / family sharing (Apple supports these later via the same product).
- A self-serve admin dashboard for subscriptions (the `subscription_events` table is the audit trail for now).

