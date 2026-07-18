# ApplyFlow Job Agent

The Job Agent is integrated into the repository's existing Next.js application. This directory records that architecture decision; it is not a second frontend or a separate deployment.

Application code lives in:

- `app/(dashboard)/job-agent`, `jobs`, `applications`, `resumes`, `settings`, and `audit`
- `app/api/job-agent`
- `lib/job-agent`
- `packages/browser-bridge`

## Local start

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run browser:install
npm run dev
```

Use Firebase emulators for isolated local data:

```bash
npm run firebase:emulators
npm run db:seed
```

Run the visible browser worker in another terminal only when using supervised autofill:

```bash
npm run browser:worker -- open http://127.0.0.1:3000/job-agent-fixtures/generic.html
```

The worker stores authorised browser sessions under `.local/job-agent-browser/`, which is Git-ignored. It never bypasses CAPTCHA, MFA, login walls, access controls, or final approval.

See [`docs/job-agent/USER_GUIDE.md`](../../docs/job-agent/USER_GUIDE.md) for the complete workflow.
