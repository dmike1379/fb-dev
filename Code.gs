/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║              FAMILY BANK — Code.gs (Google Apps Script)      ║
 * ║                     Backend & Email Engine                   ║
 * ║                     v37.0.2 — Signup-diff suppression hotfiX ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * HOW TO DEPLOY (do this in order, every time you update this file):
 *
 *   STEP 1 — Edit the CONFIG block below to match your family (if first-time)
 *   STEP 2 — Paste this entire file into the Apps Script editor
 *   STEP 3 — Click Save (floppy disk icon or Ctrl+S)
 *   STEP 4 — (First-time only) Select "grantEmailPermission" → click Run
 *             (approve any permissions it asks for)
 *   STEP 5 — (First-time only) Select "setupBank" → click Run
 *             Check the Execution Log — it should say "setupBank: done."
 *   STEP 6 — (v37.0 migration only, one-time) Select "migrateToRowPerFamily" → Run
 *             Reads existing A1 blob, splits into per-family rows.
 *             (Skip this on v37.0.2 redeploy — already migrated.)
 *   STEP 7 — Click Deploy → Manage Deployments
 *             Click the pencil/edit icon on your deployment
 *             Change Version to "New version" → click Deploy
 *   STEP 8 — Copy the new Web App URL → paste into app.js at API_URL (line ~39)
 *
 * NOTE: v37.0.2 is a hotfix over a live v37.0.1 deployment. You do NOT need
 *       to re-run setupBank or migrateToRowPerFamily. Paste, Save, Deploy,
 *       copy new URL, update app.js.
 *
 * v37.0 ARCHITECTURE NOTES:
 *   - Row-per-family: col A = familyId, col B = state JSON
 *   - Ledger has new "FamilyId" column (col B, existing columns shift)
 *   - New "AuditLog" sheet tracks destructive/structural actions
 *   - Every doPost/doGet requires familyId (body or query param)
 *
 * v37.0.1 CHANGE (additive, no migration impact):
 *   - New doPost intercept: body._sendWelcomeEmail = {recipient, name, role, defaultPin}
 *     Fires a single welcome email server-side. Fire-and-forget pattern.
 *
 * v37.0.2 CHANGE (additive hotfix — Bug #2 from v37.0.1 audit):
 *   - doPost honors body._suppressSignupDiff === true to skip processSignupDiff().
 *     Client sets this on the admin's Step-2 cleanup POST in approvePendingRequest,
 *     so the diff engine doesn't mis-identify a multi-family approval as a denial
 *     and send a denial email to the approved user.
 *   - Flag is stripped from the saved state (never persisted to the sheet).
 *   - All other signup flows (new request added, deny) are unaffected — they
 *     still run processSignupDiff normally.
 *   - NO schema change. Safe to deploy on top of a v37.0.1 sheet.
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
// TIMEZONE
// Choices: "America/New_York"  "America/Chicago"  "America/Denver"
//          "America/Los_Angeles"  "UTC"  "Europe/London"
// ------------------------------------------------------------------
var BANK_TIMEZONE = "America/New_York";    // ← Your timezone

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
var CODE_VERSION = "v37.0.2"; // ← increment on each Code.gs redeploy

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

    // ── Email approve/deny action handlers (chores/deposits/withdrawals) ──
    // These use tokens that encode the familyId, so no familyId param required.
    if (params.action === "approve" || params.action === "deny") {
      return handleEmailAction(params);
    }
    if (params.action === "depositApprove" || params.action === "depositDeny") {
      return handleDepositEmailAction(params);
    }
    if (params.action === "withdrawApprove" || params.action === "withdrawDeny") {
      return handleWithdrawalEmailAction(params);
    }

    // v37.0 — admin-only: list all families (for Admin Panel cross-family visibility)
    if (params.action === "listFamilies") {
      return ContentService
        .createTextOutput(JSON.stringify({familyIds: listAllFamilyIds_()}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Normal state fetch ──
    // v37.0 — familyId required. If missing, return the list of families so
    // the client can route the user (login flow or admin selection).
    var familyId = params.familyId || null;
    if (!familyId) {
      return ContentService
        .createTextOutput(JSON.stringify({
          error: "familyId required",
          familyIds: listAllFamilyIds_()
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var state = loadFamilyState(familyId);
    state.history = loadHistory(familyId);
    // Net worth history per child for chart
    state.netWorthHistory = {};
    getChildNames(state).forEach(function(c) {
      state.netWorthHistory[c] = calcNetWorthHistory(c, familyId);
    });
    if (DEBUG_LOGGING) Logger.log("doGet OK — family: " + familyId + " users: " + JSON.stringify(state.users));
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
 * URL format: ?action=approve&familyId=fam_xxx&choreId=chore_123&child=Linnea&token=ABC123
 * v37.0 — familyId required in the URL.
 */
function handleEmailAction(params) {
  var action   = params.action;
  var choreId  = params.choreId;
  var child    = params.child;
  var token    = params.token;
  var familyId = params.familyId;

  if (!familyId) {
    return buildActionPage("❌ Invalid Link",
      "This link is missing family information. Please open the app.",
      "#ef4444");
  }

  // Validate token (v37.0 — token now binds familyId too)
  var expectedToken = generateToken(familyId + "|" + choreId, action);
  if (token !== expectedToken) {
    return buildActionPage("❌ Invalid or Expired Link",
      "This link is no longer valid. Please open the app to manage chores.",
      "#ef4444");
  }

  try {
    var state  = loadFamilyState(familyId);
    var data   = state.children && state.children[child];
    if (!data) return buildActionPage("❌ Error", "Child account not found.", "#ef4444");

    var chore = null;
    for (var i = 0; i < data.chores.length; i++) {
      if (data.chores[i].id === choreId) { chore = data.chores[i]; break; }
    }
    if (!chore) return buildActionPage("✅ Already Processed",
      "This chore has already been approved or denied.", "#10b981");
    if (chore.status !== "pending") return buildActionPage("✅ Already Processed",
      chore.name + " was already " + chore.status + ".", "#10b981");

    var ledger   = getLedgerSheet();
    var tz       = getTimezone(state);
    var now      = Utilities.formatDate(new Date(), tz, "MMM d, yyyy h:mm a");

    if (action === "approve") {
      var ck = chore.amount * (chore.splitChk / 100);
      var sv = chore.amount * ((100 - chore.splitChk) / 100);
      data.balances.checking += ck;
      data.balances.savings  += sv;
      if (ck > 0) ledger.appendRow([now, familyId, "Bank", child, "Chore: " + chore.name + " (Chk)", ck]);
      if (sv > 0) ledger.appendRow([now, familyId, "Bank", child, "Chore: " + chore.name + " (Sav)", sv]);

      if (chore.schedule === "once") {
        data.chores = data.chores.filter(function(c) { return c.id !== choreId; });
      } else {
        chore.status        = "available";
        chore.completedBy   = null;
        chore.completedAt   = null;
        chore.denialNote    = null;
        chore.lastCompleted = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
        checkStreakMilestone(state, child, chore, ledger, now, familyId);
      }

      state.children[child] = data;
      saveFamilyState(familyId, state);

      state.familyId = familyId;
      sendEventEmail(state, "Chore Approved", child);
      state._approvedChoreId       = choreId;
      state._approvedChoreTitle    = "🏦 " + chore.name + " — Earn $" + (chore.amount||0).toFixed(2);
      state._approvedChoreSchedule = chore.schedule;
      syncCalendarEvent(state, "Chore Approved", child);

      return buildActionPage("✅ Approved!",
        "<strong>" + chore.name + "</strong> approved for " + child + "!<br><br>" +
        "$" + chore.amount.toFixed(2) + " deposited to their account.<br>" +
        "Checking: +$" + ck.toFixed(2) + " &nbsp; Savings: +$" + sv.toFixed(2),
        "#10b981");

    } else { // deny
      if (chore.schedule === "once") {
        data.chores = data.chores.filter(function(c) { return c.id !== choreId; });
      } else {
        chore.status        = "available";
        chore.completedBy   = null;
        chore.completedAt   = null;
        chore.denialNote    = "Denied via email";
        chore.lastCompleted = null;
      }
      state.children[child] = data;
      saveFamilyState(familyId, state);
      state.familyId = familyId;
      sendEventEmail(state, "Chore Denied", child);

      return buildActionPage("❌ Denied",
        "<strong>" + chore.name + "</strong> has been denied for " + child + ".<br><br>" +
        "The chore will reappear in their list.",
        "#f59e0b");
    }
  } catch(err) {
    Logger.log("handleEmailAction ERROR: " + err);
    return buildActionPage("❌ Error", "Something went wrong: " + err.toString(), "#ef4444");
  }
}


/**
 * handleDepositEmailAction — processes approve/deny links for child deposit requests
 * URL format: ?action=depositApprove&familyId=fam_xxx&depositId=dep_123&child=Linnea&token=ABC123
 */
function handleDepositEmailAction(params) {
  var action    = params.action;
  var depositId = params.depositId;
  var child     = params.child;
  var token     = params.token;
  var familyId  = params.familyId;

  if (!familyId) {
    return buildActionPage("❌ Invalid Link",
      "This link is missing family information.", "#ef4444");
  }

  var expectedToken = generateToken(familyId + "|" + depositId, action);
  if (token !== expectedToken) {
    return buildActionPage("❌ Invalid or Expired Link",
      "This link is no longer valid. Please open the app to manage deposits.",
      "#ef4444");
  }

  try {
    var state = loadFamilyState(familyId);
    var data  = state.children && state.children[child];
    if (!data) return buildActionPage("❌ Error", "Child account not found.", "#ef4444");

    var deposits = data.deposits || [];
    var deposit  = null;
    for (var i = 0; i < deposits.length; i++) {
      if (deposits[i].id === depositId) { deposit = deposits[i]; break; }
    }
    if (!deposit) return buildActionPage("✅ Already Processed",
      "This deposit has already been handled.", "#10b981");

    if (deposit.status !== "pending") return buildActionPage("✅ Already Processed",
      "This deposit was already " + deposit.status + ".", "#10b981");

    var ledger = getLedgerSheet();
    var tz     = getTimezone(state);
    var now    = Utilities.formatDate(new Date(), tz, "MMM d, yyyy h:mm a");

    if (action === "depositApprove") {
      var ck = deposit.amount * (deposit.splitChk / 100);
      var sv = deposit.amount * ((100 - deposit.splitChk) / 100);
      data.balances.checking += ck;
      data.balances.savings  += sv;
      if (ck > 0) ledger.appendRow([now, familyId, "Bank", child, "Deposit: " + deposit.source + " (Chk)", ck]);
      if (sv > 0) ledger.appendRow([now, familyId, "Bank", child, "Deposit: " + deposit.source + " (Sav)", sv]);
      deposit.status = "approved";
      state.children[child] = data;
      saveFamilyState(familyId, state);
      var childEmail = getEmailFor(state, child);
      if (childEmail && notifyEmail(state, child)) {
        var html = buildSimpleEmailHtml(state,
          "💰 Deposit Approved, " + child + "!",
          "Your deposit of <strong>$" + deposit.amount.toFixed(2) + "</strong> from <em>" + deposit.source + "</em> was approved!",
          [
            {label: "Amount",           val: "+$" + deposit.amount.toFixed(2)},
            {label: "Source",           val: deposit.source},
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
        "<strong>$" + deposit.amount.toFixed(2) + "</strong> from " + deposit.source + " approved for " + child + "!<br><br>" +
        "Checking: +$" + ck.toFixed(2) + " &nbsp; Savings: +$" + sv.toFixed(2),
        "#10b981");

    } else { // depositDeny
      deposit.status = "denied";
      state.children[child] = data;
      saveFamilyState(familyId, state);
      var childEmail = getEmailFor(state, child);
      if (childEmail && notifyEmail(state, child)) {
        var html = buildSimpleEmailHtml(state,
          "Deposit Update for " + child,
          "Your deposit request of $" + deposit.amount.toFixed(2) + " from " + deposit.source + " was not approved this time. Talk to " + getParentName(state) + " if you have questions.",
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

    // v37.0 — Require familyId on every request
    var familyId = body.familyId || null;
    if (!familyId) {
      return ContentService
        .createTextOutput(JSON.stringify({error: "familyId required"}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // v37.0 — Intercept special actions before normal flow
    if (body._deleteFamilyFullRequest && body._deleteFamilyFullRequest === familyId) {
      var ok = deleteFamilyFull(familyId);
      return ContentService
        .createTextOutput(JSON.stringify({status: ok ? "deleted" : "error"}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // v37.0 — Audit log append (no state write)
    if (body._auditLogAppend) {
      var a = body._auditLogAppend;
      appendAuditLog(familyId, a.parent, a.action, a.target);
      return ContentService
        .createTextOutput(JSON.stringify({status: "logged"}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // v37.0 — Audit log fetch (no state write)
    if (body._auditLogFetch) {
      var entries = getAuditLogForFamily(familyId, body._auditLogFetch.limit || 50);
      return ContentService
        .createTextOutput(JSON.stringify({auditLog: entries}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // v37.0.1 — Welcome email intercept (no state write)
    // Client (Family Setup Wizard, Step 4 commit) sends one POST per newly-added
    // parent/child. Server loads the family's branding/config, sends a single
    // welcome email, returns. Failure-isolated per recipient.
    if (body._sendWelcomeEmail) {
      var w = body._sendWelcomeEmail || {};
      var okSent = sendWelcomeEmail_(familyId, w.recipient, w.name, w.role, w.defaultPin);
      return ContentService
        .createTextOutput(JSON.stringify({status: okSent ? "sent" : "error"}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (DEBUG_LOGGING) Logger.log("doPost: " + lastAction + " | child: " + activeChild + " | family: " + familyId);

    // v33.0 — Pull proof photo off body BEFORE saveState (sheet cell has ~50K char limit)
    var proofPhoto = body.proofPhoto || null;
    delete body.proofPhoto;

    // v33.0 — Load prior state once so we can diff signup requests (added/approved/denied)
    var priorState = null;
    try { priorState = loadFamilyState(familyId); } catch(le) { priorState = null; }

    // v37.0.2 — Capture signup-diff suppression flag before stripping it.
    // Set by client approvePendingRequest on the admin's Step-2 cleanup POST,
    // so the diff engine doesn't mis-identify a multi-family approval as a
    // denial (approved user is in a new family row, not in admin's users[]).
    var suppressSignupDiff = (body._suppressSignupDiff === true);

    // Strip frontend-only keys before saving
    delete body.tempTransactions;
    delete body.lastAction;
    delete body.history;
    delete body.activeChild;
    // v37.0 — strip intercept keys too (already handled above but be safe)
    delete body._deleteFamilyFullRequest;
    delete body._auditLogAppend;
    delete body._auditLogFetch;
    delete body._sendWelcomeEmail;
    // v37.0.2 — strip suppression flag so it never persists in saved state
    delete body._suppressSignupDiff;
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
    delete body._deletedCalEventIds;
    delete body._deletedCalEventId;
    delete body._approvedCalEventId;

    saveFamilyState(familyId, body);

    // Write transactions to Ledger (v37.0 — with familyId)
    var ledger = getLedgerSheet();
    var tz     = getTimezone(body);
    transactions.forEach(function(tx) {
      var ts = Utilities.formatDate(new Date(), tz, "MMM d, yyyy h:mm a");
      ledger.appendRow([
        tx.date || ts,
        familyId,
        tx.user  || "System",
        tx.child || activeChild || "",
        tx.note  || lastAction,
        tx.amt   || 0
      ]);
    });

    // Trigger any email notifications based on the action
    body.familyId = familyId; // re-attach for downstream handlers
    sendEventEmail(body, lastAction, activeChild, proofPhoto);

    // v33.0 — Process signup request diffs
    // v37.0.2 — Skip diff when admin's cleanup POST explicitly suppressed it
    //          (approvePendingRequest Step 2 — approved user is in a new
    //           family row, not admin's users[], so the diff would otherwise
    //           fall through to the denial branch and email the wrong person).
    if (suppressSignupDiff) {
      if (DEBUG_LOGGING) Logger.log("doPost: signup diff suppressed by client flag");
    } else {
      try { processSignupDiff(priorState, body); } catch(se) { Logger.log("processSignupDiff ERROR: " + se); }
    }

    // Sync Google Calendar events based on the action
    syncCalendarEvent(body, lastAction, activeChild);

    return ContentService
      .createTextOutput(JSON.stringify({status: "ok"}))
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
// v37.0 — filtered by familyId; ledger schema is
//         [Date, FamilyId, User, Child, Note, Amount]
// ================================================================
function loadHistory(familyId) {
  var sheet = getLedgerSheet();
  var data  = sheet.getDataRange().getValues();
  var history = {};
  // Skip header row
  var start = (data.length > 0 && String(data[0][0]).toLowerCase().indexOf("date") !== -1) ? 1 : 0;
  for (var i = start; i < data.length; i++) {
    var row = data[i];
    if (!row[0] && !row[1] && !row[5]) continue; // skip blank rows

    // v37.0 — filter rows by familyId (when supplied)
    var rowFamilyId = String(row[1] || "");
    if (familyId && rowFamilyId && rowFamilyId !== familyId) continue;
    // Legacy rows (pre-migration) have no familyId — skip if familyId requested
    if (familyId && !rowFamilyId) continue;

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
 * TRIGGER: Every Monday 8 AM — weekly allowance per child, per family.
 * v37.0 — iterates all families via forEachFamily.
 */
function automatedMondayDeposit() {
  try {
    forEachFamily(function(familyId, state) {
      var ledger  = getLedgerSheet();
      var tz      = getTimezone(state);
      var now     = Utilities.formatDate(new Date(), tz, "MMM d, yyyy h:mm a");
      var changed = false;

      getChildNames(state).forEach(function(childName) {
        var data = state.children[childName];
        if (!data) return;
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
        Logger.log("Allowance [" + familyId + "]: " + childName + " CHK+$" + chk + " SAV+$" + sav);
      });

      if (changed) saveFamilyState(familyId, state);
    });
  } catch(err) { Logger.log("automatedMondayDeposit ERROR: " + err); }
}

/**
 * TRIGGER: 1st of month 7 AM — interest + monthly statement per child
 */
function monthlyMaintenance() {
  try {
    forEachFamily(function(familyId, state) {
      var ledger = getLedgerSheet();
      var tz     = getTimezone(state);
      var now    = Utilities.formatDate(new Date(), tz, "MMM d, yyyy h:mm a");

      getChildNames(state).forEach(function(childName) {
        var data    = state.children[childName];
        if (!data) return;
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

        Logger.log("Interest [" + familyId + "]: " + childName + " CHK+$" + ic.toFixed(4) + " SAV+$" + is_.toFixed(4));

        // Send statement to all parents + the child
        sendMonthlyStatement(state, childName, data, prevChk, prevSav, ic, is_);
      });

      saveFamilyState(familyId, state);
    });
  } catch(err) { Logger.log("monthlyMaintenance ERROR: " + err); }
}

/**
 * TRIGGER: Every day 6 AM — reset recurring chores by schedule.
 * v37.0 — iterates all families.
 */
function dailyChoreReset() {
  try {
    forEachFamily(function(familyId, state) {
      var changed = false;
      var today   = new Date();

      getChildNames(state).forEach(function(childName) {
        var chores = (state.children[childName] || {}).chores || [];
        chores.forEach(function(chore) {
          if (chore.schedule === "once") return;
          if (chore.status === "available" || chore.status === "pending") return;
          if (chore.endDate && chore.endDate < todayDateStr()) return;
          var reset = false;
          if (chore.schedule === "daily")    reset = true;
          if (chore.schedule === "weekly")   reset = isDayInterval(today, chore.createdAt, 7);
          if (chore.schedule === "biweekly") reset = isDayInterval(today, chore.createdAt, 14);
          if (chore.schedule === "monthly")  reset = (today.getDate() === parseInt(chore.monthlyDay || 1));
          if (reset) {
            chore.status        = "available";
            chore.completedBy   = null;
            chore.completedAt   = null;
            chore.denialNote    = null;
            chore.lastCompleted = null;
            changed = true;
            Logger.log("dailyChoreReset [" + familyId + "]: reset '" + chore.name + "' for " + childName);
          }
        });
      });

      if (changed) saveFamilyState(familyId, state);
    });
  } catch(err) { Logger.log("dailyChoreReset ERROR: " + err); }
}

/**
 * TRIGGER: Every Sunday 9 AM — chore reminder email per child, per family.
 */
function sundayChoreReminder() {
  try {
    forEachFamily(function(familyId, state) {
      getChildNames(state).forEach(function(childName) {
        var data      = state.children[childName];
        if (!data) return;
        var chores    = data.chores || [];
        var available = chores.filter(function(c) {
          return c.status !== "pending" && (!c.endDate || c.endDate >= todayDateStr());
        });

        if (!available.length) {
          Logger.log("sundayChoreReminder [" + familyId + "]: no chores for " + childName + " — skipping");
          return;
        }

        var childEmail  = getEmailFor(state, childName);
        var parentEmails= getParentEmails(state, childName);
        var bankName    = getBankName(state);
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
          Logger.log("sundayChoreReminder [" + familyId + "]: sent for " + childName + " → " + childEmail);
        } else if (parentEmails.length) {
          MailApp.sendEmail({to: parentEmails.join(","), subject: subject, htmlBody: html});
          Logger.log("sundayChoreReminder [" + familyId + "]: sent to parent only for " + childName);
        }
      });
    });
  } catch(err) { Logger.log("sundayChoreReminder ERROR: " + err); }
}

// ================================================================
// [EVENT EMAILS] — Triggered by doPost actions
// ================================================================
function sendEventEmail(state, lastAction, activeChild, proofPhoto) {
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
      var split   = chore.splitChk + "% Checking / " + (100 - chore.splitChk) + "% Savings";
      // v37.0 — familyId in token + URL
      var familyId     = state.familyId || "";
      var tokenKey     = familyId + "|" + chore.id;
      var approveToken = generateToken(tokenKey, "approve");
      var denyToken    = generateToken(tokenKey, "deny");
      var scriptUrl    = ScriptApp.getService().getUrl();
      var approveUrl   = scriptUrl + "?action=approve&familyId=" + encodeURIComponent(familyId) + "&choreId=" + chore.id + "&child=" + encodeURIComponent(childName) + "&token=" + approveToken;
      var denyUrl      = scriptUrl + "?action=deny&familyId="    + encodeURIComponent(familyId) + "&choreId=" + chore.id + "&child=" + encodeURIComponent(childName) + "&token=" + denyToken;

      var primary   = getPrimary(state);
      var secondary = getSecondary(state);
      var html = buildSimpleEmailHtml(state,
        "✋ " + childName + " completed a chore!",
        childName + " marked <strong>" + chore.name + "</strong> complete and is waiting for your approval.",
        [
          {label: "Chore",     val: chore.name},
          {label: "Reward",    val: "$" + (chore.amount || 0).toFixed(2)},
          {label: "Split",     val: split},
          {label: "Completed", val: chore.completedAt || "just now"}
        ],
        ""
      );
      // Inject approve/deny buttons using the placeholder we put in buildSimpleEmailHtml
      var btnHtml = "<div style='display:flex;gap:12px;justify-content:center;margin:0 0 16px;'>"
        + "<a href='" + approveUrl + "' style='flex:1;display:block;background:" + secondary + ";color:white;"
        + "text-decoration:none;padding:14px;border-radius:10px;font-weight:800;font-size:1rem;"
        + "text-align:center;'>✅ Approve</a>"
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

      html = html.replace("<!-- ACTION_BUTTONS -->", photoHtml + btnHtml);

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

    } else if (lastAction === "Chore Approved" && childEmail && notifyEmail(state, childName)) {
      // → Child gets approval confirmation with new balances
      var row = getLastChoreEntry(childName, state.familyId);
      var choreName = row ? String(row[4]).replace(/Chore: | \(Chk\)| \(Sav\)/g, "") : "your chore";
      var earned    = row ? Math.abs(parseFloat(row[5]) || 0) : 0;
      var html = buildSimpleEmailHtml(state,
        "🎉 Chore approved, " + childName + "!",
        "Great work! Your chore <strong>" + choreName + "</strong> was approved.",
        [
          {label: "Earned",           val: "+$" + earned.toFixed(2)},
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
      var deposits = data ? (data.deposits || []) : [];
      var pending  = deposits.filter(function(d) { return d.status === "pending"; });
      if (!pending.length || !parentEmails.length) return;
      var dep = pending[pending.length - 1];
      var split = dep.splitChk + "% Checking / " + (100 - dep.splitChk) + "% Savings";
      var scriptUrl     = ScriptApp.getService().getUrl();
      var familyId      = state.familyId || "";
      var tokenKey      = familyId + "|" + dep.id;
      var approveToken  = generateToken(tokenKey, "depositApprove");
      var denyToken     = generateToken(tokenKey, "depositDeny");
      var approveUrl    = scriptUrl + "?action=depositApprove&familyId=" + encodeURIComponent(familyId) + "&depositId=" + dep.id + "&child=" + encodeURIComponent(childName) + "&token=" + approveToken;
      var denyUrl       = scriptUrl + "?action=depositDeny&familyId="    + encodeURIComponent(familyId) + "&depositId=" + dep.id + "&child=" + encodeURIComponent(childName) + "&token=" + denyToken;
      var secondary     = getSecondary(state);
      var html = buildSimpleEmailHtml(state,
        "💰 " + childName + " wants to make a deposit!",
        childName + " would like to deposit <strong>$" + dep.amount.toFixed(2) + "</strong> from <em>" + dep.source + "</em> into their account.",
        [
          {label: "Amount", val: "$" + dep.amount.toFixed(2)},
          {label: "Source", val: dep.source},
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
      var familyId     = state.familyId || "";
      var tokenKey     = familyId + "|" + wd.id;
      var approveToken = generateToken(tokenKey, "withdrawApprove");
      var denyToken    = generateToken(tokenKey, "withdrawDeny");
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
      var rowW = getLastWithdrawEntry(childName, state.familyId);
      var wAmt = rowW ? Math.abs(parseFloat(rowW[5]) || 0) : 0;
      var wNote = rowW ? String(rowW[4]).replace(/^Withdraw:\s*/, "") : "your withdrawal";
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
// [SIGNUP REQUESTS] v33.0 — Admin-approved parent account creation
// Diffs state.config.pendingUsers between prior and current states.
//   • New entry       → email admin (adminEmail) with requester details
//   • Removed entry   → either approved (user now exists) or denied
//     ─ Approved: welcome email to requester
//     ─ Denied:   denial email to requester (reason if present in state._denialReasons[id])
// The frontend is responsible for creating state.users / state.pins / state.roles
// during approval and for optionally attaching a denial reason via
// state._denialReasons[id] = "reason text" (consumed then stripped here).
// ================================================================
function processSignupDiff(priorState, newState) {
  if (!newState || !newState.config) return;
  var adminEmail = (newState.config.adminEmail || "").trim();
  var bankName   = getBankName(newState);
  var appUrl     = APP_URL;

  var priorPending = (priorState && priorState.config && priorState.config.pendingUsers) || [];
  var newPending   = newState.config.pendingUsers || [];
  var denialReasons = newState._denialReasons || {};
  // Reasons are consumed one-shot; strip so they don't persist
  if (newState._denialReasons) delete newState._denialReasons;

  // Build id → entry maps
  function indexById(list) {
    var m = {};
    (list || []).forEach(function(e) { if (e && e.id) m[e.id] = e; });
    return m;
  }
  var priorMap = indexById(priorPending);
  var newMap   = indexById(newPending);

  // 1) ADDED — entries present in new but not in prior → email admin
  newPending.forEach(function(req) {
    if (!req || !req.id) return;
    if (priorMap[req.id]) return; // already existed
    if (!adminEmail) {
      Logger.log("Signup request received but adminEmail is empty — skipping admin notification.");
      return;
    }
    try {
      var html = buildSimpleEmailHtml(newState,
        "📝 New account request",
        "Someone is requesting a parent account for <strong>" + bankName + "</strong>.",
        [
          {label: "Name",      val: req.name  || "(not provided)"},
          {label: "Email",     val: req.email || "(not provided)"},
          {label: "Requested", val: req.requestedAt || "just now"}
        ],
        "Open " + bankName + " → Admin → Pending Requests to approve or deny."
      );
      html = html.replace("<!-- ACTION_BUTTONS -->",
        "<div style='text-align:center;margin:0 0 16px;'>"
        + "<a href='" + appUrl + "' style='display:inline-block;background:" + getPrimary(newState)
        + ";color:white;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:800;'>"
        + "Open " + bankName + "</a></div>");
      sendSimpleEmail(adminEmail, bankName + " — New signup request: " + (req.name || ""), html);
      Logger.log("Signup request email → " + adminEmail + " for " + (req.name || req.id));
    } catch(e) { Logger.log("signup admin notify ERROR: " + e); }
  });

  // 2) REMOVED — entries present in prior but not in new → approved or denied
  priorPending.forEach(function(req) {
    if (!req || !req.id) return;
    if (newMap[req.id]) return; // still pending
    if (!req.email) return;     // nowhere to notify
    var nowHasUser = !!(newState.users && newState.users.indexOf(req.name) !== -1)
                  || !!(newState.pins  && newState.pins[req.name]);
    try {
      if (nowHasUser) {
        var htmlA = buildSimpleEmailHtml(newState,
          "🎉 You're in!",
          "Your account for <strong>" + bankName + "</strong> is ready.",
          [
            {label: "Display name", val: req.name || ""},
            {label: "How to sign in", val: "Open the app, choose your name, enter your PIN."}
          ],
          "Welcome to " + bankName + "!"
        );
        htmlA = htmlA.replace("<!-- ACTION_BUTTONS -->",
          "<div style='text-align:center;margin:0 0 16px;'>"
          + "<a href='" + appUrl + "' style='display:inline-block;background:" + getPrimary(newState)
          + ";color:white;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:800;'>"
          + "Log in now</a></div>");
        sendSimpleEmail(req.email, bankName + " — Account approved 🎉", htmlA);
        Logger.log("Signup APPROVED email → " + req.email);
      } else {
        var reason = (denialReasons[req.id] || "").toString().trim();
        var body   = reason
          ? "Your account request wasn't approved. Reason: <em>" + reason + "</em>"
          : "Your account request wasn't approved at this time.";
        var htmlD = buildSimpleEmailHtml(newState,
          "Account request update",
          body,
          [],
          "If you think this is a mistake, reply to this email."
        );
        sendSimpleEmail(req.email, bankName + " — Account request update", htmlD);
        Logger.log("Signup DENIED email → " + req.email);
      }
    } catch(e) { Logger.log("signup decision email ERROR: " + e); }
  });
}

// ================================================================
// [WELCOME EMAIL] v37.0.1 — Family Setup Wizard completion
// ================================================================
// Fired via doPost intercept: body._sendWelcomeEmail = {recipient, name, role, defaultPin}
// One POST per newly-added parent/child at wizard completion.
// Returns true on success, false on failure. Caller is fire-and-forget client.
// Failures are logged, never thrown — one recipient failing must not cascade.
function sendWelcomeEmail_(familyId, recipient, name, role, defaultPin) {
  try {
    if (!recipient || !name || !role) {
      Logger.log("_sendWelcomeEmail: missing field (recipient/name/role) — skipping");
      return false;
    }
    var state = loadFamilyState(familyId);
    if (!state) {
      Logger.log("_sendWelcomeEmail: family " + familyId + " not found — skipping");
      return false;
    }
    var bankName = getBankName(state);
    var pin      = (defaultPin != null) ? String(defaultPin) : "0000";
    var isChild  = (role === "child");
    var title    = isChild
      ? "🎉 Welcome to " + bankName + ", " + name + "!"
      : "🎉 You've been added to " + bankName;
    var intro    = isChild
      ? "A parent added you to <strong>" + bankName + "</strong>. Here's how to log in:"
      : "You've been added as a parent in <strong>" + bankName + "</strong>. Here's how to log in:";
    var rows = [
      {label: "Your name", val: name},
      {label: "Your PIN",  val: pin}
    ];
    var footer = "You can change your PIN after your first login (Settings → Change PIN).";
    var html = buildSimpleEmailHtml(state, title, intro, rows, footer);
    html = html.replace("<!-- ACTION_BUTTONS -->",
      "<div style='text-align:center;margin:0 0 16px;'>"
      + "<a href='" + APP_URL + "' style='display:inline-block;background:" + getPrimary(state)
      + ";color:white;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:800;'>"
      + "Log in to " + bankName + "</a></div>");
    var subject = isChild
      ? bankName + " — Welcome, " + name + "! 🎉"
      : bankName + " — You've been added 🎉";
    sendSimpleEmail(recipient, subject, html);
    Logger.log("_sendWelcomeEmail: sent to " + recipient + " (" + role + ", family " + familyId + ")");
    return true;
  } catch(err) {
    Logger.log("_sendWelcomeEmail ERROR (" + recipient + "): " + err);
    return false;
  }
}

// ================================================================
// [MONTHLY STATEMENT EMAIL] — Rich HTML, interest growth highlighted
// ================================================================
function sendMonthlyStatement(state, childName, data, prevChk, prevSav, interestChk, interestSav) {
  try {
    var bankName    = getBankName(state);
    var primary     = getPrimary(state);
    var secondary   = getSecondary(state);
    var primaryDark = shadeColorGs(primary, -20);
    var secDark     = shadeColorGs(secondary, -20);
    var month       = Utilities.formatDate(new Date(), BANK_TIMEZONE, "MMMM yyyy");

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
    var ytdInterest = calcYTDInterest(childName);

    // Simple 12-month projection: current balance + 52 weeks allowance + 12 months interest
    var weeklyTotal    = allowChk + allowSav;
    var projectedSavings = savings * Math.pow(1 + rateSav/100/12, 12) + (allowSav * 52);
    var projectedChecking= checking * Math.pow(1 + rateChk/100/12, 12) + (allowChk * 52);
    var projectedTotal   = projectedChecking + projectedSavings;

    var subject = bankName + " — " + childName + "'s Statement — " + month;

    // Calculate chore streaks for statement
    var choreStreaks = calcChoreStreaks(childName, data);

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
      var rowChild = String(ledgerData[i][2] || "");
      if (rowChild === childName || (!rowChild && childName === DEFAULT_CHILD_NAME)) {
        childRows.push(ledgerData[i]);
        if (childRows.length >= 10) break;
      }
    }

    if (childRows.length > 0) {
      html += '<div class="section-title">📋 Recent Activity</div>'
        + '<table><tr><th>Date</th><th>Account</th><th>Amount</th><th>Note</th></tr>';
      childRows.forEach(function(row) {
        var note   = String(row[3] || "");
        var amt    = parseFloat(row[4]) || 0;
        var isSav  = note.toLowerCase().includes("sav");
        var amtStr = (amt >= 0 ? "+$" : "-$") + Math.abs(amt).toFixed(2);
        var amtCls = amt >= 0 ? "td-pos" : "td-neg";
        var acctTag= isSav
          ? '<span class="td-acct td-sav">SAV</span>'
          : '<span class="td-acct td-chk">CHK</span>';
        var dateStr= "";
        try { dateStr = Utilities.formatDate(new Date(row[0]), BANK_TIMEZONE, "MM/dd"); } catch(e) { dateStr = String(row[0]||""); }
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
    + (rows.length ? '<div style="background:#f8fafc;border-radius:12px;padding:14px 16px;">' + rowsHtml + '</div>' : '')
    + (footer ? '<p style="margin:16px 0 0;color:#64748b;font-size:13px;text-align:center;font-weight:600;">' + footer + '</p>' : '')
    + '</div>'
    + '<div style="background:#f8faff;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0;">'
    + '<!-- ACTION_BUTTONS -->'
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
// ═══════════════════════════════════════════════════════════════════
// v37.0 — ROW-PER-FAMILY STATE LAYER
// ═══════════════════════════════════════════════════════════════════
//
// Sheet layout (first tab, "Sheet1" or whatever is index 0):
//   Row 1: headers — "FamilyId" | "State"
//   Rows 2+: one row per family — col A = familyId, col B = JSON state
//
// familyId format: fam_<8 char base36 id>, e.g., fam_k9m3x7q2
// Generated once at family creation, never changes.
//
// Every doPost/doGet requires familyId (in body or ?familyId= param).
// Email action handlers embed familyId in the signed token.
// ═══════════════════════════════════════════════════════════════════

var FAMILY_SHEET_HEADER = ["FamilyId", "State"];

/** Generate a new short familyId */
function generateFamilyId() {
  var ts = Date.now().toString(36);
  var rnd = Math.floor(Math.random() * 1296).toString(36); // 2 base36 chars
  return "fam_" + (ts.slice(-6) + rnd).slice(0, 8);
}

/** Get the first (data) sheet */
function getFamilySheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

/** Ensure header row exists (safe to call repeatedly) */
function ensureFamilySheetHeader_() {
  var sh = getFamilySheet_();
  var hdr = sh.getRange(1, 1, 1, 2).getValues()[0];
  if (hdr[0] !== FAMILY_SHEET_HEADER[0] || hdr[1] !== FAMILY_SHEET_HEADER[1]) {
    sh.getRange(1, 1, 1, 2).setValues([FAMILY_SHEET_HEADER]).setFontWeight("bold");
  }
}

/** Find the row number (1-indexed) for a given familyId, or -1 */
function findFamilyRow_(familyId) {
  if (!familyId) return -1;
  var sh = getFamilySheet_();
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === familyId) return i + 2;
  }
  return -1;
}

/** List all familyIds in the sheet */
function listAllFamilyIds_() {
  var sh = getFamilySheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  return ids.map(function(r){ return r[0]; }).filter(function(x){ return !!x; });
}

/**
 * Load state for a given family.
 * Returns postProcessed state object, or buildDefaultState() if family not found.
 */
function loadFamilyState(familyId) {
  try {
    if (!familyId) {
      if (DEBUG_LOGGING) Logger.log("loadFamilyState: no familyId provided");
      return buildDefaultState();
    }
    var cache = CacheService.getScriptCache();
    var cacheKey = "familyBankState_" + familyId;
    var cached = cache.get(cacheKey);
    if (cached) {
      if (DEBUG_LOGGING) Logger.log("loadFamilyState: cache hit " + familyId);
      var c = JSON.parse(cached);
      if (c && c.pins) {
        c.familyId = familyId;
        return postProcessState(c);
      }
    }
    ensureFamilySheetHeader_();
    var row = findFamilyRow_(familyId);
    if (row < 0) {
      if (DEBUG_LOGGING) Logger.log("loadFamilyState: family not found " + familyId);
      return buildDefaultState();
    }
    var raw = getFamilySheet_().getRange(row, 2).getValue();
    if (!raw) return buildDefaultState();
    var s = JSON.parse(raw);
    s.familyId = familyId;
    try {
      var toCache = JSON.stringify(s);
      if (toCache.length < 100000) cache.put(cacheKey, toCache, 60);
    } catch(ce) {}
    return postProcessState(s);
  } catch(err) {
    Logger.log("loadFamilyState ERROR (" + familyId + "): " + err);
    return buildDefaultState();
  }
}

/** Save state for a given family. Creates row if new. */
function saveFamilyState(familyId, state) {
  if (!familyId) throw new Error("saveFamilyState: familyId required");
  ensureFamilySheetHeader_();
  var clean = Object.assign({}, state);
  delete clean.familyId; // don't persist it inside the JSON
  var sh = getFamilySheet_();
  var row = findFamilyRow_(familyId);
  if (row < 0) {
    sh.appendRow([familyId, JSON.stringify(clean)]);
  } else {
    sh.getRange(row, 2).setValue(JSON.stringify(clean));
  }
  try { CacheService.getScriptCache().remove("familyBankState_" + familyId); } catch(e) {}
}

/** Delete a family row (and clear its cache). Does NOT touch ledger. */
function deleteFamilyRow(familyId) {
  if (!familyId) return false;
  var row = findFamilyRow_(familyId);
  if (row < 0) return false;
  getFamilySheet_().deleteRow(row);
  try { CacheService.getScriptCache().remove("familyBankState_" + familyId); } catch(e) {}
  return true;
}

// ── Legacy shims — keep old call sites working ──────────────────────
// These default to the first family in the sheet. Any trigger/cron
// that runs without context (automated deposits, interest, etc.) will
// iterate via the plural forms below.

function loadState() {
  var ids = listAllFamilyIds_();
  if (ids.length === 0) return buildDefaultState();
  return loadFamilyState(ids[0]);
}

function saveState(state) {
  // Legacy: if state has familyId, route to per-family save
  if (state && state.familyId) return saveFamilyState(state.familyId, state);
  // Otherwise default to first family — only used in edge cases
  var ids = listAllFamilyIds_();
  var familyId = ids[0] || generateFamilyId();
  saveFamilyState(familyId, state);
}

// Iterate all families — used by cron jobs
function forEachFamily(fn) {
  var ids = listAllFamilyIds_();
  ids.forEach(function(id) {
    try {
      var s = loadFamilyState(id);
      fn(id, s);
    } catch(e) {
      Logger.log("forEachFamily error on " + id + ": " + e);
    }
  });
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

// saveState is defined above in the v37.0 state layer (legacy shim).

function getLedgerSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Ledger");
  if (!sheet) {
    sheet = ss.insertSheet("Ledger");
    // v37.0 — FamilyId column added
    sheet.appendRow(["Date", "FamilyId", "User", "Child", "Note", "Amount"]);
    sheet.getRange("1:1").setFontWeight("bold");
  } else {
    // v37.0 — Migrate existing ledger to include FamilyId column if missing
    var hdr = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    if (hdr.length < 6 || hdr[1] !== "FamilyId") {
      // Insert a new column B for FamilyId
      sheet.insertColumnAfter(1);
      sheet.getRange(1, 2).setValue("FamilyId").setFontWeight("bold");
    }
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

function getTimezone(state) {
  var map = {
    "GMT-5":"America/New_York",  "GMT-6":"America/Chicago",
    "GMT-7":"America/Denver",    "GMT-8":"America/Los_Angeles",
    "GMT-4":"America/Halifax",   "GMT+0":"UTC",
    "GMT+1":"Europe/London",     "GMT+2":"Europe/Berlin"
  };
  var tz = (state && state.config && state.config.timezone) || "GMT-5";
  return map[tz] || BANK_TIMEZONE;
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

function todayDateStr() {
  return Utilities.formatDate(new Date(), BANK_TIMEZONE, "yyyy-MM-dd");
}

function getLastChoreEntry(childName, familyId) {
  var data = getLedgerSheet().getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    var row   = data[i];
    var rowFamilyId = String(row[1] || "");
    if (familyId && rowFamilyId && rowFamilyId !== familyId) continue;
    if (familyId && !rowFamilyId) continue;
    var note  = String(row[4] || "");
    var child = String(row[3] || "");
    if ((child === childName || !child) && note.indexOf("Chore:") === 0) return row;
  }
  return null;
}

function calcYTDInterest(childName, familyId) {
  try {
    var data  = getLedgerSheet().getDataRange().getValues();
    var year  = new Date().getFullYear();
    var total = 0;
    for (var i = 1; i < data.length; i++) {
      var rowFamilyId = String(data[i][1] || "");
      if (familyId && rowFamilyId && rowFamilyId !== familyId) continue;
      if (familyId && !rowFamilyId) continue;
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
      timezone:   "GMT-5",
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
function syncCalendarEvent(state, lastAction, activeChild) {
  try {
    if (!activeChild) return;
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
    var chores = data.chores || [];
    var tz     = getTimezone(state);

    if (lastAction === "Chore Created") {
      var newChore = chores[chores.length - 1];
      if (newChore) {
        deleteEventsByChoreId(calendarId, newChore.id);  // safety
        createEventsForChore(calendarId, newChore, tz);
        Logger.log("syncCalendarEvent: created event(s) for '" + newChore.name + "'");
      }

    } else if (lastAction === "Chore Edited") {
      var editedId = state._editedChoreId || null;
      chores.forEach(function(chore) {
        if (!editedId || chore.id === editedId) {
          deleteEventsByChoreId(calendarId, chore.id);
          createEventsForChore(calendarId, chore, tz);
        }
      });
      Logger.log("syncCalendarEvent: rebuilt event(s) for choreId=" + (editedId || "ALL"));

    } else if (lastAction === "Chore Deleted") {
      if (state._deletedChoreId) {
        deleteEventsByChoreId(calendarId, state._deletedChoreId);
        Logger.log("syncCalendarEvent: deleted event(s) for choreId=" + state._deletedChoreId);
      }

    } else if (lastAction === "Chore Approved") {
      if (state._approvedChoreSchedule === "once" && state._approvedChoreId) {
        deleteEventsByChoreId(calendarId, state._approvedChoreId);
        Logger.log("syncCalendarEvent: removed one-time event choreId=" + state._approvedChoreId);
      }
    }

    Logger.log("syncCalendarEvent: " + lastAction + " complete for " + activeChild);
  } catch(err) { Logger.log("syncCalendarEvent ERROR: " + err); }
}

/**
 * Delete all events whose description contains "CHORE_ID:<choreId>".
 * Searches a tight window: 1 month ago to 1 year ahead. Recurring event
 * series are matched and deleted as series (deleteEventSeries).
 */
function deleteEventsByChoreId(calendarId, choreId) {
  try {
    if (!choreId) return;
    var cal = CalendarApp.getCalendarById(calendarId);
    if (!cal) return;

    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var end   = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    var events = cal.getEvents(start, end);

    var seriesSeen = {};   // dedupe — series can return multiple instances
    var deletedSeries = 0;
    var deletedSingle = 0;
    var searchStr = "CHORE_ID:" + choreId;

    events.forEach(function(ev) {
      try {
        var desc = ev.getDescription() || "";
        if (desc.indexOf(searchStr) === -1) return;
        if (ev.isRecurringEvent()) {
          var sid = ev.getEventSeries().getId();
          if (seriesSeen[sid]) return;
          seriesSeen[sid] = true;
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
 */
function createEventsForChore(calendarId, chore, tz) {
  try {
    var cal = CalendarApp.getCalendarById(calendarId);
    if (!cal) { Logger.log("createEventsForChore: calendar not found — " + calendarId); return; }
    if (!chore || !chore.id) return;

    var title = buildEventTitle(chore);
    var now   = new Date();

    if (chore.schedule === "once") {
      var hour = parseInt(chore.reminderHour) || 8;
      var d = chore.onceDate ? new Date(chore.onceDate + "T00:00:00") : new Date();
      d.setHours(hour, 0, 0, 0);
      var endDt = new Date(d.getTime() + 30 * 60 * 1000);
      cal.createEvent(title, d, endDt, {description: buildEventDescription(chore)});
      Logger.log("createEventsForChore[once] '" + chore.name + "' → " + d.toString());
      return;
    }

    if (chore.schedule === "daily") {
      var hour = parseInt(chore.reminderHour) || 8;
      var s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0);
      var e = new Date(s.getTime() + 30 * 60 * 1000);
      var rec = CalendarApp.newRecurrence().addDailyRule();
      cal.createEventSeries(title, s, e, rec, {description: buildEventDescription(chore)});
      Logger.log("createEventsForChore[daily] '" + chore.name + "'");
      return;
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
        var daysUntil = (targetDay - now.getDay() + 7) % 7;
        if (daysUntil === 0 && now.getHours() >= hour) daysUntil = 7;
        if (skipWeek) daysUntil += 7;
        var anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntil, hour, 0, 0);
        var endDt  = new Date(anchor.getTime() + 30 * 60 * 1000);
        var rec = (chore.schedule === "weekly")
          ? CalendarApp.newRecurrence().addWeeklyRule().onlyOnWeekday(weekdayMap[targetDay])
          : CalendarApp.newRecurrence().addWeeklyRule().interval(2).onlyOnWeekday(weekdayMap[targetDay]);
        cal.createEventSeries(title, anchor, endDt, rec, {description: buildEventDescription(chore, targetDay)});
        Logger.log("createEventsForChore[" + chore.schedule + "] '" + chore.name + "' day=" + targetDay + " hour=" + hour + (skipWeek ? " (skip week)" : ""));
      });
      return;
    }

    if (chore.schedule === "monthly") {
      var hour = parseInt(chore.reminderHour) || 8;
      var resolvedDay = resolveMonthlyDayGs(chore.monthlyDay || "1", now.getFullYear(), now.getMonth());
      var anchor = new Date(now.getFullYear(), now.getMonth(), resolvedDay, hour, 0, 0);
      if (anchor < now) anchor = new Date(now.getFullYear(), now.getMonth() + 1, resolvedDay, hour, 0, 0);
      var endDt = new Date(anchor.getTime() + 30 * 60 * 1000);
      var rec = CalendarApp.newRecurrence().addMonthlyRule();
      cal.createEventSeries(title, anchor, endDt, rec, {description: buildEventDescription(chore)});
      Logger.log("createEventsForChore[monthly] '" + chore.name + "' day=" + resolvedDay);
      return;
    }
  } catch(err) {
    Logger.log("createEventsForChore ERROR for '" + (chore && chore.name || "?") + "': " + err.toString());
  }
}

/**
 * Admin tool — run from Apps Script editor to nuke and rebuild ALL
 * calendar events for one child. Use when calendar drifts out of sync.
 *
 * Usage: change CHILD_NAME below, then Run.
 */
function resyncCalendarForChild() {
  var CHILD_NAME = "Linnea";  // ← change this to the child you want to resync

  var state = loadState();
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
function testCalendarIntegration() {
  var state = loadState();
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
function testCreateChoreEvent() {
  Logger.log("=== testCreateChoreEvent START ===");

  // Load state and find first child with a calendar ID
  var state     = loadState();
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
function printReadableState() {
  Logger.log("=== FAMILY BANK — READABLE STATE ===");
  var s = loadState();
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
  var history = loadHistory();
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
  try {
    if (!chore.streakMilestone || !chore.streakReward) return 0;
    var milestone = parseInt(chore.streakMilestone) || 0;
    var reward    = parseFloat(chore.streakReward) || 0;
    if (milestone <= 0 || reward <= 0) return 0;

    chore.streakCount = (parseInt(chore.streakCount) || 0) + 1;
    var effective = chore.streakCount + (parseInt(chore.streakStart) || 0);

    if (effective % milestone !== 0) return 0;

    var data = state.children[child];
    data.balances.checking += reward;
    var fid = familyId || state.familyId || "";
    ledger.appendRow([now, fid, "Bank", child,
      "🔥 Streak Bonus: " + chore.name + " (" + effective + " in a row!) (Chk)", reward]);
    Logger.log("checkStreakMilestone: " + child + " — " + chore.name + " hit " + effective + " streak! Bonus $" + reward);
    return reward;
  } catch(e) {
    Logger.log("checkStreakMilestone ERROR: " + e);
    return 0;
  }
}

function calcChoreStreaks(childName, data, familyId) {
  try {
    var chores = data.chores || [];
    var ledger = getLedgerSheet().getDataRange().getValues();
    var streaks = [];
    chores.forEach(function(chore) {
      if (!chore.name) return;
      var completions = [];
      for (var i = 1; i < ledger.length; i++) {
        var row = ledger[i];
        var rowFamilyId = String(row[1] || "");
        if (familyId && rowFamilyId && rowFamilyId !== familyId) continue;
        if (familyId && !rowFamilyId) continue;
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

function calcNetWorthHistory(childName, familyId) {
  try {
    var ledger = getLedgerSheet().getDataRange().getValues();
    var running = 0;
    var monthly = {};
    for (var i = 1; i < ledger.length; i++) {
      var row   = ledger[i];
      var rowFamilyId = String(row[1] || "");
      if (familyId && rowFamilyId && rowFamilyId !== familyId) continue;
      if (familyId && !rowFamilyId) continue;
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
    // aren't empty.
    try {
      var state = familyId ? loadFamilyState(familyId) : loadState();
      var child = state.children && state.children[childName];
      if (child && child.balances) {
        var now = new Date();
        var currentKey = now.getFullYear() + "-" + String(now.getMonth()+1).padStart(2,"0");
        if (!monthly.hasOwnProperty(currentKey)) {
          var total = (parseFloat(child.balances.checking) || 0) + (parseFloat(child.balances.savings) || 0);
          monthly[currentKey] = total;
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
// v37.0 — Initialize row-per-family sheet. Existing data is untouched;
//          run migrateToRowPerFamily() separately after setupBank if
//          upgrading from pre-v37.0.
// ================================================================
function setupBank() {
  // Create Ledger tab (with FamilyId column) if it doesn't exist
  getLedgerSheet();

  // v37.0 — Initialize header row on the data sheet
  ensureFamilySheetHeader_();
  Logger.log("setupBank: family sheet header verified");

  // If this is a FRESH install (no family rows yet, no legacy A1 data):
  // seed with a default Bank of Dad family using the CONFIG block above.
  var sheet = getFamilySheet_();
  var lastRow = sheet.getLastRow();
  var a1Value = sheet.getRange("A1").getValue();
  var hasFamilyData = (lastRow >= 2);

  // Detect legacy A1 blob (unmigrated v36 or earlier):
  //   cell A1 contains JSON state instead of the "FamilyId" header.
  var looksLikeLegacyA1 = false;
  try {
    if (typeof a1Value === "string" && a1Value.length > 10 && a1Value.charAt(0) === "{") {
      JSON.parse(a1Value);
      looksLikeLegacyA1 = true;
    }
  } catch(e) { looksLikeLegacyA1 = false; }

  if (looksLikeLegacyA1) {
    Logger.log("setupBank: legacy A1 blob detected. Run migrateToRowPerFamily() to upgrade.");
  } else if (!hasFamilyData) {
    // Fresh install — seed one family
    var defaultId = generateFamilyId();
    var defaultState = buildDefaultState();
    saveFamilyState(defaultId, defaultState);
    Logger.log("setupBank: seeded fresh family " + defaultId);
  } else {
    Logger.log("setupBank: found " + (lastRow - 1) + " existing family row(s); not overwriting.");
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
// [TOOLS] — Run any of these manually from the Apps Script editor
// ================================================================

/**
 * cleanOrphanedStateKeys
 * Run this ONCE manually to clean up leftover calendar helper keys
 * that got permanently saved into the state blob in Sheet1 A1.
 * Safe to run — only removes the specific keys, touches nothing else.
 */
function cleanOrphanedStateKeys() {
  Logger.log("cleanOrphanedStateKeys: loading state...");
  var state = loadState();
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
    saveState(state);
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
function printState() {
  var s = loadState();
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
  var CONFIRM = false; // ← change to true to actually run
  if (!CONFIRM) { Logger.log("Set CONFIRM = true to reset. This cannot be undone."); return; }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheets()[0].getRange("A1").setValue("");
  var l = ss.getSheetByName("Ledger");
  if (l) { l.clearContents(); l.appendRow(["Date","User","Child","Note","Amount"]); }
  saveState(buildDefaultState());
  Logger.log("DANGER_resetEverything: complete. All data wiped and reset to defaults.");
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
  var familyId     = params.familyId;

  if (!familyId) {
    return buildActionPage("❌ Invalid Link",
      "This link is missing family information.", "#ef4444");
  }

  var expectedToken = generateToken(familyId + "|" + withdrawalId, action);
  if (token !== expectedToken) {
    return buildActionPage("❌ Invalid or Expired Link",
      "This link is no longer valid. Please open the app to manage withdrawals.",
      "#ef4444");
  }

  try {
    var state = loadFamilyState(familyId);
    var data  = state.children && state.children[child];
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
          child + " only has $" + (data.balances.checking || 0).toFixed(2) + " in checking — can't approve a $" +
          wd.amount.toFixed(2) + " withdrawal. Ask them to reduce the amount.",
          "#ef4444");
      }
      data.balances.checking -= wd.amount;
      ledger.appendRow([now, familyId, child, child, "Withdraw: " + (wd.note || ""), -wd.amount]);
      data.pendingWithdrawals = pending.filter(function(p){ return p.id !== withdrawalId; });
      state.children[child] = data;
      saveFamilyState(familyId, state);

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
      saveFamilyState(familyId, state);

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
}

// v35.0 Item 2 — lookup last "Withdraw:" ledger row for a child (used by approval email)
// v37.0 — takes optional familyId for per-family filtering; ledger columns shifted
function getLastWithdrawEntry(childName, familyId) {
  try {
    var ledger = getLedgerSheet();
    var rows = ledger.getDataRange().getValues();
    for (var i = rows.length - 1; i >= 1; i--) {
      var rowFamilyId = String(rows[i][1] || "");
      if (familyId && rowFamilyId && rowFamilyId !== familyId) continue;
      if (familyId && !rowFamilyId) continue;
      if (rows[i][3] === childName && String(rows[i][4] || "").indexOf("Withdraw:") === 0) {
        return rows[i];
      }
    }
  } catch(e) { Logger.log("getLastWithdrawEntry ERROR: " + e); }
  return null;
}

// ════════════════════════════════════════════════════════════════════
// v37.0 — MIGRATION: A1 blob → row-per-family
// ════════════════════════════════════════════════════════════════════
//
// One-shot migration. Safe to re-run: detects if migration already done.
//
// For Bank of Dad's current data:
//   • Dad + Linnea         → family 1 (primary: Dad)
//   • Jacee (solo parent)  → family 2 (primary: Jacee)
//   • Anthony (solo parent)→ family 3 (primary: Anthony)
//   • Mark (solo parent)   → family 4 (primary: Mark)
//
// Algorithm:
//   1. Read legacy A1 blob
//   2. Build connected components from parentChildren map
//      (parents sharing a child = same family)
//   3. Each component becomes one family with its own config,
//      children, chores, balances, etc.
//   4. Solo parents (no children) get their own family
//   5. Write each family to its own row in col A/B
//   6. Backfill Ledger rows with familyId (col B) based on child→family map
//   7. Clear A1 blob (set to "FamilyId" header)
// ════════════════════════════════════════════════════════════════════
function migrateToRowPerFamily() {
  var sheet = getFamilySheet_();
  var a1 = sheet.getRange("A1").getValue();

  // Detect already-migrated state
  if (a1 === FAMILY_SHEET_HEADER[0]) {
    Logger.log("migrateToRowPerFamily: already migrated (header present). Aborting safely.");
    return;
  }

  if (!a1 || typeof a1 !== "string" || a1.charAt(0) !== "{") {
    Logger.log("migrateToRowPerFamily: no legacy A1 blob found. Setting header and exiting.");
    ensureFamilySheetHeader_();
    return;
  }

  var legacy;
  try { legacy = JSON.parse(a1); }
  catch(e) {
    Logger.log("migrateToRowPerFamily ERROR: cannot parse A1 — " + e);
    return;
  }

  Logger.log("migrateToRowPerFamily: starting. Users: " + (legacy.users || []).join(", "));

  var users        = legacy.users || [];
  var roles        = legacy.roles || {};
  var pins         = legacy.pins || {};
  var emails       = (legacy.config && legacy.config.emails) || {};
  var avatars      = (legacy.config && legacy.config.avatars) || {};
  var avatarPhotos = (legacy.config && legacy.config.avatarPhotos) || {};
  var parentChildren = (legacy.config && legacy.config.parentChildren) || {};
  var children       = legacy.children || {};

  var parents = users.filter(function(u){ return roles[u] === "parent"; });
  var kids    = users.filter(function(u){ return roles[u] === "child"; });

  // ── Build connected components ─────────────────────────────────────
  // Parents connect to kids via parentChildren.
  // Two parents who share a kid are in the same family.
  // Solo parents (no shared kid) get their own family.
  var parentToFamily = {};
  var kidToFamily    = {};
  var families       = [];
  var familyIdx      = 0;

  function ensureFamilyForParent(parent) {
    if (parentToFamily.hasOwnProperty(parent)) return parentToFamily[parent];
    var fam = { parents: [], kids: [] };
    families.push(fam);
    var idx = familyIdx++;
    parentToFamily[parent] = idx;
    fam.parents.push(parent);

    // Pull all kids assigned to this parent
    var assignedKids = parentChildren[parent] || [];
    assignedKids.forEach(function(k) {
      if (!kidToFamily.hasOwnProperty(k)) {
        kidToFamily[k] = idx;
        fam.kids.push(k);
      }
    });

    // Pull all other parents who share any of those kids
    parents.forEach(function(otherP) {
      if (otherP === parent) return;
      if (parentToFamily.hasOwnProperty(otherP)) return;
      var otherKids = parentChildren[otherP] || [];
      var shares = otherKids.some(function(k){ return assignedKids.indexOf(k) !== -1; });
      if (shares) {
        parentToFamily[otherP] = idx;
        fam.parents.push(otherP);
        otherKids.forEach(function(k) {
          if (!kidToFamily.hasOwnProperty(k)) {
            kidToFamily[k] = idx;
            fam.kids.push(k);
          }
        });
      }
    });

    return idx;
  }

  parents.forEach(function(p) { ensureFamilyForParent(p); });

  // Any orphan kids (no parent assignment) — attach to first family, or create one
  kids.forEach(function(k) {
    if (!kidToFamily.hasOwnProperty(k)) {
      if (families.length === 0) {
        families.push({ parents: [], kids: [k] });
        kidToFamily[k] = 0;
        familyIdx = 1;
      } else {
        kidToFamily[k] = 0;
        families[0].kids.push(k);
      }
    }
  });

  Logger.log("migrateToRowPerFamily: " + families.length + " families detected");

  // ── Build each family's state JSON ─────────────────────────────────
  var familyIds = [];
  families.forEach(function(fam, idx) {
    var familyId = generateFamilyId();
    // Nudge: ensure unique within this run even if timestamps collide
    if (familyIds.indexOf(familyId) !== -1) familyId = familyId + idx;
    familyIds.push(familyId);

    var primaryParent = fam.parents[0] || null;

    var famUsers = [].concat(fam.parents, fam.kids);
    var famRoles = {}, famPins = {}, famEmails = {}, famAvatars = {}, famAvatarPhotos = {};
    famUsers.forEach(function(u) {
      famRoles[u]        = roles[u];
      famPins[u]         = pins[u];
      if (emails[u])       famEmails[u]       = emails[u];
      if (avatars[u])      famAvatars[u]      = avatars[u];
      if (avatarPhotos[u]) famAvatarPhotos[u] = avatarPhotos[u];
    });

    // Per-family parentChildren (only for this family's parents+kids)
    var famParentChildren = {};
    fam.parents.forEach(function(p) {
      var pKids = (parentChildren[p] || []).filter(function(k) {
        return fam.kids.indexOf(k) !== -1;
      });
      if (pKids.length) famParentChildren[p] = pKids;
    });

    // Children data — only this family's kids
    var famChildren = {};
    fam.kids.forEach(function(k) {
      if (children[k]) famChildren[k] = children[k];
    });

    // Compose full state for this family
    var famState = {
      users:    famUsers,
      roles:    famRoles,
      pins:     famPins,
      children: famChildren,
      config: {
        bankName:       (legacy.config && legacy.config.bankName)       || BANK_NAME,
        tagline:        (legacy.config && legacy.config.tagline)        || BANK_TAGLINE,
        colorPrimary:   (legacy.config && legacy.config.colorPrimary)   || DEFAULT_COLOR_PRIMARY,
        colorSecondary: (legacy.config && legacy.config.colorSecondary) || DEFAULT_COLOR_SECONDARY,
        imgBanner:      (legacy.config && legacy.config.imgBanner)      || "",
        imgLogo:        (legacy.config && legacy.config.imgLogo)        || "",
        timezone:       (legacy.config && legacy.config.timezone)       || BANK_TIMEZONE,
        autoLogout:     (legacy.config && legacy.config.autoLogout)     || 0,
        adminEmail:     (legacy.config && legacy.config.adminEmail)     || "",
        adminPin:       (legacy.config && legacy.config.adminPin)       || DEFAULT_ADMIN_PIN,
        parentChildren: famParentChildren,
        emails:         famEmails,
        avatars:        famAvatars,
        avatarPhotos:   famAvatarPhotos,
        notify:         (legacy.config && legacy.config.notify)         || {},
        tabs:           (legacy.config && legacy.config.tabs)           || {},
        calendars:      {},
        // v37.0 — primary parent marker
        primaryParent:  primaryParent,
        // v37.0 — setup complete flag: existing families are already set up
        familySetupComplete: true,
        // v37.0 — per-child setup flags: existing kids are already set up
        childSetupComplete: (function(){ var m={}; fam.kids.forEach(function(k){m[k]=true;}); return m; })(),
        // v37.0 — deactivated children list
        deactivatedChildren: [],
        // v37.0 — login stats preserved from legacy if available
        loginStats: (legacy.config && legacy.config.loginStats)
          ? (function(){
              var ls = {};
              famUsers.forEach(function(u){
                if (legacy.config.loginStats[u]) ls[u] = legacy.config.loginStats[u];
              });
              return ls;
            })()
          : {}
      }
    };

    // Per-child calendar ids
    if (legacy.config && legacy.config.calendars) {
      fam.kids.forEach(function(k) {
        if (legacy.config.calendars[k]) famState.config.calendars[k] = legacy.config.calendars[k];
      });
    }

    // Preserve pendingUsers ONLY on the first family (admin-level data)
    if (idx === 0 && legacy.config && legacy.config.pendingUsers) {
      famState.config.pendingUsers = legacy.config.pendingUsers;
    }

    saveFamilyState(familyId, famState);
    Logger.log("migrateToRowPerFamily: wrote family " + familyId +
               " parents=[" + fam.parents.join(",") + "] kids=[" + fam.kids.join(",") + "]");
  });

  // ── Backfill Ledger with familyId column ───────────────────────────
  // Build child → familyId map
  var childToFamilyId = {};
  families.forEach(function(fam, idx) {
    var fid = familyIds[idx];
    fam.kids.forEach(function(k) { childToFamilyId[k] = fid; });
  });

  try {
    var ledger = getLedgerSheet(); // ensures FamilyId column exists
    var rng = ledger.getDataRange();
    var data = rng.getValues();
    var updated = 0;
    // Row 1 = header. Data rows start at 2.
    for (var i = 1; i < data.length; i++) {
      if (data[i][1]) continue; // already has familyId
      var childName = String(data[i][3] || "");
      var fid = childToFamilyId[childName] || familyIds[0] || "";
      if (fid) {
        ledger.getRange(i + 1, 2).setValue(fid);
        updated++;
      }
    }
    Logger.log("migrateToRowPerFamily: backfilled " + updated + " ledger rows with familyId");
  } catch(e) { Logger.log("migrateToRowPerFamily: ledger backfill ERROR: " + e); }

  // ── Write header to col A row 1, clearing the legacy A1 blob ───────
  // saveFamilyState already appended data rows. Now ensure row 1 is headers.
  // saveFamilyState writes rows starting at the first empty row — if A1 had
  // the JSON blob, row 2 may now contain the first family, but row 1 still
  // has the blob. Overwrite row 1 with headers.
  sheet.getRange(1, 1, 1, 2).setValues([FAMILY_SHEET_HEADER]).setFontWeight("bold");

  Logger.log("migrateToRowPerFamily: done. " + families.length + " families migrated.");
  Logger.log("Family IDs: " + familyIds.join(", "));
}

// ════════════════════════════════════════════════════════════════════
// v37.0 — AUDIT LOG
// ════════════════════════════════════════════════════════════════════
//
// Sheet: "AuditLog"
// Columns: Timestamp | FamilyId | Parent | Action | Target
// Capped at 200 rows per family; oldest pruned on write.
// ════════════════════════════════════════════════════════════════════
var AUDIT_LOG_MAX_PER_FAMILY = 200;

function getAuditLogSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("AuditLog");
  if (!sh) {
    sh = ss.insertSheet("AuditLog");
    sh.appendRow(["Timestamp", "FamilyId", "Parent", "Action", "Target"]);
    sh.getRange("1:1").setFontWeight("bold");
  }
  return sh;
}

function appendAuditLog(familyId, parent, action, target) {
  try {
    if (!familyId) return;
    var sh = getAuditLogSheet_();
    var tz = "America/New_York";
    try {
      var state = loadFamilyState(familyId);
      tz = getTimezone(state);
    } catch(e) {}
    var ts = Utilities.formatDate(new Date(), tz, "MMM d, yyyy h:mm a");
    sh.appendRow([ts, familyId, parent || "", action || "", target || ""]);

    // Prune oldest entries for this family if over cap
    pruneAuditLog_(familyId);
  } catch(e) {
    Logger.log("appendAuditLog ERROR: " + e);
  }
}

function pruneAuditLog_(familyId) {
  try {
    var sh = getAuditLogSheet_();
    var data = sh.getDataRange().getValues();
    // Find all rows for this family (skip header at row 0)
    var familyRows = [];
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]) === familyId) familyRows.push(i + 1); // 1-indexed
    }
    if (familyRows.length <= AUDIT_LOG_MAX_PER_FAMILY) return;
    var toDelete = familyRows.length - AUDIT_LOG_MAX_PER_FAMILY;
    // familyRows is in ascending order → oldest first (rows appended chronologically)
    // Delete from bottom up to keep row indices valid
    var victims = familyRows.slice(0, toDelete).sort(function(a,b){return b-a;});
    victims.forEach(function(r) { sh.deleteRow(r); });
    Logger.log("pruneAuditLog: pruned " + toDelete + " rows for " + familyId);
  } catch(e) {
    Logger.log("pruneAuditLog ERROR: " + e);
  }
}

/**
 * Get last N audit entries for a family, newest first.
 * Called from frontend via a POST (state.action === "getAuditLog").
 */
function getAuditLogForFamily(familyId, limit) {
  try {
    if (!familyId) return [];
    limit = limit || 50;
    var sh = getAuditLogSheet_();
    var data = sh.getDataRange().getValues();
    var out = [];
    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][1]) !== familyId) continue;
      out.push({
        timestamp: String(data[i][0] || ""),
        parent:    String(data[i][2] || ""),
        action:    String(data[i][3] || ""),
        target:    String(data[i][4] || "")
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch(e) {
    Logger.log("getAuditLogForFamily ERROR: " + e);
    return [];
  }
}

// ════════════════════════════════════════════════════════════════════
// v37.0 — DELETE FAMILY (server-side scrub)
// ════════════════════════════════════════════════════════════════════
//
// Called by frontend POST with { deleteFamilyRequest: { familyId } }.
// Scrubs:
//   • Family row on main sheet
//   • All Ledger rows with this familyId
//   • All AuditLog rows with this familyId
//   • Calendar events for each child (if any)
//
// The frontend handles reauth before posting this; backend trusts the call.
// ════════════════════════════════════════════════════════════════════
function deleteFamilyFull(familyId) {
  try {
    if (!familyId) throw new Error("familyId required");
    Logger.log("deleteFamilyFull: starting for " + familyId);

    // Capture state for calendar cleanup before we delete
    var state = null;
    try { state = loadFamilyState(familyId); } catch(e) { state = null; }

    // 1. Delete family row on main sheet
    deleteFamilyRow(familyId);

    // 2. Scrub Ledger rows
    try {
      var ledger = getLedgerSheet();
      var data = ledger.getDataRange().getValues();
      var victims = [];
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][1]) === familyId) victims.push(i + 1);
      }
      victims.sort(function(a,b){return b-a;}).forEach(function(r) { ledger.deleteRow(r); });
      Logger.log("deleteFamilyFull: scrubbed " + victims.length + " ledger rows");
    } catch(e) { Logger.log("deleteFamilyFull ledger ERROR: " + e); }

    // 3. Scrub AuditLog rows
    try {
      var al = getAuditLogSheet_();
      var adata = al.getDataRange().getValues();
      var avictims = [];
      for (var j = 1; j < adata.length; j++) {
        if (String(adata[j][1]) === familyId) avictims.push(j + 1);
      }
      avictims.sort(function(a,b){return b-a;}).forEach(function(r) { al.deleteRow(r); });
      Logger.log("deleteFamilyFull: scrubbed " + avictims.length + " audit log rows");
    } catch(e) { Logger.log("deleteFamilyFull audit ERROR: " + e); }

    // 4. Delete calendar events (best-effort)
    if (state && state.config && state.config.calendars) {
      try {
        Object.keys(state.config.calendars).forEach(function(child) {
          var calId = state.config.calendars[child];
          if (!calId) return;
          try {
            var cal = CalendarApp.getCalendarById(calId);
            if (cal) {
              // Delete all family-bank events in the next 2 years
              var now = new Date();
              var end = new Date(); end.setFullYear(end.getFullYear() + 2);
              var events = cal.getEvents(now, end, {search: "🏦"});
              events.forEach(function(ev) {
                try { ev.deleteEvent(); } catch(eve) {}
              });
              Logger.log("deleteFamilyFull: deleted " + events.length + " calendar events for " + child);
            }
          } catch(ce) { Logger.log("deleteFamilyFull cal ERROR (" + child + "): " + ce); }
        });
      } catch(e) { Logger.log("deleteFamilyFull calendar block ERROR: " + e); }
    }

    Logger.log("deleteFamilyFull: done for " + familyId);
    return true;
  } catch(err) {
    Logger.log("deleteFamilyFull ERROR: " + err);
    return false;
  }
}

// ════════════════════════════════════════════════════════════════════
// v37.0 — MAINTENANCE HELPERS
// ════════════════════════════════════════════════════════════════════

/** List all families with basic info — used by admin dashboard */
function listFamiliesWithSummary() {
  var out = [];
  forEachFamily(function(fid, state) {
    out.push({
      familyId:       fid,
      bankName:       getBankName(state),
      primaryParent:  state.config && state.config.primaryParent,
      parentCount:    getParentNames(state).length,
      childCount:     getChildNames(state).length
    });
  });
  return out;
}
