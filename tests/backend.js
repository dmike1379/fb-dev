// v39 backend harness — runs the real Code.gs inside tests/gas-mock.js (fake Sheet, Cache, Lock,
// Calendar, Mail) and checks the v39 server rules. ~1 s. Usage: node tests/backend.js [repo]
const path = require('path');
const { makeMock, loadCodeGs, get, post } = require('./gas-mock.js');
const REPO = process.argv[2] || path.resolve(__dirname, '..');
const results = []; const check = (name, ok, detail) => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  — ' + detail : '')); };

function family(extra) {
  return Object.assign({
    users: ['Alice', 'Cora'], roles: { Alice: 'parent', Cora: 'child' }, pins: { Alice: '1111', Cora: '2222' },
    config: { notify: { Cora: { calendar: true, email: false } }, calendars: { Cora: 'cal_cora' }, emails: {}, parentChildren: { Alice: ['Cora'] }, timezone: 'America/Chicago' },
    children: { Cora: { balances: { checking: 10, savings: 5 }, rates: { checking: 0, savings: 0 }, autoDeposit: { checking: 0, savings: 0 }, chores: [
      { id: 'c_daily', name: 'Make bed', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, reminderHour: 8 },
      { id: 'c_once', name: 'Wash car', schedule: 'once', onceDate: '2026-06-01', onceDueOn: false, status: 'pending', completedBy: 'Cora', completedAt: 'x', amount: 2, splitChk: 50, reminderHour: 8 },
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
check('B1 the save ran under the script lock', env.mock.lockLog.join(',') === 'tryLock,release', env.mock.lockLog.join(','));

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
check('B6 email-link deny runs under the lock and saves rev 4', env.mock.lockLog.join(',') === 'tryLock,release' && env.stored()._rev === 4, 'lock=' + env.mock.lockLog.join(',') + ' rev=' + env.stored()._rev);
env = boot(family()); env.mock.lockAvailable = false;
r = get(env, { action: 'deny', familyId: 'fam_test', child: 'Cora', choreId: 'c_once', token });
check('B6 email-link with the lock unavailable shows a Busy page and changes nothing', /Busy/.test(r._raw || '') && env.stored().children.Cora.chores.length === 2, (r._raw || '').slice(0, 60));

const fails = results.filter(x => !x.ok).length;
console.log('\nDONE — ' + (results.length - fails) + '/' + results.length + ' PASS' + (fails ? ', ' + fails + ' FAIL' : ''));
process.exit(fails ? 1 : 0);
