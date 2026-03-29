# Claude for Open Source Application Notes

## Why this repo may be worth considering
ApplyFlow is a real product codebase rather than a demo-only repository. It has working application logic across authentication, Firebase-backed data handling, job search, recommendations, application tracking, tailored application materials, and a browser-extension-assisted employer-site flow.

## Why it looks like a maintained project
- The repository contains a non-trivial Next.js + Firebase application with multiple user flows, not a single-page prototype.
- It includes deployment, launch-check, extension-packaging, and smoke-test scripts.
- The codebase has supporting docs for deployment, beta rollout, and extension packaging.
- This open-source preparation pass adds the standard maintenance files expected in a public project: README, contribution guidance, security policy, issue templates, release notes, changelog discipline, and a lightweight CI workflow.

## Honest maintenance evidence from git history
Recent visible commit history is short but active, with iterative work in February 2026:
- `dd11d5d` on 2026-02-02: initial commit
- `0272470` on 2026-02-02: MVP progress
- `1e41e67` / `ac46341` / `1fd6487` on 2026-02-03: resume uploader, recommendations, gamification, and fixes
- `099cd7e` on 2026-02-05: landing page / public-facing work
- `dd17192` on 2026-02-14: search recommendation fixes and testing
- `740f121` on 2026-02-18: error fixes

The commit messages are informal, but they do show ongoing product iteration rather than a one-off abandoned prototype.

## Why it may fit the “quietly useful / apply anyway” category
This is not a large or widely adopted project, and the repository should not be presented that way. The value is in the substance of the codebase: it is a real, multi-surface product with operational concerns, documentation needs, and room for meaningful OSS improvement. It is the kind of project that can become more useful through structured maintenance and thoughtful iteration.

## Short draft paragraph for an application form
ApplyFlow is an early-stage open-source job search workspace built with Next.js, Firebase, and TypeScript. It includes working flows for profile management, resume handling, job search, recommendations, application tracking, tailored application materials, and assisted employer-site autofill via a companion browser extension. The project is still small and maturing, but it is an actively iterated real-world codebase rather than a tutorial or toy app, and I am investing in making it contributor-ready and publicly maintainable.
