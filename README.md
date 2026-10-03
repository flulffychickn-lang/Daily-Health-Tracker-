# Daily Health Tracker — iPhone PWA + Web Push

This build adds **real Web Push** for medicine reminders.

The previous browser-timer reminder has been replaced by a push architecture:

**iPhone Home Screen PWA → Web Push subscription → Cloudflare Worker + D1 → scheduled push → iPhone notification**

That means the web app's JavaScript does **not** need to stay open for the reminder to be sent.

## Privacy design

- Medicine names and dosages stay in the phone's local storage.
- The push server stores an opaque reminder ID, reminder time, timezone, enabled state, and notification message.
- The default notification is **"Monster needs med"** and does not contain the medicine name.
- If you type a medicine name into the notification message yourself, that message will be sent through the push service.
- The VAPID private key belongs only on the Cloudflare Worker. Never put it in GitHub or `push-config.js`.

## What is included

- Existing Daily Health Tracker PWA UI
- Exercise and medicine records
- Multiple medicine reminder times
- Private notification message
- Web Push subscription
- Service-worker push handling
- Notification tap opens the tracker
- Cloudflare Worker API
- Cloudflare D1 database schema
- 1-minute Cron Trigger for reminder checks
- VAPID key generation helper

## Important

This is a notification system, not a guaranteed medical alarm. iOS notification permissions, Focus modes, device state, connectivity, push-service behavior, and Cloudflare scheduling can affect delivery. For critical medication timing, keep a secondary reminder method.

## Setup

See **`WEB_PUSH_SETUP.md`** for the complete Cloudflare + GitHub Pages setup.

### Frontend configuration

Edit `push-config.js` after the Worker is deployed:

```js
window.PUSH_CONFIG = {
  apiBase: "https://YOUR-WORKER.workers.dev",
  vapidPublicKey: "YOUR_VAPID_PUBLIC_KEY"
};
```

The VAPID **public** key can be published with the website. The private key must stay in Cloudflare Worker secrets.

## iPhone requirements

1. Publish the website over HTTPS, such as GitHub Pages.
2. Open it in Safari on iPhone.
3. Use **Share → Add to Home Screen**.
4. Open the installed Home Screen app.
5. Configure a medicine reminder.
6. Allow notifications when iOS asks.

Web Push for Home Screen web apps is supported on iOS/iPadOS 16.4 and later.
