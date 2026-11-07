# EggModels

A sports-betting dashboard (live at [egg-models.web.app](https://egg-models.web.app)) covering NFL schedule predictions, parlay picks, MLB, tennis odds, and a model-performance tracker. Built as a Create React App frontend backed by Firebase Hosting, Firestore, and Cloud Functions.

## Architecture

Three loosely-coupled tiers:

1. **Python model pipeline** (`src/python/<sport>_<year>/`) — scrapes schedules, runs Elo models, and historically wrote predictions into a committed JSON file. NFL/MLB are moving toward live Firestore-backed data (see `src/firebase.ts`); some pages still fall back to a bundled JSON snapshot if Firestore is unreachable.
2. **React frontend** (`src/`, TypeScript + CRA) — routes defined in `src/App.js`/`App.tsx`. Key pages under `src/components/`: `ScheduleNFL`, `ScheduleMLB`, `Parlay`, `Tennis`, `Dashboard`, `Rankings`, `Performance` (grades past NFL model picks against actual outcomes), `Playoffs`, `Blog`, `Home`.
3. **Cloud Functions** (`functions/index.js`) — server-side proxies to ProphetX, Kalshi, and TypeSafe so credentials never reach the client (`getEvents`, `getProphetMarkets`, `getBets`, `getKalshiEvents`, `getKalshiMarketsByEvent`, `getPickInsights`, `refreshWeeklyPickInsights` (scheduled), `searchOdds`). Auth secrets are Secret Manager-backed (`defineSecret()`), bound per-function via `runWith({ secrets: [...] })`.

## Local development

```bash
npm install
npm start          # dev server at http://localhost:3000
npm test            # Jest, run once in CI with --watchAll=false
npm run build       # production build to build/
npm run smoke-test  # Playwright check that the built app renders (see scripts/smoke-test.js)
```

Firestore-backed pages need `REACT_APP_FIREBASE_*` env vars in a git-ignored `.env.local` (see `src/firebase.ts`); without them those pages fail silently.

Cloud Functions, from `functions/`:

```bash
npm run serve   # firebase emulators:start --only functions
npm run deploy  # deploy functions directly
npm run logs    # tail function logs
```

Secrets are managed with Secret Manager, not `.env`:

```bash
firebase functions:secrets:set <NAME>
```

then redeploy. `getBets` additionally requires an `x-app-secret` header matching the `APP_SECRET_KEY` secret, since it returns personal wager data.

## CI/CD

- **CI** (`.github/workflows/ci.yml`, every push to `master` and every PR): dependency audit (`npm audit --audit-level=critical`) for both the root app and `functions/`, Jest unit tests, and a Playwright smoke test that builds with no Firebase env vars set (regression guard for a prior incident where a missing `.env.local` produced a blank page) and confirms the app still renders. A failure on `master` emails an alert.
- **Deploy on merge** (`.github/workflows/firebase-hosting-merge.yml`, push to `master`): path-gated — hosting redeploys only when `src/`, `public/`, `package.json`/`package-lock.json`, or `firebase.json` changed; functions redeploy only when `functions/**` changed. Hosting deploys build with the `REACT_APP_FIREBASE_*` secrets injected and push via `FirebaseExtended/action-hosting-deploy`; functions deploy via `firebase-tools deploy --only functions` using a service-account key written from the `FIREBASE_SERVICE_ACCOUNT_EGG_MODELS` secret.

Changes land through a pull request rather than a direct push to `master` (branch protection to enforce this is not yet configured).

## Things that are easy to miss

- The Realtime Database rules (`database.rules.json`) are locked down (`read: false`, `write: false`) — the app uses **Firestore**, not RTDB.
- Team logos (`src/logosnfl/`, `src/logosmlb/`) are loaded via `require(`../logosnfl/${team}.png`)`; filenames must exactly match the team strings the scraper emits.
- This project was originally bootstrapped with [Create React App](https://github.com/facebook/create-react-app); CRA's own docs (testing, code splitting, deployment, ejecting) still apply where this README doesn't cover something CRA-specific.
