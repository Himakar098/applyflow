# Release Notes Draft: v0.1.0

> Status: draft only. This file prepares the repository for a first serious public release. It does not imply that `v0.1.0` has already been published.

## Summary
`v0.1.0` is the planned first public open-source release of ApplyFlow.

This release establishes the repository as a real, inspectable codebase for:
- candidate profile management
- resume and document handling
- job search and recommendations
- application tracking
- tailored application materials
- assisted employer-site apply flows

## What is working
- Next.js App Router application structure
- Firebase-backed auth, storage, and data flows
- Candidate profile and resume workflows
- Job search and profile-driven recommendations
- Job tracker and status progression
- Apply Assistant route and browser extension packaging
- Public marketing pages, public beta controls, and deployment helpers
- Basic repository verification commands (`lint`, `build`, smoke tests)

## What is still experimental
- Employer-site autofill coverage and heuristics
- Auto-apply and manual-task handoff flows
- Browser-extension support across the full range of employer portals
- Operational hardening beyond smoke-level checks
- Full public release discipline and release cadence

## Known limitations at this release line
- The browser extension does not bypass CAPTCHA, MFA, login walls, or anti-bot protections.
- File uploads remain manual.
- Some functionality depends on external provider keys.
- The test suite is not yet a broad regression suite.
- Repository history is still short and early-stage.

## Recommended tag
- `v0.1.0`

## Recommended release title
- `v0.1.0 — First public open-source baseline`

## Suggested announcement summary
ApplyFlow is an early-stage open-source job search workspace built with Next.js and Firebase. This first public release packages the existing product into a cleaner, contributor-ready repository with working core flows, explicit limitations, and a clear path for future iteration.

## What should come next
- expand automated test coverage
- tighten Firebase setup and security guidance
- improve recommendation quality and provider reliability
- broaden supported employer-site autofill coverage
- publish and document browser-extension store releases
