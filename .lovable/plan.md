

## Plan — Fix session bug, fix skip loop, harden onboarding flow

### Root causes

1. **"Session expired" on Create Invoice** — `NewInvoiceModal.handleCreate` shows a generic "session expired" toast whenever `user.id` isn't in context yet, masking the real RLS/insert error. Even when `uid` is found via `getSession()`, the pre-flight `count(*)` query in `createInvoice()` runs without ensuring the supabase client has the latest token, and any insert error gets a vague message.

2. **Onboarding skip loop** (visible in session replay) — When the user clicks "Skip for now" on step 7 and navigates to `/dashboard`:
   - In testing mode, `AppContext` forces `hasCompletedOnboarding=false` on every `SIGNED_IN` event (including silent token refreshes).
   - There's **no route guard** on `/dashboard`, but `OnboardingScreen` itself sets `step=6` whenever `isAuthenticated` flips, and `completeOnboarding()` only fires once at step 6→7. If the user lands back on `/onboarding` for any reason (e.g. a stray nav), they're forced through again.
   - The skip path uses `navigate("/dashboard", { replace: true })` but the auth state subscriber's `clearTestingState()` wipes the state right after, and the testing-mode `SIGNED_IN` handler runs on every tab focus/token refresh — repeatedly resetting `hasCompletedOnboarding` to `false`.

3. **"Onboarding screens missing"** — The 8 steps (0–7) exist and render. The perceived "missing" screens are because testing mode + the loop above sometimes drops the user mid-flow. Fixing #2 restores the felt experience.

### Changes

**`src/components/invoice/NewInvoiceModal.tsx`**
- Replace the silent "session expired" path with: try `user?.id` → `supabase.auth.getSession()` → `supabase.auth.refreshSession()` as a third fallback before giving up.
- Pass real insert errors through (already done in `createInvoice`, just stop swallowing them with the modal's pre-check).
- Add a small inline error banner so users see what actually went wrong instead of a transient toast.

**`src/hooks/useSupabaseData.ts` — `createInvoice`**
- Drop the `count(*)` pre-flight (it's the RLS-sensitive call that often fails silently and produces wrong invoice numbers under races). Generate the invoice number with `Date.now()`-based suffix or fetch with `.eq("user_id", userId)` so RLS is explicit.
- Bubble the full Postgres error message to the toast.

**`src/context/AppContext.tsx`**
- In the testing-mode `SIGNED_IN` branch, only reset state on **fresh sign-ins**, not on token refreshes. Track a `lastUserId` ref and skip the wipe when `session.user.id === lastUserId`. This stops the loop where every silent refresh kicks the user back to onboarding.
- Keep the testing-mode override of `hasCompletedOnboarding` on initial profile load only; once `completeOnboarding()` has been called this session, don't re-flip it to false.

**`src/pages/OnboardingScreen.tsx`**
- Remove the `useEffect` that force-jumps to `step=6` when `isAuthenticated` is true if the user has already passed step 6 (currently `step < 6` guard is correct but combined with re-mounts can replay). Add an in-session `completedRef` so once we hit step 7 we never auto-rewind.
- After `completeOnboarding()` succeeds at step 6→7, also persist a `localStorage["onboarding_done_session"]` flag (skipped in testing mode) so a remount doesn't restart.

**`src/pages/RootRedirect.tsx` & route guards**
- Add a lightweight guard component `<RequireOnboarding>` wrapping the `TabLayout` routes. If `authReady && isAuthenticated && !hasCompletedOnboarding`, redirect to `/onboarding`. If `!isAuthenticated`, redirect to `/welcome`. This makes `/dashboard` truly protected and prevents stray returns to `/onboarding` after skip.

**No DB / edge function / dependency changes.**

### Files touched
- `src/components/invoice/NewInvoiceModal.tsx`
- `src/hooks/useSupabaseData.ts`
- `src/context/AppContext.tsx`
- `src/pages/OnboardingScreen.tsx`
- `src/App.tsx` (wrap protected routes with new guard)
- `src/pages/RootRedirect.tsx` (extract guard or add new file `src/components/RequireOnboarding.tsx`)

### Out of scope
- React Query migration (the cached "lovable-stack-overflow" pattern) — would be a larger refactor; the targeted fixes above resolve the symptoms without it.
- Visual redesign of any screen.

