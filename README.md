# Daily Health Tracker

A mobile-first, responsive **Exercise & Medicine Tracker** built with plain HTML, CSS, and JavaScript.

The app is designed for easy use on phones while also working comfortably on desktop/PC.

## Features

### 🏋️ Exercise Tracker
- Monthly calendar
- Tap a date to record a workout
- Upper Body — Cyan
- Lower Body — Saffron
- Jogging / Cardio — Forest Moss
- Day Off / No Workout — No color
- Monthly workout totals
- Monthly exercise history
- CSV export for Excel

### 💊 Medicine Tracker
- Add multiple medicines
- Optional dosage
- Record multiple medicines/doses on the same day
- Automatically starts with the current time
- Time can be adjusted
- Monthly medicine calendar
- Medicine records are scrollable
- My Medicines can be hidden for privacy in public places
- CSV export for Excel

### 💾 Backup & Data
- Full JSON backup
- JSON import
- Clear-all-data confirmation
- Data is stored locally in the browser

## Privacy

This app does **not** require a server or database.

Tracker data is stored in the browser's `localStorage`.

The GitHub repository contains only the application source code. Personal exercise and medicine records are not included in the repository.

Use **Backup / Import → Export Backup** to save your personal records.

## Run locally

No build system is required.

1. Download or clone the repository.
2. Open `index.html` in a modern browser.

Chrome, Edge, Firefox, and Safari should support the application.

## GitHub Pages

This project can be hosted directly with GitHub Pages.

After pushing the repository:

1. Open the repository on GitHub.
2. Go to **Settings**.
3. Open **Pages**.
4. Select the branch containing the app.
5. Select the repository root (`/`) as the folder.
6. Save.
7. GitHub will provide the Pages address.

## Important

Because records are stored in browser `localStorage`, data is tied to the browser/device where it was entered.

If you change devices or browsers, export a JSON backup first and import it on the new device.

## Files

```text
index.html   - App structure
style.css    - Dark/neon responsive design
app.js       - Tracker logic and local storage
.gitignore   - Git ignore rules
README.md    - Project documentation
```

## License

This project does not currently specify a license.
