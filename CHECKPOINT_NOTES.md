# Checkpoint Notes — FamilyBank v37.2 Patch 2 — Alpha-3 (Gate A bullet 6 fix)

**Snapshot:** alpha-3 (cache-clobber bug fix on top of alpha-2)
**From:** Linus (Builder #2)
**Status:** awaiting Gate A re-run in DEV

---

## What changed since alpha-2

One bug, one fix, one file (`app.js`).

### The bug

Walked through with Mike + Advisor 2 in chat. Symptom: pre-seeded primary email rendered correctly during the wizard but came back empty after refresh + Back navigation. Cache showed `payload.primaryEmail: ""`.

Trace (full version in chat history):

1. User opens wizard, walks to Step 4 (or any step past Step 2).
2. User refreshes. Cache hydrates the buffer correctly — email is present in `familyWizardState.primaryEmail`.
3. `fwRenderStep(N)` is called to paint the resumed step.
4. **Line 6566 (alpha-2): `fwCaptureStepInputs(familyWizardState.step)` runs at the top of `fwRenderStep`** — captures inputs from the step we're "leaving."
5. **But on a freshly-resumed page, no step has been painted yet.** The DOM `#fw-primary-email` input still holds its static HTML default (empty string), because the in-memory paint state from before refresh is gone.
6. If the resumed step is Step 2, capture reads `""` from the DOM and overwrites `familyWizardState.primaryEmail` with empty.
7. Even if the resumed step is Step 4 (capture is no-op for step 4), the user's first Back press triggers `fwRenderStep(3)`, which itself triggers the same line-6566 capture for whichever step was just "visible" — the chain eventually clobbers Step 2's email when navigating back through it.

This same mechanism explains the SF-2 color bug: `<input type="color">` defaults to `#000000` in the DOM, and the defensive `|| id.colorPrimary` fallback in Step 1's capture doesn't catch it (`#000000` is truthy and passes through).

### The fix

Two-layer defense:

**Layer 1 — `_hasRendered` runtime gate.** A new boolean on `familyWizardState`, initialized `false` in both `fwBuildFreshBuffer` and the cache-hydrate branch in `openFamilyWizard`. The pre-render capture call at the top of `fwRenderStep` is now wrapped in `if(familyWizardState._hasRendered){ ... }`. Flag flips to `true` at the bottom of `fwRenderStep` after the first paint completes. **Critically, `_hasRendered` is NOT included in the `fwSaveCache` payload** — it's runtime-only and must reset to `false` on every fresh page load.

**Layer 2 — Step 2 defensive fallback.** Step 2's primary-email capture now matches Step 1's defensive pattern: `primEmailEl.value.trim() || familyWizardState.primaryEmail`. Even if a future refactor or DOM-reset path bypasses Layer 1, an empty input cannot silently overwrite a real buffered value.

The two layers are belt-and-suspenders. Layer 1 fixes the Gate A bullet 6 failure mode definitively; Layer 2 is insurance against future regressions of the same bug class.

### What this fix lands as a side benefit

The SF-2 color clobber (Step 1 colors flipping to `#000000` after refresh + Back-to-Step-1) was the same architectural bug. Layer 1 fixes it without any color-specific code.

### What this fix does NOT touch

- Per-child wizard cache writes — different code surface, Option-2 split. If Mike sees similar field-clobber bugs there, address separately as a Patch 3 item.
- Step 1 defensive fallbacks — they were partial workarounds for this same bug. Now redundant with `_hasRendered` but harmless to leave in place.
- `fwSaveCache` payload shape — verified during fix that `_hasRendered` is correctly excluded from the persisted payload.

---

## Files changed

`app.js` only. Five touch points in the file:

1. `fwBuildFreshBuffer` (~line 6380) — added `_hasRendered: false` to the returned buffer shape, with a documentation comment.
2. `openFamilyWizard` cache-hydrate branch (~line 6453) — added `_hasRendered: false` to the hydrated buffer shape.
3. `fwRenderStep` (~line 6577) — wrapped the pre-capture call in `if(familyWizardState._hasRendered)`. Added a long explanatory comment.
4. `fwRenderStep` (~line 6626) — added `familyWizardState._hasRendered = true;` after the step-specific paint dispatch.
5. `fwCaptureStepInputs` Step 2 (~line 6648) — added `|| familyWizardState.primaryEmail` defensive fallback.

Net diff: ~30 lines added (mostly comments), 0 lines deleted. Behavioral surface area: capture-on-pre-render and Step 2 empty-clobber.

`index.html`, `styles.css`, `Code.gs`, `version.json` — unchanged.

---

## Pre-flight verification (mechanical, done)

- `node -c app.js` clean.
- All five `_hasRendered` references grep cleanly.
- Zero DEV URL leaks (`AKfycbzllKi2yrrPVRpupb33pIs81x0` returns no matches in `app.js`).
- Production API_URL preserved at `app.js:39`.

---

## Gate A re-run plan

Re-run bullets 3 and 6 specifically. The exact failure flow that bit alpha-2:

### Bullet 6 — Round-trip test (the one that failed)

1. Use `fam_wiztest2` (or a fresh `fam_wiztest3` if cache pollution from prior testing is a concern). The row should have `state.config.emails.<primaryName>` pre-seeded with a real email value.
2. Log in as the primary parent. Wizard should auto-open.
3. **Step 1 verification** — confirm bank name + colors render with the row's pre-seeded values, not the constants.
4. Tap Next → Step 2. Confirm primary email field shows the pre-seeded email.
5. Tap Next → Step 3. Add a child (e.g., KidT3).
6. **Hard refresh the browser.** The wizard should re-open and resume on Step 3 (or Step 4 if you advanced that far before refresh) with the child still listed.
7. Tap Back to Step 2. **Confirm primary email is still present.** This is the failure point in alpha-2.
8. Tap Next → Step 3. Tap Next → Step 4 (review). **Confirm the review shows the primary email correctly.**
9. Tap Finish. Confirm exactly one main state POST + one audit-log POST (the established pattern, see Bullet 2 nuance).
10. Inspect the Sheet row for `fam_wiztest2`. Confirm `state.config.emails.<primaryName>` matches the pre-seeded value (was preserved through the wizard).

### Bullet 3 — Refresh-resumes-correctly (re-confirm)

1. Fresh state (clear localStorage if needed).
2. Step 1 → fill all fields → Next.
3. Step 2 → fill all fields → Next.
4. Mid-Step-3 → hard refresh.
5. Re-open wizard.
6. **Confirm:** lands on Step 3. Step 1 and Step 2 fields all retain their values when navigating Back through them. Toast "Resuming setup — tap Back to review earlier steps." Start-over link visible.

### Bonus check — SF-2 color regression

1. Use a row pre-seeded with `state.config.colorPrimary = "#2563eb"` (or any non-default).
2. Log in. Step 1 should show `#2563eb` in the primary color picker.
3. Walk to Step 4, refresh, Back-Back-Back to Step 1. **Confirm color is still `#2563eb`, not `#000000`.**

---

## If Gate A passes

Ping Linus for the architecture checkpoint. Same gate as before — verify A1+A2 architecture is right before continuing to Groups B/C/D.

## If Gate A fails

Stop. Report which bullet failed and what the symptom was. Do not push past a failing gate, especially after this round.

---

## Updated future-bug observations (post-Patch-2 backlog)

Existing OBS-1 and OBS-2 from alpha-2 carry forward. New entry:

- **OBS-3 (alpha-3):** Step 2 primary email is now a one-way ratchet inside the wizard. The defensive `|| familyWizardState.primaryEmail` fallback prevents silent clobber-with-empty but also prevents intentional clearing — a user who wants to remove their primary email in the wizard cannot. Workaround: clear it from Settings post-wizard. Patch 3 / event-driven capture refactor (onChange writes to buffer, capture-on-navigate goes away) naturally fixes this. Acceptable tradeoff for now since pre-populated email in `cfg.emails[currentUser]` came from the user's own signup.
