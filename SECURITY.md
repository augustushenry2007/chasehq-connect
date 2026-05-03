# Security Policy

## Reporting a vulnerability

If you discover a security issue in ChaseHQ, please **do not open a public GitHub issue**. Instead, report it privately:

- Email: augustus.fable.audio@gmail.com
- Or use GitHub's [private vulnerability reporting](https://github.com/augustushenry2007/chasehq-connect-main/security/advisories/new)

Include:
- A description of the issue and its impact
- Steps to reproduce (proof-of-concept code if relevant)
- Any suggested fix

You'll get an acknowledgement within 72 hours. We'll work with you on a fix and disclosure timeline.

## Scope

In scope:
- The web app (`src/`)
- Supabase Edge Functions (`supabase/functions/`)
- iOS app (`ios/App/`)
- Database migrations and RLS policies (`supabase/migrations/`)

Out of scope:
- Third-party services (Supabase, Google, Resend) — report directly to them
- Social engineering, physical attacks, denial of service via volume

## Pre-commit hook

This repo ships with a local secret-scanning pre-commit hook in [.githooks/pre-commit](.githooks/pre-commit). To enable it after cloning:

```bash
git config core.hooksPath .githooks
```

The hook uses [gitleaks](https://github.com/gitleaks/gitleaks) to block commits that contain secrets. Install it with:

```bash
brew install gitleaks
```

If gitleaks isn't installed, the hook is a no-op (it warns but doesn't block).
