

## Plan

### 1. Settings — Remove Profile completely
**File:** `src/pages/SettingsScreen.tsx`
- Delete `ProfileSection` component
- Remove the Profile `CollapsibleSection` from the render
- Remove `profile`, `updateProfile` from `useApp()` destructure
- Remove `"profile"` from `SectionKey` type

**File:** `src/context/AppContext.tsx`
- Remove `UserProfile` interface, `profile` state, `updateProfile` function, and related localStorage logic
- Remove from context type and provider value

Result: Settings shows only Gmail card, Notifications & Chasing, Follow-Up Schedule.

### 2. Remove all mock data
**File:** `src/hooks/useSupabaseData.ts`
- Remove `MOCK_INVOICES` import, `DEMO_EMAIL` constant, `seeded` state, `seedInvoicesForUser` function
- Hardcoded `sent_from: "jamie@studio.co"` and bank details in `createInvoice` → use empty strings (real user data only)

**File:** `src/lib/data.ts`
- Remove the empty `ACTIVITY` export (no longer needed)

**File:** `src/pages/DashboardScreen.tsx`
- Remove `ACTIVITY` import and the entire "Recent Activity" block (it's already gated to `ACTIVITY.length > 0` which is always 0, but cleaner to remove)

**File:** `src/lib/mockData.ts`
- Delete the file entirely (no longer referenced)

**File:** `src/pages/AuthScreen.tsx`
- Remove the demo sign-in flow (`handleQuiz` creates `demo@chasehq.app` account). Replace "Start fresh — take the quiz" with same Google sign-in OR keep button but route to Google sign-in only. → **Decision:** Keep button label/style (matches screenshot), but route it through Google OAuth same as primary (no demo account).

### 3. Personalization page — full AI rebuild
This is **Step 3 of onboarding** (currently the static "The real problem isn't you" card).

**File:** `src/pages/OnboardingScreen.tsx`
- Step 3 becomes an **AI-generated personalization screen**
- On entering step 3, call edge function `generate-personalization` with: selected feelings (Q0), follow-up worries (Q1), what would help (Q2), and custom text inputs
- Display loading skeleton while generating
- Render structured response:
  - **Headline** — user-specific (e.g. "Anna, here's why chasing feels heavy.")
  - **Pain points** — 2-3 bullets reflecting their inputs
  - **Benefits** — 2-3 outcome-driven bullets tailored to their goals
  - **CTA** — "Show me how" → next step
- Premium UI: large headline, clear hierarchy, accent pill labels, bordered card sections with subtle dividers

**New file:** `supabase/functions/generate-personalization/index.ts`
- POST with `{ feelings, worries, goals, custom }`
- Calls Lovable AI Gateway (`google/gemini-2.5-flash`) with structured JSON output (headline, painPoints[], benefits[])
- Returns JSON; CORS enabled; no JWT verification needed (idempotent generation)

**File:** `supabase/config.toml`
- Add `[functions.generate-personalization]` with `verify_jwt = false`

### 4. Onboarding first screen — pixel match
The first onboarding screen the user references is **AuthScreen** (matches screenshot). Current implementation already matches. Verify spacing:
- Logo + "ChaseHQ" wordmark ✓
- "Get paid without the awkwardness." headline ✓
- Subcopy ✓
- "Continue with Google" outlined button ✓
- "or" divider ✓
- "Start fresh — take the quiz" primary button with arrow ✓
- Footer terms text ✓

**Adjustments:** Remove demo account logic from `handleQuiz` so both buttons trigger Google OAuth (cleaner; no fake demo path). Rename internal function but keep button label "Start fresh — take the quiz" exactly as screenshot.

### Files touched
- Edit: `src/pages/SettingsScreen.tsx`, `src/context/AppContext.tsx`, `src/hooks/useSupabaseData.ts`, `src/lib/data.ts`, `src/pages/DashboardScreen.tsx`, `src/pages/AuthScreen.tsx`, `src/pages/OnboardingScreen.tsx`, `supabase/config.toml`
- Delete: `src/lib/mockData.ts`
- Create: `supabase/functions/generate-personalization/index.ts`

### Out of scope
No new features; Notifications/Schedule/Gmail/Invoices flows untouched.

