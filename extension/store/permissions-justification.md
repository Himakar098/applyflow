# Permissions Justification

## `activeTab`

Used to operate on the currently active employer application page only after the user opens the extension and runs autofill.

## `scripting`

Used for extension-driven interaction with supported application forms.

## `storage`

Used to store the current ApplyFlow context locally in the browser so the user can move from the ApplyFlow app to the employer page.

## `tabs`

Used to locate the active tab and send autofill commands to that tab.

## Host permissions: `http://*/*`, `https://*/*`

Required because users may apply on many different employer career sites and ATS domains. The extension does not scrape arbitrary browsing activity; it acts only when the user explicitly runs autofill on the current page.

## Reviewer note

The broad host scope is necessary because employer application pages vary widely by company and ATS vendor. The extension is user-invoked and task-scoped, not background browsing automation.
