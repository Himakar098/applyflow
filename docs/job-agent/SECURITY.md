# Job Agent security and privacy

## Safety invariants

- `submissionMode` is fixed to `review_before_submit`.
- Final submission requires a persisted, unexpired, unused approval bound to one user, application, and autofill-plan hash.
- CAPTCHA, MFA, login, anti-bot checks, unknown legal declarations, identity claims, and sensitive demographic questions always pause.
- Citizenship, permanent residency, security clearance, licence, sponsorship, salary, notice period, and work-right answers come only from explicit candidate claims.
- Model output cannot write to a portal, change deterministic eligibility, or grant approval.

## Data protection

- Firebase bearer tokens are verified server-side for every private API.
- Firestore direct client access stays deny-by-default; Job Agent writes use the Admin SDK.
- `ENCRYPTION_KEY` enables AES-256-GCM encryption for private contact data. No private phone, email, or address is committed or placed in seed data.
- API keys, portal passwords, cookies, browser profiles, generated private documents, screenshots, traces, and eval results are excluded from Git.
- Audit events redact credentials, tokens, cookies, passwords, private keys, and full sensitive answer values.

## Request and file controls

- Mutating browser requests are same-origin checked; bearer-token authentication avoids cookie-CSRF coupling.
- JSON inputs have explicit byte limits and Zod schemas.
- User-directed URL imports allow only public HTTP(S) addresses, revalidate redirects, reject credential-bearing URLs, and block private/link-local/loopback targets.
- Generated paths use opaque safe IDs and server-generated filenames. Files are created with private permissions.
- Uploads remain owner-scoped and size/type limited by Firebase Storage rules and server validation.

## Operational requirements

- Use HTTPS for deployed UI traffic.
- Keep `OPENAI_API_KEY`, Firebase Admin credentials, `ENCRYPTION_KEY`, and monitoring tokens in the deployment secret store.
- Run the Playwright worker only on a trusted local machine; it is not a Vercel serverless function.
- Review dependency advisories and rotate any credential suspected of exposure.

