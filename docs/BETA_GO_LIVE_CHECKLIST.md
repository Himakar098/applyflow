# ApplyFlow Beta Go-Live Checklist

Last updated: February 26, 2026

## 1) Monitoring and Alerting

- [ ] Set `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` in production.
- [ ] Optional release upload: set `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.
- [ ] Configure uptime checks:
  - Public liveness: `GET /api/health`
  - Protected deep check: `GET /api/health?deep=1` with header `x-healthcheck-secret: <HEALTHCHECK_SECRET>`
- [ ] Alert policy:
  - API 5xx spike (`/api/jobs/search`, `/api/recommendations`, `/api/profile/save`)
  - High p95 latency (>3s sustained)

## 2) E2E Smoke

- [ ] Install browser binaries once:
  - `npx playwright install chromium`
- [ ] Set:
  - `E2E_TEST_EMAIL`
  - `E2E_TEST_PASSWORD`
  - Optional `E2E_BASE_URL` for deployed env
- [ ] Run:
  - `npm run test:e2e`

Critical covered flows:
- Public pages render.
- Login to dashboard.
- Save profile with required recommendation fields.
- Recommendations load + refresh action visible.
- Search API request succeeds from UI.

## 3) Analytics Funnel

Tracked user events:
- `signup_completed`
- `login_completed`
- `profile_saved`
- `search_run`
- `job_saved`
- `job_applied`
- `recommendation_saved`
- `recommendation_applied`
- `recommendation_refreshed`

Storage:
- Event stream: `users/{uid}/analyticsEvents`
- Aggregation: `users/{uid}/analytics/summary`

## 4) Security Baseline

- [ ] Firebase Auth providers reviewed (disable unused providers).
- [ ] Firestore rules enforce user isolation (`users/{uid}/...`).
- [ ] Storage rules enforce size limits and user path isolation.
- [ ] Rotate Firebase admin credentials for production.
- [ ] Restrict production env var access to least privilege.
- [ ] Enable audit logs for Firebase project.

## 5) Beta Support Loop

- [ ] In-app feedback form available at `/feedback`.
- [ ] Backend feedback intake path:
  - User copy: `users/{uid}/feedback`
  - Support queue: `support/feedback/items`
- [ ] Triage cadence:
  - Daily review for new items
  - SLA: first response under 24h for high-priority beta bugs

## 6) Performance Baseline

- [ ] Acquire a test bearer token for seeded beta user.
- [ ] Run API perf smoke:
  - `PERF_BEARER_TOKEN=<token> npm run perf:api`
- [ ] Capture and store:
  - success/failure counts
  - p50 and p95 for recommendations and search
