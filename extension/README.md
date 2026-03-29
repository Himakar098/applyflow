# ApplyFlow Browser Extensions

ApplyFlow now ships with:

- A Chromium extension for Chrome and Edge:
  - `/Users/krishna/Downloads/PersonalProjects/applyflow/extension/applyflow-autofill`
- A Safari Web Extension wrapper project:
  - `/Users/krishna/Downloads/PersonalProjects/applyflow/extension/applyflow-autofill-safari-project/ApplyFlow Autofill Safari/ApplyFlow Autofill Safari.xcodeproj`

## Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select:
   - `/Users/krishna/Downloads/PersonalProjects/applyflow/extension/applyflow-autofill`

## Edge

1. Open `edge://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select:
   - `/Users/krishna/Downloads/PersonalProjects/applyflow/extension/applyflow-autofill`

## Safari

1. Open the Xcode project:
   - `/Users/krishna/Downloads/PersonalProjects/applyflow/extension/applyflow-autofill-safari-project/ApplyFlow Autofill Safari/ApplyFlow Autofill Safari.xcodeproj`
2. In Xcode, choose your signing team for both the app target and the extension target.
3. Build and run the `ApplyFlow Autofill Safari` app on your Mac.
4. In Safari, open `Safari > Settings > Extensions`.
5. Enable `ApplyFlow Autofill Safari`.

## Notes

- Chrome and Edge use the same Manifest V3 codebase.
- Safari uses the generated wrapper project because Safari extensions must be shipped as an app extension.
- File upload fields still require manual user action because browsers block programmatic file selection.
