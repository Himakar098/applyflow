# Release Notes Draft: v0.1.1

> Status: draft only. This file prepares the repository for a follow-up public release. It does not imply that a GitHub release has already been published.

## Summary
`v0.1.1` is a maintenance release focused on Firebase repo hygiene and safer local development.

This release does not change the overall product scope. It makes the project easier to run and maintain by bringing Firebase configuration into source control, tightening direct client access rules, and adding emulator support for local work.

## What is working
- Repo-managed Firebase configuration:
  - `.firebaserc`
  - `firebase.json`
  - `firestore.rules`
  - `firestore.indexes.json`
  - `storage.rules`
- Firebase deploy command:
  - `npm run firebase:deploy`
- Firebase emulator command:
  - `npm run firebase:emulators`
- Seed script for local emulator data:
  - `npm run firebase:seed`
- CI validation for Firebase config consistency:
  - `npm run firebase:check`

## What changed from v0.1.0
- Tightened Firestore rules so direct browser access is limited to the collections currently used client-side.
- Added emulator wiring in the Firebase client for local-only development.
- Added documentation for local emulator setup and seeded demo data.
- Added CI validation so missing or mismatched Firebase config files fail early.

## What is still experimental
- Employer-site autofill coverage and heuristics
- Auto-apply/manual-task workflows
- Production monitoring and operational maturity beyond the current smoke checks

## Recommended release title
- `v0.1.1 — Firebase config and local development hardening`

## Suggested release summary
This release hardens ApplyFlow’s Firebase setup by moving rules and indexes into source control, tightening direct client access, and making local emulator-based development easier to reproduce.
