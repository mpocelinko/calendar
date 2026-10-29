# Mike’s Calendar

An iPhone-first calendar interface for Mike and Elena, with a responsive layout for a Mac browser. This first milestone is a standalone web interface, not a native iOS app.

## Run

Requires Node.js 22+ and npm.

```sh
npm ci --cache /tmp/calendar-npm-cache
npm run dev
```

Run `npm test` for date, validation, and saved-data checks; `npm run build` creates `dist/`; `npm run preview` serves that production build. Serve the app over HTTPS when deploying. On iPhone, Safari’s Share → Add to Home Screen can launch the deployed site separately. Offline support and push notifications are not implemented.

## Current functionality

- Month and agenda views, month navigation, today shortcut, and selected-day details.
- Create, edit, and delete same-day appointments, including location, notes, category, and attendee.
- Search and filter by category or person.
- Browser-local persistence, with visible errors if storage fails. No sample personal events are inserted.
- Responsive mobile calendar: tap a date to see its appointments below the grid.
- Text fields support the device keyboard’s dictation. Natural-language voice interpretation is not implemented.

## Important limits

Appointments are stored only in this browser’s local storage. Clearing site data removes them. Mike and Elena do not yet share data between devices. There is no authentication, iCloud connection, Gmail access, email processing, or hosted backend. Do not treat this prototype as the sole copy of important appointments.

## Next milestones

1. Implement secure user accounts and an authorized iCloud integration; preserve the shared Apple calendar as the source of truth.
2. Add natural-language appointment entry with a review step.
3. Add authorized Gmail ingestion on a backend, including invitation identifiers, reschedules, cancellations, deduplication, and a review queue for ambiguous email.

Credentials must never be committed or embedded in frontend code. ChatGPT account connections are not reused by this app.

## Publish a preview with GitHub Pages

A Pages workflow is included in `.github/workflows/pages.yml`. It runs the tests and production build before deploying the static app. Relative asset URLs support the repository subdirectory as well as a custom domain.

1. Push this code to the repository’s `main` branch.
2. In the repository’s **Settings → Pages**, select **GitHub Actions** as the build/deployment source. GitHub Pages availability for private repositories depends on the account plan.
3. Open **Actions → Publish calendar preview**, run the workflow if needed, and wait for both jobs to pass.
4. Open the URL shown by the deployment job. This URL is not live until deployment succeeds.

The preview’s application code is publicly accessible when published to a public Pages site. Appointments stay in each visitor’s browser and are not uploaded by this version. There is no shared storage or sign-in. Use test appointments while evaluating it.

On iPhone, open the deployed HTTPS URL in Safari, then choose **Share → Add to Home Screen**. No App Store installation is required. This does not add offline operation or background email processing.
