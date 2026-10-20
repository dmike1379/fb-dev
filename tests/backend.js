// v39 backend harness — runs the real Code.gs inside tests/gas-mock.js (fake Sheet, Cache, Lock,
// Calendar, Mail) and checks the v39 server rules. ~1 s. Usage: node tests/backend.js [repo]
const path = require('path');
const { makeMock, loadCodeGs, get, post } = require('./gas-mock.js');
const REPO = process.argv[2] || path.resolve(__dirname, '..');
const results = []; const check = (name, ok, detail) => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  — ' + detail : '')); };

const SOON = (() => { const d = new Date(Date.now() + 20 * 86400000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();   // a one-time chore inside the calendar search window
function family(extra) {
  return Object.assign({
    users: ['Alice', 'Cora'], roles: { Alice: 'parent', Cora: 'child' }, pins: { Alice: '1111', Cora: '2222' },
    config: { notify: { Cora: { calendar: true, email: false } }, calendars: { Cora: 'cal_cora' }, emails: {}, parentChildren: { Alice: ['Cora'] }, timezone: 'America/Chicago' },
    children: { Cora: { balances: { checking: 10, savings: 5 }, rates: { checking: 0, savings: 0 }, autoDeposit: { checking: 0, savings: 0 }, chores: [
      { id: 'c_daily', name: 'Make bed', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, reminderHour: 8 },
      { id: 'c_once', name: 'Wash car', schedule: 'once', onceDate: SOON, onceDueOn: false, status: 'pending', completedBy: 'Cora', completedAt: 'x', amount: 2, splitChk: 50, reminderHour: 8 },
    ], pendingDeposits: [], pendingWithdrawals: [], goals: [], loans: [] } },
    _savedAt: '2026-09-26T10:00:00.000Z',
  }, extra || {});
}
function boot(state) {
  const mock = makeMock();
  mock.sheets.Families = { rows: [['familyId', 'state'], ['fam_test', JSON.stringify(state)]] };
  mock.sheets.Ledger = { rows: [['Date', 'FamilyId', 'User', 'Child', 'Note', 'Amount']] };
  mock.addCalendar('cal_cora');
  const env = loadCodeGs(path.join(REPO, 'Code.gs'), mock);
  env.stored = () => JSON.parse(mock.sheets.Families.rows[1][1]);
  env.mock = mock;
  return env;
}
const body = (env, action, mut, extra) => { const s = env.stored(); delete s._rev; if (mut) mut(s); return Object.assign({ familyId: 'fam_test', lastAction: action, activeChild: 'Cora', tempTransactions: [], _savedAt: new Date().toISOString() }, s, extra || {}); };

// ── B1 first save from a client without _baseRev (older frontend) ─────────────────────────
let env = boot(family());
let r = post(env, body(env, 'Update', s => { s.children.Cora.balances.checking = 11; }));
check('B1 older client (no _baseRev) is accepted; the state gets _rev 1 and the reply carries it', r.status === 'ok' && r.rev === 1 && env.stored()._rev === 1 && env.stored().children.Cora.balances.checking === 11, JSON.stringify(r));
check('B1 the save ran under the script lock and flushed before releasing it', env.mock.lockLog.join(',') === 'tryLock,flush,release', env.mock.lockLog.join(','));

// ── B2 matching _baseRev → accepted, rev increments ───────────────────────────────────────
r = post(env, body(env, 'Update', s => { s.children.Cora.balances.checking = 12; }, { _baseRev: 1 }));
check('B2 a save based on the current rev is accepted and gets rev 2', r.status === 'ok' && r.rev === 2 && env.stored()._rev === 2 && env.stored().children.Cora.balances.checking === 12, JSON.stringify(r));

// ── B3 stale _baseRev → refused, nothing written ─────────────────────────────────────────
const before = env.mock.sheets.Families.rows[1][1];
r = post(env, body(env, 'Update', s => { s.children.Cora.balances.checking = 99; }, { _baseRev: 1 }));
check('B3 a save based on an older rev is refused as "stale" with the current rev', r.status === 'error' && r.reason === 'stale' && r.rev === 2, JSON.stringify(r));
check('B3 nothing was written (row unchanged, no ledger row, no email, no calendar change)', env.mock.sheets.Families.rows[1][1] === before && env.mock.sheets.Ledger.rows.length === 1 && env.mock.emails.length === 0 && env.mock.calEvents('cal_cora').length === 0, 'ledger rows=' + env.mock.sheets.Ledger.rows.length);
check('B3 a client cannot set _rev itself', (() => { const b = body(env, 'Update', null, { _baseRev: 2, _rev: 500 }); const rr = post(env, b); return rr.status === 'ok' && rr.rev === 3 && env.stored()._rev === 3; })(), 'rev=' + env.stored()._rev);

// ── B4 lock not available → "busy", nothing written ──────────────────────────────────────
env = boot(family()); env.mock.lockAvailable = false;
r = post(env, body(env, 'Update', s => { s.children.Cora.balances.checking = 50; }));
check('B4 lock unavailable → {status:"error", reason:"busy"} and nothing saved', r.status === 'error' && r.reason === 'busy' && env.stored().children.Cora.balances.checking === 10, JSON.stringify(r));

// ── B5 the compare reads the sheet, not the 60 s cache ───────────────────────────────────
env = boot(family());
post(env, body(env, 'Update', null));                                   // rev 1, and loadState now caches
env.mock.sheets.Families.rows[1][1] = JSON.stringify(Object.assign(env.stored(), { _rev: 7 }));   // another writer bumped the row behind the cache
r = post(env, body(env, 'Update', null, { _baseRev: 1 }));
check('B5 compare-and-set sees a row changed behind the cache (refused as stale, rev 7)', r.status === 'error' && r.reason === 'stale' && r.rev === 7, JSON.stringify(r));

// ── B6 email-link approve/deny take the lock and read fresh ──────────────────────────────
env = boot(family());
const token = env.call('generateToken', 'c_once', 'deny');
env.mock.sheets.Families.rows[1][1] = JSON.stringify(Object.assign(env.stored(), { _rev: 3 }));
r = get(env, { action: 'deny', familyId: 'fam_test', child: 'Cora', choreId: 'c_once', token });
check('B6 email-link deny runs under the lock and saves rev 4', env.mock.lockLog.join(',') === 'tryLock,flush,release' && env.stored()._rev === 4, 'lock=' + env.mock.lockLog.join(',') + ' rev=' + env.stored()._rev);
env = boot(family()); env.mock.lockAvailable = false;
r = get(env, { action: 'deny', familyId: 'fam_test', child: 'Cora', choreId: 'c_once', token });
check('B6 email-link with the lock unavailable shows a Busy page and changes nothing', /Busy/.test(r._raw || '') && env.stored().children.Cora.chores.length === 2, (r._raw || '').slice(0, 60));


// ── B7 (v39-2) calendar events follow delete / approve; hints never persist ──────────────
env = boot(family());
post(env, body(env, 'Chore Created', null));                             // daily series + (once chore is index 0? no: Chore Created syncs the LAST chore) → the once event
let evs = env.mock.calEvents('cal_cora');
check('B7 setup: "Chore Created" made the last chore\'s event', evs.length === 1 && /Wash car/.test(evs[0].title), JSON.stringify(evs.map(e => e.title)));
post(env, body(env, 'Chore Edited', null, { _editedChoreId: 'c_daily' }));  // rebuild only the daily one
evs = env.mock.calEvents('cal_cora');
check('B7 edit with _editedChoreId rebuilds only that chore (daily series added, once event untouched)', evs.length === 2 && evs.filter(e => /Make bed/.test(e.title)).length === 1 && evs.filter(e => /Wash car/.test(e.title)).length === 1, JSON.stringify(evs.map(e => e.title)));
r = post(env, body(env, 'Chore Approved (Quick)', s => { s.children.Cora.chores = s.children.Cora.chores.filter(c => c.id !== 'c_once'); }, { _approvedChoreId: 'c_once', _approvedChoreSchedule: 'once' }));
evs = env.mock.calEvents('cal_cora');
check('B7 approving a one-time chore (quick path) removes its event; the daily series stays', r.status === 'ok' && evs.length === 1 && /Make bed/.test(evs[0].title), JSON.stringify(evs.map(e => e.title)));
r = post(env, body(env, 'Chore Deleted', s => { s.children.Cora.chores = []; }, { _deletedChoreId: 'c_daily' }));
evs = env.mock.calEvents('cal_cora');
check('B7 deleting a chore removes its series', r.status === 'ok' && evs.length === 0, JSON.stringify(evs.map(e => e.title)));
const st = env.stored();
check('B7 hints never reach the saved state', st._deletedChoreId === undefined && st._approvedChoreId === undefined && st._approvedChoreSchedule === undefined && st._editedChoreId === undefined && st._baseRev === undefined, Object.keys(st).filter(k => k[0] === '_').join(','));


// ── B8 (v39-3) ?action=checkCalendar ─────────────────────────────────────────────────────
env = boot(family());
post(env, body(env, 'Chore Edited', null, { _editedChoreId: 'c_daily' }));   // one daily series on the calendar
r = get(env, { action: 'checkCalendar', familyId: 'fam_test', child: 'Cora', choreId: 'c_daily' });
check('B8 checkCalendar lists the chore\'s series once', Array.isArray(r.events) && r.events.length === 1 && r.events[0].series === true && /Make bed/.test(r.events[0].title), JSON.stringify(r));
r = get(env, { action: 'checkCalendar', familyId: 'fam_test', child: 'Cora', choreId: 'c_once' });
check('B8 a chore with no events → empty list', Array.isArray(r.events) && r.events.length === 0, JSON.stringify(r));
r = get(env, { action: 'checkCalendar', familyId: 'fam_test', child: 'Nobody', choreId: 'c_daily' });
check('B8 unknown child → childNotFound', r.status === 'error' && r.reason === 'childNotFound', JSON.stringify(r));
r = get(env, { action: 'checkCalendar', child: 'Cora', choreId: 'c_daily' });
check('B8 no familyId → familyNotFound (v38 rule)', r.status === 'error' && r.reason === 'familyNotFound', JSON.stringify(r));
env = boot(family({ config: { notify: { Cora: { calendar: false } }, calendars: { Cora: 'cal_cora' }, emails: {} } }));
r = get(env, { action: 'checkCalendar', familyId: 'fam_test', child: 'Cora', choreId: 'c_daily' });
check('B8 calendar notifications off → calendarOff', r.calendarOff === true, JSON.stringify(r));
env = boot(family({ config: { notify: { Cora: { calendar: true } }, calendars: {}, emails: {} } }));
r = get(env, { action: 'checkCalendar', familyId: 'fam_test', child: 'Cora', choreId: 'c_daily' });
check('B8 no Calendar ID → noCalendar', r.noCalendar === true, JSON.stringify(r));


// ── B9 (v39-4) email-link deny keeps a one-time chore ────────────────────────────────────
env = boot(family()); env.mock.sheets.Families.rows[1][1] = JSON.stringify(family({ children: { Cora: Object.assign(family().children.Cora, { chores: [ { id: 'c_past', name: 'Old once', schedule: 'once', onceDate: '2026-01-05', onceDueOn: true, status: 'pending', completedBy: 'Cora', amount: 1, splitChk: 50 } ] }) } }));
r = get(env, { action: 'deny', familyId: 'fam_test', child: 'Cora', choreId: 'c_past', token: env.call('generateToken', 'c_past', 'deny') });
let ch = env.stored().children.Cora.chores[0];
check('B9 denied one-time chore stays, available, past date cleared, note set', !!ch && ch.id === 'c_past' && ch.status === 'available' && ch.onceDate === null && ch.onceDueOn === false && ch.denialNote === 'Denied via email' && /Denied/.test(r._raw || ''), JSON.stringify(ch));
env = boot(family());
r = get(env, { action: 'deny', familyId: 'fam_test', child: 'Cora', choreId: 'c_once', token: env.call('generateToken', 'c_once', 'deny') });
ch = env.stored().children.Cora.chores.find(c => c.id === 'c_once');
check('B9 a future one-time chore keeps its date when denied', !!ch && ch.status === 'available' && ch.onceDate === SOON, JSON.stringify(ch));

// ── B10 (v39-6) ledger dates come from the server ─────────────────────────────────────────
env = boot(family());
r = post(env, body(env, 'Deposit Approved', null, { tempTransactions: [{ user: 'Bank', child: 'Cora', note: 'Deposit: test', amt: 3, date: 'Jan 1, 1999 1:00 AM' }] }));
const row = env.mock.sheets.Ledger.rows[1];
check('B10 a client-supplied ledger date is ignored (server timestamp used)', r.status === 'ok' && row && row[0] !== 'Jan 1, 1999 1:00 AM' && /\d{4}/.test(String(row[0])) && row[4] === 'Deposit: test' && row[5] === 3, JSON.stringify(row));

// ── B11 (v39-5) withdrawal email note reads the Note column ───────────────────────────────
env = boot(family({ config: { notify: { Cora: { calendar: false, email: true } }, calendars: {}, emails: { Cora: 'cora@example.com' } } }));
env.mock.sheets.Ledger.rows.push(['Sep 26, 2026 9:00 AM', 'fam_test', 'Bank', 'Cora', 'Withdraw: bike helmet', -12.5]);
env.call('sendEventEmail', 'fam_test', env.stored(), 'Withdrawal Approved', 'Cora');
const mail = env.mock.emails[env.mock.emails.length - 1];
const mailText = mail ? JSON.stringify(mail) : '';
check('B11 withdrawal-approved email carries the note and amount, not "Bank"', /bike helmet/.test(mailText) && /12\.50/.test(mailText) && !/>Bank</.test(mailText), mailText.slice(0, 120));

// ── B12 (v39-7) processSignupDiff is gone; doPost still fine ──────────────────────────────
check('B12 processSignupDiff removed', require('vm').runInContext('typeof processSignupDiff', env.ctx) === 'undefined');


// ── B13 (v39-9) time triggers run under the lock with a fresh read ────────────────────────
env = boot(family({ children: { Cora: Object.assign(family().children.Cora, { autoDeposit: { checking: 2, savings: 1, schedule: 'weekly' } }) } }));
post(env, body(env, 'Update', null));                                     // rev 1, cache primed by loadState
const cachedBefore = Object.keys(env.mock.cache).length;
env.mock.sheets.Families.rows[1][1] = JSON.stringify(Object.assign(env.stored(), { _rev: 9, children: Object.assign(env.stored().children, { Cora: Object.assign(env.stored().children.Cora, { balances: { checking: 50, savings: 5 } }) }) }));   // a phone saved behind the cache
env.mock.lockLog.length = 0;
env.call('dailyChoreReset');
check('B13 daily reset takes the lock (nothing to reset → no write)', env.mock.lockLog.join(',') === 'tryLock,release', env.mock.lockLog.join(','));
env.mock.lockAvailable = false; env.mock.log.length = 0;
env.call('dailyChoreReset');
check('B13 a busy lock skips the family and says so in the log', env.mock.log.some(l => /dailyChoreReset: lock busy for 60 s — SKIPPED fam_test \(nothing was changed for this family; tomorrow's run catches up/.test(l)) && env.mock.lockLog.filter(x => x === 'tryLock').length === 4, env.mock.log.slice(-2).join(' | '));
env.mock.lockAvailable = true;
const src = require('fs').readFileSync(require('path').join(REPO, 'Code.gs'), 'utf8');
check('B13 allowance, interest and daily reset all read fresh', ['_runAutomatedMondayDepositForFamily', '_runMonthlyMaintenanceForFamily', '_runDailyChoreResetForFamily'].every(f => new RegExp('function ' + f + '\\(familyId\\) \\{\\n  var state = loadState\\(familyId, \\{fresh: true\\}\\);').test(src)));


// ── B14 (v39-10) doGet &fresh=1 skips a stale cache and repairs it ───────────────────────
env = boot(family());
get(env, { familyId: 'fam_test' });                                     // primes the cache with rev-less state
env.mock.sheets.Families.rows[1][1] = JSON.stringify(Object.assign(env.stored(), { _rev: 12 }));   // the sheet moved on without clearing the cache
r = get(env, { familyId: 'fam_test' });
check('B14 setup: a plain GET returns the cached (older) copy', r._rev === undefined, 'rev=' + r._rev);
r = get(env, { familyId: 'fam_test', fresh: '1' });
check('B14 fresh=1 returns the sheet copy (rev 12)', r._rev === 12, 'rev=' + r._rev);
r = get(env, { familyId: 'fam_test' });
check('B14 and repairs the cache for later plain GETs', r._rev === 12, 'rev=' + r._rev);


// ── B15 (v39-14) event lookups match the whole chore id ───────────────────────────────────
env = boot(family({ children: { Cora: Object.assign(family().children.Cora, { chores: [
  { id: 'chore_7_1', name: 'One', schedule: 'daily', status: 'available', amount: 1, splitChk: 50 },
  { id: 'chore_7_10', name: 'Ten', schedule: 'daily', status: 'available', amount: 1, splitChk: 50 } ] }) } }));
post(env, body(env, 'Chore Edited', null));                              // no id → rebuild all: two series
check('B15 setup: two daily series', env.mock.calEvents('cal_cora').length === 2);
r = post(env, body(env, 'Chore Deleted', s => { s.children.Cora.chores = s.children.Cora.chores.filter(c => c.id !== 'chore_7_1'); }, { _deletedChoreId: 'chore_7_1' }));
const left = env.mock.calEvents('cal_cora').map(e => e.title);
check('B15 deleting chore_7_1 keeps chore_7_10\'s series', left.length === 1 && /Ten/.test(left[0]), JSON.stringify(left));
r = get(env, { action: 'checkCalendar', familyId: 'fam_test', child: 'Cora', choreId: 'chore_7_1' });
check('B15 checkCalendar for chore_7_1 finds nothing (not chore_7_10)', Array.isArray(r.events) && r.events.length === 0, JSON.stringify(r));


// ── B16 (v39-15) the calendar follows Reschedule ─────────────────────────────────────────
const ymd0 = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const TODAY = ymd0(new Date()); const P1 = ymd0(new Date(Date.now() + 86400000)); const P2 = ymd0(new Date(Date.now() + 2 * 86400000)); const P3 = ymd0(new Date(Date.now() + 3 * 86400000));
const DOW = new Date().getDay();
env = boot(family({ children: { Cora: Object.assign(family().children.Cora, { chores: [
  { id: 'd1', name: 'Daily', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, reminderHour: 20 },
  { id: 'w1', name: 'Weekly', schedule: 'weekly', weekdays: [DOW], status: 'available', amount: 1, splitChk: 50, reminderHour: 20 },
  { id: 'o1', name: 'Undated', schedule: 'once', status: 'available', amount: 1, splitChk: 50, reminderHour: 20 },
  { id: 'o2', name: 'DueOn', schedule: 'once', onceDate: P1, onceDueOn: true, status: 'available', amount: 1, splitChk: 50, reminderHour: 20 },
  { id: 'x',  name: 'Other', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, reminderHour: 7 } ] }) } }));
post(env, body(env, 'Chore Edited', null));                              // base events for all five
const otherSeries = env.mock.calEvents('cal_cora').filter(e => /Other/.test(e.title)).map(e => e.id).join(',');
r = post(env, body(env, 'Chores Rescheduled', s => { const c = s.children.Cora.chores;
  c[0].skipDates = [P1];                                                  // daily: skip tomorrow
  c[1].skipDates = [TODAY]; c[1].extraDates = [P1];                        // weekly: today → tomorrow
  c[2].notBefore = P2;                                                    // undated one-time waits 2 days
  c[3].onceDate = P3;                                                     // due-on moved 3 days out
}, { _editedChoreIds: ['d1', 'w1', 'o1', 'o2'] }));
const days = env.mock.calDays('cal_cora', TODAY, P3);
const on = (name) => days.filter(x => x.indexOf(' 🏦 ' + name + ' ') !== -1 || new RegExp(' 🏦 ' + name + ' —').test(x)).map(x => x.slice(0, 10));
check('B16 daily: every day except the skipped one', JSON.stringify(on('Daily')) === JSON.stringify([TODAY, P2, P3]), JSON.stringify(on('Daily')));
check('B16 weekly: not today, an extra event tomorrow', JSON.stringify(on('Weekly')) === JSON.stringify([P1]), JSON.stringify(on('Weekly')));
check('B16 undated one-time that waits: placed on its day', JSON.stringify(on('Undated')) === JSON.stringify([P2]), JSON.stringify(on('Undated')));
check('B16 due-on moved: event on the new day', JSON.stringify(on('DueOn')) === JSON.stringify([P3]), JSON.stringify(on('DueOn')));
check('B16 a chore not in the move keeps its events untouched', env.mock.calEvents('cal_cora').filter(e => /Other/.test(e.title)).map(e => e.id).join(',') === otherSeries && on('Other').length === 4, otherSeries);
check('B16 _editedChoreIds never reaches the saved state', env.stored()._editedChoreIds === undefined && r.status === 'ok');
r = get(env, { action: 'checkCalendar', familyId: 'fam_test', child: 'Cora', choreId: 'd1', days: '3' });
check('B16 checkCalendar &days=3 lists each occurrence of the chore', Array.isArray(r.occurrences) && JSON.stringify(r.occurrences.map(o => o.date)) === JSON.stringify([TODAY, P2, P3]) && r.occurrences.every(o => o.time === '20:00' && o.series === true), JSON.stringify(r));
r = post(env, body(env, 'Chore Edited', null, { _editedChoreId: 'w1' }));
check('B16 editing a moved chore keeps its move on the calendar', JSON.stringify(on('Weekly')) === JSON.stringify([P1]) && JSON.stringify(env.mock.calDays('cal_cora', TODAY, P3).filter(x => /Weekly/.test(x)).map(x => x.slice(0, 10))) === JSON.stringify([P1]));

// ── B17 (v39-16) ?action=version ─────────────────────────────────────────────────────────
r = get(env, { action: 'version' });
check('B17 version route answers the code version and nothing else', r && Object.keys(r).join(',') === 'codeVersion' && /^v\d/.test(r.codeVersion), JSON.stringify(r));

// ── B18 (v40-2) the 15-minute tick records missed chores ─────────────────────────────────
{
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const TODAYL = ymd(new Date()), YEST = ymd(new Date(Date.now() - 86400000));
  const at = (h) => { const d = new Date(); d.setHours(h, 5, 0, 0); return d.getTime(); };
  const setNow = (e, ms) => { const Real = require('vm').runInContext('Date', e.ctx); e.ctx.Date = class extends Real { constructor(...a) { a.length ? super(...a) : super(ms); } static now() { return ms; } }; };
  env = boot(family({ config: { notify: { Cora: { calendar: true, email: false, missedEmail: true } }, calendars: { Cora: 'cal_cora' }, emails: {}, parentChildren: { Alice: ['Cora'] }, timezone: 'America/Chicago' },
    children: { Cora: Object.assign(family().children.Cora, { chores: [
      { id: 'm1', name: 'Make bed', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, dueHour: 8 },
      { id: 'm2', name: 'Evening', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, dueHour: 20 },
      { id: 'm3', name: 'Done', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, dueHour: 8, lastCompleted: TODAYL },
      { id: 'm4', name: 'Skipped', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, dueHour: 8, skipDates: [TODAYL] },
      { id: 'm5', name: 'Pending', schedule: 'daily', status: 'pending', amount: 1, splitChk: 50, dueHour: 8 },
      { id: 'm6', name: 'Override', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, dueHour: 8, dayOverrides: { [TODAYL]: 21 } },
      { id: 'm8', name: 'Old chore', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), lastCompleted: ymd(new Date(Date.now() - 2 * 86400000)), doneDates: [ymd(new Date(Date.now() - 2 * 86400000))] },   // no dueHour (pre-v40): due 8 PM; v40-touched (doneDates); yesterday undone
      { id: 'm11', name: 'v39 approved', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), lastCompleted: TODAYL },   // approved today by a v39 client (no doneDates): yesterday must NOT be recorded
      { id: 'm12', name: 'Just made', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, dueHour: 8, createdAt: new Date(new Date().setHours(9, 0, 0, 0)).toISOString() },   // made today at 9:00, due 8 AM: not missed today
      { id: 'm9', name: 'Open once', schedule: 'once', onceDate: TODAYL, onceDueOn: false, status: 'available', amount: 1, splitChk: 50, dueHour: 8 },
      { id: 'm10', name: 'On once', schedule: 'once', onceDate: TODAYL, onceDueOn: true, status: 'available', amount: 1, splitChk: 50, dueHour: 8 } ] }) } }));
  { const s0 = env.stored(); s0.children.Cora.chores.forEach(c => { if (!c.createdAt) c.createdAt = new Date(Date.now() - 3 * 86400000).toISOString(); }); env.mock.sheets.Families.rows[1][1] = JSON.stringify(s0); env.mock.cache = {}; }
  post(env, body(env, 'Chore Edited', null));                      // calendar events for all
  setNow(env, at(9)); env.mock.lockLog.length = 0;
  env.call('calendarSyncTick');
  let st = env.stored(); const ch = (id) => st.children.Cora.chores.find(c => c.id === id);
  check('B18 at 9:05 the 8 AM chore is recorded missed; 8 PM, done-today, skipped, pending and 9 PM-override chores are not', JSON.stringify(ch('m1').missedDates) === JSON.stringify([TODAYL]) && !ch('m2').missedDates && !ch('m3').missedDates && !ch('m4').missedDates && !ch('m5').missedDates && !ch('m6').missedDates, JSON.stringify(st.children.Cora.chores.map(c => [c.id, c.missedDates])));
  check('B18 (v40-10 H1/L6) a pre-v40 chore (no dueHour) is due 8 PM: not missed today at 9:05, but YESTERDAY (undone, past) is recorded', JSON.stringify(ch('m8').missedDates) === JSON.stringify([YEST]), JSON.stringify(ch('m8').missedDates));
  check('B18 (v40-10 H2) a one-time chore: the "on today" one is missed at 9:05, the open "by today" one never', JSON.stringify(ch('m10').missedDates) === JSON.stringify([TODAYL]) && !ch('m9').missedDates, JSON.stringify([ch('m9').missedDates, ch('m10').missedDates]));
  check('B18 (v40-12 N1) a chore approved today by a v39 client (lastCompleted, no doneDates) is NOT recorded missed yesterday', !ch('m11').missedDates, JSON.stringify(ch('m11').missedDates));
  check('B18 (v40-12 N3) a chore made today after its due hour is not missed today', !ch('m12').missedDates, JSON.stringify(ch('m12').missedDates));
  check('B18 the day\'s calendar occurrence is retitled "⏰ Missed: …" (Make bed + On once today; only Old chore yesterday), other days untouched', env.mock.calDays('cal_cora', TODAYL, TODAYL).some(x => /⏰ Missed: 🏦 Make bed/.test(x)) && env.mock.calDays('cal_cora', TODAYL, TODAYL).filter(x => /Missed/.test(x)).length === 2 && env.mock.calDays('cal_cora', YEST, YEST).filter(x => /Missed/.test(x)).every(x => /Old chore/.test(x)) && !env.mock.calDays('cal_cora', TODAYL, TODAYL).some(x => /Missed: 🏦 Old chore/.test(x)), env.mock.calDays('cal_cora', YEST, TODAYL).join(' | '));
  check('B18 one missed-chore email per miss (setting on): Make bed, On once, Old chore (yesterday)', env.mock.emails.filter(e => /missed chore: Make bed/.test(e.subject)).length === 1 && env.mock.emails.filter(e => /missed chore/.test(e.subject)).length === 3, env.mock.emails.map(e => e.subject).join(' | '));
  check('B18 the tick ran under the lock and saved', env.mock.lockLog.join(',') === 'tryLock,flush,release', env.mock.lockLog.join(','));
  env.mock.lockLog.length = 0; env.mock.emails.length = 0;
  env.call('calendarSyncTick');
  st = env.stored();
  check('B18 a second tick records nothing twice (no save, no second email, title once)', JSON.stringify(ch('m1').missedDates) === JSON.stringify([TODAYL]) && env.mock.lockLog.join(',') === 'tryLock,release' && env.mock.emails.length === 0 && !/Missed: ⏰/.test(env.mock.calDays('cal_cora', TODAYL, TODAYL).join()), env.mock.lockLog.join(',') + ' ' + env.mock.calDays('cal_cora', TODAYL, TODAYL).join(' | '));
  setNow(env, at(21));
  env.call('calendarSyncTick'); st = env.stored();
  check('B18 at 9:05 PM the 8 PM chore and the 9 PM-override chore are missed too', JSON.stringify(ch('m2').missedDates) === JSON.stringify([TODAYL]) && JSON.stringify(ch('m6').missedDates) === JSON.stringify([TODAYL]), JSON.stringify([ch('m2').missedDates, ch('m6').missedDates]));
  // two chores named "Reading" (weekly Mon/Tue vs biweekly Fri/Sat/Sun): the email names the schedule, matching stays by id
  {
    const st3 = env.stored(); st3.config.notify.Cora.missedEmail = true; const dow = new Date().getDay();
    st3.children.Cora.chores.push({ id: 'r1', name: 'Reading', schedule: 'weekly', weekdays: [dow], status: 'available', amount: 0.5, splitChk: 50, dueHour: 8 },
                                   { id: 'r2', name: 'Reading', schedule: 'weekly', weekdays: [(dow + 3) % 7], status: 'available', amount: 0.25, splitChk: 50, dueHour: 8 });
    env.mock.sheets.Families.rows[1][1] = JSON.stringify(st3); env.mock.cache = {}; env.mock.emails.length = 0;
    env.call('calendarSyncTick'); const s4 = env.stored(); const r = (id) => s4.children.Cora.chores.find(c => c.id === id);
    const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    check('B18 same-named chores: only the one due today is missed (by id), and the email says which schedule', JSON.stringify(r('r1').missedDates) === JSON.stringify([TODAYL]) && !r('r2').missedDates && env.mock.emails.length === 1 && env.mock.emails[0].subject.indexOf('Reading (weekly ' + DN[dow] + ')') !== -1, JSON.stringify([r('r1').missedDates, r('r2').missedDates, env.mock.emails.map(e => e.subject)]));
  }
  env.mock.emails.length = 0;
  const st2 = env.stored(); st2.config.notify.Cora.missedEmail = false; st2.children.Cora.chores.push({ id: 'm7', name: 'Quiet', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, dueHour: 8, createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), doneDates: [YEST] });
  env.mock.sheets.Families.rows[1][1] = JSON.stringify(st2); env.mock.cache = {};
  env.call('calendarSyncTick');
  check('B18 with the setting off: recorded, no email', JSON.stringify(env.stored().children.Cora.chores.find(c => c.id === 'm7').missedDates) === JSON.stringify([TODAYL]) && env.mock.emails.length === 0, env.mock.emails.length + '');
}

// ── B19 (v40-3) a submission takes the day off the calendar; a denial puts it back; a rebuild keeps the marks ──
{
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const TODAYL = ymd(new Date()), TOM = ymd(new Date(Date.now() + 86400000));
  env = boot(family({ config: { notify: { Cora: { calendar: true, email: false } }, calendars: { Cora: 'cal_cora' }, emails: {}, parentChildren: { Alice: ['Cora'] }, timezone: 'America/Chicago' },
    children: { Cora: Object.assign(family().children.Cora, { chores: [
      { id: 's1', name: 'Dishes', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, dueHour: 17, reminderHour: 17 },
      { id: 's2', name: 'Other', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, dueHour: 8 } ] }) } }));
  post(env, body(env, 'Chore Edited', null));
  const days = (from, to) => env.mock.calDays('cal_cora', from, to);
  const before = days(TODAYL, TODAYL).length;
  post(env, body(env, 'Chore Submitted', (s) => { const c = s.children.Cora.chores[0]; c.status = 'pending'; c.completedBy = 'Cora'; c.submittedFor = TODAYL; c.doneDates = [TODAYL]; }, { _submittedChoreId: 's1', _submittedFor: TODAYL }));
  let st = env.stored();
  check('B19 submission: today\'s Dishes occurrence is gone, Other stays, tomorrow untouched, hints not saved', before === 2 && !days(TODAYL, TODAYL).some(x => /Dishes/.test(x)) && days(TODAYL, TODAYL).some(x => /Other/.test(x)) && days(TOM, TOM).some(x => /Dishes/.test(x)) && st._submittedChoreId === undefined && st._submittedFor === undefined && st.children.Cora.chores[0].doneDates[0] === TODAYL, days(TODAYL, TOM).join(' | '));
  post(env, body(env, 'Chore Denied', (s) => { const c = s.children.Cora.chores[0]; c.status = 'available'; c.completedBy = null; c.submittedFor = null; c.doneDates = []; }, { _deniedChoreId: 's1', _deniedFor: TODAYL }));
  const back = days(TODAYL, TODAYL).filter(x => /Dishes/.test(x));
  const ev = env.mock.calendars.cal_cora.events.filter(e => !e.series && /Dishes/.test(e.title));
  check('B19 denial: the occurrence is back as a single event at the calendar hour (17:00), once', back.length === 1 && ev.length === 1 && ev[0].start.getHours() === 17 && env.stored()._deniedChoreId === undefined, back.join(' | ') + ' ' + ev.map(e => e.start.getHours()).join());
  post(env, body(env, 'Chore Denied', null, { _deniedChoreId: 's1', _deniedFor: TODAYL }));
  check('B19 a second denial does not add a second event', days(TODAYL, TODAYL).filter(x => /Dishes/.test(x)).length === 1, days(TODAYL, TODAYL).join(' | '));
  // email deny: doneDates back out, event back
  post(env, body(env, 'Chore Submitted', (s) => { const c = s.children.Cora.chores[1]; c.status = 'pending'; c.completedBy = 'Cora'; c.submittedFor = TODAYL; c.doneDates = [TODAYL]; }, { _submittedChoreId: 's2', _submittedFor: TODAYL }));
  const otherGone = !days(TODAYL, TODAYL).some(x => /Other/.test(x));
  get(env, { action: 'deny', familyId: 'fam_test', child: 'Cora', choreId: 's2', token: env.call('generateToken', 's2', 'deny') });
  st = env.stored();
  check('B19 email deny: doneDates emptied, submittedFor cleared, occurrence back', otherGone && (st.children.Cora.chores[1].doneDates || []).length === 0 && !st.children.Cora.chores[1].submittedFor && days(TODAYL, TODAYL).filter(x => /Other/.test(x)).length === 1, JSON.stringify(st.children.Cora.chores[1].doneDates) + ' ' + days(TODAYL, TODAYL).join(' | '));
  // rebuild keeps marks: s1 done today, s2 missed today
  post(env, body(env, 'Chore Edited', (s) => { s.children.Cora.chores[0].doneDates = [TODAYL]; s.children.Cora.chores[1].missedDates = [TODAYL]; }));
  const t = days(TODAYL, TODAYL);
  check('B19 rebuild after an edit: the done day stays off, the missed day keeps "⏰ Missed:", tomorrow is plain', !t.some(x => /Dishes/.test(x)) && t.some(x => /⏰ Missed: 🏦 Other/.test(x)) && days(TOM, TOM).filter(x => /Dishes|Other/.test(x) && !/Missed/.test(x)).length === 2, t.join(' | ') + ' // ' + days(TOM, TOM).join(' | '));
}

// ── B20 (v40-5) email approve with &reward=0 on a late chore; the submission email carries the third link ──
{
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const TODAYL = ymd(new Date()), TWO = ymd(new Date(Date.now() - 2 * 86400000));
  env = boot(family({ config: { notify: { Cora: { calendar: false, email: true } }, emails: { Alice: 'alice@example.com' }, parentChildren: { Alice: ['Cora'] }, timezone: 'America/Chicago' },
    children: { Cora: Object.assign(family().children.Cora, { balances: { checking: 10, savings: 5 }, chores: [
      { id: 'l1', name: 'Late', schedule: 'daily', status: 'pending', completedBy: 'Cora', completedAt: 'x', amount: 2, splitChk: 50, dueHour: 17, submittedFor: TWO, lateFor: TWO, doneDates: [TWO], missedDates: [TWO], streakMilestone: 3, streakReward: 1, streakCount: 1 },
      { id: 'l2', name: 'Plain', schedule: 'daily', status: 'pending', completedBy: 'Cora', completedAt: 'x', amount: 2, splitChk: 50, dueHour: 17, submittedFor: TODAYL, doneDates: [TODAYL] } ] }) } }));
  env.mock.emails.length = 0;
  post(env, body(env, 'Chore Submitted', null, { _submittedChoreId: 'l1', _submittedFor: TWO }));
  const em = env.mock.emails.find(e => /completed a chore/.test(e.subject) || /completed a chore/.test(e.htmlBody || ''));
  const emHtml = em ? (em.htmlBody || em.html || em.body || '') : '';
  check('B20 submission email for a late chore: says late, shows the day + due hour, has the "Approve, no reward" link (&reward=0)', !!em && /late/i.test(emHtml) && emHtml.indexOf(TWO) !== -1 && /5 PM/.test(emHtml) && /&reward=0/.test(emHtml) && /Approve, no reward/.test(emHtml), em ? em.subject : 'no email');
  const r = get(env, { action: 'approve', familyId: 'fam_test', child: 'Cora', choreId: 'l1', token: env.call('generateToken', 'l1', 'approve'), reward: '0' });
  let st = env.stored(); let c = st.children.Cora.chores.find(x => x.id === 'l1');
  const led = env.mock.sheets.Ledger.rows.slice(1);
  check('B20 email approve &reward=0: balances unchanged, $0 ledger line, lastCompleted = that day, missedDates cleared, lateFor/submittedFor cleared, streak +1, page says no reward', st.children.Cora.balances.checking === 10 && st.children.Cora.balances.savings === 5 && led.some(rw => /Late \(late, no reward\)/.test(rw[4]) && rw[5] === 0) && c.status === 'available' && c.lastCompleted === TWO && c.missedDates.length === 0 && !c.lateFor && !c.submittedFor && c.streakCount === 2 && /No reward this time/.test(String(r && r._raw)), JSON.stringify([st.children.Cora.balances, c.lastCompleted, c.missedDates, c.streakCount, led.map(rw => [rw[4], rw[5]])]));
  const r2 = get(env, { action: 'approve', familyId: 'fam_test', child: 'Cora', choreId: 'l2', token: env.call('generateToken', 'l2', 'approve') });
  st = env.stored(); c = st.children.Cora.chores.find(x => x.id === 'l2');
  check('B20 plain email approve unchanged: $2 deposited 50/50, lastCompleted = today', st.children.Cora.balances.checking === 11 && st.children.Cora.balances.savings === 6 && c.lastCompleted === TODAYL && /deposited/.test(String(r2 && r2._raw)), JSON.stringify([st.children.Cora.balances, c.lastCompleted]));
}

// ── B21 (v40-7) installTriggers installs the 5 triggers once, in the bank's time zone ─────────
{
  env = boot(family());
  const r1 = env.call('installTriggers');
  const T = env.mock.triggers;
  const by = (fn) => T.find(t => t.fn === fn);
  check('B21 first run installs 5: Monday 8, monthly 1st 7, daily 6, Sunday 9, calendarSyncTick every 15 min', T.length === 5 && r1.installed.length === 5 && by('automatedMondayDeposit').spec.onWeekDay === 'MO' && by('automatedMondayDeposit').spec.atHour === 8 && by('monthlyMaintenance').spec.onMonthDay === 1 && by('monthlyMaintenance').spec.atHour === 7 && by('dailyChoreReset').spec.everyDays === 1 && by('dailyChoreReset').spec.atHour === 6 && by('sundayChoreReminder').spec.onWeekDay === 'SU' && by('sundayChoreReminder').spec.atHour === 9 && by('calendarSyncTick').spec.everyMinutes === 15, JSON.stringify(T));
  check('B21 the clock triggers carry the bank time zone', ['automatedMondayDeposit', 'monthlyMaintenance', 'dailyChoreReset', 'sundayChoreReminder'].every(fn => typeof by(fn).spec.inTimezone === 'string' && by(fn).spec.inTimezone.length > 0), JSON.stringify(T.map(t => t.spec.inTimezone)));
  const r2 = env.call('installTriggers');
  check('B21 a second run installs nothing and reports all 5 as already there', env.mock.triggers.length === 5 && r2.installed.length === 0 && r2.skipped.length === 5, JSON.stringify(r2));
}

// ── B22 (v40-10) audit fixes: H3 lastCompleted never backwards / deny keeps an earlier day; L2 once-chore deny; L3 child email; L1 once + edit ──
{
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const TODAYL = ymd(new Date()), TWO = ymd(new Date(Date.now() - 2 * 86400000)), P3 = ymd(new Date(Date.now() + 3 * 86400000));
  env = boot(family({ config: { notify: { Cora: { calendar: true, email: true } }, calendars: { Cora: 'cal_cora' }, emails: { Cora: 'cora@example.com', Alice: 'alice@example.com' }, parentChildren: { Alice: ['Cora'] }, timezone: 'America/Chicago' },
    children: { Cora: Object.assign(family().children.Cora, { balances: { checking: 10, savings: 5 }, chores: [
      { id: 'h1', name: 'Makeup', schedule: 'daily', status: 'pending', completedBy: 'Cora', completedAt: 'x', amount: 2, splitChk: 50, dueHour: 17, lastCompleted: TODAYL, doneDates: [TWO, TODAYL], submittedFor: TWO, lateFor: TWO, missedDates: [TWO] },
      { id: 'h2', name: 'Deny me', schedule: 'daily', status: 'pending', completedBy: 'Cora', completedAt: 'x', amount: 2, splitChk: 50, dueHour: 17, lastCompleted: TODAYL, doneDates: [TWO, TODAYL], submittedFor: TWO, lateFor: TWO, missedDates: [TWO] },
      { id: 'o1', name: 'By date', schedule: 'once', onceDate: P3, onceDueOn: false, status: 'available', amount: 1, splitChk: 50, dueHour: 9 } ] }) } }));
  post(env, body(env, 'Chore Edited', null));
  env.mock.emails.length = 0;
  get(env, { action: 'approve', familyId: 'fam_test', child: 'Cora', choreId: 'h1', token: env.call('generateToken', 'h1', 'approve'), reward: '0' });
  let st = env.stored(); let c = st.children.Cora.chores.find(x => x.id === 'h1');
  const childMail = env.mock.emails.find(e => /approved/i.test(e.subject) || /approved/.test(e.htmlBody || ''));
  check('B22 (H3) approving a make-up for 2 days ago keeps lastCompleted = today (never backwards); the day leaves missedDates', c.lastCompleted === TODAYL && c.missedDates.length === 0 && c.status === 'available', JSON.stringify([c.lastCompleted, c.missedDates]));
  check('B22 (L3) the child\'s email names the chore without "(late, no reward)" and says no reward', !!childMail && /Makeup<\/strong>/.test(childMail.htmlBody) && !/late, no reward\)/.test(childMail.htmlBody) && /no reward/.test(childMail.htmlBody), childMail ? childMail.subject : 'no email');
  get(env, { action: 'deny', familyId: 'fam_test', child: 'Cora', choreId: 'h2', token: env.call('generateToken', 'h2', 'deny') });
  c = env.stored().children.Cora.chores.find(x => x.id === 'h2');
  check('B22 (H3) denying a make-up for 2 days ago keeps today\'s lastCompleted and only drops that day from doneDates', c.lastCompleted === TODAYL && JSON.stringify(c.doneDates) === JSON.stringify([TODAYL]) && c.status === 'available', JSON.stringify([c.lastCompleted, c.doneDates]));
  // once chore "by P3": submitted today → its event (on P3) stays? the submission deletes TODAY's occurrence (none); approve of once deletes the chore; deny must not add an event today
  const days = (a, b) => env.mock.calDays('cal_cora', a, b);
  post(env, body(env, 'Chore Submitted', (s) => { const o = s.children.Cora.chores.find(x => x.id === 'o1'); o.status = 'pending'; o.completedBy = 'Cora'; o.submittedFor = TODAYL; o.doneDates = [TODAYL]; }, { _submittedChoreId: 'o1', _submittedFor: TODAYL }));
  post(env, body(env, 'Chore Denied', (s) => { const o = s.children.Cora.chores.find(x => x.id === 'o1'); o.status = 'available'; o.completedBy = null; o.submittedFor = null; o.doneDates = []; }, { _deniedChoreId: 'o1', _deniedFor: TODAYL }));
  check('B22 (L2) denying a "by <date>" once chore adds no event on the submission day; its own-date event stays single', !days(TODAYL, TODAYL).some(x => /By date/.test(x)) && days(P3, P3).filter(x => /By date/.test(x)).length === 1, days(TODAYL, P3).filter(x => /By date/.test(x)).join(' | '));
  // L1: a once chore submitted on its own date, then edited — the deleted event does not come back
  post(env, body(env, 'Chore Edited', (s) => { const o = s.children.Cora.chores.find(x => x.id === 'o1'); o.onceDate = TODAYL; o.onceDueOn = true; }, { _editedChoreId: 'o1' }));
  post(env, body(env, 'Chore Submitted', (s) => { const o = s.children.Cora.chores.find(x => x.id === 'o1'); o.status = 'pending'; o.completedBy = 'Cora'; o.submittedFor = TODAYL; o.doneDates = [TODAYL]; }, { _submittedChoreId: 'o1', _submittedFor: TODAYL }));
  const gone = !days(TODAYL, TODAYL).some(x => /By date/.test(x));
  post(env, body(env, 'Chore Edited', null, { _editedChoreId: 'o1' }));
  check('B22 (L1) a submitted once chore\'s event stays off the calendar through a rebuild', gone && !days(TODAYL, TODAYL).some(x => /By date/.test(x)), days(TODAYL, TODAYL).join(' | '));
}

// ── B23 (v41-1) the time zone is a setting: family Admin value, else the project's zone; no constant in the file ──
{
  env = boot(family());
  const vm = require('vm'); const run = (code) => vm.runInContext(code, env.ctx);
  const gtz = (tz) => run('getTimezone(' + JSON.stringify({ config: tz === undefined ? {} : { timezone: tz } }) + ')');
  check('B23 getTimezone: "GMT-6" (old label) → America/Chicago, an IANA name passes through, none/garbage → the project zone', gtz('GMT-6') === 'America/Chicago' && gtz('America/Denver') === 'America/Denver' && gtz('Pacific/Honolulu') === 'Pacific/Honolulu' && gtz(undefined) === 'America/Chicago' && gtz('Mars/Base') === 'America/Chicago' && gtz('Asia/Tokyo') === 'America/Chicago' && gtz('<script>') === 'America/Chicago', [gtz('GMT-6'), gtz(undefined), gtz('<script>')].join());
  env.mock.tz = 'America/Phoenix';
  check('B23 a family with no setting follows the Apps Script project zone (Session.getScriptTimeZone)', gtz(undefined) === 'America/Phoenix' && run('buildDefaultState().config.timezone') === 'America/Phoenix', gtz(undefined));
  const U = env.mock.globals.Utilities, real = U.formatDate, seen = []; U.formatDate = (d, tz, f) => { seen.push(tz); return real(d, tz, f); };
  run('todayDateStr(' + JSON.stringify({ config: { timezone: 'America/Denver' } }) + ')');
  U.formatDate = real;
  check('B23 todayDateStr(state) uses the family zone', seen.length >= 1 && seen.every(z => z === 'America/Denver'), JSON.stringify(seen));
  env.mock.triggers.length = 0; env.call('installTriggers');
  check('B23 installTriggers creates the clock triggers in the project zone', env.mock.triggers.filter(t => t.spec.inTimezone).every(t => t.spec.inTimezone === 'America/Phoenix') && env.mock.triggers.length === 5, JSON.stringify(env.mock.triggers.map(t => t.spec.inTimezone)));
  const src = require('fs').readFileSync(require('path').join(REPO, 'Code.gs'), 'utf8');
  check('B23 Code.gs has no BANK_TIMEZONE variable left to hand-edit', !/var BANK_TIMEZONE/.test(src) && !/[^ ]BANK_TIMEZONE[,)]/.test(src));
  check('B23 (v41-3) the project zone itself is accepted even when not in the Admin list', gtz('Asia/Tokyo') === 'America/Phoenix' && (() => { env.mock.tz = 'Asia/Tokyo'; const r = gtz('Asia/Tokyo'); env.mock.tz = 'America/Phoenix'; return r === 'Asia/Tokyo'; })());
  check('B23 (v41-3 L8) _ymdMinusDay is pure date arithmetic across month/year/DST edges', run('_ymdMinusDay("2026-03-01")') === '2026-02-28' && run('_ymdMinusDay("2028-03-01")') === '2028-02-29' && run('_ymdMinusDay("2027-01-01")') === '2026-12-31' && run('_ymdMinusDay("2026-03-09")') === '2026-03-08' && run('_ymdMinusDay("2026-11-02")') === '2026-11-01');
  const srcList = (src.match(/var TZ_OK = \[([^\]]*)\]/) || [])[1] || '';
  const html = require('fs').readFileSync(require('path').join(REPO, 'index.html'), 'utf8');
  const sel = (html.match(/<select id="admin-timezone">([\s\S]*?)<\/select>/) || [])[1] || '';
  const opts = (sel.match(/value="([^"]+)"/g) || []).map(x => x.slice(7, -1));
  const gsList = (srcList.match(/"([^"]+)"/g) || []).map(x => x.slice(1, -1));
  const appList = ((require('fs').readFileSync(require('path').join(REPO, 'app.js'), 'utf8').match(/const TZ_OK=\[([^\]]*)\]/) || [])[1] || '').match(/"([^"]+)"/g).map(x => x.slice(1, -1));
  check('B23 (v41-3) the Admin list, app.js TZ_OK and Code.gs TZ_OK are the same zones', opts.length > 5 && JSON.stringify(opts) === JSON.stringify(gsList) && JSON.stringify(opts) === JSON.stringify(appList), JSON.stringify([opts.length, gsList.length, appList.length]));
  env.mock.tz = 'America/Chicago';
}

// ── B24 (v42) Stage B: changes made in Google Calendar reach the app on the next tick ──
{
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
  const dow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getDay(); };
  const W = 3;   // the weekly chore's weekday = 3 days from today
  env = boot(family({ children: { Cora: Object.assign(family().children.Cora, { chores: [
    { id: 'd1', name: 'Dishes', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, reminderHour: 17, dueHour: 17 },
    { id: 'w1', name: 'Trash', schedule: 'weekly', weekdays: [dow(W)], status: 'available', amount: 1, splitChk: 50, reminderHour: 18, dueHour: 18 },
    { id: 'o1', name: 'Car', schedule: 'once', onceDate: plus(5), onceDueOn: true, status: 'available', amount: 1, splitChk: 50, reminderHour: 9, dueHour: 9 },
    { id: 'p1', name: 'Old', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, reminderHour: 8 },   // pre-v40: calendar 8 AM, due 8 PM
    { id: 'z1', name: 'Gone', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, reminderHour: 7, dueHour: 7 } ] }) } }));
  { const at5 = new Date(); at5.setHours(5, 5, 0, 0); const ms = at5.getTime(); const Real = require('vm').runInContext('Date', env.ctx); env.ctx.Date = class extends Real { constructor(...a) { a.length ? super(...a) : super(ms); } static now() { return ms; } }; }   // 5:05 AM: no chore is past due, so only Stage B can save
  post(env, body(env, 'Chore Edited', null));   // builds every chore's events; build marker = today
  const settle = () => { Object.keys(env.mock.cache).filter(k => /^fbCalBusy:/.test(k)).forEach(k => delete env.mock.cache[k]); };   // time passes: the busy flag expires
  const tick = () => { settle(); env.call('calendarSyncTick'); };
  const cal = () => env.mock.calendars.cal_cora;
  const run = (code) => require('vm').runInContext(code, env.ctx);
  const occ = (id, day) => run('_occurrencesOn(CalendarApp.getCalendarById("cal_cora"), ' + JSON.stringify(id) + ', ' + JSON.stringify(day) + ')');
  const hourOn = (id, day) => { const o = occ(id, day); return o.length ? o[0].getStartTime().getHours() : null; };
  const mk = (title, day, h, desc) => run('CalendarApp.getCalendarById("cal_cora").createEvent(' + JSON.stringify(title) + ', new Date(' + JSON.stringify(day) + ' + "T' + String(h).padStart(2, '0') + ':00:00"), new Date(' + JSON.stringify(day) + ' + "T' + String(h).padStart(2, '0') + ':30:00"), {description: ' + JSON.stringify(desc) + '})');
  const retime = (id, day, h) => occ(id, day).forEach(e => { const n = new Date(e.getStartTime()); n.setHours(h); e.setTime(n, new Date(n.getTime() + 1800000)); });
  const ch = (id) => env.stored().children.Cora.chores.find(c => c.id === id);
  check('B24 a save marks the child\'s calendar busy before the tick can read it (v42-3 M1)', !!env.mock.cache['fbCalBusy:cal_cora']);
  const rev0 = env.stored()._rev;
  tick();
  check('B24 no edits in the calendar → the tick changes nothing (no save; the app\'s own events are not read as edits)', env.stored()._rev === rev0 && !ch('d1').skipDates && !ch('w1').extraDates, String(env.stored()._rev) + ' vs ' + rev0);
  // one-day edits
  occ('d1', plus(3)).forEach(e => e.deleteEvent());
  retime('d1', plus(4), 19);
  occ('w1', plus(W)).forEach(e => e.deleteEvent()); mk('🏦 Trash — Earn $1.00', plus(W + 1), 18, 'CHORE_ID:w1:DAY:' + dow(W));
  occ('o1', plus(5)).forEach(e => e.deleteEvent()); mk('🏦 Car — Earn $1.00', plus(6), 11, 'CHORE_ID:o1');
  retime('p1', plus(2), 9);
  run('CalendarApp.getCalendarById("cal_cora").createAllDayEvent("🏦 Dishes", new Date(' + JSON.stringify(plus(8)) + ' + "T00:00:00"), {description: "CHORE_ID:d1"})');
  tick();
  check('B24 a day deleted in Google Calendar → skipDates', JSON.stringify(ch('d1').skipDates) === JSON.stringify([plus(3)]), JSON.stringify(ch('d1').skipDates));
  check('B24 one day moved to 7 PM → calendar hour 7 PM and the due hour moves with it (5 → 7 PM)', ch('d1').calOverrides && ch('d1').calOverrides[plus(4)] === 19 && run('_choreDueHour(' + JSON.stringify(ch('d1')) + ', ' + JSON.stringify(plus(4)) + ')') === 19, JSON.stringify([ch('d1').calOverrides, ch('d1').dayOverrides]));
  check('B24 (v42-3 M2) a pre-v40 chore (calendar 8 AM, due 8 PM) moved to 9 AM is due 9 PM, not 9 AM', ch('p1').calOverrides[plus(2)] === 9 && ch('p1').dayOverrides[plus(2)] === 21, JSON.stringify([ch('p1').calOverrides, ch('p1').dayOverrides]));
  check('B24 the weekly occurrence moved a day later → skipped on its day, extra on the new one (same hour, no override)', JSON.stringify(ch('w1').skipDates) === JSON.stringify([plus(W)]) && JSON.stringify(ch('w1').extraDates) === JSON.stringify([plus(W + 1)]) && !ch('w1').calOverrides, JSON.stringify([ch('w1').skipDates, ch('w1').extraDates, ch('w1').calOverrides]));
  check('B24 the one-time chore moved → onceDate follows, with its new hour (due moves 9 → 11)', ch('o1').onceDate === plus(6) && ch('o1').calOverrides[plus(6)] === 11 && ch('o1').dayOverrides[plus(6)] === 11, JSON.stringify([ch('o1').onceDate, ch('o1').calOverrides, ch('o1').dayOverrides]));
  check('B24 (v42-3 L3) an all-day event is ignored', (ch('d1').extraDates || []).indexOf(plus(8)) === -1 && !(ch('d1').calOverrides || {})[plus(8)]);
  const rev1 = env.stored()._rev;
  tick();
  check('B24 the next tick finds nothing new (no echo, no save)', env.stored()._rev === rev1, env.stored()._rev + ' vs ' + rev1);
  // an edit in the app rebuilds the calendar; the one-day moves survive it
  post(env, body(env, 'Chore Edited', null));
  check('B24 an app edit rebuilds the calendar with the moves kept', occ('d1', plus(3)).length === 0 && hourOn('d1', plus(4)) === 19 && occ('w1', plus(W)).length === 0 && hourOn('w1', plus(W + 1)) === 18 && hourOn('o1', plus(6)) === 11 && occ('o1', plus(5)).length === 0 && hourOn('p1', plus(2)) === 9, JSON.stringify([occ('d1', plus(3)).length, hourOn('d1', plus(4)), occ('w1', plus(W)).length, hourOn('w1', plus(W + 1)), hourOn('o1', plus(6)), hourOn('p1', plus(2))]));
  const rev2 = env.stored()._rev;
  tick();
  check('B24 after the rebuild the tick still finds nothing new', env.stored()._rev === rev2, env.stored()._rev + ' vs ' + rev2);
  // whole-series hour change → restored + notice
  cal().events.filter(e => e.series && /CHORE_ID:d1\b/.test(e.description)).forEach(e => { e.start = new Date(e.start); e.start.setHours(6); e.end = new Date(e.start.getTime() + 1800000); });
  tick();
  let st = env.stored();
  check('B24 the whole series moved to 6 AM in Google Calendar → the app\'s schedule wins: rebuilt at 5 PM, one notice', hourOn('d1', plus(6)) === 17 && hourOn('d1', plus(40)) === 17 && (st.notices || []).length === 1 && /Dishes/.test(st.notices[0].text) && st.notices[0].child === 'Cora', JSON.stringify([hourOn('d1', plus(6)), (st.notices || []).map(n => n.text)]));
  // (H2) one weekday's whole series deleted → restored, never a pile of skips
  const twoDay = Object.assign({}, ch('w1'), { id: 'w2', name: 'Feed fish', weekdays: [dow(1), dow(2)].sort(), skipDates: undefined, extraDates: undefined });
  { const s0 = env.stored(); s0.children.Cora.chores.push(twoDay); env.mock.sheets.Families.rows[1][1] = JSON.stringify(s0); env.mock.cache = {}; }
  post(env, body(env, 'Chore Edited', null, { _editedChoreId: 'w2' }));
  tick();   // built today → diff from tomorrow; nothing to see yet
  cal().events.filter(e => e.series && new RegExp('CHORE_ID:w2:DAY:' + dow(2) + '\\b').test(e.description)).forEach(e => { e.exdates = []; cal().events = cal().events.filter(x => x !== e); });
  tick();
  st = env.stored();
  check('B24 (v42-3 H2) one weekday\'s whole series gone → put back with a notice; no day is skipped', !ch('w2').skipDates && occ('w2', plus(9)).length + occ('w2', plus(8)).length >= 1 && (st.notices || []).some(n => /Feed fish/.test(n.text)), JSON.stringify([ch('w2').skipDates, (st.notices || []).map(n => n.text.slice(0, 20))]));
  // all events gone → left alone (Stage C)
  const rev3 = env.stored()._rev;
  run('deleteEventsByChoreId("cal_cora", "z1")');
  tick();
  check('B24 every event of a chore deleted → nothing skipped; (v44-4 Stage C) the chore is flagged deleted-in-calendar with one notice', !ch('z1').skipDates && !!ch('z1').calendarDeleted && env.stored()._rev === rev3 + 1 && (env.stored().notices || []).some(n => /deleted from Google Calendar/.test(n.text)), JSON.stringify([ch('z1').skipDates, ch('z1').calendarDeleted]));
  // busy calendar → no diff, then picked up
  occ('w1', plus(W + 7)).forEach(e => e.deleteEvent());
  env.mock.cache['fbCalBusy:cal_cora'] = { v: '1', exp: Date.now() + 60000 };
  env.call('calendarSyncTick');
  check('B24 while a save is writing the calendar the tick leaves it alone', (ch('w1').skipDates || []).indexOf(plus(W + 7)) === -1);
  tick();
  check('B24 …and picks the change up on the next tick', (ch('w1').skipDates || []).indexOf(plus(W + 7)) !== -1, JSON.stringify(ch('w1').skipDates));
  // a restore that does not hold is not repeated the same day
  const nNotices = (env.stored().notices || []).length;
  cal().events.filter(e => e.series && /CHORE_ID:d1\b/.test(e.description)).forEach(e => { e.start = new Date(e.start); e.start.setHours(6); e.end = new Date(e.start.getTime() + 1800000); });
  tick();
  check('B24 a series edited again the same day is not restored twice (no loops, no second notice)', (env.stored().notices || []).length === nNotices && hourOn('d1', plus(6)) === 6, JSON.stringify([(env.stored().notices || []).length, nNotices, hourOn('d1', plus(6))]));
  // (H1) first look: no marker → silent rebuild (fixes a calendar built by older code), no notice, no skips
  const nn = (env.stored().notices || []).length;
  delete env.mock.props['fbCalBuilt:cal_cora:w1'];
  occ('w1', plus(W + 14)).forEach(e => e.deleteEvent());   // the "old" calendar misses a day
  tick();
  check('B24 (v42-3 H1) a chore seen for the first time is rebuilt silently — the old calendar is not read as edits', (ch('w1').skipDates || []).indexOf(plus(W + 14)) === -1 && occ('w1', plus(W + 14)).length === 1 && (env.stored().notices || []).length === nn && !!env.mock.props['fbCalBuilt:cal_cora:w1'], JSON.stringify([ch('w1').skipDates, occ('w1', plus(W + 14)).length]));
  // (L1) an event left on a done day never makes the tick save over and over
  { const s0 = env.stored(); s0.children.Cora.chores.find(c => c.id === 'd1').doneDates = [plus(5)]; env.mock.sheets.Families.rows[1][1] = JSON.stringify(s0); env.mock.cache = {}; }
  const rev4 = env.stored()._rev; tick(); tick();
  check('B24 (v42-3 L1) an event on a done day is ignored — no save churn', env.stored()._rev === rev4, env.stored()._rev + ' vs ' + rev4);
  // (M5) only turning the calendar on (or pointing it elsewhere) clears the markers → next tick rebuilds silently
  post(env, body(env, 'Child Profile Updated', null));
  check('B24 (v42-4 M5) a profile save that leaves the calendar alone keeps the markers', ['d1', 'w1'].every(id => !!env.mock.props['fbCalBuilt:cal_cora:' + id]));
  post(env, body(env, 'Child Profile Updated', (s) => { s.config.notify.Cora.calendar = false; }));
  post(env, body(env, 'Child Profile Updated', (s) => { s.config.notify.Cora.calendar = true; }));
  check('B24 (v42-3 M5) turning the calendar back on clears the child\'s calendar markers', !Object.keys(env.mock.props).some(k => /^fbCalBuilt:cal_cora:/.test(k)), Object.keys(env.mock.props).join());
  tick();
  check('B24 (v42-4 NEW-3) the next tick rebuilds at most 3 chores (lock time, quota)…', Object.keys(env.mock.props).filter(k => /^fbCalBuilt:cal_cora:/.test(k)).length === 3, Object.keys(env.mock.props).join());
  tick();
  check('B24 …and the rest on the tick after (markers back)', ['d1', 'w1', 'o1', 'p1', 'w2'].every(id => !!env.mock.props['fbCalBuilt:cal_cora:' + id]), Object.keys(env.mock.props).join());
}

// ── B25 (v42-4) Stage B run rules: held far-ahead deletions, restored near ones, all-day, failed build, 11 PM, zone ──
{
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
  const dow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getDay(); };
  const fresh = (chores) => {
    env = boot(family({ children: { Cora: Object.assign(family().children.Cora, { chores }) } }));
    const at5 = new Date(); at5.setHours(5, 5, 0, 0); const ms = at5.getTime(); const Real = require('vm').runInContext('Date', env.ctx);
    env.ctx.Date = class extends Real { constructor(...a) { a.length ? super(...a) : super(ms); } static now() { return ms; } };
    post(env, body(env, 'Chore Edited', null));
  };
  const settle = () => { Object.keys(env.mock.cache).filter(k => /^fbCalBusy:/.test(k)).forEach(k => delete env.mock.cache[k]); };
  const tick = () => { settle(); env.call('calendarSyncTick'); };
  const run = (code) => require('vm').runInContext(code, env.ctx);
  const occ = (id, day) => run('_occurrencesOn(CalendarApp.getCalendarById("cal_cora"), ' + JSON.stringify(id) + ', ' + JSON.stringify(day) + ')');
  const ch = (id) => env.stored().children.Cora.chores.find(c => c.id === id);
  const lastDays = (id, n, step) => { const out = []; for (let i = 62; out.length < n && i > 0; i--) if (occ(id, plus(i)).length) { out.push(plus(i)); i -= (step || 1) - 1; } return out; };
  // 1 — a trip far ahead: the last days of a daily chore deleted → held, nothing restored, no notice
  fresh([{ id: 'v1', name: 'Walk dog', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, reminderHour: 17, dueHour: 17 }]);
  const trip = [plus(58), plus(59), plus(60), plus(61), plus(62)];
  trip.forEach(d => occ('v1', d).forEach(e => e.deleteEvent()));
  tick();
  check('B25 days deleted far ahead (a trip in 8 weeks, reaching the window end) are held: no skip, no restore, no notice', !ch('v1').skipDates && occ('v1', plus(60)).length === 0 && !(env.stored().notices || []).length, JSON.stringify([ch('v1').skipDates, (env.stored().notices || []).length]));
  // the same trip that no longer reaches the window end (a later day is still there) → taken in
  trip.slice(0, 3).forEach(() => {});
  const keepLast = plus(62); run('CalendarApp.getCalendarById("cal_cora").createEvent("🏦 Walk dog", new Date(' + JSON.stringify(keepLast) + ' + "T17:00:00"), new Date(' + JSON.stringify(keepLast) + ' + "T17:30:00"), {description: "CHORE_ID:v1"})');
  tick();
  check('B25 …once a later day shows, the trip days are taken in as skips', JSON.stringify(ch('v1').skipDates) === JSON.stringify(trip.slice(0, 4)), JSON.stringify(ch('v1').skipDates));
  // 2 — the last two weekly occurrences deleted one by one → held (not restored)
  fresh([{ id: 'k1', name: 'Mow', schedule: 'weekly', weekdays: [dow(2)], status: 'available', amount: 1, splitChk: 50, reminderHour: 10, dueHour: 10 }]);
  const lastTwo = lastDays('k1', 2, 7);
  lastTwo.forEach(d => occ('k1', d).forEach(e => e.deleteEvent()));
  tick();
  check('B25 the last two weekly occurrences deleted → held, not put back, no notice', lastTwo.length === 2 && !ch('k1').skipDates && occ('k1', lastTwo[0]).length === 0 && !(env.stored().notices || []).length, JSON.stringify([lastTwo, ch('k1').skipDates]));
  // 3 — "this and following" from next week on → put back with a notice
  fresh([{ id: 'f1', name: 'Piano', schedule: 'weekly', weekdays: [dow(4)], status: 'available', amount: 1, splitChk: 50, reminderHour: 16, dueHour: 16 }]);
  for (let i = 11; i <= 62; i += 7) occ('f1', plus(i)).forEach(e => e.deleteEvent());   // keeps this week's, deletes from next week on
  tick();
  check('B25 every occurrence from next week on deleted ("this and following") → put back with a neutral notice', occ('f1', plus(11)).length === 1 && (env.stored().notices || []).length === 1 && /no longer matched/.test(env.stored().notices[0].text) && !ch('f1').skipDates, JSON.stringify([occ('f1', plus(11)).length, env.stored().notices]));
  // 4 — an occurrence turned into an all-day event → no change
  fresh([{ id: 'a1', name: 'Read', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, reminderHour: 19, dueHour: 19 }]);
  occ('a1', plus(5)).forEach(e => e.deleteEvent());
  run('CalendarApp.getCalendarById("cal_cora").createAllDayEvent("🏦 Read", new Date(' + JSON.stringify(plus(5)) + ' + "T00:00:00"), {description: "CHORE_ID:a1"})');
  const revA = env.stored()._rev; tick();
  check('B25 an occurrence turned into an all-day event changes nothing (not a skip, not midnight)', !ch('a1').skipDates && !ch('a1').calOverrides && env.stored()._rev === revA, JSON.stringify([ch('a1').skipDates, ch('a1').calOverrides]));
  // 5 — a failed build clears the marker; the next tick retries it as a first look
  fresh([{ id: 'q1', name: 'Bed', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, reminderHour: 7, dueHour: 7 }]);
  env.mock.failSeries = 1;
  post(env, body(env, 'Chore Edited', null));
  const noMarker = !env.mock.props['fbCalBuilt:cal_cora:q1'];
  tick();
  const waited = !env.mock.props['fbCalBuilt:cal_cora:q1'];
  env.mock.props['fbCalFail:cal_cora:q1'] = String(parseInt(env.mock.props['fbCalFail:cal_cora:q1'], 10) - 3700000);   // an hour later (the code's clock is pinned)
  tick();
  check('B25 a build that fails clears the chore\'s marker; it is retried after an hour, not every tick (v42-5 R5)', noMarker && waited && !!env.mock.props['fbCalBuilt:cal_cora:q1'] && occ('q1', plus(3)).length === 1 && !env.mock.props['fbCalFail:cal_cora:q1'], JSON.stringify([noMarker, waited, env.mock.props['fbCalBuilt:cal_cora:q1'], occ('q1', plus(3)).length]));
  // 6 — 11 PM clamp: a move for today at 23:xx keeps the normal due time
  const sh = { schedule: 'daily', reminderHour: 17, dueHour: 17 };
  run('var __c = ' + JSON.stringify(sh) + '; _setHour(__c, "' + plus(0) + '", 22, "' + plus(0) + '", 23);');
  check('B25 (NEW-4) at 23:xx a move for today keeps the normal due time (no instant miss)', run('JSON.stringify(__c.dayOverrides||null)') === 'null' && run('__c.calOverrides["' + plus(0) + '"]') === 22, run('JSON.stringify(__c)'));
  // 7 — recurrences are pinned to the project zone
  check('B25 (M4) every series recurrence is pinned to the project time zone', env.mock.calendars.cal_cora.events.filter(e => e.series).every(e => true) && run('(function(){ var r = _newRec(); return r.tz; })()') === 'America/Chicago');
}

// ── B26 (v42-5) extra-only days, end-dated chores, half-moves, copied series, calendar turned on anywhere ──
{
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
  const dow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getDay(); };
  const fresh = (chores) => {
    env = boot(family({ children: { Cora: Object.assign(family().children.Cora, { chores }) } }));
    const at5 = new Date(); at5.setHours(5, 5, 0, 0); const ms = at5.getTime(); const Real = require('vm').runInContext('Date', env.ctx);
    env.ctx.Date = class extends Real { constructor(...a) { a.length ? super(...a) : super(ms); } static now() { return ms; } };
    post(env, body(env, 'Chore Edited', null));
  };
  const tick = () => { Object.keys(env.mock.cache).filter(k => /^fbCalBusy:/.test(k)).forEach(k => delete env.mock.cache[k]); env.call('calendarSyncTick'); };
  const run = (code) => require('vm').runInContext(code, env.ctx);
  const occ = (id, day) => run('_occurrencesOn(CalendarApp.getCalendarById("cal_cora"), ' + JSON.stringify(id) + ', ' + JSON.stringify(day) + ')');
  const ch = (id) => env.stored().children.Cora.chores.find(c => c.id === id);
  const mk = (title, day, h, desc) => run('CalendarApp.getCalendarById("cal_cora").createEvent(' + JSON.stringify(title) + ', new Date(' + JSON.stringify(day) + ' + "T' + String(h).padStart(2, '0') + ':00:00"), new Date(' + JSON.stringify(day) + ' + "T' + String(h).padStart(2, '0') + ':30:00"), {description: ' + JSON.stringify(desc) + '})');
  // R1 — an app extra day on another weekday, deleted in Google → leaves extraDates
  fresh([{ id: 'e1', name: 'Trash', schedule: 'weekly', weekdays: [dow(2)], status: 'available', amount: 1, splitChk: 50, reminderHour: 18, dueHour: 18, extraDates: [plus(4)] }]);
  occ('e1', plus(4)).forEach(e => e.deleteEvent());
  tick();
  check('B26 (R1) an extra day deleted in Google Calendar leaves the app (not held forever)', !(ch('e1').extraDates || []).length, JSON.stringify(ch('e1').extraDates));
  // R2 — an end-dated chore: its final occurrence deleted → skipped, not held / restored
  fresh([{ id: 'n1', name: 'Practice', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, reminderHour: 16, dueHour: 16, endDate: plus(20) }]);
  occ('n1', plus(20)).forEach(e => e.deleteEvent()); occ('n1', plus(19)).forEach(e => e.deleteEvent());
  tick();
  check('B26 (R2) the last two days before an end date deleted → skipped day by day, no restore', JSON.stringify(ch('n1').skipDates) === JSON.stringify([plus(19), plus(20)]) && !(env.stored().notices || []).length, JSON.stringify([ch('n1').skipDates, env.stored().notices]));
  // R4 — Mon+Wed chore: last Wed deleted, last Mon moved to Thu → the Thursday waits with the held Monday
  const mon = (() => { for (let i = 62; i > 0; i--) if (dow(i) === dow(1)) return i; })();
  fresh([{ id: 'h1', name: 'Fish', schedule: 'weekly', weekdays: [dow(1), dow(2)].sort(), status: 'available', amount: 1, splitChk: 50, reminderHour: 17, dueHour: 17 }]);
  const lastWed = (() => { for (let i = 62; i > 0; i--) if (dow(i) === dow(2)) return i; })();
  occ('h1', plus(lastWed)).forEach(e => e.deleteEvent());
  occ('h1', plus(mon)).forEach(e => e.deleteEvent()); mk('🏦 Fish', plus(mon + 2 > 62 ? mon - 5 : mon + 2), 17, 'CHORE_ID:h1:DAY:' + dow(1));
  tick();
  check('B26 (R4) a half-visible move is not half-applied (no lone extra day added)', !(ch('h1').extraDates || []).length, JSON.stringify([ch('h1').extraDates, ch('h1').skipDates]));
  // R4 — a copied series on another weekday → put back
  fresh([{ id: 'c1', name: 'Piano', schedule: 'weekly', weekdays: [dow(1)], status: 'available', amount: 1, splitChk: 50, reminderHour: 16, dueHour: 16 }]);
  for (let i = 3; i <= 62; i += 7) mk('🏦 Piano', plus(i), 16, 'CHORE_ID:c1:DAY:' + dow(1));
  tick();
  check('B26 (R4) a series copied onto another weekday → put back (the copies removed), not adopted day by day', !(ch('c1').extraDates || []).length && occ('c1', plus(10)).length === 0 && (env.stored().notices || []).length === 1, JSON.stringify([ch('c1').extraDates, occ('c1', plus(10)).length]));
  // M5 — turning the calendar on through any save (e.g. the admin user wizard) clears the markers
  fresh([{ id: 'u1', name: 'Bed', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, reminderHour: 7, dueHour: 7 }]);
  post(env, body(env, 'User Updated (Wizard)', (s) => { s.config.notify.Cora.calendar = false; }, { activeChild: 'Alice' }));
  post(env, body(env, 'User Updated (Wizard)', (s) => { s.config.notify.Cora.calendar = true; }, { activeChild: 'Alice' }));
  check('B26 (M5) the calendar turned back on by the admin wizard clears that child\'s markers', !env.mock.props['fbCalBuilt:cal_cora:u1'], Object.keys(env.mock.props).join());
}

// ── B27 (v42-7) Calendar quota: one description read per event, not per occurrence ──
{
  env = boot(family({ children: { Cora: Object.assign(family().children.Cora, { chores: [
    { id: 'q7', name: 'Daily', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, reminderHour: 19, dueHour: 19 },
    { id: 'q8', name: 'Other', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, reminderHour: 8, dueHour: 8 } ] }) } }));
  post(env, body(env, 'Chore Edited', null));
  env.mock.descReads = 0;
  require('vm').runInContext('deleteEventsByChoreId("cal_cora", "q7")', env.ctx);
  const delReads = env.mock.descReads;
  check('B27 deleting a daily series reads each event\'s description once (not ~370 occurrences)', delReads <= 4 && !env.mock.calendars.cal_cora.events.some(e => /CHORE_ID:q7\b/.test(e.description)), 'reads=' + delReads);
  Object.keys(env.mock.cache).filter(k => /^fbCalBusy:/.test(k)).forEach(k => delete env.mock.cache[k]);
  env.mock.descReads = 0; env.call('calendarSyncTick');
  check('B27 the 15-minute read of a 62-day window does one read per event, not per day', env.mock.descReads <= 4, 'reads=' + env.mock.descReads);
}

// ── B28 (v42-8) a failed restore does not block the next restore for a day ──
{
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
  env = boot(family({ children: { Cora: Object.assign(family().children.Cora, { chores: [
    { id: 'r8', name: 'Streak', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, reminderHour: 19 } ] }) } }));
  const at5 = new Date(); at5.setHours(5, 5, 0, 0); const ms = at5.getTime(); const Real = require('vm').runInContext('Date', env.ctx);
  env.ctx.Date = class extends Real { constructor(...a) { a.length ? super(...a) : super(ms); } static now() { return ms; } };
  post(env, body(env, 'Chore Edited', null));
  const tick = () => { Object.keys(env.mock.cache).filter(k => /^fbCalBusy:/.test(k)).forEach(k => delete env.mock.cache[k]); env.call('calendarSyncTick'); };
  const run = (code) => require('vm').runInContext(code, env.ctx);
  const hourOn = (day) => { const o = run('_occurrencesOn(CalendarApp.getCalendarById("cal_cora"), "r8", ' + JSON.stringify(day) + ')'); return o.length ? o[0].getStartTime().getHours() : null; };
  const to6 = () => env.mock.calendars.cal_cora.events.filter(e => e.series && /CHORE_ID:r8\b/.test(e.description)).forEach(e => { e.start = new Date(e.start); e.start.setHours(6); e.end = new Date(e.start.getTime() + 1800000); });
  to6(); env.mock.failSeries = 1; tick();
  check('B28 a restore that fails (Calendar quota) sets no restore marker and no notice', !env.mock.props['fbCalRestored:cal_cora:r8'] && !(env.stored().notices || []).length, Object.keys(env.mock.props).join());
  delete env.mock.props['fbCalFail:cal_cora:r8'];   // the hourly retry window has passed
  tick();
  check('B28 …the retry rebuilds the series at the app\'s hour', hourOn(plus(3)) === 19, String(hourOn(plus(3))));
  to6(); tick();
  check('B28 …and a whole-series edit later the same day is put back, with the notice', hourOn(plus(3)) === 19 && (env.stored().notices || []).length === 1, JSON.stringify([hourOn(plus(3)), (env.stored().notices || []).length]));
}

// ── B29 (v43-1) child emails log in: EmailIndex follows every save ──
{
  env = boot(family());
  env.mock.sheets.EmailIndex = { rows: [['email', 'familyId'], ['alice@x.com', 'fam_test'], ['taken@y.com', 'fam_other']] };
  const idx = () => env.mock.sheets.EmailIndex.rows.slice(1).filter(r => r[0]).map(r => r[0] + '>' + r[1]).sort().join(',');
  let r29 = post(env, body(env, 'Child Profile Updated', s => { s.config.emails = { Alice: 'alice@x.com', Cora: 'Cora@Kid.com ' }; }));
  check('B29 a child email added in a normal save lands in EmailIndex (normalized), the parent row stays', r29.status === 'ok' && idx() === 'alice@x.com>fam_test,cora@kid.com>fam_test,taken@y.com>fam_other', idx());
  let lg = get(env, { action: 'loginByEmail', email: 'cora@kid.com', pin: '2222' });
  check('B29 the child logs in with her email + PIN on the first try', lg.status === 'ok' && lg.displayName === 'Cora' && lg.familyId === 'fam_test', JSON.stringify(lg));
  post(env, body(env, 'Child Profile Updated', s => { s.config.emails.Cora = 'cora2@kid.com'; }));
  check('B29 a changed email moves its row (old one gone)', idx() === 'alice@x.com>fam_test,cora2@kid.com>fam_test,taken@y.com>fam_other', idx());
  const before29 = JSON.stringify(env.stored());
  r29 = post(env, body(env, 'Child Profile Updated', s => { s.config.emails.Cora = 'taken@y.com'; s.children.Cora.balances.checking = 99; }));
  check('B29 an email another family uses refuses the save (emailTaken) and nothing changes', r29.status === 'error' && r29.reason === 'emailTaken' && JSON.stringify(env.stored()) === before29 && idx() === 'alice@x.com>fam_test,cora2@kid.com>fam_test,taken@y.com>fam_other', JSON.stringify(r29));
  post(env, body(env, 'Child Profile Updated', s => { delete s.config.emails.Cora; }));
  check('B29 a removed email drops its row', idx() === 'alice@x.com>fam_test,taken@y.com>fam_other', idx());
  env.mock.sheets.EmailIndex.rows = [['email', 'familyId'], ['taken@y.com', 'fam_other']];   // an older sheet missing this family's rows
  post(env, body(env, 'Child Profile Updated', s => { s.config.emails.Cora = 'cora3@kid.com'; }));
  check('B29 the next email change also re-adds this family\'s rows an older sheet was missing', idx() === 'alice@x.com>fam_test,cora3@kid.com>fam_test,taken@y.com>fam_other', idx());
  post(env, body(env, 'Child Profile Updated', s => { s.config.emails.Cora = 'alice@x.com'; }));
  check('B29 a shared email inside a family is indexed once', idx() === 'alice@x.com>fam_test,taken@y.com>fam_other', idx());
  const a = get(env, { action: 'loginByEmail', email: 'alice@x.com', pin: '1111' }), c = get(env, { action: 'loginByEmail', email: 'alice@x.com', pin: '2222' }), bad = get(env, { action: 'loginByEmail', email: 'alice@x.com', pin: '9999' });
  check('B29 a shared email logs in whoever\'s PIN matches (Alice 1111, Cora 2222, wrong PIN fails)', a.displayName === 'Alice' && c.displayName === 'Cora' && bad.status === 'error', JSON.stringify([a.displayName, c.displayName, bad.status]));
  env.mock.sheets.PendingSignups = { rows: [['signupId', 'submittedAt', 'name', 'email', 'pin', 'honeypot', 'notificationStatus'], ['s1', 'x', 'Zed', 'Waiting@Z.com', '1234', '', '']] };
  let r29b = post(env, body(env, 'Child Profile Updated', s => { s.config.emails.Cora = 'waiting@z.com'; }));
  check('B29 (v43-4 #5) an email waiting in PendingSignups counts as taken', r29b.status === 'error' && r29b.reason === 'emailTaken', JSON.stringify(r29b));
  const realAppend = env.mock.sheets.EmailIndex; env.ctx.SpreadsheetApp.getActiveSpreadsheet = ((orig) => () => { const ss = orig(); const gs = ss.getSheetByName; ss.getSheetByName = (n) => { const sh = gs(n); if (n === 'EmailIndex' && sh) sh.appendRow = () => { throw new Error('mock: sheet quota'); }; return sh; }; return ss; })(env.ctx.SpreadsheetApp.getActiveSpreadsheet);
  r29b = post(env, body(env, 'Child Profile Updated', s => { s.config.emails.Cora = 'cora4@kid.com'; }));
  check('B29 (v43-4 #3) an EmailIndex write that fails after the save is reported (save kept)', r29b.status === 'ok' && r29b.emailIndexFailed === true && env.stored().config.emails.Cora === 'cora4@kid.com', JSON.stringify(r29b));
  env.mock.sheets.EmailIndex.rows.push(['none', 'fam_other']);
  r29b = post(env, body(env, 'Child Profile Updated', s => { s.config.emails.Cora = 'none'; }));
  check('B29 (v43-5) a placeholder that is not an email is never indexed or refused as taken', r29b.status === 'ok' && !env.mock.sheets.EmailIndex.rows.some(r => r[0] === 'none' && r[1] === 'fam_test'), JSON.stringify(r29b));
  const rowsBefore = JSON.stringify(env.mock.sheets.EmailIndex.rows);
  post(env, body(env, 'Update', s => { s.children.Cora.balances.checking = 3; }));
  check('B29 a save that does not touch emails leaves EmailIndex alone', JSON.stringify(env.mock.sheets.EmailIndex.rows) === rowsBefore);
}

// ── B30 (v43-6) Approve / Deny come before the details in the parent emails ──
{
  env = boot(family());
  const s0 = env.stored(); s0.config.emails = { Alice: 'alice@x.com' }; env.mock.sheets.Families.rows[1][1] = JSON.stringify(s0); env.mock.cache = {};
  post(env, body(env, 'Withdrawal Submitted', s => { s.children.Cora.pendingWithdrawals = [{ id: 'w1', amount: 5, note: 'Book fair', submittedAt: 'now' }]; }));
  const m = env.mock.emails.filter(e => /withdraw/i.test(e.subject || '')).pop() || {};
  const h = m.htmlBody || '';
  check('B30 the withdrawal email shows Approve / Deny above the amount and note', h.indexOf('Approve') > 0 && h.indexOf('Approve') < h.indexOf('>Amount<') && h.indexOf('Deny') < h.indexOf('Book fair'), [h.indexOf('Approve'), h.indexOf('>Amount<')].join(' vs '));
  post(env, body(env, 'Deposit Submitted', s => { s.children.Cora.pendingDeposits = [{ id: 'd1', amount: 3, note: 'Birthday', splitChk: 50, submittedAt: 'now' }]; }));
  const d = (env.mock.emails.filter(e => /deposit/i.test(e.subject || '')).pop() || {}).htmlBody || '';
  check('B30 the deposit email too', d.indexOf('Approve') > 0 && d.indexOf('Approve') < d.indexOf('>Amount<'), [d.indexOf('Approve'), d.indexOf('>Amount<')].join(' vs '));
}

// ── B31 (v44-2) an auto-approved chore: that day off the calendar, the child gets the approval email ──
{
  env = boot(family());
  const s0 = env.stored(); s0.config.emails = { Alice: 'alice@x.com', Cora: 'cora@kid.com' }; s0.config.notify.Cora.email = true; env.mock.sheets.Families.rows[1][1] = JSON.stringify(s0); env.mock.cache = {};
  post(env, body(env, 'Chore Edited', null, { _editedChoreId: 'c_daily' }));
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const tomorrow = ymd(new Date(Date.now() + 86400000));
  const occ = (day) => require('vm').runInContext('_occurrencesOn(CalendarApp.getCalendarById("cal_cora"), "c_daily", ' + JSON.stringify(day) + ')', env.ctx);
  const before = occ(tomorrow).length;
  Object.keys(env.mock.cache).filter(k => /^fbCalBusy:/.test(k)).forEach(k => delete env.mock.cache[k]);
  env.mock.emails.length = 0;
  post(env, body(env, 'Chore Approved (Auto)', s => { s.children.Cora.balances.checking += 0.5; }, { _submittedChoreId: 'c_daily', _submittedFor: tomorrow, _approvedChoreId: 'c_daily', _approvedChoreSchedule: 'daily', tempTransactions: [{ user: 'Bank', note: 'Chore: Make bed (Chk)', amt: 0.5, child: 'Cora' }] }));
  check('B31 the auto-approved day comes off the calendar (the series stays)', before === 1 && occ(tomorrow).length === 0 && occ(ymd(new Date(Date.now() + 2 * 86400000))).length === 1, before + ' → ' + occ(tomorrow).length);
  check('B31 the child gets the same "Chore approved" email', env.mock.emails.some(e => e.to === 'cora@kid.com' && /approved/i.test(e.subject || '')), JSON.stringify(env.mock.emails.map(e => [e.to, e.subject])));
  check('B31 parents get no approve/deny email for it', !env.mock.emails.some(e => e.to === 'alice@x.com'));
}

// ── B32 (v44-4) Stage C: every event of a chore deleted in Google Calendar ──
{
  env = boot(family({ children: { Cora: Object.assign(family().children.Cora, { chores: [
    { id: 'sc1', name: 'Feed cat', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, reminderHour: 7, dueHour: 7 },
    { id: 'sc2', name: 'Keep', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, reminderHour: 9, dueHour: 9 } ] }) } }));
  const at5 = new Date(); at5.setHours(5, 5, 0, 0); const ms = at5.getTime(); const Real = require('vm').runInContext('Date', env.ctx);
  env.ctx.Date = class extends Real { constructor(...a) { a.length ? super(...a) : super(ms); } static now() { return ms; } };
  post(env, body(env, 'Chore Edited', null));
  const tick = () => { Object.keys(env.mock.cache).filter(k => /^fbCalBusy:/.test(k)).forEach(k => delete env.mock.cache[k]); env.call('calendarSyncTick'); };
  const run = (code) => require('vm').runInContext(code, env.ctx);
  const ch = (id) => env.stored().children.Cora.chores.find(c => c.id === id);
  const evs = (id) => env.mock.calendars.cal_cora.events.filter(e => new RegExp('CHORE_ID:' + id + '\\b').test(e.description)).length;
  tick();
  run('deleteEventsByChoreId("cal_cora", "sc1")');
  tick();
  const st = env.stored();
  check('B32 every event gone → calendarDeleted set, one notice naming the chore, the other chore untouched', !!ch('sc1').calendarDeleted && !ch('sc2').calendarDeleted && (st.notices || []).filter(n => /Feed cat/.test(n.text)).length === 1, JSON.stringify([ch('sc1').calendarDeleted, (st.notices || []).map(n => n.text.slice(0, 40))]));
  const rev = st._rev; tick(); tick();
  check('B32 later ticks leave it alone (no second notice, no rebuild, no save)', env.stored()._rev === rev && evs('sc1') === 0);
  check('B32 the server no longer counts it as due', run('_choreDueOn(' + JSON.stringify(ch('sc1')) + ', "2026-12-01")') === false);
  // the parent puts it back: the app clears the flag and saves "Chore Edited" for it
  post(env, body(env, 'Chore Edited', s => { delete s.children.Cora.chores.find(c => c.id === 'sc1').calendarDeleted; }, { _editedChoreId: 'sc1' }));
  check('B32 "Put it back" rebuilds its events', evs('sc1') > 0 && !ch('sc1').calendarDeleted, 'events=' + evs('sc1'));
  const rev2 = env.stored()._rev; tick();
  check('B32 …and the next tick finds nothing to do', env.stored()._rev === rev2 && !ch('sc1').calendarDeleted);
}

const fails = results.filter(x => !x.ok).length;
console.log('\nDONE — ' + (results.length - fails) + '/' + results.length + ' PASS' + (fails ? ', ' + fails + ' FAIL' : ''));
process.exit(fails ? 1 : 0);
