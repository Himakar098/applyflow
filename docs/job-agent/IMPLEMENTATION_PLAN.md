# Job Agent implementation plan

## Repository decision

ApplyFlow already provides the right foundation: Next.js 16 App Router, TypeScript, Firebase Auth, server-side Firebase Admin access, Firestore, Firebase Storage, the official OpenAI SDK, Tailwind/shadcn UI, and Playwright tests. The Job Agent will therefore be integrated into the existing application rather than scaffolded as a second deployable app. `apps/job-agent/README.md` will document that integration decision and the local browser-worker boundary.

## Delivery plan

1. **Make submission fail closed**
   - Remove the legacy `autoSubmit` setting and extension click path.
   - Replace placeholder scheduler “submitted” receipts with review-required states.
   - Require a per-application, single-use submission approval bound to the current autofill-plan hash.
   - Pause on CAPTCHA, MFA, legal declarations, unknown questions, identity claims, and sensitive demographics.

2. **Add the Job Agent domain and deterministic gates**
   - Add Zod schemas for claim-aware candidate profiles, extracted jobs, eligibility, fit assessments, applications, documents, answers, browser sessions, approvals, audit events, interviews, and follow-ups.
   - Seed Himakar's non-sensitive verified profile and the required sample jobs without private contact data or invented metrics.
   - Implement deterministic eligibility, transparent weighted fit scoring, duplicate detection, truthfulness checks, application state transitions, and audit redaction.

3. **Add server persistence and APIs**
   - Reuse owner-scoped Firestore data accessed only through authenticated Admin-SDK routes.
   - Add profile, job import/extraction, assessment, application, document, answer, approval, audit, and CSV-export endpoints with runtime validation, size/origin checks, rate limits, and safe URL handling.
   - Use a deterministic provider for local tests and the OpenAI Responses API with Zod structured outputs for live extraction and grounded document generation.

4. **Add the product workflow**
   - Add dashboard, profile, job intake/detail/assessment, application tracker/detail/documents/answers/autofill, resume, settings, and audit surfaces.
   - Preserve existing routes while linking them to the new Job Agent workspace.
   - Show claim provenance, inferred fields, eligibility evidence, fit-score breakdowns, gaps, document review, field provenance/confidence, activity logs, and approval state.

5. **Add grounded document exports**
   - Build a canonical evidence-grounded resume/cover-letter model.
   - Export DOCX and PDF beneath `storage/generated/applications/<application-id>/` for local use, with safe filenames and traversal protection.
   - Keep private generated artifacts and local browser state Git-ignored; use Firebase Storage for durable production persistence.

6. **Add the local Playwright browser bridge**
   - Add `packages/browser-bridge/` interfaces plus a visible Chromium implementation using `launchPersistentContext` and `.local/job-agent-browser/`.
   - Support generic, Greenhouse, and Lever inspection/capture; keep Workday, SmartRecruiters, SuccessFactors, PageUp, and Ashby behind adapters.
   - Add local Generic, Greenhouse, Lever, and Workday-like fixtures, screenshots, pause/resume, uploads, and explicit submit approval.

7. **Test, evaluate, and document**
   - Add unit, integration, structured-output, truthfulness, eligibility, duplicate, browser-mapping, and approval-gate tests.
   - Add a Playwright end-to-end mock-portal path that proves zero submissions before approval and exactly one after a valid approval.
   - Add a deterministic evaluation harness that invokes the real domain/orchestrator path.
   - Add architecture/security/data/browser/user/deployment/limitations docs and rendered PNG diagrams.

## Validation contract

Run, fix, and report:

```bash
npm run firebase:check
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run eval
npm run build
npm run package:extensions
git diff --check
```

Live employer portals remain user-directed and terms-compliant. The first complete automated path targets local fixtures; real portals always remain visible and supervised and never bypass CAPTCHA, MFA, access controls, or final approval.
