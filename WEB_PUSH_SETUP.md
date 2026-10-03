# Web Push setup — Daily Health Tracker

This setup uses **Cloudflare Workers + D1 + Cron Triggers** for the push backend and GitHub Pages for the static PWA.

## 1. Install Node.js

Install a current Node.js version on your PC.

Then open a terminal inside:

```text
worker/
```

and run:

```bash
npm install
```

## 2. Log in to Cloudflare

```bash
npx wrangler login
```

A browser window will open for Cloudflare authorization.

## 3. Create the D1 database

From the `worker` folder:

```bash
npx wrangler d1 create daily-health-tracker-push
```

Cloudflare will show a `database_id`.

Open:

```text
worker/wrangler.toml
```

and replace:

```toml
database_id = "REPLACE_WITH_D1_DATABASE_ID"
```

with the real ID.

## 4. Apply the database schema

```bash
npm run db:migrate
```

This creates the subscription and reminder tables.

## 5. Generate VAPID keys

Run:

```bash
npm run generate-vapid
```

You will get:

```text
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

Keep both values safe. **Only the public key goes into the website.**

## 6. Save the VAPID secrets in Cloudflare

Run each command and paste the corresponding value when prompted:

```bash
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT
```

For `VAPID_SUBJECT`, use an email you control, for example:

```text
mailto:your@email.com
```

Do not put the private key in GitHub.

## 7. Deploy the Worker

```bash
npm run deploy
```

Cloudflare will give you a Worker URL similar to:

```text
https://daily-health-tracker-push.YOUR-SUBDOMAIN.workers.dev
```

Test it by opening:

```text
https://YOUR-WORKER-URL/api/health
```

You should see JSON containing:

```json
{"ok":true}
```

## 8. Put the Worker URL + public key into the PWA

Open the root-level file:

```text
push-config.js
```

Change it to:

```js
window.PUSH_CONFIG = {
  apiBase: "https://YOUR-WORKER-URL.workers.dev",
  vapidPublicKey: "YOUR_VAPID_PUBLIC_KEY"
};
```

Do **not** put `VAPID_PRIVATE_KEY` here.

## 9. Publish the PWA on GitHub Pages

Upload the **root-level** files/folders of this package to the GitHub Pages repository.

Keep:

```text
index.html
style.css
app.js
push-config.js
manifest.json
sw.js
icons/
```

in the repository root.

The `worker/` folder can also stay in the same repository. It contains the backend source, but GitHub Pages does not execute it.

## 10. Install/update the PWA on iPhone

On the iPhone:

1. Open the GitHub Pages URL in Safari.
2. Tap **Share**.
3. Tap **Add to Home Screen**.
4. Open **Daily Health Tracker** from the Home Screen.
5. Go to **Medicine**.
6. Add a medicine.
7. Tap the **⏰** button.
8. Add a reminder time.
9. Turn on **Enable reminders**.
10. Save.
11. Allow notifications when iOS asks.

The app will create a Web Push subscription and send the reminder schedule to the Worker.

## 11. Test it

For the first test, set a reminder about 2–3 minutes in the future.

Then:

1. Save the reminder.
2. Close the Daily Health Tracker app completely.
3. Wait for the reminder.
4. The iPhone should show the private notification, for example:

**Monster needs med**

Tap the notification to open the tracker.

## How the timing works

Cloudflare runs the Worker's scheduled handler every minute. The Worker converts the current time into each reminder's saved timezone, so a reminder such as `20:00` is interpreted as 8:00 PM in the user's timezone rather than as UTC.

The Worker allows a small scheduling delay of up to five minutes to avoid missing a reminder because a Cron execution starts slightly late.

## If notifications do not arrive

Check these in order:

### A. The app is installed on the Home Screen

For iPhone Web Push, use the installed Home Screen web app rather than just an ordinary Safari tab.

### B. Notification permission is allowed

On iPhone:

**Settings → Notifications → Daily Health Tracker → Allow Notifications**

Also check Focus / notification settings.

### C. `push-config.js` is correct

Make sure:

- `apiBase` points to the deployed Worker.
- `vapidPublicKey` matches the public half of the VAPID key stored in Cloudflare.

### D. Worker health endpoint

Open:

```text
https://YOUR-WORKER-URL/api/health
```

It should return:

```json
{"ok":true}
```

### E. Worker logs

Cloudflare Dashboard → Workers & Pages → your Worker → Logs / Observability.

### F. Reinstall the PWA if the VAPID key was changed

Changing the VAPID key invalidates old push subscriptions. Remove the old Home Screen installation and add the current site again, then enable the reminder again.

## Security notes

The Worker API uses a random per-device client token stored in the browser's local storage. This is intentionally a simple single-user design for a personal tracker; it is not an account/authentication system.

Do not store medicine names in the notification message if you want the notification to remain private.

## Architecture

```text
                 GitHub Pages
              Daily Health Tracker
                       │
                       │ Push subscription
                       ▼
              Cloudflare Worker API
                       │
                       ├── D1 subscriptions
                       ├── D1 reminders
                       └── VAPID private key
                              │
                 Cron Trigger every minute
                              │
                              ▼
                       Web Push service
                              │
                              ▼
                         iPhone PWA
                              │
                    "Monster needs med"
                              │
                       Tap notification
                              ▼
                       Daily Health Tracker
```
