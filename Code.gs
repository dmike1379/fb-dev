/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║              FAMILY BANK — Code.gs (Google Apps Script)          ║
 * ║    v44.0 — auto-approve · chore history · calendar deletes (C)   ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * WHAT'S NEW IN v44.0:
 *   - Stage C: every event of a recurring chore deleted in Google Calendar
 *     (seen on two ticks ≥ 25 min apart, no unreadable events, not every
 *     chore of the child at once) hides the chore (calendarDeleted): not
 *     due, never missed, one notice; the parent puts it back or deletes it.
 *   - "Chore Approved (Auto)": an auto-approve chore pays when the child
 *     marks it done; that day leaves the calendar; the child gets the email.
 *   - Rebuilds drop the build marker before deleting events (a cut-off
 *     rebuild is a first look next tick). Approval emails sum Chk + Sav.
 *   - The Sunday chore email skips hidden and paused chores.
 *
 * WHAT'S NEW IN v43.0:
 *   - Every save keeps the EmailIndex tab in step with the family's emails,
 *     so a child (or any user) whose email a parent adds in the app can log
 *     in with it on a new phone right away. A new email that another family
 *     already uses refuses the save (reason "emailTaken"; the app says so).
 *     An email shared inside a family logs in whoever's PIN matches.
 *   - (frontend) Parents set the bank's name, tagline and colors in Parent
 *     Settings → Our Bank. No server change for that.
 *   - From v43 a Code.gs fix without a new feature bumps CODE_VERSION to
 *     "v43.0-2", "-3", … so ?action=version tells the builds apart.
 *
 * WHAT'S NEW IN v42.0 (Stage B):
 *   - Every 15 minutes the server compares each child's calendar (next 28
 *     days) with the app. One day deleted → skipped in the app; one day moved
 *     or copied → that day moves in the app; one day's time changed → that
 *     day's due time changes. A change made to EVERY day (the whole series)
 *     is put back — the schedule lives in the app — and the parent sees a
 *     note. Deleting every event of a chore does nothing yet (Stage C).
 *   - Biweekly weeks are counted in days from the day the chore was made
 *     (they no longer flip with the time of day), and calendar series start
 *     on the first day the app says is due.
 *
 * WHAT'S NEW IN v41.0:
 *   - No BANK_TIMEZONE line any more. A family's time zone is its app Admin →
 *     Time zone setting (now a real zone name, e.g. Central = America/Chicago;
 *     older "GMT-6"-style settings still read right). The clock triggers and a
 *     family with no setting use this project's time zone (Project Settings).
 *     Nothing to hand-edit at install or on a paste.
 *
 * WHAT'S NEW IN v40.0 (Stage A — missed chores; Stage B/C add the calendar diff):
 *   - The chore's hour is a DUE time. A new 15-minute trigger, calendarSyncTick,
 *     records a chore as missed once its hour has passed undone (chore.missedDates),
 *     retitles that day's calendar event "⏰ Missed: …" and, when the parent turned
 *     it on for the child (Profile → "Email parents when a chore is missed"),
 *     emails the parents. Two same-named chores are told apart by schedule.
 *   - A submission is a done day: that day's calendar occurrence comes off right
 *     away (back if denied). The child can mark a missed day done within 7 days;
 *     the parent approves "with reward" or "no reward" — the streak counts on
 *     either way (third link in the email: Approve, no reward).
 *   - installTriggers(): run once per project to install all 5 triggers.
 *   - Chores made before v40 have no due time of their own: they count as
 *     missed after 8 PM until the parent edits them and picks one (the
 *     calendar event keeps its old time until then).
 *   - Server-side due rules (_choreDueOn / _choreDueHour) mirror the app's.
 *
 * HOW TO DEPLOY — DEV ("FamilyBank DEV" Apps Script project) FIRST.
 * PROD gets this file only in a separate, explicit PROD cutover after DEV
 * is verified.
 *
 *   v44: no sheet change, no new trigger. ORDER: this file before the v44
 *   frontend (the v44 app sends "Chore Approved (Auto)").
 *   v43: no sheet change, no new trigger. ORDER: this file before the v43
 *   frontend. Once, after STEP 3: Admin → "Rebuild email index" so emails
 *   saved before v43 (children added in the app) can log in too.
 *
 *   No sheet changes. No bootstrap. Triggers keep their function names —
 *   leave them. From v39: STEP 4 adds the one v40 trigger (calendarSyncTick,
 *   every 15 min); from v40 it is already there. The /exec URL does not change.
 *   ORDER: deploy this file BEFORE the v42 frontend goes live (the frontend
 *   shows the notes this file writes). It works with the v41 frontend.
 *   No new trigger: calendarSyncTick (from v40) does the calendar check.
 *   After STEP 3 the ticks rebuild each child's chore events once (3 chores
 *   per family per tick), silently; edits are picked up from then on.
 *   Long breaks: for a break of more than a few weeks, PAUSE the chore in the
 *   app. Deleting most of the next two months of events in Google Calendar
 *   looks like deleting the series, so the calendar is put back.
 *
 *   STEP 0 — Time zone (v41: no longer in this file). Project Settings (gear)
 *            → Time zone = where the families live: the clock triggers and
 *            the calendar event times run in it. Each family's app Admin →
 *            Time zone sets its "today" and due-hour clock — keep it the
 *            SAME as the project's (Central for DEV, PROD and Our Family
 *            Bank). Nothing to edit in the code.
 *   STEP 1 — Keep your settings. Compare the ★ CONFIGURATION ★ block of
 *            the code in the editor now with this file (APPROVAL_SECRET,
 *            APP_URL, FALLBACK_*_EMAIL, DEFAULT_*). Where the editor's value
 *            differs, copy it into this file first. (An old BANK_TIMEZONE
 *            line in the editor is simply dropped.)
 *   STEP 2 — Select all in the editor, paste this entire file, Save (Ctrl+S).
 *   STEP 3 — Deploy → Manage deployments → pencil icon →
 *            Version: New version → Deploy.
 *            (Not "New deployment" — that makes a new /exec URL.)
 *   STEP 4 — In the editor pick the function installTriggers → Run. Allow
 *            the permissions if asked. The log ends with
 *            "installed calendarSyncTick; already there: <the 4 others>"
 *            (from v40: "installed none; already there: <all 5>").
 *            Triggers (clock icon, left bar) now lists 5. Safe to re-run.
 *            A trigger keeps the zone it was made in: if the project zone
 *            changed since, delete the 4 clock triggers and run this again.
 *   STEP 5 — Check: open  <the /exec URL>?action=version
 *            v42 answers {"codeVersion":"v42.0"}. An older answer means
 *            the new version is not live yet — repeat STEP 3.
 *
 *   ROLLBACK — Manage deployments → pencil → Version: the previous number
 *            → Deploy. Same URL; the data stays. To v40: a zone saved by the
 *            v41 app ("America/Chicago") reads as that file's BANK_TIMEZONE —
 *            harmless when that line matches the family. If the frontend is
 *            rolled back too, its Admin list shows the zone blank: pick it
 *            again before saving. To v39: also DELETE the calendarSyncTick
 *            trigger (Triggers page → ⋮ → Delete).
 *
 * DO NOT RUN setupBank() against a v38 sheet. setupBank is the v36.1
 * single-family bootstrap; it writes to Sheet1 A1 (which v38 doesn't use)
 * and assumes the v36.1 5-column Ledger schema (v38 Ledger has 6 columns
 * with FamilyId in col B). setupBank stays in this file because Step 2.5
 * hasn't rewired the family runtime yet; it will be retired when Step 2.5
 * lands.
 *
 * CONVENTIONS (locked per D6 — see admin layer section near end of file):
 *   - Sheet access by name only: getSheetByName("Families"), etc.
 *     Never getSheets()[N].
 *   - Every admin write route uses
 *       try { lock.waitLock(5000); ...work... } finally { lock.releaseLock(); }
 *   - PIN columns (AdminConfig!A, PendingSignups!E) are plain-text formatted
 *     at provisioning. Triple-fix: regex on write + "@" format on column +
 *     String() coercion on read.
 *   - Audit rows append server-side via _appendAuditRow as the LAST write
 *     inside the lock scope on every admin write route.
 *
 * RECOVERY:
 *
 *   Bootstrap crashed mid-provision:
 *     - Tabs may be partially created; AdminConfig may or may not be written.
 *     - _isAdminConfigBootstrapped() is the canonical check.
 *         false → safe to re-run bootstrapAdmin (idempotent provisioning
 *                 fills remaining tabs).
 *         true  → bootstrap finished its writes; do not re-run.
 *
 *   Lost admin PIN (no in-app recovery path in v38):
 *     - Open the DEV Sheet manually.
 *     - Clear cell AdminConfig!A2 (delete content).
 *     - Re-run bootstrapAdmin("<newpin>") from the IDE.
 *
 * Original v36.1 CONFIG block is preserved below; many of those values
 * (DEFAULT_PARENT_NAME, DEFAULT_ADMIN_PIN, FALLBACK_*_EMAIL) bind only to
 * the legacy single-family path and become inert once Step 2.5 lands.
 */


// ╔═══════════════════════════════════════════════════════════════════╗
// ║                        ★ CONFIGURATION ★                         ║
// ║          Edit this block before deploying. Nothing else           ║
// ║          in this file needs to change for a basic setup.          ║
// ╚═══════════════════════════════════════════════════════════════════╝

// ------------------------------------------------------------------
// BANK IDENTITY
// ------------------------------------------------------------------
var BANK_NAME    = "Family Bank";          // ← Your bank name
var BANK_TAGLINE = "Your money, your future."; // ← Shown on login screen

// ------------------------------------------------------------------
// TIME ZONE — nothing to set here (v41). Each family's time zone is the
// app's Admin → Time zone setting. Things that are not per family (the
// clock triggers, a family that has no setting yet) use this project's
// own time zone: Project Settings (gear) → Time zone.
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// FALLBACK EMAILS
// These are used only if emails haven't been set in the Admin panel.
// For full per-user email control, set them in the app's Admin panel.
// ------------------------------------------------------------------
var FALLBACK_PARENT_EMAIL = "your.email@gmail.com"; // ← Parent email
var FALLBACK_CHILD_EMAIL  = "child@gmail.com";       // ← Child email

// ------------------------------------------------------------------
// DEFAULT USERS
// These are only used when the bank is set up for the very first time
// (i.e. when Sheet1 cell A1 is empty). After first run, users are
// managed through the app's Admin panel.
// ------------------------------------------------------------------
var DEFAULT_PARENT_NAME = "Dad";           // ← Parent display name
var DEFAULT_PARENT_PIN  = "0000";          // ← Parent PIN
var DEFAULT_CHILD_NAME  = "Linnea";        // ← Child display name
var DEFAULT_CHILD_PIN   = "1234";          // ← Child PIN

// ------------------------------------------------------------------
// DEFAULT STARTING BALANCES (first-time setup only)
// ------------------------------------------------------------------
var DEFAULT_CHECKING_BALANCE = 0;          // ← Starting checking balance
var DEFAULT_SAVINGS_BALANCE  = 0;          // ← Starting savings balance

// ------------------------------------------------------------------
// DEFAULT INTEREST RATES — Annual % (first-time setup only)
// Example: 6 means 6% APY, applied monthly as 6/12 = 0.5% per month
// ------------------------------------------------------------------
var DEFAULT_CHECKING_RATE = 0;             // ← Annual % for checking
var DEFAULT_SAVINGS_RATE  = 0;             // ← Annual % for savings

// ------------------------------------------------------------------
// DEFAULT WEEKLY ALLOWANCE (first-time setup only)
// ------------------------------------------------------------------
var DEFAULT_ALLOWANCE_CHECKING = 0;        // ← Weekly $ to checking
var DEFAULT_ALLOWANCE_SAVINGS  = 0;        // ← Weekly $ to savings

// ------------------------------------------------------------------
// ADMIN PIN (first-time setup only — change in app Admin panel after)
// ------------------------------------------------------------------
var DEFAULT_ADMIN_PIN = "9999";            // ← Admin panel PIN

// ------------------------------------------------------------------
// BRANDING COLORS (first-time setup only — change in app Admin panel)
// Use hex color codes. Primary = buttons/checking. Secondary = savings.
// ------------------------------------------------------------------
var DEFAULT_COLOR_PRIMARY   = "#2563eb";   // ← Blue (checking/buttons)
var DEFAULT_COLOR_SECONDARY = "#10b981";   // ← Green (savings/deposits)

// ------------------------------------------------------------------
// APP URL — link included in all emails so recipients can tap directly
// into the app. Change this to your GitHub Pages URL.
// ------------------------------------------------------------------
var APP_URL = "https://dmike1379.github.io/dfb.github.io/"; // ← Your app URL

// ------------------------------------------------------------------
// VERSION — update when deploying
// ------------------------------------------------------------------
var CODE_VERSION = "v44.0";   // ← increment on each Code.gs redeploy (?action=version shows it)

// ------------------------------------------------------------------
// EMAIL APPROVAL SECRET KEY
// A secret string used to generate secure one-time approval tokens.
// Change this to any random string you like. Keep it private.
// ------------------------------------------------------------------
var APPROVAL_SECRET = "FamilyBank2026SecretKey"; // ← Change to something unique

// ------------------------------------------------------------------
// DEBUGGING — set to true to see detailed logs in Apps Script
// ------------------------------------------------------------------
var DEBUG_LOGGING = false;

// ╔═══════════════════════════════════════════════════════════════════╗
// ║              END OF CONFIGURATION — DO NOT EDIT BELOW            ║
// ╚═══════════════════════════════════════════════════════════════════╝


// ================================================================
// [DOGET] — Frontend fetches state + history
// ================================================================
function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};

    // ── Email approve/deny action handler (chores) ──
    if (params.action === "approve" || params.action === "deny") {
      return handleEmailAction(params);
    }

    // ── Email approve/deny action handler (deposits) ──
    if (params.action === "depositApprove" || params.action === "depositDeny") {
      return handleDepositEmailAction(params);
    }

    // ── Email approve/deny action handler (withdrawals) — v35.0 Item 2 ──
    if (params.action === "withdrawApprove" || params.action === "withdrawDeny") {
      return handleWithdrawalEmailAction(params);
    }

    // ── v38 admin routes ──
    if (params.action === "adminLoad")         return _routeAdminLoad(params);
    if (params.action === "adminListFamilies") return _routeAdminListFamilies(params);
    if (params.action === "setAdminPin")       return _routeSetAdminPin(params);
    if (params.action === "setAdminEmail")     return _routeSetAdminEmail(params);
    if (params.action === "adminListPendingSignups") return _routeAdminListPendingSignups(params);
    if (params.action === "adminRevealSignupPin")    return _routeAdminRevealSignupPin(params);

    // ── v38 Step 3 routes (Strake) ──
    if (params.action === "signup")            return _routeSignup(params);
    if (params.action === "adminApprove")      return _routeAdminApprove(params);
    if (params.action === "adminDeny")         return _routeAdminDeny(params);
    if (params.action === "adminDeleteFamily") return _routeAdminDeleteFamily(params);
    if (params.action === "loginByEmail")      return _routeLoginByEmail(params);
    if (params.action === "rebuildEmailIndex") return _routeRebuildEmailIndex(params);
    if (params.action === "setChildEmail")     return _routeSetChildEmail(params);
    if (params.action === "checkCalendar")     return _routeCheckCalendar(params);   // v39-3
    if (params.action === "version")           return _routeVersion();               // v39-16

    // ── Normal state fetch (v38 row-per-family) ──
    var familyId = params.familyId || "";
    if (!familyId) return _familyNotFoundResponse();
    var state = loadState(familyId, {fresh: params.fresh === "1"});   // v39-10 — fresh=1 skips (and repairs) the 60 s cache
    if (state && state.status === "error") {
      return ContentService
        .createTextOutput(JSON.stringify(state))
        .setMimeType(ContentService.MimeType.JSON);
    }
    state.history = loadHistory(familyId);
    // Net worth history per child for chart
    state.netWorthHistory = {};
    getChildNames(state).forEach(function(c) {
      state.netWorthHistory[c] = calcNetWorthHistory(familyId, c);
    });
    if (DEBUG_LOGGING) Logger.log("doGet OK — users: " + JSON.stringify(state.users));
    return ContentService
      .createTextOutput(JSON.stringify(state))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    Logger.log("doGet ERROR: " + err);
    return ContentService
      .createTextOutput(JSON.stringify({error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * handleEmailAction — processes approve/deny links clicked in notification emails
 * URL format: ?action=approve&choreId=chore_123&child=Linnea&token=ABC123
 */
function handleEmailAction(params) {
  var action   = params.action;
  var choreId  = params.choreId;
  var child    = params.child;
  var token    = params.token;
  var familyId = params.familyId || "";

  // v38 — every email-callback must carry familyId. Action handler called
  // with no familyId returns the familyNotFound shape (per build doc §4 #8).
  if (!familyId) {
    return ContentService
      .createTextOutput(JSON.stringify({status: "error", reason: "familyNotFound"}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Validate token
  var expectedToken = generateToken(choreId, action);
  if (token !== expectedToken) {
    return buildActionPage("❌ Invalid or Expired Link",
      "This link is no longer valid. Please open the app to manage chores.",
      "#ef4444");
  }

  var _page = _withSaveLock(function() {   // v39-1 — fresh read + lock: a link click never overwrites a newer phone save
  try {
    var state = loadState(familyId, {fresh: true});
    if (state && state.status === "error") {
      return ContentService
        .createTextOutput(JSON.stringify(state))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var data = state.children && state.children[child];
    if (!data) return buildActionPage("❌ Error", "Child account not found.", "#ef4444");

    var chore = null;
    for (var i = 0; i < data.chores.length; i++) {
      if (data.chores[i].id === choreId) { chore = data.chores[i]; break; }
    }
    if (!chore) return buildActionPage("✅ Already Processed",
      "This chore has already been approved or denied.", "#10b981");
    if (chore.status !== "pending") return buildActionPage("✅ Already Processed",
      chore.name + " was already " + chore.status + ".", "#10b981");

    var bankName = getBankName(state);
    var primary  = getPrimary(state);
    var ledger   = getLedgerSheet();
    var tz       = getTimezone(state);
    var now      = Utilities.formatDate(new Date(), tz, "MMM d, yyyy h:mm a");

    if (action === "approve") {
      // v40-5 — "&reward=0" (the third link on a late chore's email): approve without pay; the chore is
      // still done for the day it was submitted for and the streak counts on.
      var withReward = String(params.reward || "") !== "0";
      var ck = withReward ? chore.amount * (chore.splitChk / 100) : 0;
      var sv = withReward ? chore.amount * ((100 - chore.splitChk) / 100) : 0;
      data.balances.checking += ck;
      data.balances.savings  += sv;
      if (ck > 0) ledger.appendRow([now, familyId, "Bank", child, "Chore: " + chore.name + " (Chk)", ck]);
      if (sv > 0) ledger.appendRow([now, familyId, "Bank", child, "Chore: " + chore.name + " (Sav)", sv]);
      if (!withReward) ledger.appendRow([now, familyId, "Bank", child, "Chore: " + chore.name + " (late, no reward)", 0]);

      if (chore.schedule === "once") {
        data.chores = data.chores.filter(function(c) { return c.id !== choreId; });
      } else {
        var forDay = chore.submittedFor || Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");   // v40-5 — the day it was done for
        chore.status        = "available";
        chore.completedBy   = null;
        chore.completedAt   = null;
        chore.denialNote    = null;
        chore.lastCompleted = (chore.lastCompleted && chore.lastCompleted > forDay) ? chore.lastCompleted : forDay;   // v40-10 (H3) — never backwards
        if (!_dateIn(chore.doneDates, forDay)) chore.doneDates = (chore.doneDates || []).concat([forDay]).slice(-60);   // v40-12 (N1) — the approval records the day even for a v39 submission
        if (Array.isArray(chore.missedDates)) chore.missedDates = chore.missedDates.filter(function(d) { return d !== forDay; });   // v40-10 (L7)
        chore.submittedFor = null; chore.lateFor = null;
        // Check streak milestone — auto-deposit bonus if milestone hit
        checkStreakMilestone(state, child, chore, ledger, now, familyId);
      }

      state.children[child] = data;
      saveState(familyId, state);

      // Send approval email to child
      sendEventEmail(familyId, state, "Chore Approved", child);
      // Sync calendar
      state._approvedChoreId       = choreId;
      state._approvedChoreTitle    = "🏦 " + chore.name + " — Earn $" + (chore.amount||0).toFixed(2);
      state._approvedChoreSchedule = chore.schedule;
      syncCalendarEvent(state, "Chore Approved", child);

      return buildActionPage("✅ Approved!",
        "<strong>" + chore.name + "</strong> approved for " + child + "!<br><br>" +
        (withReward ? "$" + chore.amount.toFixed(2) + " deposited to their account.<br>" + "Checking: +$" + ck.toFixed(2) + " &nbsp; Savings: +$" + sv.toFixed(2)
                    : "No reward this time — the chore counts as done and the streak continues."),
        "#10b981");

    } else { // deny
      // v39-4 — a denied chore goes back to the queue whatever its schedule (twin of the
      // in-app fix v38.2-1). A one-time chore whose date has passed becomes undated, i.e.
      // always due, so the child can redo it.
      chore.status        = "available";
      chore.completedBy   = null;
      chore.completedAt   = null;
      chore.denialNote    = "Denied via email";
      // v40-10 (H3) — only forget a completion that was this submission's day; an earlier day's stays
      if (!chore.lastCompleted || !chore.submittedFor || chore.lastCompleted === chore.submittedFor) chore.lastCompleted = null;
      if (chore.schedule === "once" && chore.onceDate) {
        var todayGs = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
        if (String(chore.onceDate) < todayGs) { chore.onceDate = null; chore.onceDueOn = false; }
      }
      var deniedFor = chore.submittedFor || null;   // v40-3 — not done after all: the day leaves doneDates, the occurrence comes back
      if (deniedFor && Array.isArray(chore.doneDates)) chore.doneDates = chore.doneDates.filter(function(d) { return d !== deniedFor; });
      chore.submittedFor = null; chore.lateFor = null;
      state.children[child] = data;
      saveState(familyId, state);
      sendEventEmail(familyId, state, "Chore Denied", child);
      syncCalendarEvent(state, "Chore Denied", child, {_deniedChoreId: choreId, _deniedFor: deniedFor});

      return buildActionPage("❌ Denied",
        "<strong>" + chore.name + "</strong> has been denied for " + child + ".<br><br>" +
        "The chore will reappear in their list.",
        "#f59e0b");
    }
  } catch(err) {
    Logger.log("handleEmailAction ERROR: " + err);
    return buildActionPage("❌ Error", "Something went wrong: " + err.toString(), "#ef4444");
  }
  });
  return _page || buildActionPage("⏳ Busy", "The bank is saving something else right now — please tap the link again in a moment.", "#f59e0b");
}


/**
 * handleDepositEmailAction — processes approve/deny links for child deposit requests
 * URL format: ?action=depositApprove&depositId=dep_123&child=Linnea&token=ABC123
 */
function handleDepositEmailAction(params) {
  var action    = params.action;
  var depositId = params.depositId;
  var child     = params.child;
  var token     = params.token;
  var familyId  = params.familyId || "";

  if (!familyId) {
    return ContentService
      .createTextOutput(JSON.stringify({status: "error", reason: "familyNotFound"}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var expectedToken = generateToken(depositId, action);
  if (token !== expectedToken) {
    return buildActionPage("❌ Invalid or Expired Link",
      "This link is no longer valid. Please open the app to manage deposits.",
      "#ef4444");
  }

  var _page = _withSaveLock(function() {   // v39-1 — fresh read + lock
  try {
    var state = loadState(familyId, {fresh: true});
    if (state && state.status === "error") {
      return ContentService
        .createTextOutput(JSON.stringify(state))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var data = state.children && state.children[child];
    if (!data) return buildActionPage("❌ Error", "Child account not found.", "#ef4444");

    // v38.0-step8 Bug-8 — read pendingDeposits; entries carry no status field.
    // Entry is removed on decision, so "not found" = already handled — withdrawal parity (see 3910).
    var pending = data.pendingDeposits || [];
    var deposit = null;
    for (var i = 0; i < pending.length; i++) {
      if (pending[i].id === depositId) { deposit = pending[i]; break; }
    }
    if (!deposit) return buildActionPage("✅ Already Processed",
      "This deposit has already been handled.", "#10b981");

    var ledger = getLedgerSheet();
    var tz     = getTimezone(state);
    var now    = Utilities.formatDate(new Date(), tz, "MMM d, yyyy h:mm a");

    if (action === "depositApprove") {
      var ck = deposit.amount * (deposit.splitChk / 100);
      var sv = deposit.amount * ((100 - deposit.splitChk) / 100);
      data.balances.checking += ck;
      data.balances.savings  += sv;
      if (ck > 0) ledger.appendRow([now, familyId, "Bank", child, "Deposit: " + (deposit.note || "") + " (Chk)", ck]);
      if (sv > 0) ledger.appendRow([now, familyId, "Bank", child, "Deposit: " + (deposit.note || "") + " (Sav)", sv]);
      data.pendingDeposits = pending.filter(function(p){ return p.id !== depositId; });
      state.children[child] = data;
      saveState(familyId, state);
      // Notify child
      var childEmail = getEmailFor(state, child);
      if (childEmail && notifyEmail(state, child)) {
        var html = buildSimpleEmailHtml(state,
          "💰 Deposit Approved, " + child + "!",
          "Your deposit of <strong>$" + deposit.amount.toFixed(2) + "</strong> was approved!",
          [
            {label: "Amount",           val: "+$" + deposit.amount.toFixed(2)},
            {label: "Note",             val: deposit.note || "—"},
            {label: "Checking",         val: "+$" + ck.toFixed(2)},
            {label: "Savings",          val: "+$" + sv.toFixed(2)},
            {label: "Checking Balance", val: "$" + data.balances.checking.toFixed(2)},
            {label: "Savings Balance",  val: "$" + data.balances.savings.toFixed(2)}
          ],
          "Great job saving that money! 💚"
        );
        sendSimpleEmail(childEmail, getBankName(state) + " — Your deposit was approved! 💰", html);
      }
      return buildActionPage("✅ Deposit Approved!",
        "<strong>$" + deposit.amount.toFixed(2) + "</strong> approved for " + child + "!<br><br>" +
        "Checking: +$" + ck.toFixed(2) + " &nbsp; Savings: +$" + sv.toFixed(2),
        "#10b981");

    } else { // depositDeny
      data.pendingDeposits = pending.filter(function(p){ return p.id !== depositId; });
      state.children[child] = data;
      saveState(familyId, state);
      var childEmail = getEmailFor(state, child);
      if (childEmail && notifyEmail(state, child)) {
        var html = buildSimpleEmailHtml(state,
          "Deposit Update for " + child,
          "Your deposit request of $" + deposit.amount.toFixed(2) + " was not approved this time. Talk to " + getParentName(state) + " if you have questions.",
          [], ""
        );
        sendSimpleEmail(childEmail, getBankName(state) + " — Deposit update", html);
      }
      return buildActionPage("❌ Deposit Denied",
        "The deposit request of <strong>$" + deposit.amount.toFixed(2) + "</strong> for " + child + " has been denied.",
        "#f59e0b");
    }
  } catch(err) {
    Logger.log("handleDepositEmailAction ERROR: " + err);
    return buildActionPage("❌ Error", "Something went wrong: " + err.toString(), "#ef4444");
  }
  });
  return _page || buildActionPage("⏳ Busy", "The bank is saving something else right now — please tap the link again in a moment.", "#f59e0b");
}

/** Generate a secure token for a chore action */
function generateToken(choreId, action) {
  var raw = choreId + "|" + action + "|" + APPROVAL_SECRET;
  return Utilities.base64Encode(raw).replace(/[^a-zA-Z0-9]/g, "").substring(0, 32);
}

/** Build a simple mobile-friendly response page */
function buildActionPage(title, message, color) {
  var html = "<!DOCTYPE html><html><head><meta charset='UTF-8'>"
    + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
    + "<title>" + title + "</title>"
    + "<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;"
    + "min-height:100vh;margin:0;background:#f1f5f9;padding:20px;box-sizing:border-box;}"
    + ".card{background:white;border-radius:20px;padding:32px 28px;max-width:400px;width:100%;"
    + "text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1);}"
    + ".icon{font-size:3rem;margin-bottom:16px;}"
    + "h1{margin:0 0 12px;font-size:1.4rem;color:#1e293b;}"
    + "p{margin:0 0 24px;color:#64748b;line-height:1.6;font-size:.95rem;}"
    + "a{display:inline-block;background:" + color + ";color:white;text-decoration:none;"
    + "padding:12px 24px;border-radius:10px;font-weight:700;font-size:.9rem;}"
    + "</style></head><body><div class='card'>"
    + "<div class='icon'>" + (title.indexOf("✅") === 0 ? "✅" : title.indexOf("❌") === 0 ? "❌" : "🏦") + "</div>"
    + "<h1>" + title.replace(/^[✅❌🏦]\s*/,"") + "</h1>"
    + "<p>" + message + "</p>"
    + "<a href='" + APP_URL + "'>Open Family Bank</a>"
    + "</div></body></html>";
  return HtmlService.createHtmlOutput(html)
    .setTitle(title.replace(/^[✅❌🏦]\s*/,""))
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ================================================================
// [DOPOST] — Frontend saves state + new transactions
// ================================================================
function doPost(e) {
  try {
    var body         = JSON.parse(e.postData.contents);
    var transactions = body.tempTransactions || [];
    var lastAction   = body.lastAction || "Update";
    var activeChild  = body.activeChild || null;
    var familyId     = body.familyId || "";

    if (DEBUG_LOGGING) Logger.log("doPost: " + lastAction + " | family: " + familyId + " | child: " + activeChild);

    // v38 — every doPost must carry familyId. Reject otherwise.
    if (!familyId) {
      return ContentService
        .createTextOutput(JSON.stringify({status: "error", reason: "familyNotFound"}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // v33.0 — Pull proof photo off body BEFORE saveState (per-cell ~50K char limit)
    // Keep a local reference so we can attach it inline to the chore-submitted email.
    var proofPhoto = body.proofPhoto || null;
    delete body.proofPhoto;

    // v39-2 — calendar hints ride the POST but never the saved state: lift them off first.
    var calHints = {
      _deletedChoreId:        body._deletedChoreId        || null,
      _approvedChoreId:       body._approvedChoreId       || null,
      _approvedChoreSchedule: body._approvedChoreSchedule || null,
      _approvedChoreName:     body._approvedChoreName ? String(body._approvedChoreName).slice(0, 100) : null,   // v44-6 (#5) — the email names a $0 one-time chore
      _editedChoreId:         body._editedChoreId         || null,
      _editedChoreIds:        Array.isArray(body._editedChoreIds) ? body._editedChoreIds.slice(0, 200) : null,   // v39-15 — Reschedule
      _submittedChoreId:      body._submittedChoreId      || null,   // v40-3 — a submission takes that day off the calendar
      _submittedFor:          body._submittedFor          || null,
      _deniedChoreId:         body._deniedChoreId         || null,   // v40-3 — a denial puts it back
      _deniedFor:             body._deniedFor             || null
    };

    // v39-1 — the revision the client based this save on (absent from older clients).
    var baseRev = (body._baseRev === undefined || body._baseRev === null || body._baseRev === "") ? null : (parseInt(body._baseRev, 10) || 0);
    delete body._baseRev;
    delete body._rev;   // never client-supplied

    // v38 — strip the familyId off the body before saving (it lives in col A,
    // not inside the state JSON in col B). Strip frontend-only keys.
    delete body.familyId;
    delete body.tempTransactions;
    delete body.lastAction;
    delete body.history;
    delete body.activeChild;
    // Strip any orphaned calendar helper keys — these must never persist in state
    delete body._deletedChoreName;
    delete body._deletedChoreTitle;
    delete body._deletedChoreId;
    delete body._approvedChoreName;
    delete body._approvedChoreTitle;
    delete body._approvedChoreId;
    delete body._approvedChoreSchedule;
    delete body._editedChoreName;
    delete body._editedChoreId;
    delete body._editedChoreIds;   // v39-15
    delete body._submittedChoreId; delete body._submittedFor; delete body._deniedChoreId; delete body._deniedFor;   // v40-3
    delete body._deletedCalEventIds;
    delete body._deletedCalEventId;
    delete body._approvedCalEventId;

    // v39-1 — compare-and-set under the script lock: read the row fresh, refuse a save based
    // on an older revision, otherwise save (saveState assigns the next _rev).
    var cas = _withSaveLock(function() {
      var current = loadState(familyId, {fresh: true});
      if (!current || current.status === "error") return {status: "error", reason: "familyNotFound"};
      var curRev = parseInt(current._rev, 10) || 0;
      if (baseRev !== null && curRev && baseRev !== curRev) {
        Logger.log("doPost: stale save refused (baseRev=" + baseRev + ", rev=" + curRev + ") " + lastAction);
        return {status: "error", reason: "stale", rev: curRev, savedAt: current._savedAt || null};
      }
      var emailPlan = _emailIndexPlan(familyId, current, body);   // v43-1 — login emails follow the save
      if (emailPlan && emailPlan.taken) {
        Logger.log("doPost: an email in this save is already used by another family — save refused (" + lastAction + ")");
        return {status: "error", reason: "emailTaken", email: emailPlan.taken};
      }
      body._rev = curRev;              // saveState bumps it
      try { if (activeChild && notifyCalendar(body, activeChild)) _calBusy(getCalendarId(body, activeChild), 300); } catch(e) {}   // v42-3 (M1) — before the save
      try {   // v42-4 (M5) — calendar turned on or pointed elsewhere: the next tick rebuilds that child's events
        getChildNames(body).forEach(function(kid) {   // v42-5 — every child, any save (profile, admin user wizard, …)
          if (!notifyCalendar(body, kid)) return;
          var nc = getCalendarId(body, kid);
          if (nc && (!notifyCalendar(current, kid) || getCalendarId(current, kid) !== nc)) {
            ((body.children && body.children[kid] && body.children[kid].chores) || []).forEach(function(c) { if (c && c.id) _clearCalBuilt(nc, c.id); });
            Logger.log("doPost: calendar on/changed for " + kid + " — the next tick rebuilds its events");
          }
        });
      } catch(e) {}
      saveState(familyId, body);
      var emailIndexFailed = false;
      if (emailPlan) { try { _emailIndexApply(familyId, emailPlan); } catch(e) { emailIndexFailed = true; Logger.log("doPost: EmailIndex update failed — " + e + " (Admin → Rebuild email index fixes it)"); } }   // v43-1
      return emailIndexFailed ? {status: "ok", rev: body._rev, emailIndexFailed: true} : {status: "ok", rev: body._rev};   // v43-4 (#3) — the app says so
    });
    if (cas === null) cas = {status: "error", reason: "busy"};
    if (cas.status !== "ok") {
      return ContentService
        .createTextOutput(JSON.stringify(cas))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Write transactions to Ledger (v38 6-column schema:
    //   [Date, FamilyId, User, Child, Note, Amount])
    var ledger = getLedgerSheet();
    var tz     = getTimezone(body);
    transactions.forEach(function(tx) {
      var ts = Utilities.formatDate(new Date(), tz, "MMM d, yyyy h:mm a");
      ledger.appendRow([
        ts,                          // v39-6 — always the server's timestamp; a client-supplied date is ignored
        familyId,
        tx.user  || "System",
        tx.child || activeChild || "",
        tx.note  || lastAction,
        tx.amt   || 0
      ]);
    });

    // Trigger any email notifications based on the action
    sendEventEmail(familyId, body, lastAction, activeChild, proofPhoto, calHints);   // v40-5 — hints: which chore was submitted

    // Sync Google Calendar events based on the action (v39-2: hints passed separately)
    syncCalendarEvent(body, lastAction, activeChild, calHints);

    return ContentService
      .createTextOutput(JSON.stringify(cas.emailIndexFailed ? {status: "ok", rev: cas.rev, emailIndexFailed: true} : {status: "ok", rev: cas.rev}))   // v39-1 — the client keeps this as its _baseRev (v43-4: + emailIndexFailed)
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    Logger.log("doPost ERROR: " + err);
    return ContentService
      .createTextOutput(JSON.stringify({error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ================================================================
// [HISTORY] — Load Ledger, return rows grouped by child name
// ================================================================
function loadHistory(familyId) {
  // v38 6-column Ledger schema: [Date, FamilyId, User, Child, Note, Amount].
  // Filter on col B (index 1). Returns history grouped by child for the given
  // family only — no cross-family leakage.
  if (!familyId) return {};
  var sheet = getLedgerSheet();
  var data  = sheet.getDataRange().getValues();
  var history = {};
  // Skip header row
  var start = (data.length > 0 && String(data[0][0]).toLowerCase().includes("date")) ? 1 : 0;
  for (var i = start; i < data.length; i++) {
    var row = data[i];
    if (!row[0] && !row[2] && !row[5]) continue; // skip blank rows (date/user/amount all empty)
    if (String(row[1]) !== familyId) continue;    // v38 — only this family
    var child = String(row[3] || DEFAULT_CHILD_NAME);
    if (!history[child]) history[child] = [];
    history[child].push({
      date:  String(row[0] || ""),
      user:  String(row[2] || ""),
      child: child,
      note:  String(row[4] || ""),
      amt:   parseFloat(row[5]) || 0
    });
  }
  return history;
}

// ================================================================
// [TRIGGERS] — Scheduled automation functions
// ================================================================

/**
 * TRIGGER: Every Monday 8 AM — weekly allowance per child
 */
function automatedMondayDeposit() {
  // v38 — iterate every family row and run the v36.1 per-family allowance
  // body inside _runAutomatedMondayDepositForFamily.
  _forEachFamily(function(familyId) {
    try {
      var ran = null;   // v39-9 — same lock as doPost; up to 3 tries of 20 s each
      for (var attempt = 0; attempt < 3 && !ran; attempt++) ran = _withSaveLock(function() { _runAutomatedMondayDepositForFamily(familyId); return true; });
      if (!ran) Logger.log("automatedMondayDeposit: lock busy for 60 s — SKIPPED " + familyId + " (nothing was changed for this family). Do NOT re-run the trigger — it would pay every other family again; add this week's allowance by hand in the app.");
    } catch(err) {
      Logger.log("automatedMondayDeposit ERROR for " + familyId + ": " + err);
    }
  });
}

function _runAutomatedMondayDepositForFamily(familyId) {
  var state = loadState(familyId, {fresh: true});   // v39-9 — never a cached copy under the lock
  if (state && state.status === "error") {
    Logger.log("automatedMondayDeposit: skipping " + familyId + " (familyNotFound)");
    return;
  }
  var ledger  = getLedgerSheet();
  var tz      = getTimezone(state);
  var now     = Utilities.formatDate(new Date(), tz, "MMM d, yyyy h:mm a");
  var changed = false;

  getChildNames(state).forEach(function(childName) {
    var data = state.children[childName];
    var chk  = parseFloat(data.autoDeposit && data.autoDeposit.checking) || 0;
    var sav  = parseFloat(data.autoDeposit && data.autoDeposit.savings)  || 0;
    if (chk === 0 && sav === 0) return;
    data.balances.checking += chk;
    data.balances.savings  += sav;
    if (chk > 0) ledger.appendRow([now, familyId, "Bank", childName, "Weekly Allowance (Chk)", chk]);
    if (sav > 0) ledger.appendRow([now, familyId, "Bank", childName, "Weekly Allowance (Sav)", sav]);
    // Email child: allowance deposited
    var childEmail = getEmailFor(state, childName);
    if (childEmail && notifyEmail(state, childName)) {
      var bankName = getBankName(state);
      var total    = chk + sav;
      sendSimpleEmail(childEmail,
        bankName + " — Your allowance of $" + total.toFixed(2) + " arrived! 💵",
        buildSimpleEmailHtml(state,
          "💵 Allowance Deposited!",
          "Hi " + childName + "! Your weekly allowance of <strong>$" + total.toFixed(2) + "</strong> has been added to your account.",
          [
            {label: "Checking", val: "+$" + chk.toFixed(2)},
            {label: "Savings",  val: "+$" + sav.toFixed(2)},
            {label: "New Checking Balance", val: "$" + data.balances.checking.toFixed(2)},
            {label: "New Savings Balance",  val: "$" + data.balances.savings.toFixed(2)}
          ],
          "Keep saving! 🌟"
        )
      );
    }
    changed = true;
    Logger.log("Allowance: [" + familyId + "] " + childName + " CHK+$" + chk + " SAV+$" + sav);
  });

  if (changed) saveState(familyId, state);
}

/**
 * TRIGGER: 1st of month 7 AM — interest + monthly statement per child
 */
function monthlyMaintenance() {
  _forEachFamily(function(familyId) {
    try {
      var ran = null;   // v39-9 — same lock as doPost; up to 3 tries of 20 s each
      for (var attempt = 0; attempt < 3 && !ran; attempt++) ran = _withSaveLock(function() { _runMonthlyMaintenanceForFamily(familyId); return true; });
      if (!ran) Logger.log("monthlyMaintenance: lock busy for 60 s — SKIPPED " + familyId + " (nothing was changed for this family). Do NOT re-run the trigger — it would pay every other family's interest again; add this month's interest by hand in the app.");
    } catch(err) {
      Logger.log("monthlyMaintenance ERROR for " + familyId + ": " + err);
    }
  });
}

function _runMonthlyMaintenanceForFamily(familyId) {
  var state = loadState(familyId, {fresh: true});   // v39-9 — never a cached copy under the lock
  if (state && state.status === "error") {
    Logger.log("monthlyMaintenance: skipping " + familyId + " (familyNotFound)");
    return;
  }
  var ledger = getLedgerSheet();
  var tz     = getTimezone(state);
  var now    = Utilities.formatDate(new Date(), tz, "MMM d, yyyy h:mm a");

  getChildNames(state).forEach(function(childName) {
    var data    = state.children[childName];
    var prevChk = parseFloat(data.balances.checking) || 0;
    var prevSav = parseFloat(data.balances.savings)  || 0;
    var rc      = parseFloat(data.rates && data.rates.checking) || 0;
    var rs      = parseFloat(data.rates && data.rates.savings)  || 0;
    var ic      = prevChk * (rc / 100 / 12);
    var is_     = prevSav * (rs / 100 / 12);

    data.balances.checking += ic;
    data.balances.savings  += is_;

    if (ic  > 0) ledger.appendRow([now, familyId, "Bank", childName, "Monthly Interest (Chk)", ic]);
    if (is_ > 0) ledger.appendRow([now, familyId, "Bank", childName, "Monthly Interest (Sav)", is_]);

    Logger.log("Interest: [" + familyId + "] " + childName + " CHK+$" + ic.toFixed(4) + " SAV+$" + is_.toFixed(4));

    // Send statement to all parents + the child
    sendMonthlyStatement(familyId, state, childName, data, prevChk, prevSav, ic, is_);
  });

  saveState(familyId, state);
}

/**
 * TRIGGER: Every day 6 AM — reset recurring chores by schedule
 */
function dailyChoreReset() {
  _forEachFamily(function(familyId) {
    try {
      var ran = null;   // v39-9 — same lock as doPost; up to 3 tries of 20 s each
      for (var attempt = 0; attempt < 3 && !ran; attempt++) ran = _withSaveLock(function() { _runDailyChoreResetForFamily(familyId); return true; });
      if (!ran) Logger.log("dailyChoreReset: lock busy for 60 s — SKIPPED " + familyId + " (nothing was changed for this family; tomorrow's run catches up — no action needed)");
    } catch(err) {
      Logger.log("dailyChoreReset ERROR for " + familyId + ": " + err);
    }
  });
}

function _runDailyChoreResetForFamily(familyId) {
  var state = loadState(familyId, {fresh: true});   // v39-9 — never a cached copy under the lock
  if (state && state.status === "error") {
    Logger.log("dailyChoreReset: skipping " + familyId + " (familyNotFound)");
    return;
  }
  var changed = false;
  var today   = new Date();

  getChildNames(state).forEach(function(childName) {
    var chores = state.children[childName].chores || [];
    chores.forEach(function(chore) {
      if (chore.schedule === "once") return;
      if (chore.status === "available" || chore.status === "pending") return;
      if (chore.endDate && chore.endDate < todayDateStr(state)) return;
      var reset = false;
      if (chore.schedule === "daily")    reset = true;
      if (chore.schedule === "weekly")   reset = isDayInterval(today, chore.createdAt, 7);
      if (chore.schedule === "biweekly") reset = isDayInterval(today, chore.createdAt, 14);
      if (chore.schedule === "monthly")  reset = (today.getDate() === parseInt(chore.monthlyDay || 1));
      if (reset) {
        // Clear lastCompleted so chore reappears on next scheduled day
        chore.status        = "available";
        chore.completedBy   = null;
        chore.completedAt   = null;
        chore.denialNote    = null;
        chore.lastCompleted = null;
        changed = true;
        Logger.log("dailyChoreReset: [" + familyId + "] reset '" + chore.name + "' for " + childName);
      }
    });
  });

  if (changed) saveState(familyId, state);
}

/**
 * v40-7 — RUN ONCE per Apps Script project (editor: pick installTriggers → Run; first run asks for
 * permissions). Installs the time-based triggers in the PROJECT's time zone (Project Settings → Time
 * zone; trigger hours are instance-wide, not per family), skipping any already there — safe
 * to re-run. Check: Triggers (clock icon) lists 5. Never have two projects' triggers live for the same
 * sheet (double Monday allowance).
 */
function installTriggers() {
  var existing = {};
  ScriptApp.getProjectTriggers().forEach(function(t) { existing[t.getHandlerFunction()] = true; });
  var tz = _instanceTz();   // v41-1 — was BANK_TIMEZONE
  var installed = [], skipped = [];
  [
    {fn: "automatedMondayDeposit", type: "weekly",  day: ScriptApp.WeekDay.MONDAY, hour: 8},
    {fn: "monthlyMaintenance",     type: "monthly", day: 1,                        hour: 7},
    {fn: "dailyChoreReset",        type: "daily",                                  hour: 6},
    {fn: "sundayChoreReminder",    type: "weekly",  day: ScriptApp.WeekDay.SUNDAY, hour: 9},
    {fn: "calendarSyncTick",       type: "minutes", every: 15}   // v40 — missed chores (Stage A), calendar diff (Stage B)
  ].forEach(function(t) {
    if (existing[t.fn]) { skipped.push(t.fn); return; }
    var tb = ScriptApp.newTrigger(t.fn).timeBased();
    if (t.type === "weekly")  tb = tb.onWeekDay(t.day).atHour(t.hour).inTimezone(tz);
    if (t.type === "monthly") tb = tb.onMonthDay(t.day).atHour(t.hour).inTimezone(tz);
    if (t.type === "daily")   tb = tb.everyDays(1).atHour(t.hour).inTimezone(tz);
    if (t.type === "minutes") tb = tb.everyMinutes(t.every);
    tb.create();
    installed.push(t.fn);
  });
  Logger.log("installTriggers: installed " + (installed.join(", ") || "none") + (installed.length ? " (in " + tz + ")" : "") + "; already there: " + (skipped.join(", ") || "none") + (skipped.length ? " (they keep the zone they were made in)" : ""));   // v41-3 (L3)
  return {installed: installed, skipped: skipped};
}

/**
 * v40-2 — TRIGGER: every 15 minutes (installTriggers). Stage A: missed chores. Stage B adds the
 * calendar → app diff. Each family runs under the save lock with a fresh read, like the other triggers.
 */
function calendarSyncTick() {
  _calPropCache = null;   // v42-3 — fresh Script Properties for this run
  _forEachFamily(function(familyId) {
    try {
      var out = null;
      // v40-10 (M2) — only the read + save run under the lock; the calendar and email work runs after it is released.
      for (var attempt = 0; attempt < 3 && !out; attempt++) out = _withSaveLock(function() { return _runSyncTickForFamily(familyId) || {missed: []}; });
      if (!out) { Logger.log("calendarSyncTick: lock busy for 60 s — SKIPPED " + familyId + " (nothing was changed; the next tick catches up — no action needed)"); return; }
      out.missed.forEach(function(m) {
        Logger.log("calendarSyncTick: [" + familyId + "] missed '" + _choreLabel(out.state, m.child, m.chore) + "' for " + m.child + " (" + m.ymd + ", due " + _choreDueHour(m.chore, m.ymd) + ":00)");
        try { _markOccurrenceMissed(out.state, m.child, m.chore, m.ymd); } catch(e) { Logger.log("calendarSyncTick: mark failed — " + e); }
        try { if (_missedEmailOn(out.state, m.child)) sendMissedChoreEmail(out.state, m.child, m.chore, m.ymd); } catch(e) { Logger.log("calendarSyncTick: email failed — " + e); }
      });
    } catch(err) {
      Logger.log("calendarSyncTick ERROR for " + familyId + ": " + err);
    }
  });
}

/** Under the save lock: fresh read, record misses, save once. Returns {state, missed:[{child, chore, ymd}]}. */
function _runSyncTickForFamily(familyId) {
  var state = loadState(familyId, {fresh: true});
  if (!state || state.status === "error") return null;
  var tz = getTimezone(state), now = new Date();
  var today = Utilities.formatDate(now, tz, "yyyy-MM-dd");
  var yesterday = _ymdMinusDay(today);   // v41-3 (L8) — from today's date, not now − 24 h (DST)
  var hourNow = parseInt(Utilities.formatDate(now, tz, "HH"), 10);
  var missed = [];
  var createdDay = function(c) { var d = c.createdAt ? new Date(c.createdAt) : null; return (d && !isNaN(d.getTime())) ? Utilities.formatDate(d, tz, "yyyy-MM-dd") : ""; };
  var createdHour = function(c) { var d = c.createdAt ? new Date(c.createdAt) : null; return (d && !isNaN(d.getTime())) ? parseInt(Utilities.formatDate(d, tz, "HH"), 10) : 0; };
  // v42-1 — Stage B first (a day deleted in Google Calendar is skipped, so it is not then recorded missed)
  var diff = _calendarDiffForFamily(familyId, state, today);
  getChildNames(state).forEach(function(child) {
    var data = state.children[child]; if (!data) return;
    (data.chores || []).forEach(function(chore) {
      if (!chore || chore.paused || chore.calendarDeleted || chore.status !== "available") return;   // v44-4 — a chore deleted in Google Calendar is never missed
      // v40-10 (L6) — yesterday too: a chore whose evening ticks all failed is still recorded (its hour has passed).
      // v40-12 (N1) — but only for a chore v40 has already touched, and never when its latest approval came from a
      // client that writes no doneDates (v39 phone): then "not done yesterday" proves nothing.
      var v40Touched = (chore.doneDates || []).concat(chore.missedDates || []).some(function(d) { return d < today; });   // tracked before today (no upgrade-day burst)
      var oldClientApproval = !!(chore.lastCompleted && !_dateIn(chore.doneDates, chore.lastCompleted));
      [yesterday, today].forEach(function(ymd) {
        if (chore.endDate && chore.endDate < ymd) return;
        if (ymd === yesterday && (!v40Touched || oldClientApproval || createdDay(chore) >= today)) return;
        if (ymd === createdDay(chore) && createdHour(chore) >= _choreDueHour(chore, ymd)) return;   // v40-12 (N3) — made after its hour that day
        if (_choreDoneOn(chore, ymd)) return;
        if (_dateIn(chore.missedDates, ymd)) return;
        if (!_choreMissableOn(chore, ymd)) return;
        if (ymd === today && hourNow < _choreDueHour(chore, ymd)) return;
        chore.missedDates = (chore.missedDates || []).concat([ymd]).slice(-30);
        missed.push({child: child, chore: chore, ymd: ymd});
      });
    });
  });
  var noticed = _runCalendarActions(familyId, state, diff.actions);   // v42-3 (M1) — inside the lock, fresh chores
  if (missed.length || diff.changed || noticed) saveState(familyId, state);
  return {state: state, missed: missed};
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// v42 — STAGE B: Google Calendar → app. Runs inside the tick, under the save lock, on a fresh state.
// ════════════════════════════════════════════════════════════════════════════════════════════════
var CAL_DIFF_DAYS = 62, CAL_DIFF_MAX = 31, CAL_ACTIONS_PER_TICK = 3;   // v42-4
var _calPropCache = null;   // one getProperties() per run (v42-3 L6)
function _calProps() { return PropertiesService.getScriptProperties(); }
function _calProp(k) { try { if (!_calPropCache) _calPropCache = _calProps().getProperties() || {}; return _calPropCache[k] || ""; } catch(e) { return ""; } }
function _calPropSet(k, v) { try { _calProps().setProperty(k, String(v)); if (_calPropCache) _calPropCache[k] = String(v); } catch(e) {} }
function _calPropDel(k) { try { _calProps().deleteProperty(k); if (_calPropCache) delete _calPropCache[k]; } catch(e) {} }
function _calBuiltKey(calendarId, choreId) { return "fbCalBuilt:" + calendarId + ":" + choreId; }
function _setCalBuilt(calendarId, choreId) { if (calendarId && choreId) { _calPropSet(_calBuiltKey(calendarId, choreId), _ymdLocal(new Date())); _calPropDel("fbCalFail:" + calendarId + ":" + choreId); } }
function _clearCalBuilt(calendarId, choreId) { if (!calendarId || !choreId) return; _calPropDel(_calBuiltKey(calendarId, choreId)); _calPropDel("fbCalRestored:" + calendarId + ":" + choreId); _calPropDel("fbCalFail:" + calendarId + ":" + choreId); _calPropDel("fbCalGone:" + calendarId + ":" + choreId); }   // v44-6 (#3) — gone marker too   // v42-6 — fail marker too
function _calBuiltDay(calendarId, choreId) { return _calProp(_calBuiltKey(calendarId, choreId)); }
function _setCalRestored(calendarId, choreId) { _calPropSet("fbCalRestored:" + calendarId + ":" + choreId, Date.now()); }
function _calRestoredRecently(calendarId, choreId) { var t = parseInt(_calProp("fbCalRestored:" + calendarId + ":" + choreId), 10); return !isNaN(t) && Date.now() - t < 86400000; }
/** v42-3 (M1) — "being written": a flag that simply expires (never removed, so one writer can't clear another's). */
function _calBusy(calendarId, seconds) { try { if (calendarId) CacheService.getScriptCache().put("fbCalBusy:" + calendarId, "1", seconds || 180); } catch(e) {} }
function _calIsBusy(calendarId) { try { return !!CacheService.getScriptCache().get("fbCalBusy:" + calendarId); } catch(e) { return false; } }
function _ymdPlus(ymd, n) {
  var p = String(ymd).split("-").map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + d.getUTCDate()).slice(-2);
}
function _ymdDiff(a, b) { var p = String(a).split("-").map(Number), q = String(b).split("-").map(Number); return Math.round((Date.UTC(p[0], p[1] - 1, p[2]) - Date.UTC(q[0], q[1] - 1, q[2])) / 86400000); }
function _choreIdsInDesc(desc) {
  var out = [], re = /CHORE_ID:([^\s:]+)/g, m;
  while ((m = re.exec(String(desc || "")))) out.push(m[1]);
  return out;
}
/** What the app expects on the calendar for a chore between two days: {ymd: hour}. */
function _calExpected(chore, from, to) {
  var exp = {};
  if (chore.schedule === "once") {
    if (chore.onceDate && chore.onceDate >= from && chore.onceDate <= to && !_dateIn(chore.doneDates, chore.onceDate)) exp[chore.onceDate] = _choreCalHour(chore, chore.onceDate);
    return exp;
  }
  for (var ymd = from; ymd <= to; ymd = _ymdPlus(ymd, 1)) {
    if (chore.endDate && ymd > chore.endDate) break;
    if (_dateIn(chore.doneDates, ymd)) continue;   // a done day's occurrence was taken off on submission
    if (_choreDueOn(chore, ymd)) exp[ymd] = _choreCalHour(chore, ymd);
  }
  return exp;
}
function _calDiffable(chore) {
  if (!chore || !chore.id || chore.paused || chore.calendarDeleted || chore.homeOnly) return false;   // v45-1 — "only when here" chores are kept by the home sync
  if (chore.schedule === "once") return !!chore.onceDate;
  if (chore.schedule === "monthly") { var md = parseInt(chore.monthlyDay || "1", 10); return String(md) === String(chore.monthlyDay || "1") && md >= 1 && md <= 28; }
  return chore.schedule === "daily" || chore.schedule === "weekly" || chore.schedule === "biweekly";
}
function _addNotice(state, child, text) {
  state.notices = (state.notices || []).concat([{id: "n" + Date.now() + Math.floor(Math.random() * 1000), at: new Date().toISOString(), child: child, text: text}]).slice(-20);
}
function _tidyDates(list, today) { return (list || []).filter(function(d, i, a) { return d >= _ymdPlus(today, -30) && a.indexOf(d) === i; }).sort(); }
/** The series a day belongs to: the weekday for weekly/biweekly (one series per weekday), else the whole chore. */
function _calGroup(chore, ymd) { return (chore.schedule === "weekly" || chore.schedule === "biweekly") ? String(_ymdToDate(ymd).getDay()) : "all"; }

/** v45-1 — for one child: read the nights from the 🏠 events into every "only when here" chore, then add /
 *  remove those chores' single events so the next 14 home nights each have one (bounded writes per tick). */
function _homeSyncChild(familyId, state, child, data, cal, calendarId, today, winEnd, homeCfg, homeEvs, evsByChore, res) {
  var homeChores = (data.chores || []).filter(function(c) { return c && c.id && c.homeOnly && c.schedule !== "once"; });
  if (!homeChores.length) return;
  if (!homeCfg) {   // v45-4 (#2) — no days set up for this child: back to normal chores (the tick rebuilds their series)
    homeChores.forEach(function(c) {
      c.homeOnly = false; delete c.homePattern; delete c.homeNights; res.changed = true;
      if (res.actions.length < CAL_ACTIONS_PER_TICK) res.actions.push({type: "rebuild", child: child, calendarId: calendarId, chore: c});
      else _calPropDel(_calBuiltKey(calendarId, c.id));   // a first look later
    });
    return;
  }
  if (!homeEvs.length) {   // v45-3 (#1/#7) — no 🏠 event seen: an empty read or all deleted. Fall back to the pattern; write no events.
    homeChores.forEach(function(c) { if (c.homeNights) { delete c.homeNights; res.changed = true; } });
    // v45-4 (#1) — seen missing on two ticks ≥ 25 min apart → make them again (at most hourly)
    var hk = "fbHomeGone:" + calendarId + ":" + child, seenAt = parseInt(_calProp(hk), 10), nowMs = Date.now();
    if (isNaN(seenAt) || nowMs - seenAt > 2 * 3600000) _calPropSet(hk, nowMs);
    else if (nowMs - seenAt >= 25 * 60000) {
      try { _calBusy(calendarId, 120); _rebuildHomeEvents(calendarId, state, child); } catch(e) { Logger.log("home sync: re-making 🏠 events failed — " + e); }
      _calPropSet(hk, nowMs + 35 * 60000);   // the next try waits ≥ 1 h
      Logger.log("home sync: [" + familyId + "] " + child + " — no 🏠 events on two ticks: made them again");
    }
    Logger.log("home sync: [" + familyId + "] " + child + " — no 🏠 events found; the pattern applies, no chore events written");
    return;
  }
  if (_calProp("fbHomeGone:" + calendarId + ":" + child)) _calPropDel("fbHomeGone:" + calendarId + ":" + child);
  var hn = {from: _ymdPlus(today, -1), to: winEnd, days: _homeNightsFromEvents(homeEvs, _ymdPlus(today, -1), winEnd)};
  var key = JSON.stringify(hn);
  homeChores.forEach(function(c) { if (JSON.stringify(c.homeNights || null) !== key) { c.homeNights = JSON.parse(key); res.changed = true; } });
  res.homeWrites = res.homeWrites || 0;
  homeChores.forEach(function(c) {
    if (c.paused || c.calendarDeleted || res.homeWrites >= HOME_WRITES_PER_TICK) return;
    var want = _calExpected(c, today, _ymdPlus(today, HOME_SYNC_DAYS - 1)), have = evsByChore[c.id] || {};
    Object.keys(have).forEach(function(d) {
      if (d > _ymdPlus(today, HOME_SYNC_DAYS - 1) || res.homeWrites >= HOME_WRITES_PER_TICK) return;
      var keep = want[d] !== undefined ? (have[d].filter(function(ev) { return ev.isRecurringEvent && ev.isRecurringEvent(); })[0] || have[d][0]) : null;
      var drop = have[d].filter(function(ev) { return ev !== keep && !(keep && ev.isRecurringEvent && ev.isRecurringEvent()); });   // v45-3 (#1) — extra single copies go; v45-4 (#3) — never a whole series for a duplicate
      drop.forEach(function(ev) { if (res.homeWrites >= HOME_WRITES_PER_TICK) return; try { _calBusy(calendarId, 120); if (ev.isRecurringEvent && ev.isRecurringEvent()) ev.getEventSeries().deleteEventSeries(); else ev.deleteEvent(); res.homeWrites++; } catch(e) { Logger.log("home sync: delete failed — " + e); } });
    });
    Object.keys(want).sort().forEach(function(d) {
      if (have[d] || res.homeWrites >= HOME_WRITES_PER_TICK) return;
      try {
        _calBusy(calendarId, 120);
        var s = _ymdToDate(d); s.setHours(want[d], 0, 0, 0);
        cal.createEvent(buildEventTitle(c), s, new Date(s.getTime() + 30 * 60000), {description: buildEventDescription(c)});
        res.homeWrites++;
      } catch(e) { Logger.log("home sync: create failed — " + e); }
    });
  });
  if (res.homeWrites) Logger.log("home sync: [" + familyId + "] " + child + " — " + res.homeWrites + " calendar write(s)");
}

/** Returns {changed, actions:[{type:"rebuild"|"restore", child, calendarId, chore, notice?}]}; changes `state` in place. */
function _calendarDiffForFamily(familyId, state, today) {
  var res = {changed: false, actions: []};
  var tzS = _instanceTz(), hourNow = parseInt(Utilities.formatDate(new Date(), getTimezone(state), "HH"), 10);
  getChildNames(state).forEach(function(child) {
    try {
      var data = state.children[child]; if (!data || !(data.chores || []).length) return;
      if (!notifyCalendar(state, child)) return;
      var calendarId = getCalendarId(state, child); if (!calendarId) return;
      if (_calIsBusy(calendarId)) { Logger.log("calendar diff: [" + familyId + "] " + child + " — calendar being written, next tick"); return; }
      var cal = CalendarApp.getCalendarById(calendarId); if (!cal) return;
      var winEnd = _ymdPlus(today, CAL_DIFF_DAYS);
      var actualAll = {}, allDayAll = {}, descs = {}, readErrors = 0;   // choreId → {ymd: hour}, read in the project zone (series are created in it)
      var homeCfg = state.config && state.config.homeTime && state.config.homeTime[child], homeEvs = [], evsByChore = {}, titles = {};   // v45-1
      cal.getEvents(_ymdToDate(homeCfg ? _ymdPlus(today, -14) : today), new Date(_ymdToDate(winEnd).getTime() + 86400000 - 1)).forEach(function(ev) {
        try {
          var dsc = _evDesc(ev, descs);
          if (homeCfg) {   // v45-1 — 🏠 events (v45-3 #5: the title read once per event id, never for a chore event already past)
            var evEnd = ev.getEndTime().getTime();
            if (evEnd >= _ymdToDate(_ymdPlus(today, -1)).getTime() && _isHomeEvent(dsc, _evTitle(ev, titles), child, homeCfg)) { homeEvs.push({s: ev.getStartTime().getTime(), e: evEnd}); return; }
            if (Utilities.formatDate(ev.getStartTime(), tzS, "yyyy-MM-dd") < today) return;   // the wider read is for the 🏠 events only
          }
          var ids = _choreIdsInDesc(dsc); if (!ids.length) return;   // v42-7 — one read per series
          if (ev.isAllDayEvent && ev.isAllDayEvent()) {   // v42-4 (NEW-2) — present that day, hour unknown: no change
            var ad = Utilities.formatDate(ev.getStartTime(), tzS, "yyyy-MM-dd");
            ids.forEach(function(id) { (allDayAll[id] = allDayAll[id] || {})[ad] = true; });
            return;
          }
          var st = ev.getStartTime(), ymd = Utilities.formatDate(st, tzS, "yyyy-MM-dd"), hr = parseInt(Utilities.formatDate(st, tzS, "HH"), 10);
          ids.forEach(function(id) { var a = actualAll[id] = actualAll[id] || {}; if (a[ymd] === undefined || hr < a[ymd]) a[ymd] = hr; var b = evsByChore[id] = evsByChore[id] || {}; (b[ymd] = b[ymd] || []).push(ev); });
        } catch(e) { readErrors++; }   // v44-5 (#1) — an unreadable event blocks Stage C for this child this tick
      });
      // v44-5 (#1) — chores of this child that are built but show no event at all: if that is every one of them, it is a
      // read problem or a wiped calendar, not a per-chore delete → hide nothing
      var builtIds = (data.chores || []).filter(function(c) { return _calDiffable(c) && c.schedule !== "once" && _calBuiltDay(calendarId, c.id); }).map(function(c) { return c.id; });
      var goneIds = builtIds.filter(function(id) { return !Object.keys(actualAll[id] || {}).length && !Object.keys(allDayAll[id] || {}).length; });
      if (readErrors) { Logger.log("calendar diff: [" + familyId + "] " + child + " — " + readErrors + " event(s) could not be read — this child is left alone this tick"); return; }   // v44-6 (#1) — Stage B too
      _homeSyncChild(familyId, state, child, data, cal, calendarId, today, winEnd, homeCfg, homeEvs, evsByChore, res);   // v45-1
      var homeSeen = homeEvs.length > 0 || (data.chores || []).some(function(c) { return c && c.homeOnly && evsByChore[c.id]; });   // v45-3 (#2) — proof the read worked
      var stageCOk = goneIds.length < builtIds.length || homeSeen || (builtIds.length === 1 && !(data.chores || []).some(function(c) { return c && c.homeOnly; }));   // v44-6 (#4) — a one-chore child can still hide it
      if (goneIds.length && !stageCOk) Logger.log("calendar diff: [" + familyId + "] " + child + " — " + goneIds.length + "/" + builtIds.length + " chores show no events (read errors " + readErrors + ") — nothing hidden");
      (data.chores || []).forEach(function(chore) {
        if (!_calDiffable(chore)) return;
        var built = _calBuiltDay(calendarId, chore.id);
        if (!built) {   // v42-3 (H1) — first look: silent rebuild (v42-4: at most CAL_ACTIONS_PER_TICK per family per tick)
          var failedAt = parseInt(_calProp("fbCalFail:" + calendarId + ":" + chore.id), 10);
          if (!isNaN(failedAt) && Date.now() - failedAt < 3600000) return;   // v42-5 (R5) — a failed build waits an hour
          if (res.actions.length < CAL_ACTIONS_PER_TICK) res.actions.push({type: "rebuild", child: child, calendarId: calendarId, chore: chore});
          return;
        }
        var from = _ymdPlus(built > today ? built : today, built >= today ? 1 : 0);
        if (from > winEnd) return;
        var exp = _calExpected(chore, from, winEnd), act = {};
        Object.keys(actualAll[chore.id] || {}).forEach(function(d) {
          if (d >= from && d <= winEnd && !(chore.endDate && d > chore.endDate) && !_dateIn(chore.doneDates, d)) act[d] = actualAll[chore.id][d];   // v42-3 (L1) done days ignored
        });
        Object.keys(allDayAll[chore.id] || {}).forEach(function(d) { if (exp[d] !== undefined && act[d] === undefined) act[d] = exp[d]; });   // v42-4 (NEW-2)
        var expDays = Object.keys(exp).sort(), actDays = Object.keys(act).sort();
        if ((Object.keys(actualAll[chore.id] || {}).length || Object.keys(allDayAll[chore.id] || {}).length) && _calProp("fbCalGone:" + calendarId + ":" + chore.id)) _calPropDel("fbCalGone:" + calendarId + ":" + chore.id);   // v44-5 — seen again (v44-6 #2: only write when there is a marker)
        if (!actDays.length) {   // every event gone
          // v44-4 (Stage C) — nothing of this chore left in the window (not even today or an all-day event): it was
          // deleted in Google Calendar. Flag it once; the child stops seeing it until a parent deletes it or puts it back.
          var goneKey = "fbCalGone:" + calendarId + ":" + chore.id, goneAt = parseInt(_calProp(goneKey), 10);
          if (stageCOk && chore.schedule !== "once" && expDays.length && goneIds.indexOf(chore.id) !== -1) {
            if (isNaN(goneAt) || Date.now() - goneAt > 2 * 3600000) { _calPropSet(goneKey, Date.now()); return; }   // v44-5 (#1) — first sighting: confirm on a later tick (v44-6 #3: a stale marker starts over)
            if (Date.now() - goneAt < 25 * 60000) return;
            _calPropDel(goneKey);
            chore.calendarDeleted = today;
            _addNotice(state, child, "\u201C" + chore.name + "\u201D was deleted from Google Calendar, so it's hidden from " + child + ". Open " + child + "'s chores to delete it for good or put it back.");
            res.changed = true;
            Logger.log("calendar diff: [" + familyId + "] '" + chore.name + "' (" + child + ") — every event deleted in Google Calendar → hidden (calendarDeleted)");
          }
          return;
        }
        var missing = expDays.filter(function(d) { return act[d] === undefined; });
        var extra = actDays.filter(function(d) { return exp[d] === undefined; });
        var retimed = expDays.filter(function(d) { return act[d] !== undefined && act[d] !== exp[d]; });
        if (!(missing.length + extra.length + retimed.length)) return;
        // v42-3 (H2/M3) — status per expected day; a series whose LAST ≥ 2 days share one change is a series-level edit
        var moveTo = {};
        if (missing.length === extra.length) missing.forEach(function(d, i) { moveTo[d] = extra[i]; });
        var status = function(d) {
          if (act[d] !== undefined) return act[d] === exp[d] ? "ok" : "h" + (act[d] - exp[d]);
          return moveTo[d] ? "m" + _ymdDiff(moveTo[d], d) + "/" + (act[moveTo[d]] - exp[d]) : "x";
        };
        // v42-4 — per series: the trailing run decides (see the header of v42-4); held days wait for a later tick
        var groups = {}, held = {}, seriesLevel = false;
        var endsInWindow = !!(chore.endDate && chore.endDate <= winEnd);   // v42-5 (R2) — no later day can show
        expDays.forEach(function(d) { var g = _calGroup(chore, d); (groups[g] = groups[g] || []).push(d); });
        if (chore.schedule !== "once" && !endsInWindow) Object.keys(groups).forEach(function(g) {
          var days = groups[g], n = days.length, last = status(days[n - 1]), run = 0;
          if (last === "ok") return;
          if (days.every(function(d) { return !_choreScheduledOn(chore, d); })) return;   // v42-5 (R1) — only one-off extra days: day by day
          for (var i = n - 1; i >= 0 && status(days[i]) === last; i--) run++;
          var runFrom = days[n - run];
          if (last === "x") {
            if (run >= 2 && (run === n || run * 2 >= n || runFrom <= _ymdPlus(today, 7))) { seriesLevel = true; return; }   // the whole series, most of it, or reaching this week
          } else if (run >= 2) { seriesLevel = true; return; }
          days.slice(n - run).forEach(function(d) { held[d] = true; if (moveTo[d]) held[moveTo[d]] = true; });
        });
        // v42-5 (R4) — an unpaired extra on/after the earliest held day waits with it (no half-applied move)
        var heldDays = Object.keys(held).sort();
        if (heldDays.length) extra.forEach(function(d) { if (d >= heldDays[0]) held[d] = true; });
        // v42-5 (R4) — a copied series: 3+ extra events on one weekday that is not the chore's → put back
        if (!seriesLevel && (chore.schedule === "weekly" || chore.schedule === "biweekly") && !endsInWindow) {
          var byDow = {};
          extra.forEach(function(d) { if (!_choreScheduledOn(chore, d) && !_dateIn(chore.extraDates, d)) { var k = _ymdToDate(d).getDay(); byDow[k] = (byDow[k] || 0) + 1; } });
          if (Object.keys(byDow).some(function(k) { return byDow[k] >= 3; })) seriesLevel = true;
        }
        if (seriesLevel) {
          if (_calRestoredRecently(calendarId, chore.id)) { Logger.log("calendar diff: [" + familyId + "] '" + chore.name + "' still differs after a restore today — left alone"); return; }
          if (res.actions.length >= CAL_ACTIONS_PER_TICK) return;
          res.actions.push({type: "restore", child: child, calendarId: calendarId, chore: chore,
            notice: "\u201C" + chore.name + "\u201D in Google Calendar no longer matched the app for a run of days, so the calendar was set back to the app's schedule. To change the schedule, edit the chore in the app."});   // v42-4 (L2) — no claim about who changed it
          return;
        }
        missing = missing.filter(function(d) { return !held[d]; });
        extra = extra.filter(function(d) { return !held[d]; });
        retimed = retimed.filter(function(d) { return !held[d]; });
        if (!(missing.length + extra.length + retimed.length)) return;
        if (missing.length + extra.length + retimed.length > CAL_DIFF_MAX) { Logger.log("calendar diff: [" + familyId + "] '" + chore.name + "' — too many differences, left alone"); return; }
        var before = JSON.stringify(chore);
        if (chore.schedule === "once") {
          if (missing.length === 1 && extra.length === 1) { chore.onceDate = extra[0]; _setHour(chore, extra[0], act[extra[0]], today, hourNow); }
          else if (retimed.length === 1) _setHour(chore, retimed[0], act[retimed[0]], today, hourNow);
          else return;
        } else {
          var skip = (chore.skipDates || []).slice(), add = (chore.extraDates || []).slice();
          missing.forEach(function(d) { if (add.indexOf(d) !== -1) add = add.filter(function(x) { return x !== d; }); else skip.push(d); });
          extra.forEach(function(d) { if (skip.indexOf(d) !== -1) skip = skip.filter(function(x) { return x !== d; }); else add.push(d); });
          chore.skipDates = _tidyDates(skip, today); if (!chore.skipDates.length) delete chore.skipDates;
          chore.extraDates = _tidyDates(add, today); if (!chore.extraDates.length) delete chore.extraDates;
          extra.forEach(function(d) { _setHour(chore, d, act[d], today, hourNow); });
          retimed.forEach(function(d) { _setHour(chore, d, act[d], today, hourNow); });
        }
        ["dayOverrides", "calOverrides"].forEach(function(k) { Object.keys(chore[k] || {}).forEach(function(d) { if (d < _ymdPlus(today, -7)) delete chore[k][d]; }); if (chore[k] && !Object.keys(chore[k]).length) delete chore[k]; });
        if (JSON.stringify(chore) !== before) {   // v42-3 (L1) — only a real change saves
          res.changed = true;
          Logger.log("calendar diff: [" + familyId + "] '" + chore.name + "' (" + child + ") — moved/added " + extra.join(",") + " · removed " + missing.join(",") + " · new time " + retimed.join(","));
        }
      });
    } catch(e) { Logger.log("calendar diff ERROR for " + child + ": " + e); }
  });
  return res;
}
/** v42-3 (M2) — a day's event moved to `calHour`: remember the CALENDAR hour; move the DUE hour by the same
 *  amount from the chore's normal due time (0–23), never at or before the current hour for today. */
function _setHour(chore, ymd, calHour, today, hourNow) {
  var co = chore.calOverrides || {}, dov = chore.dayOverrides || {};
  delete co[ymd]; delete dov[ymd];
  var base = _choreBaseCalHour(chore, ymd);
  if (calHour !== base) {
    co[ymd] = calHour;
    var nd = parseInt(chore.dueHour, 10), normalDue = isNaN(nd) ? DEFAULT_DUE_HOUR : nd;
    var due = Math.max(0, Math.min(23, normalDue + (calHour - base)));
    if (ymd === today && due <= hourNow) due = hourNow >= 23 ? normalDue : hourNow + 1;   // v42-4 (NEW-4)
    if (due !== normalDue) dov[ymd] = due;
  }
  if (Object.keys(co).length) chore.calOverrides = co; else delete chore.calOverrides;
  if (Object.keys(dov).length) chore.dayOverrides = dov; else delete chore.dayOverrides;
}
/** v42-3 — the tick's calendar writes, inside the lock with the fresh chore: silent first-look rebuilds and
 *  series restores (+ notice only when the rebuild worked). Returns true when a notice was added. */
function _runCalendarActions(familyId, state, actions) {
  var noticed = false;
  actions.forEach(function(a) {
    try {
      _calBusy(a.calendarId, 120);
      _calPropDel(_calBuiltKey(a.calendarId, a.chore.id));   // v44-5 (#2)
      deleteEventsByChoreId(a.calendarId, a.chore.id);
      Utilities.sleep(1000);   // v42-7 — let Calendar breathe between the delete and the rebuild
      var ok = createEventsForChore(a.calendarId, a.chore, getTimezone(state));
      if (a.type === "restore" && ok) {   // v42-8 — a failed restore must not block the retry for a day
        _setCalRestored(a.calendarId, a.chore.id);
        if (a.notice) { _addNotice(state, a.child, a.notice); noticed = true; }
      }
      Logger.log("calendarSyncTick: [" + familyId + "] " + (a.type === "restore" ? "restored" : "rebuilt (first look)") + " the calendar events of '" + a.chore.name + "' (" + a.child + ")" + (ok ? "" : " — FAILED, retried next tick"));
    } catch(e) { Logger.log("calendarSyncTick: " + a.type + " failed — " + e); }
  });
  return noticed;
}

/** "Reading (weekly Mon, Tue)" when another of the child's chores has the same name; else just the name. */
function _choreLabel(state, child, chore) {
  var chores = (state && state.children && state.children[child] && state.children[child].chores) || [];
  var twins = chores.filter(function(c) { return c && c.id !== chore.id && String(c.name || "").trim().toLowerCase() === String(chore.name || "").trim().toLowerCase(); });
  if (!twins.length) return chore.name;
  var DN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], sched = chore.schedule || "";
  if (sched === "weekly" || sched === "biweekly") {
    var days = chore.weekdays || (chore.weekday !== undefined ? [chore.weekday] : []);
    var names = days.slice().sort(function(a, b) { return a - b; }).map(function(d) { return DN[d] || d; });
    if (names.length) sched += " " + names.join(", ");
  } else if (sched === "monthly") sched += " day " + (chore.monthlyDay || "1");
  return chore.name + " (" + sched + ")";
}

function _fmtHour12(h) { h = parseInt(h, 10) || 0; return ((h % 12) || 12) + " " + (h < 12 ? "AM" : "PM"); }   // v40-5
function _missedEmailOn(state, child) {
  var n = state && state.config && state.config.notify && state.config.notify[child];
  return !!(n && n.missedEmail === true);
}

/** Retitle that day's occurrence of the chore "⏰ Missed: …" (kept on the calendar, so the child still sees it). */
function _markOccurrenceMissed(state, child, chore, ymd) {
  if (!notifyCalendar(state, child)) return;
  var calendarId = getCalendarId(state, child); if (!calendarId) return;
  var cal = CalendarApp.getCalendarById(calendarId); if (!cal) return;
  _occurrencesOn(cal, chore.id, ymd).forEach(function(ev) {
    var t = ev.getTitle() || "";
    if (t.indexOf("⏰ Missed: ") === 0) return;
    ev.setTitle("⏰ Missed: " + t);
  });
}

/** The chore's event(s) on a local day — a series instance or a single event, matched by the whole id. */
function _occurrencesOn(cal, choreId, ymd) {
  var d = _ymdToDate(ymd); if (!d) return [];
  var dayEnd = new Date(d.getTime() + 86400000 - 1);
  return cal.getEvents(d, dayEnd).filter(function(ev) { try { return _descHasChore(ev.getDescription(), choreId); } catch(e) { return false; } });
}

function sendMissedChoreEmail(state, child, chore, ymd) {
  var parentEmails = getParentEmails(state, child);
  if (!parentEmails.length) return;
  var hour = _choreDueHour(chore, ymd), h12 = (hour % 12) || 12, ampm = hour < 12 ? "AM" : "PM";
  var label = _choreLabel(state, child, chore);
  var tzE = getTimezone(state), todayE = Utilities.formatDate(new Date(), tzE, "yyyy-MM-dd"), yestE = _ymdMinusDay(todayE);   // v41-3 (L8)
  var when = ymd === todayE ? "today" : ymd === yestE ? "yesterday" : "on " + ymd;   // v40-12 (N6)
  var html = buildSimpleEmailHtml(state,
    "⏰ Missed chore: " + label,
    child + " didn't mark <strong>" + label + "</strong> done by " + h12 + ":00 " + ampm + " " + when + ".",
    [ {label: "Chore", val: label}, {label: "Child", val: child}, {label: "Was due", val: h12 + ":00 " + ampm + " · " + ymd}, {label: "Reward", val: "$" + (parseFloat(chore.amount) || 0).toFixed(2)} ],
    child + " can still mark it done. When that comes in, you choose: approve with the reward, or without."
  );
  sendSimpleEmail(parentEmails.join(","), getBankName(state) + " — missed chore: " + label + " (" + child + ")", html);
  Logger.log("Missed chore email → " + parentEmails.join(", "));
}

/**
 * TRIGGER: Every Sunday 9 AM — chore reminder email per child
 */
function sundayChoreReminder() {
  _forEachFamily(function(familyId) {
    try {
      _runSundayChoreReminderForFamily(familyId);
    } catch(err) {
      Logger.log("sundayChoreReminder ERROR for " + familyId + ": " + err);
    }
  });
}

function _runSundayChoreReminderForFamily(familyId) {
  var state = loadState(familyId);
  if (state && state.status === "error") {
    Logger.log("sundayChoreReminder: skipping " + familyId + " (familyNotFound)");
    return;
  }

  getChildNames(state).forEach(function(childName) {
    var data      = state.children[childName];
    var chores    = data.chores || [];
    var available = chores.filter(function(c) {
      return c.status !== "pending" && !c.paused && !c.calendarDeleted && (!c.endDate || c.endDate >= todayDateStr(state));   // v44-5 (#7)
    });

    if (!available.length) {
      Logger.log("sundayChoreReminder: [" + familyId + "] no chores for " + childName + " — skipping");
      return;
    }

    var childEmail  = getEmailFor(state, childName);
    var parentEmails= getParentEmails(state, childName);
    var bankName    = getBankName(state);
    var primary     = getPrimary(state);
    var secondary   = getSecondary(state);
    var totalPossible = available.reduce(function(s, c) { return s + (parseFloat(c.amount) || 0); }, 0);

    var subject = "🏦 " + bankName + " — Your chores this week, " + childName + "!";

    var choreRows = available.map(function(c) {
      var sched = {once:"One-time",daily:"Daily",weekly:"Weekly",biweekly:"Bi-weekly",monthly:"Monthly"}[c.schedule] || c.schedule;
      var split = c.childChooses ? "You choose" : c.splitChk + "% Checking / " + (100 - c.splitChk) + "% Savings";
      return {label: c.name + " (" + sched + ")", val: "$" + (c.amount || 0).toFixed(2) + " — " + split};
    });

    var html = buildReminderEmailHtml(state, childName, data, totalPossible, choreRows);

    var childWantsEmail = notifyEmail(state, childName);
    if (childEmail && childWantsEmail) {
      var opts = {to: childEmail, subject: subject, htmlBody: html};
      if (parentEmails.length) opts.cc = parentEmails.join(",");
      MailApp.sendEmail(opts);
      Logger.log("sundayChoreReminder: [" + familyId + "] sent for " + childName + " → " + childEmail);
    } else if (parentEmails.length) {
      // Send to parent only (child has no email or email notifications off)
      MailApp.sendEmail({to: parentEmails.join(","), subject: subject, htmlBody: html});
      Logger.log("sundayChoreReminder: [" + familyId + "] sent to parent only for " + childName);
    }
  });
}

// ================================================================
// [EVENT EMAILS] — Triggered by doPost actions
// ================================================================
function sendEventEmail(familyId, state, lastAction, activeChild, proofPhoto, hints) {
  hints = hints || {};
  try {
    if (!activeChild) return;
    var config      = state.config || {};
    var bankName    = getBankName(state);
    var childName   = activeChild;
    var childEmail  = getEmailFor(state, childName);
    var parentEmails= getParentEmails(state, childName);
    var data        = state.children && state.children[childName];
    var chores      = data ? (data.chores || []) : [];

    if (lastAction === "Chore Submitted") {
      // → All parents get notified (parents always get emails)
      var pending = chores.filter(function(c) { return c.status === "pending"; });
      if (!pending.length || !parentEmails.length) return;
      var chore   = pending[pending.length - 1];
      // v40-5 — the submitted chore by id when the client says which (two pending chores used to email about the wrong one)
      if (hints._submittedChoreId) pending.forEach(function(c) { if (c.id === hints._submittedChoreId) chore = c; });
      var split   = chore.splitChk + "% Checking / " + (100 - chore.splitChk) + "% Savings";
      var approveToken = generateToken(chore.id, "approve");
      var denyToken    = generateToken(chore.id, "deny");
      // v38 — every email-callback URL embeds familyId so the action handler
      // operates on the correct family row.
      var scriptUrl    = ScriptApp.getService().getUrl();
      var approveUrl   = scriptUrl + "?action=approve&familyId=" + encodeURIComponent(familyId) + "&choreId=" + chore.id + "&child=" + encodeURIComponent(childName) + "&token=" + approveToken;
      var denyUrl      = scriptUrl + "?action=deny&familyId="    + encodeURIComponent(familyId) + "&choreId=" + chore.id + "&child=" + encodeURIComponent(childName) + "&token=" + denyToken;

      var primary   = getPrimary(state);
      var secondary = getSecondary(state);
      var isLate = !!chore.lateFor;   // v40-5
      var rows = [
          {label: "Chore",     val: _choreLabel(state, childName, chore)},
          {label: "Reward",    val: "$" + (chore.amount || 0).toFixed(2)},
          {label: "Split",     val: split},
          {label: "Completed", val: chore.completedAt || "just now"}
      ];
      if (isLate) rows.splice(1, 0, {label: "⏰ Late", val: "done for " + chore.lateFor + " (was due " + _fmtHour12(_choreDueHour(chore, chore.lateFor)) + ")"});
      var html = buildSimpleEmailHtml(state,
        "✋ " + childName + " completed a chore" + (isLate ? " — late" : "") + "!",
        childName + " marked <strong>" + chore.name + "</strong> complete" + (isLate ? " <strong>late</strong>" : "") + " and is waiting for your approval." + (isLate ? " You can approve it with the reward or without — the streak continues either way." : ""),
        rows,
        ""
      );
      // Inject approve/deny buttons using the placeholder we put in buildSimpleEmailHtml
      var btnHtml = "<div style='display:flex;gap:12px;justify-content:center;margin:0 0 16px;'>"
        + "<a href='" + approveUrl + "' style='flex:1;display:block;background:" + secondary + ";color:white;"
        + "text-decoration:none;padding:14px;border-radius:10px;font-weight:800;font-size:1rem;"
        + "text-align:center;'>✅ Approve" + (isLate ? " &amp; pay" : "") + "</a>"
        + (isLate ? "<a href='" + approveUrl + "&reward=0' style='flex:1;display:block;background:#6b7280;color:white;"
        + "text-decoration:none;padding:14px;border-radius:10px;font-weight:800;font-size:1rem;"
        + "text-align:center;'>✅ Approve, no reward</a>" : "")
        + "<a href='" + denyUrl + "' style='flex:1;display:block;background:#ef4444;color:white;"
        + "text-decoration:none;padding:14px;border-radius:10px;font-weight:800;font-size:1rem;"
        + "text-align:center;'>❌ Deny</a>"
        + "</div>";
      // v33.0 — Embed proof photo inline if supplied
      // Limits to be aware of (best-effort: failures don't block chore submission):
      //   • Gmail free tier: 100 recipients/day
      //   • Single message max: 25 MB
      //   • Apps Script daily email quota: 100 free / 1500 workspace
      //   • Sheet A1 cell: 50 K chars (we strip proofPhoto BEFORE saveState)
      var proofBlob = null;
      var photoHtml = "";
      if (proofPhoto) {
        try {
          var m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(proofPhoto);
          if (m) {
            var mime  = m[1];
            var b64   = m[2];
            var bytes = Utilities.base64Decode(b64);
            var ext   = (mime.split("/")[1] || "jpg").replace("jpeg", "jpg");
            proofBlob = Utilities.newBlob(bytes, mime, (chore.name || "proof") + "." + ext);
            photoHtml = "<div style='margin:0 0 16px;text-align:center;'>"
              + "<p style='font-weight:700;margin:0 0 8px;color:#334155;'>Proof photo</p>"
              + "<img src='cid:choreProof' style='max-width:100%;border-radius:10px;border:1px solid #e2e8f0;'>"
              + "</div>";
          }
        } catch(pe) { Logger.log("proofPhoto decode ERROR: " + pe); proofBlob = null; photoHtml = ""; }
      }

      html = html.replace("<!-- ACTION_BUTTONS -->", btnHtml + photoHtml);   // v43-6 — buttons first, the proof photo under them

      parentEmails.forEach(function(email) {
        try {
          if (proofBlob) {
            MailApp.sendEmail({
              to:           email,
              subject:      bankName + " — " + childName + " completed a chore! ✋",
              htmlBody:     html,
              inlineImages: { choreProof: proofBlob }
            });
          } else {
            sendSimpleEmail(email, bankName + " — " + childName + " completed a chore! ✋", html);
          }
        } catch(ee) {
          Logger.log("Chore Submitted email FAIL (" + email + "): " + ee);
          // Best-effort fallback: send without inline image
          try {
            var fallbackHtml = html.replace(/<img src='cid:choreProof'[^>]*>/g, "<em>(photo could not be attached)</em>");
            sendSimpleEmail(email, bankName + " — " + childName + " completed a chore! ✋", fallbackHtml);
          } catch(e2) { Logger.log("Chore Submitted fallback FAIL (" + email + "): " + e2); }
        }
      });
      Logger.log("Chore Submitted email → " + parentEmails.join(", ") + (proofBlob ? " [+ proof photo]" : ""));

    } else if (lastAction === "Chore Created" && childEmail && notifyEmail(state, childName)) {
      // → Child gets notified of new chore
      var recentChore = chores[chores.length - 1];
      if (!recentChore) return;
      var split = recentChore.childChooses ? "You choose" : recentChore.splitChk + "% Checking / " + (100 - recentChore.splitChk) + "% Savings";
      var html = buildSimpleEmailHtml(state,
        "📋 New chore assigned, " + childName + "!",
        "A new chore has been added to your list in " + bankName + ".",
        [
          {label: "Chore",    val: recentChore.name},
          {label: "Reward",   val: "$" + (recentChore.amount || 0).toFixed(2)},
          {label: "Schedule", val: {once:"One-time",daily:"Daily",weekly:"Weekly",biweekly:"Bi-weekly",monthly:"Monthly"}[recentChore.schedule] || recentChore.schedule},
          {label: "Split",    val: split}
        ],
        "Log in to " + bankName + " to see your chores! 💪"
      );
      sendSimpleEmail(childEmail, bankName + " — You have a new chore! 📋", html);
      Logger.log("Chore Created email → " + childEmail);

    } else if ((lastAction === "Chore Approved" || lastAction === "Chore Approved (Auto)") && childEmail && notifyEmail(state, childName)) {   // v44-2 — an auto-approved chore gets the same email
      // → Child gets approval confirmation with new balances
      var row = getLastChoreEntry(familyId, childName);
      var noReward  = !!(row && / \(late, no reward\)$/.test(String(row[4])));   // v40-10 (L3)
      var choreName = row ? String(row[4]).replace(/Chore: | \(Chk\)| \(Sav\)| \(late, no reward\)/g, "") : "your chore";
      var earned    = row ? _lastChoreEarned(familyId, childName, choreName) : 0;   // v44-5 (#5) — Chk + Sav, not one half
      var hintChore = hints._approvedChoreId ? chores.filter(function(c) { return c.id === hints._approvedChoreId; })[0] : null;
      if (hintChore && hintChore.name !== choreName) { choreName = hintChore.name; earned = 0; noReward = false; }
      else if (!hintChore && hints._approvedChoreName && hints._approvedChoreName !== choreName) { choreName = hints._approvedChoreName; earned = 0; noReward = false; }   // v44-6 (#5) — a $0 one-time chore (gone from state, no ledger row)   // v44-5 (#5) — a $0 chore writes no ledger row
      var html = buildSimpleEmailHtml(state,
        "🎉 Chore approved, " + childName + "!",
        (noReward ? "Your chore <strong>" + choreName + "</strong> was approved — it was late, so no reward this time. Your streak continues!"
                  : "Great work! Your chore <strong>" + choreName + "</strong> was approved."),
        [
          {label: "Earned",           val: noReward ? "no reward (late)" : "+$" + earned.toFixed(2)},
          {label: "Checking Balance", val: "$" + (data.balances.checking || 0).toFixed(2)},
          {label: "Savings Balance",  val: "$" + (data.balances.savings  || 0).toFixed(2)},
          {label: "Total Wealth",     val: "$" + ((data.balances.checking || 0) + (data.balances.savings || 0)).toFixed(2)}
        ],
        "Keep up the amazing work! 💪🌟"
      );
      sendSimpleEmail(childEmail, bankName + " — Your chore was approved! 🎉", html);
      Logger.log("Chore Approved email → " + childEmail);

    } else if (lastAction === "Chore Denied" && childEmail && notifyEmail(state, childName)) {
      // → Child gets denial notice
      var parentName = getParentName(state);
      var html = buildSimpleEmailHtml(state,
        "Chore Update for " + childName,
        "Your chore wasn't approved this time. Talk to " + parentName + " if you have questions — and try again next time! 💪",
        [],
        ""
      );
      sendSimpleEmail(childEmail, bankName + " — Chore update", html);
      Logger.log("Chore Denied email → " + childEmail);

    } else if (lastAction === "Deposit Submitted") {
      // → All assigned parents get notified with approve/deny buttons
      // v38.0-step8 Bug-8 — read pendingDeposits (what the frontend writes);
      // entries carry no status field, so no filter — withdrawal parity (see 1024).
      var pendingD = data ? (data.pendingDeposits || []) : [];
      if (!pendingD.length || !parentEmails.length) return;
      var dep = pendingD[pendingD.length - 1];
      var split = dep.splitChk + "% Checking / " + (100 - dep.splitChk) + "% Savings";
      var scriptUrl     = ScriptApp.getService().getUrl();
      var approveToken  = generateToken(dep.id, "depositApprove");
      var denyToken     = generateToken(dep.id, "depositDeny");
      // v38 — embed familyId.
      var approveUrl    = scriptUrl + "?action=depositApprove&familyId=" + encodeURIComponent(familyId) + "&depositId=" + dep.id + "&child=" + encodeURIComponent(childName) + "&token=" + approveToken;
      var denyUrl       = scriptUrl + "?action=depositDeny&familyId="    + encodeURIComponent(familyId) + "&depositId=" + dep.id + "&child=" + encodeURIComponent(childName) + "&token=" + denyToken;
      var secondary     = getSecondary(state);
      var html = buildSimpleEmailHtml(state,
        "💰 " + childName + " wants to make a deposit!",
        childName + " would like to deposit <strong>$" + dep.amount.toFixed(2) + "</strong> into their account.",
        [
          {label: "Amount", val: "$" + dep.amount.toFixed(2)},
          {label: "Note",   val: dep.note || "—"},
          {label: "Split",  val: split},
          {label: "Time",   val: dep.submittedAt || "just now"}
        ],
        ""
      );
      var btnHtml = "<div style='display:flex;gap:12px;justify-content:center;margin:0 0 16px;'>"
        + "<a href='" + approveUrl + "' style='flex:1;display:block;background:" + secondary + ";color:white;"
        + "text-decoration:none;padding:14px;border-radius:10px;font-weight:800;font-size:1rem;"
        + "text-align:center;'>✅ Approve</a>"
        + "<a href='" + denyUrl + "' style='flex:1;display:block;background:#ef4444;color:white;"
        + "text-decoration:none;padding:14px;border-radius:10px;font-weight:800;font-size:1rem;"
        + "text-align:center;'>❌ Deny</a>"
        + "</div>";
      html = html.replace("<!-- ACTION_BUTTONS -->", btnHtml);
      parentEmails.forEach(function(email) {
        sendSimpleEmail(email, bankName + " — " + childName + " wants to make a deposit! 💰", html);
      });
    } else if (lastAction === "Withdrawal Submitted") {
      // v35.0 Item 2 — pending-approval flow (mirrors Deposit Submitted).
      // All assigned parents get an email with Approve/Deny buttons.
      var pendingW = data ? (data.pendingWithdrawals || []) : [];
      if (!pendingW.length || !parentEmails.length) return;
      var wd        = pendingW[pendingW.length - 1];
      var scriptUrl    = ScriptApp.getService().getUrl();
      var approveToken = generateToken(wd.id, "withdrawApprove");
      var denyToken    = generateToken(wd.id, "withdrawDeny");
      // v38 — embed familyId.
      var approveUrl   = scriptUrl + "?action=withdrawApprove&familyId=" + encodeURIComponent(familyId) + "&withdrawalId=" + wd.id + "&child=" + encodeURIComponent(childName) + "&token=" + approveToken;
      var denyUrl      = scriptUrl + "?action=withdrawDeny&familyId="    + encodeURIComponent(familyId) + "&withdrawalId=" + wd.id + "&child=" + encodeURIComponent(childName) + "&token=" + denyToken;
      var secondary    = getSecondary(state);
      var html = buildSimpleEmailHtml(state,
        "💸 " + childName + " wants to make a withdrawal",
        childName + " is requesting to withdraw <strong>$" + wd.amount.toFixed(2) + "</strong> from their checking account.",
        [
          {label: "Amount", val: "$" + wd.amount.toFixed(2)},
          {label: "Note",   val: wd.note || "—"},
          {label: "From",   val: "Checking"},
          {label: "Time",   val: wd.submittedAt || "just now"}
        ],
        ""
      );
      var btnHtml = "<div style='display:flex;gap:12px;justify-content:center;margin:0 0 16px;'>"
        + "<a href='" + approveUrl + "' style='flex:1;display:block;background:" + secondary + ";color:white;"
        + "text-decoration:none;padding:14px;border-radius:10px;font-weight:800;font-size:1rem;"
        + "text-align:center;'>✅ Approve</a>"
        + "<a href='" + denyUrl + "' style='flex:1;display:block;background:#ef4444;color:white;"
        + "text-decoration:none;padding:14px;border-radius:10px;font-weight:800;font-size:1rem;"
        + "text-align:center;'>❌ Deny</a>"
        + "</div>";
      html = html.replace("<!-- ACTION_BUTTONS -->", btnHtml);
      parentEmails.forEach(function(email) {
        sendSimpleEmail(email, bankName + " — " + childName + " wants to withdraw $" + wd.amount.toFixed(2), html);
      });
      Logger.log("Withdrawal Submitted email → " + parentEmails.join(", "));

    } else if (lastAction === "Withdrawal Approved" && childEmail && notifyEmail(state, childName)) {
      // v35.0 Item 2 — child gets confirmation
      var rowW = getLastWithdrawEntry(familyId, childName);
      var wAmt = rowW ? Math.abs(parseFloat(rowW[5]) || 0) : 0;
      var wNote = rowW ? String(rowW[4]).replace(/^Withdraw:\s*/, "") : "your withdrawal";   // v39-5 — column 4 = Note in the 6-column ledger
      var html = buildSimpleEmailHtml(state,
        "✅ Withdrawal approved, " + childName + "!",
        "Your withdrawal request was approved.",
        [
          {label: "Amount",          val: "$" + wAmt.toFixed(2)},
          {label: "Note",            val: wNote},
          {label: "Checking Balance",val: "$" + ((data.balances && data.balances.checking) || 0).toFixed(2)}
        ],
        ""
      );
      sendSimpleEmail(childEmail, bankName + " — Your withdrawal was approved 💸", html);
      Logger.log("Withdrawal Approved email → " + childEmail);

    } else if (lastAction === "Withdrawal Denied" && childEmail && notifyEmail(state, childName)) {
      // v35.0 Item 2 — child gets denial notice
      var parentName = getParentName(state);
      var html = buildSimpleEmailHtml(state,
        "Withdrawal update for " + childName,
        "Your withdrawal request wasn't approved this time. Talk to " + parentName + " if you have questions.",
        [],
        ""
      );
      sendSimpleEmail(childEmail, bankName + " — Withdrawal update", html);
      Logger.log("Withdrawal Denied email → " + childEmail);

    }
  } catch(err) { Logger.log("sendEventEmail ERROR: " + err); }
}

// ================================================================
// [MONTHLY STATEMENT EMAIL] — Rich HTML, interest growth highlighted
// ================================================================
function sendMonthlyStatement(familyId, state, childName, data, prevChk, prevSav, interestChk, interestSav) {
  try {
    var bankName    = getBankName(state);
    var primary     = getPrimary(state);
    var secondary   = getSecondary(state);
    var primaryDark = shadeColorGs(primary, -20);
    var secDark     = shadeColorGs(secondary, -20);
    var month       = Utilities.formatDate(new Date(), getTimezone(state), "MMMM yyyy");   // v41-1

    var checking    = (data.balances.checking || 0);
    var savings     = (data.balances.savings  || 0);
    var total       = checking + savings;
    var prevTotal   = prevChk + prevSav;
    var totalInterest = interestChk + interestSav;
    var growth      = total - prevTotal;
    var allowChk    = (data.autoDeposit && data.autoDeposit.checking) || 0;
    var allowSav    = (data.autoDeposit && data.autoDeposit.savings)  || 0;
    var rateChk     = (data.rates && data.rates.checking) || 0;
    var rateSav     = (data.rates && data.rates.savings)  || 0;

    // Year-to-date interest — sum from Ledger
    var ytdInterest = calcYTDInterest(familyId, childName);

    // Simple 12-month projection: current balance + 52 weeks allowance + 12 months interest
    var weeklyTotal    = allowChk + allowSav;
    var projectedSavings = savings * Math.pow(1 + rateSav/100/12, 12) + (allowSav * 52);
    var projectedChecking= checking * Math.pow(1 + rateChk/100/12, 12) + (allowChk * 52);
    var projectedTotal   = projectedChecking + projectedSavings;

    var subject = bankName + " — " + childName + "'s Statement — " + month;

    // Calculate chore streaks for statement
    var choreStreaks = calcChoreStreaks(familyId, childName, data);

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1.0">'
      + '<style>'
      + 'body{margin:0;padding:16px;background:#f1f5f9;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;font-size:15px}'
      + '.wrap{max-width:540px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.10)}'
      + '.header{background:linear-gradient(135deg,'+primary+' 0%,'+primaryDark+' 100%);padding:36px 32px 28px;text-align:center;color:white}'
      + '.header h1{margin:0 0 6px;font-size:28px;font-weight:800;letter-spacing:-0.5px}'
      + '.header p{margin:0;font-size:15px;opacity:0.88;font-weight:500}'
      + '.body{padding:28px 32px}'
      // Total wealth hero
      + '.wealth-card{background:linear-gradient(135deg,#f0f6ff,#e8f0fe);border:2px solid #bfdbfe;border-radius:16px;padding:24px;text-align:center;margin-bottom:22px}'
      + '.wealth-label{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin-bottom:8px}'
      + '.wealth-total{font-size:48px;font-weight:900;color:'+primary+';letter-spacing:-2px;margin:0 0 6px;line-height:1}'
      + '.wealth-sub{font-size:14px;color:#64748b;font-weight:500}'
      + '.wealth-growth{display:inline-block;background:'+secondary+';color:white;border-radius:20px;padding:6px 16px;font-size:13px;font-weight:700;margin-top:10px}'
      // Account cards
      + '.acct-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:22px}'
      + '.acct-card{border-radius:14px;padding:20px;color:white;text-align:center}'
      + '.acct-chk{background:linear-gradient(135deg,'+primary+','+primaryDark+')}'
      + '.acct-sav{background:linear-gradient(135deg,'+secondary+','+secDark+')}'
      + '.acct-label{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;opacity:0.85;margin-bottom:8px}'
      + '.acct-amt{font-size:26px;font-weight:800;letter-spacing:-0.5px}'
      + '.acct-rate{font-size:11px;opacity:0.78;margin-top:4px;font-weight:600}'
      // Interest highlight card
      + '.interest-card{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #86efac;border-radius:16px;padding:22px;margin-bottom:22px}'
      + '.int-title{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#15803d;margin-bottom:14px}'
      + '.int-hero{font-size:40px;font-weight:900;color:'+secondary+';text-align:center;letter-spacing:-1px;margin:10px 0 4px;line-height:1}'
      + '.int-sub{font-size:13px;color:#16a34a;text-align:center;margin-bottom:16px;font-weight:600}'
      + '.int-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #bbf7d0;font-size:14px}'
      + '.int-row:last-child{border-bottom:none}'
      + '.int-label{color:#166534;font-weight:500}'
      + '.int-val{font-weight:800;color:'+secondary+'}'
      + '.int-val-muted{font-weight:700;color:#374151}'
      + '.ytd-badge{background:#166534;color:white;border-radius:10px;padding:8px 14px;text-align:center;margin-top:12px;font-size:13px;font-weight:700}'
      // Projection card
      + '.proj-card{background:linear-gradient(135deg,#fefce8,#fef9c3);border:2px solid #fde68a;border-radius:16px;padding:20px;margin-bottom:22px}'
      + '.proj-title{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#92400e;margin-bottom:12px}'
      + '.proj-amt{font-size:32px;font-weight:900;color:#d97706;text-align:center;letter-spacing:-1px;margin:8px 0 4px}'
      + '.proj-sub{font-size:12px;color:#92400e;text-align:center;font-weight:600}'
      // Section title
      + '.section-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin:22px 0 12px;padding-top:18px;border-top:1px solid #f1f5f9}'
      // Info rows
      + '.info-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #f8fafc;font-size:14px}'
      + '.info-label{color:#64748b;font-weight:500}'
      + '.info-val{font-weight:700;color:#1e293b}'
      // Transaction table
      + 'table{width:100%;border-collapse:collapse;font-size:13px}'
      + 'th{background:'+primary+';color:white;padding:10px 12px;text-align:left;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.05em}'
      + 'td{padding:9px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top;color:#374151}'
      + 'tr:last-child td{border-bottom:none}'
      + '.td-pos{color:'+secondary+';font-weight:800}'
      + '.td-neg{color:#ef4444;font-weight:800}'
      + '.td-acct{font-size:10px;font-weight:700;padding:3px 7px;border-radius:10px;display:inline-block}'
      + '.td-chk{background:#dbeafe;color:#1d4ed8}'
      + '.td-sav{background:#d1fae5;color:#065f46}'
      // Footer
      + '.footer{background:#f8faff;padding:22px 32px;text-align:center;border-top:1px solid #e2e8f0}'
      + '.footer p{margin:0;font-size:13px;color:#94a3b8;line-height:1.6}'
      + '.footer strong{color:'+primary+'}'
      + '</style></head><body>'
      + '<div class="wrap">'

      // Header
      + '<div class="header">'
      + '<h1>🏦 ' + bankName + '</h1>'
      + '<p>' + childName + "'s Monthly Statement — " + month + '</p>'
      + '</div>'

      + '<div class="body">'

      // Total wealth hero
      + '<div class="wealth-card">'
      + '<div class="wealth-label">Total Wealth</div>'
      + '<div class="wealth-total">$' + total.toFixed(2) + '</div>'
      + '<div class="wealth-sub">Checking: <strong>$' + checking.toFixed(2) + '</strong> &nbsp;|&nbsp; Savings: <strong>$' + savings.toFixed(2) + '</strong></div>'
      + '<div class="wealth-growth">↑ Up $' + growth.toFixed(2) + ' this month</div>'
      + '</div>'

      // Account cards
      + '<div class="acct-grid">'
      + '<div class="acct-card acct-chk"><div class="acct-label">Checking</div><div class="acct-amt">$' + checking.toFixed(2) + '</div><div class="acct-rate">APY: ' + rateChk + '%</div></div>'
      + '<div class="acct-card acct-sav"><div class="acct-label">Savings</div><div class="acct-amt">$' + savings.toFixed(2) + '</div><div class="acct-rate">APY: ' + rateSav + '%</div></div>'
      + '</div>'

      // ★ Interest highlight — the star of the show
      + '<div class="interest-card">'
      + '<div class="int-title">📈 Interest Earned This Month</div>'
      + '<div class="int-hero">+$' + totalInterest.toFixed(2) + '</div>'
      + '<div class="int-sub">Your money grew while you slept! 💚</div>'
      + '<div class="int-row"><span class="int-label">Checking (' + rateChk + '% APY)</span><span class="int-val">+$' + interestChk.toFixed(4) + '</span></div>'
      + '<div class="int-row"><span class="int-label">Savings (' + rateSav + '% APY)</span><span class="int-val">+$' + interestSav.toFixed(4) + '</span></div>'
      + '<div class="int-row"><span class="int-label">Balance before interest</span><span class="int-val-muted">$' + prevTotal.toFixed(2) + '</span></div>'
      + '<div class="int-row"><span class="int-label">Balance after interest</span><span class="int-val-muted">$' + total.toFixed(2) + '</span></div>'
      + (ytdInterest > 0 ? '<div class="ytd-badge">🏆 Total interest earned this year: +$' + ytdInterest.toFixed(2) + '</div>' : '')
      + '</div>'

      // 12-month projection
      + '<div class="proj-card">'
      + '<div class="proj-title">🔮 If you keep saving... in 12 months:</div>'
      + '<div class="proj-amt">$' + projectedTotal.toFixed(2) + '</div>'
      + '<div class="proj-sub">Based on current allowance ($' + weeklyTotal.toFixed(2) + '/week) + compound interest</div>'
      + '</div>'

      // Allowance & rates info
      + '<div class="section-title">💵 Allowance & Rates</div>'
      + '<div class="info-row"><span class="info-label">Weekly Checking Allowance</span><span class="info-val">$' + allowChk.toFixed(2) + '/week</span></div>'
      + '<div class="info-row"><span class="info-label">Weekly Savings Allowance</span><span class="info-val">$' + allowSav.toFixed(2) + '/week</span></div>'
      + '<div class="info-row"><span class="info-label">Checking APY</span><span class="info-val">' + rateChk + '%</span></div>'
      + '<div class="info-row"><span class="info-label">Savings APY</span><span class="info-val">' + rateSav + '%</span></div>';

    // Recent activity table — last 10 transactions for this child
    var ledgerData = getLedgerSheet().getDataRange().getValues();
    var childRows  = [];
    for (var i = ledgerData.length - 1; i >= 1; i--) {
      if (String(ledgerData[i][1]) !== familyId) continue;
      var rowChild = String(ledgerData[i][3] || "");
      if (rowChild === childName || (!rowChild && childName === DEFAULT_CHILD_NAME)) {
        childRows.push(ledgerData[i]);
        if (childRows.length >= 10) break;
      }
    }

    if (childRows.length > 0) {
      html += '<div class="section-title">📋 Recent Activity</div>'
        + '<table><tr><th>Date</th><th>Account</th><th>Amount</th><th>Note</th></tr>';
      childRows.forEach(function(row) {
        var note   = String(row[4] || "");
        var amt    = parseFloat(row[5]) || 0;
        var isSav  = note.toLowerCase().includes("sav");
        var amtStr = (amt >= 0 ? "+$" : "-$") + Math.abs(amt).toFixed(2);
        var amtCls = amt >= 0 ? "td-pos" : "td-neg";
        var acctTag= isSav
          ? '<span class="td-acct td-sav">SAV</span>'
          : '<span class="td-acct td-chk">CHK</span>';
        var dateStr= "";
        try { dateStr = Utilities.formatDate(new Date(row[0]), getTimezone(state), "MM/dd"); } catch(e) { dateStr = String(row[0]||""); }   // v41-1
        html += '<tr><td>' + dateStr + '</td><td>' + acctTag + '</td>'
          + '<td class="' + amtCls + '">' + amtStr + '</td><td>' + note + '</td></tr>';
      });
      html += '</table>';
    }

    html += '</div>'
      + '<div class="footer" style="background:#f8faff;padding:22px 32px;text-align:center;border-top:1px solid #e2e8f0;"><a href="' + APP_URL + '" style="display:inline-block;background:' + primary + ';color:white;text-decoration:none;font-weight:700;font-size:13px;padding:10px 22px;border-radius:20px;margin-bottom:12px;">🏦 Open Family Bank</a><p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">Keep up the amazing work, <strong style="color:'+primary+';">' + childName + '</strong>! 🌟<br>— <strong>' + bankName + '</strong></p></div>'
      + '</div></body></html>';

    // Send to child + all parents
    var childEmail   = getEmailFor(state, childName);
    var parentEmails = getParentEmails(state, childName);
    var allRecipients= [];
    if (childEmail)      allRecipients.push(childEmail);
    parentEmails.forEach(function(e) { if (e !== childEmail) allRecipients.push(e); });

    if (allRecipients.length) {
      MailApp.sendEmail({to: allRecipients.join(","), subject: subject, htmlBody: html});
      Logger.log("Statement sent for " + childName + " → " + allRecipients.join(", "));
    }
  } catch(err) { Logger.log("sendMonthlyStatement ERROR: " + err); }
}

// ================================================================
// [EMAIL BUILDERS] — Reusable HTML email templates
// ================================================================

/**
 * Simple branded email: header + rows table + footer message
 * rows = [{label, val}, ...]
 */
function buildSimpleEmailHtml(state, title, intro, rows, footer) {
  var bankName  = getBankName(state);
  var primary   = getPrimary(state);
  var secondary = getSecondary(state);
  var darkPrimary = shadeColorGs(primary, -20);
  var rowsHtml = rows.map(function(r) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:14px;">'
      + '<span style="color:#64748b;font-weight:500;">' + r.label + '</span>'
      + '<span style="font-weight:800;color:#1e293b;">' + r.val + '</span>'
      + '</div>';
  }).join("");
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body '
    + 'style="margin:0;padding:16px;background:#f1f5f9;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;font-size:15px;">'
    + '<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">'
    + '<div style="background:linear-gradient(135deg,'+primary+','+darkPrimary+');padding:30px;text-align:center;color:white;">'
    + '<h1 style="margin:0 0 6px;font-size:22px;font-weight:800;">' + title + '</h1>'
    + '<p style="margin:0;font-size:13px;opacity:0.88;">🏦 ' + bankName + '</p>'
    + '</div>'
    + '<div style="padding:24px 28px;">'
    + '<p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">' + intro + '</p>'
    + '<!-- ACTION_BUTTONS -->'   // v43-6 — Approve / Deny right under the request, no scrolling on a phone
    + (rows.length ? '<div style="background:#f8fafc;border-radius:12px;padding:14px 16px;">' + rowsHtml + '</div>' : '')
    + (footer ? '<p style="margin:16px 0 0;color:#64748b;font-size:13px;text-align:center;font-weight:600;">' + footer + '</p>' : '')
    + '</div>'
    + '<div style="background:#f8faff;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0;">'
    + '<a href="' + APP_URL + '" style="display:inline-block;background:' + primary + ';color:white;text-decoration:none;font-weight:700;font-size:13px;padding:10px 22px;border-radius:20px;margin-bottom:10px;">🏦 Open Family Bank</a>'
    + '<p style="margin:0;font-size:12px;color:#94a3b8;">— <strong style="color:'+primary+';">' + bankName + '</strong></p>'
    + '</div></div></body></html>';
}

/**
 * Sunday reminder email — chore list for child
 */
function buildReminderEmailHtml(state, childName, data, totalPossible, choreRows) {
  var bankName  = getBankName(state);
  var primary   = getPrimary(state);
  var secondary = getSecondary(state);
  var darkPrimary = shadeColorGs(primary, -20);
  var checking  = (data.balances.checking || 0).toFixed(2);
  var savings   = (data.balances.savings  || 0).toFixed(2);
  var total     = ((data.balances.checking || 0) + (data.balances.savings || 0)).toFixed(2);

  var choresHtml = choreRows.map(function(r) {
    return '<div style="border:1.5px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;font-size:14px;">'
      + '<span style="font-weight:700;color:#1e293b;">' + r.label + '</span>'
      + '<span style="font-weight:800;color:' + secondary + ';">' + r.val + '</span>'
      + '</div>';
  }).join("");

  return '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body '
    + 'style="margin:0;padding:16px;background:#f1f5f9;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;font-size:15px;">'
    + '<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">'
    + '<div style="background:linear-gradient(135deg,'+primary+','+darkPrimary+');padding:30px;text-align:center;color:white;">'
    + '<h1 style="margin:0 0 6px;font-size:22px;font-weight:800;">🏦 ' + bankName + '</h1>'
    + '<p style="margin:0;font-size:14px;opacity:0.88;">Your chores this week, ' + childName + '!</p>'
    + '</div>'
    + '<div style="padding:24px 28px;">'
    + '<div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:2px solid #fde68a;border-radius:14px;padding:20px;text-align:center;margin-bottom:20px;">'
    + '<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#92400e;margin-bottom:6px;">You could earn this week</div>'
    + '<div style="font-size:40px;font-weight:900;color:#d97706;letter-spacing:-1px;">$' + totalPossible.toFixed(2) + '</div>'
    + '</div>'
    + choresHtml
    + '<div style="background:#f0f6ff;border-radius:12px;padding:16px;margin-top:16px;display:grid;grid-template-columns:1fr 1fr 1fr;text-align:center;gap:8px;">'
    + '<div><div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;">Checking</div><div style="font-size:18px;font-weight:800;color:'+primary+';">$'+checking+'</div></div>'
    + '<div><div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;">Savings</div><div style="font-size:18px;font-weight:800;color:'+secondary+';">$'+savings+'</div></div>'
    + '<div><div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;">Total</div><div style="font-size:18px;font-weight:800;color:#1e293b;">$'+total+'</div></div>'
    + '</div>'
    + '<p style="margin:16px 0 0;color:#64748b;font-size:13px;text-align:center;font-weight:600;">Log in to complete your chores and earn money! 💪</p>'
    + '</div>'
    + '<div style="background:#f8faff;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0;">'
    + '<a href="' + APP_URL + '" style="display:inline-block;background:' + primary + ';color:white;text-decoration:none;font-weight:700;font-size:13px;padding:10px 22px;border-radius:20px;margin-bottom:10px;">🏦 Open Family Bank</a>'
    + '<p style="margin:0;font-size:12px;color:#94a3b8;">— <strong style="color:'+primary+';">' + bankName + '</strong></p>'
    + '</div></div></body></html>';
}

function sendSimpleEmail(to, subject, htmlBody) {
  try { MailApp.sendEmail({to: to, subject: subject, htmlBody: htmlBody}); }
  catch(err) { Logger.log("sendSimpleEmail ERROR to " + to + ": " + err); }
}

// ================================================================
// [HELPERS]
// ================================================================
/** v39-1 — run fn() holding the script lock; null when the lock could not be taken in 20 s. */
function _withSaveLock(fn) {
  var lock = LockService.getScriptLock();
  var got = false;
  try { got = lock.tryLock(20000); } catch(e) { got = false; }
  if (!got) { Logger.log("_withSaveLock: lock not acquired"); return null; }
  try { return fn(); }
  finally { try { lock.releaseLock(); } catch(e) {} }
}

function loadState(familyId, opts) {
  // v38 row-per-family — read the matching row from Families!A:B.
  // Returns the parsed state object on hit, or
  // {status: "error", reason: "familyNotFound"} on miss
  // (per build doc §7 stable error shape; D5 stale-cache recovery).
  // v39-1 — opts.fresh: skip the 60 s cache and read the sheet (compare-and-set reads).
  if (!familyId) return _familyNotFoundShape();
  opts = opts || {};
  try {
    // v38 — per-familyId cache key. Same 60s TTL as v36.1.
    var cacheKey = "familyBankState:" + familyId;
    var cache    = CacheService.getScriptCache();
    var cached   = opts.fresh ? null : cache.get(cacheKey);
    if (cached) {
      if (DEBUG_LOGGING) Logger.log("loadState: cache hit for " + familyId);
      var sCached = JSON.parse(cached);
      if (sCached && sCached.pins) return postProcessState(sCached);
    }

    var ss     = SpreadsheetApp.getActiveSpreadsheet();
    var sheet  = ss.getSheetByName("Families");
    if (!sheet) {
      Logger.log("loadState: Families tab missing — bootstrapAdmin not run?");
      return _familyNotFoundShape();
    }
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return _familyNotFoundShape();

    // Bounded read (D6.2 convention).
    var rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    var raw  = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][0] === familyId) { raw = rows[i][1]; break; }
    }
    if (!raw) return _familyNotFoundShape();

    var s = JSON.parse(raw);
    if (DEBUG_LOGGING) Logger.log("loadState OK [" + familyId + "]: " + JSON.stringify(Object.keys(s)));

    // Cache for 60 seconds.
    try {
      var toCache = JSON.stringify(s);
      if (toCache.length < 100000) cache.put(cacheKey, toCache, 60);
    } catch(ce) {}

    return postProcessState(s);
  } catch(err) {
    Logger.log("loadState ERROR [" + familyId + "]: " + err);
    return _familyNotFoundShape();
  }
}

/** v38 — stable error shape returned by loadState/default-doGet on miss. */
function _familyNotFoundShape() {
  return {status: "error", reason: "familyNotFound"};
}

/** v38 — same shape as a JSON HTTP response, for direct return from routes. */
function _familyNotFoundResponse() {
  return ContentService
    .createTextOutput(JSON.stringify(_familyNotFoundShape()))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Post-process state after loading — migration and defaults */
function postProcessState(s) {
  if (!s.config)   s.config   = {};
  if (!s.children) s.children = {};
  if (!s.users)    s.users    = Object.keys(s.pins || {});
  if (!s.roles)    s.roles    = {};
  if (!s.config.emails)    s.config.emails    = {};
  if (!s.config.calendars) s.config.calendars = {};
  if (!s.config.notify)    s.config.notify    = {};
  if (!s.config.tabs)      s.config.tabs      = {};
  // Auto-migrate v1 flat structure → per-child
  if (s.balances) {
    var childName = getChildNames(s)[0] || DEFAULT_CHILD_NAME;
    if (!s.children[childName]) {
      s.children[childName] = {
        balances:    s.balances    || {checking: 0, savings: 0},
        rates:       s.rates       || {checking: 0, savings: 0},
        autoDeposit: s.autoDeposit || {checking: 0, savings: 0},
        chores:      s.chores      || []
      };
    }
    delete s.balances; delete s.rates; delete s.autoDeposit; delete s.chores;
    Logger.log("postProcessState: migrated v1 data");
  }
  return s;
}

function saveState(familyId, state) {
  // v38 row-per-family — write JSON.stringify(state) to col B of the row in
  // Families!A:B whose col A === familyId. Throws if no matching row exists
  // (Step 2.5 never creates new family rows; that's Step 3 adminApprove).
  // v36.1 photo-proof strip-before-save discipline is preserved at the doPost
  // call site (proofPhoto pulled off the body before the saveState call).
  if (!familyId) throw new Error("saveState: familyId is required (v38 row-per-family)");
  if (!state)    throw new Error("saveState: state is required");

  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var sheet  = ss.getSheetByName("Families");
  if (!sheet) throw new Error("saveState: Families tab missing — bootstrapAdmin not run?");
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("saveState: no family rows exist (familyId=" + familyId + ")");

  // Bounded read of col A only (D6.2). Locate the row by familyId.
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var rowIdx = -1;
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === familyId) { rowIdx = i + 2; break; }
  }
  if (rowIdx === -1) throw new Error("saveState: familyId not found (" + familyId + ")");

  // v39-1 — every write gets the next revision number; clients echo it back as _baseRev.
  state._rev = (parseInt(state._rev, 10) || 0) + 1;
  sheet.getRange(rowIdx, 2).setValue(JSON.stringify(state));
  SpreadsheetApp.flush();   // v39-18 — commit the write before the caller releases the lock (else the next save can read the old row)

  // Invalidate this family's cache so the next loadState gets fresh data.
  try { CacheService.getScriptCache().remove("familyBankState:" + familyId); } catch(e) {}
}

function getLedgerSheet() {
  // v38 — Ledger is provisioned by bootstrapAdmin (Step 2) with the 6-column
  // schema [Date, FamilyId, User, Child, Note, Amount]. This helper is now a
  // name-only lookup; throws if the tab is missing (forces bootstrap-first
  // discipline). Per build doc §4 Step 2.5 + Lath's handoff §1.
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Ledger");
  if (!sheet) {
    throw new Error("getLedgerSheet: Ledger tab missing — bootstrapAdmin not run?");
  }
  return sheet;
}

function getChildNames(state) {
  var u = state.users || [];
  var r = state.roles || {};
  return u.filter(function(x) { return r[x] === "child"; });
}

function getParentNames(state) {
  var u = state.users || [];
  var r = state.roles || {};
  return u.filter(function(x) { return r[x] === "parent"; });
}

function getParentName(state) {
  return getParentNames(state)[0] || DEFAULT_PARENT_NAME;
}

/**
 * getParentEmails(state, childName)
 * Returns emails for parents assigned to childName.
 * If no per-parent assignments configured, returns all parent emails (backwards compatible).
 * childName is optional.
 */
function getParentEmails(state, childName) {
  var emails = [];
  var parentAssignments = state && state.config && state.config.parentChildren;
  getParentNames(state).forEach(function(name) {
    if (childName && parentAssignments && parentAssignments[name]) {
      var assigned = parentAssignments[name];
      if (assigned.indexOf(childName) === -1) return;
    }
    var e = getEmailFor(state, name);
    if (e) emails.push(e);
  });
  if (!emails.length && FALLBACK_PARENT_EMAIL) emails.push(FALLBACK_PARENT_EMAIL);
  return emails;
}

function getEmailFor(state, username) {
  var emails = state && state.config && state.config.emails;
  if (emails && emails[username]) return emails[username];
  // Fallbacks
  if (state && state.roles && state.roles[username] === "parent") return FALLBACK_PARENT_EMAIL;
  if (state && state.roles && state.roles[username] === "child")  return FALLBACK_CHILD_EMAIL;
  return "";
}

function getBankName(state)  { return (state && state.config && state.config.bankName) || BANK_NAME; }
function getPrimary(state)   { return (state && state.config && state.config.colorPrimary)   || DEFAULT_COLOR_PRIMARY; }
function getSecondary(state) { return (state && state.config && state.config.colorSecondary) || DEFAULT_COLOR_SECONDARY; }
function getParentName(state){ return getParentNames(state)[0] || DEFAULT_PARENT_NAME; }

// v41-1 — the family's time zone (Admin → Time zone) as an IANA name. Older families store "GMT-6"-style
// labels; those map to their zone. No setting → the project's own time zone (_instanceTz).
var TZ_LEGACY = {
  "GMT-5":"America/New_York",  "GMT-6":"America/Chicago",
  "GMT-7":"America/Denver",    "GMT-8":"America/Los_Angeles",
  "GMT-4":"America/Halifax",   "GMT+0":"UTC",
  "GMT+1":"Europe/London",     "GMT+2":"Europe/Berlin"
};
// v41-3 — the zones the Admin list offers (keep in step with index.html #admin-timezone). Validation is by
// this list: Apps Script formats an unknown zone as GMT without an error, so "does it format" proves nothing.
var TZ_OK = ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "America/Halifax", "UTC", "Europe/London", "Europe/Berlin"];
function _normTz(v) {
  v = String(v || "").trim();
  if (TZ_LEGACY[v]) return TZ_LEGACY[v];
  if (TZ_OK.indexOf(v) !== -1 || v === _instanceTz()) return v;
  return "";
}
/** v41-1 — the Apps Script project's time zone (Project Settings → Time zone): clock triggers + fallback. */
function _instanceTz() {
  try { var z = Session.getScriptTimeZone(); if (z) return z; } catch(e) {}
  return "America/Chicago";
}
function getTimezone(state) {
  return _normTz(state && state.config && state.config.timezone) || _instanceTz();
}

function shadeColorGs(hex, pct) {
  try {
    var n = parseInt((hex || "#2563eb").replace("#",""), 16);
    var r = Math.max(0, Math.min(255, (n >> 16)         + Math.round(2.55 * pct)));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + Math.round(2.55 * pct)));
    var b = Math.max(0, Math.min(255, (n & 0xff)        + Math.round(2.55 * pct)));
    return "#" + [r,g,b].map(function(x) { return x.toString(16).padStart(2,"0"); }).join("");
  } catch(e) { return "#1d4ed8"; }
}

function isDayInterval(today, anchorStr, days) {
  try {
    var anchor = new Date(anchorStr);
    if (isNaN(anchor.getTime())) return false;
    var diff = Math.floor((today.getTime() - anchor.getTime()) / (24*60*60*1000));
    return diff > 0 && diff % days === 0;
  } catch(e) { return false; }
}

function todayDateStr(state) {   // v41-1 — the family's day (was the per-file BANK_TIMEZONE)
  return Utilities.formatDate(new Date(), getTimezone(state), "yyyy-MM-dd");
}

/** v44-5 (#5) — what the latest approval paid: its Chk and Sav rows share one save (same timestamp). */
function _lastChoreEarned(familyId, childName, choreName) {
  if (!familyId) return 0;
  var data = getLedgerSheet().getDataRange().getValues(), sum = 0, stamp = null;
  for (var i = data.length - 1; i >= 1; i--) {
    var row = data[i];
    if (String(row[1]) !== familyId) continue;
    var child = String(row[3] || ""), note = String(row[4] || "");
    if (!(child === childName || !child) || note.indexOf("Chore:") !== 0) continue;
    var base = note.replace(/Chore: | \(Chk\)| \(Sav\)| \(late, no reward\)/g, "");
    if (base !== choreName || (stamp !== null && String(row[0]) !== stamp)) break;
    stamp = String(row[0]); sum += Math.abs(parseFloat(row[5]) || 0);
  }
  return sum;
}
function getLastChoreEntry(familyId, childName) {
  // v38 6-column Ledger: [Date, FamilyId, User, Child, Note, Amount].
  if (!familyId) return null;
  var data = getLedgerSheet().getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    var row    = data[i];
    if (String(row[1]) !== familyId) continue;
    var note   = String(row[4] || "");
    var child  = String(row[3] || "");
    if ((child === childName || !child) && note.indexOf("Chore:") === 0) return row;
  }
  return null;
}

function calcYTDInterest(familyId, childName) {
  // v38 6-column Ledger: [Date, FamilyId, User, Child, Note, Amount].
  if (!familyId) return 0;
  try {
    var data  = getLedgerSheet().getDataRange().getValues();
    var year  = new Date().getFullYear();
    var total = 0;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]) !== familyId) continue;
      var child = String(data[i][3] || "");
      var note  = String(data[i][4] || "").toLowerCase();
      var amt   = parseFloat(data[i][5]) || 0;
      var rowYear = 0;
      try { rowYear = new Date(data[i][0]).getFullYear(); } catch(e) {}
      if ((child === childName || !child) && note.indexOf("interest") !== -1 && rowYear === year) {
        total += amt;
      }
    }
    return total;
  } catch(e) { return 0; }
}

// ================================================================
// [DEFAULT STATE] — Used only when Sheet1 A1 is blank
// ================================================================
function buildDefaultState() {
  var defaultState = {
    config: {
      bankName:       BANK_NAME,
      tagline:        BANK_TAGLINE,
      colorPrimary:   DEFAULT_COLOR_PRIMARY,
      colorSecondary: DEFAULT_COLOR_SECONDARY,
      imgBanner:  "images/banner.png",
      imgLogo:    "images/logo.png",
      imgIcon:    "images/icon.png",
      timezone:   _instanceTz(),   // v41-1 — a new family starts in the project's zone; Admin → Time zone changes it
      adminPin:   DEFAULT_ADMIN_PIN,
      emails: {}
    },
    pins:  {},
    roles: {},
    users: [DEFAULT_PARENT_NAME, DEFAULT_CHILD_NAME],
    children: {}
  };

  // Set up default parent
  defaultState.pins[DEFAULT_PARENT_NAME]  = DEFAULT_PARENT_PIN;
  defaultState.roles[DEFAULT_PARENT_NAME] = "parent";
  defaultState.config.emails[DEFAULT_PARENT_NAME] = FALLBACK_PARENT_EMAIL;

  // Set up default child
  defaultState.pins[DEFAULT_CHILD_NAME]  = DEFAULT_CHILD_PIN;
  defaultState.roles[DEFAULT_CHILD_NAME] = "child";
  defaultState.config.emails[DEFAULT_CHILD_NAME] = FALLBACK_CHILD_EMAIL;
  defaultState.children[DEFAULT_CHILD_NAME] = {
    balances:    {checking: DEFAULT_CHECKING_BALANCE, savings: DEFAULT_SAVINGS_BALANCE},
    rates:       {checking: DEFAULT_CHECKING_RATE,    savings: DEFAULT_SAVINGS_RATE},
    autoDeposit: {checking: DEFAULT_ALLOWANCE_CHECKING, savings: DEFAULT_ALLOWANCE_SAVINGS},
    chores: []
  };

  return defaultState;
}

// ================================================================
// [GOOGLE CALENDAR] — Per-child chore calendar integration
//
// SETUP (do this once per child in Google Calendar):
//   1. Create a new calendar named "[Child]'s Chores"
//   2. Share it with the child's email — "See all event details"
//   3. Go to calendar Settings → find Calendar ID
//      (looks like abc123@group.calendar.google.com)
//   4. Paste that ID into the Family Bank Admin panel
//      under the child's Calendar ID field
//   5. Save settings — all future chore events will sync automatically
//
// HOW IT WORKS:
//   Chore Created  → creates a calendar event (recurring if repeating)
//   Chore Edited   → updates the existing event
//   Chore Deleted  → removes the event
//   Chore Approved → removes the event (chore is done)
//   Chore Denied   → leaves the event (child needs to try again)
// ================================================================

/**
 * ════════════════════════════════════════════════════════════════════
 * v30 CALENDAR MODULE — STABLE PER-DAY SERIES
 * ════════════════════════════════════════════════════════════════════
 *
 * Each chore creates ONE event series per scheduled day-of-week. Each
 * series is anchored to its first instance and identified by a tag
 * embedded in its description: CHORE_ID:<id>:DAY:<n>
 *
 * This means:
 *   • Bi-weekly anchors are stable (no drift between parents)
 *   • Each day can have its own reminder time (chore.dayTimes[day])
 *   • Edits/deletes find events by tag — no reliance on title or
 *     stored event IDs (which were brittle in v29).
 *
 * Scan window is tightened to roughly the past month + next year, vs.
 * v29's 3-year window — ~12× faster on every chore mutation.
 */

/** Per-day reminder hour with fallback to single chore.reminderHour. */
function getReminderHourForDay(chore, dayNum) {
  if (chore.dayTimes && chore.dayTimes[dayNum] !== undefined) {
    return parseInt(chore.dayTimes[dayNum]) || 8;
  }
  if (chore.dayTimes && chore.dayTimes[String(dayNum)] !== undefined) {
    return parseInt(chore.dayTimes[String(dayNum)]) || 8;
  }
  return parseInt(chore.reminderHour) || 8;
}

/** Build the calendar event title shown to the user. */
// ── v40-1 — due-date rules, server-side (mirror of app.js isScheduledOn / isDueOn) ────────────
// ymd = "YYYY-MM-DD" in the family's day; Dates are built in the script time zone, like the app
// builds them in the device's. Keep these byte-for-byte in step with app.js — reschedule.js S1 checks.
/** v41-3 — the calendar day before a "YYYY-MM-DD" (pure date arithmetic, no time zone involved). */
function _ymdMinusDay(ymd) {
  var p = String(ymd).split("-").map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2] - 1));
  return d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + d.getUTCDate()).slice(-2);
}
function _ymdParts(ymd) { var p = String(ymd || "").split("-"); return [parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)]; }
function _dateIn(list, ymd) { return Array.isArray(list) && list.indexOf(ymd) !== -1; }
function _choreScheduledOn(chore, ymd) {
  var p = _ymdParts(ymd), nowT = new Date();
  var now = new Date(p[0], p[1], p[2], nowT.getHours(), nowT.getMinutes(), nowT.getSeconds(), nowT.getMilliseconds());
  if (chore.schedule === "daily") return true;
  if (chore.schedule === "once") {
    if (!chore.onceDate) return true;
    if (chore.onceDate < ymd) return false;
    if (chore.onceDueOn) return chore.onceDate === ymd;
    return true;
  }
  if (chore.schedule === "weekly") {
    var days = chore.weekdays || (chore.weekday !== undefined ? [chore.weekday] : [now.getDay()]);
    return days.indexOf(now.getDay()) !== -1;
  }
  if (chore.schedule === "biweekly") {
    var days2 = chore.weekdays || (chore.weekday !== undefined ? [chore.weekday] : [now.getDay()]);
    if (days2.indexOf(now.getDay()) === -1) return false;
    // v42-1 — whole days since the creation DAY (was elapsed time: on the creation weekday the week flipped
    // with the time of day). Mirror of app.js isScheduledOn.
    var created = new Date(chore.createdAt || Date.now()); if (isNaN(created.getTime())) created = new Date();
    var dayDiff = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(created.getFullYear(), created.getMonth(), created.getDate())) / 86400000);
    var weeksDiff = Math.floor(dayDiff / 7);
    var offset = chore.skipFirstWeek ? 1 : 0;
    return (((weeksDiff + offset) % 2) + 2) % 2 === 0;
  }
  if (chore.schedule === "monthly") {
    var target = resolveMonthlyDayGs(chore.monthlyDay || "1", now.getFullYear(), now.getMonth());
    return now.getDate() === target;
  }
  return false;
}
/** Is the chore due on this day, one-off changes included? (status / lastCompleted aside) */
function _choreDueOn(chore, ymd) {
  if (!chore || chore.calendarDeleted) return false;   // v44-4 — mirror of app.js isDueOn
  if (chore.schedule === "once") {
    if (chore.notBefore && ymd < chore.notBefore) return false;
    return _choreScheduledOn(chore, ymd);
  }
  if (_dateIn(chore.extraDates, ymd)) return true;
  if (_dateIn(chore.skipDates, ymd)) return false;
  if (chore.homeOnly && !_homeNightOk(chore, ymd)) return false;   // v45-1 — only on a night the child is here
  return _choreScheduledOn(chore, ymd);
}
/** v45-1 — "days with me": does the child sleep at this home on the night of ymd? The tick's reading of the
 *  🏠 events (chore.homeNights) wins inside its window; else the 2-week pattern; no pattern → every night.
 *  Mirror of app.js _homeNightOk. */
function _homeNightOk(chore, ymd) {
  var hn = chore && chore.homeNights;
  if (hn && hn.from && hn.to && ymd >= hn.from && ymd <= hn.to) return (hn.days || []).indexOf(ymd) !== -1;
  var p = chore && chore.homePattern;
  if (!p || !p.anchor || !p.nights || p.nights.length !== 14) return true;
  return !!p.nights[((_ymdDiff(ymd, p.anchor) % 14) + 14) % 14];
}
var HOME_SYNC_DAYS = 14, HOME_WRITES_PER_TICK = 12;
/** v45-1 — the nights (YYYY-MM-DD) in [from, to] covered at 11:59 PM by one of the home events [{s, e}]. */
function _homeNightsFromEvents(evs, from, to) {
  var out = [];
  for (var d = from; d <= to; d = _ymdPlus(d, 1)) {
    var p = _ymdToDate(d); p.setHours(23, 59, 0, 0); var t = p.getTime();
    if (evs.some(function(x) { return x.s <= t && t < x.e; })) out.push(d);
  }
  return out;
}
function _homeTag(child) { return "HOME:" + child; }
/** v45-3 (#4) — the tag is a whole line ("HOME:Ann" is not "HOME:Anna"), like CHORE_ID's whole-id rule. */
function _hasHomeTag(desc, child) { return String(desc || "").split(/\r?\n/).some(function(l) { return l.trim() === _homeTag(child); }); }
function _isHomeEvent(desc, title, child, cfg) {
  return _hasHomeTag(desc, child) || !!(cfg && cfg.title && String(title || "") === cfg.title);
}
function _evTitle(ev, cache) {   // v45-3 (#5) — one title read per event id (occurrences share it)
  var id = null; try { id = ev.getId(); } catch(e) {}
  if (id && cache && cache[id] !== undefined) return cache[id];
  var t = ""; try { t = ev.getTitle() || ""; } catch(e) {}
  if (id && cache) cache[id] = t;
  return t;
}
/** v45-1 — "Home Time Set": drop the app's 🏠 events for the child (tagged; hand-made ones are left) and
 *  make one every-2-weeks series per run of nights in the pattern. */
function _rebuildHomeEvents(calendarId, state, child) {
  var cal = CalendarApp.getCalendarById(calendarId); if (!cal) return false;
  var today = todayDateStr(state), seen = {};
  cal.getEvents(_ymdToDate(_ymdPlus(today, -14)), _ymdToDate(_ymdPlus(today, 400))).forEach(function(ev) {
    try {
      var id = ev.getId(); if (seen[id]) return; seen[id] = true;
      if (!_hasHomeTag(ev.getDescription(), child)) return;   // v45-3 (#4)
      if (ev.isRecurringEvent && ev.isRecurringEvent()) ev.getEventSeries().deleteEventSeries(); else ev.deleteEvent();
    } catch(e) { Logger.log("home events: delete failed — " + e); }
  });
  var cfg = state.config && state.config.homeTime && state.config.homeTime[child];
  if (!cfg || !cfg.anchor || !cfg.nights || cfg.nights.length !== 14) return true;
  var n = cfg.nights.map(function(x) { return !!x; }), made = 0;
  var desc = _homeTag(child) + "\n🏠 " + child + " sleeps at this home these nights (Family Bank). Move or stretch this event to swap a night — chores marked \"only when here\" follow it.";
  var allOn = n.every(function(x) { return x; });
  for (var i = 0; i < 14; i++) {
    if (!n[i] || (!allOn && n[(i + 13) % 14])) continue;   // a run starts here
    if (allOn && i > 0) break;
    var len = 0; while (len < 14 && n[(i + len) % 14]) len++;
    // the latest start on or before today whose run is not over yet, else the next one
    var off = ((_ymdDiff(today, cfg.anchor) - i) % 14 + 14) % 14, start = _ymdPlus(today, -off);
    if (_ymdPlus(start, len - 1) < today) start = _ymdPlus(start, 14);
    var s = _ymdToDate(start); s.setHours(18, 0, 0, 0);
    var e = _ymdToDate(_ymdPlus(start, len)); e.setHours(8, 0, 0, 0);
    var WDS = [CalendarApp.Weekday.SUNDAY, CalendarApp.Weekday.MONDAY, CalendarApp.Weekday.TUESDAY, CalendarApp.Weekday.WEDNESDAY, CalendarApp.Weekday.THURSDAY, CalendarApp.Weekday.FRIDAY, CalendarApp.Weekday.SATURDAY];
    var rec = _newRec();
    if (allOn) { s = _ymdToDate(today); s.setHours(18, 0, 0, 0); e = _ymdToDate(_ymdPlus(today, 1)); e.setHours(8, 0, 0, 0); rec.addDailyRule(); }   // v45-3 (#8) — every night: a daily 6 PM → 8 AM
    else rec.addWeeklyRule().interval(2).onlyOnWeekday(WDS[s.getDay()]);   // the run's first night, every 2 weeks
    cal.createEventSeries(cfg.title || ("🏠 " + child), s, e, rec, {description: desc});
    made++;
  }
  Logger.log("home events: " + child + " — " + made + " series");
  return true;
}
/** The hour (0–23) the chore is DUE on this day: a one-day override (dayOverrides, from a calendar move
 *  or a reschedule), else the chore's dueHour (wizard, v40+), else 20 (8 PM) — v40-10: a chore made
 *  before v40 has no dueHour; its old reminderHour was a calendar time nobody chose as a deadline. */
var DEFAULT_DUE_HOUR = 20;
function _choreDueHour(chore, ymd) {
  if (chore.dayOverrides && chore.dayOverrides[ymd] !== undefined) { var o = parseInt(chore.dayOverrides[ymd], 10); if (!isNaN(o)) return o; }
  var h = parseInt(chore.dueHour, 10);
  return isNaN(h) ? DEFAULT_DUE_HOUR : h;
}
/** v40-12 — the hour the CALENDAR shows the chore on this day: a one-day override, else the weekday's
 *  time (dayTimes, legacy — no UI since v38), else reminderHour (= dueHour for chores made in v40+). */
function _choreCalHour(chore, ymd) {
  if (chore.calOverrides && chore.calOverrides[ymd] !== undefined) { var o = parseInt(chore.calOverrides[ymd], 10); if (!isNaN(o)) return o; }   // v42-3 (M2)
  return _choreBaseCalHour(chore, ymd);
}
/** v42-3 (L5) — the hour the series puts a day at: per weekday for weekly/biweekly, reminderHour otherwise (as built). */
function _choreBaseCalHour(chore, ymd) {
  if (chore.schedule === "weekly" || chore.schedule === "biweekly") { var p = _ymdParts(ymd); return getReminderHourForDay(chore, new Date(p[0], p[1], p[2]).getDay()); }
  return parseInt(chore.reminderHour, 10) || 8;
}
/** v40-10 (H2) — can the chore be MISSED on this day? Like _choreDueOn, except a one-time chore only on
 *  its "on" date: an undated or "by <date>" one is open every day and is never recorded missed. */
function _choreMissableOn(chore, ymd) {
  if (!chore) return false;
  if (chore.schedule === "once") return !!(chore.onceDueOn && chore.onceDate === ymd);
  return _choreDueOn(chore, ymd);
}
/** v40-10 (H3) — done on this day: approved that day, or submitted for it (doneDates). */
function _choreDoneOn(chore, ymd) { return chore.lastCompleted === ymd || _dateIn(chore.doneDates, ymd); }

function buildEventTitle(chore) {
  return "🏦 " + chore.name + " — Earn $" + (parseFloat(chore.amount) || 0).toFixed(2);
}

/** Build the description, embedding CHORE_ID + (optional) DAY tag for lookup. */
function buildEventDescription(chore, dayNum) {
  var split = chore.childChooses
    ? "You choose your own split"
    : (chore.splitChk || 100) + "% Checking / " + (100 - (chore.splitChk || 100)) + "% Savings";
  var tag = "CHORE_ID:" + (chore.id || "");
  if (dayNum !== undefined && dayNum !== null) tag += ":DAY:" + dayNum;
  var lines = [
    "💰 Reward: $" + (parseFloat(chore.amount) || 0).toFixed(2),
    "💵 Payout: " + split,
    "📅 Schedule: " + ({once:"One-time",daily:"Daily",weekly:"Weekly",biweekly:"Bi-weekly",monthly:"Monthly"}[chore.schedule] || chore.schedule),
    "",
    chore.desc ? "📝 " + chore.desc : "",
    "",
    "🏦 Mark complete in the Family Bank app:",
    APP_URL,
    "",
    tag
  ];
  return lines.filter(function(l){ return l !== undefined && l !== null; }).join("\n");
}

/** Resolve "last", "last-1", "last-2" to actual day numbers in a given month. */
function resolveMonthlyDayGs(monthlyDay, year, month) {
  var dim = new Date(year, month + 1, 0).getDate();
  if (monthlyDay === "last")   return dim;
  if (monthlyDay === "last-1") return dim - 1;
  if (monthlyDay === "last-2") return dim - 2;
  return parseInt(monthlyDay) || 1;
}

/** Return the calendar ID for a child, or null if unset. */
function getCalendarId(state, childName) {
  var cals = state && state.config && state.config.calendars;
  return (cals && cals[childName]) ? String(cals[childName]).trim() : null;
}

/**
 * Main router — called from doPost after every chore mutation.
 * Routes to delete + create in the right combination for the action.
 */
function syncCalendarEvent(state, lastAction, activeChild, hints) {
  try {
    if (!activeChild) return;
    hints = hints || {};   // v39-2 — doPost passes the transient ids here; email-link callers still set them on state
    var h = function(k) { return hints[k] || state[k] || null; };
    if (!notifyCalendar(state, activeChild)) {
      if (DEBUG_LOGGING) Logger.log("syncCalendarEvent: calendar OFF for " + activeChild);
      return;
    }
    var calendarId = getCalendarId(state, activeChild);
    if (!calendarId) {
      Logger.log("syncCalendarEvent: no Calendar ID for " + activeChild);
      return;
    }
    var data = state.children && state.children[activeChild];
    if (!data) return;
    _calBusy(calendarId, 300);   // v42 — the 15-minute diff leaves this calendar alone while it is being written
    var chores = data.chores || [];
    var tz     = getTimezone(state);

    if (lastAction === "Chore Created") {
      var newChore = chores[chores.length - 1];
      if (newChore) {
        _calPropDel(_calBuiltKey(calendarId, newChore.id));   // v44-5 (#2) — a rebuild cut off midway is a first look, not a delete
        deleteEventsByChoreId(calendarId, newChore.id);  // safety
        createEventsForChore(calendarId, newChore, tz);
        Logger.log("syncCalendarEvent: created event(s) for '" + newChore.name + "'");
      }

    } else if (lastAction === "Chore Edited") {
      var editedId = h("_editedChoreId");
      chores.forEach(function(chore) {
        if (!editedId || chore.id === editedId) {
          _calPropDel(_calBuiltKey(calendarId, chore.id));   // v44-5 (#2)
          deleteEventsByChoreId(calendarId, chore.id);
          createEventsForChore(calendarId, chore, tz);
        }
      });
      Logger.log("syncCalendarEvent: rebuilt event(s) for choreId=" + (editedId || "ALL"));

    } else if (lastAction === "Home Time Set") {   // v45-1 — the 🏠 events, then that child's "only when here" chores
      _rebuildHomeEvents(calendarId, state, activeChild);
      var wasHome = h("_editedChoreIds") || [];   // v45-3 (#12) — chores that just stopped being home-only get their series back
      chores.forEach(function(chore) {
        if (!chore.homeOnly && wasHome.indexOf(chore.id) === -1) return;
        _calPropDel(_calBuiltKey(calendarId, chore.id));
        deleteEventsByChoreId(calendarId, chore.id);
        createEventsForChore(calendarId, chore, tz);
      });

    } else if (lastAction === "Chores Rescheduled") {   // v39-15 — rebuild just the moved chores
      var movedIds = h("_editedChoreIds") || [];
      chores.forEach(function(chore) {
        if (movedIds.indexOf(chore.id) === -1) return;
        _calPropDel(_calBuiltKey(calendarId, chore.id));   // v44-5 (#2)
        deleteEventsByChoreId(calendarId, chore.id);
        createEventsForChore(calendarId, chore, tz);
      });
      Logger.log("syncCalendarEvent: rescheduled " + movedIds.length + " chore(s)");

    } else if (lastAction === "Chore Deleted") {
      if (h("_deletedChoreId")) {
        _clearCalBuilt(calendarId, h("_deletedChoreId"));   // v42-3 (L6)
        deleteEventsByChoreId(calendarId, h("_deletedChoreId"));
        Logger.log("syncCalendarEvent: deleted event(s) for choreId=" + h("_deletedChoreId"));
      }

    } else if (String(lastAction).indexOf("Chore Approved") === 0) {   // v39-2 — "Chore Approved (Quick)" too
      if (h("_approvedChoreSchedule") === "once" && h("_approvedChoreId")) {
        deleteEventsByChoreId(calendarId, h("_approvedChoreId"));
        Logger.log("syncCalendarEvent: removed one-time event choreId=" + h("_approvedChoreId"));
      } else if (h("_submittedChoreId") && h("_submittedFor")) {   // v44-2 — auto-approved: submit + approve in one save, so the day comes off here
        var calA = CalendarApp.getCalendarById(calendarId);
        if (calA) _deleteOccurrence(calA, h("_submittedChoreId"), h("_submittedFor"), "auto-approved");
      }

    } else if (lastAction === "Chore Submitted") {   // v40-3 — done for the day: that day's occurrence comes off
      if (h("_submittedChoreId") && h("_submittedFor")) {
        var cal1 = CalendarApp.getCalendarById(calendarId);
        if (cal1) _deleteOccurrence(cal1, h("_submittedChoreId"), h("_submittedFor"), "submitted");
      }

    } else if (String(lastAction).indexOf("Chore Denied") === 0) {   // v40-3 — "Chore Denied (Quick)" too: the day comes back
      var dChore = null; chores.forEach(function(c) { if (c && c.id === h("_deniedChoreId")) dChore = c; });
      if (dChore && h("_deniedFor")) {
        var cal2 = CalendarApp.getCalendarById(calendarId);
        if (cal2) _recreateOccurrence(cal2, dChore, h("_deniedFor"), tz);
      }
    }

    Logger.log("syncCalendarEvent: " + lastAction + " complete for " + activeChild);
  } catch(err) { Logger.log("syncCalendarEvent ERROR: " + err); }
  try { var cidB = getCalendarId(state, activeChild); if (cidB) _calBusy(cidB, 60); } catch(e) {}   // v42-3 — a minute to settle, then it expires
}

/** v39-14 — does an event description carry this chore's tag? The id must end at ":", a line
 *  break, a space or the end ("CHORE_ID:x_1" must not match "CHORE_ID:x_10"). */
function _descHasChore(desc, choreId) {
  if (!choreId) return false;
  var d = String(desc || "");
  var tag = "CHORE_ID:" + choreId;
  var i = d.indexOf(tag);
  while (i !== -1) {
    var next = d.charAt(i + tag.length);
    if (next === "" || next === ":" || next === "\n" || next === "\r" || next === " ") return true;
    i = d.indexOf(tag, i + 1);
  }
  return false;
}

/**
 * v39-16 — ?action=version → {codeVersion} — what this /exec URL is running. No familyId, no family
 * data. (An older server answers familyNotFound.)
 */
function _routeVersion() {
  return ContentService.createTextOutput(JSON.stringify({codeVersion: CODE_VERSION}))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * v39-3 — ?action=checkCalendar&familyId=&child=&choreId= → which calendar events exist for a chore.
 * Shapes: {noCalendar:true} | {calendarOff:true} | {events:[{title,start,series}]} | the familyNotFound error.
 */
function _routeCheckCalendar(params) {
  var familyId = params.familyId || "";
  var child    = params.child || "";
  var choreId  = params.choreId || "";
  var out = function(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); };
  if (!familyId) return _familyNotFoundResponse();
  try {
    var state = loadState(familyId);
    if (!state || state.status === "error") return out(state || _familyNotFoundShape());
    if (!child || !(state.children && state.children[child])) return out({status: "error", reason: "childNotFound"});
    if (!notifyCalendar(state, child)) return out({calendarOff: true});
    var calendarId = getCalendarId(state, child);
    if (!calendarId) return out({noCalendar: true});
    var cal = CalendarApp.getCalendarById(calendarId);
    if (!cal) return out({noCalendar: true});
    var now   = new Date();
    var start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var end   = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    // v39-15 — &days=N: every occurrence from today through today+N (no series folding), for checks
    var days = parseInt(params.days, 10);
    if (days >= 1 && days <= 62) {
      var tzc = getTimezone(state);
      var from0 = new Date(); from0.setHours(0, 0, 0, 0);
      var to0 = new Date(from0.getTime() + (days + 1) * 86400000 - 1);
      var occ = [];
      cal.getEvents(from0, to0).forEach(function(ev) {
        try {
          if (!_descHasChore(ev.getDescription(), choreId)) return;
          occ.push({date: Utilities.formatDate(ev.getStartTime(), tzc, "yyyy-MM-dd"), time: Utilities.formatDate(ev.getStartTime(), tzc, "HH:mm"), title: ev.getTitle(), series: ev.isRecurringEvent()});
        } catch(e) {}
      });
      occ.sort(function(a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
      return out({occurrences: occ});
    }
    var seen = {}, descs = {};
    var events = [];
    cal.getEvents(start, end).forEach(function(ev) {
      try {
        if (!_descHasChore(_evDesc(ev, descs), choreId)) return;   // v39-14; v42-7 — one read per series
        var key = ev.isRecurringEvent() ? "series:" + ev.getEventSeries().getId() : "event:" + ev.getId();
        if (seen[key]) return;
        seen[key] = true;
        events.push({title: ev.getTitle(), start: ev.getStartTime().toISOString(), series: ev.isRecurringEvent()});
      } catch(e) {}
    });
    return out({events: events});
  } catch(err) {
    Logger.log("_routeCheckCalendar ERROR: " + err);
    return out({error: err.toString()});
  }
}

/**
 * Delete all events whose description contains "CHORE_ID:<choreId>".
 * Searches a tight window: 1 month ago to 1 year ahead. Recurring event
 * series are matched and deleted as series (deleteEventSeries).
 */
/** v42-7 — an event's description, read once per event id (all occurrences of a series share it). */
function _evDesc(ev, cache) {
  var id = null;
  try { id = ev.getId(); } catch(e) {}
  if (id && cache && cache[id] !== undefined) return cache[id];
  var d = ev.getDescription() || "";
  if (id && cache) cache[id] = d;
  return d;
}
function deleteEventsByChoreId(calendarId, choreId) {
  try {
    if (!choreId) return;
    var cal = CalendarApp.getCalendarById(calendarId);
    if (!cal) return;

    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);   // v42-7 — a week back (was the 1st of last month)
    var end   = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    var events = cal.getEvents(start, end);

    // v42-7 — ONE look per event: occurrences of a series share getId(), so each series is read (and
    // deleted) once; reading every occurrence's description hit Calendar's rate limit on a daily series.
    var seen = {}, descs = {};
    var deletedSeries = 0;
    var deletedSingle = 0;
    events.forEach(function(ev) {
      try {
        var eid = ev.getId();
        if (seen[eid]) return;
        seen[eid] = true;
        if (!_descHasChore(_evDesc(ev, descs), choreId)) return;   // v39-14 — whole id, not a prefix
        if (ev.isRecurringEvent()) {
          ev.getEventSeries().deleteEventSeries();
          deletedSeries++;
        } else {
          ev.deleteEvent();
          deletedSingle++;
        }
      } catch(e) { Logger.log("deleteEventsByChoreId: skip event — " + e); }
    });

    Logger.log("deleteEventsByChoreId: " + deletedSeries + " series + " + deletedSingle + " single event(s) for choreId=" + choreId);
  } catch(err) { Logger.log("deleteEventsByChoreId ERROR: " + err); }
}

/**
 * Create all events for a chore based on its schedule.
 *   • once    → single event on chore.onceDate
 *   • daily   → one daily-recurring series
 *   • weekly  → one weekly series PER selected day-of-week (each independent)
 *   • biweekly→ one bi-weekly series PER selected day-of-week (each anchored
 *               to its first occurrence — no drift)
 *   • monthly → one monthly series on the resolved day-of-month
 *
 * For weekly/biweekly multi-day chores, each day's series uses its own
 * reminder hour from chore.dayTimes[day] (falling back to chore.reminderHour).
 * v40: this is the CALENDAR time only; the DUE time is chore.dueHour (_choreDueHour),
 * 8 PM when absent (chores made before v40). dayTimes is legacy (no UI since v38).
 */
/** v39-15 — base events for the chore's schedule, then its one-off changes (skip / extra days). */
function createEventsForChore(calendarId, chore, tz) {
  var ok = _createBaseEventsForChore(calendarId, chore, tz) === true;
  if (ok) _setCalBuilt(calendarId, chore && chore.id);   // v42 — the diff starts the day after a SUCCESSFUL (re)build (v42-3 H2)
  else if (calendarId && chore && chore.id) {   // v42-4 — a failed build is retried as a first look; v42-5 (R5) — at most hourly
    _clearCalBuilt(calendarId, chore.id);
    _calPropSet("fbCalFail:" + calendarId + ":" + chore.id, Date.now());
  }
  try {
    if (!chore || !chore.id) return ok;   // v40-10 (L1) — once chores too (a submitted once chore's deleted event must not come back)
    var hasAny = ["skipDates", "extraDates", "doneDates", "missedDates"].some(function(k) { return chore[k] && chore[k].length; })
      || !!(chore.calOverrides && Object.keys(chore.calOverrides).length);   // v40-3 — done/missed marks too; v42 — moved hours
    if (!hasAny || chore.homeOnly) return ok;   // v45-1 — a home chore's singles already follow skip / extra / done days
    var cal = CalendarApp.getCalendarById(calendarId);
    if (cal) _applyOneOffDates(cal, chore);
  } catch(err) {
    Logger.log("createEventsForChore one-offs ERROR for '" + (chore && chore.name || "?") + "': " + err);
  }
  return ok;
}

/** "YYYY-MM-DD" → local midnight Date (null when malformed). */
function _ymdLocal(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }   // v40-3
function _ymdToDate(ymd) {
  var p = String(ymd || "").split("-");
  if (p.length !== 3) return null;
  var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  return isNaN(d.getTime()) ? null : d;
}

/** v39-15 — skip days lose that day's occurrence of the chore's series; extra days get a single
 *  event at that weekday's reminder hour. Past days are ignored; skips only within ~2 months. */
/** v40-3 — remove the chore's occurrence(s) on one day: a series instance (the series goes on) or a single event. */
function _deleteOccurrence(cal, choreId, ymd, why) {
  var n = 0;
  _occurrencesOn(cal, choreId, ymd).forEach(function(ev) {
    try { ev.deleteEvent(); n++; } catch(e) { Logger.log("occurrence: delete " + ymd + " failed — " + e); }
  });
  if (n) Logger.log("occurrence: " + (why || "removed") + " " + ymd + " for choreId=" + choreId + " (" + n + ")");
  return n;
}
/** v40-3 — put a day's occurrence back (after a denial): a single event at the due hour, today or later only, never twice. */
function _recreateOccurrence(cal, chore, ymd, tz) {
  var today = Utilities.formatDate(new Date(), tz || Session.getScriptTimeZone(), "yyyy-MM-dd");
  if (!ymd || ymd < today) return false;
  if (chore.schedule === "once" && chore.onceDate !== ymd) return false;   // v40-10 (L2) — a once chore's event lives on its own date only
  if (_occurrencesOn(cal, chore.id, ymd).length) return false;
  var d = _ymdToDate(ymd); if (!d) return false;
  var hour  = _choreCalHour(chore, ymd);   // v40-12 (N5) — where the calendar shows it, not the due hour
  var start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0);
  cal.createEvent(buildEventTitle(chore), start, new Date(start.getTime() + 30 * 60 * 1000), {description: buildEventDescription(chore, d.getDay())});
  Logger.log("occurrence: back " + ymd + " for '" + chore.name + "' (denied)");
  return true;
}

function _applyOneOffDates(cal, chore) {
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var horizon = new Date(today.getTime() + 62 * 86400000);
  (chore.skipDates || []).forEach(function(ymd) {
    var d = _ymdToDate(ymd);
    if (!d || d < today || d > horizon) return;
    var dayEnd = new Date(d.getTime() + 86400000 - 1);
    cal.getEvents(d, dayEnd).forEach(function(ev) {
      try {
        if (ev.isRecurringEvent() && _descHasChore(ev.getDescription(), chore.id)) {
          ev.deleteEvent();   // this occurrence only; the series goes on
          Logger.log("one-offs: skipped " + ymd + " for '" + chore.name + "'");
        }
      } catch(e) { Logger.log("one-offs: skip " + ymd + " failed — " + e); }
    });
  });
  (chore.extraDates || []).forEach(function(ymd) {
    var d = _ymdToDate(ymd);
    if (!d || d < today) return;
    var hour  = _choreCalHour(chore, ymd);   // v42-1 — incl. a moved hour (dayOverrides)
    var start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0);
    var end   = new Date(start.getTime() + 30 * 60 * 1000);
    cal.createEvent(buildEventTitle(chore), start, end, {description: buildEventDescription(chore, d.getDay())});
    Logger.log("one-offs: extra " + ymd + " for '" + chore.name + "'");
  });
  // v42 — a rebuild keeps one-day hour changes made in Google Calendar (calOverrides): move those occurrences.
  Object.keys(chore.calOverrides || {}).forEach(function(ymd) {
    var d = _ymdToDate(ymd);
    if (!d || d < today || d > horizon) return;
    var hour = parseInt(chore.calOverrides[ymd], 10); if (isNaN(hour)) return;
    _occurrencesOn(cal, chore.id, ymd).forEach(function(ev) {
      try {
        if (ev.getStartTime().getHours() === hour) return;
        var len = ev.getEndTime().getTime() - ev.getStartTime().getTime();
        var st = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, 0, 0);
        ev.setTime(st, new Date(st.getTime() + len));
        Logger.log("one-offs: hour " + ymd + " → " + hour + ":00 for '" + chore.name + "'");
      } catch(e) { Logger.log("one-offs: hour " + ymd + " failed — " + e); }
    });
  });
  // v40-3 — a rebuild must keep today's marks: a done day stays off the calendar, a missed day keeps its
  // title. v40-10 (L1): after the extra-day events, so an extra day that is today is covered too.
  var todayYmd = _ymdLocal(today);
  if (_dateIn(chore.doneDates, todayYmd)) _deleteOccurrence(cal, chore.id, todayYmd, "done");
  else if (_dateIn(chore.missedDates, todayYmd)) _occurrencesOn(cal, chore.id, todayYmd).forEach(function(ev) {
    try { var t = ev.getTitle() || ""; if (t.indexOf("⏰ Missed: ") !== 0) ev.setTitle("⏰ Missed: " + t); } catch(e) {}
  });
}

function _createBaseEventsForChore(calendarId, chore, tz) {
  try {
    var cal = CalendarApp.getCalendarById(calendarId);
    if (!cal) { Logger.log("createEventsForChore: calendar not found — " + calendarId); return false; }
    if (!chore || !chore.id) return false;

    var title = buildEventTitle(chore);
    var now   = new Date();

    if (chore.homeOnly && chore.schedule !== "once") {   // v45-1 — single events on the next home nights; the tick keeps them
      var t0 = _ymdLocal(now), want = _calExpected(chore, t0, _ymdPlus(t0, HOME_SYNC_DAYS - 1));
      Object.keys(want).sort().forEach(function(dd) {
        var sd = _ymdToDate(dd); sd.setHours(want[dd], 0, 0, 0);
        cal.createEvent(title, sd, new Date(sd.getTime() + 30 * 60 * 1000), {description: buildEventDescription(chore)});
      });
      Logger.log("createEventsForChore[home] '" + chore.name + "' → " + Object.keys(want).length + " night(s)");
      return true;
    }

    if (chore.schedule === "once") {
      var onceDay = chore.onceDate || chore.notBefore || null;   // v39-15 — an undated chore that waits is placed on its day
      var d = onceDay ? _ymdToDate(onceDay) : new Date();
      var hour = onceDay ? _choreCalHour(chore, onceDay) : (parseInt(chore.reminderHour) || 8);   // v42-1 — a moved hour sticks
      d.setHours(hour, 0, 0, 0);
      var endDt = new Date(d.getTime() + 30 * 60 * 1000);
      cal.createEvent(title, d, endDt, {description: buildEventDescription(chore)});
      Logger.log("createEventsForChore[once] '" + chore.name + "' → " + d.toString());
      return true;
    }

    if (chore.schedule === "daily") {
      var hour = parseInt(chore.reminderHour) || 8;
      var s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0);
      var e = new Date(s.getTime() + 30 * 60 * 1000);
      var rec = _newRec(); rec.addDailyRule();   // v42-3 (M4) — recurrence in the project zone
      cal.createEventSeries(title, s, e, rec, {description: buildEventDescription(chore)});
      Logger.log("createEventsForChore[daily] '" + chore.name + "'");
      return true;
    }

    if (chore.schedule === "weekly" || chore.schedule === "biweekly") {
      var weekdayMap = [
        CalendarApp.Weekday.SUNDAY, CalendarApp.Weekday.MONDAY,
        CalendarApp.Weekday.TUESDAY, CalendarApp.Weekday.WEDNESDAY,
        CalendarApp.Weekday.THURSDAY, CalendarApp.Weekday.FRIDAY,
        CalendarApp.Weekday.SATURDAY
      ];
      var days = (chore.weekdays && chore.weekdays.length)
        ? chore.weekdays.map(function(d){ return parseInt(d); })
        : (chore.weekday !== undefined ? [parseInt(chore.weekday)] : [now.getDay()]);

      // One independent series PER selected day. Each anchored to its first
      // future occurrence — bi-weekly cadence is then stable.
      // v30.1: if chore.skipFirstWeek, shift anchor +7 days (bi-weekly only)
      var skipWeek = (chore.schedule === "biweekly" && chore.skipFirstWeek === true);
      days.forEach(function(targetDay) {
        var hour = getReminderHourForDay(chore, targetDay);
        // v42-1 — start on the first day (today included) that the APP says is due on this weekday, so the
        // calendar's weeks are the app's weeks (biweekly) and today is never silently dropped.
        var daysUntil = (targetDay - now.getDay() + 7) % 7;
        for (var tries = 0; tries < 3; tries++) {
          var cand = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntil);
          if (_choreScheduledOn(chore, _ymdLocal(cand))) break;
          daysUntil += 7;
        }
        var anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntil, hour, 0, 0);
        var endDt  = new Date(anchor.getTime() + 30 * 60 * 1000);
        var rec = _newRec();   // v42-3 (M4)
        if (chore.schedule === "weekly") rec.addWeeklyRule().onlyOnWeekday(weekdayMap[targetDay]);
        else rec.addWeeklyRule().interval(2).onlyOnWeekday(weekdayMap[targetDay]);
        cal.createEventSeries(title, anchor, endDt, rec, {description: buildEventDescription(chore, targetDay)});
        Logger.log("createEventsForChore[" + chore.schedule + "] '" + chore.name + "' day=" + targetDay + " hour=" + hour + (skipWeek ? " (skip week)" : ""));
      });
      return true;
    }

    if (chore.schedule === "monthly") {
      var hour = parseInt(chore.reminderHour) || 8;
      var resolvedDay = resolveMonthlyDayGs(chore.monthlyDay || "1", now.getFullYear(), now.getMonth());
      var anchor = new Date(now.getFullYear(), now.getMonth(), resolvedDay, hour, 0, 0);
      if (resolvedDay < now.getDate()) anchor = new Date(now.getFullYear(), now.getMonth() + 1, resolvedDay, hour, 0, 0);   // v42-1 — today counts
      var endDt = new Date(anchor.getTime() + 30 * 60 * 1000);
      var rec = _newRec(); rec.addMonthlyRule();   // v42-3 (M4)
      cal.createEventSeries(title, anchor, endDt, rec, {description: buildEventDescription(chore)});
      Logger.log("createEventsForChore[monthly] '" + chore.name + "' day=" + resolvedDay);
      return true;
    }
  } catch(err) {
    Logger.log("createEventsForChore ERROR for '" + (chore && chore.name || "?") + "': " + err.toString());
    return false;
  }
  return false;
}
/** v42-3 (M4) — a recurrence pinned to the project zone, so its hours don't drift with the calendar's own zone at DST. */
function _newRec() {
  var r = CalendarApp.newRecurrence();
  try { r.setTimeZone(_instanceTz()); } catch(e) {}
  return r;
}

/**
 * Admin tool — run from Apps Script editor to nuke and rebuild ALL
 * calendar events for one child. Use when calendar drifts out of sync.
 *
 * Usage: change CHILD_NAME below, then Run.
 */
function resyncCalendarForChild(familyId, childName) {
  // v38 — resync calendar events for one (familyId, childName) pair.
  // Run from the IDE: resyncCalendarForChild("fam_xxxxx", "Linnea")
  if (!familyId)  throw new Error("resyncCalendarForChild: familyId required");
  if (!childName) throw new Error("resyncCalendarForChild: childName required");
  var CHILD_NAME = childName;  // v38 — was hardcoded "Linnea"; now param-driven

  var state = loadState(familyId);
  if (!state.children || !state.children[CHILD_NAME]) {
    Logger.log("resyncCalendarForChild: no such child — " + CHILD_NAME);
    return;
  }
  var calendarId = getCalendarId(state, CHILD_NAME);
  if (!calendarId) {
    Logger.log("resyncCalendarForChild: no Calendar ID set for " + CHILD_NAME);
    return;
  }
  var chores = state.children[CHILD_NAME].chores || [];
  var tz = getTimezone(state);
  Logger.log("resyncCalendarForChild: " + CHILD_NAME + " has " + chores.length + " chore(s)");
  chores.forEach(function(chore) {
    deleteEventsByChoreId(calendarId, chore.id);
    createEventsForChore(calendarId, chore, tz);
  });
  Logger.log("resyncCalendarForChild: complete for " + CHILD_NAME);
}

/** Check if a user has email notifications enabled (default: true) */
function notifyEmail(state, username) {
  var n = state && state.config && state.config.notify && state.config.notify[username];
  if (!n) return true; // default ON if not set
  return n.email !== false;
}

/** Check if a user has calendar notifications enabled (default: false) */
function notifyCalendar(state, username) {
  var n = state && state.config && state.config.notify && state.config.notify[username];
  if (!n) return false; // default OFF if not set
  return n.calendar === true;
}

/**
 * TEST TOOL — Run from Apps Script editor to test calendar integration
 * Creates a test event on the child's calendar and immediately deletes it
 */
function testCalendarIntegration(familyId) {
  // v38 — pass familyId from the IDE: testCalendarIntegration("fam_xxxxx")
  if (!familyId) throw new Error("testCalendarIntegration: familyId required");
  var state = loadState(familyId);
  var children = getChildNames(state);
  if (!children.length) { Logger.log("testCalendarIntegration: no children found"); return; }
  var childName  = children[0];
  var calendarId = getCalendarId(state, childName);
  if (!calendarId) {
    Logger.log("testCalendarIntegration: no calendar ID set for " + childName + " — add it in the Admin panel first");
    return;
  }
  Logger.log("testCalendarIntegration: testing calendar '" + calendarId + "' for " + childName);
  var cal = CalendarApp.getCalendarById(calendarId);
  if (!cal) { Logger.log("testCalendarIntegration: calendar not found — check the ID"); return; }
  var testEvent = cal.createAllDayEvent("🏦 Family Bank Test Event — safe to delete", new Date());
  Logger.log("testCalendarIntegration: SUCCESS — test event created. Check " + childName + "'s calendar.");
  Logger.log("testCalendarIntegration: deleting test event now...");
  testEvent.deleteEvent();
  Logger.log("testCalendarIntegration: test event deleted. Calendar integration is working!");
}

// ================================================================
// [DEBUG TEST FUNCTIONS] — Run from Apps Script editor to diagnose issues
// ================================================================

/**
 * testCreateChoreEvent
 * Creates a real weekly recurring test chore event on the child's calendar
 * and logs every step in detail. Run this, then paste the Execution Log
 * into chat so we can see exactly where it fails.
 */
function testCreateChoreEvent(familyId) {
  // v38 — pass familyId from the IDE: testCreateChoreEvent("fam_xxxxx")
  if (!familyId) throw new Error("testCreateChoreEvent: familyId required");
  Logger.log("=== testCreateChoreEvent START ===");

  // Load state and find first child with a calendar ID
  var state     = loadState(familyId);
  var children  = getChildNames(state);
  Logger.log("Children found: " + JSON.stringify(children));

  if (!children.length) { Logger.log("ERROR: No children found in state"); return; }

  var childName  = children[0];
  var calendarId = getCalendarId(state, childName);
  Logger.log("Child: " + childName);
  Logger.log("Calendar ID: " + (calendarId || "NOT SET"));
  Logger.log("Calendar notifications enabled: " + notifyCalendar(state, childName));

  if (!calendarId) {
    Logger.log("ERROR: No Calendar ID set for " + childName + " — add it in Admin panel first");
    return;
  }

  // Get the calendar
  Logger.log("Getting calendar by ID...");
  var cal = CalendarApp.getCalendarById(calendarId);
  Logger.log("Calendar object: " + (cal ? cal.getName() : "NULL — calendar not found"));
  if (!cal) { Logger.log("ERROR: Calendar not found — check the ID is correct"); return; }

  // Build a test chore mimicking a weekly Tuesday chore
  var testChore = {
    id:           "test_" + Date.now(),
    name:         "TEST Weekly Chore — safe to delete",
    amount:       1.00,
    schedule:     "weekly",
    weekday:      2,  // Tuesday (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
    reminderHour: 17, // 5:00 PM
    splitChk:     100,
    childChooses: false,
    desc:         "Debug test event"
  };

  Logger.log("Test chore: " + JSON.stringify(testChore));

  // Log the weekday mapping
  var weekdayMap = [
    CalendarApp.Weekday.SUNDAY,
    CalendarApp.Weekday.MONDAY,
    CalendarApp.Weekday.TUESDAY,
    CalendarApp.Weekday.WEDNESDAY,
    CalendarApp.Weekday.THURSDAY,
    CalendarApp.Weekday.FRIDAY,
    CalendarApp.Weekday.SATURDAY
  ];
  Logger.log("Weekday enum for Tuesday (2): " + weekdayMap[2]);
  Logger.log("All weekday enums: " + JSON.stringify(weekdayMap));

  // Calculate event date
  var now       = new Date();
  var h         = testChore.reminderHour;
  var targetDay = testChore.weekday;
  var daysUntil = (targetDay - now.getDay() + 7) % 7;
  if (daysUntil === 0 && now.getHours() >= h) daysUntil = 7;
  var startMs   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0, 0).getTime();
  var eventDate = new Date(startMs + daysUntil * 24*60*60*1000);
  var endDate   = new Date(eventDate.getTime() + 30*60*1000);

  Logger.log("Today: " + now.toDateString() + " (day " + now.getDay() + ")");
  Logger.log("Target weekday: " + targetDay + " (Tuesday)");
  Logger.log("Days until: " + daysUntil);
  Logger.log("Event date: " + eventDate.toDateString() + " at " + eventDate.toTimeString());
  Logger.log("Event end:  " + endDate.toDateString() + " at " + endDate.toTimeString());

  // Build recurrence rule
  Logger.log("Building recurrence rule...");
  var recur = CalendarApp.newRecurrence().addWeeklyRule().onlyOnWeekday(weekdayMap[targetDay]);
  Logger.log("Recurrence rule built: " + recur);

  // Create a real weekly test event using confirmed working createEventSeries
  Logger.log("Creating weekly test event with createEventSeries...");
  try {
    var series = cal.createEventSeries(
      "🏦 TEST Weekly — safe to delete",
      eventDate, endDate, recur,
      {description: "Family Bank test event — delete me after checking calendar"}
    );
    Logger.log("SUCCESS — Event series ID: " + series.getId());
    Logger.log("Check calendar: should show as 'Weekly on Tuesdays' at 5pm");
    Logger.log("Delete it manually from Google Calendar when done.");
    Logger.log("=== testCreateChoreEvent COMPLETE ===");
  } catch(err) {
    Logger.log("ERROR: " + err.toString());
    Logger.log("=== testCreateChoreEvent FAILED ===");
  }
}

/**
 * printReadableState
 * Prints a clean, human-readable summary of the entire bank state
 * to the Execution Log. Much easier than reading raw JSON in the sheet.
 */
function printReadableState(familyId) {
  // v38 — pass familyId from the IDE: printReadableState("fam_xxxxx")
  if (!familyId) throw new Error("printReadableState: familyId required");
  Logger.log("=== FAMILY BANK — READABLE STATE ===");
  var s = loadState(familyId);
  Logger.log("Bank: " + getBankName(s));
  Logger.log("Tagline: " + (s.config.tagline || "none"));
  Logger.log("Admin PIN: " + (s.config.adminPin || "not set"));
  Logger.log("Timezone: " + (s.config.timezone || "not set"));
  Logger.log("");
  Logger.log("--- USERS ---");
  (s.users || []).forEach(function(u) {
    var role  = (s.roles || {})[u] || "unknown";
    var email = (s.config.emails || {})[u] || "no email";
    var calId = (s.config.calendars || {})[u] || "no calendar";
    var notify= (s.config.notify || {})[u] || {};
    Logger.log(u + " [" + role + "] email:" + email
      + " | emailNotif:" + (notify.email !== false)
      + " | calNotif:" + (!!notify.calendar)
      + (role === "child" ? " | calID:" + calId : ""));
  });
  Logger.log("");
  Logger.log("--- CHILDREN ---");
  getChildNames(s).forEach(function(c) {
    var d = s.children[c] || {};
    var b = d.balances || {};
    var r = d.rates || {};
    var a = d.autoDeposit || {};
    var chores = d.chores || [];
    Logger.log(c + ":");
    Logger.log("  Checking: $" + (b.checking||0).toFixed(2) + " @ " + (r.checking||0) + "% APY");
    Logger.log("  Savings:  $" + (b.savings||0).toFixed(2)  + " @ " + (r.savings||0)  + "% APY");
    Logger.log("  Allowance: $" + (a.checking||0).toFixed(2) + " chk / $" + (a.savings||0).toFixed(2) + " sav per week");
    Logger.log("  Chores (" + chores.length + "):");
    chores.forEach(function(ch) {
      Logger.log("    - " + ch.name
        + " | $" + (ch.amount||0).toFixed(2)
        + " | " + ch.schedule
        + (ch.weekday !== undefined ? " (day " + ch.weekday + ")" : "")
        + (ch.monthlyDay ? " (day " + ch.monthlyDay + ")" : "")
        + " | status:" + (ch.status||"?")
        + " | calEventId:" + (ch.calendarEventId||"none")
        + " | reminderHour:" + (ch.reminderHour||8));
    });
  });
  Logger.log("");
  Logger.log("--- LEDGER ROWS ---");
  var history = loadHistory(familyId);
  var total = 0;
  Object.keys(history).forEach(function(child) {
    Logger.log(child + ": " + (history[child]||[]).length + " transactions");
    total += (history[child]||[]).length;
  });
  Logger.log("Total: " + total + " transactions");
  Logger.log("=== END OF STATE ===");
}

// ================================================================
// [STREAK & NET WORTH HELPERS]
// ================================================================


// ================================================================
// [STREAK MILESTONE] — Auto-deposit bonus when milestone hit
// ================================================================
/**
 * checkStreakMilestone — called after chore approval.
 * Increments chore.streakCount. If it hits a multiple of streakMilestone,
 * auto-deposits streakReward into checking.
 * Returns the bonus amount deposited (0 if no milestone hit).
 */
function checkStreakMilestone(state, child, chore, ledger, now, familyId) {
  // v38 — Ledger writes use the 6-column schema:
  //   [Date, FamilyId, User, Child, Note, Amount]
  try {
    if (!chore.streakMilestone || !chore.streakReward) return 0;
    var milestone = parseInt(chore.streakMilestone) || 0;
    var reward    = parseFloat(chore.streakReward) || 0;
    if (milestone <= 0 || reward <= 0) return 0;

    // Increment instance count
    chore.streakCount = (parseInt(chore.streakCount) || 0) + 1;
    var effective = chore.streakCount + (parseInt(chore.streakStart) || 0);

    if (effective % milestone !== 0) return 0;

    // Milestone hit — deposit bonus to checking
    var data = state.children[child];
    data.balances.checking += reward;
    ledger.appendRow([now, familyId || "", "Bank", child,
      "🔥 Streak Bonus: " + chore.name + " (" + effective + " in a row!) (Chk)", reward]);
    Logger.log("checkStreakMilestone: [" + (familyId || "?") + "] " + child + " — " + chore.name + " hit " + effective + " streak! Bonus $" + reward);
    return reward;
  } catch(e) {
    Logger.log("checkStreakMilestone ERROR: " + e);
    return 0;
  }
}

function calcChoreStreaks(familyId, childName, data) {
  // v38 6-column Ledger: [Date, FamilyId, User, Child, Note, Amount].
  if (!familyId) return [];
  try {
    var chores = data.chores || [];
    var ledger = getLedgerSheet().getDataRange().getValues();
    var streaks = [];
    chores.forEach(function(chore) {
      if (!chore.name) return;
      var completions = [];
      for (var i = 1; i < ledger.length; i++) {
        var row = ledger[i];
        if (String(row[1]) !== familyId) continue;
        var child = String(row[3] || "");
        var note  = String(row[4] || "");
        if ((child === childName || !child) && note.indexOf("Chore: " + chore.name) === 0) {
          try { completions.push(new Date(row[0])); } catch(e) {}
        }
      }
      if (!completions.length) return;
      completions.sort(function(a,b){return a-b;});
      var streak = 1;
      var interval = chore.schedule === "daily" ? 1 : chore.schedule === "weekly" ? 7 : chore.schedule === "biweekly" ? 14 : 30;
      for (var j = completions.length - 1; j > 0; j--) {
        var diff = Math.round((completions[j] - completions[j-1]) / (24*60*60*1000));
        if (diff <= interval + 2) { streak++; } else { break; }
      }
      var unit = chore.schedule === "daily" ? "days" : chore.schedule === "monthly" ? "months" : "weeks";
      if (streak >= 2) streaks.push({name: chore.name, streak: streak, unit: unit});
    });
    return streaks.sort(function(a,b){return b.streak - a.streak;});
  } catch(e) { Logger.log("calcChoreStreaks ERROR: " + e); return []; }
}

function calcNetWorthHistory(familyId, childName) {
  // v38 6-column Ledger: [Date, FamilyId, User, Child, Note, Amount].
  if (!familyId) return [];
  try {
    var ledger = getLedgerSheet().getDataRange().getValues();
    var running = 0;
    var monthly = {};
    for (var i = 1; i < ledger.length; i++) {
      var row   = ledger[i];
      if (String(row[1]) !== familyId) continue;
      var child = String(row[3] || "");
      if (child !== childName && child !== "") continue;
      var amt = parseFloat(row[5]) || 0;
      running += amt;
      try {
        var d   = new Date(row[0]);
        var key = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
        monthly[key] = running;
      } catch(e) {}
    }
    // v30.1: Always ensure a current-month data point exists so day-one charts
    // aren't empty. If the current month already has ledger activity, its
    // running total is already correct. Otherwise, fall back to current balance.
    try {
      var stateForBalance = loadState(familyId);
      if (!stateForBalance || stateForBalance.status !== "error") {
        var childObj = stateForBalance.children && stateForBalance.children[childName];
        if (childObj && childObj.balances) {
          var now = new Date();
          var currentKey = now.getFullYear() + "-" + String(now.getMonth()+1).padStart(2,"0");
          if (!monthly.hasOwnProperty(currentKey)) {
            var total = (parseFloat(childObj.balances.checking) || 0) + (parseFloat(childObj.balances.savings) || 0);
            monthly[currentKey] = total;
          }
        }
      }
    } catch(e) { Logger.log("calcNetWorthHistory: fallback skipped — " + e); }

    var result = [];
    Object.keys(monthly).sort().forEach(function(k){ result.push({month: k, total: parseFloat(monthly[k].toFixed(2))}); });
    return result;
  } catch(e) { Logger.log("calcNetWorthHistory ERROR: " + e); return []; }
}

// ================================================================
// [SETUP] — Run once from Apps Script editor after pasting this file
// ================================================================
function setupBank() {
  // v38 deprecation guard — the v36.1 single-family initializer is
  // preserved for reference but must not run against a v38 row-per-family
  // Sheet. Step 3 introduces signup -> adminApprove as the canonical way
  // to create v38 families.
  throw new Error(
    "setupBank() is deprecated in v38. " +
    "Bootstrap the admin layer with bootstrapAdmin('<4-digit-pin>'), then " +
    "create families via Step 3's signup -> adminApprove flow.");
  // Below this throw is the v36.1 body, kept verbatim per Rule 4.
  // Create Ledger tab if it doesn't exist
  getLedgerSheet();

  // Write default state to A1 only if it's empty
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (!sheet.getRange("A1").getValue()) {
    saveState(buildDefaultState());
    Logger.log("setupBank: default state written to A1");
  } else {
    Logger.log("setupBank: A1 already has data — not overwriting (existing bank data is safe)");
  }

  // Install triggers (skips any that already exist)
  var existing = {};
  ScriptApp.getProjectTriggers().forEach(function(t) {
    existing[t.getHandlerFunction()] = true;
  });

  [
    {fn: "automatedMondayDeposit", type: "weekly",  day: ScriptApp.WeekDay.MONDAY, hour: 8},
    {fn: "monthlyMaintenance",     type: "monthly", day: 1,                        hour: 7},
    {fn: "dailyChoreReset",        type: "daily",   hour: 6},
    {fn: "sundayChoreReminder",    type: "weekly",  day: ScriptApp.WeekDay.SUNDAY, hour: 9}
  ].forEach(function(t) {
    if (existing[t.fn]) {
      Logger.log("setupBank: trigger already installed — " + t.fn);
      return;
    }
    var tb = ScriptApp.newTrigger(t.fn).timeBased();
    if (t.type === "weekly")  tb = tb.onWeekDay(t.day).atHour(t.hour);
    if (t.type === "monthly") tb = tb.onMonthDay(t.day).atHour(t.hour);
    if (t.type === "daily")   tb = tb.everyDays(1).atHour(t.hour);
    tb.create();
    Logger.log("setupBank: trigger installed — " + t.fn);
  });

  Logger.log("setupBank: done! Deploy as Web App → Execute as Me → Anyone can access.");
}

// ================================================================
// [v38 ADMIN LAYER] — D6 admin schema, helpers, bootstrap, routes
//
// Step 2 scope: admin layer grafted onto v36.1 family-state runtime.
// Family runtime (loadState/saveState/doPost/triggers) is rewired in Step 2.5.
// During Step 2 the v36.1 single-cell family flow remains intact alongside
// the new admin tabs. The Ledger tab name collides — bootstrapAdmin
// provisions it as the v38 6-column schema (Date|FamilyId|User|Child|Note|Amount).
// v36.1 doPost still writes 5-element rows; that's broken-by-design at this
// checkpoint and Step 2.5 fixes it. Don't run setupBank() against a v38 sheet.
//
// Conventions (locked per D6):
//   - Sheet access by name only via getSheetByName(). No getSheets()[N].
//   - Every admin write route uses try { lock.waitLock(5000); ... } finally { lock.releaseLock(); }.
//   - Bounded-range reads: getRange(2, 1, Math.max(0, lastRow - 1), N).getValues().
//   - PIN columns plain-text-formatted at provisioning (D6.4 triple-fix).
//   - _appendAuditRow is the last write inside the lock scope on every admin write route.
// ================================================================

// ----------------------------------------------------------------
// v38 Admin — Constants (single block per build doc Section 7)
// ----------------------------------------------------------------

// Six-tab schema — names + header rows. bootstrapAdmin provisions all six.
// Header text matches D6 doc verbatim per Rule 5 (match conventions).
var SCHEMA = {
  FAMILIES:         { name: "Families",         cols: ["familyId", "state"] },
  PENDING_SIGNUPS:  { name: "PendingSignups",   cols: ["signupId", "submittedAt", "name", "email", "pin", "honeypot", "notificationStatus"] },
  EMAIL_INDEX:      { name: "EmailIndex",       cols: ["email", "familyId"] },
  DELETED_FAMILIES: { name: "DeletedFamilies",  cols: ["familyId", "deletedAt", "emailsAtDeletion"] },
  LEDGER:           { name: "Ledger",           cols: ["Date", "FamilyId", "User", "Child", "Note", "Amount"] },
  ADMIN_CONFIG:     { name: "AdminConfig",      cols: ["adminPin", "adminEmail"] }
};

// notificationStatus controlled vocabulary — D6.6.
// Future statuses extend this object, not the call sites.
var NOTIFICATION_STATUS = {
  OK:                       "",
  SKIPPED_NO_ADMIN_EMAIL:   "skipped:noAdminEmail",
  HONEYPOT_POPULATED:       "honeypot:populated"
};

// Pending-signup queue cap — D6.6 carry-forward from v36.1.
var SIGNUP_QUEUE_CAP = 20;

// Reserved sentinel for admin-scoped Ledger rows — D6.5.
var ADMIN_FAMILY_SENTINEL = "ADMIN";

// ----------------------------------------------------------------
// v38 Admin — Helpers
// ----------------------------------------------------------------

/**
 * _normalizeDisplayName(input) — D6.5
 * Returns String(input).trim() with zero-width chars stripped.
 * Apply at signup, login lookup, every display-name boundary.
 */
function _normalizeDisplayName(input) {
  if (input == null) return "";
  // Strip U+200B (ZWSP), U+200C (ZWNJ), U+200D (ZWJ), U+FEFF (BOM)
  return String(input).replace(/[\u200B\u200C\u200D\uFEFF]/g, "").trim();
}

/**
 * _normalizeEmail(input) — D6.7
 * Lowercase + trim. Apply at every email-write boundary including
 * EmailIndex writes, tombstone snapshot, signup intake.
 */
function _normalizeEmail(input) {
  if (input == null) return "";
  return String(input).trim().toLowerCase();
}

/**
 * _isAdminConfigBootstrapped() — D6.4
 * Returns true if AdminConfig!A2 matches /^\d{4}$/.
 * Canonical bootstrap-state check; called from bootstrapAdmin and any audit route.
 */
function _isAdminConfigBootstrapped() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SCHEMA.ADMIN_CONFIG.name);
  if (!sheet) return false;
  if (sheet.getLastRow() < 2) return false;
  var cell = String(sheet.getRange(2, 1).getValue());
  return /^\d{4}$/.test(cell);
}

/**
 * _appendAuditRow(familyId, user, child, note, amount) — D6.5
 * Server-side Ledger append. Last write inside the LockService scope
 * on every admin write route. Schema: Date | FamilyId | User | Child | Note | Amount.
 * Date is server-written via new Date().toISOString() per D6.6.
 *
 * Admin-scoped action conventions (D6.5):
 *   - User=admin (literal lowercase)
 *   - FamilyId=affected family for family-scoped admin actions
 *   - FamilyId=ADMIN sentinel for global admin actions (bootstrap, rebuilds, denials)
 *   - Child=blank, Amount=blank
 */
function _appendAuditRow(familyId, user, child, note, amount) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ledger = ss.getSheetByName(SCHEMA.LEDGER.name);
  if (!ledger) throw new Error("_appendAuditRow: Ledger tab missing");
  ledger.appendRow([
    new Date().toISOString(),
    familyId == null ? "" : String(familyId),
    user     == null ? "" : String(user),
    child    == null ? "" : String(child),
    note     == null ? "" : String(note),
    amount   == null ? "" : amount
  ]);
}

// ----------------------------------------------------------------
// v38 Admin — Bootstrap (IDE-callable)
// ----------------------------------------------------------------

/**
 * bootstrapAdmin(pin) — D6.1, D6.4
 * IDE-only. One-time setup. Provisions six v38 tabs idempotently,
 * writes AdminConfig data row LAST. Rejects with error if already
 * bootstrapped (overwrite and no-op both lie to the caller).
 *
 * Wrapped in LockService per D6.3 — every admin write motion locks,
 * including bootstrap.
 *
 * Sequence:
 *   0. lock.waitLock(5000)
 *   1. validate pin format (regex /^\d{4}$/) — D6.4 triple-fix step 1
 *   2. _isAdminConfigBootstrapped() → if true, throw
 *   3. provision missing tabs (idempotent — leaves existing untouched)
 *   4. set plain-text format on PIN columns (D6.4 triple-fix step 2)
 *   5. write AdminConfig data row [pin, ""]  ← last state write; ordering per D6.1
 *   5b. _appendAuditRow bootstrap row  ← LAST write inside lock per D6.5
 *   6. release lock (in finally)
 *
 * Bootstrap-crash recovery: if step 3 or 4 throws, AdminConfig!A2 stays
 * empty, _isAdminConfigBootstrapped() returns false, re-running is safe.
 * If the throw happens after step 5, AdminConfig is populated and re-run
 * is correctly rejected.
 */
function bootstrapAdmin(pin) {
  // Step 1: validate PIN format BEFORE acquiring lock — fast-fail on bad input.
  if (!/^\d{4}$/.test(String(pin))) {
    throw new Error("bootstrapAdmin: pin must be exactly 4 digits");
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);

    // Step 2: reject if already bootstrapped.
    if (_isAdminConfigBootstrapped()) {
      throw new Error("bootstrapAdmin: already bootstrapped. Use setAdminPin to change PIN. For lost-PIN recovery, manually clear AdminConfig!A2 and re-run.");
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Step 3: provision six tabs idempotently (existing tabs left untouched per D6.1).
    _provisionTab(ss, SCHEMA.FAMILIES);
    _provisionTab(ss, SCHEMA.PENDING_SIGNUPS);
    _provisionTab(ss, SCHEMA.EMAIL_INDEX);
    _provisionTab(ss, SCHEMA.DELETED_FAMILIES);
    _provisionTab(ss, SCHEMA.LEDGER);
    _provisionTab(ss, SCHEMA.ADMIN_CONFIG);

    // Step 4: PIN-column plain-text format — D6.4 triple-fix step 2.
    // Apply to AdminConfig col A (admin PIN) and PendingSignups col E (signup PIN).
    var adminConfigSheet = ss.getSheetByName(SCHEMA.ADMIN_CONFIG.name);
    adminConfigSheet.getRange("A:A").setNumberFormat("@");
    var pendingSheet = ss.getSheetByName(SCHEMA.PENDING_SIGNUPS.name);
    pendingSheet.getRange("E:E").setNumberFormat("@");

    // Step 5: AdminConfig data row written LAST per D6.1.
    // adminEmail starts blank; set later via setAdminEmail.
    adminConfigSheet.getRange(2, 1, 1, 2).setValues([[String(pin), ""]]);

    _appendAuditRow(ADMIN_FAMILY_SENTINEL, "admin", "", "Bootstrapped admin layer", "");

    Logger.log("bootstrapAdmin: provisioned 6 tabs, AdminConfig PIN set");
  } finally {
    lock.releaseLock();
  }
}

/**
 * _provisionTab(ss, schemaEntry) — internal helper for bootstrapAdmin.
 * Idempotent: if the tab exists, leave it untouched (D6.1). If missing,
 * create with the locked header row.
 */
function _provisionTab(ss, schemaEntry) {
  var existing = ss.getSheetByName(schemaEntry.name);
  if (existing) {
    Logger.log("_provisionTab: " + schemaEntry.name + " exists — leaving untouched");
    return;
  }
  var sheet = ss.insertSheet(schemaEntry.name);
  sheet.getRange(1, 1, 1, schemaEntry.cols.length).setValues([schemaEntry.cols]);
  sheet.getRange("1:1").setFontWeight("bold");
  Logger.log("_provisionTab: created " + schemaEntry.name);
}

// ----------------------------------------------------------------
// v38 Admin — Route handlers (dispatched from doGet)
// ----------------------------------------------------------------

/**
 * _routeAdminLoad(params) — D6.4
 * Read-only. Returns AdminConfig data row + family count + queue length.
 * No lock (read-only). Bounded-range reads per D6.2.
 */
function _routeAdminLoad(params) {
  try {
    if (!_validateAdminPin(params.adminPin)) return _jsonError("auth");

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // AdminConfig row 2: [adminPin, adminEmail].
    var adminConfigSheet = ss.getSheetByName(SCHEMA.ADMIN_CONFIG.name);
    var configRow = adminConfigSheet.getRange(2, 1, 1, 2).getValues()[0];

    // Bounded reads — D6.2.
    var familiesSheet = ss.getSheetByName(SCHEMA.FAMILIES.name);
    var familyCount   = Math.max(0, familiesSheet.getLastRow() - 1);

    var pendingSheet  = ss.getSheetByName(SCHEMA.PENDING_SIGNUPS.name);
    var queueLength   = Math.max(0, pendingSheet.getLastRow() - 1);

    return _jsonOk({
      adminEmail:   configRow[1] == null ? "" : String(configRow[1]),
      familyCount:  familyCount,
      queueLength:  queueLength
    });
  } catch(err) {
    Logger.log("adminLoad ERROR: " + err);
    return _jsonError("internal");
  }
}

/**
 * _routeAdminListFamilies(params) — D5
 * Read-only. Returns familyIds + minimal metadata (just IDs at v38 launch).
 * No lock (read-only). Bounded-range read per D6.2.
 */
function _routeAdminListFamilies(params) {
  try {
    if (!_validateAdminPin(params.adminPin)) return _jsonError("auth");

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var familiesSheet = ss.getSheetByName(SCHEMA.FAMILIES.name);

    var familyIds = [];
    var lastRow = familiesSheet.getLastRow();
    if (lastRow >= 2) {
      var rows = familiesSheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < rows.length; i++) {
        if (rows[i][0]) familyIds.push(String(rows[i][0]));
      }
    }

    return _jsonOk({ familyIds: familyIds });
  } catch(err) {
    Logger.log("adminListFamilies ERROR: " + err);
    return _jsonError("internal");
  }
}

/**
 * _routeSetAdminPin(params) — D6.4
 * Write. LockService + Ledger audit per D6.3 + D6.5.
 *
 * Sequence:
 *   0. lock.waitLock(5000)
 *   1. validate oldPin against AdminConfig col A (D6.4 triple-fix step 3 read)
 *   2. validate newPin format (/^\d{4}$/)  — triple-fix step 1 write
 *   3. write AdminConfig col A = newPin
 *   4. _appendAuditRow (FamilyId=ADMIN, User=admin, Note="Admin PIN updated")
 *   5. release lock (finally)
 */
function _routeSetAdminPin(params) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);

    if (!_validateAdminPin(params.oldPin))           return _jsonError("auth");
    if (!/^\d{4}$/.test(String(params.newPin || ""))) return _jsonError("badInput");

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var adminConfigSheet = ss.getSheetByName(SCHEMA.ADMIN_CONFIG.name);
    adminConfigSheet.getRange(2, 1).setValue(String(params.newPin));

    _appendAuditRow(ADMIN_FAMILY_SENTINEL, "admin", "", "Admin PIN updated", "");

    return _jsonOk({});
  } catch(err) {
    Logger.log("setAdminPin ERROR: " + err);
    return _jsonError("internal");
  } finally {
    lock.releaseLock();
  }
}

/**
 * _routeSetAdminEmail(params) — D6.4
 * Write. LockService + Ledger audit per D6.3 + D6.5.
 *
 * Sequence:
 *   0. lock.waitLock(5000)
 *   1. validate adminPin
 *   2. _normalizeEmail(newEmail) per D6.7
 *   3. write AdminConfig col B = newEmail
 *   4. _appendAuditRow (FamilyId=ADMIN, User=admin, Note="Admin email updated")
 *   5. release lock (finally)
 */
function _routeSetAdminEmail(params) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);

    if (!_validateAdminPin(params.adminPin)) return _jsonError("auth");

    var newEmail = _normalizeEmail(params.newEmail);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var adminConfigSheet = ss.getSheetByName(SCHEMA.ADMIN_CONFIG.name);
    adminConfigSheet.getRange(2, 2).setValue(newEmail);

    _appendAuditRow(ADMIN_FAMILY_SENTINEL, "admin", "", "Admin email updated", "");

    return _jsonOk({});
  } catch(err) {
    Logger.log("setAdminEmail ERROR: " + err);
    return _jsonError("internal");
  } finally {
    lock.releaseLock();
  }
}

// ----------------------------------------------------------------
// v38 Admin — Internal route helpers
// ----------------------------------------------------------------

/**
 * _validateAdminPin(input) — D6.4 triple-fix step 3 (read-side String() coercion).
 * Returns true iff input is a 4-digit string AND matches AdminConfig!A2.
 * Generic auth — no signal which check failed.
 */
function _validateAdminPin(input) {
  if (!/^\d{4}$/.test(String(input || ""))) return false;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var adminConfigSheet = ss.getSheetByName(SCHEMA.ADMIN_CONFIG.name);
  if (!adminConfigSheet) return false;
  if (adminConfigSheet.getLastRow() < 2) return false;
  var stored = String(adminConfigSheet.getRange(2, 1).getValue());
  return stored === String(input);
}

/**
 * _jsonOk(payload) — uniform success response shape.
 */
function _jsonOk(payload) {
  var out = { status: "ok" };
  if (payload) {
    for (var k in payload) {
      if (payload.hasOwnProperty(k)) out[k] = payload[k];
    }
  }
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * _jsonError(reason) — uniform error response shape.
 * Generic reasons (auth/badInput/internal) — no enumeration leakage per D5.
 */
function _jsonError(reason) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "error", reason: reason }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ================================================================
// [TOOLS] — Run any of these manually from the Apps Script editor
// ================================================================

/**
 * cleanOrphanedStateKeys
 * Run this ONCE manually to clean up leftover calendar helper keys
 * that got permanently saved into the state blob in Sheet1 A1.
 * Safe to run — only removes the specific keys, touches nothing else.
 */

// ================================================================
// [v38 STEP 2.5] — Family iteration helper for triggers
// ================================================================
/**
 * _forEachFamily(callback)
 * Iterates every familyId in Families!A:B (bounded read) and invokes
 * callback(familyId) for each. Used by automatedMondayDeposit,
 * monthlyMaintenance, dailyChoreReset, sundayChoreReminder.
 * Per-row try/catch lives in each trigger's wrapper, not here, so a
 * single bad row does not abort the rest of the iteration.
 */
function _forEachFamily(callback) {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var sheet  = ss.getSheetByName("Families");
  if (!sheet) {
    Logger.log("_forEachFamily: Families tab missing — bootstrapAdmin not run?");
    return;
  }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    var fid = ids[i][0];
    if (!fid) continue;
    callback(String(fid));
  }
}

// ================================================================
// [v38 STEP 3] — signup, approve, deny, delete, login, rebuild, child-email
//   Builder: Strake. Routes dispatched from doGet via params.action,
//   matching Lath's Step 2 admin-route convention. Conventions verbatim
//   per D6.1-D6.7 and Build Doc §4 Step 3 / §7.
// ================================================================

/**
 * generateFamilyId() — D6.7 / Build Doc §4 Step 3
 * Returns "fam_" + 8 lowercase alphanumeric. Collision-checked against
 * Families col A via a bounded read (D6.2). Internal regenerate loop is
 * capped at 5 attempts; throws on exhaustion.
 *
 * ADMIN reject is the CALLER's responsibility at the output boundary
 * (D6.5: locked at the output boundary of generateFamilyId(), NOT inside
 * the generator; the route validates candidate !== "ADMIN" uppercase-exact
 * before write). A fam_-prefixed id can never equal ADMIN; the caller
 * check is belt-and-suspenders against a future generator swap.
 */
function generateFamilyId() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SCHEMA.FAMILIES.name);

  // Bounded read of Families col A -> existing-id set (D6.2).
  var existing = {};
  if (sheet) {
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (ids[i][0]) existing[String(ids[i][0])] = true;
      }
    }
  }

  var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (var attempt = 0; attempt < 5; attempt++) {
    var suffix = "";
    for (var j = 0; j < 8; j++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    var candidate = "fam_" + suffix;
    if (!existing[candidate]) return candidate;
  }
  throw new Error("generateFamilyId: 5 collision attempts exhausted against Families col A");
}

/**
 * _routeSignup(params) — Build Doc §4 Step 3, D6.6
 * Public signup intake -> PendingSignups queue. Write route: LockService
 * per D6.3. SoT-scans Families AND PendingSignups for email uniqueness
 * (D6.6). PIN triple-fix (D6.4): regex on write, plain-text column set at
 * bootstrap, String() coercion when read elsewhere.
 *
 * Route sequence (lifted verbatim from Build Doc §4 Step 3):
 *   0. lock.waitLock(5000)
 *   0.5. validate input shape (name, email, PIN; honeypot field present
 *        as string; all required fields present)
 *   1. _normalizeDisplayName(name); reject if reserved
 *      (== "admin" after .toLowerCase() — never .toLocaleLowerCase())
 *   2. _normalizeEmail(email); reject if format invalid;
 *      reject if PIN doesn't match /^\d{4}$/
 *   3. SoT-scan Families col B for the email (raw JSON substring scan
 *      first; parse only on hits per scan-then-parse convention);
 *      reject if found
 *   4. SoT-scan PendingSignups col D for email; reject if found
 *   5. count PendingSignups rows; if >= SIGNUP_QUEUE_CAP, reject
 *      (full-queue, generic message — no signal which check failed)
 *   6. determine notificationStatus:
 *        HONEYPOT_POPULATED if honeypot non-empty,
 *        SKIPPED_NO_ADMIN_EMAIL if AdminConfig col B empty,
 *        else OK
 *   7. generate signupId (sig_ + 8 lowercase alphanumeric);
 *      collision-check against PendingSignups col A in same lock
 *   8. appendRow [signupId, new Date().toISOString(), name, email,
 *                 PIN, honeypot, notificationStatus]
 *   9. if notificationStatus is OK, send admin notification email
 *      (best-effort; failure does not roll back the queue write)
 *  10. release lock (finally)
 */
function _routeSignup(params) {
  var lock = LockService.getScriptLock();   // D6.3 — write route locks.
  try {
    lock.waitLock(5000);

    // 0.5 — input shape. Honeypot must be PRESENT as a string (may be empty).
    var rawName  = params.name;
    var rawEmail = params.email;
    var rawPin   = params.pin;
    if (rawName == null || rawEmail == null || rawPin == null) return _jsonError("badInput");
    if (typeof params.honeypot !== "string")                   return _jsonError("badInput");

    // 1 — display name normalize + reserved-name reject.
    var name = _normalizeDisplayName(rawName);
    if (!name) return _jsonError("badInput");
    if (name.toLowerCase() === "admin") return _jsonError("reservedName");  // never toLocaleLowerCase (D6.5)

    // 2 — email normalize + format; PIN format (D6.4 triple-fix write step).
    var email = _normalizeEmail(rawEmail);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return _jsonError("badInput");
    var pin = String(rawPin);
    if (!/^\d{4}$/.test(pin)) return _jsonError("badInput");

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 3 — SoT-scan Families col B for email (scan-then-parse, D6 §7).
    var familiesSheet = ss.getSheetByName(SCHEMA.FAMILIES.name);
    var fLast = familiesSheet.getLastRow();
    if (fLast >= 2) {
      var fRows = familiesSheet.getRange(2, 1, fLast - 1, 2).getValues();  // bounded read (D6.2)
      for (var i = 0; i < fRows.length; i++) {
        var raw = fRows[i][1];
        if (!raw) continue;
        // Cheap substring pre-filter on lowercased raw JSON; parse only on hit.
        if (String(raw).toLowerCase().indexOf(email) === -1) continue;
        try {
          var st = JSON.parse(raw);
          var em = (st && st.config && st.config.emails) || {};
          for (var u in em) {
            if (em.hasOwnProperty(u) && _normalizeEmail(em[u]) === email) {
              return _jsonError("duplicateEmail");
            }
          }
        } catch(pe) { /* unparseable row — skip, do not false-reject */ }
      }
    }

    // 4 — SoT-scan PendingSignups col D for email.
    var pendingSheet = ss.getSheetByName(SCHEMA.PENDING_SIGNUPS.name);
    var pLast = pendingSheet.getLastRow();
    var pRows = (pLast >= 2)
      ? pendingSheet.getRange(2, 1, pLast - 1, 7).getValues()  // bounded read (D6.2), full row for col A + col D
      : [];
    for (var k = 0; k < pRows.length; k++) {
      if (_normalizeEmail(pRows[k][3]) === email) return _jsonError("duplicateEmail");
    }

    // 5 — queue cap (generic message).
    if (pRows.length >= SIGNUP_QUEUE_CAP) return _jsonError("queueFull");

    // 6 — notificationStatus.
    var honeypot = params.honeypot;
    var adminConfigSheet = ss.getSheetByName(SCHEMA.ADMIN_CONFIG.name);
    var adminEmail = "";
    if (adminConfigSheet && adminConfigSheet.getLastRow() >= 2) {
      adminEmail = String(adminConfigSheet.getRange(2, 2).getValue() || "").trim();
    }
    var notificationStatus;
    if (honeypot !== "") {
      notificationStatus = NOTIFICATION_STATUS.HONEYPOT_POPULATED;
    } else if (!adminEmail) {
      notificationStatus = NOTIFICATION_STATUS.SKIPPED_NO_ADMIN_EMAIL;
    } else {
      notificationStatus = NOTIFICATION_STATUS.OK;
    }

    // 7 — signupId (sig_ + 8 lowercase alphanumeric), collision-check col A in-lock.
    var existingSig = {};
    for (var s = 0; s < pRows.length; s++) {
      if (pRows[s][0]) existingSig[String(pRows[s][0])] = true;
    }
    var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    var signupId = null;
    for (var attempt = 0; attempt < 5; attempt++) {
      var suffix = "";
      for (var c = 0; c < 8; c++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
      var cand = "sig_" + suffix;
      if (!existingSig[cand]) { signupId = cand; break; }
    }
    if (!signupId) throw new Error("_routeSignup: signupId collision attempts exhausted");

    // 8 — append the queue row. Server-written timestamp (D6.6).
    pendingSheet.appendRow([
      signupId,
      new Date().toISOString(),
      name,
      email,
      pin,
      honeypot,
      notificationStatus
    ]);
    // D6.4 layer-2 hardening (Strake): force col E (pin) to text AT the write
    // site. appendRow can coerce a leading-zero PIN ("0000") to the number 0
    // before any provisioned column format applies; String(0) -> "0" then
    // corrupts the PIN downstream (caught at DW-8). setNumberFormat("@") then
    // setValue(pin) on the just-appended cell guarantees the PIN persists as
    // text regardless of the column's provisioned format. Belt-and-suspenders
    // for layer 2 at the write site, not a replacement for bootstrap's format.
    var _pinRow = pendingSheet.getLastRow();
    pendingSheet.getRange(_pinRow, 5).setNumberFormat("@").setValue(pin);

    // 9 — best-effort admin notification (OK status only). Never rolls back the queue write.
    if (notificationStatus === NOTIFICATION_STATUS.OK) {
      try {
        sendSimpleEmail(
          adminEmail,
          "FamilyBank — new signup awaiting approval",
          "<p>A new family signup is pending approval.</p>" +
          "<p><b>Name:</b> " + name + "<br><b>Email:</b> " + email + "</p>" +
          "<p>Open the FamilyBank Admin Panel to approve or deny.</p>"
        );
      } catch(ee) { Logger.log("signup notify ERROR (non-fatal): " + ee); }
    }

    return _jsonOk({});  // v38 Step 6 (Dec-1): bare ok — echoing signupId/notificationStatus leaked honeypot-flag + admin-config state to the public caller.
  } catch(err) {
    Logger.log("signup ERROR: " + err);
    return _jsonError("internal");
  } finally {
    lock.releaseLock();
  }
}

/**
 * _routeAdminApprove(params) — Build Doc §4 Step 3, D6.5, D6.7
 * Approve a queued signup -> create the family row, index the email,
 * remove the queue row. Write route: LockService per D6.3.
 *
 * NOTE (Strake, build-time): the verbatim Build Doc §4 sequence omits an
 * adminPin-validation step. Added here as step 1 per Mike/Tern lock —
 * every other admin write validates adminPin and the Web App URL is the
 * auth boundary (no session). Build-doc-side miss; logged in handoff.
 *
 * Route sequence (verbatim from Build Doc §4 Step 3, with the added auth step):
 *   0. lock.waitLock(5000)
 *   1. validate adminPin against AdminConfig col A   [ADDED — doc gap]
 *   -  locate PendingSignups row by signupId; if not found -> error
 *      (this is the concurrency idempotency boundary — a second concurrent
 *       approve of the same signupId finds the row already deleted)
 *   0.5. SoT-scan Families for the signup email (idempotency): if a family
 *        already owns this email, a prior partial approval created the row;
 *        reuse that familyId and skip the row write (D6.7)
 *   1. write family row (single appendRow, full seeded state per locked seed)
 *      familyId minted collision-free vs Families AND DeletedFamilies,
 *      ADMIN-rejected uppercase-exact at this caller boundary (D6.5/D6.7)
 *   2. append EmailIndex row (skip if already present — D6.7)
 *   3. delete PendingSignups row
 *   4. _appendAuditRow (User=admin, FamilyId=<new familyId>,
 *                      Note="Approved signup: <email>")
 *   5. release lock (finally)
 */
function _routeAdminApprove(params) {
  var lock = LockService.getScriptLock();   // D6.3
  try {
    lock.waitLock(5000);

    // 1 — adminPin (ADDED per lock; doc gap).
    if (!_validateAdminPin(params.adminPin)) return _jsonError("auth");

    var signupId = String(params.signupId || "");
    if (!signupId) return _jsonError("badInput");

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var pendingSheet  = ss.getSheetByName(SCHEMA.PENDING_SIGNUPS.name);
    var familiesSheet = ss.getSheetByName(SCHEMA.FAMILIES.name);
    var emailIndex    = ss.getSheetByName(SCHEMA.EMAIL_INDEX.name);
    var deletedSheet  = ss.getSheetByName(SCHEMA.DELETED_FAMILIES.name);

    // Locate the signup row by signupId (bounded read, D6.2).
    var pLast = pendingSheet.getLastRow();
    var pRows = (pLast >= 2) ? pendingSheet.getRange(2, 1, pLast - 1, 7).getValues() : [];
    var sigRowIdx = -1, sigRow = null;
    for (var i = 0; i < pRows.length; i++) {
      if (String(pRows[i][0]) === signupId) { sigRowIdx = i + 2; sigRow = pRows[i]; break; }
    }
    // Not found -> already approved (concurrent/retry) or invalid. Idempotency boundary.
    if (sigRowIdx === -1) return _jsonError("signupNotFound");

    var name  = _normalizeDisplayName(sigRow[2]);
    var email = _normalizeEmail(sigRow[3]);
    var pin   = String(sigRow[4]);

    // 0.5 — idempotency scan: does a family already own this email?
    //   Bounded read Families A:B; scan-then-parse. On hit, reuse familyId,
    //   skip the row write (partial-retry safety, D6.7).
    var existingFamilyId = null;
    var fLast = familiesSheet.getLastRow();
    var fRows = (fLast >= 2) ? familiesSheet.getRange(2, 1, fLast - 1, 2).getValues() : [];
    for (var f = 0; f < fRows.length; f++) {
      var raw = fRows[f][1];
      if (!raw) continue;
      if (String(raw).toLowerCase().indexOf(email) === -1) continue;
      try {
        var st = JSON.parse(raw);
        var em = (st && st.config && st.config.emails) || {};
        for (var u in em) {
          if (em.hasOwnProperty(u) && _normalizeEmail(em[u]) === email) { existingFamilyId = String(fRows[f][0]); break; }
        }
      } catch(pe) {}
      if (existingFamilyId) break;
    }

    var familyId;
    if (existingFamilyId) {
      familyId = existingFamilyId;   // re-execute: reuse, skip row write (step 1)
    } else {
      // Mint familyId collision-free vs Families AND DeletedFamilies (D6.7),
      // ADMIN-rejected uppercase-exact at this caller boundary (D6.5).
      var taken = {};
      for (var a = 0; a < fRows.length; a++) { if (fRows[a][0]) taken[String(fRows[a][0])] = true; }
      var dLast = deletedSheet.getLastRow();
      if (dLast >= 2) {
        var dIds = deletedSheet.getRange(2, 1, dLast - 1, 1).getValues();
        for (var d = 0; d < dIds.length; d++) { if (dIds[d][0]) taken[String(dIds[d][0])] = true; }
      }
      familyId = null;
      for (var attempt = 0; attempt < 5; attempt++) {
        var cand = generateFamilyId();          // internally avoids Families collisions
        if (cand === "ADMIN") continue;          // D6.5 caller-side reject, uppercase-exact
        if (taken[cand]) continue;               // DeletedFamilies collision
        familyId = cand; break;
      }
      if (!familyId) throw new Error("adminApprove: familyId mint exhausted (collision/ADMIN)");

      // 1 — write family row: full seeded state per locked seed shape.
      //   buildDefaultState() config block reused; adminPin DROPPED (v38 admin
      //   auth is global in AdminConfig); emails reset to the signup parent;
      //   parent-only user set, children added in-app post Step 5.
      var base = buildDefaultState();
      var cfg  = base.config;
      delete cfg.adminPin;
      cfg.emails = {};
      cfg.emails[name] = email;
      var seed = {
        config:   cfg,
        users:    [name],
        pins:     {},
        roles:    {},
        children: {}
      };
      seed.pins[name]  = pin;
      seed.roles[name] = "parent";
      familiesSheet.appendRow([familyId, JSON.stringify(seed)]);
    }

    // 2 — append EmailIndex row (skip if already present — D6.7 idempotency).
    var eLast = emailIndex.getLastRow();
    var eRows = (eLast >= 2) ? emailIndex.getRange(2, 1, eLast - 1, 2).getValues() : [];
    var indexed = false;
    for (var e = 0; e < eRows.length; e++) {
      if (_normalizeEmail(eRows[e][0]) === email) { indexed = true; break; }
    }
    if (!indexed) emailIndex.appendRow([email, familyId]);

    // 3 — delete the queue row.
    pendingSheet.deleteRow(sigRowIdx);

    // 4 — audit row (last write inside lock — D6.5).
    _appendAuditRow(familyId, "admin", "", "Approved signup: " + email, "");
    // TODO: Welcome email mechanism — Open Item #1; not implemented in v38 launch.

    return _jsonOk({ familyId: familyId });
  } catch(err) {
    Logger.log("adminApprove ERROR: " + err);
    return _jsonError("internal");
  } finally {
    lock.releaseLock();
  }
}

/** v43-1 — the family's login emails, normalized, as a set. */
function _familyEmailSet(state) {
  var out = {}, em = (state && state.config && state.config.emails) || {};
  for (var u in em) {
    if (!em.hasOwnProperty(u)) continue;
    var e = _normalizeEmail(em[u]);
    if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) out[e] = true;   // v43-5 — real emails only (a placeholder like "none" typed in Child Profile is never indexed or "taken"; a stray Rebuild row for one is harmless)
  }
  return out;
}
/** v43-1 — what this save changes in EmailIndex (null = nothing; the tab is only read when the
 *  family's emails changed). {taken: email} when a NEW email already belongs to another family.
 *  Also re-adds this family's emails that are missing from the tab (older saves never wrote them). */
function _emailIndexPlan(familyId, current, body) {
  var oldS = _familyEmailSet(current), newS = _familyEmailSet(body);
  var added = Object.keys(newS).filter(function(e) { return !oldS[e]; });
  var removed = Object.keys(oldS).filter(function(e) { return !newS[e]; });
  if (!added.length && !removed.length) return null;
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEMA.EMAIL_INDEX.name);
  if (!sh) return null;
  var last = sh.getLastRow(), mine = {}, other = {};
  (last >= 2 ? sh.getRange(2, 1, last - 1, 2).getValues() : []).forEach(function(r) {
    var e = _normalizeEmail(r[0]); if (!e) return;
    if (String(r[1]) === familyId) mine[e] = true; else other[e] = String(r[1]);
  });
  for (var i = 0; i < added.length; i++) if (other[added[i]]) return {taken: added[i]};
  var ps = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEMA.PENDING_SIGNUPS.name);   // v43-4 (#5) — waiting signups own their email too
  if (ps && added.length) {
    var pl = ps.getLastRow(), pend = {};
    (pl >= 2 ? ps.getRange(2, 4, pl - 1, 1).getValues() : []).forEach(function(r) { var e = _normalizeEmail(r[0]); if (e) pend[e] = true; });
    for (var j = 0; j < added.length; j++) if (pend[added[j]]) return {taken: added[j]};
  }
  return {
    append: Object.keys(newS).filter(function(e) { return !mine[e] && !other[e]; }),
    drop:   removed.filter(function(e) { return mine[e]; })
  };
}
/** v43-1 — write the plan (inside the save lock, after the save). */
function _emailIndexApply(familyId, plan) {
  if (!plan || (!plan.append.length && !plan.drop.length)) return;
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEMA.EMAIL_INDEX.name);
  if (!sh) return;
  var last = sh.getLastRow();
  if (plan.drop.length && last >= 2) {
    var rows = sh.getRange(2, 1, last - 1, 2).getValues();
    for (var i = rows.length - 1; i >= 0; i--) {   // bottom-up keeps the row numbers valid
      if (String(rows[i][1]) === familyId && plan.drop.indexOf(_normalizeEmail(rows[i][0])) !== -1) sh.deleteRow(i + 2);
    }
  }
  plan.append.forEach(function(e) { sh.appendRow([e, familyId]); });
  Logger.log("EmailIndex: [" + familyId + "] +" + plan.append.length + " / -" + plan.drop.length);
}

/**
 * _routeLoginByEmail(params) — Build Doc §4 Step 3, D6.2
 * Email-first login. READ-ONLY — no lock. Every failure path returns the
 * SAME generic error shape (no "wrong PIN" vs "no such email" leakage).
 *
 * Route sequence (verbatim):
 *   1. _normalizeEmail(email); validate format; reject (generic) on invalid
 *   2. bounded read of EmailIndex col A:B; build Map<email, familyId>
 *   3. lookup email; if not found, return generic error
 *   4. read Families row for familyId; if missing (race vs concurrent
 *      delete), return generic error
 *   5. parse state JSON; find user where state.config.emails[user] === email
 *   6. validate PIN against state.pins[user]; on mismatch, return generic
 *      error (same shape as step 3)
 *   7. return {familyId, displayName: user}
 */
function _routeLoginByEmail(params) {
  try {
    // 1 — normalize + format. Generic error on any failure (D5).
    var email = _normalizeEmail(params.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return _jsonError("loginFailed");

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 2 — bounded read EmailIndex A:B -> Map (D6.2).
    var emailIndex = ss.getSheetByName(SCHEMA.EMAIL_INDEX.name);
    var map = {};
    var eLast = emailIndex.getLastRow();
    if (eLast >= 2) {
      var eRows = emailIndex.getRange(2, 1, eLast - 1, 2).getValues();
      for (var i = 0; i < eRows.length; i++) {
        var k = _normalizeEmail(eRows[i][0]);
        if (k) map[k] = String(eRows[i][1]);
      }
    }

    // 3 — lookup.
    var familyId = map[email];
    if (!familyId) return _jsonError("loginFailed");

    // 4 — read Families row for familyId (race vs concurrent delete -> generic).
    var familiesSheet = ss.getSheetByName(SCHEMA.FAMILIES.name);
    var raw = null;
    var fLast = familiesSheet.getLastRow();
    if (fLast >= 2) {
      var fRows = familiesSheet.getRange(2, 1, fLast - 1, 2).getValues();
      for (var f = 0; f < fRows.length; f++) {
        if (String(fRows[f][0]) === familyId) { raw = fRows[f][1]; break; }
      }
    }
    if (!raw) return _jsonError("loginFailed");

    // 5 — parse; find the user owning this email.
    var state;
    try { state = JSON.parse(raw); } catch(pe) { return _jsonError("loginFailed"); }
    var emails = (state && state.config && state.config.emails) || {};
    // 6 — PIN check (String() coercion per D6.4 read-side). Generic on mismatch.
    // v43-1 — an email can be shared inside a family (a young child using a parent's email): the
    // user is the one with this email whose PIN matches.
    var pins = (state && state.pins) || {};
    var user = null;
    for (var u in emails) {
      if (emails.hasOwnProperty(u) && _normalizeEmail(emails[u]) === email && String(pins[u]) === String(params.pin)) { user = u; break; }
    }
    if (!user) return _jsonError("loginFailed");

    // 7 — success.
    return _jsonOk({ familyId: familyId, displayName: user });
  } catch(err) {
    Logger.log("loginByEmail ERROR: " + err);
    return _jsonError("loginFailed");   // generic even on internal error — no leakage
  }
}

/**
 * _routeAdminDeny(params) — Build Doc §4 Step 3, D6.6
 * Deny a queued signup -> remove the queue row, audit it. Write route: lock.
 *
 * Route sequence (verbatim):
 *   0. lock.waitLock(5000)
 *   1. validate adminPin against AdminConfig col A
 *   2. find PendingSignups row by signupId; if not found, return error
 *   3. capture email from row before delete (for Ledger note)
 *   4. delete PendingSignups row
 *   5. (optional, deferred — Open Item #1) send denial email to applicant
 *   6. _appendAuditRow (User=admin, FamilyId=ADMIN, Note="Denied signup: <email>")
 *   7. release lock (finally)
 */
function _routeAdminDeny(params) {
  var lock = LockService.getScriptLock();   // D6.3
  try {
    lock.waitLock(5000);

    // 1 — adminPin.
    if (!_validateAdminPin(params.adminPin)) return _jsonError("auth");

    var signupId = String(params.signupId || "");
    if (!signupId) return _jsonError("badInput");

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var pendingSheet = ss.getSheetByName(SCHEMA.PENDING_SIGNUPS.name);

    // 2 — locate by signupId (bounded read, D6.2).
    var pLast = pendingSheet.getLastRow();
    var pRows = (pLast >= 2) ? pendingSheet.getRange(2, 1, pLast - 1, 7).getValues() : [];
    var rowIdx = -1, row = null;
    for (var i = 0; i < pRows.length; i++) {
      if (String(pRows[i][0]) === signupId) { rowIdx = i + 2; row = pRows[i]; break; }
    }
    if (rowIdx === -1) return _jsonError("signupNotFound");

    // 3 — capture email BEFORE delete (for the Ledger note).
    var email = _normalizeEmail(row[3]);

    // 4 — delete.
    pendingSheet.deleteRow(rowIdx);

    // 5 — TODO: denial email mechanism — Open Item #1; not implemented in v38 launch.

    // 6 — audit (last write inside lock — D6.5). Global action -> FamilyId=ADMIN.
    _appendAuditRow(ADMIN_FAMILY_SENTINEL, "admin", "", "Denied signup: " + email, "");

    return _jsonOk({});
  } catch(err) {
    Logger.log("adminDeny ERROR: " + err);
    return _jsonError("internal");
  } finally {
    lock.releaseLock();
  }
}

/**
 * _routeSetChildEmail(params) — Build Doc §4 Step 3, D6.2
 * Admin path for editing a user's email (parent or child). Write route: lock.
 * Updates EmailIndex in place (or appends) and mutates state via saveState.
 *
 * Route sequence (verbatim):
 *   0. lock.waitLock(5000)
 *   1. validate adminPin against AdminConfig col A
 *   2. _normalizeEmail(newEmail); validate format
 *   3. SoT-scan EmailIndex col A for newEmail; if found on a different user
 *      (different family OR different user in this family), reject (uniqueness)
 *   4. read Families row for familyId; parse state
 *   5. if state.config.emails[childName] === newEmail (after normalize),
 *      no-op success and return
 *   6. if user previously had no email, appendRow [newEmail, familyId];
 *      otherwise scan EmailIndex col A for the old email and update in place
 *   7. update state.config.emails[childName] = newEmail; saveState
 *   8. _appendAuditRow (User=admin, FamilyId=<familyId>,
 *                      Note="Child email updated: <childName>")
 *   9. release lock (finally)
 */
function _routeSetChildEmail(params) {
  var lock = LockService.getScriptLock();   // D6.3
  try {
    lock.waitLock(5000);

    // 1 — adminPin.
    if (!_validateAdminPin(params.adminPin)) return _jsonError("auth");

    var familyId  = String(params.familyId || "");
    var childName = String(params.childName || "");
    if (!familyId || !childName) return _jsonError("badInput");

    // 2 — normalize + format newEmail.
    var newEmail = _normalizeEmail(params.newEmail);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return _jsonError("badInput");

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var emailIndex    = ss.getSheetByName(SCHEMA.EMAIL_INDEX.name);
    var familiesSheet = ss.getSheetByName(SCHEMA.FAMILIES.name);

    // 3 (part A) — EmailIndex scan for newEmail. Different-family match -> reject now.
    //   Same-family match resolved against state below (different user -> reject).
    var eLast = emailIndex.getLastRow();
    var eRows = (eLast >= 2) ? emailIndex.getRange(2, 1, eLast - 1, 2).getValues() : [];
    var newEmailRowIdx = -1, newEmailFamily = null;
    for (var i = 0; i < eRows.length; i++) {
      if (_normalizeEmail(eRows[i][0]) === newEmail) {
        newEmailRowIdx = i + 2;
        newEmailFamily = String(eRows[i][1]);
        break;
      }
    }
    if (newEmailRowIdx !== -1 && newEmailFamily !== familyId) {
      return _jsonError("duplicateEmail");   // different family owns it
    }

    // 4 — read + parse the family state.
    var raw = null, rowIdx = -1;
    var fLast = familiesSheet.getLastRow();
    if (fLast >= 2) {
      var fRows = familiesSheet.getRange(2, 1, fLast - 1, 2).getValues();
      for (var f = 0; f < fRows.length; f++) {
        if (String(fRows[f][0]) === familyId) { raw = fRows[f][1]; rowIdx = f + 2; break; }
      }
    }
    if (!raw) return _familyNotFoundResponse();
    var state;
    try { state = JSON.parse(raw); } catch(pe) { return _jsonError("internal"); }
    if (!state.config)        state.config = {};
    if (!state.config.emails) state.config.emails = {};

    // 3 (part B) — same-family uniqueness: if newEmail already belongs to a
    //   DIFFERENT user in this family, reject.
    if (newEmailRowIdx !== -1 && newEmailFamily === familyId) {
      for (var u in state.config.emails) {
        if (state.config.emails.hasOwnProperty(u) &&
            _normalizeEmail(state.config.emails[u]) === newEmail &&
            u !== childName) {
          return _jsonError("duplicateEmail");
        }
      }
    }

    // 5 — no-op if unchanged.
    var oldEmail = _normalizeEmail(state.config.emails[childName]);
    if (oldEmail === newEmail) return _jsonOk({ noop: true });

    // 6 — EmailIndex: append if user had no email, else update old row in place.
    if (!oldEmail) {
      emailIndex.appendRow([newEmail, familyId]);
    } else {
      var oldRowIdx = -1;
      for (var j = 0; j < eRows.length; j++) {
        if (_normalizeEmail(eRows[j][0]) === oldEmail) { oldRowIdx = j + 2; break; }
      }
      if (oldRowIdx !== -1) {
        emailIndex.getRange(oldRowIdx, 1).setValue(newEmail);   // update col A in place (D6.2)
      } else {
        emailIndex.appendRow([newEmail, familyId]);             // index-drift fallback
      }
    }

    // 7 — mutate state + persist (saveState invalidates the family cache).
    state.config.emails[childName] = newEmail;
    saveState(familyId, state);

    // 8 — audit (last write inside lock — D6.5).
    _appendAuditRow(familyId, "admin", "", "Child email updated: " + childName, "");

    return _jsonOk({});
  } catch(err) {
    Logger.log("setChildEmail ERROR: " + err);
    return _jsonError("internal");
  } finally {
    lock.releaseLock();
  }
}

/**
 * _routeRebuildEmailIndex(params) — Build Doc §4 Step 3, D6.2
 * Rebuild EmailIndex from Families (admin-callable + scheduled). Write: lock.
 * Build in memory, then a single atomic setValues over the full range.
 *
 * Route sequence (verbatim):
 *   0. lock.waitLock(5000)
 *   1. validate adminPin
 *   2. bounded read of Families col A:B
 *   3. iterate; for each family row, parse state, emit [email, familyId]
 *      for every state.config.emails[user] non-empty after _normalizeEmail
 *   4. setValues over EmailIndex full range with new index
 *      (atomic overwrite, no separate clear)
 *   5. _appendAuditRow (User=admin, FamilyId=ADMIN, Note="Rebuilt email index")
 *   6. release lock (finally)
 */
function _routeRebuildEmailIndex(params) {
  var lock = LockService.getScriptLock();   // D6.3
  try {
    lock.waitLock(5000);

    // 1 — adminPin.
    if (!_validateAdminPin(params.adminPin)) return _jsonError("auth");

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var familiesSheet = ss.getSheetByName(SCHEMA.FAMILIES.name);
    var emailIndex    = ss.getSheetByName(SCHEMA.EMAIL_INDEX.name);

    // 2 — bounded read Families A:B (D6.2).
    var newRows = [];
    var fLast = familiesSheet.getLastRow();
    if (fLast >= 2) {
      var fRows = familiesSheet.getRange(2, 1, fLast - 1, 2).getValues();
      // 3 — emit [email, familyId] for every non-empty email across all users.
      for (var i = 0; i < fRows.length; i++) {
        var familyId = String(fRows[i][0]);
        var raw = fRows[i][1];
        if (!familyId || !raw) continue;
        var state;
        try { state = JSON.parse(raw); } catch(pe) { continue; }
        var emails = (state && state.config && state.config.emails) || {};
        for (var u in emails) {
          if (!emails.hasOwnProperty(u)) continue;
          var em = _normalizeEmail(emails[u]);
          if (em) newRows.push([em, familyId]);
        }
      }
    }

    // 4 — atomic overwrite. Pad to cover any stale tail rows so the single
    //   setValues blanks them (no separate clear — D6.2).
    var existingDataRows = Math.max(0, emailIndex.getLastRow() - 1);
    var writeCount = Math.max(existingDataRows, newRows.length);
    if (writeCount > 0) {
      var padded = newRows.slice();
      while (padded.length < writeCount) padded.push(["", ""]);
      emailIndex.getRange(2, 1, writeCount, 2).setValues(padded);
    }

    // 5 — audit (last write inside lock — D6.5). Global action -> FamilyId=ADMIN.
    _appendAuditRow(ADMIN_FAMILY_SENTINEL, "admin", "", "Rebuilt email index", "");

    return _jsonOk({ indexedCount: newRows.length });
  } catch(err) {
    Logger.log("rebuildEmailIndex ERROR: " + err);
    return _jsonError("internal");
  } finally {
    lock.releaseLock();
  }
}

/**
 * _routeAdminDeleteFamily(params) — Build Doc §4 Step 3, D6.7
 * Delete a family: snapshot emails BEFORE scrub, scrub EmailIndex, delete
 * the family row, idempotent tombstone, audit. Write route: lock.
 * Idempotent on re-execute (DW-13) — every write step is a safe no-op when
 * the data is already gone (D6.7).
 *
 * NOTE (Strake, build-time): like adminApprove, the verbatim Build Doc §4
 * sequence omits the adminPin step. Added as step 1 per the locked universal
 * principle (every admin write validates adminPin; URL is the auth boundary).
 * Logged in handoff as the second instance of the same doc gap.
 *
 * Route sequence (verbatim, with the added auth step):
 *   0. lock.waitLock(5000)
 *   1. validate adminPin against AdminConfig col A   [ADDED — doc gap]
 *   0.5. snapshot family row state.config.emails into memory
 *        (BEFORE any scrub — the only surviving data source for the tombstone)
 *   1. scrub EmailIndex rows for familyId
 *   2. delete family row
 *   3. read DeletedFamilies col A; if familyId absent, append tombstone
 *      [familyId, deletedAt, emailsAtDeletion (normalized, dedup, sorted, joined)]
 *   4. _appendAuditRow (User=admin, FamilyId=<familyId>, Note="Deleted family")
 *   5. release lock (finally)
 */
function _routeAdminDeleteFamily(params) {
  var lock = LockService.getScriptLock();   // D6.3
  try {
    lock.waitLock(5000);

    // 1 — adminPin (ADDED per lock; doc gap).
    if (!_validateAdminPin(params.adminPin)) return _jsonError("auth");

    var familyId = String(params.familyId || "");
    if (!familyId) return _jsonError("badInput");

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var familiesSheet = ss.getSheetByName(SCHEMA.FAMILIES.name);
    var emailIndex    = ss.getSheetByName(SCHEMA.EMAIL_INDEX.name);
    var deletedSheet  = ss.getSheetByName(SCHEMA.DELETED_FAMILIES.name);

    // 0.5 — snapshot emails BEFORE any scrub (D6.7). Empty if row already gone.
    var snapshotEmails = [];
    var familyRowIdx = -1;
    var fLast = familiesSheet.getLastRow();
    if (fLast >= 2) {
      var fRows = familiesSheet.getRange(2, 1, fLast - 1, 2).getValues();
      for (var f = 0; f < fRows.length; f++) {
        if (String(fRows[f][0]) === familyId) {
          familyRowIdx = f + 2;
          try {
            var st = JSON.parse(fRows[f][1]);
            var em = (st && st.config && st.config.emails) || {};
            for (var u in em) {
              if (em.hasOwnProperty(u)) {
                var v = _normalizeEmail(em[u]);
                if (v) snapshotEmails.push(v);
              }
            }
          } catch(pe) {}
          break;
        }
      }
    }

    // 1 — scrub EmailIndex rows for familyId (delete bottom-up to keep indices stable).
    var eLast = emailIndex.getLastRow();
    if (eLast >= 2) {
      var eRows = emailIndex.getRange(2, 1, eLast - 1, 2).getValues();
      var toDelete = [];
      for (var e = 0; e < eRows.length; e++) {
        if (String(eRows[e][1]) === familyId) toDelete.push(e + 2);
      }
      for (var k = toDelete.length - 1; k >= 0; k--) emailIndex.deleteRow(toDelete[k]);
    }

    // 2 — delete the family row (no-op if already gone).
    if (familyRowIdx !== -1) familiesSheet.deleteRow(familyRowIdx);

    // 3 — idempotent tombstone. Append only if familyId absent from DeletedFamilies col A.
    var alreadyTombstoned = false;
    var dLast = deletedSheet.getLastRow();
    if (dLast >= 2) {
      var dIds = deletedSheet.getRange(2, 1, dLast - 1, 1).getValues();
      for (var d = 0; d < dIds.length; d++) {
        if (String(dIds[d][0]) === familyId) { alreadyTombstoned = true; break; }
      }
    }
    if (!alreadyTombstoned) {
      // emailsAtDeletion: normalized, deduped, sorted, comma-joined (D6.7).
      var seen = {}, dedup = [];
      for (var s = 0; s < snapshotEmails.length; s++) {
        if (!seen[snapshotEmails[s]]) { seen[snapshotEmails[s]] = true; dedup.push(snapshotEmails[s]); }
      }
      dedup.sort();
      deletedSheet.appendRow([familyId, new Date().toISOString(), dedup.join(",")]);
    }

    // 4 — audit (last write inside lock — D6.5). Family-scoped -> FamilyId=<familyId>.
    _appendAuditRow(familyId, "admin", "", "Deleted family", "");

    return _jsonOk({});
  } catch(err) {
    Logger.log("adminDeleteFamily ERROR: " + err);
    return _jsonError("internal");
  } finally {
    lock.releaseLock();
  }
}

// ================================================================
// [v38 STEP 5 BACKEND] — admin-panel read routes (Strake continuation)
//   Two READ-ONLY routes for the Step 5 admin panel. Both are pure
//   reads: NO LockService.getScriptLock(), NO _appendAuditRow — no
//   state writes, no race risk (Tern's note; reveal-audit declined
//   per Q1). PIN-gated (D6.4 line 1), bounded reads (D6.2). Dispatched
//   from doGet in Lath's admin-read block.
// ================================================================

/**
 * _routeAdminListPendingSignups(params) — D6.6 (queue read for admin panel)
 * Read-only. Returns the PendingSignups queue for the admin UI, oldest-first
 * (FIFO). PIN is masked ("***"); the real PIN is never read into this payload
 * — reveal is a separate route (_routeAdminRevealSignupPin). No lock
 * (read-only). Bounded read per D6.2. PIN-gated per D6.4.
 *
 * Sequence:
 *   1. validate adminPin (auth)
 *   2. bounded read PendingSignups cols 1-4 [signupId, submittedAt, name, email]
 *      (col 5 pin deliberately NOT read — security property; keep it)
 *   3. sort ascending by submittedAt (ISO-8601 lexicographic == chronological)
 *   4. map to {signupId, name, email, submittedAt, pin:"***"}
 *   5. return {status:"ok", signups:[...]}
 */
function _routeAdminListPendingSignups(params) {
  try {
    if (!_validateAdminPin(params.adminPin)) return _jsonError("auth");

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var pendingSheet = ss.getSheetByName(SCHEMA.PENDING_SIGNUPS.name);

    var n = Math.max(0, pendingSheet.getLastRow() - 1);
    var rows = n ? pendingSheet.getRange(2, 1, n, 4).getValues() : [];  // cols A-D only

    var signups = rows
      .filter(function(r) { return r[0]; })  // skip any blank-id rows
      .map(function(r) {
        return {
          signupId:    String(r[0]),
          submittedAt: String(r[1]),
          name:        String(r[2]),
          email:       String(r[3]),
          pin:         "***"
        };
      })
      .sort(function(a, b) {
        return a.submittedAt < b.submittedAt ? -1
             : a.submittedAt > b.submittedAt ?  1 : 0;
      });

    return _jsonOk({ signups: signups });
  } catch(err) {
    Logger.log("adminListPendingSignups ERROR: " + err);
    return _jsonError("internal");
  }
}

/**
 * _routeAdminRevealSignupPin(params) — D6.6 (reveal-on-demand)
 * Read-only. Returns the actual PIN for ONE PendingSignups row by signupId.
 * Frontend surfaces it briefly then re-masks; backend just returns it on a
 * valid, PIN-gated request. No lock (read-only). Bounded read per D6.2.
 * D6.4 layer-3 String() coercion on the returned PIN (the B1 leading-zero
 * guard — "0000" must not come back as "0").
 *
 * AUDIT: none. Q1 locked — pure read, consistent with sibling read routes;
 * reveal events are not logged to the Ledger.
 *
 * Sequence:
 *   1. validate adminPin (auth)
 *   2. validate signupId present (badInput if missing/empty)
 *   3. bounded read PendingSignups cols 1 + 5 [signupId, ..., pin]
 *   4. locate row where col A === signupId; not found -> signupNotFound
 *      (reuses Strake's Step 3 not-found semantics; caller is already
 *       PIN-authed and got the id from Route A, so not-found signals a
 *       concurrent approve/deny, not an enumeration leak)
 *   5. return {status:"ok", pin: String(<col E>)}
 */
function _routeAdminRevealSignupPin(params) {
  try {
    if (!_validateAdminPin(params.adminPin)) return _jsonError("auth");

    var signupId = String(params.signupId || "");
    if (!signupId) return _jsonError("badInput");

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var pendingSheet = ss.getSheetByName(SCHEMA.PENDING_SIGNUPS.name);

    var n = Math.max(0, pendingSheet.getLastRow() - 1);
    var rows = n ? pendingSheet.getRange(2, 1, n, 5).getValues() : [];  // cols A-E

    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === signupId) {
        return _jsonOk({ pin: String(rows[i][4]) });  // D6.4 layer-3 read coercion
      }
    }
    return _jsonError("signupNotFound");
  } catch(err) {
    Logger.log("adminRevealSignupPin ERROR: " + err);
    return _jsonError("internal");
  }
}

function cleanOrphanedStateKeys(familyId) {
  // v38 — pass familyId from the IDE: cleanOrphanedStateKeys("fam_xxxxx")
  if (!familyId) throw new Error("cleanOrphanedStateKeys: familyId required");
  Logger.log("cleanOrphanedStateKeys: loading state...");
  var state = loadState(familyId);
  var keysToRemove = [
    "_deletedChoreName", "_deletedChoreTitle", "_deletedChoreId",
    "_approvedChoreName", "_approvedChoreTitle", "_approvedChoreId", "_approvedChoreSchedule",
    "_editedChoreName", "_editedChoreId",
    "_deletedCalEventIds", "_deletedCalEventId", "_approvedCalEventId"
  ];
  var removed = [];
  keysToRemove.forEach(function(k) {
    if (state.hasOwnProperty(k)) {
      delete state[k];
      removed.push(k);
    }
  });
  if (removed.length) {
    saveState(familyId, state);
    Logger.log("cleanOrphanedStateKeys: removed " + removed.length + " key(s): " + removed.join(", "));
    Logger.log("cleanOrphanedStateKeys: state saved. You are good to go!");
  } else {
    Logger.log("cleanOrphanedStateKeys: no orphaned keys found — state is already clean.");
  }
}

/** REQUIRED: Run once after pasting this file to authorize Gmail */
function grantEmailPermission() {
  MailApp.sendEmail({
    to:      Session.getActiveUser().getEmail(),
    subject: BANK_NAME + " — Gmail permission granted ✓",
    body:    "Gmail access is now authorized. You can delete this message."
  });
  Logger.log("grantEmailPermission: done — Gmail is now authorized");
}

/** Test: manually trigger Monday allowance */
function runAllowanceNow()     { automatedMondayDeposit(); }

/** Test: manually trigger monthly interest + statements */
function runInterestNow()      { monthlyMaintenance(); }

/** Test: manually trigger daily chore reset */
function runChoreResetNow()    { dailyChoreReset(); }

/** Test: manually trigger Sunday reminder emails */
function runSundayReminderNow(){ sundayChoreReminder(); }

/** Debug: print current state to Execution Log */
function printState(familyId) {
  // v38 — pass familyId from the IDE: printState("fam_xxxxx")
  if (!familyId) throw new Error("printState: familyId required");
  var s = loadState(familyId);
  Logger.log("=== FAMILY BANK STATE ===");
  Logger.log("Bank: " + getBankName(s));
  Logger.log("Users: " + JSON.stringify(s.users));
  Logger.log("Roles: " + JSON.stringify(s.roles));
  getChildNames(s).forEach(function(c) {
    var d = s.children[c];
    Logger.log(c + ": CHK=$" + (d.balances.checking||0).toFixed(2)
      + " SAV=$" + (d.balances.savings||0).toFixed(2)
      + " Chores:" + (d.chores||[]).length
      + " Email:" + getEmailFor(s, c));
  });
}

/**
 * DANGER: Wipe everything and reset to defaults.
 * Set CONFIRM = true to actually run this. Cannot be undone.
 */
function DANGER_resetEverything() {
  // v38 deprecation guard — this v36.1 helper would corrupt the
  // row-per-family Sheet. The v38 way to reset a single family is
  // adminDeleteFamily (Step 3). The v38 way to reset the entire DEV
  // Sheet is to clear it by hand and re-run bootstrapAdmin. There is
  // no "reset everything" route in v38.
  throw new Error("DANGER_resetEverything is deprecated in v38. " +
    "To reset a family: use adminDeleteFamily (Step 3). " +
    "To reset the DEV Sheet: clear it by hand and re-run bootstrapAdmin.");
}

// ================================================================
// [SHARE CHILD] v35.0 Item 3 — REMOVED in v36.0
// The diff-based approach fired welcome emails on child deletion and
// other stale-priorState cases. Feature reverted; revisit with an
// explicit lastAction === "Child Shared" marker in a future version.
// ================================================================

// ================================================================
// v35.0 Item 2 — handleWithdrawalEmailAction
// Processes approve/deny links for child withdrawal requests.
// URL format: ?action=withdrawApprove&withdrawalId=wd_123&child=Linnea&token=ABC
// ================================================================
function handleWithdrawalEmailAction(params) {
  var action       = params.action;
  var withdrawalId = params.withdrawalId;
  var child        = params.child;
  var token        = params.token;
  var familyId     = params.familyId || "";

  if (!familyId) {
    return ContentService
      .createTextOutput(JSON.stringify({status: "error", reason: "familyNotFound"}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var expectedToken = generateToken(withdrawalId, action);
  if (token !== expectedToken) {
    return buildActionPage("❌ Invalid or Expired Link",
      "This link is no longer valid. Please open the app to manage withdrawals.",
      "#ef4444");
  }

  var _page = _withSaveLock(function() {   // v39-1 — fresh read + lock
  try {
    var state = loadState(familyId, {fresh: true});
    if (state && state.status === "error") {
      return ContentService
        .createTextOutput(JSON.stringify(state))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var data = state.children && state.children[child];
    if (!data) return buildActionPage("❌ Error", "Child account not found.", "#ef4444");

    var pending = data.pendingWithdrawals || [];
    var wd = null;
    for (var i = 0; i < pending.length; i++) {
      if (pending[i].id === withdrawalId) { wd = pending[i]; break; }
    }
    if (!wd) return buildActionPage("✅ Already Processed",
      "This withdrawal has already been handled.", "#10b981");

    var ledger = getLedgerSheet();
    var tz     = getTimezone(state);
    var now    = Utilities.formatDate(new Date(), tz, "MMM d, yyyy h:mm a");

    if (action === "withdrawApprove") {
      if (wd.amount > (data.balances.checking || 0)) {
        return buildActionPage("❌ Insufficient Funds",
          child + " only has $" + (data.balances.checking || 0).toFixed(2) + " in checking — can\'t approve a $" +
          wd.amount.toFixed(2) + " withdrawal. Ask them to reduce the amount.",
          "#ef4444");
      }
      data.balances.checking -= wd.amount;
      ledger.appendRow([now, familyId, child, child, "Withdraw: " + (wd.note || ""), -wd.amount]);
      data.pendingWithdrawals = pending.filter(function(p){ return p.id !== withdrawalId; });
      state.children[child] = data;
      saveState(familyId, state);

      // Notify child
      var childEmail = getEmailFor(state, child);
      if (childEmail && notifyEmail(state, child)) {
        var html = buildSimpleEmailHtml(state,
          "✅ Withdrawal approved, " + child + "!",
          "Your withdrawal request was approved.",
          [
            {label: "Amount",           val: "$" + wd.amount.toFixed(2)},
            {label: "Note",             val: wd.note || "—"},
            {label: "Checking Balance", val: "$" + data.balances.checking.toFixed(2)}
          ],
          ""
        );
        sendSimpleEmail(childEmail, getBankName(state) + " — Your withdrawal was approved 💸", html);
      }
      return buildActionPage("✅ Withdrawal Approved!",
        "<strong>$" + wd.amount.toFixed(2) + "</strong> withdrawn for " + child + ".<br><br>" +
        "Checking balance: $" + data.balances.checking.toFixed(2),
        "#10b981");

    } else { // withdrawDeny
      data.pendingWithdrawals = pending.filter(function(p){ return p.id !== withdrawalId; });
      state.children[child] = data;
      saveState(familyId, state);

      var childEmail = getEmailFor(state, child);
      if (childEmail && notifyEmail(state, child)) {
        var html = buildSimpleEmailHtml(state,
          "Withdrawal update for " + child,
          "Your withdrawal request of $" + wd.amount.toFixed(2) + " was not approved this time. Talk to " + getParentName(state) + " if you have questions.",
          [], ""
        );
        sendSimpleEmail(childEmail, getBankName(state) + " — Withdrawal update", html);
      }
      return buildActionPage("❌ Withdrawal Denied",
        "The withdrawal request of <strong>$" + wd.amount.toFixed(2) + "</strong> for " + child + " has been denied. No money was deducted.",
        "#f59e0b");
    }
  } catch(err) {
    Logger.log("handleWithdrawalEmailAction ERROR: " + err);
    return buildActionPage("❌ Error", "Something went wrong: " + err.toString(), "#ef4444");
  }
  });
  return _page || buildActionPage("⏳ Busy", "The bank is saving something else right now — please tap the link again in a moment.", "#f59e0b");
}

// v35.0 Item 2 — lookup last "Withdraw:" ledger row for a child (used by approval email)
function getLastWithdrawEntry(familyId, childName) {
  // v38 6-column Ledger: [Date, FamilyId, User, Child, Note, Amount].
  if (!familyId) return null;
  try {
    var ledger = getLedgerSheet();
    var rows = ledger.getDataRange().getValues();
    for (var i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][1]) !== familyId) continue;
      if (rows[i][3] === childName && String(rows[i][4] || "").indexOf("Withdraw:") === 0) {
        return rows[i];
      }
    }
  } catch(e) { Logger.log("getLastWithdrawEntry ERROR: " + e); }
  return null;
}
