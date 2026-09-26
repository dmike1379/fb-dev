// v39 harness — the one-off schedule model (skipDates / extraDates / notBefore) and the
// "Reschedule chores" flow, against the real index.html + app.js in jsdom (syncToCloud stubbed).
// Usage: node tests/reschedule.js [repo]   → PASS/FAIL lines + "DONE — n/m PASS"
const fs = require('fs'); const path = require('path');
const { JSDOM } = require('jsdom');
const REPO = process.argv[2] || path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8')
  .replace(/<script src="vendor\/chart.umd.min.js"><\/script>/, '')
  .replace(/<script src="app.js"><\/script>/, '');
const dom = new JSDOM(html, { url: 'https://dmike1379.github.io/fb-dev/', runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;
w.fetch = async () => ({ json: async () => ({ status: 'error', reason: 'familyNotFound' }), text: async () => '{}', status: 200, ok: true, url: '' });
w.Chart = function () { this.destroy = () => {}; this.data = { datasets: [{}], labels: [] }; this.update = () => {}; };
w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
const E = (code) => w.eval(code); const S = () => E('state');
const results = []; const check = (name, ok, detail) => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  — ' + detail : '')); };
w.addEventListener('error', e => console.log('window error: ' + e.message));
const sc = w.document.createElement('script'); sc.textContent = fs.readFileSync(path.join(REPO, 'app.js'), 'utf8'); w.document.body.appendChild(sc);
try { E('state'); } catch (e) { console.log('FAIL app.js load: ' + e.message); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// The pre-v39 isDueToday, verbatim, as the oracle for chores without the new fields.
const ORACLE = `(function(chore){
  const todayStr=()=>{ const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
  const now=new Date();
  if(chore.schedule==="daily") return true;
  if(chore.schedule==="once"){ if(!chore.onceDate) return true; const today=todayStr(); if(chore.onceDate<today) return false; if(chore.onceDueOn) return chore.onceDate===today; return true; }
  if(chore.schedule==="weekly"){ const days = chore.weekdays || (chore.weekday!==undefined ? [chore.weekday] : [now.getDay()]); return days.indexOf(now.getDay())!==-1; }
  if(chore.schedule==="biweekly"){ const days = chore.weekdays || (chore.weekday!==undefined ? [chore.weekday] : [now.getDay()]); if(days.indexOf(now.getDay())===-1) return false;
    const created=new Date(chore.createdAt||Date.now()); const weeksDiff=Math.floor((Date.now()-created.getTime())/(7*24*60*60*1000)); const offset = chore.skipFirstWeek ? 1 : 0; return (weeksDiff + offset) % 2 === 0; }
  if(chore.schedule==="monthly"){ const target=resolveMonthlyDay(chore.monthlyDay||"1",now.getFullYear(),now.getMonth()); return now.getDate()===target; }
  return false; })`;

(async () => {
  await sleep(300);
  const today = E('todayStr()'); const plus = (n) => E(`ymdAddDays(${JSON.stringify(today)}, ${n})`);
  const dow = new Date().getDay();
  const fmtCreated = (daysAgo) => { const d = new Date(Date.now() - daysAgo * 86400000); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };

  // ── M1 no new fields → identical to the pre-v39 rules ───────────────────────────────────
  const matrix = [
    { schedule: 'daily' }, { schedule: 'once' },
    { schedule: 'once', onceDate: today }, { schedule: 'once', onceDate: today, onceDueOn: true }, { schedule: 'once', onceDate: plus(3) }, { schedule: 'once', onceDate: plus(3), onceDueOn: true }, { schedule: 'once', onceDate: plus(-2) },
    ...[0, 1, 2, 3, 4, 5, 6].map(d => ({ schedule: 'weekly', weekdays: [d] })), { schedule: 'weekly', weekday: dow }, { schedule: 'weekly' },
    ...[0, 3, 7, 10, 14, 20].map(a => ({ schedule: 'biweekly', weekdays: [dow], createdAt: fmtCreated(a) })), { schedule: 'biweekly', weekdays: [dow], createdAt: fmtCreated(7), skipFirstWeek: true },
    ...['1', '15', String(new Date().getDate()), 'last', 'last-1'].map(m => ({ schedule: 'monthly', monthlyDay: m })),
  ];
  const oracle = E(ORACLE);
  const mism = matrix.filter(c => E('isDueToday')(c) !== oracle(c));
  check('M1 chores without skip/extra/notBefore: isDueToday matches the pre-v39 rules (' + matrix.length + ' cases)', mism.length === 0, JSON.stringify(mism));
  const pillMism = matrix.filter(c => c.schedule !== 'once' && E('isDueToday')(c) && (() => { const d = E('getNextChoreOccurrence')(c); return !d || E('ymdLocal')(d) !== today; })());
  check('M1 the Next pill says "today" for every recurring chore that is due today', pillMism.length === 0, JSON.stringify(pillMism));

  // ── M2 skipDates ──────────────────────────────────────────────────────────────────────────
  let c = { schedule: 'daily', skipDates: [today] };
  check('M2 a daily chore skipped today is not due today', E('isDueToday')(c) === false);
  check('M2 …and its Next pill says tomorrow', E('ymdLocal')(E('getNextChoreOccurrence')(c)) === plus(1));
  c = { schedule: 'daily', skipDates: [today, plus(1)] };
  check('M2 two skipped days → next is the day after', E('ymdLocal')(E('getNextChoreOccurrence')(c)) === plus(2));

  // ── M3 extraDates ─────────────────────────────────────────────────────────────────────────
  const notToday = (dow + 3) % 7;
  c = { schedule: 'weekly', weekdays: [notToday], extraDates: [today] };
  check('M3 a weekly chore with today as an extra date is due today', E('isDueToday')(c) === true && E('isDueThisWeek')(c) === true);
  c = { schedule: 'weekly', weekdays: [notToday], extraDates: [plus(1)] };
  check('M3 an extra date tomorrow shows on the Next pill', E('ymdLocal')(E('getNextChoreOccurrence')(c)) === plus(1));
  c = { schedule: 'weekly', weekdays: [dow], extraDates: [today], skipDates: [today] };
  check('M3 extra wins over skip on the same day (a move back to the original day)', E('isDueToday')(c) === true);

  // ── M4 notBefore (one-time chores) ────────────────────────────────────────────────────────
  c = { schedule: 'once', notBefore: plus(1) };
  check('M4 an undated one-time chore held until tomorrow: not due today, due tomorrow, pill tomorrow', E('isDueToday')(c) === false && E('isDueOn')(c, plus(1)) === true && E('ymdLocal')(E('getNextChoreOccurrence')(c)) === plus(1));
  c = { schedule: 'once', notBefore: plus(9) };
  check('M4 held past this week → not in This Week', E('isDueThisWeek')(c) === false);
  c = { schedule: 'once', onceDate: plus(5), notBefore: plus(2) };
  check('M4 due by a date, held for 2 days: due on day 2 … 5 only', E('isDueOn')(c, plus(1)) === false && E('isDueOn')(c, plus(2)) === true && E('isDueOn')(c, plus(5)) === true && E('isDueOn')(c, plus(6)) === false);

  // ── M5 the Next pill respects endDate ─────────────────────────────────────────────────────
  c = { schedule: 'daily', skipDates: [today], endDate: today };
  check('M5 a daily chore that ends today and is skipped today has no next occurrence', E('getNextChoreOccurrence')(c) === null);


  // ── R: the Reschedule Today's Chores flow ────────────────────────────────────────────────
  const tomorrow = plus(1); const dowT = (dow + 1) % 7;
  const kid = (chores) => ({ balances: { checking: 10, savings: 5 }, rates: { checking: 0, savings: 0 }, autoDeposit: { checking: 0, savings: 0 }, chores, pendingDeposits: [], pendingWithdrawals: [], goals: [], loans: [] });
  const coraChores = () => [
    { id: 'bed', name: 'Make bed', schedule: 'daily', status: 'available', amount: 1, splitChk: 50 },
    { id: 'dog', name: 'Feed dog', schedule: 'weekly', weekdays: [dow], status: 'available', amount: 1, splitChk: 50 },
    { id: 'trash', name: 'Trash', schedule: 'weekly', weekdays: [dowT], status: 'available', amount: 1, splitChk: 50 },
    { id: 'lib', name: 'Library book', schedule: 'once', onceDate: today, onceDueOn: true, status: 'available', amount: 1, splitChk: 50 },
    { id: 'desk', name: 'Clean desk', schedule: 'once', status: 'available', amount: 1, splitChk: 50 },
    { id: 'sci', name: 'Science project', schedule: 'once', onceDate: plus(3), onceDueOn: false, status: 'available', amount: 1, splitChk: 50 },
    { id: 'pend', name: 'Waiting one', schedule: 'daily', status: 'pending', completedBy: 'Cora', amount: 1, splitChk: 50 },
    { id: 'paus', name: 'Paused one', schedule: 'daily', status: 'available', paused: true, amount: 1, splitChk: 50 },
    { id: 'done', name: 'Done today', schedule: 'daily', status: 'available', lastCompleted: today, amount: 1, splitChk: 50 },
    { id: 'ends', name: 'Ends today', schedule: 'weekly', weekdays: [dow], endDate: today, status: 'available', amount: 1, splitChk: 50 },
  ];
  E("state.users=['Alice','Cora']; state.roles={Alice:'parent',Cora:'child'}; state.pins={Alice:'1111',Cora:'2222'}; state.config.parentChildren={Alice:['Cora']}; state.config.autoLogout=0; state.history={};");
  S().children = { Cora: kid(coraChores()) };
  E("currentUser='Alice'; currentRole='parent'; activeChild='Cora';");
  const posted = [];
  let failFor = null;
  w.syncToCloud = async (action, opts) => { posted.push({ action, opts: JSON.parse(JSON.stringify(opts || {})) }); if (failFor && opts && opts.activeChild === failFor) return { status: 'error', reason: 'stale', rev: 9 }; return { status: 'ok', rev: posted.length }; };
  const cur = () => E('wz && wzCur() ? wzCur().id : null');
  const body = () => w.document.getElementById('wz2-body').textContent.replace(/\s+/g, ' ').trim();
  const foot = () => w.document.getElementById('wz2-footer').textContent.replace(/\s+/g, ' ').trim();
  const pick = (re) => { const b = [...w.document.querySelectorAll('#wz2-body button.wz-opt')].find(x => re.test(x.textContent.replace(/\s+/g, ' ').trim())); if (!b) throw new Error('no option ' + re + ' at ' + cur()); b.click(); };
  const chore = (child, id) => S().children[child].chores.find(c => c.id === id);

  check('R0 the Chores tab has the Reschedule Today\'s Chores button', !![...w.document.querySelectorAll('#parent-tab-chores .sheet-trigger')].find(b => /Reschedule Today's Chores/.test(b.textContent) && /rsOpen/.test(b.getAttribute('onclick'))));
  w.rsOpen();
  check('R1 opens on "Move chores from which day?" with Today / Tomorrow / Another day', cur() === 'from' && /Move chores from which day\?/.test(body()) && /Today/.test(body()) && /Tomorrow/.test(body()) && /Another day/.test(body()), body().slice(0, 140));
  pick(/^Today/);
  check('R2 then "Move today\'s chores to…" with Tomorrow first', cur() === 'to' && /Move today's chores to…/.test(body()) && /^Move today's chores to… Tomorrow/.test(body()), body().slice(0, 120));
  pick(/^Tomorrow/);
  const txt = body();
  check('R3 review lists the 6 movable chores', cur() === 'review' && ['Make bed', 'Feed dog', 'Library book', 'Clean desk', 'Science project'].every(n => txt.indexOf(n) !== -1) && !/Trash|Waiting one|Paused one|Done today/.test(txt), txt.slice(0, 400));
  const notes = Object.fromEntries(E("wz.meta.rsRows.map(r=>[r.chore.id, r.plan.note])"));
  check('R3 notes: daily skips, weekly moves, due-on moves, undated/due-by wait', /^skips .* \(already due /.test(notes.bed) && /^moves to /.test(notes.dog) && /^moves to /.test(notes.lib) && /^waits until /.test(notes.desk) && /^waits until /.test(notes.sci) && !/due date moves/.test(notes.sci), JSON.stringify(notes));
  check('R3 "Ends today" is named under Not moved', /Not moved: Ends today \(ends /.test(txt), txt.slice(-120));
  check('R3 footer: Move 5 chores', foot() === 'Move 5 chores', foot());
  const i = E("wz.meta.rsRows.findIndex(r => r.chore.id === 'desk')"); w.rsToggle(i);
  check('R4 tapping a chore leaves it (footer Move 4 chores, row says stays)', foot() === 'Move 4 chores' && /Clean desk\s*stays on /.test(body()), foot() + ' | ' + body().slice(0, 200));
  posted.length = 0;
  await w.rsCommit(); await sleep(20);
  check('R5 one verified save for Cora: "Chores Rescheduled" with the 4 moved ids', posted.length === 1 && posted[0].action === 'Chores Rescheduled' && posted[0].opts.activeChild === 'Cora' && JSON.stringify(posted[0].opts.extra._editedChoreIds.slice().sort()) === JSON.stringify(['bed', 'dog', 'lib', 'sci']), JSON.stringify(posted));
  check('R5 daily: today skipped, no extra', JSON.stringify(chore('Cora', 'bed').skipDates) === JSON.stringify([today]) && !chore('Cora', 'bed').extraDates);
  check('R5 weekly: today skipped, tomorrow added', JSON.stringify(chore('Cora', 'dog').skipDates) === JSON.stringify([today]) && JSON.stringify(chore('Cora', 'dog').extraDates) === JSON.stringify([tomorrow]));
  check('R5 due-on one-time: date moved to tomorrow', chore('Cora', 'lib').onceDate === tomorrow && chore('Cora', 'lib').onceDueOn === true);
  check('R5 due-by one-time: waits until tomorrow, due date kept', chore('Cora', 'sci').notBefore === tomorrow && chore('Cora', 'sci').onceDate === plus(3));
  check('R5 the untapped chore and the others are untouched', !chore('Cora', 'desk').notBefore && !chore('Cora', 'trash').extraDates && !chore('Cora', 'ends').skipDates && !chore('Cora', 'done').skipDates);
  check('R5 success screen', cur() === 'success' && /4 chores moved to /.test(body()), body());
  w.rsDone();
  E("currentUser='Cora'; currentRole='child'; activeChild=null;"); w.renderChildChores(); w.setChoreFilter('today');
  const childTxt = w.document.getElementById('child-chore-list').textContent;
  const dueRows = [...w.document.querySelectorAll('#chore-table-wrap tr')].filter(tr => /chore-checkbox-wrap/.test(tr.innerHTML)).map(tr => tr.textContent.replace(/\s+/g, ' ').trim());
  check('R6 child view: moved chores have no checkbox today; the untouched one does', dueRows.some(t => /Clean desk/.test(t)) && !dueRows.some(t => /Make bed|Feed dog|Library book|Science project/.test(t)), dueRows.join(' | '));
  E("currentUser='Alice'; currentRole='parent'; activeChild='Cora';");
  check('R6 everything moved is due tomorrow, nothing twice', ['bed', 'dog', 'lib', 'sci'].every(id => E('isDueOn')(chore('Cora', id), tomorrow)) && chore('Cora', 'dog').extraDates.length === 1);

  // move back: tomorrow → today undoes the weekly move cleanly
  w.rsOpen(); pick(/^Tomorrow/); pick(/^Another day/);
  const inp = w.document.getElementById('wz-input'); inp.value = today; inp.dispatchEvent(new w.Event('input'));
  w.wzPrimary();
  const back = body();
  check('R7 moving tomorrow back to today lists Feed dog as "moves to" today', cur() === 'review' && /Feed dog/.test(back), back.slice(0, 300));
  E("wz.meta.rsRows.forEach((r,i)=>{ if(r.chore.id!=='dog') wz.draft.sel[r.key]=false; })"); w.wzRender();
  posted.length = 0; await w.rsCommit(); await sleep(20);
  check('R7 Feed dog is back to its plain schedule (no skip, no extra)', !chore('Cora', 'dog').skipDates && !chore('Cora', 'dog').extraDates && E('isDueToday')(chore('Cora', 'dog')) === true, JSON.stringify(chore('Cora', 'dog')));
  w.rsDone();

  // two children: grouped, one save each; a stale refusal rolls back that child only
  S().users.push('Finn'); S().roles.Finn = 'child'; S().config.parentChildren.Alice.push('Finn');
  S().children.Finn = kid([{ id: 'fbed', name: 'Finn bed', schedule: 'daily', status: 'available', amount: 1, splitChk: 50 }]);
  S().children.Cora = kid([{ id: 'cbed', name: 'Cora bed', schedule: 'daily', status: 'available', amount: 1, splitChk: 50 }]);
  w.rsOpen(); pick(/^Today/); pick(/^Tomorrow/);
  check('R8 two children: grouped under their names', /Cora\s*✓ Cora bed/.test(body()) && /Finn\s*✓ Finn bed/.test(body()) && foot() === 'Move 2 chores', body().slice(0, 200));
  failFor = 'Finn'; posted.length = 0;
  await w.rsCommit(); await sleep(20);
  check('R8 Cora saved, Finn refused: Finn rolled back, Cora kept, error shown', posted.length === 2 && JSON.stringify(chore('Cora', 'cbed').skipDates) === JSON.stringify([today]) && !chore('Finn', 'fbed').skipDates && /Someone else saved first — nothing was moved for Finn/.test(body()), body().slice(0, 160));
  check('R8 the retry lists only Finn\'s chore', foot() === 'Move 1 chore' && !/Cora bed/.test(body()), foot());
  failFor = null; posted.length = 0;
  await w.rsCommit(); await sleep(20);
  check('R8 retry moves Finn\'s chore', posted.length === 1 && posted[0].opts.activeChild === 'Finn' && JSON.stringify(chore('Finn', 'fbed').skipDates) === JSON.stringify([today]) && cur() === 'success', JSON.stringify(posted));
  w.rsDone();
  check('R9 no reschedule draft is ever stored', w.localStorage.getItem('fb_rs_draft') === null);
  E("currentRole='child';"); const before = E('wz');
  w.rsOpen(); check('R9 children cannot open it', E('wz') === before);
  E("currentRole='parent';");

  // R10 (v39-23): editing a moved chore — a schedule change drops the moves, a name change keeps them
  S().children.Cora.chores.push({ id: 'w10', name: 'Waiting', schedule: 'once', status: 'available', amount: 1, splitChk: 50, notBefore: tomorrow, createdAt: new Date().toISOString() },
                                { id: 'k10', name: 'Keeper', schedule: 'weekly', weekdays: [new Date().getDay()], status: 'available', amount: 1, splitChk: 50, skipDates: [today], extraDates: [tomorrow], createdAt: new Date().toISOString() });
  w.cwOpenEdit('Cora', 'w10'); E(`wz.draft.cOnceType='on'; wz.draft.cOnceDate='${today}'`); posted.length = 0;
  await w.cwCommitEdit(); await sleep(20); E("wz=null");
  check('R10 a waiting one-time chore edited to "due on today" is due today (the hidden wait is dropped)', posted.length === 1 && chore('Cora', 'w10').notBefore === undefined && E('isDueToday')(chore('Cora', 'w10')) === true, JSON.stringify(chore('Cora', 'w10')));
  w.cwOpenEdit('Cora', 'k10'); E("wz.draft.cName='Keeper renamed'"); posted.length = 0;
  await w.cwCommitEdit(); await sleep(20); E("wz=null");
  check('R10 a name-only edit keeps the move', chore('Cora', 'k10').name === 'Keeper renamed' && JSON.stringify(chore('Cora', 'k10').skipDates) === JSON.stringify([today]) && JSON.stringify(chore('Cora', 'k10').extraDates) === JSON.stringify([tomorrow]), JSON.stringify(chore('Cora', 'k10')));

  // R11 (v39-25): "Another day" stops at 60 days out (the calendar's skip window)
  w.rsOpen(); pick(/^Today/); pick(/^Another day/);
  const inp11 = w.document.getElementById('wz-input');
  inp11.value = E('ymdAddDays')(today, 61); inp11.dispatchEvent(new w.Event('input')); w.wzPrimary();
  check('R11 a day past 60 days out is refused, and the picker says where it stops', cur() === 'toDate' && inp11.getAttribute('max') === E('ymdAddDays')(today, 60) && /next 2 months/.test(body()), cur() + ' max=' + inp11.getAttribute('max') + ' ' + body().slice(0, 120));
  inp11.value = E('ymdAddDays')(today, 60); inp11.dispatchEvent(new w.Event('input')); w.wzPrimary();
  check('R11 60 days out is fine', cur() === 'review', cur());
  w.rsDone();

  // R12 (v39-26): ✕ while "Saving…" — the move still finishes for every child, and says so
  S().children.Finn = kid([{ id: 'f12', name: 'Finn twelve', schedule: 'daily', status: 'available', amount: 1, splitChk: 50 }]);
  S().children.Cora = kid([{ id: 'c12', name: 'Cora twelve', schedule: 'daily', status: 'available', amount: 1, splitChk: 50 }]);
  const realSync = w.syncToCloud; posted.length = 0;
  w.syncToCloud = async (action, opts) => { await sleep(50); return realSync(action, opts); };
  const toasts12 = []; const origToast12 = w.showToast; w.showToast = (m) => { toasts12.push(String(m)); };
  w.rsOpen(); pick(/^Today/); pick(/^Tomorrow/);
  let err12 = null; const p12 = w.rsCommit().catch(e => { err12 = e; });
  await sleep(10); w.wzClose ? w.wzClose() : E('wz=null'); await p12; await sleep(20);
  w.syncToCloud = realSync; w.showToast = origToast12;
  check('R12 closing during the save still moves both children, no error thrown, a toast says so', !err12 && posted.length === 2 && JSON.stringify(chore('Finn', 'f12').skipDates) === JSON.stringify([today]) && toasts12.some(t => /2 chores moved/.test(t)), (err12 ? err12.message : '') + ' posted=' + posted.length + ' ' + toasts12.join(' | '));
  E('wz=null');

  const fails = results.filter(x => !x.ok).length;
  console.log('\nDONE — ' + (results.length - fails) + '/' + results.length + ' PASS' + (fails ? ', ' + fails + ' FAIL' : ''));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL harness error: ' + (e.stack || e)); process.exit(1); });
