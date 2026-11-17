# OneUp · IYDV

A private daily training workspace for Indak Yaman dancers: gym sets, practice drills, interval sessions, measurable goals, skills, weight trends, and personal scheduling.

## Develop

Use **Node.js 24 or newer** (the app uses Node’s built-in SQLite). No external database, Google account, or API key is needed.

```sh
npm ci
npm run dev
```

The app listens on port 3000, or `PORT` if provided. Create an account in the browser. Account records live in `.data/oneup.sqlite` by default; this directory is ignored by Git and never served over HTTP. Installation in a restricted workspace can use `npm ci --cache /tmp/iydv-npm-cache`.

```sh
npm test
npm run test:browser
```

The browser smoke test requires Chromium. It uses `/usr/bin/chromium` by default; set `CHROMIUM_PATH` to another installed Chromium binary, or run `npx playwright install chromium` and set `CHROMIUM_PATH` to that executable. It launches an isolated server and temporary database, exercises actual user journeys, and writes screenshots under ignored `artifacts/`. Tests never use the development database.

There is no build step. Icons are bundled locally from Lucide 0.468.0 with its license; the app makes no third-party browser requests. `GET /api/health` checks the Node server.

## What changed

- Responsive desktop workspace and mobile navigation, clear empty states, keyboard-accessible dialogs, visible save status/retry, reduced-motion support, and inline sign-in errors.
- Real server accounts with salted scrypt password hashes, expiring HttpOnly/SameSite sessions, request-origin checks, throttled authentication, scoped account records, and concurrent-tab revision checks.
- Actual training measurements instead of sample charts or inferred goals. Weight entries update by calendar date; timers account for time spent in background tabs. Dates use Asia/Manila.
- Private JSON export, period-filtered CSV/print reports, and password-confirmed account deletion.
- Spreadsheet sync, simulated Google authentication, and unconfigured government SSO are disabled. Existing browser-only accounts are not automatically migrated: they contained plaintext credentials and cannot establish a server account identity. Keep any old browser data until an explicit, reviewed migration is available.

Saving is online: if a request fails, the tab retains unsaved records, shows a retry message, and warns before unloading. Export your data before closing a tab with failed saves. Unsubmitted exercise/drill selections and running timers are session drafts; submit the workout to save it.

Check-ins and skill levels are **self-reported**. This release is a personal training workspace; it does not grant staff permissions, verify identities, or claim connected team administration.

## Public deployment

Run this as a persistent **Node service**, behind HTTPS, with one persistent volume. Static hosting and Vercel/serverless deployments do not support this SQLite/session architecture; the legacy static Vercel configuration has been removed and the server refuses Vercel execution.

1. Set `NODE_ENV=production`, `APP_ORIGIN` to the exact public origin (no trailing slash), and `DATA_DIR` to a private persistent directory on the mounted volume. See `.env.example`. Environment variables must be injected by your host; the app does not load `.env` automatically.
2. Run `npm ci --omit=dev` and `npm start`. Terminate HTTPS at the trusted host/reverse proxy. Set `TRUST_PROXY=1` **only** when exactly one trusted proxy sits in front of Node, so client throttling uses its trusted address.
3. Back up SQLite regularly using SQLite’s online backup mechanism or a coordinated stopped-service backup, including necessary WAL data. Keep backups private. Test restore to a separate directory before launch. Use a single app instance for this SQLite deployment.
4. Verify sign-up, login/logout, saving after restart, exports, deletion, and mobile navigation on the real HTTPS origin. Set operational monitoring, retention rules, and a real support/privacy contact for the site operator.
5. **Revoke/rotate the previously committed eGov partner secret** with its provider. It was removed from current source, but Git history cannot revoke a credential. Do not reactivate identity integrations until their provider-approved flow and credentials are configured.

Before a broad public launch, provide email verification/password recovery and a support process; neither mail delivery nor recovery is implemented. Security tests cover the changes here, but do not certify the entire deployment. Public hosting, HTTPS, backups, monitoring, and privacy review still require deployment-specific verification. This repository does not deploy or publish itself.
