# Changelog

All notable changes to this project should be documented in this file.

This changelog starts with the repository’s first public open-source preparation pass. Earlier development happened before a formal changelog process was in place and is not backfilled commit-by-commit.

## [Unreleased]
### Added
- Firebase emulator seed script and local emulator workflow documentation
- Firebase config validation script and CI check

### Documentation
- Added `v0.1.1` release notes draft

## [0.1.1] - 2026-03-29
### Added
- Repo-managed Firebase configuration via `.firebaserc` and `firebase.json`
- Versioned Firestore rules, Storage rules, and Firestore indexes
- Optional Firebase emulator configuration and local emulator scripts

### Changed
- Tightened Firestore client rules to explicit user-scoped collections currently accessed in the browser
- Updated setup and deployment docs to cover Firebase deployment and emulator usage

### Notes
- This release brings Firebase configuration into the repository so rule and index changes are auditable and deployable from source control.

## [0.1.0] - 2026-03-29
### Documentation
- Reworked the public README for open-source clarity
- Added contributor, support, security, and release documentation
- Added repository metadata suggestions and GitHub templates
- Added a lightweight GitHub Actions CI workflow for lint and build
- Moved older internal summary documents into `docs/archive/`
### Included in scope
- Candidate profile management
- Resume upload and extraction
- Job search and recommendations
- Job tracker and job workspace flows
- Tailored application material generation
- Apply Assistant and companion browser extension
- Public marketing pages and beta access controls
- Launch and deployment support scripts

### Notes
- This entry represents the first tagged public open-source baseline.
