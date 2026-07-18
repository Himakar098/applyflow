# ApplyFlow browser bridge

This package provides the supervised, local browser boundary for ApplyFlow. It
uses a visible Chromium persistent context at `.local/job-agent-browser/` and
writes review screenshots to `output/playwright/`.

## Safety model

- Inspection and job extraction are read-only.
- Autofill runs only through `fillApprovedFields` with a matching,
  non-expired `AutofillAuthorization` created by an explicit user action.
- Only the field IDs listed in that authorization can be filled.
- Work rights, visa, citizenship, clearance, licence, salary, and availability
  answers require per-field review.
- CAPTCHA, identity, demographic, diversity, password, and legal-attestation
  fields are never filled automatically.
- `submitApprovedApplication` fails closed unless its caller supplies a
  `SubmissionApprovalProvider`. The provider must return a verified,
  non-expired approval matching the exact application, plan, and current URL.
- Submission controls are not exposed by the CLI and are clicked only when one
  unambiguous final control remains after approval verification.

The application should persist approvals server-side and implement the provider
against that trusted store. A browser/client-supplied boolean is not sufficient.

## Local worker

After Playwright and Chromium are installed, the worker can be run directly:

```bash
npx tsx packages/browser-bridge/src/cli.ts open http://localhost:3000/job-agent-fixtures/
npx tsx packages/browser-bridge/src/cli.ts inspect http://localhost:3000/job-agent-fixtures/generic.html
```

Press `Ctrl+C` to close an `open` session. Authenticated sessions remain in the
local persistent profile. Never commit that directory.

## Portal support

Generic, Greenhouse, and Lever forms are inspected through supported adapters.
Workday, SmartRecruiters, SuccessFactors, PageUp, and Ashby are detection-only
stubs: when detected, the bridge pauses and leaves the visible browser available
for manual completion.

## Future Manifest V3 extension

`BrowserBridge` deliberately defines transport-neutral operations:

- `captureCurrentPage`
- `extractVisibleJob`
- `inspectForm`
- `requestAutofillPlan`
- `fillApprovedFields`
- `reportPageState`

A future extension can implement this interface by sending narrow messages to a
local authenticated service. It should request host access only for the active
tab after a user gesture, preserve the same approval objects, and keep final
submission behind the server-side `SubmissionApprovalProvider`. No extension
permissions are requested by this implementation.
