# ApplyFlow Production Deployment Steps

Last updated: March 6, 2026 (Australia/Perth)

## 1) Set Production Env Values (exact)

Set these exact non-secret values in production:

- `NEXT_PUBLIC_SITE_URL=https://applyflow.com`
- `NEXT_PUBLIC_SUPPORT_EMAIL=support.applyflow@gmail.com`
- `NEXT_PUBLIC_PUBLIC_BETA=true`
- `NEXT_PUBLIC_BETA_LABEL=Public Beta`
- `NEXT_PUBLIC_BETA_ACCESS_MODE=waitlist`
- `BETA_ACCESS_MODE=waitlist`
- `BETA_REQUIRE_APPROVED_USERS=true`
- Optional one-click extension links (set when store listings are approved):
  - `NEXT_PUBLIC_CHROME_EXTENSION_URL=<chrome-web-store-url>`
  - `NEXT_PUBLIC_EDGE_EXTENSION_URL=<edge-addons-url>`
  - `NEXT_PUBLIC_SAFARI_EXTENSION_URL=<app-store-url>`

If you decide to open public signup later, switch both to:

- `NEXT_PUBLIC_BETA_ACCESS_MODE=open`
- `BETA_ACCESS_MODE=open`

## 2) Set Required Secrets

- Firebase client vars: `NEXT_PUBLIC_FIREBASE_*`
- Firebase admin credential: `FIREBASE_ADMIN_CREDENTIAL` (recommended)
- AI and provider keys as used in production:
  - `OPENAI_API_KEY`
  - `ADZUNA_APP_ID`
  - `ADZUNA_APP_KEY`
  - `SERPAPI_API_KEY` (if used)
- Monitoring and ops:
  - `SENTRY_DSN`
  - `NEXT_PUBLIC_SENTRY_DSN`
  - `HEALTHCHECK_SECRET`

## 3) Launch Gate Commands

Run in CI or before production promote:

```bash
npm run lint
npm run build
npm run firebase:deploy
npm run launch:check
npm run test:e2e
```

Notes:
- `npm run launch:check` fails on missing required launch env values.
- `npm run firebase:deploy` publishes the repo-managed Firestore rules, Firestore indexes, and Storage rules to `applyflow-c9741`.
- `npm run test:e2e` authenticated tests require `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD`.

## 4) Post-Deploy Verification

- Verify public pages:
  - `/`
  - `/pricing`
  - `/resources`
  - `/about`
  - `/browser-extension`
  - `/waitlist`
- Verify auth gating behavior:
  - `/register` redirects to `/waitlist` when in waitlist mode.
  - `/api/auth/register` returns `waitlist_only` when in waitlist mode.
- Verify monitoring:
  - `/api/health`
  - `/api/health?deep=1` with `x-healthcheck-secret`

## 5) Controlled Rollout Plan

- Phase A (default): `waitlist` mode with strict approved-user gate enabled.
- Phase B: invite cohorts by setting `BETA_ACCESS_MODE=invite` and `BETA_INVITE_CODES`.
- Phase C: move to `open` only after support and recommendation quality remain stable for 7+ days.
