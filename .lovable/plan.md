

## Plan — Rebuild first-run UX around the "magic moment"

### What the PDFs prescribe
The current onboarding asks 3 emotional questions, generates AI personalization, then dumps user on a Dashboard. The PDFs argue the opposite: **deliver one piece of value before asking for anything**. User should see a real follow-up message drafted for *their* situation within ~60 seconds — that's the hook. Auth/Gmail/feature explanations come *after* the wow moment.

### New flow

```text
/auth (signup)
   ↓
/welcome              ← NEW. One line: "Following up on payments shouldn't feel this hard." + Start button
   ↓
/quickstart/ask       ← NEW. "Do you have a payment you're waiting on?"   [Yes] [Not right now]
   ↓                                          ↘ (Not right now → demo invoice prefilled)
/quickstart/invoice   ← NEW. 3 fields only: Client name, Amount (optional), Status (Due soon / Due today / Overdue)
   ↓ [Create follow-up]
/quickstart/draft     ← NEW. THE MOMENT. Typing animation → message appears.
                          Tone chip: "Friendly nudge"   Timing: "Send now"
                          Subtle line: "If no reply, we'll follow up again in 3 days — slightly firmer."
                          [Send via Gmail]   [Edit tone]
   ↓ (tap Send → NOW prompt Gmail connect if missing)
/quickstart/sent      ← NEW. "Nice. Most freelancers delay this by 2–3 days."
                          "We'll handle the next follow-up if needed."   [Go to dashboard]
   ↓
/dashboard            ← invoice already exists, next follow-up scheduled
```

The current 5-step emotional/personalization onboarding is **removed from the critical path**. We keep the `generate-personalization` edge function but only surface tailored copy passively on Dashboard later (not as a gate).

### Architectural changes

1. **New route group `/quickstart/*`** with shared layout (no tab bar, calm spacing, single CTA per screen).
2. **`OnboardingScreen.tsx` becomes a thin redirector** to `/quickstart/welcome` for new users (keeps `completeOnboarding()` semantics — fires after `/quickstart/sent`, or after "Not right now" path lands them on dashboard).
3. **Gmail connect is deferred**: removed from any pre-value step. Triggered inline by Send button on draft screen if `!hasGmail`. Modal sheet, not a full screen.
4. **Empty states killed**: Dashboard never shows "No invoices yet". If somehow empty, it shows a single card "Add your first follow-up" that opens the quickstart flow inline.
5. **Button placement**:
   - Primary CTA always bottom-pinned, full-width, single action per screen.
   - Secondary actions become tertiary (small text link), e.g. "Not right now", "Edit tone".
   - Back chevron top-left only after step 2 (welcome has no back).
6. **AI draft generation**: reuse existing `generate-followup` edge function. New `useQuickDraft()` hook calls it with `{client, amount, status}` and returns text streamed into typing animation.
7. **Invoice persistence**: the quickstart invoice IS a real DB invoice (created on `/quickstart/draft` mount). After Send → status updates + first followup row created → dashboard already populated.

### Files

**New**:
- `src/pages/quickstart/QuickstartLayout.tsx` — shared shell (progress dots, safe-area)
- `src/pages/quickstart/WelcomeScreen.tsx`
- `src/pages/quickstart/AskScreen.tsx`
- `src/pages/quickstart/InvoiceScreen.tsx` (3-field form, status chips not date picker)
- `src/pages/quickstart/DraftScreen.tsx` (typing animation, tone chip, scheduling line, Send/Edit)
- `src/pages/quickstart/SentScreen.tsx`
- `src/components/quickstart/TypingMessage.tsx` (reveals AI text char-by-char, ~30ms/char, max 1.5s)
- `src/components/quickstart/GmailConnectSheet.tsx` (bottom sheet, only shown on Send tap)

**Edited**:
- `src/App.tsx` — add 5 quickstart routes
- `src/pages/RootRedirect.tsx` — new authenticated user → `/quickstart/welcome` (was `/onboarding`)
- `src/pages/OnboardingScreen.tsx` — keep file but route old `/onboarding` to `/quickstart/welcome` for backward compat
- `src/pages/DashboardScreen.tsx` — remove "Get started" Gmail nag from top; replace empty state with "Add a follow-up" card that opens quickstart; move Gmail connect into a quieter Settings hint
- `src/components/invoice/AIDraftComposer.tsx` — extract draft+tone UI into reusable piece used by both DraftScreen and InvoiceDetail

### Copy & visual rules (from PDFs)
- No "AI-powered", "Generate", "Smart". Use "Ready to send", "We'll handle this".
- Soft surfaces, generous spacing, no red alerts in onboarding (overdue uses muted amber, not destructive red).
- Typing animation only on first draft — subsequent drafts appear instantly.

### What stays the same
- Auth screen (signup still first — required by Supabase RLS to write the invoice).
- Subscription/paywall logic — trial starts on signup as today; paywall never shown during quickstart.
- Personalization edge function — kept, repurposed later as Dashboard greeting copy.

### Out of scope
- Demo mode for "Not right now" path will be minimal: prefilled sample invoice ("Acme Co, $1,200, Overdue"). Full sandbox can come later.
- No A/B testing harness this round.

### Open question (will ask after approval if needed)
Whether to keep the existing 3-question emotional survey accessible later (e.g. as a one-time prompt on Dashboard day 2) or retire it entirely. Default: retire it — keep the codebase lean.

