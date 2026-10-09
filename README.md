# Daily Health Tracker

A mobile-friendly, installable PWA for tracking exercise and medicine records. Built with plain HTML, CSS, and JavaScript.

## Features

- Three-button bottom navigation: **Exercise**, **Medicine**, and **Backup**
- Exercise calendar with workout categories
- Collapsible Monthly Summary and Exercise Records sections
- Medicine calendar with quick recording from a selected date
- Choose an existing medicine from a dropdown and select the time taken
- Compact, collapsible **My Medicines** section with Add Medicine inside it
- Hide/show medicine details for privacy while using the app
- CSV exports (Excel-compatible) and JSON backup/import
- Local browser storage
- iPhone Home Screen PWA support
- **No medicine reminders or push notifications**

## Deploy to GitHub Pages

1. Create a GitHub repository.
2. Upload the contents of this folder directly into the repository's root. Keep `index.html`, `app.js`, `style.css`, `manifest.json`, and `sw.js` at the root.
3. In the repository, open **Settings → Pages**.
4. Under build and deployment, choose **Deploy from a branch**.
5. Select the `main` branch and `/(root)`, then save.
6. Wait for GitHub Pages to publish the site and open the published URL.

## Install on iPhone

1. Open the published site in **Safari** on your iPhone.
2. Tap **Share → Add to Home Screen**.
3. Add it, then launch the app from the Home Screen.

## Important privacy notes

- Exercise and medicine records are stored in the browser's local storage on that device/browser. They are not automatically synced between devices.
- Export a backup regularly if you need to preserve your records.
- Do not upload exported backups or personal health records to GitHub. The `.gitignore` file excludes common backup/data folders, but always check what you commit.
- Clearing browser/site data or changing browsers/devices can make local records unavailable unless you have a backup.
- This app does not provide guaranteed alarms or background medicine reminders.

## Updating an existing deployment

Upload/commit the updated app files to the same repository and keep the same GitHub Pages URL. The service worker cache version is updated in `sw.js`; if the old interface remains visible, close and reopen the installed PWA or reload the site after the service worker refreshes.
