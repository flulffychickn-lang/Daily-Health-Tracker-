# Daily Health Tracker


## iPhone PWA + Medicine Reminders

This version includes `manifest.json` and `sw.js` so the tracker can be installed from Safari to the iPhone Home Screen.

Each medicine can have multiple daily reminder times and a private notification message. The default message is:

**Monster needs med**

The notification does not reveal the medicine name.

### iPhone setup

1. Publish the repository with GitHub Pages.
2. Open the GitHub Pages site in **Safari on iPhone**.
3. Use Safari's **Share → Add to Home Screen**.
4. Open the installed Daily Tracker.
5. Configure a medicine reminder.
6. Allow notifications if iOS asks.

### Important limitation

Web/PWA notifications are controlled by iOS and Safari. This implementation is intended as a convenience reminder and should not be treated as a guaranteed medical alarm. For critical medication timing, keep the iPhone's built-in Reminders/Health or another dedicated medication reminder as a secondary safeguard.
