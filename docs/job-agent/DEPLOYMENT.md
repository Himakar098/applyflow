# Job Agent deployment

## Web application

ApplyFlow is prepared for Vercel. Configure Firebase client variables, Firebase Admin credentials, `OPENAI_API_KEY`, `OPENAI_MODEL`, `ENCRYPTION_KEY`, and `JOB_AGENT_BASE_URL` in the deployment secret store.

```bash
npm ci
npm run firebase:check
npm run lint
npm run typecheck
npm run test
npm run build
```

Deploy Firestore rules/indexes and Storage rules separately:

```bash
npm run firebase:deploy
```

The web app can analyse, persist, generate, track, and coordinate approvals when deployed. Local generated files are not durable on serverless storage. Durable Job Agent export upload to Firebase Storage is not implemented yet, so generate exports on a persistent trusted host or add owner-scoped Storage upload before relying on serverless production exports.

## Browser worker

The visible persistent Playwright worker is intentionally local. Do not deploy it as a Vercel Function. Run it on the user's trusted workstation and restrict any future bridge listener to authenticated loopback traffic. The browser profile must remain outside source control.

## Environment contract

Required for the web app: Firebase client configuration and Firebase Admin access. Required for live AI: `OPENAI_API_KEY` and optionally `OPENAI_MODEL`. Required for encrypted private profile fields: `ENCRYPTION_KEY`. `DATABASE_URL` is reserved because this checkout reuses Firestore rather than PostgreSQL. `BROWSER_HEADLESS` defaults to false; headed mode is the only supported initial behavior.

## Rollback

The Job Agent uses new user subcollections and routes. A web rollback does not delete them. Keep rules deny-by-default, restore the previous deployment, and leave submission automation disabled until the matching worker and approval schemas are deployed together.
