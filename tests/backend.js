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

const fails = results.filter(x => !x.ok).length;
console.log('\nDONE — ' + (results.length - fails) + '/' + results.length + ' PASS' + (fails ? ', ' + fails + ' FAIL' : ''));
process.exit(fails ? 1 : 0);
