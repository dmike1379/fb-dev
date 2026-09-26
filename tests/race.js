// v38.3 harness — BUG-B (post-save reload race) and BUG-A (lost save reply) against the real
// index.html + app.js in jsdom, with a fake Apps Script backend that keeps the client's
// _savedAt stamp the way doPost/saveState do. Real timers, so the run takes ~25 s.
// Usage: TZ=America/Chicago node race.js /path/to/repo   → PASS/FAIL lines + "DONE — n/m PASS"
const fs = require('fs'); const path = require('path');
const { JSDOM } = require('jsdom');
const REPO = process.argv[2] || require('path').resolve(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8')
  .replace(/<script src="vendor\/chart.umd.min.js"><\/script>/, '')
  .replace(/<script src="app.js"><\/script>/, '');
const dom = new JSDOM(html, { url: 'https://dmike1379.github.io/fb-dev/', runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;
// ---- fake backend ------------------------------------------------------------------------
const server = { state: null, mode: 'ok', latencyMs: 60, postLatencyMs: null, getFailOnce: false, posts: 0, gets: 0, staleRefusals: 0 };
const json = (obj, status = 200) => ({ ok: status === 200, status, url: 'https://script.googleusercontent.com/macros/echo', json: async () => obj, text: async () => JSON.stringify(obj) });
const html404 = () => ({ ok: false, status: 404, url: 'https://script.googleusercontent.com/macros/echo', json: async () => { throw new Error('not json'); }, text: async () => '<!DOCTYPE html><html>' });
w.fetch = async (url, init) => {
  const u = String(url);
  if (!/script\.google/.test(u)) return json({ version: '0', build: '0' });
  if (init && init.method === 'POST') {
    const body = JSON.parse(init.body);
    if (server.mode === 'drop') { await sleep(server.latencyMs); return html404(); }   // lost AND not saved
    if (server.mode === 'busy') { await sleep(server.latencyMs); return json({ status: 'error', reason: 'busy' }); }   // v39: lock not acquired, nothing saved
    const saved = JSON.parse(JSON.stringify(body));
    ['familyId', 'tempTransactions', 'lastAction', 'history', 'activeChild'].forEach(k => delete saved[k]);
    // v39 compare-and-set: refuse a save whose _baseRev is older than the stored _rev
    const curRev = (server.state && server.state._rev) || 0;
    const baseRev = (saved._baseRev === undefined || saved._baseRev === null) ? null : saved._baseRev;
    delete saved._baseRev; delete saved._rev;
    if (server.mode === 'ok' && baseRev !== null && curRev && baseRev !== curRev) { server.staleRefusals++; await sleep(server.latencyMs); return json({ status: 'error', reason: 'stale', rev: curRev }); }
    saved._rev = curRev + 1;
    saved.config = { ...(saved.config || {}), serverTouched: ((saved.config || {}).serverTouched || 0) + 1 };   // proves a reload really applied
    server.state = saved; server.posts++;
    const mode = server.mode; await sleep(server.postLatencyMs != null ? server.postLatencyMs : server.latencyMs);
    if (mode === 'lost') return html404();
    if (mode === 'reject') return json({ status: 'error', reason: 'familyNotFound' });
    if (mode === 'threw') return json({ error: 'Exception: ledger append failed' });
    return json({ status: 'ok', rev: saved._rev });
  }
  server.gets++; await sleep(server.latencyMs);
  if (server.getFailOnce) { server.getFailOnce = false; return html404(); }
  if (!server.state) return json({ status: 'error', reason: 'familyNotFound' });
  return json({ ...JSON.parse(JSON.stringify(server.state)), history: {}, netWorthHistory: {} });
};
w.Chart = function () { this.destroy = () => {}; this.data = { datasets: [{}], labels: [] }; this.update = () => {}; };
w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
const results = []; const check = (name, ok, detail) => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  — ' + detail : '')); };
const E = code => w.eval(code); const S = () => E('state');
const toasts = [];
const sc = w.document.createElement('script'); sc.textContent = fs.readFileSync(path.join(REPO, 'app.js'), 'utf8'); w.document.body.appendChild(sc);
try { E('state'); } catch (e) { console.log('FAIL app.js load: ' + e.message); process.exit(1); }
const origToast = w.showToast; w.showToast = (m, t, ms) => { toasts.push(String(t) + ': ' + m); return origToast(m, t, ms); };

(async () => {
  await sleep(400);
  // ---- synthetic family, mirrored on the fake server ------------------------------------
  w.localStorage.setItem('fb_familyId', 'fam_test');
  E("state.users=['Alice','Cora']; state.roles={Alice:'parent',Cora:'child'}; state.pins={Alice:'1111',Cora:'2222'}; state.config.parentChildren={Alice:['Cora']}; state.config.autoLogout=0; state.history={};");
  S().children = { Cora: { balances: { checking: 100, savings: 50 }, rates: { checking: 10, savings: 10 }, autoDeposit: { checking: 0, savings: 0 }, chores: [], pendingDeposits: [], pendingWithdrawals: [], goals: [], loans: [] } };
  server.state = JSON.parse(JSON.stringify({ ...S() })); delete server.state.history; server.state._savedAt = new Date(Date.now() - 60000).toISOString();
  E("currentUser='Alice'; currentRole='parent'; activeChild='Cora';");
  const chk = () => S().children.Cora.balances.checking; const sav = () => S().children.Cora.balances.savings;
  const srvChk = () => server.state.children.Cora.balances.checking; const srvSav = () => server.state.children.Cora.balances.savings;

  // ---- T1: two saves 0.6 s apart; the second must survive the first one's reload ----------
  console.log('T1 running (~10 s)…');
  S().children.Cora.balances.checking += 1; w.syncToCloud('T1-A');
  await sleep(3000);   // A's POST has resolved (~2.1 s); its reload fires at ~3.9 s — B lands in between, like a second tap
  S().children.Cora.balances.checking += 1; w.syncToCloud('T1-B');
  await sleep(8000);
  check('T1 BUG-B: a second save made inside the first save\'s reload window is kept locally', chk() === 102, 'local checking=' + chk());
  check('T1 BUG-B: second save reached the server', srvChk() === 102, 'server checking=' + srvChk() + ', posts=' + server.posts);
  check('T1 BUG-B: a reload still applies when nothing newer exists (server-side field visible)', S().config.serverTouched === server.state.config.serverTouched, 'local=' + S().config.serverTouched + ' server=' + server.state.config.serverTouched);

  // ---- T1b: second save while the first save's POST is still in flight (audit #1) ----------
  console.log('T1b running (~10 s)…');
  server.postLatencyMs = 1500;
  S().children.Cora.balances.checking += 1; w.syncToCloud('T1b-A');   // POST goes out at ~2.0 s, resolves ~3.5 s
  await sleep(2300);                                                   // B is requested 0.3 s after A's POST left
  S().children.Cora.balances.checking += 1; w.syncToCloud('T1b-B');
  await sleep(8000); server.postLatencyMs = null;
  check('T1b BUG-B: a save requested during the previous POST is kept locally', chk() === 104, 'local checking=' + chk());
  check('T1b BUG-B: and reached the server', srvChk() === 104, 'server checking=' + srvChk());

  // ---- T2: reply lost (404 HTML) after the server saved ------------------------------------
  console.log('T2 running (~5 s)…');
  toasts.length = 0; server.mode = 'lost';
  S().children.Cora.balances.savings += 5; const t2 = await w.syncToCloud('T2'); server.mode = 'ok';
  check('T2 BUG-A: lost reply is verified via _savedAt and resolves ok', !!(t2 && t2.status === 'ok' && t2.verified === true), JSON.stringify(t2));
  check('T2 BUG-A: no "Save failed" toast for a save that landed', !toasts.some(t => /Save failed|Sync error/.test(t)), toasts.join(' | '));
  check('T2 BUG-A: server has the change', srvSav() === 55, 'server savings=' + srvSav());
  await sleep(2500);

  // ---- T2d (v39): a save queued right after a lost reply must not be refused as stale -------
  console.log('T2d running (~8 s)…');
  toasts.length = 0; server.mode = 'lost';
  S().children.Cora.balances.savings += 1; const p1 = w.syncToCloud('T2d-A'); server.mode = 'ok';
  await sleep(2200);                                                   // A's POST is out; its reply will be "lost" and verified; the reload has not run
  S().children.Cora.balances.savings += 1; const t2d = await w.syncToCloud('T2d-B'); await p1;
  check('T2d v39: after a lost reply the verified rev is picked up, so the next save is accepted', !!(t2d && t2d.status === 'ok') && server.staleRefusals === 0 && !toasts.some(t => /Someone else saved first|Save failed/.test(t)), JSON.stringify(t2d) + ' refusals=' + server.staleRefusals + ' ' + toasts.join(' | '));
  await sleep(2500);

  // ---- T2b: the verification GET is lost once, too (audit #2) --------------------------------
  console.log('T2b running (~9 s)…');
  toasts.length = 0; server.mode = 'lost'; server.getFailOnce = true;
  S().children.Cora.balances.savings += 2; const t2b = await w.syncToCloud('T2b'); server.mode = 'ok';
  check('T2b BUG-A: verification retries after a lost check and still confirms', !!(t2b && t2b.status === 'ok' && t2b.verified === true) && !toasts.some(t => /Save failed/.test(t)), JSON.stringify(t2b) + ' ' + toasts.join(' | '));
  await sleep(2500);

  // ---- T2c: doPost threw after saving ({error} shape, audit #7) -------------------------------
  console.log('T2c running (~5 s)…');
  toasts.length = 0; server.mode = 'threw';
  S().children.Cora.balances.savings += 1; const t2c = await w.syncToCloud('T2c'); server.mode = 'ok';
  check('T2c {error} reply: save confirmed, warning shown with the server text', !!(t2c && t2c.status === 'ok') && toasts.some(t => /Saved, but the server reported: Exception: ledger append failed/.test(t)), JSON.stringify(t2c) + ' ' + toasts.join(' | '));
  await sleep(2500);

  // ---- T3: a real server rejection is still reported ----------------------------------------
  console.log('T3 running (~3 s)…');
  toasts.length = 0; server.mode = 'reject';
  S().children.Cora.balances.savings += 1; const t3 = await w.syncToCloud('T3'); server.mode = 'ok';
  check('T3 rejection still shows "Save failed (reason)"', toasts.some(t => /Save failed \(familyNotFound\)/.test(t)), toasts.join(' | '));
  check('T3 rejection resolves with the error shape', !!(t3 && t3.status === 'error'), JSON.stringify(t3));
  await sleep(2500);

  // ---- T6: a save that truly failed must still converge to the server (re-check #1) ----------
  console.log('T6 running (~20 s)…');
  toasts.length = 0; server.mode = 'drop';
  const beforeSav = sav(); S().children.Cora.balances.savings += 7; const t6 = await w.syncToCloud('T6'); server.mode = 'ok';
  check('T6 dropped save reports failure', !!toasts.some(t => /Save failed/.test(t)) && !(t6 && t6.status === 'ok'), toasts.join(' | '));
  await sleep(3500);
  check('T6 the post-failure reload converges the screen to the server', sav() === beforeSav && sav() === srvSav(), 'local=' + sav() + ' server=' + srvSav());


  // ---- T7 (v39): revision bookkeeping and a stale refusal ---------------------------------
  console.log('T7 running (~8 s)…');
  check('T7 v39: every accepted save carried the current base and the client tracks the server rev', server.staleRefusals === 0 && S()._rev === server.state._rev && server.state._rev > 5, 'local _rev=' + S()._rev + ' server _rev=' + server.state._rev);
  toasts.length = 0;
  server.state._rev += 3;                                            // another device saved three times behind our back
  const srvChkBefore = srvChk(); server.state.children.Cora.balances.checking = 777;
  S().children.Cora.balances.checking = 1; const t7 = await w.syncToCloud('T7');
  await sleep(2500);
  check('T7 v39: a stale save is refused, nothing overwritten on the server', server.staleRefusals === 1 && srvChk() === 777 && !!(t7 && t7.reason === 'stale'), JSON.stringify(t7) + ' server=' + srvChk());
  check('T7 v39: the screen is refreshed from the server and the person is told', chk() === 777 && S()._rev === server.state._rev && toasts.some(t => /Someone else saved first/.test(t)), 'local=' + chk() + ' rev=' + S()._rev + ' ' + toasts.join(' | '));
  S().children.Cora.balances.checking = 778; const t7b = await w.syncToCloud('T7b');
  check('T7 v39: the next save goes through on the fresh base', !!(t7b && t7b.status === 'ok') && srvChk() === 778, JSON.stringify(t7b) + ' server=' + srvChk());

  // ---- T8 (v39-19): a save queued behind a refused one is dropped; the screen is redrawn -------
  console.log('T8 running (~8 s)…');
  toasts.length = 0; let redraws = 0; const origRPC = w.renderParentChores; w.renderParentChores = function () { redraws++; return origRPC.apply(this, arguments); };
  server.state._rev += 1; server.state.children.Cora.balances.checking = 500;       // another device saved
  const posts8 = server.posts;
  S().children.Cora.balances.checking += 5; const a8 = w.syncToCloud('T8-A');
  await sleep(500);
  S().children.Cora.balances.savings += 7; const b8 = w.syncToCloud('T8-B');         // a second tap, queued behind A
  const r8a = await a8; const r8b = await b8; await sleep(2500);
  check('T8 v39: the refused save and the save queued behind it are not saved (no phantom save)', !!(r8a && r8a.reason === 'stale' && r8b && r8b.reason === 'dropped') && server.posts === posts8 && srvChk() === 500, JSON.stringify(r8a) + ' ' + JSON.stringify(r8b) + ' posts+' + (server.posts - posts8) + ' server=' + srvChk());
  check('T8 v39: the screen is back to the server state, redrawn, and the person is told', chk() === 500 && sav() === srvSav() && S()._rev === server.state._rev && redraws > 0 && toasts.some(t => /Someone else saved first/.test(t)), 'local=' + chk() + '/' + sav() + ' server=' + srvChk() + '/' + srvSav() + ' redraws=' + redraws + ' ' + toasts.join(' | '));
  w.renderParentChores = origRPC;

  // ---- T9 (v39-19): "busy" takes the change back, so a retry can't double-credit --------------
  console.log('T9 running (~8 s)…');
  toasts.length = 0; server.mode = 'busy'; const before9 = srvChk();
  S().children.Cora.balances.checking += 20; const r9 = await w.syncToCloud('T9'); server.mode = 'ok'; await sleep(1500);
  check('T9 v39: busy → nothing saved, the change is taken back on screen, the person is told', !!(r9 && r9.reason === 'busy') && srvChk() === before9 && chk() === before9 && toasts.some(t => /bank was busy/.test(t)), JSON.stringify(r9) + ' server=' + srvChk() + ' local=' + chk() + ' ' + toasts.join(' | '));
  S().children.Cora.balances.checking += 20; const r9b = await w.syncToCloud('T9b');
  check('T9 v39: the retry is saved once (no double credit)', !!(r9b && r9b.status === 'ok') && srvChk() === before9 + 20, JSON.stringify(r9b) + ' server=' + srvChk());

  // ---- T10 (v39-20): a lost save is not "confirmed" by another device's later save ------------
  console.log('T10 running (~10 s)…');
  toasts.length = 0; server.mode = 'drop';
  S().children.Cora.balances.checking += 3; const p10 = w.syncToCloud('T10');       // POST lost and NOT saved
  await sleep(2300); server.mode = 'ok';
  server.state = JSON.parse(JSON.stringify(server.state)); server.state._rev += 1; server.state._savedAt = new Date().toISOString(); server.state.children.Cora.balances.checking = 90;   // the tablet saves before our check
  const r10 = await p10; await sleep(1500);
  check('T10 v39: a lost save is reported as not saved when another device saved later, and the screen shows the server', !(r10 && r10.status === 'ok') && toasts.some(t => /Save failed/.test(t)) && srvChk() === 90 && chk() === 90 && S()._rev === server.state._rev, JSON.stringify(r10) + ' server=' + srvChk() + ' local=' + chk() + ' ' + toasts.join(' | '));

  // ---- T11 (v39-20): a server job that saved after our lost-reply save is not overwritten -----
  console.log('T11 running (~12 s)…');
  toasts.length = 0; server.mode = 'lost';
  S().children.Cora.balances.savings += 1; const p11 = w.syncToCloud('T11');        // saved, reply lost
  await sleep(2300); server.mode = 'ok';
  server.state._rev += 1; server.state.children.Cora.balances.checking += 10;       // Monday allowance right after our save — it keeps our _savedAt
  const allowance11 = srvChk();
  const r11 = await p11;
  S().children.Cora.balances.savings += 1; const r11b = await w.syncToCloud('T11b'); await sleep(1500);
  check('T11 v39: our save is confirmed, and the next save does not overwrite the allowance saved after it', !!(r11 && r11.status === 'ok') && srvChk() === allowance11 && chk() === allowance11, JSON.stringify(r11) + ' ' + JSON.stringify(r11b) + ' server=' + srvChk() + ' expected=' + allowance11 + ' local=' + chk());

  // ---- T12 (v39-21): coming back to the app pulls the server copy, so the next tap isn't stale --
  console.log('T12 running (~6 s)…');
  toasts.length = 0; let redraws12 = 0; const origRPC12 = w.renderParentChores; w.renderParentChores = function () { redraws12++; return origRPC12.apply(this, arguments); };
  server.state._rev += 1; server.state.children.Cora.balances.checking = 600;      // Monday allowance ran while the phone was asleep
  w.eval('_lastLoadAt = 0'); w.document.dispatchEvent(new w.Event('visibilitychange')); await sleep(800);
  check('T12 v39: back on screen → server copy loaded and redrawn', chk() === 600 && S()._rev === server.state._rev && redraws12 > 0, 'local=' + chk() + ' rev=' + S()._rev + '/' + server.state._rev + ' redraws=' + redraws12);
  S().children.Cora.balances.checking += 1; const r12 = await w.syncToCloud('T12');
  check('T12 v39: the next tap is accepted (not refused as stale)', !!(r12 && r12.status === 'ok') && srvChk() === 601 && !toasts.some(t => /Someone else/.test(t)), JSON.stringify(r12) + ' ' + toasts.join(' | '));
  const gets12 = server.gets; S().children.Cora.balances.checking += 1; const p12 = w.syncToCloud('T12b');
  w.eval('_lastLoadAt = 0'); w.document.dispatchEvent(new w.Event('visibilitychange')); await p12;
  check('T12 v39: no refresh while a save is queued (the save is not wiped)', srvChk() === 602 && server.gets === gets12, 'server=' + srvChk() + ' gets+' + (server.gets - gets12));
  w.renderParentChores = origRPC12; await sleep(2200);

  // ---- T4: the service worker precaches past the HTTP cache ---------------------------------
  const sw = fs.readFileSync(path.join(REPO, 'service-worker.js'), 'utf8');
  check('T4 SW install precaches per file with cache:\'reload\'', /Promise\.allSettled\(CORE_ASSETS\.map\(u => c\.add\(new Request\(u, \{ cache: 'reload' \}\)\)\)\)/.test(sw));
  check('T4 SW revalidates same-origin files with cache:\'no-cache\' and never stores redirects', /new Request\(req, \{ cache: 'no-cache' \}\)/.test(sw) && /fetch\(refresh\)/.test(sw) && /!res\.redirected/.test(sw));
  const app = fs.readFileSync(path.join(REPO, 'app.js'), 'utf8');
  check('T5 chore wizard fan-out never lets a post-save reload behind its back', /skipReload:true\}\);/.test(app) && /loadFromCloud\(\{ifGen:_g\}\)/.test(app));

  const fails = results.filter(r => !r.ok).length;
  console.log('\nDONE — ' + (results.length - fails) + '/' + results.length + ' PASS' + (fails ? ', ' + fails + ' FAIL' : ''));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL harness error: ' + (e.stack || e)); process.exit(1); });
