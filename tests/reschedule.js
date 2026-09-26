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

  const fails = results.filter(x => !x.ok).length;
  console.log('\nDONE — ' + (results.length - fails) + '/' + results.length + ' PASS' + (fails ? ', ' + fails + ' FAIL' : ''));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL harness error: ' + (e.stack || e)); process.exit(1); });
