# Privacy Policy – WebSecBot
_Last updated: 2025-10-20_

WebSecBot is a client-side Chrome extension. All analysis is initiated by you and runs on your device.

## What the extension does
- Reads the current page and extracts public, technical information (forms, scripts, headers).
- Sends these extracted features to the **LLM endpoint you configure** using your own API key.
- Retrieves additional public data from a **security scanner service** to enrich results.

## Data handling
- Your API key is stored locally in Chrome’s storage area.
- We do not collect, transmit, or store personal information.
- The extension has no analytics or tracking.
- All third-party requests are made directly from your browser.

## Permissions
- `activeTab`, `scripting`, `storage`, `sidePanel`, `tabs`: for analyzing the active page and storing your settings.
- Optional `webRequest`: to read response headers of the analyzed site.

