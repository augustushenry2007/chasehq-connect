

Scoping decisions:
- Drop Apple from this iteration (user revised to Google + email/password only).
- Drop demo "quiz" button entirely.
- Gmail send-only scope is already in place; adding read/reply detection requires `gmail.readonly` + a polling job. Will scope as Phase 2 mention only — not implementing inbox sync now (avoids scope creep + new cron infra).
- SMTP fallback: implement send-only via `denomailer`. IMAP reply detection deferred (documented).

## Plan

### 1. Signup page redesign (`src/pages/AuthScreen.tsx`)

Full rebuild. Single screen with mode toggle (Sign in ⇄ Sign up). Layout inspired by reference, themed in app's sky-blue/light identity.

Structure (top → bottom):
- Logo + "ChaseHQ" wordmark
- Headline: "Create your account" / "Welcome back"
- Subcopy: short value line
- **Google button** (primary outlined, full width) — "Continue with Google"
- "or" divider
- Inputs:
  - Name (signup only, required)
  - Email
  - Password (with show/hide eye icon)
- Primary CTA: "Create account" / "Sign in"
- Toggle link at bottom: "Already have an account? Sign in" ⇄ "New here? Create an account"
- Footer: Terms + Privacy links

Remove: "Start fresh — take the quiz" button and all demo logic.

### 2. Auth logic

- Google: existing `lovable.auth.signInWithOAuth("google")` ✓
- Email signup: `supabase.auth.signUp({ email, password, options: { data: { full_name }, emailRedirectTo: window.location.origin } })`
- Email signin: `supabase.auth.signInWithPassword({ email, password })`
- Errors surfaced via `sonner` toasts; loading state on buttons

### 3. Profile schema update

Migration:
```sql
ALTER TABLE public.profiles 
  ADD COLUMN full_name text,
  ADD COLUMN email_provider text DEFAULT 'email',  -- 'google' | 'email'
  ADD COLUMN sender_type text DEFAULT 'none';      -- 'gmail' | 'smtp' | 'none'
```

Update `handle_new_user()` trigger to also persist `full_name` from `raw_user_meta_data->>'full_name'` and detect `email_provider` from `raw_app_meta_data->>'provider'`.

### 4. Gmail = primary, auto-connected for Google users

`src/hooks/useGmailConnection.ts` already exposes `signedInWithGoogle`. Behavior:
- Google sign-in users see a single one-tap "Grant Gmail send permission" card on Dashboard if `needsSendPermission` (already implemented).
- After grant, `sender_type = 'gmail'` is set on profile via `gmail-oauth-callback` (add this update).
- Token refresh logic in `send-email` already in place ✓.

Phase 2 note (NOT implementing now): reply detection would add `gmail.readonly` scope + an edge function polling `users.history.list` on cron, writing replies into `invoices.client_reply_*`. Documented in inline comment only.

### 5. SMTP fallback for non-Gmail users

New table:
```sql
CREATE TABLE public.smtp_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  from_email text NOT NULL,
  from_name text,
  smtp_host text NOT NULL,
  smtp_port int NOT NULL DEFAULT 587,
  smtp_username text NOT NULL,
  smtp_password text NOT NULL,  -- stored server-side; never returned to client
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.smtp_connections ENABLE ROW LEVEL SECURITY;
-- RLS: users can SELECT (without password column via view) / INSERT / UPDATE / DELETE own row
```

Plus a SECURITY DEFINER view `smtp_connections_safe` exposing everything except `smtp_password`, used by the client.

New edge function `smtp-send/index.ts`:
- Uses `https://deno.land/x/denomailer@1.6.0/mod.ts`
- Auth-validates user, loads their `smtp_connections` row via service-role, sends email, returns `{ success, messageId }`
- Same request shape as `send-email`: `{ to, subject, message }`

New edge function `smtp-verify/index.ts`:
- Tests SMTP credentials by opening a connection (no send), returns `{ verified: true/false, error }`
- Sets `verified = true` on success

Modify `send-email`:
- After auth, look up `profiles.sender_type`
- If `gmail` → existing Gmail flow
- If `smtp` → forward to `smtp-send` logic (refactor: extract `sendViaGmail` / `sendViaSmtp` into one dispatcher function)
- If `none` → 400 "No sending mailbox connected"

### 6. Settings UI — sending mailbox

In existing "Connected services" section of `SettingsScreen.tsx`:
- Show **active sender** badge (Gmail / SMTP / None)
- Card 1: Gmail — existing connect/disconnect (unchanged copy already adapts to Google users)
- Card 2: "Other email (SMTP)" — collapsible form with provider preset dropdown (Outlook, Yahoo, iCloud, Custom) auto-filling host/port; fields: From name, From email, Username, Password (app-specific password helper link per preset). On save → call `smtp-verify` then store. Disconnect button when configured.
- Active sender selector (radio) only shown when both are connected: "Send follow-ups using: ◉ Gmail ○ SMTP" → updates `profiles.sender_type`

### 7. Frontend hook

New `src/hooks/useSendingMailbox.ts`:
- Returns `{ activeSender, hasGmail, hasSmtp, canSend, setActiveSender }`
- Used by Dashboard banner + Invoice Detail send guard

Replace Dashboard "Connect Gmail" CTA with adaptive: 
- Google user, no permission → "Grant Gmail permission"
- Email user, no SMTP → "Connect your email to send follow-ups" → opens Settings SMTP card
- Has any active sender → no banner

### 8. Files

**Migrations** (1 file):
- Add columns to `profiles`, create `smtp_connections` + RLS + safe view, update `handle_new_user` trigger

**Edge functions**:
- New: `supabase/functions/smtp-send/index.ts`
- New: `supabase/functions/smtp-verify/index.ts`
- Edit: `supabase/functions/send-email/index.ts` (dispatcher)
- Edit: `supabase/functions/gmail-oauth-callback/index.ts` (set `sender_type = 'gmail'` on success)
- Edit: `supabase/config.toml` (register new functions)

**Frontend**:
- Edit: `src/pages/AuthScreen.tsx` (full rebuild)
- Edit: `src/pages/SettingsScreen.tsx` (add SMTP card + active sender selector)
- Edit: `src/pages/DashboardScreen.tsx` (adaptive sender banner)
- Edit: `src/context/AppContext.tsx` (expose `fullName` from profile)
- New: `src/hooks/useSendingMailbox.ts`
- Edit: `src/hooks/useGmailConnection.ts` (minor — no longer owns the banner logic)

### Edge cases & assumptions
- Email signup auto-confirm is already enabled (per memory) — no `/reset-password` page in this scope.
- SMTP password stored as plaintext server-side initially; encryption-at-rest via pgsodium can be added later. Never returned to client (safe view excludes it).
- Outlook/Yahoo/iCloud require app-specific passwords — preset cards include help links.
- Reply detection (Gmail readonly + IMAP) explicitly out of scope; UI relies on user marking invoices paid.
- Apple sign-in deferred per revised scope.

### User flow summary
1. New visitor → `/auth` → choose Google or email/password (with name on signup).
2. Google user → lands on dashboard → one-tap "Grant Gmail permission" → done. `sender_type=gmail`.
3. Email user → lands on dashboard → banner "Connect your email to send follow-ups" → Settings → SMTP form → verify → done. `sender_type=smtp`.
4. Sending an invoice follow-up always calls `send-email`, which dispatches to the right provider transparently.

