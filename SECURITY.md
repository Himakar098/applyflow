# Security Policy

## Supported versions
ApplyFlow does not yet maintain a long release history. For now, the actively maintained code is:
- the current `main` branch
- the current planned public release line (`v0.1.x` once tagged)

Older snapshots and pre-release branches should be treated as unsupported unless explicitly stated otherwise.

## Reporting a vulnerability
Please do **not** open a public GitHub issue for security-sensitive reports.

Instead, report security issues privately to:
- `support@omnari.world`

Include:
- affected area or file(s)
- reproduction steps or proof of concept
- impact assessment if known
- any proposed remediation ideas

## What to expect
The project is currently maintained as an early-stage repository, so response times may vary. Reasonable efforts will be made to:
- acknowledge a report
- reproduce the issue
- confirm severity
- ship a fix or mitigation when appropriate

## Security scope notes
Areas likely to need careful review include:
- Firebase Auth and token verification
- Firestore and Storage rules
- server-side Firebase Admin usage
- environment variable handling
- browser extension permissions and storage
- third-party API integrations

## Disclosure
Please avoid public disclosure until the issue has been reviewed and a fix or mitigation path is available.
