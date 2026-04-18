

## Plan — Pre-onboarding, empty states, palette, polish

### 1. New first screen (Welcome)
- New `src/pages/WelcomeScreen.tsx` route `/welcome`.
- Headline + subtext with `animate-fade-in` (staggered via inline `style={{animationDelay}}`), primary "Start" CTA → `/onboarding`.
- Update `RootRedirect`: unauthenticated + no onboarding-state → `/welcome` (not `/onboarding`).

### 2. Pre-dashboard "create first invoice?" prompt
- New step within `OnboardingScreen.tsx` after auth (step 7) OR a new lightweight route `/onboarding/first-invoice` shown once after `completeOnboarding()`.
- Chosen approach: add as final onboarding step (keeps single flow). "Yes" → `/invoices?new=1` (auto-opens NewInvoiceModal), "Skip" → `/dashboard`.
- `InvoicesScreen` reads `?new=1` and auto-opens the modal once.

### 3. Dashboard empty state
- In `DashboardScreen.tsx`, when `invoices.length === 0` and `!invoicesLoading`: render empty-state card with message "No invoices yet — let's create your first one.", a "Create Invoice" CTA navigating to `/invoices?new=1`, and 2 ghost skeleton cards below for visual hint.

### 4. Color palette (from screenshot — cool blues)
Update `src/index.css` HSL tokens:
- Turquoise `#447F98` → primary (HSL ~199 38% 43%)
- Slate Blue `#628BB5` → accent foreground / secondary darker
- Platinum `#DADEE1` → muted / borders
- Glacier `#B9D8E1` → accent
- Ice Blue `#D8EBF3` → background-soft / accent-bg
- Background: very light ice (`210 60% 98%`)
- Foreground: deep slate (`210 30% 18%`)
- Keep success/warning/error semantics; tint success toward teal-green to harmonize.
- No Tailwind config changes needed (all driven by CSS vars).

### 5. Motion polish
- Add `transition-all duration-200 ease-out active:scale-[0.97]` to primary buttons via a small tweak to `src/components/ui/button.tsx` base classes.
- Wrap routed pages in a fade-in: add `animate-fade-in` to top-level `div` of each screen (`Welcome`, `Dashboard`, `Invoices`, `Settings`, `InvoiceDetail`).
- No router-level transition library needed (avoids dep churn).

### 6. Fix Send button + warm confirmation
- Investigate current error in `AIDraftComposer.doSend()` — likely the `followups` count query running before insert or RLS issue. Will:
  - Wrap send in robust try/catch, log full error, surface `toast.error` with the actual message instead of silent fail.
  - On success: replace button label with "Sent. We'll handle the follow-up from here." + Check icon, hold for 3s before resetting. Add `animate-scale-in` on the success state.
  - Keep existing smart-followup toast as the secondary description.

### Files

**New**
- `src/pages/WelcomeScreen.tsx`

**Edited**
- `src/App.tsx` — register `/welcome` route
- `src/pages/RootRedirect.tsx` — default unauth → `/welcome`
- `src/pages/OnboardingScreen.tsx` — add final "create first invoice?" step after auth
- `src/pages/DashboardScreen.tsx` — empty state with skeleton hints + CTA
- `src/pages/InvoicesScreen.tsx` — auto-open NewInvoiceModal when `?new=1`
- `src/index.css` — new palette tokens
- `src/components/ui/button.tsx` — add `active:scale-[0.97] transition-all` to base
- `src/components/invoice/AIDraftComposer.tsx` — fix send error, warm success state with animation

**No DB changes, no new edge functions, no new dependencies.**

### Out of scope
- Full route-transition framework (Framer Motion) — using CSS keyframes already in tailwind config.
- Redesigning individual components beyond palette token swap.

