# Known limitations

- Real employer portals change frequently. Greenhouse, Lever, and generic public-page import have initial support; Workday support is a prototype and other adapters are interfaces/stubs.
- LinkedIn, SEEK, and Indeed require user-directed capture or manual import. There is no unattended scraping.
- CAPTCHA, MFA, login walls, legal attestations, identity declarations, and unknown questions require manual action.
- The browser worker is local and visible; it is not hosted in Vercel.
- The authenticated web console persists plans and approvals, while the local worker remains an isolated library/CLI boundary. The current CLI exposes open/inspect/capture only; production worker-to-web transport still needs an authenticated loopback connector.
- Firebase is the selected existing database. `db:migrate` validates the Firestore contract rather than running SQL migrations.
- PDF and DOCX pagination depends on the selected evidence. The exporter limits sections and bullets, but unusually long user-entered text can still require manual editing.
- Live AI quality and cost depend on `OPENAI_MODEL`; automated tests and evals use the deterministic provider.
- Direct company-page extraction only imports public HTML and rejects private/local network addresses. Some JavaScript-only pages require browser capture.
- Follow-up, LinkedIn, thank-you, and interview material are drafts only and are never sent automatically.
- Follow-up and interview-message generation is not wired into the UI/API yet. Tracking fields and reminders are implemented.
- Job Agent DOCX/PDF exports are local private files. Durable Firebase Storage upload and download links are not implemented for these new exports.
- Bulk deletion of Job Agent Firestore records has no UI yet.
- No application is discovered, selected, autofilled, or submitted merely because settings are enabled. The user chooses the role and starts each side-effecting step.
