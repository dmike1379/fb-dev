# FamilyBank v38 — NTH Proposals (cumulative across build steps)

This file accumulates scope-expansion candidates surfaced by the builder
across all v38 build steps. Per Build Doc §1 Rule 2, builder does NOT make
the improvements — they are recorded here for Mike to triage into the
canonical `FamilyBank_Future_Features_and_NTH_Log.md` in project knowledge
when convenient.

**Single file across all steps. Append, do not recreate.**

---

## Step 2 (Lath)

No proposals surfaced during Step 2. The v36.1 family-state runtime is
slated for rewire in Step 2.5, so observations about its shape (5-column
Ledger, single-cell A1 state, hand-curated `delete body._foo` cleanup in
doPost, etc.) are part of the locked v38 plan rather than NTH candidates.

No improvement opportunities outside scope arose.

---

## Step 2.5 (Reeve)

### NTH-2.5-A: `checkCalendar` is a latent v36.1 bug — feature never worked

**Surface area:** `app.js` (two call sites: `checkChoreCalendar` ~line 6803, `reAddChoreToCalendar` ~line 6854) and the missing-from-Code.gs server route `?action=checkCalendar`.

**Discovery context:** Build Doc §4 Step 2.5 outputs list named `checkCalendar` among the email-callback routes that need `familyId` threading. Investigating the route to thread `familyId` through it surfaced the actual state of the feature.

**What's wrong:** No `?action=checkCalendar` handler exists in v36.1 Code.gs (verified) or in Lath's Step 2 fork (verified). The two client-side call sites construct `?action=checkCalendar&child=...&choreId=...&choreName=...&t=...` URLs, fetch them, and check `data.events` / `data.noCalendar` / `data.calendarOff` on the response. None of those fields are set anywhere in Code.gs's default `doGet` branch — which is what the request actually hits. So the response body is a full v36.1 state JSON (without an `events` array), and the client always falls into the `else` branch and renders "Not on calendar" with a "Re-add" button. Clicking "Re-add" then calls `reAddChoreToCalendar`, which itself runs the same broken check — so the fallback path doesn't actually verify anything either, just unconditionally fires `syncToCloud("Chore Edited (calendar re-add)")`.

**Net behavior in v36.1 PROD:** every chore in Linnea's app shows "Not on calendar" with a "Re-add" button on first render, regardless of whether the calendar event actually exists. Mike — worth confirming this against current PROD to verify my read; if your calendar status currently always says "Not on calendar" and "Re-add" is a no-op-but-harmless button, that's the symptom.

**Decision in Step 2.5 (Op-1, confirmed by Tern):** treat as doc artifact. Rewire only the six existing email-callback routes (approve/deny/depositApprove/depositDeny/withdrawApprove/withdrawDeny) plus default `doGet`. Don't rewire `checkCalendar`. Don't strip the dead client calls — they keep falling through to default `doGet` (which now gets `familyId` correctly) so the broken behavior is unchanged from v36.1.

**Future resolution alternatives (not v38 scope):**

A. **Implement the route properly.** Add a `?action=checkCalendar` handler in `doGet`. It would take `(familyId, child, choreId)`, look up the calendar ID via `getCalendarId(state, child)`, query `CalendarApp.getCalendarById(calendarId).getEvents(...)` filtered by chore description tag `CHORE_ID:<choreId>`, and return `{events: [...]}` or `{noCalendar: true}` or `{calendarOff: true}` depending on configuration. This is non-trivial: needs a tight time window on the event query (CalendarApp is slow), needs to thread `familyId` for cross-family safety, needs to mirror the description-tag convention in `createEventsForChore`.

B. **Strip the dead client calls.** Remove `checkChoreCalendar` and `reAddChoreToCalendar` from `app.js`, plus their button render and the spinner element from `index.html`. Cleaner UI, no broken call. Loses the user-facing affordance.

C. **Disable the spinner UX, leave the calls.** Comment out the `statusEl` updates in `checkChoreCalendar` so the chore card never shows "Not on calendar" — but keep the `reAddChoreToCalendar` button as a manual "force calendar resync" affordance. Lighter-touch than B.

Recommend triaging this NTH after v38 base is stable. A is the right answer if calendar integration is meant to be a real product feature. B is the right answer if it's not. C buys time without committing.

---

### NTH-2.5-B: `_savedAt` stale-write guard documented but not implemented

**Surface area:** `app.js` line ~610-620 (comment claims server enforces stale-write rejection); Code.gs has no such logic.

**What's wrong:** `app.js` `_doSyncToCloud` adds `_savedAt: new Date().toISOString()` to every payload, with a long comment explaining: "Server compares this to its own `_savedAt` and rejects the POST if ours is older." Grepping Lath's Step 2 Code.gs (and v36.1 Code.gs) for `_savedAt` returns zero hits. The server never compares timestamps. The field rides through `saveState` into the saved JSON as a metadata field but does nothing.

**Discovery context:** While auditing the doPost rewire to make sure no v34 stale-write logic was being broken.

**Decision in Step 2.5:** out of scope per Rule 4. The field continues to ride through; nothing breaks; nothing is gained.

**Future resolution alternatives (not v38 scope):**

A. **Implement the guard server-side.** In `doPost`, before `saveState`, compare `body._savedAt` to the prior state's `_savedAt`. If body's is older, return `{status: "stale_write"}` and don't save. Marginal correctness improvement against the same-client race the comment describes.

B. **Strip the comment + the field add.** Cleanup. Removes the misleading documentation. No correctness change.

The original v34 problem (proof-photo POST + login POST race) appears to be mitigated client-side by the `_syncChain` queue that linearizes outbound calls — so the server-side guard is probably not actually needed in practice. B is the lighter-touch choice.

---

### NTH-2.5-C: `processSignupDiff` is dead code in v38

**Surface area:** Code.gs lines ~1086-1180 in the new file (the function and its caller in `doPost`).

**What's wrong:** `processSignupDiff` was the v37.0.2 hotfix client-intercept pattern for in-app parent signup. v38 admin-managed signup (Step 3) does not populate `state.config.pendingUsers` — it uses the `PendingSignups` tab. So `processSignupDiff` always sees `priorPending = []` and `newPending = []` for v38 families, which means both forEach loops are no-ops. It's about 100 lines of dead code.

**Decision in Step 2.5:** left in place per Rule 4 (no cleanup beyond locked scope). Tagged here for future cleanup.

**Future resolution alternatives:**

A. **Delete the function and its `doPost` call.** Pure cleanup. Saves ~100 lines.

B. **Repurpose for v38 PendingSignups diff notifications.** When `adminApprove` runs in Step 3, the audit-log path could send approval/denial emails to the requester. `processSignupDiff` is conceptually similar but operates on the wrong data shape; rewriting it from scratch is probably easier than retrofitting.

Recommend A after Step 3 lands and the v38 admin-signup flow is the only signup path that fires.

---

### NTH-2.5-D: `calcNetWorthHistory` zeros out the moment current month has any Ledger row

**Surface area:** `calcNetWorthHistory(familyId, childName)` in Code.gs (~line 2353 in the new file). The v30.1 fallback block inside it.

**Discovery context:** Surfaced during DW-3 testing on 2026-05-05. After running `monthlyMaintenance()` against the seeded test family `fam_test_aaa`, Linnea's `state.netWorthHistory.Linnea` returned `[{"month":"2026-05","total":0.21}]` — when her actual total balance was `$150.21` ($100 checking + $50.21 savings post-interest). The chart-feed array showed `0.21` instead of `150.21`.

**What's wrong (v36.1 behavior, not a Step 2.5 regression):** The function walks the Ledger summing amounts into a per-month running total. The v30.1 "current-month fallback" was added to handle the day-one case where a child has balances but no Ledger history yet — it substitutes the current total balance for the current month. But the fallback is gated on `if (!monthly.hasOwnProperty(currentKey))` — meaning it only fires when the current month has *zero* Ledger rows. The instant any Ledger activity hits the current month (even a single $0.21 interest deposit), the fallback is suppressed and the chart shows the running Ledger sum from row 1 onward — which, for a manually-seeded family with no historical Ledger, starts at $0.

**Why this would have been masked in v36.1 PROD:** Linnea's PROD Ledger has months of historical activity. The running sum at any given current month is a believable approximation of her net worth (within rounding error from manual adjustments and interest). In a fresh-seeded family with no historical Ledger, the discrepancy is dramatic — current balance vs running-sum-from-zero diverge by the entire seeded balance.

**Failure mode:** the chart will display incorrect totals for any family that:
1. Was seeded manually (no historical Ledger entries) — applies to fam_test_aaa, fam_test_bbb, AND any v38 production family created via the future Step 3 `adminApprove` flow.
2. Has had any Ledger activity in the current month.

Step 3's `adminApprove` will create new family rows with seeded balances but no Ledger history. Every newly-approved family will display `~$0` on its net-worth chart for the first month they have any activity (allowance, chore, interest, etc.). UX papercut. Then in subsequent months, the chart re-converges as Ledger history accumulates.

**Future resolution alternatives (not v38 Step 2.5 scope):**

A. **Drop the gate.** Always seed `monthly[currentKey]` with current balance, then let Ledger sum overlay it. But the Ledger amounts are *deltas*, not absolute balances — adding them on top of an absolute would double-count.

B. **Seed each month-bucket with a baseline.** When iterating Ledger, group by month, and for each month compute the running-sum offset from a known baseline (the family's seeded balance or the prior month's closing balance). More involved but produces a correct running net-worth.

C. **Capture monthly snapshots.** v37.2/v38 backlog item: snapshot total balance at the start of each month and store in a new tab or in state. `calcNetWorthHistory` reads snapshots directly, no Ledger walk. This is the cleanest fix and aligns with the "two-year rolling Ledger window with monthly snapshots" idea in the future-features log. C is the long-term right answer.

D. **Inject a synthetic Ledger row on family creation.** When `adminApprove` creates a family, write one `[date, familyId, "Bank", "(seed)", "Initial Balance", totalBalance]` row to the Ledger. That row anchors the running sum so the chart starts at the seeded total instead of $0. Cheap and surgical; trade-off is one synthetic Ledger row per family that doesn't represent a real transaction.

Recommend D as a short-term fix (Step 3 is touching `adminApprove` anyway, so adding a single Ledger seed row is in-scope-adjacent), with C as the long-term plan.

---

## Step 2.5 Fix Pass (Spar audit follow-up, Reeve continuation 2026-05-10)

The next five entries surfaced during Spar's depletion audit of Step 2.5
(`FamilyBank_v38_Step25_Audit.md`). Three Reeve-side bugs identified by
that audit (Bug 1, 2, 3) were fixed in the same continuation session
and do NOT appear here — they're handoff items, not NTH items. These
five are non-blocking observations Spar marked as NTH-only.

---

### NTH-2.5-E: `sendEventEmail:1046` `rowW[2]` reads the wrong Ledger column for `wNote` — pre-existing v36.1 bug

**Surface area:** `Code.gs:1046`, function `sendEventEmail`, in the `lastAction === "Withdrawal Approved"` branch.

**Discovery context:** Spar's audit of Step 2.5 (Bug 2). The adjacent line 1045 was a Reeve regression Spar found and was fixed in the same continuation session. Line 1046, however, is a **pre-existing v36.1 bug** — predates v38 entirely. Not in scope for the Step 2.5 fix-pass per Rule 4.

**What's wrong:**
```javascript
var wNote = rowW ? String(rowW[2]).replace(/^Withdraw:\s*/, "") : "your withdrawal";
```
In v36.1 5-col Ledger schema `[Date, User, Child, Note, Amount]`, this read should have been `rowW[3]` (Note column). It was reading `rowW[2]` (Child column) and stripping a `"Withdraw: "` prefix that never appeared on a child-name value — so the regex was a no-op and `wNote` ended up being the child's name (e.g. "Linnea"). Has been broken since v35.0 Item 2 introduced withdrawal flows.

In v38 6-col schema `[Date, FamilyId, User, Child, Note, Amount]`, the correct column would be `rowW[4]`. Currently still reads `rowW[2]` which is now the User column (returns "Bank" or child's name depending on the audit-log convention).

**User-visible impact:** in the "Withdrawal Approved" email confirmation, the "Note" field renders as either the child's name (v36.1) or "Bank" (v38), never the actual withdrawal note.

**Future resolution:** single-line edit, `rowW[2]` → `rowW[4]`. Trivial. Bundle into a future NTH-cleanup pass or wait for the v37.2 wizard work to surface a natural reason to touch this file again.

---

### NTH-2.5-F: client-supplied `tx.date` in doPost violates D6.6 (server-written timestamps)

**Surface area:** `Code.gs:530`, function `doPost`, inside the `transactions.forEach` block:
```javascript
tx.date || ts,
```

**Discovery context:** Spar's audit (notes section). v36.1 carry-forward, not a Reeve regression.

**What's wrong:** D6.6 (per the build doc's conventions section) is "server-written timestamps... never client-supplied." The `tx.date || ts` fallback honors a client-supplied timestamp when one is present in the temp-transaction body, only falling back to the server's `Utilities.formatDate(new Date(), tz, ...)` if absent. A misbehaving or compromised client could backdate a transaction's Ledger row to a date of its choosing.

**Why it's not blocking:** the existing client (`app.js`) doesn't actually populate `tx.date` for any path inspected during the audit, so in practice every transaction gets the server-written `ts`. The vulnerability exists but isn't exploited.

**Future resolution alternatives:**

A. **Drop the `tx.date ||` and always use `ts`.** One-character edit. Closes the door on a misbehaving client and matches D6.6 exactly.

B. **Validate `tx.date` server-side if present.** If the field is sometimes legitimately client-supplied (e.g. for retroactive ledger entries during family setup), parse it and reject if it's more than N hours off from server time. More involved; only worth doing if the field has a real use case.

Recommend A absent evidence the field is ever legitimately client-set.

---

### NTH-2.5-G: alpha-zip handoff said 10 Ledger `appendRow` sites; actual is 11

**Surface area:** Reeve's alpha-zip handoff (the pre-fix version at handoff line 66 of the prior shipped doc) claimed "10 sites" for the 6-element Ledger `appendRow` pattern. Spar's audit found 11.

**The missed site:** `checkStreakMilestone` at `Code.gs:2314`. The site itself is **correct** (6-element row with `familyId` at index 1 — Reeve's rewire fixed this site cleanly). The discrepancy is in the handoff's documentation count, not in the code.

**Discovery context:** Spar's exhaustive grep of every `ledger.appendRow(` and `getLedgerSheet().appendRow(` site during the audit. Reeve's inventory note in the prior handoff missed counting one site, even though the code at that site was edited correctly.

**Impact:** zero on runtime behavior. Documentation drift only. Future builders consulting the handoff for "how many sites need attention" would miss the `checkStreakMilestone` site in their mental model even though it's already correct.

**Future resolution:** if a future handoff revision pass is happening anyway, bump the count to 11 and add `checkStreakMilestone:2314` to whatever inventory listing exists. Otherwise leave; not actionable.

---

### NTH-2.5-H: alpha-zip handoff email-link line numbers drifted from actual file

**Surface area:** Reeve's alpha-zip handoff (line 32 of the prior shipped doc) claimed:
> "chore line 758-763, deposit ~887-893, withdraw ~921-927"

Actual locations in the shipped Code.gs: chore 842/843, deposit 978/979, withdraw 1014/1015.

**Discovery context:** Spar's audit (notes section). The structures Reeve described match (approve/deny URLs with `&familyId=` embeds, all three email types covered), but the literal line numbers Reeve cited are off — drift accumulated during the surgery as earlier edits shifted later content.

**Why it's not blocking:** per audit Lesson 8 (and the build doc's general convention), trust function structure over literal line numbers across builder generations. A future builder looking for these sites can `grep -n "ScriptApp.getService"` or `grep -n "&familyId=" ` and find them all in seconds. The literal line cites in the handoff are a stale reference, not a correctness issue.

**Future resolution:** if a future handoff revision pass is happening, update the literal numbers to the actual values. Otherwise leave; not actionable. Also worth a note for Reeve's future sessions: when citing line numbers in a handoff, do so after the final edit pass, not after a mid-build snapshot.

---

### NTH-2.5-I: `_runMonthlyMaintenanceForFamily` saves unconditionally

**Surface area:** `Code.gs:702` (approximately, in the new file), function `_runMonthlyMaintenanceForFamily`, the line `saveState(familyId, state);` at end of body.

**Discovery context:** Spar's audit (notes section). v36.1 carry-forward — the v36.1 `monthlyMaintenance` also saved unconditionally. Not a Reeve regression; carries forward from the v36.1 design.

**What's wrong (mildly):** `_runAutomatedMondayDepositForFamily` and `_runDailyChoreResetForFamily` both wrap their save in `if (changed) saveState(familyId, state);`. `_runMonthlyMaintenanceForFamily` does not. For a family with all-zero interest rates (e.g. a family with both checking and savings rate set to 0), the function bumps balances by zero, writes a Ledger row only if interest is > 0 (which it won't be), but still re-writes the same unchanged JSON to col B.

**Impact:** mild performance hit on no-op months — one extra Sheet write per zero-interest family per monthly run. No correctness issue (the rewritten JSON is identical to what was already there). Cache invalidation fires unnecessarily on the affected family's key.

**Future resolution:** add an `if (changed)` guard. The `changed` flag needs to be threaded — easiest pattern is to set `changed = true` inside the per-child loop whenever interest is applied (i.e. when `ic > 0 || is_ > 0`), then gate the final save on it. Same pattern as the other two trigger inner-helpers.

Worth doing if either (a) a future v38 family has zero-rate accounts as a deliberate config option, or (b) the unnecessary writes start showing up in Sheet API quota tracking. Otherwise low priority.

---

## Step 2.5 — Live DW Test (Cleat)

Findings surfaced by Cleat during the live DW test pass. Mike's decision on each captured inline.

### NTH-2.5-J: BUG-1 (pre-existing v36.1) — Deposit-request emails never fire

**Severity:** Functional bug. Parents have no out-of-band notification when child requests a deposit.

**Root cause:** Field name mismatch.
- Frontend `submitDeposit()` (app.js:1388) writes to `data.pendingDeposits[]`
- Backend `sendEventEmail` for `lastAction === "Deposit Submitted"` (Code.gs:969) reads from `data.deposits[]`
- Backend filter returns empty → email send guard exits silently at Code.gs:971

**Scope:** Pre-existing in v36.1 (`v36_1_Code.gs:818` has the same `data.deposits`). Carries through every version from v36.1 onward. Affects current production v37.1.

**Mike's decision (2026-05-18):** Log only. Do NOT fix production or v38.0. Whenever deposit-email path next gets touched in a future patch, fix at that time.

**Fix when triggered:** One-line change to Code.gs:969:
```javascript
// before
var deposits = data ? (data.deposits || []) : [];
// after
var deposits = data ? (data.pendingDeposits || []) : [];
```
Withdrawal path (Code.gs:1007) is already correct (`pendingWithdrawals`); only deposit path needs the fix.

---

### NTH-2.5-K: BUG-2 (pre-existing) — APP_VERSION footer stuck at "v34.1"

**Severity:** Cosmetic.

**Root cause:** `const APP_VERSION = "34.1"` in `app.js:61` has not been bumped since v34.1. Multiple builders flagged but never fixed.

**Scope:** Cosmetic only — does not affect functionality. Long-standing nag.

**Fix:** Update line 61 to current version each build; or drive from `version.json` at runtime (preferred — would prevent future drift).

---

### NTH-2.5-L: Deposit submit bottom sheet does not auto-close

After child taps Submit on a deposit request, the bottom sheet stays open. Child has to manually close before submitting a second deposit. Withdrawal flow does auto-close (Item 18, `app.js:1282`).

**Fix:** Add auto-close to `submitDeposit()` matching the withdrawal pattern.

---

### NTH-2.5-M: Pending deposits not visible in parent Transaction History

Pending deposit requests don't appear in the parent's Transaction History view. May be intentional (history = settled transactions only) or oversight. Worth confirming with intended design before patching.

---

### NTH-2.5-N: Deposit submit shows no confirmation modal; Withdrawal submit does

UX inconsistency between the two child-side submission flows:
- `submitDeposit()` (`app.js:1384`) — direct submit, no modal
- `confirmWithdraw()` (`app.js:1262`) — modal confirmation before submit

Pick one pattern and apply to both. Modal-then-submit pattern (matching withdraw) likely correct — lower regret on accidental submission.

---

### NTH-2.5-O: `_lib.py` (test helpers) Windows cp1252 encoding crash

`append_result` opened the result doc without explicit UTF-8 encoding. Windows default cp1252 can't encode `→`, `✓`, etc. Crashed after every test phase, after the actual PASS/FAIL result was already printed (so no functional loss). **Fixed in canonical helpers** (re-issued in final zip); the broken local copy on Mike's machine should be replaced before re-use.

**Status:** Fixed in Cleat's canonical helpers copy. Local replacement pending on Mike's side.

---

## Step 4 — Frontend (Keel)

Findings surfaced by Keel during the Step 4 build. Mike's decision on each captured inline where applicable.

### NTH-4-A: `version.json` `v`-prefix vs Service Worker version-check

**Severity:** Cosmetic-with-functional-impact (would fire spurious update banners).

**Root cause:** The SW's update check compares `data.version !== SW_VERSION.replace('v','')` — i.e., it expects `version.json` to store the version **without** a `v` prefix. The Build Doc §3 spec describing version.json format implies storing `"v38.0"`, which would break the invariant and fire the NTH-19 update banner on every poll.

**Bridge fix in Step 4:** Store `{"version":"38.0", ...}` (no `v`), display-side prefix the `v` when stamping splash + login. Stamp reads `v38.0 · build step4-1` as intended; SW comparison stays satisfied.

**Real fix (when NTH-19 SW rewrite happens):** Normalize the comparison — strip `v` from both sides of the check before comparing. Then version.json can store either format consistently.

---

### NTH-4-B: `setChildEmail` cannot clear an email

**Severity:** Bridge-period UX gap.

**Root cause:** Strake's Step 3 `setChildEmail` validates email format and rejects empty input. By design — the route was scoped to set/change, not clear. No `clearChildEmail` route exists.

**Bridge in Step 4:** UI keeps the old email and shows "use admin panel (coming soon)" toast when a user attempts to clear. Old email retained in `config.emails`.

**Fix options for Step 5 admin panel:**
- a. Add a `clearChildEmail(adminPin, familyId, childName)` route
- b. Modify `setChildEmail` to accept empty `newEmail` with explicit `intent="clear"` parameter
- c. Add an admin-only "remove email" UI flow that calls a new dedicated route

Mike's call during Step 5 build.

---

### NTH-4-C: Per-Child Wizard email step is fire-and-forget

**Severity:** Subtle. Acceptable for DEV.

**Root cause:** `wizardSaveCurrentStep` returns before the async admin-PIN prompt for `setChildEmail` resolves. Wizard step advances while the email update is still in flight. Notify prefs save synchronously (safe); email mirrors only on prompt success.

**Edge case to be aware of:** For a brand-new child, a fast user could trigger `setChildEmail` before the step-1 child-creation sync lands. Combined with Strake NTH #3 (`setChildEmail` accepts non-existent `childName`), this could produce a transient orphan that self-corrects on the next sync.

**Fix when next touched:** Wizard rebuild that `await`s the prompt before advancing. Parked — not Step 4 scope.

---

### NTH-4-D: Orphan `ps-email-input` reads

**Severity:** Trivial cleanup.

**Root cause:** `openParentSettingsSheet` (`app.js:6843`) and `renderParentSettings` (`app.js:1694`) still read `ps-email-input`, which was removed when `saveParentEmailFromSheet` was deleted. Reads are now null-guarded no-ops.

**Fix when next touched:** Remove the orphan reads. Trivial; only kept per Rule 4 (no cleanup beyond locked scope).

---

### NTH-4-E: Email accepted in the cached "Your Name" field

**Severity:** UX flexibility — Mike's request, not v38 scope.

**Mike's note (2026-06-06):** In State B (cached device), the single login field should accept an email as well as a display name. Email should always be acceptable.

**Already parked in Build Doc §5** ("direct email-in on cached device for fast family switching… not v38 scope").

**Design fork for whoever builds it:**

a. **Convenience alias** — email matched within the *currently cached* family only. Same outcome as typing the display name; doesn't switch families. Safer (no accidental cross-family logins) but less flexible.

b. **Full `loginByEmail` route** — email triggers backend lookup; can switch to a *different* family without manual cache clear. More flexible but introduces risk of unintended family switch from typo.

§5's intent suggests (b). Tern to re-lock the fork direction when this lands.

---

## Step 5 — Frontend (Sill)

### NTH-5-A: Admin panel still hosts per-family settings — split required before public release

**Severity:** Architectural debt. Bounded — only bites multi-tenant adoption (e.g., Instructables release).

**State at Step 5:** The admin panel currently coexists global sections (queue, family list, admin email, admin PIN) and per-family settings (branding, user management, timezone, auto-logout). Both are gated behind the same global admin PIN.

**Why deferred:** Build Doc §4 Step 5 scope is the four global sections only. Moving per-family settings to a parent-reachable surface is a step of its own (new surface, 4 section relocations, new auth gate). Folding it into Step 5 would have violated the scope discipline that has held through every prior step.

**Why it's not optional for public release:** A global admin editing one family's branding is incoherent in a multi-tenant model. Different families have different parents who shouldn't see each other's settings.

**Required scope when this lands (probably Step 5.5 or a pre-public-release pass):**

a. New parent-reachable settings surface (likely a new sheet/screen, since v36.1 had no parent-only settings surface — everything was gated by the admin PIN).
b. Relocate four sections: branding, user management, timezone, auto-logout.
c. New auth gate — parent PIN validation (the family-state PIN, not the global admin PIN).
d. Navigation entry point — how the parent reaches the new surface from the main app.
e. Wire-protocol updates for any settings writes that previously used admin context.

**Mike's decision (2026-06-07):** Log here as a pre-public-release gate. Build doc may also want a Section 8 or explicit "Required before Instructables release" block to make this load-bearing for the sequencing of Step 6 onward.

---

### NTH-5-B: Admin PIN entry — Enter key doesn't submit

**Severity:** UX annoyance.

**Symptom:** On admin login, typing the PIN and pressing Enter does nothing. User has to click the submit button.

**Comparable behavior elsewhere in v36.1/v38:** The main login screen wires `keydown` Enter handlers on `username-input` (jumps focus to `pin-input`) and `pin-input` (calls `attemptLogin()`). Same pattern exists on `admin-pin-input` (calls `attemptAdminLogin()`) per v36.1 line ~4301 in Keel's app.js. **If the new admin login flow Sill built bypasses or rewrites that handler, the Enter-key wiring needs to be reinstated** for the new submit path (likely a new function that wraps `adminLoad` + populates the panel).

**Fix:** Add a `keydown` Enter handler on the admin PIN input that calls the new submit function. One line, matches existing convention.

**When:** Next Sill iteration in Step 5, alongside drops 2-3. Doesn't need a dedicated session.

---

### NTH-6-A: Service-worker version check can never match → update message fires whenever the check runs

**Severity:** Cosmetic, pre-existing (not introduced by Step 6; same shape at step5-3).

**Symptom (code-verified, not runtime-observed):** `handleVersionCheck` (service-worker.js:90) compares version.json's `version` field (`"38.0"`) against `SW_VERSION.replace('v','')` (`"38.0-step6-1"`). The build suffix means the strings can never be equal, so whenever the check executes it posts `NEW_VERSION_AVAILABLE`, and the listener (app.js:4062) shows the "Version 38.0 is ready." banner even when the page is current.

**Fix:** Make the two sides comparable — e.g. compare against `data.version + "-" + data.build` from version.json, or strip the build suffix from SW_VERSION before comparing. One-line change on either side.

**When:** Any future frontend drop. Flagged by Transom during Step 6 pre-build verification.
