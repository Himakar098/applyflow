# ApplyFlow

ApplyFlow is an early-stage open-source job search workspace built with Next.js, Firebase, and TypeScript. It brings together profile building, resume handling, job search, recommendations, application tracking, tailored application materials, and an assisted employer-site apply flow backed by a browser extension.

This repository is best understood as a real product codebase that is still maturing in public. Core flows exist and the project is actively shaped, but it is not yet a polished universal auto-apply system or a long-established OSS project.

## Why this project exists
Most job searches still sprawl across resumes, notes, spreadsheets, job boards, and employer-specific forms. ApplyFlow is an attempt to consolidate that workflow into one workspace: keep a structured candidate profile, search and review roles, track applications, generate tailored materials, and reduce repetitive form entry on employer careers pages.

## What it does today
- Build a candidate profile manually or from uploaded resume text.
- Store resumes and supporting documents in Firebase Storage.
- Search jobs through provider-backed APIs.
- Generate profile-based job recommendations.
- Track applications and status changes in a job workspace.
- Generate tailored resume, cover-letter, and bullet content.
- Assist with employer-site applications through a browser extension for supported portals.
- Collect in-app feedback and basic operational telemetry.

## Who it is for
- Contributors interested in a practical Next.js + Firebase product codebase.
- Developers exploring applied AI, workflow tooling, or browser-extension-assisted form filling.
- Job seekers or builders who want to inspect, adapt, or self-host the project.

## Project status
ApplyFlow is currently **pre-1.0**.

### Credible today
- Core dashboard, auth, profile, resume, search, recommendations, and job-tracking flows exist.
- The project has real deployment, packaging, and verification scripts.
- A browser-extension-assisted apply flow exists for supported employer portals.
- Public repo basics are now in place: README, contribution guidance, security policy, issue templates, release notes draft, and changelog.

### Still maturing
- Employer-site automation coverage varies by portal.
- Auto-apply behavior is assisted, not universal or fully autonomous.
- Firebase setup is required before most flows are useful locally.
- Automated verification is still relatively light.
- The public commit history is active but short.

## Feature overview

### Candidate workspace
- Email/password auth and optional Google sign-in
- Candidate profile with target roles, location preferences, work mode, seniority, skills, experience, education, and links
- Resume library and supporting document storage

### Job discovery and tracking
- Job search via configured providers
- Profile-driven recommendations with refresh and hide/save flows
- Job tracker with statuses such as `saved`, `applied`, `interview`, `rejected`, `ghosted`, and `offer`
- Job-specific workspace pages with notes and activity context

### Tailoring and assisted apply
- Resume and job description parsing
- Tailored application material generation
- Apply Assistant route for job-level application support
- Browser extension for supported ATS and company careers pages
- Pause/resume behavior when the user clears login walls, CAPTCHA, MFA, or similar blockers manually

### Operational support
- Health endpoint
- Optional Sentry integration
- Public beta / waitlist / invite-mode controls
- Feedback capture routed into Firestore

## Tech stack
- **Framework:** Next.js App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS, shadcn/ui, Radix UI
- **Auth / data / storage:** Firebase Auth, Firestore, Firebase Storage, Firebase Admin SDK
- **AI integrations:** OpenAI-ready service layer
- **Testing:** Playwright smoke tests
- **Extension:** Chromium extension plus Safari wrapper project

## Repository structure
```text
app/                  Next.js routes, API routes, layouts, pages
components/           UI, dashboard, marketing, onboarding, and shared components
lib/                  Firebase, auth, AI, recommendations, extension, auto-apply, and utility logic
extension/            Browser extension source, Safari wrapper, and store-submission assets
scripts/              Packaging, perf smoke, launch checks, and helper scripts
tests/                Playwright smoke tests
docs/                 Deployment, beta-launch, and archived implementation docs
public/               Static assets and downloadable extension packages
```

## Documentation map
Use the docs in this order:
- `README.md` for project overview and setup
- `CONTRIBUTING.md` for contribution workflow
- `SUPPORT.md` and `SECURITY.md` for issue handling
- `docs/FIREBASE_EMULATORS.md` for local Firebase emulator and seed-data workflow
- `docs/README.md` for the rest of the documentation map

## Requirements
- Node.js 20+
- npm
- A Firebase project with Auth, Firestore, and Storage enabled
- Optional external API keys depending on which features you want to exercise

## Getting started
### 1. Install dependencies
```bash
npm install
```

### 2. Create local environment configuration
```bash
cp .env.example .env.local
```
Fill in Firebase values first. Most other variables are optional or only required for specific features.

### 3. Start the development server
```bash
npm run dev
```
Default local URL: `http://localhost:3000`

## Environment variables
The full template lives in [`.env.example`](./.env.example). The main groups are below.

### Required client configuration
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Required server-side Firebase access
Use one of these approaches:
- `FIREBASE_ADMIN_CREDENTIAL` (recommended)
- `FIREBASE_ADMIN_CREDENTIALS` (legacy fallback)
- or the split credentials:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`
  - `FIREBASE_STORAGE_BUCKET`

### Optional feature providers
- Job search:
  - `JOB_SEARCH_PROVIDER`
  - `ADZUNA_APP_ID`
  - `ADZUNA_APP_KEY`
  - `SERPAPI_API_KEY`
- AI features:
  - `OPENAI_API_KEY`
  - `JD_PARSE_USE_OPENAI`
  - `RECOMMENDATIONS_USE_OPENAI`
- Recommendations:
  - `RECOMMENDATIONS_PROVIDER`
- Monitoring:
  - `SENTRY_DSN`
  - `NEXT_PUBLIC_SENTRY_DSN`
  - `HEALTHCHECK_SECRET`

### Optional public-beta and extension settings
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `NEXT_PUBLIC_PUBLIC_BETA`
- `NEXT_PUBLIC_BETA_ACCESS_MODE`
- `BETA_ACCESS_MODE`
- `BETA_REQUIRE_APPROVED_USERS`
- `BETA_INVITE_CODES`
- `NEXT_PUBLIC_CHROME_EXTENSION_URL`
- `NEXT_PUBLIC_EDGE_EXTENSION_URL`
- `NEXT_PUBLIC_SAFARI_EXTENSION_URL`

## Firebase setup notes
1. Enable **Email/Password** auth. Enable **Google** only if you want that sign-in path.
2. Create a Firestore database.
3. Create a Firebase Storage bucket.
4. Add local and deployed domains to Firebase Auth authorized domains.
5. Supply Firebase Admin credentials for server routes.
6. Review the repo-managed Firebase config before using real user data:
   - `firebase.json`
   - `.firebaserc`
   - `firestore.rules`
   - `firestore.indexes.json`
   - `storage.rules`
7. Deploy the Firebase rules and indexes after you point the project alias at your Firebase project:
```bash
npm run firebase:deploy
```
8. For local emulator-based development, enable the emulator env values in `.env.local` and run:
```bash
npm run firebase:emulators
```
9. To seed a demo local user and test data into the emulators:
```bash
npm run firebase:seed
```

The Firestore emulator requires a local Java runtime.

The committed Firebase rules are intentionally conservative:
- Storage objects live under `users/{uid}/...`
- direct Firestore client access is limited to the authenticated owner for the few collections currently read or written in the browser
- broader user data access happens through trusted server routes or server actions using the Admin SDK
- top-level support/marketing/system collections remain server-only
- Storage uploads are limited to the file types and size constraints currently used by the app

## Local development workflow
After `npm run dev`, the most useful routes to exercise are:
- `/profile`
- `/resume`
- `/search`
- `/recommendations`
- `/jobs`
- `/jobs/[jobId]/apply-assistant`
- `/extensions`

## Verification
Use the exact commands below.

### Lint
```bash
npm run lint
```
Current state: passes with warnings, no lint errors.

### Build
```bash
npm run build
```
Current state: passes locally.

### End-to-end smoke tests
```bash
npm run test:e2e
```
Notes:
- Authenticated smoke tests require `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD`.
- Without those credentials, only the public smoke test path runs.
- Current state during this documentation pass: public smoke passed; authenticated smoke was skipped without credentials.

### API performance smoke
```bash
PERF_BEARER_TOKEN=<firebase-id-token> npm run perf:api
```
Notes:
- This is a lightweight API smoke script, not a formal load test.
- It requires a valid bearer token and a running or deployed app.

### Launch readiness check
```bash
npm run launch:check
```

### Firebase config validation
```bash
npm run firebase:check
```

### Firebase emulator seed data
```bash
npm run firebase:seed
```

## CI and maintenance signals
This repository now includes:
- standard OSS support files
- issue and PR templates
- draft release notes and changelog discipline
- a lightweight GitHub Actions workflow for `lint` and `build`

It does **not** yet have broad CI coverage or a formal release cadence.

## Deployment notes
- The app is structured for Vercel deployment.
- Firebase must be configured for both client and admin SDK access.
- Firebase rules and indexes are versioned in this repo and can be deployed with `npm run firebase:deploy`.
- Public beta mode is controlled by environment variables.
- Browser-extension one-click install links become active once store URLs are configured.

Useful docs:
- [`docs/PRODUCTION_DEPLOYMENT_STEPS.md`](./docs/PRODUCTION_DEPLOYMENT_STEPS.md)
- [`docs/BETA_GO_LIVE_CHECKLIST.md`](./docs/BETA_GO_LIVE_CHECKLIST.md)
- [`docs/PUBLIC_BETA_LAUNCH_CHECKLIST.md`](./docs/PUBLIC_BETA_LAUNCH_CHECKLIST.md)

## Browser extension
The extension source lives in [`extension/applyflow-autofill`](./extension/applyflow-autofill).

Current extension scope:
- supported ATS / employer-site autofill heuristics
- context sync from Apply Assistant
- assisted pause/resume flow after the user clears login, CAPTCHA, MFA, or anti-bot checkpoints manually

Important limitations:
- It does **not** bypass CAPTCHA, MFA, login walls, or anti-bot protections.
- It does **not** silently attach files; browser restrictions still require manual file selection.
- Coverage varies by employer site.

Package extension artifacts with:
```bash
npm run package:extensions
```

## Roadmap
The roadmap is intentionally modest and based on the current codebase.

### Near-term
- Improve Firebase setup guidance and security documentation.
- Expand automated verification beyond smoke coverage.
- Improve recommendation quality and job-source resilience.
- Reduce rough edges in extension install and employer-site handoff.

### Medium-term
- Broaden supported employer-site autofill coverage.
- Stabilize assisted apply and manual-task handoff.
- Improve observability and error triage for deployed environments.
- Publish the browser extension to public stores.

## Known limitations
- The repository is still early-stage and has a short public history.
- Some flows depend on external provider keys that are not bundled with the repo.
- The assisted apply and browser-extension flows are useful, but not universal automation.
- CI is lightweight; there is no broad regression suite yet.
- The project is currently best suited to contributors comfortable with Firebase-backed web apps.

## Contributing
Contributions are welcome. Start with [`CONTRIBUTING.md`](./CONTRIBUTING.md).

If you touch setup, environment variables, Firebase access, routing, or extension behavior, update the relevant docs in the same pull request.

## Support
- General usage and setup: [`SUPPORT.md`](./SUPPORT.md)
- Security issues: [`SECURITY.md`](./SECURITY.md)

## License
This repository is licensed under the [MIT License](./LICENSE).
