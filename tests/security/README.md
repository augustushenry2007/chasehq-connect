# Security contract tests

Each test in this directory hits the staging environment and asserts a
security invariant — auth gating, IDOR resistance, rate-limit enforcement,
webhook-secret enforcement, prompt-injection sanitization, payload caps,
clientEntitlement rejection on `validate-apple-receipt`, etc.

These run nightly via `.github/workflows/api-security-tests.yml` against
staging only. Failures are advisory (Slack alert), not PR-blocking, because
staging can be flaky for unrelated reasons. The unit tests in
`supabase/functions/**/*.test.ts` are the PR-blocking gate.

## Required env

- `STAGING_SUPABASE_URL` — staging project URL
- `STAGING_ANON_KEY` — public anon key
- `TEST_USER_A_JWT` / `TEST_USER_B_JWT` — pre-minted JWTs for two seed users
  with at least one row each in `invoices`, `gmail_connections`,
  `subscriptions`. Mint with the Supabase admin API and rotate quarterly.

## Run locally

```bash
cp .env.security.example .env.security
# fill in values
export $(grep -v '^#' .env.security | xargs)
npm run test:security
```
