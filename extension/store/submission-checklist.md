# Store Submission Checklist

## Before upload

- Run `npm run lint`
- Run `npm run build`
- Run `npm run package:extensions`
- Confirm `manifest.json` version is correct
- Confirm `icons/` assets exist and load correctly
- Confirm store zip has `manifest.json` at zip root

## Functional QA

- Sync context from ApplyFlow into the extension
- Run autofill on a supported ATS page
- Verify popup copy and status text
- Verify failure behavior when no context exists
- Verify extension does nothing until user action

## Reviewer-facing docs

- Listing copy finalized
- Permissions justification ready
- Privacy disclosure ready
- Support email confirmed: `support.applyflow@gmail.com`
- Privacy policy URL confirmed: `https://applyflow.com/privacy`

## Store media

- Screenshots exported
- Promotional tile prepared if needed
- Small and large icon requirements checked

## After submission

- Track review feedback
- Prepare a reviewer note about broad host permissions
- Keep a changelog for future updates
