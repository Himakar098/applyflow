# Open Source Upgrade Plan

## Observed repository state
- `applyflow` is a Next.js + Firebase application for profile-based job search, application tracking, tailored application materials, and assisted employer-site autofill.
- The repository already includes substantial product code, but the public repository surface is not yet OSS-ready.
- Current documentation is useful for internal delivery, but it is fragmented across multiple summary files and does not yet present the project as a clean public open-source repository.
- The repo currently has no explicit open-source license file.

## Upgrade goals
1. Rewrite the repository-facing documentation so a public visitor can quickly understand what the project is, who it is for, what is stable, and what is still experimental.
2. Add the standard OSS support files expected in a maintained project.
3. Add contributor and maintenance guidance that is practical and honest about the repo’s maturity.
4. Prepare the repository for a first public release without inventing release history or adoption signals.

## Planned changes
1. Create `docs/oss/REPO_METADATA_SUGGESTIONS.md` with suggested GitHub description, About text, and topics.
2. Replace the current `README.md` with a stronger public OSS README covering purpose, architecture, setup, development, verification, roadmap, limitations, contribution flow, and licensing.
3. Add missing OSS support files:
   - `CONTRIBUTING.md`
   - `CODE_OF_CONDUCT.md`
   - `SECURITY.md`
   - `SUPPORT.md`
   - `CHANGELOG.md`
   - `LICENSE`
   - `AGENTS.md`
4. Add GitHub collaboration templates:
   - `.github/ISSUE_TEMPLATE/bug_report.md`
   - `.github/ISSUE_TEMPLATE/feature_request.md`
   - `.github/pull_request_template.md`
5. Add release/application support docs:
   - `docs/oss/RELEASE_NOTES_v0.1.0.md`
   - `docs/oss/CLAUDE_OPEN_SOURCE_APPLICATION_NOTES.md`
6. Keep `.env.example` accurate and public-safe, but make it easier to understand from a contributor perspective.
7. Run the available verification commands and document only what is actually present.

## Verification plan
- `npm install`
- `npm run lint`
- `npm run build`
- `npm run test:e2e` when test credentials are available
- Document missing or conditional verification steps instead of overstating maturity
