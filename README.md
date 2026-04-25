# Claude v37.2-alpha2-A1A2-complete

═══════════════════════════════════════════════════════════════════
⛔ DO NOT DEPLOY TO PRODUCTION. WIP only. Read CHECKPOINT_NOTES.md.
═══════════════════════════════════════════════════════════════════

This is a checkpoint snapshot — A1+A2 implementation is complete and
ready for **Gate A verification in DEV**. It is NOT a Patch 2 release.
Groups B/C/D have not been started.

## What this zip contains

- `app.js` — modified (cache module + both wizards fully wired + close-confirm dialog plumbing)
- `index.html` — modified (`#wizard-close-confirm-overlay` markup, family-wizard Close button + Start-over slot, per-child wizard close rewired)
- `styles.css` — modified (`.wizard-start-over-link` + hidden state)
- `FamilyBank_v37_2_Patch2_scope.md` — unchanged from alpha-1; carried forward for self-contained reference (Option-2 split is documented at top of A1)
- `CHECKPOINT_NOTES.md` — what landed since alpha-1 + Gate A run plan
- `RESUME_NOTES.md` — full pickup spec, updated to reflect alpha-2 state (for Builder #3 if needed)

## What this zip does NOT contain (intentional)

- `Code.gs` — unchanged. Patch 2 is a MINOR bump; zero backend touches.
- `version.json` — deliberately left at 37.1. Bumping would falsely signal a deployable build. Mike bumps when Patch 2 is actually finished and ready to ship.

Pull these from project knowledge / GitHub Pages source if needed for any reason during DEV testing.

## Deployment to DEV

Push `app.js`, `index.html`, `styles.css` to the `fb-dev` repo. No Apps Script redeploy needed (Code.gs unchanged → existing DEV API_URL still works).

## What to do after deploying to DEV

Run **Gate A** (5 bullets in CHECKPOINT_NOTES.md). If all five pass, ping Linus for the architecture checkpoint before continuing to Groups B/C/D. If any fail, do not proceed — fix or flag first.
