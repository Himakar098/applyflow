# Browser automation

## Install and start

```bash
npm run browser:install
npm run dev
```

In another terminal, open a visible persistent session:

```bash
npm run browser:worker -- open http://127.0.0.1:3000/job-agent-fixtures/generic.html
```

Chromium profile data is stored under `.local/job-agent-browser/`. Log in to employer portals manually in that window; ApplyFlow does not store portal passwords.

## Supervised sequence

1. Move a reviewed application to `READY_FOR_REVIEW`, open its Autofill page, and request inspection.
2. Start the visible local worker and inspect visible controls. ApplyFlow records label, type, proposed value, source, confidence, and whether review is required.
3. Review the plan and explicitly start autofill.
4. The worker fills approved, non-sensitive fields and uploads selected files.
5. Unknown questions, legal/identity statements, optional demographics, CAPTCHA, MFA, and access challenges pause the session.
6. When all safe fields are ready, the worker reports `READY_TO_SUBMIT` and does not click the submit control.
7. Review the live portal and grant the application-specific final approval. The single-use approval is invalid if the plan changes.

## Recovery

- Resolve login, CAPTCHA, or MFA manually in the existing browser window, then use Resume from the authenticated Autofill console.
- Do not delete `.local/job-agent-browser/` while a session is active.
- If the local profile is corrupted, stop Chromium, move that directory to a backup, and reopen. This signs you out but does not delete Firestore application records.
- Screenshots and traces are stored under `output/playwright/` and should be deleted after debugging if they contain personal data.

## Portal policy

Greenhouse, Lever, and generic public pages have initial adapters. Workday-like pages are covered by fixtures and a prototype adapter. LinkedIn, SEEK, and Indeed are user-directed capture/manual-import surfaces only. The worker never evades bot detection or access controls.
