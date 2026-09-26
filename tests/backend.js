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

const fails = results.filter(x => !x.ok).length;
console.log('\nDONE — ' + (results.length - fails) + '/' + results.length + ' PASS' + (fails ? ', ' + fails + ' FAIL' : ''));
process.exit(fails ? 1 : 0);
