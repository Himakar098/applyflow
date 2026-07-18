# Job Agent user guide

## First-time setup

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run browser:install
npm run dev
```

Add Firebase values and `OPENAI_API_KEY` to `.env.local`. Set `OPENAI_MODEL` for live AI. Set `ENCRYPTION_KEY` before saving private contact details; use a random 32-byte base64 or 64-character hex key. Never commit `.env.local`.

## Build the candidate profile

Open `/profile`. The non-sensitive seed contains Himakar's verified education, experience, projects, skills, visa category, and explicit negative citizenship/PR/clearance/Australian-licence claims. Enter email, phone, address, salary choice, exact notice period, and sponsorship answer yourself. Review every `needs-confirmation` claim.

## Import and assess a job

- Paste a description at `/jobs/new`.
- Or enter a public employer, Greenhouse, or Lever URL.
- Or paste CSV content with company, title, description, location, source URL, and application URL columns.

The detail page preserves the original text, shows inferred fields, runs the deterministic eligibility gate, and displays fit weights, strengths, gaps, concerns, positioning, and recommendation. Do not proceed when the result is `INELIGIBLE`; review ambiguous wording when it is `NEEDS_REVIEW`.

## Generate documents and answers

Create an application, then open Documents. Review the evidence selected for the tailored resume and cover letter before exporting DOCX/PDF. Unsupported metrics or claims are rejected. Selection criteria with weak evidence contain `[USER INPUT REQUIRED]`.

Open Answers to review work-right, visa, salary, availability, and standard narrative answers. Immigration-sensitive wording always requires confirmation.

## Autofill and submit

Move the application to `READY_FOR_REVIEW`, open Autofill, request inspection, and start the visible Playwright worker with the command shown in the console. Review the saved field plan and check each field you approve. Autofill approval does not approve submission. The browser stops before final submission; only grant submission approval after reviewing the employer page. That approval applies once to that application and exact plan.

## Tracker, follow-ups, and export

Use `/applications` for status, dates, documents, answers, contacts, interviews, notes, outcomes, and follow-up dates. Download a spreadsheet-compatible CSV from the tracker. Follow-up message generation is not wired into this version; no messages are sent automatically.

## Delete personal data

Delete generated local files under `storage/generated/applications/<application-id>/`, browser sessions under `.local/job-agent-browser/`, and screenshots under `output/playwright/`. Delete the user-owned `jobAgentProfile`, `jobAgentJobs`, `jobAssessments`, `applications`, `applicationAnswers`, `applicationDocuments`, `browserSessions`, `approvals`, and `auditEvents` subcollections through the Firebase console or an owner-authenticated administrative deletion workflow. There is no bulk-delete UI yet. Deleting a browser profile signs you out of employer portals.

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run eval
npm run build
```
