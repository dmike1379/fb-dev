# FamilyBank — guide for Claude sessions (Cowork, Claude Code, chat)

FamilyBank is an allowance / chore / savings tracker PWA that Mike DeLeo built for his daughter. Vanilla JS, no build step, no framework. Read this file before touching anything.

## The two repos — and the one line that must never cross

| Repo | Role | Served at | `app.js:39` `API_URL` |
|---|---|---|---|
| `dmike1379/fb-dev` (this repo) | DEV | https://dmike1379.github.io/fb-dev/ | the DEV Apps Script deployment (`…AKfycbyIqTRDvr826w…/exec`) |
| `dmike1379/dfb.github.io` | PROD — **serves a child** | https://dmike1379.github.io/dfb.github.io/ | the PROD deployment (`…AKfycbzwlsdTLLH3c5…/exec`) |

1. Never push to `main` on either repo. Branch + PR; Mike merges.
2. Never touch the PROD repo unless the task is explicitly a PROD cutover, and then only the frontend files, with PROD's own `API_URL` kept on `app.js:39`. The DEV URL must not appear anywhere in the PROD repo. (This swap has caused DEV/PROD drift 3 times.)
3. Never change PROD data. DEV test family: Alice (parent) / Cora, Finn, onetwo — ask Mike for PINs; never read or print PINs from state.
4. Both sites share the `dmike1379.github.io` origin: in one browser profile they share `localStorage` and Cache Storage, and each service worker's activate step deletes the other's cache. Not a production issue (the child's phone only has PROD) — but expect it in a test browser.

## Files

| File | What |
|---|---|
| `index.html` | the whole UI (screens, sheets, modals) |
| `app.js` | all frontend logic (~7.6k lines): login/state, parent + child screens, chore engine, wizards, sync |
| `styles.css` | styles; the child-facing screens must stay clean and uncluttered ("easy for a 5-to-10-year-old") |
| `service-worker.js` | precache + stale-while-revalidate; `SW_VERSION` drives the cache name |
| `version.json` | `{version, build}` — the authoritative stamp (footer, update banner) |
| `Code.gs` | the Google Apps Script backend, copied here for reference; deployed by hand in the Apps Script editor (row-per-family Google Sheet: `Families!A:B`, a `Ledger` sheet; CacheService 60 s; email + Google Calendar sync on save) |
| `manifest.json`, `vendor/`, `images/`, `docs/` | PWA manifest, Chart.js, assets, the calendar setup guide |
| `tests/` | jsdom harnesses (see Testing) |
| `NTH_proposals.md`, `*_Handoff.md`, `*_Audit.md` | backlog and history; the project copy of `NTH_proposals.md` in the claude.ai Project is newer than this one |

## Versioning

- `version.json` `version`/`build`, `service-worker.js` `SW_VERSION 'v<version>-<build>'`, `app.js` `APP_VERSION`, and the SW header comment are stamped together in the last commit of a release (`v38.5-2: version stamp 38.5 build 1`). The SW compares `version-build` against `SW_VERSION`; a mismatch shows the update banner forever.
- MAJOR (38 → 39): `Code.gs` changes → Apps Script redeploy; frontend and backend changes that depend on each other ship together or not at all. MINOR (38.4 → 38.5): frontend only. PATCH: additive `Code.gs` intercepts only.
- One bug per commit, commit subject `v<ver>-<n>: <what changed and why>`. Grep the working file before trusting any line number in a doc — they age fast.

## Testing — `npm test`

`npm install` once (creates `node_modules/`, git-ignored). Then:

| Command | Runs | Time |
|---|---|---|
| `npm test` | helpers, smoke (20), copy (67), backend (44), reschedule (37), race (22) | ~90 s |
| `npm run test:quick` | the same without race | ~6 s |
| `node tests/<file>.js [repo path]` | one harness against any checkout (bite tests against `main`) | |

The frontend harnesses boot the real `index.html` + `app.js` in jsdom with `fetch` stubbed (a fake Apps Script backend in `race.js`) and drive the app through its own functions and DOM; `backend.js` runs the real `Code.gs` inside `tests/gas-mock.js` (fake Sheet, Cache, Lock, Calendar, Mail). They print `PASS`/`FAIL` per check and end with `DONE — n/m PASS`; `tests/run.js` prints progress with an ETA and ends with a single `DONE` line and a non-zero exit on any failure. Set `TZ=America/Chicago` (the runner does). A new feature gets its checks added to the matching harness, and the harness must fail on `main` before the change (bite test) — say so in the PR body.

## Working rules that have paid off

1. Cold audit before every release: a fresh-context reviewer reads the diff and reports findings only; fix, then re-check. v37.0 shipped without one and carried two critical bugs.
2. Evidence over theory: console, network, harness output, `grep` — never "it should work". An empty console on a crash means something deliberately did the action; hook the suspect function.
3. Silent-failure modes are the worst bugs (`mode:'no-cors'` POSTs, confirmation without verification). Every save is verified against the server's `_savedAt` stamp (v38.3); do not weaken that.
4. Wizard engine (`wz*` in `app.js`): steps have `skip`/`validate`/`render`; drafts persist in `localStorage` (`fb_wiz_draft`, `fb_cw_draft`); `wz.meta.pristine` decides whether a close keeps a draft. Read `cwBuildSteps` before changing any chore-wizard flow.
5. Chore field schema = `CW_FIELD_KEYS` in `app.js`; downstream readers (ledger, calendar sync in `Code.gs`) break silently when a schema shifts. Grep the consumers first.
6. Money: balances in state are the source of truth; the ledger is append-only. Never compute a balance from the ledger.

## How work moves between sessions

Cowork (cloud) designs, builds as exact-match patch scripts, runs the harnesses, audits, and writes a handoff; Claude Code (on Mike's PC) applies the patches with `git am`, re-runs the checks, pushes the branch and opens the PR; Mike merges from his phone; Cowork verifies DEV live. Hand-offs travel through the `Claude_Mailbox` folder on Mike's PC (`to_code\`, `to_cowork\`, `done\` — read its README). Every handoff states the goal and what not to change, exact inputs, stop conditions, what needs Mike's explicit OK (pushes, PRs, anything PROD), and what the return note must contain. The living status document is `claude/FamilyBank_Cowork_Session_Brief.md` in the claude.ai Project; the plan is the "FamilyBank Roadmap" doc there.
