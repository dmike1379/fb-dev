# Claude v37.2-alpha3-Gate-A-bullet-6-fix

═══════════════════════════════════════════════════════════════════
⛔ DO NOT DEPLOY TO PRODUCTION. WIP only. Read CHECKPOINT_NOTES.md.
═══════════════════════════════════════════════════════════════════

Targeted fix on top of alpha-2. Re-running Gate A in DEV.

## What this zip contains

- `app.js` — modified (one bug fix: render-state gate + Step 2 defensive fallback)
- `FamilyBank_v37_2_Patch2_scope.md` — unchanged from alpha-1/alpha-2; carried for self-contained reference
- `CHECKPOINT_NOTES.md` — what changed since alpha-2 + Gate A re-run plan
- `RESUME_NOTES.md` — pickup spec for Builder #3 if needed

## What this zip does NOT contain (intentional)

- `index.html`, `styles.css` — unchanged from alpha-2. If alpha-2 isn't already deployed to DEV, push alpha-2's index.html and styles.css alongside this app.js.
- `Code.gs`, `version.json` — unchanged from production v37.1. Patch 2 is still MINOR, still pre-checkpoint.

## Deployment to DEV

Push only `app.js` to the `fb-dev` repo (overwriting alpha-2's app.js). No Apps Script redeploy needed.

If alpha-2's index.html and styles.css aren't already in DEV, push those too — they're prerequisites for the close-confirm dialog and start-over link to work.

## What to do after deploying

Re-run Gate A bullets 3 and 6 against `fam_wiztest2` (or a fresh row if cache pollution is a concern). Specifically the failure flow that bit alpha-2:

  Pre-seed email in row → walk to Step 3 → add child → refresh →
  Back to Step 2 → confirm email present → forward to Step 4 →
  confirm review shows email → Finish → confirm Sheet has correct email.

If that passes, Gate A is satisfied. Ping Linus for the architecture checkpoint before continuing to Groups B/C/D.
