# ApplyFlow Agent Guide

## Repo purpose
ApplyFlow is a Next.js + Firebase job search workspace. The product combines candidate profile building, resume/document management, job search, recommendations, application tracking, tailored application materials, and an assisted employer-site apply flow backed by a browser extension.

## Key directories
- `app/`: Next.js routes, layouts, and API routes
- `components/`: UI, dashboard, marketing, onboarding, and feature components
- `lib/`: business logic, Firebase access, auth, AI helpers, recommendation logic, extension helpers, and utilities
- `extension/`: browser extension source, Safari wrapper, and store-submission assets
- `scripts/`: repo maintenance and packaging scripts
- `tests/`: Playwright smoke tests
- `docs/`: deployment and launch checklists
- `docs/archive/`: older implementation summaries kept for historical context, not as the primary source of truth
- `docs/oss/`: maintainer-facing repository and release-preparation notes

## Install
```bash
npm install
cp .env.example .env.local
```
Populate `.env.local` with Firebase and any optional provider keys you need.

## Run
```bash
npm run dev
```
Default local URL: `http://localhost:3000`

## Verification commands
### Lint
```bash
npm run lint
```

### Build
```bash
npm run build
```

### E2E smoke tests
```bash
npm run test:e2e
```
Notes:
- authenticated tests require `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD`
- without those, only the public smoke path is available

### Extension packaging
```bash
npm run package:extensions
```

### Launch readiness check
```bash
npm run launch:check
```

### Firebase rules and indexes deploy
```bash
npm run firebase:deploy
```

### API perf smoke
```bash
PERF_BEARER_TOKEN=<firebase-id-token> npm run perf:api
```

## Coding conventions inferred from the repo
- Use TypeScript throughout.
- Keep App Router conventions intact.
- Prefer shared UI primitives from `components/ui`.
- Keep Firebase client code in `lib/firebase/client.ts` and admin/server access in `lib/firebase/admin.ts`.
- Keep authentication and token verification changes explicit and conservative.
- Keep environment variable contracts documented in `.env.example` and `README.md`.
- Use concise, practical copy in docs; avoid overstating project maturity.

## What “done” means
A change is done when:
- the behavior or documentation is correct
- relevant docs are updated
- `npm run lint` passes
- `npm run build` passes
- any change-specific verification has been run and noted

If you change extension behavior, also refresh packaging artifacts with:
```bash
npm run package:extensions
```

## What not to change casually
- `lib/firebase/*`
- `lib/auth/*`
- `next.config.ts`
- `proxy.ts`
- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`
- browser extension permissions and store-facing files under `extension/`
- public beta access controls and environment contract

Changes in those areas should be minimal, well-justified, and documented.

## Documentation expectations
Update documentation when you change:
- environment variables
- setup or deployment flow
- routing or user-facing workflows
- browser extension install/use flow
- verification commands

At minimum, update the relevant sections in:
- `README.md`
- `.env.example`
- `docs/` files when launch or deployment behavior changes
