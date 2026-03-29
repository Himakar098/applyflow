# Contributing to ApplyFlow

Thanks for considering a contribution.

ApplyFlow is still early-stage. The most helpful contributions are the ones that improve clarity, correctness, setup reliability, and contributor confidence.

## Before you start
- Read the [README](./README.md) for project scope and current limitations.
- Check open issues first if you are planning a larger change.
- If your change affects setup, routing, extension behavior, or Firebase access, plan to update docs in the same pull request.

## Local setup
### Prerequisites
- Node.js 20+
- npm
- A Firebase project with Auth, Firestore, and Storage enabled

### Install
```bash
npm install
cp .env.example .env.local
```
Fill in the Firebase variables in `.env.local`.

### Run locally
```bash
npm run dev
```

## Recommended branch workflow
- Branch from `main`
- Use a short, descriptive branch name such as:
  - `docs/readme-cleanup`
  - `fix/recommendations-cache`
  - `feat/browser-extension-status`

## Coding expectations
- Keep changes scoped.
- Prefer TypeScript-safe, explicit code over clever shortcuts.
- Follow the existing Next.js App Router structure.
- Reuse shared UI components in `components/ui` where possible.
- Avoid broad refactors unless the pull request is specifically about that refactor.
- Do not introduce fake data, fake metrics, or exaggerated claims in docs.
- If you add or change environment variables, update `.env.example` and the README.
- If you change extension behavior, keep `extension/` assets and packaging instructions in sync.

## Verification before opening a pull request
Run what applies to your change:

```bash
npm run lint
npm run build
```

These commands mirror the current lightweight CI workflow.

If your change affects end-to-end behavior and you have credentials configured:
```bash
npm run test:e2e
```

If your change affects extension packaging:
```bash
npm run package:extensions
```

If your change affects deploy or beta controls:
```bash
npm run launch:check
```

## Pull request expectations
A good pull request should include:
- a clear summary of the change
- why the change was needed
- any setup or environment updates
- verification steps you ran
- screenshots or screen recordings for UI changes when practical

Please keep pull requests reviewable. Smaller, focused changes are preferred over large mixed PRs.

## Bug reports
When filing a bug report, include:
- what you expected
- what happened instead
- steps to reproduce
- relevant environment details
- screenshots or logs if available

Use the bug report template when possible.

## Feature requests
Feature requests are welcome, especially when they:
- fit the existing project direction
- are specific about the user problem
- explain why the current behavior is insufficient

Use the feature request template when possible.

## Areas where contributions are especially useful
- README and setup clarity
- Firebase configuration guidance
- test coverage and verification scripts
- browser-extension ergonomics
- recommendation quality and provider handling
- accessibility and responsive UI fixes

## Security
Do not open a public issue for sensitive security problems. Use the process in [SECURITY.md](./SECURITY.md).
