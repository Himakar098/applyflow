# ApplyFlow Public Beta Launch Checklist

Last updated: March 6, 2026

## 1) Access Model

- [ ] Choose one beta access mode before launch:
  - `NEXT_PUBLIC_BETA_ACCESS_MODE=open`
  - `NEXT_PUBLIC_BETA_ACCESS_MODE=waitlist`
  - `NEXT_PUBLIC_BETA_ACCESS_MODE=invite`
- [ ] If using invite mode, set `BETA_INVITE_CODES` with the initial invite batch.
- [ ] For strict invite/waitlist gating, set `BETA_REQUIRE_APPROVED_USERS=true`.
- [ ] Confirm the public CTA path matches the chosen mode on:
  - `/`
  - `/register`
  - `/login`
  - `/pricing`
  - `/resources`
  - `/about`
  - `/browser-extension`

## 2) Production Environment

- [ ] Set `NEXT_PUBLIC_SITE_URL=https://applyflow.com`
- [ ] Set `NEXT_PUBLIC_SUPPORT_EMAIL=support.applyflow@gmail.com`
- [ ] Set Firebase client variables for production.
- [ ] Set Firebase admin credentials for server routes.
- [ ] Set `NEXT_PUBLIC_PUBLIC_BETA=true`
- [ ] Optional branding overrides:
  - `NEXT_PUBLIC_BETA_LABEL`
  - `NEXT_PUBLIC_BETA_BANNER_TEXT`

## 3) Monitoring and Recovery

- [ ] Enable Sentry in production.
- [ ] Turn on uptime monitoring for `/api/health`.
- [ ] Verify alerts route to the owner on call.
- [ ] Confirm support inbox is monitored daily.
- [ ] Test one real failure path and verify it appears in monitoring.

## 4) Public UX and Messaging

- [ ] Verify the beta banner is visible on public marketing pages.
- [ ] Verify `/browser-extension` is accessible without login.
- [ ] Verify `/waitlist` form stores entries successfully.
- [ ] Verify `/api/auth/register` respects waitlist/invite rules.
- [ ] Review copy for accuracy:
  - no universal auto-apply claims
  - no unsupported “one-click everywhere” promise
  - confirm extension limitations are explicit
- [ ] Verify legal pages show:
  - domain `https://applyflow.com`
  - support email `support.applyflow@gmail.com`

## 5) Browser Extension Readiness

- [ ] Rebuild the browser extension packages.
  - `npm run package:extensions`
- [ ] Validate fresh install on:
  - Chrome
  - Edge
  - Safari (wrapper project on macOS)
- [ ] Test context sync from Apply Assistant to the extension.
- [ ] Test at least one supported ATS flow end to end.
- [ ] Keep the public guide current at `/browser-extension`.

## 6) Beta Operations

- [ ] Define the first beta cohort size.
- [ ] Set a response SLA for beta support.
- [ ] Review new feedback items daily.
- [ ] Document the fallback path when autofill fails:
  - open employer page
  - use Apply Assistant answer bank
  - finish manually
  - mark applied in tracker
- [ ] Prepare a short beta welcome email with:
  - setup steps
  - extension install guide
  - support contact

## 7) Final Verification

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] Manual mobile test at 360px
- [ ] Manual tablet test at 768px
- [ ] Manual desktop test at 1280px
- [ ] Manual check of:
  - recommendations refresh
  - apply assistant launch
  - waitlist submission
  - login
  - forgot password

## 8) Launch Gate

Public beta is ready only if all of the following are true:

- [ ] Public CTA path matches the chosen access model.
- [ ] Waitlist or invite flow is working in production.
- [ ] Monitoring and support are active.
- [ ] Extension guide is live and accurate.
- [ ] At least one supported employer application flow has been validated on the deployed environment.
