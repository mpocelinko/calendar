# Mike’s Calendar

An iPhone-first calendar for Mike and Elena, with a responsive Mac layout and a neutral dark theme.

## Development

Requires Node.js 24 (22+ supported).

```sh
npm ci --cache /tmp/calendar-npm-cache
npm run dev
```

`npm test` runs calendar, iCalendar/CalDAV adapter, security, and two-client API integration checks. `npm run build` generates `dist/`. `npm run preview` serves the static production build.

## Two deployment modes

- **GitHub Pages**: browser-only preview; appointments stay in that browser. The included Pages workflow tests, builds, and publishes pushes to `main`.
- **Hosted Node service**: serves both the interface and authenticated API at one address; reads/writes the selected shared iCloud calendar via CalDAV. Includes a Render blueprint. **Not live until a hosting account and private iCloud settings are configured.**

See [shared calendar hosting instructions](docs/hosting.md) for Render setup, secure Apple app-specific password entry, migration of browser-local appointments, and required cross-device acceptance checks.

## Features

Month and agenda views, search, category and attendee filters, appointment editing, browser-local export, and explicit import into iCloud. Keyboard dictation works in text fields. Hosted mode adds passphrase sign-in, refresh on focus/every minute, conditional writes to prevent concurrent overwrites, and timezone-aware event creation.

Existing Apple appointments, recurring occurrences, invitations, all-day events, and appointments spanning days are displayed read-only; use Apple Calendar to modify them. Simple appointments created by this app can be edited and deleted here.

## Pending integrations

Real-account iCloud verification and hosted cross-device checks require deployment and credentials supplied privately by the owner. Gmail automation, natural-language voice interpretation, background notifications, offline support, and native iOS packaging are not implemented. ChatGPT’s account connections cannot be reused automatically.
