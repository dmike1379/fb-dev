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

  // ── v40-3: a submission records the day; a denial takes it back; the POSTs carry the calendar hints ──
  {
    const calls = []; const prev = w.syncToCloud; w.syncToCloud = async (a, o) => { calls.push([a, o && o.extra]); return { status: 'ok' }; };
    E("currentUser='Cora'; currentRole='child'; activeChild=null;");
    S().children.Cora.chores.push({ id: 'v40a', name: 'Sweep', schedule: 'daily', status: 'available', amount: 1, splitChk: 50 });
    w.submitChoreCheck('v40a', 50);
    let c = S().children.Cora.chores.find(x => x.id === 'v40a');
    check('V40-3 submit: pending, submittedFor = today, doneDates has today, POST carries _submittedChoreId/_submittedFor', c.status === 'pending' && c.submittedFor === today && JSON.stringify(c.doneDates) === JSON.stringify([today]) && calls.length === 1 && calls[0][0] === 'Chore Submitted' && calls[0][1]._submittedChoreId === 'v40a' && calls[0][1]._submittedFor === today, JSON.stringify([c.submittedFor, c.doneDates, calls[0]]));
    E("currentUser='Alice'; currentRole='parent'; activeChild='Cora';");
    w.quickDenyOne('v40a');
    c = S().children.Cora.chores.find(x => x.id === 'v40a');
    check('V40-3 quick deny: available again, doneDates emptied, submittedFor cleared, POST carries _deniedChoreId/_deniedFor = that day', c.status === 'available' && c.doneDates.length === 0 && !c.submittedFor && calls[1][0] === 'Chore Denied (Quick)' && calls[1][1]._deniedChoreId === 'v40a' && calls[1][1]._deniedFor === today, JSON.stringify([c.doneDates, c.submittedFor, calls[1]]));
    w.closeQuickApprove && w.closeQuickApprove();
    w.syncToCloud = prev;
  }

  // ── v40-4: due-time badge, late today, missed rows → late submission for that day ──
  {
    const calls = []; const prev = w.syncToCloud; w.syncToCloud = async (a, o) => { calls.push([a, o && o.extra]); return { status: 'ok' }; };
    const hourNow = new Date().getHours(); const d2 = new Date(); d2.setDate(d2.getDate() - 2); const TWO = w.ymdLocal(d2);
    const d9 = new Date(); d9.setDate(d9.getDate() - 9); const NINE = w.ymdLocal(d9);
    E("currentUser='Cora'; currentRole='child'; activeChild=null;");
    S().children.Cora.chores.push(
      { id: 'v40b', name: 'Later', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, dueHour: 23 },
      { id: 'v40c', name: 'Early', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, dueHour: 6, missedDates: [TWO, NINE] },
      { id: 'v40d', name: 'Made up', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, dueHour: 6, missedDates: [TWO], doneDates: [TWO] });
    w.setChoreFilter('today'); let html = w.document.getElementById('chore-table-wrap').innerHTML;
    check('V40-4 Due Today: "Today · by 11 PM" on the not-yet-due chore, "⏰ Past 6 AM" on the overdue one', /Later.*Today · by 11 PM/s.test(html) && (hourNow < 6 || /Early.*⏰ Past 6 AM/s.test(html)) && (hourNow < 6 || w.isLateToday(S().children.Cora.chores.find(c => c.id === 'v40c'))) && (hourNow === 23 || !w.isLateToday(S().children.Cora.chores.find(c => c.id === 'v40b'))), html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300));
    check('V40-4 Missed rows: the 2-day-old miss shows, the 9-day-old and the made-up one do not', (html.match(/Missed \w{3} \d+\/\d+/g) || []).length === 1 && html.indexOf('chk-v40c-' + TWO) !== -1 && html.indexOf('chk-v40d-') === -1, (html.match(/Missed \w{3} \d+\/\d+/g) || []).join());
    w.setChoreFilter('week'); check('V40-4 This Week has no Missed rows', w.document.getElementById('chore-table-wrap').innerHTML.indexOf('Missed') === -1);
    w.setChoreFilter('today');
    w.toggleChoreCheck('v40c', TWO);
    let c = S().children.Cora.chores.find(x => x.id === 'v40c');
    check('V40-4 tapping a Missed row submits for THAT day: submittedFor = lateFor = day, doneDates has it, POST hints carry it', c.status === 'pending' && c.submittedFor === TWO && c.lateFor === TWO && JSON.stringify(c.doneDates) === JSON.stringify([TWO]) && calls[0][1]._submittedFor === TWO, JSON.stringify([c.submittedFor, c.lateFor, c.doneDates, calls[0]]));
    const early2 = { id: 'v40e', name: 'Early2', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, dueHour: 0 }; S().children.Cora.chores.push(early2);
    w.toggleChoreCheck('v40e');
    c = S().children.Cora.chores.find(x => x.id === 'v40e');
    check('V40-4 a plain tap after the due hour is a late submission for today (lateFor = today); before it, lateFor is null', c.submittedFor === today && (hourNow < 6 ? c.lateFor === null : c.lateFor === today), JSON.stringify([c.submittedFor, c.lateFor]));
    w.toggleChoreCheck('v40b'); c = S().children.Cora.chores.find(x => x.id === 'v40b');
    check('V40-4 a tap on the not-yet-due chore: lateFor null', c.status === 'pending' && (hourNow === 23 || c.lateFor === null), JSON.stringify(c.lateFor));
    E("currentUser='Alice'; currentRole='parent'; activeChild='Cora';"); w.quickDenyOne('v40c'); c = S().children.Cora.chores.find(x => x.id === 'v40c');
    check('V40-4 denial clears lateFor and takes the day out of doneDates', c.lateFor === null && c.doneDates.length === 0, JSON.stringify([c.lateFor, c.doneDates]));
    w.closeQuickApprove && w.closeQuickApprove(); w.syncToCloud = prev;
  }

  // ── v40-5: late approval with / without reward; on-time approval unchanged ──
  {
    const calls = []; const prev = w.syncToCloud; w.syncToCloud = async (a, o) => { calls.push([a, o && o.extra]); return { status: 'ok' }; };
    const d2 = new Date(); d2.setDate(d2.getDate() - 2); const TWO = w.ymdLocal(d2);
    E("currentUser='Alice'; currentRole='parent'; activeChild='Cora';");
    const bal = () => S().children.Cora.balances;
    const b0 = Object.assign({}, bal());
    S().children.Cora.chores.push(
      { id: 'v40f', name: 'Late one', schedule: 'daily', status: 'pending', completedBy: 'Cora', completedAt: 'x', amount: 2, splitChk: 50, submittedFor: TWO, lateFor: TWO, doneDates: [TWO], missedDates: [TWO], streakMilestone: 2, streakReward: 1, streakCount: 1 },
      { id: 'v40g', name: 'Late two', schedule: 'daily', status: 'pending', completedBy: 'Cora', completedAt: 'x', amount: 2, splitChk: 50, submittedFor: TWO, lateFor: TWO, doneDates: [TWO], missedDates: [TWO] },
      { id: 'v40h', name: 'On time', schedule: 'daily', status: 'pending', completedBy: 'Cora', completedAt: 'x', amount: 2, splitChk: 50, submittedFor: today, lateFor: null, doneDates: [today] });
    w.renderParentChores(); const cardHtml = w.document.getElementById('parent-chore-approvals').innerHTML;
    const seg = (html, name) => (html.split(/chore-card state-pending|class="qa-row"/).find(x => x.indexOf(name) !== -1) || '');
    check('V40-5 parent card shows the Late badge with the day on late chores only', /⏰ Late — for \w{3} \d+\/\d+/.test(seg(cardHtml, 'Late one')) && /⏰ Late — for/.test(seg(cardHtml, 'Late two')) && !!seg(cardHtml, 'On time') && !/⏰ Late/.test(seg(cardHtml, 'On time')), (cardHtml.match(/⏰ Late — for \w{3} \d+\/\d+/g) || []).join());
    w.openQuickApprove(); const qa = w.document.getElementById('quick-approve-list').innerHTML;
    check('V40-5 quick-approve sheet: "✓ $0" button on the two late chores, not on the on-time one', /✓ \$0/.test(seg(qa, 'Late one')) && /✓ \$0/.test(seg(qa, 'Late two')) && !!seg(qa, 'On time') && !/✓ \$0/.test(seg(qa, 'On time')) && /⏰ Late — for/.test(seg(qa, 'Late one')), (qa.match(/✓ \$0/g) || []).length + '');
    const h0 = S().history.Cora.length;
    w.quickApproveOne('v40f', true);   // no reward → milestone 2 hit → $1 bonus only
    let c = S().children.Cora.chores.find(x => x.id === 'v40f');
    check('V40-5 approve, no reward: nothing deposited for the chore, $0 ledger line, done for that day (lastCompleted), missedDates cleared, streak +1 and milestone bonus paid', bal().checking === b0.checking + 1 && bal().savings === b0.savings && c.status === 'available' && c.lastCompleted === TWO && c.missedDates.length === 0 && c.lateFor === null && c.submittedFor === null && c.streakCount === 2 && S().history.Cora.slice(h0).some(e => /Late one \(late, no reward\)/.test(e.note) && e.amt === 0), JSON.stringify([bal(), c.lastCompleted, c.missedDates, c.streakCount, S().history.Cora.slice(h0).map(e => [e.note, e.amt])]));
    w.approveChore('v40g'); const sb = w.document.getElementById('modal-secondary-btn');
    check('V40-5 Approve modal on a late chore offers "Approve, no reward" and says the day', sb && sb.style.display !== 'none' && sb.textContent === 'Approve, no reward' && /Done late — for/.test(w.document.getElementById('modal-body').textContent), w.document.getElementById('modal-body').textContent);
    w.fireModalConfirm();   // Approve & Pay
    c = S().children.Cora.chores.find(x => x.id === 'v40g');
    check('V40-5 approve & pay on a late chore: reward deposited, done for that day, missedDates cleared', bal().checking === b0.checking + 2 && bal().savings === b0.savings + 1 && c.lastCompleted === TWO && c.missedDates.length === 0 && c.lateFor === null, JSON.stringify([bal(), c.lastCompleted, c.missedDates]));
    w.approveChore('v40h');
    check('V40-5 Approve modal on an on-time chore has no second button', w.document.getElementById('modal-secondary-btn').style.display === 'none' && /Deposits the reward/.test(w.document.getElementById('modal-body').textContent));
    w.fireModalConfirm(); c = S().children.Cora.chores.find(x => x.id === 'v40h');
    check('V40-5 on-time approval unchanged: deposited, lastCompleted = today', bal().checking === b0.checking + 3 && c.lastCompleted === today && c.status === 'available', JSON.stringify([bal(), c.lastCompleted]));
    w.closeQuickApprove && w.closeQuickApprove(); w.closeModal(); w.syncToCloud = prev;
  }

  // ── v40-6: "Email parents when a chore is missed" round-trips through the Profile section ──
  {
    const prev = w.syncToCloud; w.syncToCloud = async () => ({ status: 'ok' });
    E("currentUser='Alice'; currentRole='parent'; activeChild='Cora';");
    S().config.emails = S().config.emails || {}; S().config.emails.Cora = 'cora@example.com';
    w.renderChildProfileSection();
    const box = w.document.getElementById('profile-notify-missed');
    check('V40-6 the checkbox exists and loads OFF by default', !!box && box.checked === false);
    box.checked = true; w.saveChildProfile();
    check('V40-6 saving the profile stores config.notify.Cora.missedEmail = true (other toggles kept)', S().config.notify.Cora.missedEmail === true && S().config.notify.Cora.email === true, JSON.stringify(S().config.notify.Cora));
    w.renderChildProfileSection();
    check('V40-6 it loads back ON', w.document.getElementById('profile-notify-missed').checked === true);
    box.checked = false; w.saveChildProfile();
    check('V40-6 unchecking stores false', S().config.notify.Cora.missedEmail === false, JSON.stringify(S().config.notify.Cora));
    w.syncToCloud = prev;
  }

  // ── v40-10 audit fixes (client): H1 default due 8 PM + wizard, H2 once badge, H3 no double pay, M1 stale day, M4 moved day, L4 row ──
  {
    const calls = []; const prev = w.syncToCloud; w.syncToCloud = async (a, o) => { calls.push([a, o && o.extra]); return { status: 'ok' }; };
    const hourNow = new Date().getHours();
    const d1 = new Date(); d1.setDate(d1.getDate() - 1); const YEST = w.ymdLocal(d1);
    const old = { id: 'a1', name: 'Pre-v40', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, reminderHour: 8 };
    check('A10 (H1) a chore without dueHour is due by 8 PM, whatever its reminderHour; dueHour wins when set', w.choreDueHour(old, today) === 20 && w.choreDueHour({ dueHour: 9, reminderHour: 8 }, today) === 9 && w.choreDueHour({ dueHour: 9, dayOverrides: { [today]: 14 } }, today) === 14, [w.choreDueHour(old, today), w.choreDueHour({ dueHour: 9, reminderHour: 8 }, today)].join());
    const cur = w.cwFieldsToCur(old);
    const appSrc = fs.readFileSync(path.join(REPO, 'app.js'), 'utf8');
    check('A10 (H1/N2) editing a pre-v40 chore preselects 8 PM and remembers its calendar time; a new chore defaults to 8 PM; the wizard writes dueHour', cur.cReminder === 20 && w.cwBlankCur().cReminder === 20 && /dueHour: parseInt\(d\.cReminder,10\)\|\|DEFAULT_DUE_HOUR/.test(appSrc) && /reminderHour: \(d\.cPreV40Reminder/.test(appSrc) && w.cwFieldsToCur({ reminderHour: 7 }).cPreV40Reminder === 7 && w.cwFieldsToCur({ reminderHour: 7, dueHour: 9 }).cPreV40Reminder === null, JSON.stringify([cur.cReminder, w.cwBlankCur().cReminder]));
    check('A10 (H2) a one-time chore can only be missed on its "on" date; an open or "by" one never (isMissableOn / isLateToday false)', w.isMissableOn({ schedule: 'once', onceDate: today, onceDueOn: true }, today) === true && w.isMissableOn({ schedule: 'once', onceDate: today, onceDueOn: false }, today) === false && w.isMissableOn({ schedule: 'once' }, today) === false && !w.isLateToday({ schedule: 'once', status: 'available', dueHour: 0 }), '');
    // H3: done + paid today, make up yesterday, approve → today's row must NOT come back
    E("currentUser='Alice'; currentRole='parent'; activeChild='Cora';");
    S().children.Cora.chores.push({ id: 'a2', name: 'Twice', schedule: 'daily', status: 'pending', completedBy: 'Cora', completedAt: 'x', amount: 2, splitChk: 50, dueHour: 23, lastCompleted: today, doneDates: [YEST, today], submittedFor: YEST, lateFor: YEST, missedDates: [YEST] });
    w.quickApproveOne('a2', true);
    let c = S().children.Cora.chores.find(x => x.id === 'a2');
    E("currentUser='Cora'; currentRole='child'; activeChild=null;"); w.setChoreFilter('today');
    const html = w.document.getElementById('chore-table-wrap').innerHTML;
    check('A10 (H3) approving yesterday\'s make-up keeps lastCompleted = today and today\'s row stays done (no second checkbox)', c.lastCompleted === today && c.missedDates.length === 0 && html.indexOf('chk-a2"') === -1 && html.indexOf("chk-a2'") === -1 && !/chk-a2\b/.test(html.replace(/chk-a2-/g, '')), c.lastCompleted + ' ' + (html.match(/chk-a2[^"]*/g) || []).join());
    // H3 denial keeps an earlier day's completion
    E("currentUser='Alice'; currentRole='parent'; activeChild='Cora';");
    S().children.Cora.chores.push({ id: 'a3', name: 'DenyKeep', schedule: 'daily', status: 'pending', completedBy: 'Cora', completedAt: 'x', amount: 2, splitChk: 50, dueHour: 23, lastCompleted: today, doneDates: [YEST, today], submittedFor: YEST, lateFor: YEST });
    w.quickDenyOne('a3'); c = S().children.Cora.chores.find(x => x.id === 'a3');
    check('A10 (H3) denying yesterday\'s make-up keeps today\'s completion', c.lastCompleted === today && JSON.stringify(c.doneDates) === JSON.stringify([today]), JSON.stringify([c.lastCompleted, c.doneDates]));
    // M1: a make-up tap on a proof chore, cancelled, then a plain tap → today
    E("currentUser='Cora'; currentRole='child'; activeChild=null;");
    S().children.Cora.chores.push({ id: 'a4', name: 'Proofed', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, dueHour: 23, requiresProof: true, missedDates: [YEST] });
    w.toggleChoreCheck('a4', YEST); w.proofCancel();
    S().children.Cora.chores.find(x => x.id === 'a4').requiresProof = false;
    w.toggleChoreCheck('a4'); c = S().children.Cora.chores.find(x => x.id === 'a4');
    check('A10 (M1) a cancelled make-up does not leak into the next plain tap (submittedFor = today)', c.submittedFor === today && (hourNow === 23 || c.lateFor === null), JSON.stringify([c.submittedFor, c.lateFor]));
    // M4: a moved day leaves missedDates; a day past endDate / not due is not owed
    const a5 = { id: 'a5', name: 'Moved', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, dueHour: 23, missedDates: [YEST] };
    S().children.Cora.chores.push(a5);
    const r = w.rsApply(a5, YEST, today);
    check('A10 (M4) Reschedule drops the moved day from missedDates', r && r.changed === true && !a5.missedDates, JSON.stringify([r, a5.missedDates]));
    check('A10 (M4) missed rows ignore a day the chore is no longer due on / past its end', w.missedDaysOpen({ schedule: 'daily', missedDates: [YEST], skipDates: [YEST] }).length === 0 && w.missedDaysOpen({ schedule: 'daily', missedDates: [YEST], endDate: w.ymdLocal(new Date(Date.now() - 3 * 86400000)) }).length === 0 && w.missedDaysOpen({ schedule: 'daily', missedDates: [YEST] }).length === 1, '');
    w.closeQuickApprove && w.closeQuickApprove(); w.syncToCloud = prev;
  }

  const fails = results.filter(r => !r.ok).length;
  console.log('\nDONE — ' + (results.length - fails) + '/' + results.length + ' PASS' + (fails ? ', ' + fails + ' FAIL' : ''));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL harness error: ' + (e.stack || e)); process.exit(1); });
