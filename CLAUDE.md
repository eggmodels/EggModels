# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Frontend (Create React App, run from repo root):
- `npm start` — dev server at http://localhost:3000
- `npm run build` — production build to `build/` (served by Firebase Hosting)
- `npm test` — Jest in watch mode; run a single test with `npm test -- -t "<test name>"` or `npm test -- src/App.test.js`

Firebase Cloud Functions (run from `functions/`):
- `npm run serve` — local emulator (`firebase emulators:start --only functions`)
- `npm run deploy` — deploy functions
- `npm run logs` — tail function logs

Deploy hosting: `firebase deploy --only hosting` (after `npm run build`).

Python models — no package manager wiring. The Pipfile is empty; install deps directly (`pandas`, `requests`, `beautifulsoup4`). Run a model update with `python src/python/nfl_2025/modelUpdater2025.py` from inside that directory (it imports sibling modules without a package).

## Architecture

This is a sports-betting-model dashboard. Three loosely-coupled tiers:

1. **Python model pipeline** (`src/python/<sport>_<year>/`) — Scrapes schedules (e.g. `scheduleScraper2025.py` hits pro-football-reference.com), runs an Elo model (`eloInit*`, `eloUpdater*`), and writes a JSON file (`nflModel2025.json`) **back into the same directory inside `src/`**. The JSON is then imported directly by React components at build time. There is no runtime fetch of model data — regenerating predictions means re-running the Python script and committing the JSON. Note `modelUpdater2025.py` has a hardcoded absolute output path (`/Users/sebygarza/documents/portfolio/eggmodels/...`); update this before running on another machine.

2. **React frontend** (`src/`) — CRA app, routes defined inline in `src/App.js`. Each sport has one component under `src/components/` that either (a) imports the committed model JSON statically (`ScheduleNFL.js`, `Parlay.js` import `nflModel2025.json`) or (b) reads from Firestore (`Tennis.js` reads `model_outputs` collection; `Dashboard.js` calls Cloud Functions). Team logos live in `src/logosnfl/` / `src/logosmlb/` and are loaded via `require(\`../logosnfl/${team}.png\`)` — filenames must match the team strings emitted by the scraper exactly.

3. **Cloud Functions** (`functions/index.js`) — Server-side proxies to external betting APIs (ProphetX, Kalshi) so credentials stay off the client. Auth secrets are read from `functions.config().prophetx.*` and `functions.config().kalshi.*` (set via `firebase functions:config:set`). The Dashboard component calls these by hardcoded URL (`https://us-central1-egg-models.cloudfunctions.net/...`).

### State that's easy to miss

- **Current week is hardcoded** in `src/components/Parlay.js` and `src/components/ScheduleNFL.js` (`useState(22)`) and in `src/python/nfl_2025/modelUpdater2025.py` (`currentWeek = 22`). These three must move together at the start of each NFL week / round of playoffs.
- **Firebase web config** is loaded from `REACT_APP_FIREBASE_*` env vars in `src/firebase.js`; `.env.local` is git-ignored. Without these, the Firestore-backed pages (Tennis, anything reading `db`) will fail silently in the console.
- The Realtime Database rules in `database.rules.json` are locked down (`read: false`, `write: false`) — the app uses **Firestore**, not RTDB. Don't accidentally point new code at RTDB.
- `nflModel.json` and `nfl_schedule.json` at repo root are deleted in the current working tree; the live model file is `src/python/nfl_2025/nflModel2025.json`.
