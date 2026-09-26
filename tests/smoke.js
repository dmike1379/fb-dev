// Headless smoke test for v38.2 patches 1, 4, 5, 6 against the real index.html + app.js.
// Boots the page in jsdom with fetch stubbed (familyNotFound), then drives the
// functions directly with a synthetic family. PASS/FAIL per check; exit 1 on any FAIL.
const fs = require('fs'); const path = require('path');
const { JSDOM } = require('jsdom');
const REPO = process.argv[2] || require('path').resolve(__dirname, '..');
const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8')
  .replace(/<script src="vendor\/chart.umd.min.js"><\/script>/, '')   // Chart.js not needed
  .replace(/<script src="app.js"><\/script>/, '');                      // load manually below
const dom = new JSDOM(html, { url: 'https://dmike1379.github.io/fb-dev/', runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;
w.fetch = async () => ({ json: async () => ({ status: 'error', reason: 'familyNotFound' }), text: async () => '{}', status: 200, ok: true, url: '' });
w.Chart = function(){ this.destroy=()=>{}; this.data={datasets:[{}],labels:[]}; this.update=()=>{}; };
w.scrollTo = () => {}; w.matchMedia = () => ({ matches:false, addListener(){}, addEventListener(){} });
const E = (code) => w.eval(code); const S = () => E('state');
const results = []; const check = (name, ok, detail) => { results.push({name, ok, detail}); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  — ' + detail : '')); };
w.addEventListener('error', e => console.log('window error: ' + e.message));
const sc = w.document.createElement('script'); sc.textContent = fs.readFileSync(path.join(REPO, 'app.js'), 'utf8'); w.document.body.appendChild(sc);
try { E('state'); } catch (e) { console.log('FAIL app.js load: ' + e.message); process.exit(1); }

(async () => {
  await new Promise(r => setTimeout(r, 300));
  const today = w.todayStr();
  // --- synthetic family -------------------------------------------------------
  E("state.users = ['Alice','Cora']; state.roles = {Alice:'parent',Cora:'child'};")
  E("state.pins = {Alice:'1111',Cora:'2222'};")
  E("state.config.parentChildren = {Alice:['Cora']};")
  S().children = { Cora: { balances: { checking: 10, savings: 5 }, chores: [
    { id: 'c1', name: 'Daily one', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, childChooses: true },
    { id: 'c2', name: 'Old once', schedule: 'once', onceDate: '2026-06-30', status: 'available', amount: 1, splitChk: 50 },
    { id: 'c3', name: 'Pending once', schedule: 'once', onceDate: '2099-01-01', status: 'pending', completedBy: 'Cora', completedAt: 'x', amount: 2, splitChk: 50 },
  ], pendingDeposits: [], pendingWithdrawals: [], goals: [], loans: [] } };
  S().history = { Cora: [ { date: 'Wed Sep 23 2026 10:48:00 GMT-0500 (Central Daylight Time)', user: 'Bank', note: 'Withdraw: test', amt: -1.25, child: 'Cora' } ] };
  w.syncToCloud = async () => ({ status: 'ok' });   // never hit the network from here

  // --- child view: patch 4 --------------------------------------------------------
  E("currentUser='Cora'; currentRole='child'; activeChild=null;")
  w.renderChildChores();
  const listTxt = w.document.getElementById('child-chore-list').textContent;
  check('P4 count excludes expired one-time chore', /1 chore available/.test(listTxt), listTxt.match(/\d+ chores? available/)?.[0]);
  w.setChoreFilter('today');
  let rows = [...w.document.querySelectorAll('#chore-table-wrap tr')].map(tr => tr.textContent.replace(/\s+/g, ' ').trim());
  check('P4 Due Today has no Expired row', !rows.some(t => /Expired/.test(t)), rows.join(' | '));
  w.setChoreFilter('all');
  rows = [...w.document.querySelectorAll('#chore-table-wrap tr')].map(tr => tr.textContent.replace(/\s+/g, ' ').trim());
  check('P4 All Chores still shows the Expired row', rows.some(t => /Expired 2026-06-30/.test(t)), rows.join(' | '));
  // only-expired-left case keeps the table reachable
  const saveChores = S().children.Cora.chores;
  S().children.Cora.chores = saveChores.filter(c => c.id === 'c2');
  w.renderChildChores(); w.setChoreFilter('all');
  const onlyExp = w.document.getElementById('child-chore-list').textContent;
  check('P4 only-expired family still renders tab bar + Expired row', /0 chores available/.test(onlyExp) && /Expired 2026-06-30/.test(onlyExp));
  S().children.Cora.chores = saveChores;

  // --- parent deny: patch 1 -----------------------------------------------------------
  E("currentUser='Alice'; currentRole='parent'; activeChild='Cora';")
  w.denyChore('c3'); await new Promise(r => setTimeout(r, 50));
  const input = w.document.getElementById('modal-dynamic-input'); if (input) input.value = 'not clean';
  const confirmBtn = w.document.getElementById('modal-confirm-btn');
  confirmBtn && confirmBtn.click(); await new Promise(r => setTimeout(r, 50));
  const c3 = S().children.Cora.chores.find(c => c.id === 'c3');
  check('P1 denyChore keeps the one-time chore', !!c3, c3 ? JSON.stringify({status: c3.status, note: c3.denialNote, by: c3.completedBy}) : 'chore was deleted');
  check('P1 denied chore is back to available with note', !!c3 && c3.status === 'available' && c3.completedBy === null && c3.denialNote === 'not clean');
  c3.status = 'pending'; c3.completedBy = 'Cora';
  w.quickDenyOne('c3'); await new Promise(r => setTimeout(r, 50));
  const c3b = S().children.Cora.chores.find(c => c.id === 'c3');
  check('P1 quickDenyOne keeps the one-time chore, back to available', !!c3b && c3b.status === 'available');
  // past due-by date moves to today on deny (audit finding #2)
  const c2 = S().children.Cora.chores.find(c => c.id === 'c2'); c2.status = 'pending'; c2.completedBy = 'Cora';
  w.quickDenyOne('c2'); await new Promise(r => setTimeout(r, 50));
  check('P1 denied one-time chore with a past date becomes undated (always due)', c2.status === 'available' && c2.onceDate === null && c2.onceDueOn === false, String(c2.onceDate));
  const c3c = S().children.Cora.chores.find(c => c.id === 'c3');
  check('P1 future-dated one-time chore keeps its date on deny', c3c.onceDate === '2099-01-01', c3c.onceDate);
  check('P6 fmt zeroes float noise', w.fmt(-2.7e-17) === '$0.00' && w.fmt(-0.004) === '$0.00' && w.fmt(-0.005) === '-$0.01', w.fmt(-2.7e-17) + ' ' + w.fmt(-0.005));
  check('P6 fmtLedgerDate blank-safe', w.fmtLedgerDate(null) === '' && w.fmtLedgerDate('') === '' && w.fmtLedgerDate(undefined) === '');

  // --- ledger: patch 6 ---------------------------------------------------------------------
  w.openHistory(); await new Promise(r => setTimeout(r, 50));
  const row = w.document.querySelector('.ledger-row');
  const dateTxt = row && row.querySelector('.ledger-date').textContent; const amtTxt = row && row.querySelector('.ledger-amt').textContent;
  check('P6 ledger date is short', dateTxt === 'Sep 23, 2026 10:48 AM', dateTxt);
  check('P6 ledger negative amount is -$1.25', amtTxt === '-$1.25', amtTxt);
  check('P6 withdrawals chip is -$1.25', w.document.getElementById('hist-out').textContent === '-$1.25', w.document.getElementById('hist-out').textContent);
  w.closeHistory();

  // --- wizard drafts: patch 5 -------------------------------------------------------------
  w.localStorage.clear();
  w.uwOpenAdd(); await new Promise(r => setTimeout(r, 30)); w.wzClose();
  check('P5 untouched user wizard leaves no draft', w.localStorage.getItem('fb_wiz_draft') === null, String(w.localStorage.getItem('fb_wiz_draft')).slice(0, 60));
  w.uwOpenAdd(); await new Promise(r => setTimeout(r, 30)); E("wz.draft.role='child'; wz.draft.name='Zed';"); w.wzClose();
  check('P5 touched user wizard saves a draft', w.localStorage.getItem('fb_wiz_draft') !== null);
  w.uwOpenAdd(); await new Promise(r => setTimeout(r, 30));
  check('P5 reopen offers Resume when a real draft exists', w.wzCur().id === 'resume', w.wzCur().id);
  w.wzClose();
  const kept = JSON.parse(w.localStorage.getItem('fb_wiz_draft') || 'null');
  check('P5 closing at the Resume prompt keeps the stored draft intact', !!kept && kept.draft && kept.draft.name === 'Zed', JSON.stringify(kept && kept.draft && kept.draft.name));
  w.cwOpenAdd('Cora'); await new Promise(r => setTimeout(r, 30)); w.wzClose();
  check('P5 untouched chore wizard leaves no draft', w.localStorage.getItem('fb_cw_draft') === null);
  w.cwOpenAdd('Cora'); await new Promise(r => setTimeout(r, 30)); E("wz.draft.cName='Sweep';"); w.wzClose();
  check('P5 touched chore wizard saves a draft', w.localStorage.getItem('fb_cw_draft') !== null);

  const fails = results.filter(r => !r.ok).length;
  console.log('\nDONE — ' + (results.length - fails) + '/' + results.length + ' PASS' + (fails ? ', ' + fails + ' FAIL' : ''));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL harness error: ' + (e.stack || e)); process.exit(1); });
