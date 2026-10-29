# Set up the shared iCloud calendar

The GitHub Pages site is a browser-only preview. The shared version runs the same interface **and** its private backend at one Render address. Both Mike and Elena use that address. No database is needed: appointments live in the existing shared iCloud calendar.

## 1. Create a Render account

Visit https://render.com and sign up. You can connect your GitHub account to let Render deploy `mpocelinko/calendar`.

Choose **New → Blueprint**, connect this repository, and use its `main` branch. The included `render.yaml` describes a Node web service. Render may change its labels, plan availability, and pricing; review the service and price before creating it. The blueprint requests the free web-service plan, which may sleep when idle. Initial loading may take time. Always-on hosting and future background Gmail processing may require a paid plan.

Alternatively, create a Node **Web Service** with:

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Node version: 24
- Health check: `/healthz`
- Environment: `NODE_ENV=production`

## 2. Set private environment variables in Render

Enter these in Render’s environment settings, never in chat, a GitHub file, or the public website:

| Name | What to enter |
| --- | --- |
| `APP_PASSPHRASE` | A new strong calendar-only passphrase, at least 16 characters. Share it privately with Elena. It is not your Apple password. |
| `ICLOUD_USERNAME` | The Apple Account email of an account with **write access** to the shared iCloud calendar. |
| `ICLOUD_APP_PASSWORD` | An Apple **app-specific password**, created for this service. Never use your main Apple password. |
| `ICLOUD_CALENDAR_NAME` | The exact calendar name shown in Apple Calendar, including spaces and capitalization. It must match only one accessible calendar. |
| `CALENDAR_TIME_ZONE` | `America/New_York` unless your family prefers a different IANA time zone. |

Apple app-specific passwords are managed at https://account.apple.com under **Sign-In and Security → App-Specific Passwords**. Apple requires two-factor authentication. See Apple’s instructions: https://support.apple.com/102654. The backend uses Apple’s CalDAV service to discover calendars. A subscribed public calendar or an account without write permission cannot support edits.

The selected Apple Account’s app-specific password can access more than this one calendar. Store it securely in Render; the app selects only the named calendar. Revoke the app-specific password in Apple Account settings if the service is no longer needed. The hosted service receives credentials at runtime and does not include them in browser bundles or repository files.

## 3. Deploy and check

After deploying, Render supplies an HTTPS `onrender.com` address. Open **that same address** on both devices, sign in with your new calendar passphrase, and check that your existing iCloud appointments appear.

Create a clearly labeled test appointment in the app. Verify that it appears in Apple Calendar and in the app on the other device after **Refresh**. Edit it in Apple Calendar, refresh the app, and check that the change appears. Finally delete the test appointment in the app and verify its removal in Apple Calendar. These checks are still required: automated tests use a simulated CalDAV provider, not your account.

A service health check confirms the web server is running; it does not confirm iCloud authentication or calendar access. Those are tested when the calendar loads after sign-in. If the exact calendar name is missing or duplicated, the app shows an error and does not select another calendar.

## 4. Move browser-only appointments

In the **original browser and original GitHub Pages address**, choose **Export appointments**. The downloaded JSON contains private appointment details; keep it private. In the Render-hosted version, sign in and choose **Import file**. Review the confirmation before importing. Browser copies remain untouched. Stable event identifiers and conditional writes prevent an import from overwriting an existing iCloud appointment; repeated imports can report appointments already present.

Browser storage belongs to the website address, so the new service cannot automatically read the old preview’s data. If you already have browser-local appointments on the backend address, an **Import local appointments** button is also available after sign-in.

On your iPhone, open the Render address in Safari and use **Share → Add to Home Screen**. Elena can use the same address in her Mac browser.

## Current scope and limitations

- Shared access uses one family passphrase. Individual user accounts and per-person access controls are not implemented. Anyone with the passphrase can read the selected calendar and change app-created events.
- Sessions use HttpOnly, SameSite=Strict, Secure cookies, expire after seven days, and are kept in memory. A backend restart signs everyone out; it does not delete iCloud appointments.
- The app refreshes on browser focus, manually, and every minute while visible. It does not sync in the background while closed or offline. iCloud and Apple devices can take time to propagate changes.
- Calendar loads include the selected month, the previous month, and the next two months. Navigate to other months to fetch those dates. Counts and search cover the loaded date window.
- Times are displayed and entered in `CALENDAR_TIME_ZONE`, regardless of the viewing device’s time zone. Nonexistent daylight-saving times are rejected. An ambiguous fall-back time uses the earlier occurrence.
- iCloud expands recurring events for the requested date window. Existing Apple events, invitations, recurring occurrences, all-day events, and events spanning days are **view-only** in this version; edit them in Apple Calendar. Simple same-day appointments created by this app can be added, edited, and deleted here. Apple alarms and other metadata are preserved during edits.
- Changes use iCloud entity tags. If another device changed an appointment, refresh and reopen it before saving. The app never falls back to local-only saving after an iCloud write fails.
- Gmail ingestion, intelligent voice entry, push notifications, offline caching, and native iOS distribution are not implemented.

## Local backend development

```sh
npm ci --cache /tmp/calendar-npm-cache
npm test
npm run build
cp .env.example .env
# Fill .env privately. NODE_ENV=development allows cookies on local HTTP only.
node --env-file=.env server/index.js
```

Open the local server on port 3000. `npm run dev` remains a Vite-only browser-local preview. The actual backend serves the compiled `dist/` directory. Production must use HTTPS with `NODE_ENV=production`; never disable TLS verification.
