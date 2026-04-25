# FamilyBank v37.2 Patch 2 — Scope (DRAFT)

**Status:** Draft, 2026-04-25 — for advisor review before builder handoff
**Authored by:** Advisor role (Claude) + Mike, post-v37.1 deploy review session
**Supersedes:** wizard-related portions of `FamilyBank_v37_1_backlog__1_.md`

---

## Why this exists

v37.1 shipped Friday 2026-04-24 with C1, C2, H1, H2 audit fixes plus the four
in-scope bugs (#1, #6, #7/FEAT-9, #9). Production is stable. Saturday morning
real-usage walkthrough surfaced wizard-flow problems: some matched bugs already
on the v37.1 backlog (#10, #11, #13, #14, #15, #16, #4), some are new.

Rather than ship the original Patch 2 list as-is and discover the new items
needed a Patch 2.5, this scope consolidates the wizard-flow work into one
coherent release.

Non-wizard items defer to Patch 3.

---

## Bump type

**MINOR** (v37.1 → v37.2). Frontend-only changes if all bugs stay scoped as
listed below. If during build it becomes clear a Code.gs change is required
for any item, advisor must approve a MAJOR bump (v37.2 → v38.0) before the
builder commits it.

Code.gs surfaces that already exist and don't need touching for this patch:
`saveFamilyState`, `handleLookupFamily_`, `_auditLogAppend`, `setupBank`,
`migrateToRowPerFamily`. The patch should not regress any of those.

---

## In-scope bugs and features

Listed in order of build sequence recommendation.

### Group A — Wizard architecture redesign

These three items are interlocked. They should be designed and built together
because they share the wizard's data flow.

#### A1 — Wizard progress persists in local cache, not server state

**SCOPE SPLIT (added 2026-04-25 during build, advisor-approved).** A1 applies
to two distinct wizards in the codebase, and they have very different shapes.
Doing a literal "true buffer-and-commit, zero mid-wizard Sheet writes" refactor
on both at once carries unacceptable audit risk for v37.2. The split:

- **Family-setup wizard** (`familyWizardState`, 4 steps, `fwCommit` Finish):
  **Full A1 treatment.** Already buffer-and-commit today; the wizard holds
  edits in `familyWizardState` and only writes to live `state` + Sheet inside
  `fwCommit`. Cache layer wraps that cleanly: hydrate buffer from cache on
  open, save buffer to cache on every step transition + add/remove, clear
  cache after `syncToCloud` succeeds in `fwCommit`. Zero mid-wizard Sheet
  writes. This is the first-impression wizard for new families (Instructables
  onboarding) where architectural cleanliness matters most.

- **Per-child wizard** (`wizardState`, 9 steps, `wizardFinish`):
  **Progress-cache-for-resume only — mid-step Sheet writes preserved.**
  `wizardSaveCurrentStep` today mutates live `state.users`, `state.pins`,
  `state.roles`, `state.config.tabs`, `state.config.notify`,
  `state.config.calendars`, `state.usersData`, `state.children` directly on
  each Next, and calls `syncToCloud` from cases 1/2/3/4/5/6/8 (7 mid-wizard
  Sheet writes today). Plus there's a "Progressive save: create child on
  first time through Step 1" pattern that's load-bearing for the Step 7
  chore-add flow — chores added during the wizard rely on the live child
  record existing in `state.children` so they can be persisted on every
  Add. Refactoring all of this to true buffer-and-commit is ~150-200 lines
  with significant ripple risk to the chore-add path. For v37.2, the
  per-child wizard gets the cache layer for **resume-from-step + form
  state recovery on refresh** only. The user-facing pain (refresh-loses-
  my-place) is solved; the architectural property "zero Sheet writes
  during steps" only holds for family-setup. Full A1 treatment for
  per-child wizard moves to **Patch 3 / v38**, where the Step 7 chore-add
  refactor gets dedicated audit attention. Shipping the per-child refactor
  in v37.2 without that audit would repeat the v37.1 "shipped without
  audit" lesson.

- **A2 (resume-from-step) applies to BOTH wizards** unchanged.

The user-visible behavior is identical on the refresh-recovery dimension:
both wizards survive a page refresh and resume at the furthest step the
user reached. The difference is internal: family-setup commits once at
Finish; per-child commits per step (as today) plus once at Finish.

---

**Problem.** Currently every wizard step writes the partial state to the Sheet
via `_doSyncToCloud`. This is wasteful, slow, and means the user sees stale UI
flicker between steps. It also creates a bad refresh experience: the page's
service-worker auto-update fires ~10 seconds after re-entry, and on refresh the
user is bounced back to step 1 of the wizard with all entries lost.

**Fix.** During wizard execution:
- All wizard inputs go to `localStorage` (or `sessionStorage` if cross-session
  resumption is undesired — advisor leans `localStorage` so the user can close
  the app, come back later, and resume).
- Zero Sheet writes during wizard steps.
- On wizard Finish, single Sheet write commits everything from cache to col B.
- After successful commit, clear the cache.
- If the user abandons the wizard and returns later, the cache holds their
  progress and the wizard resumes from the first unanswered step.

**Storage key.** Suggested: `familybank_wizard_progress_{familyId}_{wizardKind}`.
Where `wizardKind` is `family-setup` or `per-child-setup-{childName}`.
Different wizards keep separate caches. Switching families clears
the wrong-family cache (or the storage key naturally segregates them).

**Edge cases.**
- User completes wizard on device A, never opens device B. Device B's cache is
  empty. No conflict. Sheet is source of truth on next loadFromCloud.
- User completes wizard partially on device A, opens on device B. Device B
  starts fresh wizard. Device A's cache is orphaned (cleaned up next time
  device A opens the wizard and it sees the family is already set up).
- Browser quota / private browsing where localStorage is disabled. Fall back
  to in-memory state with a console warn. Wizard still works for the session.

#### A2 — Resume-from-step behavior

When a wizard with cached progress is reopened:
- Wizard advances directly to the first unanswered step.
- Back button from any later step still walks back to step 1 normally.
- Each previously-answered step renders with the cached values pre-filled.
- A subtle UI affordance ("Resuming setup — tap Back to review earlier steps")
  on first render is appropriate but not required.

#### A3 — Calendar integration deferred to a separate post-wizard flow

**Problem.** Currently the family-setup wizard asks for a Google Calendar ID
mid-flow. Most users don't have one ready. They leave the app to create one,
the wizard refreshes 10 seconds later, all progress is lost.

**Fix — multi-stage flow:**

1. **In the wizard,** ask only "Do you want calendar integration?" yes/no.
   No calendar ID field. Just the flag.
2. **At wizard Finish,** state is saved to the Sheet including the calendar
   flag (true/false). Wizard ends normally.
3. **If flag was true,** immediately after the wizard's success screen, a
   second bottom sheet opens: "Now let's set up your calendar."
   - Help text or link to a guide explaining how to get a Google Calendar ID
   - Paste field for the ID
   - Save button (writes to `state.config.calendars[childName]` or wherever
     the existing schema expects it) and Skip button
4. **If user skips,** flag persists, and on every parent login a non-blocking
   banner appears at the top of the home screen: "Calendar not yet configured
   — set it up?" with three options:
   - "Set up now" — opens the calendar sheet
   - "Not right now" — defers reminder for 7 days
   - "Don't remind me again" — flips reminder dismissal flag, but leaves a
     small "Calendar not configured" badge in Parent Settings as a permanent
     findable affordance
5. **After 30 days** of consecutive "Not right now" defers (4-5 reminders), auto-flip
   to the dismissed-with-badge state. Don't nag indefinitely.

**Storage for reminder state.**
- `state.config.calendarReminder.dismissed` (boolean, persisted in Sheet)
- `state.config.calendarReminder.deferUntil` (ISO datetime, persisted)
- `state.config.calendarReminder.deferCount` (integer, persisted)

**UI placement constraint.** Reminder UI must not block primary navigation.
The current "Update now" banner already partially obscures bottom Back/Next
buttons in some sheets — calendar reminder should not stack on top of that.
Discuss with builder during scope lock.

---

### Group B — Wizard data persistence bugs

Bugs where wizard inputs are dropped during commit. All confirmed in
production B3 inspection 2026-04-25.

#### B1 — Loans tab selection not persisting

**Symptom.** User selects "Loans" in the wizard's tab-options step. After
wizard Finish, the loans tab does not appear in the child's interface.

**Confirmed in production B3:** `tabs.Child1.loans: false` despite user
selecting it.

**Root cause to investigate.** Wizard commit is dropping the loans tab flag.
Either the cache-to-Sheet write logic ignores it, or the UI tab renderer is
checking the wrong flag name. Builder should grep for `tabs` and `loans` in
both wizard commit and tab render paths.

#### B2 — Calendar ID not persisting (deprecated by A3)

**Symptom.** Calendar ID entered in wizard step → not saved. `state.config.calendars`
is empty after wizard Finish.

**Resolution.** Mostly subsumed by A3 — the calendar ID is no longer collected
in the wizard. The calendar bottom sheet (post-wizard) writes the ID directly
when user pastes it. If A3 is implemented correctly, B2 cannot recur because
the legacy mid-wizard calendar field is removed entirely.

If for any reason A3 ships with the calendar field still in the wizard,
B2 must be fixed independently — the wizard commit must write to
`state.config.calendars[childName]` before clearing cache.

---

### Group C — Wizard UX cleanup

Smaller items. Most are pure frontend.

#### C1 — Default colors in wizard should not be black

Currently primary and secondary color default to `#000000`. Should default to
the app's existing primary blue (`#2563eb`) and a complementary secondary
(`#10b981` or similar). Any pleasant non-black starter pair. Trivial.
(Was BUG #13 in original backlog.)

#### C2 — Pills should not default to a value, and Next should be disabled until answered

Currently the "Do you want chores?" question pre-selects "No". User can
advance through wizard without consciously answering. All wizard pill questions:
- Should render with no selection
- Next button disabled until the user picks one

Affects: chores yes/no, calendar yes/no, celebration sound yes/no, any other
binary or n-ary pill choices.

#### C3 — Checking/savings/both restructured

Currently three pills: "Checking", "Savings", "Both". Redesign:
- Two checkboxes: "Checking" and "Savings"
- Helper text: "Select one or both"
- At least one must be selected to advance

Cleaner mental model — "Both" as a third option doesn't compose with future
account types.

#### C4 — Avatar picker uses emoji picker, not text field

Currently the wizard's avatar field is a plain text input. The main app already
has an emoji picker sheet — the wizard should reuse it. (Was BUG #15.)

#### C5 — Remove avatar field entirely from family setup wizard

Avatar selection happens in the per-child setup wizard (which fires on first
open of each child). Putting it also in the family-setup wizard is redundant
and creates user confusion about where to set it. Remove from family-setup;
keep in per-child setup.

#### C6 — Child name validation: no spaces, trim whitespace, reject case-insensitive duplicates

Currently "Child 2" with a space is accepted. Should match username rules.
(Was BUG #16.)

#### C7 — Streak settings need a "streak length" field

Currently the streak step asks for a milestone reward dollar amount but never
asks how long the streak has to be (number of consecutive completions). Without
that, the streak is undefined. Add a numeric field for streak length, validated
as an integer in the range **2 to 100** inclusive (1 isn't a streak; 100 is a
generous upper cap that covers any realistic family use case).

#### C8 — End-of-wizard "add another child" prompt should know about pre-listed children

Currently after Child1 setup, the wizard offers "Add another child?" Generic.
If the family-setup wizard listed Child2 as a planned child, the per-child
wizard should specifically prompt "Set up Child2 next?" with that as the
primary action. Generic "Add another child" remains as a secondary option.

#### C9 — Per-child setup wizard fires on first open of each child (BUG #10)

**Confirmed broken in v37.0/v37.1.** New families have `state.config.childSetupComplete: {}`
after family wizard. When parent opens Child1 for the first time, per-child
wizard should fire. It doesn't.

**Fix.** Audit the "open child" code path. Add check:
`if (!state.config.childSetupComplete[childName]) launchPerChildWizard(childName);`

Builder should verify the wizard runs all the way through and stamps
`childSetupComplete[childName] = true` on Finish.

#### C10 — Family wizard inserts parent entries into state.children (BUG #11)

**Confirmed broken in v37.0/v37.1 and v37.1.** Post-wizard B2 inspection shows
parents (e.g. Parent1) appearing as keys in `state.children` with full child-record
structure (balances, rates, autoDeposit, chores).

**Fix.** Wizard commit logic should not touch `state.children` for parent
entries. Only child names go in there.

#### C11 — Approved primary parent gets no welcome email (BUG #4)

**Confirmed broken in v37.0/v37.1.** `_sendWelcomeEmail` intercept fires for
co-parents and children but not for primary. Primary has no signal their
account exists.

**Fix.** Fire `_sendWelcomeEmail` for primary in `approvePendingRequest`
Step 1. Intercept already exists server-side.

#### C12 — Wizard primary email not pre-populated (BUG #14)

Email captured at request-account submission, stored in
`state.config.emails[primaryName]`. Wizard step 2 should pre-fill from there
instead of presenting a blank field.

Also: primary email should be required, not optional. Currently "no email"
is allowed for primary, which breaks digest and approval features downstream.

#### C13 — Replace top user-context row with Google-Family-style pattern

**Problem.** Current top row truncates "Managing Linnea" to "Manag..." and
gives no indication of which parent is logged in. Both pieces of context are
critical and currently invisible or partially visible.

**Reference:** Google Family Link app's top header pattern.

**Fix.** Three-element header row:

- **Top-left:** Child avatar (emoji or photo) + full child name as a tappable
  pill. Tap = switch child picker. No truncation — child name renders in full.
- **Top-center:** Reserved space (empty in Patch 2). Bell icon and notification
  surface deferred to Patch 3 — the slot is reserved in the layout so adding
  the bell later doesn't require a re-layout, but no icon renders in v37.2.
- **Top-right:** Parent first initial in a colored circle. Background color
  uses `state.config.colorPrimary` so it inherits the family's branding.
  Tap opens a small menu with two options:
  - "Parent Settings" → opens existing Parent Settings sheet
  - "Log out" → existing logout flow

**Replaces:**
- The current "Managing Linnea" + "Switch Child ▼" + info icon + "Log Out"
  button row.

**Why both child + parent context matter.** The child pill answers "what am I
managing." The parent circle answers "who am I logged in as." Today neither is
clearly visible. After this change both are unambiguous at a glance.

**Notification slot rationale.** Even though the bell isn't wired in Patch 2,
reserving the center space prevents a future re-layout when notifications are
added in Patch 3. Existing visual cues (chore badges, admin pending counts) stay
in place until the bell takes them over.

---

### Group D — Approval / signup flow polish

#### D1 — "Approve Request" button needs click feedback

When admin clicks Approve on a pending request, there is an awkward pause
with no visual feedback. The button does not depress, no spinner, no toast.
Tempts users to click multiple times.

**Fix.** On click:
- Disable the button immediately
- Show inline spinner or "Processing..." label
- Re-enable on success/failure with appropriate state

This pattern should be applied to ALL multi-second admin actions
(approve, deny, transfer primary, delete family) — but for Patch 2 scope,
just Approve. The others are existing patterns the builder shouldn't touch.

#### D2 — "Add Parent" / "Add Child" should open a bottom sheet form

In the family-setup wizard, the parent/child entry currently uses inline
fields that are awkward on mobile. Replace with:
- Primary parent's info collected as before (it's the requesting user)
- "Add Co-parent" button → opens bottom sheet → user enters name and optional
  email → save closes sheet, returns to wizard with the parent listed
- Same pattern for "Add Child" → bottom sheet → name, optional emoji avatar,
  optional PIN → save returns to wizard with child listed

This redesign requires careful state management because the bottom sheet
inputs are temporary (cached in wizard state) until wizard Finish. Builder
should treat the bottom sheets as input forms that resolve back to wizard
state, not as separate persistent state.

**Also add:** "Add Parent" button in **Parent Settings** (outside the wizard
flow) for adding co-parents to an existing family post-setup. Same bottom
sheet component as the wizard version. The settings-context version writes
directly to `state.config` and triggers a sync, since there's no wizard
cache to defer through. This complements existing Add Child functionality
in Parent Settings.

---

## Out of scope (deferred to Patch 3)

- Update banner persistence bug (banner reappears after update applied)
- Update banner blocks bottom navigation buttons in some sheets
- Refresh ~10 seconds after re-entry (service-worker behavior)
- Share Child step in wizard — likely redundant since families share children
  by design (advisor confirmed). Builder should NOT remove it without explicit
  go-ahead — Mike to verify Share Child does nothing useful and request removal
  in a future patch
- BUG #3 server-side child email gating
- BUG #5 request-account submission acknowledgment email
- BUG #12 Parent Settings doesn't refresh after destructive action
- MINOR: username case-sensitivity (already partially addressed in v37.1 H1)
- BUG #2 cleanup: remove processSignupDiff entirely
- All FEAT-N items from original v37.0 backlog
- Number-pad sweep (NTH-6)
- Donations / About / YouTube screen (NTH-1)
- All other NTH-* items

---

## Design language — Google Family Link as reference

Patch 2 codifies an intentional choice: where FamilyBank's UX patterns map
cleanly to Google Family Link conventions, **mimic Google Family Link
deliberately**. Specifically:

- Top-header three-element layout (managed entity left, notification center,
  user avatar right) — see C13.
- Banner-on-top for non-blocking reminders that the user can dismiss or defer.
- Bottom sheets for input forms instead of inline modals.

**Why deliberate mimicry.**
1. Users who've configured a kid's Google account already understand the
   pattern. Cognitive load near zero.
2. Inherits Google's UX research investment for free.
3. Reads as a serious family tool rather than a personal project.

**Where NOT to mimic.** Borrow chrome, not flows. FamilyBank's parent-and-child
role model differs from Google Family Link's admin-and-restricted model. The
permission/restriction framing of GFL does not apply to FamilyBank's
pedagogical/banking framing. Builder should not import GFL flows that don't
match FamilyBank's data model.

This guidance applies to Patch 2 and forward. Future patches should default
to GFL-style patterns where reasonable and only diverge with stated rationale.

---



Each group has its own gate. Builder should not declare Patch 2 ready until
all gates pass in DEV.

### Gate A — Wizard architecture
- [ ] Run family-setup wizard from start to finish. Confirm zero POSTs to
      `/exec` during steps 1-N. Confirm exactly one POST at Finish.
- [ ] Open wizard, fill out 3 steps, close browser tab. Reopen DEV. Wizard
      resumes at step 4 with steps 1-3 pre-filled.
- [ ] Open wizard, fill out 3 steps, hard-refresh page. Wizard resumes at
      step 4 with steps 1-3 pre-filled.
- [ ] Complete wizard. Open localStorage in DevTools. The wizard cache key
      is gone (cleared on success).
- [ ] Run family-setup wizard with `localStorage` disabled. Wizard still
      works for the session, console shows warn about fallback.

### Gate B — Calendar deferral
- [ ] Run wizard with "yes I want calendar" selected. Finish wizard.
      Calendar bottom sheet opens immediately.
- [ ] Skip calendar setup. Log out. Log back in. Reminder banner appears.
- [ ] Tap "Not right now". Reminder dismissed. Reload. Reminder does not
      reappear (still within 7-day defer).
- [ ] (Cannot easily test 7-day expiration in DEV without clock manipulation.
      Document deferUntil math in code review.)
- [ ] Tap "Don't remind me again" on a fresh reminder. Reminder persists as
      a badge in Parent Settings, no banner.

### Gate C — Persistence bug fixes
- [ ] Loans tab selected in wizard → tabs.{childName}.loans = true in
      Sheet B-column after Finish.
- [ ] Loans tab actually appears in child interface.

### Gate D — UX cleanup
- [ ] Wizard pills render with no default selection. Next disabled until
      answered.
- [ ] Default wizard colors are NOT `#000000`.
- [ ] Avatar field uses emoji picker, not text input.
- [ ] Avatar field absent from family-setup wizard, present only in
      per-child setup.
- [ ] Child name with space rejected. Whitespace trimmed. Case-insensitive
      duplicate rejected.
- [ ] Streak settings has a "streak length" numeric field. Validation works.
- [ ] After Child1 setup, end-of-wizard prompts specifically for Child2 if
      Child2 was listed in family-setup.
- [ ] Per-child wizard fires on first open of each child.
- [ ] State.children does NOT contain parent entries after family wizard.
- [ ] Primary parent receives welcome email after approval.
- [ ] Wizard pre-fills primary email from request-account submission.
- [ ] Top header shows child avatar + full child name on left.
- [ ] Top header shows parent initial in `colorPrimary` circle on right.
- [ ] Tapping parent circle opens menu with Parent Settings + Log Out.
- [ ] Center header space reserved (empty) — no bell icon in Patch 2.
- [ ] Current "Managing X / Switch Child / Log Out" row no longer present.
- [ ] Existing notification cues (chore badges, admin pending counts) still
      render in their current locations.

### Gate E — Approval flow
- [ ] Approve Request button visibly disables and shows spinner during
      processing.
- [ ] Add Co-parent and Add Child use bottom sheet forms, not inline fields.

### Gate F — Regression checks
- [ ] v37.1 audit findings still pass (C1, C2, H1, H2 still fixed).
- [ ] Login routing works for multi-family.
- [ ] Destructive actions (transfer primary, self-delete) still work
      correctly with success and failure paths.
- [ ] BUG #1 setupBank legacy detection still works.

---

## Build sequence recommendation

This is a guideline for the builder, not a contract. Builder may reorder if
they identify dependencies the advisor missed.

1. **A1 + A2** first. The wizard cache layer is the foundation everything
   else builds on. Get this stable before touching individual wizard steps.
2. **C1 through C12** in any order. These are individual bug fixes that don't
   depend on each other much.
3. **A3** calendar deferral. Best done after A1/A2 because the wizard cache
   needs to handle the "calendar yes/no" flag cleanly.
4. **D1 + D2** approval flow polish. Independent of A/C work.
5. **B1** loans tab investigation. May be a quick fix or may surface deeper
   issue. Time-box at 1 hour; if it doesn't yield, descope to Patch 3.

---

## Files this patch will touch

Frontend:
- `app.js` — wizard logic, localStorage handling, calendar deferral, all UX
  changes, button feedback, bottom sheets
- `index.html` — possible new bottom sheet markup for calendar setup, add
  parent, add child
- `styles.css` — minor styling for new sheets, button feedback states,
  reminder badge

Backend (if needed — flag advisor before any Code.gs change):
- `Code.gs` — only if any of the above turns out to require server-side
  changes. Current expectation: zero Code.gs touches.

Version files:
- `version.json` → 37.2

---

## Decisions locked

All open scope questions resolved with Mike during scope review session
2026-04-25:

- **Calendar reminder placement** → banner on login (not modal). Non-blocking,
  fits the defer-able nature of the reminder.
- **Streak length validation** → integer 2 to 100 inclusive.
- **Resume affordance text** → "Resuming setup — tap Back to review earlier
  steps." Builder may refine wording in context if a stronger phrasing emerges.
- **Bell icon in v37.2** → DEFERRED. Header reserves the center space but no
  icon renders. Notification sheet builds in Patch 3. Existing visual cues
  (chore badges, admin pending counts) remain in place until then.
- **Bottom sheets for Add Parent / Add Child** → existing components reusable.
  Add Parent in Parent Settings (post-setup) added to D2.
- **Top header redesign** → Google Family Link three-element pattern (C13).
- **Design language** → deliberate GFL mimicry where patterns map cleanly.
  Borrow chrome, not flows.

This scope is FINAL pending advisor sign-off and ready for builder handoff.

---

## Estimated effort

If the wizard cache layer (A1) goes cleanly, this is 4-6 hours of solid
build work. If A1 surfaces unexpected complexity (state management, race
conditions on wizard close + reopen), it's 8-10 hours.

Builder should checkpoint with advisor at the end of A1+A2 implementation
before continuing to the rest. That's the natural fork — if the architecture
is right, everything else is mechanical; if the architecture has issues,
the rest of the patch is at risk.

---

## Authorization

This scope requires advisor sign-off before builder handoff. Mike to review,
flag any items to remove or add, before Patch 2 builder chat is opened.

---

**END of v37.2 Patch 2 scope DRAFT.**
