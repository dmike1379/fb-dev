# Resume Notes — FamilyBank v37.2 Patch 2 — Alpha-3 Pickup

**For:** Builder #3 (only if Mike's chat dies before Patch 2 ships)
**From:** Linus (Builder #2). Picked up from Builder #1's alpha-1; alpha-2 shipped A1+A2; alpha-3 fixes the Gate A bullet 6 cache-clobber bug.
**Spec of record:** `FamilyBank_v37_2_Patch2_scope.md` in this zip — Option-2 split documented at top of A1.

Read this file before reading the scope doc.

---

## TL;DR

A1+A2 implementation is complete. Cache-clobber bug from alpha-2 Gate A is fixed in alpha-3. Awaiting Gate A re-run in DEV. If Gate A passes, advisor checkpoint, then continue to Groups B/C/D.

---

## Architectural decisions locked (do not re-litigate)

Carried forward from alpha-2:

1. **Option-2 split scope.** Family-setup wizard gets full A1. Per-child wizard gets cache-for-resume only. Per-child A1 deferred to Patch 3.
2. **`furthestStep` is the resume bookmark.**
3. **Cache key shapes** unchanged.
4. **Close behavior**: two paths to nuke cache (Start-over link family wizard only; Discard button in close-confirm dialog both wizards). No ambiguous Cancel in close dialog.
5. **Per-child wizard has NO Start Over affordance** (Option A locked in alpha-2).
6. **`wizardRequestClose` does NOT call `wizardSaveCurrentStep`** (avoids live-state mutation on Discard).

NEW in alpha-3:

7. **`_hasRendered` runtime gate on `familyWizardState`.** Boolean, false on every fresh load (not persisted to cache), flipped true after first paint. Gates the pre-render capture call in `fwRenderStep` to prevent reading unpopulated DOM. **Do not persist this flag to cache.** `fwSaveCache` already excludes it; if a future refactor adds it to the payload by accident, the bug returns.
8. **Step 2 primary email capture has defensive `|| familyWizardState.primaryEmail` fallback.** Belt-and-suspenders for #7. Side effect: primary email becomes a one-way ratchet inside the wizard (see OBS-3).

---

## What's IN this zip (alpha-3)

### `app.js` — modified (one bug fix on top of alpha-2)

| Lines (approx) | Change |
|---|---|
| 6380 | `_hasRendered: false` added to `fwBuildFreshBuffer` |
| 6453 | `_hasRendered: false` added to cache-hydrate branch |
| 6577–6593 | `fwRenderStep` pre-capture wrapped in `_hasRendered` gate |
| 6626 | `_hasRendered = true` set at end of `fwRenderStep` |
| 6648–6651 | Step 2 capture defensive fallback added |

All other code is identical to alpha-2.

### Files NOT in this zip

- `index.html`, `styles.css` — unchanged from alpha-2. If alpha-2 isn't already deployed, push those alongside this `app.js`.
- `Code.gs`, `version.json` — unchanged from production v37.1.

---

## What's NOT done (post-checkpoint work)

Same as alpha-2:
- Group B (wizard data persistence)
- Group C (wizard UX cleanup)
- Group D (approval / signup polish)

---

## Gate A re-run

See CHECKPOINT_NOTES.md for the exact procedure. Headline: re-run bullets 3 and 6, plus the SF-2 color regression bonus check.

---

## Gotchas carried forward (still relevant)

All gotchas 1-10 from alpha-2's RESUME_NOTES still apply. New gotchas from alpha-3:

### NEW Gotcha 11 (alpha-3): `_hasRendered` is runtime-only

The flag must NOT be persisted to cache. If `fwSaveCache`'s payload ever starts including it, the bug returns: `_hasRendered: true` would be hydrated on resume, the gate would pass, and pre-render capture would clobber the buffer again. Currently safe (verified during alpha-3 fix) but worth a comment to prevent future regression.

### NEW Gotcha 12 (alpha-3): Step 2 fallback creates one-way ratchet

The `|| familyWizardState.primaryEmail` fallback prevents users from intentionally clearing primary email mid-wizard. By design (silent erasure was the worse failure mode). Documented as OBS-3. If a user complains they can't clear their email, the answer is "Settings post-wizard." If product wants this fixed properly, Patch 3 should refactor capture-on-navigate to event-driven (onChange writes to buffer, captureStepInputs becomes obsolete).

### NEW Gotcha 13 (alpha-3): Step 1 defensive fallbacks are now redundant but load-bearing

Step 1's existing `|| id.<field>` fallbacks were partial workarounds for this same bug class. With `_hasRendered` they're redundant — but DO NOT REMOVE them. Same belt-and-suspenders argument. They cost zero runtime; removing them invites the bug back.

---

## Future-bug observations (post-Patch-2 backlog)

- **OBS-1:** Wizard Step 1 silently drops rename attempts after first advance. Pre-existing v37.1.
- **OBS-2:** Concurrent two-parent new-child creation collides on `__pending__` cache key.
- **OBS-3 (alpha-3):** Step 2 primary email is a one-way ratchet inside the wizard. Defensive fallback prevents intentional clearing. Workaround: Settings post-wizard.

---

## If Gate A revealed a problem (alpha-3 version)

Stop. The most likely failure modes for alpha-3:

1. **Bullet 6 still fails after alpha-3 deploy.** Check Network tab — did Mike actually deploy alpha-3's `app.js` or is the browser serving cached alpha-2? Hard refresh / clear service worker. If genuinely the new code, set a console breakpoint at `fwCaptureStepInputs` line 6648 and step through to see what `primEmailEl.value` contains at the moment of capture.

2. **Color regression still fires.** Check that `fwBuildFreshBuffer` has `_hasRendered: false` — without it, the fresh-open path also hits the bug.

3. **Wizard fails to open.** Check console for ReferenceError. Most likely culprit is a syntax mistake in the new code (the `node -c` check at packaging is mechanical and can miss runtime issues).

---

## Picking up post-checkpoint (for Builder #3 if needed)

Standard session opener:

  Hi Claude. You're Builder #3 for FamilyBank v37.2 Patch 2.

  Gate A passed in DEV (alpha-3). Linus's alpha-3 zip is the basis.
  Mike will upload it. Picking up at Group B (or wherever Mike directs).

  Please:
  1. user_time_v0
  2. Gmail:list_drafts query "[claude-handoff]" — load the handoff
     ending in "Patch 2 — Gate A passed (alpha-3), ready for B/C/D"
  3. Read the scope doc Group B / C / D sections
  4. Confirm scope before writing any code
  5. Same checkpoint discipline — don't ship without an audit

---

## End of resume notes
