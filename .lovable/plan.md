

## Plan — Fix blank Onboarding screen + harden flow

### Root cause

`OnboardingScreen` previously had 8 steps (`TOTAL_STEPS = 8`) and step 7 was the "You're in" decision. We reduced it to 7 steps (max valid step = 6) and moved the decision to `/pre-dashboard`, but **persisted onboarding state in `localStorage["onboarding_state"]` can still contain `step: 7`** from earlier sessions. When the component mounts with `step = 7`, no render branch matches (steps 0–6 only), so the inner card renders empty → blank screen.

Secondary issues found while investigating:
- `WelcomeScreen` calls `navigate("/onboarding")` imperatively, bypassing the FlowMachine. The machine state stays at `LANDING` while the URL is `/onboarding`. Works today only because `FlowRouter` doesn't re-correct (state didn't change), but it's fragile and violates the "all transitions through machine" rule.
- No top-level error boundary, so any future render error in a step also yields a blank screen with no fallback.

### Changes

**`src/pages/OnboardingScreen.tsx`**
- Clamp the initial `step` to `[0, TOTAL_STEPS - 1]` when reading from `localStorage` (and from the `sessionDoneFlag` branch). Defensive: any invalid persisted value falls back to `0`.
- Add a `default` render fallback inside the card: if `step` is out of range, reset to `0` via `useEffect` and render a small skeleton instead of nothing.

**`src/pages/WelcomeScreen.tsx`**
- Replace `navigate("/onboarding")` with `sendFlow("START")` so the FlowMachine drives the transition (`LANDING → ONBOARDING`) and `FlowRouter` updates the URL declaratively.

**`src/components/ErrorBoundary.tsx`** (new)
- Class component that catches render errors in children, logs to console (dev) + a TODO analytics hook, and renders a friendly fallback card with a "Reload" button. Wraps the `<Routes>` tree in `App.tsx` so any future broken screen shows a fallback instead of a blank page.

**`src/App.tsx`**
- Wrap `<Routes>` (or each route element) with `<ErrorBoundary>`.

### Validation

Manual: clear `localStorage`, fresh load → `/welcome` → tap Start → onboarding step 0 visible. Also test: pre-set `localStorage.onboarding_state = '{"step":7}'`, reload `/onboarding` → renders step 0 (no blank). Force a throw in a step component → ErrorBoundary fallback appears, not a blank page.

