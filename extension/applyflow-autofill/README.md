# ApplyFlow Autofill Assistant (Chrome + Edge)

This extension helps users autofill job application forms using context generated in ApplyFlow.

ApplyFlow can now sync context directly into the extension when the user is on the Apply Assistant page. Manual JSON paste remains available as a fallback.

## ATS adapters included

- Workday
- Greenhouse
- Lever
- SuccessFactors
- iCIMS
- Taleo
- SmartRecruiters
- Workable
- Amazon Careers
- Meta Careers
- Rio Tinto Careers
- Government portal heuristic
- Generic fallback for other sites

## Install In Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder:
   - `/Users/krishna/Downloads/PersonalProjects/applyflow/extension/applyflow-autofill`

## Install In Edge

1. Open `edge://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder:
   - `/Users/krishna/Downloads/PersonalProjects/applyflow/extension/applyflow-autofill`

## Safari

Safari support ships as a wrapper Xcode project:

- `/Users/krishna/Downloads/PersonalProjects/applyflow/extension/applyflow-autofill-safari-project/ApplyFlow Autofill Safari/ApplyFlow Autofill Safari.xcodeproj`

See:

- `/Users/krishna/Downloads/PersonalProjects/applyflow/extension/README.md`

## How to use

1. In ApplyFlow, open the job Apply Assistant page:
   - `/jobs/<jobId>/apply-assistant`
2. If the extension is installed in the same browser, click **Sync to extension**.
3. Open the target application page (company careers site).
4. Open the extension popup.
5. If needed, paste JSON manually and click **Save context**.
6. Click **Autofill current page**.
7. Review fields and submit manually.

## Notes

- File upload fields cannot be reliably auto-populated due browser restrictions.
- Field mapping is heuristic; site-specific ATS structures vary even within the same platform.
- Always review answers before final submission.
