# Job Agent data model

Firestore remains the database. There is no relational migration; `firestore.indexes.json`, schemas, and seed validation are the migration contract.

## User-owned records

```text
users/{uid}/jobAgentProfile/current
users/{uid}/candidateClaims/{claimId}
users/{uid}/jobAgentJobs/{jobId}
users/{uid}/jobAssessments/{assessmentId}
users/{uid}/applications/{applicationId}
users/{uid}/applicationAnswers/{answerId}
users/{uid}/applicationDocuments/{documentId}
users/{uid}/browserSessions/{sessionId}
users/{uid}/autofillFields/{fieldId}
users/{uid}/approvals/{approvalId}
users/{uid}/auditEvents/{eventId}
users/{uid}/interviews/{interviewId}
users/{uid}/followUps/{followUpId}
```

Each record includes timestamps and ownership is derived from the authenticated parent user path. Jobs preserve the original description and mark inferred fields. Assessments store exact eligibility excerpts and the eight-category fit breakdown.

## Claim status

Every candidate claim is one of:

- `verified`
- `user-entered`
- `needs-confirmation`
- `prohibited-from-inference`

Citizenship, permanent residency, clearance, Australian licence, sponsorship, salary, and notice period never move from missing/ambiguous to affirmative through inference.

## Application states

```text
DRAFT -> READY_FOR_REVIEW -> APPROVED_FOR_AUTOFILL -> AUTOFILL_IN_PROGRESS
-> AUTOFILL_PAUSED -> READY_TO_SUBMIT -> SUBMISSION_APPROVED -> SUBMITTED
```

`FAILED` and `WITHDRAWN` are terminal alternatives. Transition validation is deterministic. A submission approval is single-use and bound to the current plan hash.

## Indexes

Composite indexes cover application status/date, company/role, fit score, eligibility, discovered/applied dates, closing dates, and due follow-ups. Deploy them with:

```bash
npm run firebase:deploy
```

