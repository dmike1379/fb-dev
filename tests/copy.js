// v38.4 harness — chore wizard "copy as template" + whole-child copy, against the real
// index.html + app.js in jsdom (no network: syncToCloud stubbed). Drives the wizard through its
// public step hooks the same way the UI does (wzChooseIdx / wzPrimary / cwReview* handlers).
// Usage: TZ=America/Chicago node copy.js /path/to/repo   → PASS/FAIL lines + "DONE — n/m PASS"
const fs = require('fs'); const path = require('path');
const { JSDOM } = require('jsdom');
const REPO = process.argv[2] || require('path').resolve(__dirname, '..');
const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8')
  .replace(/<script src="vendor\/chart.umd.min.js"><\/script>/, '')
  .replace(/<script src="app.js"><\/script>/, '');
const dom = new JSDOM(html, { url: 'https://dmike1379.github.io/fb-dev/', runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;
w.fetch = async () => ({ json: async () => ({ status: 'error', reason: 'familyNotFound' }), text: async () => '{}', status: 200, ok: true, url: '' });
w.Chart = function(){ this.destroy=()=>{}; this.data={datasets:[{}],labels:[]}; this.update=()=>{}; };
w.scrollTo = () => {}; w.matchMedia = () => ({ matches:false, addListener(){}, addEventListener(){} });
const E = (code) => w.eval(code); const S = () => E('state');
const results = []; const check = (name, ok, detail) => { results.push({name, ok}); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  — ' + detail : '')); };
w.addEventListener('error', e => console.log('window error: ' + e.message));
const sc = w.document.createElement('script'); sc.textContent = fs.readFileSync(path.join(REPO, 'app.js'), 'utf8'); w.document.body.appendChild(sc);
try { E('state'); } catch (e) { console.log('FAIL app.js load: ' + e.message); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cur = () => E('wz && wzCur() ? wzCur().id : null');
const D = () => E('wz.draft');
const body = () => w.document.getElementById('wz2-body').textContent.replace(/\s+/g, ' ').trim();
const foot = () => w.document.getElementById('wz2-footer').textContent.replace(/\s+/g, ' ').trim();
const pick = (v) => { const s = E('wzCur()'); const i = s.options.findIndex(o => o.v === v); if (i === -1) throw new Error('no option ' + v + ' on ' + s.id); w.wzChooseIdx(i); };
const kid = (chores) => ({ balances: { checking: 10, savings: 5 }, rates: { checking: 0, savings: 0 }, autoDeposit: { checking: 0, savings: 0 },
  chores, pendingDeposits: [], pendingWithdrawals: [], goals: [], loans: [] });
const coraChores = () => [
  { id: 'c1', name: 'Make bed', desc: 'Every morning', schedule: 'daily', status: 'available', amount: 1, splitChk: 50, childChooses: true, reminderHour: 8, streakCount: 4, streakStart: 3, streakMilestone: 5, streakReward: 2, completedBy: null },
  { id: 'c2', name: 'Feed the dog', schedule: 'weekly', weekdays: [1, 3], weekday: 1, status: 'pending', completedBy: 'Cora', completedAt: 'x', amount: 2, splitChk: 100, requiresProof: true },
];

(async () => {
  await sleep(300);
  E("state.users=['Alice','Cora']; state.roles={Alice:'parent',Cora:'child'}; state.pins={Alice:'1111',Cora:'2222'}; state.config.parentChildren={Alice:['Cora']}; state.config.autoLogout=0; state.history={};");
  S().children = { Cora: kid(coraChores()) };
  E("currentUser='Alice'; currentRole='parent'; activeChild='Cora';");
  const posted = [];
  w.syncToCloud = async (action, opts) => { posted.push({ action, opts, state: JSON.parse(JSON.stringify(S())) }); return { status: 'ok' }; };
  w.localStorage.removeItem('fb_cw_draft');

  // ── C1: one-child family now sees the copy question (own chores are templates) ─────────────
  w.cwOpenAdd('Cora');
  const IDX = { review: E('wzStepIndexById("review")'), copySelect: E('wzStepIndexById("copySelect")'), cReward: E('wzStepIndexById("cReward")') };
  const primaryDisabled = () => { const b = w.document.getElementById('wz-primary'); return !!(b && b.disabled); };
  check('C1 one-child family is asked about copying (own chores count)', cur() === 'copyAsk', 'step=' + cur());
  check('C1 question wording', /Copy a chore that's already set up\?/.test(body()) && /start from an existing chore/.test(body()) && /start from scratch/.test(body()), body().slice(0, 160));

  // ── C2: "Yes" with a single source skips the which-child question ─────────────────────────
  pick('copy');
  check('C2 single source: copySource skipped, lands on the chore list', cur() === 'copySelect', 'step=' + cur());
  check('C2 source auto-picked = the child', D().copyFrom === 'Cora', 'copyFrom=' + D().copyFrom);
  check('C2 list shows both chores + Copy all', /Copy all \(2\)/.test(body()) && /Make bed/.test(body()) && /Feed the dog/.test(body()), body().slice(0, 200));

  // ── C3: Continue with nothing selected is refused; select one → Review with an editable copy ──
  w.wzPrimary();
  check('C3 Continue with nothing selected stays put', cur() === 'copySelect', 'step=' + cur());
  w.cwCopyToggle('c1'); w.wzPrimary();
  check('C3 lands on Review (assign skipped with one child)', cur() === 'review', 'step=' + cur());
  const d3 = D();
  check('C3 copy is a real staged chore with " (copy)" (same child) and its origin', d3.chores.length === 1 && d3.chores[0].name === 'Make bed (copy)' && d3.chores[0]._from === 'Cora' && d3.chores[0]._srcId === 'c1', JSON.stringify(d3.chores.map(c => c.name)));
  check('C3 copy never carries streak credit / status', d3.chores[0].streakStart === 0 && d3.chores[0].paused === false && d3.chores[0].id === undefined && d3.chores[0].streakCount === undefined, JSON.stringify(d3.chores[0]));
  check('C3 Review shows origin + Edit/Remove + add-another; no old copy link', /copied from Cora/.test(body()) && /Edit/.test(body()) && /Remove/.test(body()) && /\+ Add another chore/.test(body()) && !/Change which chores are copied/.test(body()), body().slice(0, 300));
  check('C3 footer offers Create 1 chore, enabled', /Create 1 chore\b/.test(foot()) && !primaryDisabled(), foot());

  // ── C4: Edit the copy from Review: prefilled, rename, save → back at Review renamed ────────
  w.cwReviewEditChore(0);
  check('C4 Edit opens the name step prefilled', cur() === 'cName' && D().cName === 'Make bed (copy)' && D().cDesc === 'Every morning', 'step=' + cur() + ' cName=' + D().cName);
  D().cName = 'Tidy room';
  const addAnother = E('wz.steps.find(s=>s.id==="addAnother")');
  addAnother.beforePick('done');            // exactly what tapping "Save changes" does
  check('C4 saved edit returns to Review with the new name', cur() === 'review' && D().chores.length === 1 && D().chores[0].name === 'Tidy room' && D().chores[0].amount === 1, 'step=' + cur() + ' ' + JSON.stringify(D().chores.map(c => c.name)));
  check('C4 edited copy loses the "copied from" tag', !/copied from/.test(body()), body().slice(0, 200));

  // ── C5: Back from Review → the copy question again; "Yes" again adds only NEW picks ───────
  w.wzBack();
  check('C5 Back from Review returns to the copy question', cur() === 'copyAsk', 'step=' + cur());
  pick('copy');
  check('C5 re-answering Yes reopens the list', cur() === 'copySelect' && D().copySel.length === 0, 'step=' + cur());
  w.cwCopyToggle('c2'); w.wzPrimary();
  check('C5 second pick is appended after the edited copy', cur() === 'review' && D().chores.length === 2 && D().chores[1].name === 'Feed the dog (copy)' && D().chores[1]._srcId === 'c2', JSON.stringify(D().chores.map(c => c.name)));
  w.wzBack(); pick('copy'); w.cwCopyAll(); w.wzPrimary();
  check('C5 Copy all skips a source already staged unedited; the renamed one may be copied afresh', D().chores.length === 3 && D().chores.map(c => c.name).join('|') === 'Tidy room|Feed the dog (copy)|Make bed (copy)', JSON.stringify(D().chores.map(c => c.name)));

  // ── C6: commit — created chores are clean (no review markers), sources untouched ───────────
  posted.length = 0;
  await w.cwCommit(); await sleep(50);
  const cora = S().children.Cora.chores;
  check('C6 commit created 3 chores for Cora (5 total) in one POST', cora.length === 5 && posted.length === 1, 'chores=' + cora.length + ' posts=' + posted.length);
  const made = cora.slice(2);
  check('C6 created chores carry no _from/_srcId and have fresh instance fields', made.every(c => c._from === undefined && c._srcId === undefined && /^chore_/.test(c.id) && c.status === 'available' && c.streakCount === 0), JSON.stringify(made.map(c => Object.keys(c).filter(k => k[0] === '_'))));
  const dog = made.find(c => c.name === 'Feed the dog (copy)');
  check('C6 copied fields survived (weekdays, proof, split)', !!dog && JSON.stringify(dog.weekdays) === '[1,3]' && dog.requiresProof === true && dog.splitChk === 100, JSON.stringify(dog));
  check('C6 source chores untouched (streak, pending status)', cora[0].streakCount === 4 && cora[1].status === 'pending', JSON.stringify(cora.slice(0, 2).map(c => [c.streakCount, c.status])));
  check('C6 success screen', cur() === 'success' && /3 chores created for Cora/.test(body()), body().slice(0, 120));
  w.cwSuccessDone();

  // ── C7: two sources → the which-child question shows, own child marked ──────────────────
  S().children.Cora.chores = coraChores();
  S().users.push('Finn'); S().roles.Finn = 'child'; S().pins.Finn = '3333'; S().config.parentChildren.Alice.push('Finn');
  S().children.Finn = kid([{ id: 'f1', name: 'Water plants', schedule: 'weekly', weekdays: [2], weekday: 2, status: 'available', amount: 0.5, splitChk: 50 }]);
  w.localStorage.removeItem('fb_cw_draft');
  w.cwOpenAdd('Cora'); pick('copy');
  check('C7 two sources: which-child question shows, current child first and marked', cur() === 'copySource' && /Cora.*same child/.test(body()) && /Finn/.test(body()), 'step=' + cur() + ' ' + body().slice(0, 160));
  pick('Finn'); w.cwCopyToggle('f1'); w.wzPrimary();
  check('C7 copy from another child keeps the name (no " (copy)") and goes to assign', cur() === 'assign' && D().chores[0].name === 'Water plants' && D().chores[0]._from === 'Finn', 'step=' + cur() + ' ' + JSON.stringify(D().chores.map(c => c.name)));
  w.wzClose(); w.localStorage.removeItem('fb_cw_draft');

  // ── C8: whole-child copy opens AT Review with every chore of the source staged ─────────────
  S().users.push('Nell'); S().roles.Nell = 'child'; S().pins.Nell = '4444'; S().config.parentChildren.Alice.push('Nell');
  S().children.Nell = kid([]);
  w.localStorage.setItem('fb_cw_draft', JSON.stringify({ k: 'chore', mode: 'add', editName: null, idx: 5, draft: { child: 'Cora', chores: [{ name: 'Stale draft' }] }, ts: Date.now() }));
  w.cwOpenAdd('Nell', { copyFrom: 'Cora' });
  check('C8 opens at Review (a stale saved draft is not offered)', cur() === 'review', 'step=' + cur());
  check('C8 all of the source chores are staged, names unchanged, origin shown', D().chores.length === 2 && D().chores.every(c => c._from === 'Cora') && D().chores[0].name === 'Make bed' && /copied from Cora/.test(body()), JSON.stringify(D().chores.map(c => c.name)));
  check('C8 rewards-on child keeps the template\'s amount and streak bonus (never its streak credit)', D().chores[0].amount === 1 && D().chores[0].streakMilestone === 5 && D().chores[0].streakReward === 2 && D().chores[0].streakStart === 0 && /streak every 5 → \$2\.00/.test(body()), JSON.stringify([D().chores[0].amount, D().chores[0].streakMilestone, D().chores[0].streakReward, D().chores[0].streakStart]));
  check('C8 For: the new child; footer Create 2 chores', /For\s*Nell/.test(body()) && /Create 2 chores/.test(foot()), body().slice(0, 80) + ' | ' + foot());
  w.cwReviewRemoveChore(1);
  check('C8 Remove works on a staged copy', D().chores.length === 1 && /Create 1 chore\b/.test(foot()), foot());
  posted.length = 0; await w.cwCommit(); await sleep(50);
  check('C8 commit creates the kept chore for the new child only', S().children.Nell.chores.length === 1 && S().children.Nell.chores[0].name === 'Make bed' && S().children.Cora.chores.length === 2 && posted[0].opts.activeChild === 'Nell', JSON.stringify(S().children.Nell.chores.map(c => c.name)));
  w.cwSuccessDone();

  // ── C9: untouched whole-child copy closed with ✕ leaves no draft behind ───────────────────
  w.localStorage.removeItem('fb_cw_draft');
  w.cwOpenAdd('Nell', { copyFrom: 'Cora' }); w.wzClose();
  check('C9 closing an untouched whole-child copy stores no draft', w.localStorage.getItem('fb_cw_draft') === null);
  S().children.Finn.chores = [];
  w.cwOpenAdd('Nell', { copyFrom: 'Finn' });
  check('C9 a source without chores falls back to a plain start', cur() !== 'review' && D().chores.length === 0 && E('wz.meta.presetCopyFrom') === null, 'step=' + cur());
  w.wzClose();
  w.cwOpenAdd('Nell', { copyFrom: 'Alice' });
  check('C9 a non-child source falls back to a plain start', cur() !== 'review' && D().chores.length === 0 && E('wz.meta.presetCopyFrom') === null, 'step=' + cur());
  w.wzClose();
  E("state.config.notify = { Nell: { choreRewards:false } };");   // rewards switched off for Nell
  w.cwOpenAdd('Nell', { copyFrom: 'Cora' });
  check('C9 rewards-off child: copied chores are staged at $0 with no streak bonus (v38.5-1)', cur() === 'review' && D().chores.length === 2 && D().chores.every(c => c.amount === 0 && !c.streakMilestone && !c.streakReward) && !/streak every/.test(body()), JSON.stringify(D().chores.map(c => [c.amount, c.streakMilestone, c.streakReward])));
  w.wzClose(); E("state.config.notify = {};");

  // ── C10: user wizard success screen offers the whole-child copy only when settings were copied ─
  E("wz = { kind:'user', mode:'add', idx:0, steps:[], draft:{ role:'child', _copied:true, copyFrom:'Cora' }, meta:{ name:'Nell' } };");
  let h = w.uwSuccessRender();
  check('C10 success offers "Copy Cora\'s chores to Nell" (2 chores) + Create + Done', /Copy Cora&#39;s chores to Nell|Copy Cora's chores to Nell/.test(h) && /2 chores — you can adjust them first/.test(h) && /Create chores for Nell now/.test(h) && /uwSuccessChores\(true\)/.test(h), h.replace(/\s+/g, ' ').slice(0, 300));
  E("wz.draft = { role:'child', _copied:false, copyFrom:undefined };");
  h = w.uwSuccessRender();
  check('C10 no copy offer without copied settings', !/chores to Nell/.test(h) && /Create chores for Nell now/.test(h));
  E("wz.draft = { role:'child', _copied:true, copyFrom:'Nell' };");   // source with no chores
  E("state.children.Nell.chores = [];");
  h = w.uwSuccessRender();
  check('C10 no copy offer when the source child has no chores', !/chores to Nell/.test(h));
  E("wz = null;");

  // ── C12 (audit M1): Remove-all then Back can never stage a nameless chore ─────────────────
  E("state.children.Nell.chores = [];"); w.localStorage.removeItem('fb_cw_draft');
  w.cwOpenAdd('Nell', { copyFrom: 'Cora' });
  w.cwReviewRemoveChore(1); w.cwReviewRemoveChore(0);
  check('C12 Review empty after removing every copy, Create disabled (v38.4-2)', cur() === 'review' && D().chores.length === 0 && primaryDisabled(), foot() + ' disabled=' + primaryDisabled());
  w.wzBack();
  check('C12 Back from an empty Review never lands on the "is ready" step', cur() !== 'addAnother', 'step=' + cur());
  const aa = E('wz.steps.find(s=>s.id==="addAnother")');
  aa.beforePick('done');                     // even if it were reached: nothing nameless gets staged
  w.wzGotoId('review');
  check('C12 a blank chore is never staged (guard in cwStageCur)', D().chores.length === 0 && /No chores yet/.test(body()) && primaryDisabled(), 'chores=' + D().chores.length + ' step=' + cur());
  w.wzClose(); w.localStorage.removeItem('fb_cw_draft');

  // ── C13 (audit L1): an untouched whole-child copy leaves an unrelated stored draft alone ──
  const other = JSON.stringify({ k: 'chore', mode: 'add', editName: null, idx: 6, draft: { ...E('cwBlankDraft()'), child: 'Cora', copyChoice: 'manual', cName: 'Half-typed chore' }, ts: Date.now() });
  w.localStorage.setItem('fb_cw_draft', other);
  w.cwOpenAdd('Nell', { copyFrom: 'Cora' }); w.wzClose();
  check('C13 stored draft survives an untouched whole-child copy closed with ✕', w.localStorage.getItem('fb_cw_draft') === other);
  w.cwOpenAdd('Nell', { copyFrom: 'Cora' }); w.cwReviewRemoveChore(1); w.wzClose();
  check('C13 once something is changed, the whole-child draft is the stored one (documented trade-off)', JSON.parse(w.localStorage.getItem('fb_cw_draft')).draft.chores.length === 1);
  w.localStorage.setItem('fb_cw_draft', other);
  w.cwOpenAdd('Nell', { copyFrom: 'Cora' }); posted.length = 0; await w.cwCommit(); await sleep(50);
  check('C13 committing an untouched whole-child copy leaves the stored draft alone (final audit #1)', E('wz.meta.committed') === true && w.localStorage.getItem('fb_cw_draft') === other && S().children.Nell.chores.length === 2, 'stored=' + (w.localStorage.getItem('fb_cw_draft') === other) + ' nell=' + S().children.Nell.chores.length);
  w.cwSuccessDone(); E("state.children.Nell.chores = [];");
  w.localStorage.setItem('fb_cw_draft', other);
  w.cwOpenAdd('Nell', { copyFrom: 'Cora' }); w.wzBack(); w.cwAssignAll(); w.cwAssignAll(); w.wzClose();   // touched then put back = draft equals pristine again
  check('C13 a draft that was written once is owned: ✕ clears it instead of leaving a stale copy (final audit #2)', w.localStorage.getItem('fb_cw_draft') === null);
  w.localStorage.removeItem('fb_cw_draft');

  // ── C14 (audit L2): a v38.3 copy-branch draft resumes with its picks staged ────────────────
  const legacy = { ...E('cwBlankDraft()'), child: 'Cora', copyChoice: 'copy', copyFrom: 'Cora', _copyFromPrev: 'Cora', copySel: ['c2'], chores: [] }; delete legacy._copyDone;
  w.localStorage.setItem('fb_cw_draft', JSON.stringify({ k: 'chore', mode: 'add', editName: null, idx: IDX.review, draft: legacy, ts: Date.now() }));
  w.cwOpenAdd('Cora'); w.cwResumeDraft();
  check('C14 legacy draft: the selected chore is staged, Review shows it', cur() === 'review' && D().chores.length === 1 && D().chores[0].name === 'Feed the dog (copy)' && D()._copyDone === true, 'step=' + cur() + ' ' + JSON.stringify(D().chores.map(c => c.name)));
  w.wzClose(); w.localStorage.removeItem('fb_cw_draft');

  // ── C15 (audit L4): the copy source vanished → the question is asked again ─────────────────
  S().children.Finn.chores = [{ id: 'f1', name: 'Water plants', schedule: 'weekly', weekdays: [2], weekday: 2, status: 'available', amount: 0.5, splitChk: 50 }];
  const parked = { ...E('cwBlankDraft()'), child: 'Cora', copyChoice: 'copy', copyFrom: 'Finn', _copyFromPrev: 'Finn', copySel: ['f1'], _copyDone: false };
  w.localStorage.setItem('fb_cw_draft', JSON.stringify({ k: 'chore', mode: 'add', editName: null, idx: IDX.copySelect, draft: parked, ts: Date.now() }));
  S().children.Finn.chores = [];             // Finn's chores deleted before the parent comes back
  w.cwOpenAdd('Cora'); w.cwResumeDraft();
  check('C15 vanished source: back at the copy question, nothing stranded', cur() === 'copyAsk' && D().copyFrom === null && D().copyChoice === undefined, 'step=' + cur());
  w.wzClose(); w.localStorage.removeItem('fb_cw_draft');

  // ── C16 (audit L5): copies staged for one child are rebuilt when another child is picked ──
  S().children.Finn.chores = []; S().children.Nell.chores = [];
  w.cwOpenAdd(null);                           // three kids, no preset → child question first
  check('C16 child question first', cur() === 'child', 'step=' + cur());
  pick('Cora'); pick('copy'); w.cwCopyToggle('c1'); w.wzPrimary();
  check('C16 own copy for Cora carries " (copy)"', cur() === 'assign' && D().chores[0].name === 'Make bed (copy)' && D().chores[0]._for === 'Cora', JSON.stringify(D().chores.map(c => [c.name, c._for])));
  w.wzBack(); w.wzBack();
  check('C16 Back twice reaches the child question', cur() === 'child', 'step=' + cur());
  pick('Finn');
  check('C16 picking Finn rebuilds the copy for Finn: plain name, still from Cora', D().chores.length === 1 && D().chores[0].name === 'Make bed' && D().chores[0]._for === 'Finn' && D().chores[0]._from === 'Cora' && D().copyFrom === 'Cora', JSON.stringify(D().chores.map(c => [c.name, c._for, c._from])));
  w.wzClose(); w.localStorage.removeItem('fb_cw_draft');

  // ── C17 (audit note): copyFrom without a target child is ignored ───────────────────────────
  w.cwOpenAdd(null, { copyFrom: 'Cora' });
  check('C17 copyFrom without a preset child = plain start', cur() === 'child' && D().chores.length === 0 && E('wz.meta.presetCopyFrom') === null, 'step=' + cur());
  w.wzClose(); w.localStorage.removeItem('fb_cw_draft');

  // ── C19 (re-check): Back alone in a whole-child copy does not overwrite the stored draft ──
  S().children.Cora.chores = coraChores(); S().children.Finn.chores = []; S().children.Nell.chores = [];
  w.localStorage.setItem('fb_cw_draft', other);
  w.cwOpenAdd('Nell', { copyFrom: 'Cora' }); w.wzBack(); w.wzBack(); w.wzClose();
  check('C19 Back, Back, ✕ on an untouched whole-child copy leaves the stored draft alone', w.localStorage.getItem('fb_cw_draft') === other);
  w.localStorage.removeItem('fb_cw_draft');

  // ── C20 (re-check): vanished source handled on the no-preset launch path too ───────────────
  S().children.Finn.chores = [{ id: 'f1', name: 'Water plants', schedule: 'weekly', weekdays: [2], weekday: 2, status: 'available', amount: 0.5, splitChk: 50 }];
  w.localStorage.setItem('fb_cw_draft', JSON.stringify({ k: 'chore', mode: 'add', editName: null, idx: IDX.copySelect, draft: { ...E('cwBlankDraft()'), child: 'Cora', assign: ['Cora'], copyChoice: 'copy', copyFrom: 'Finn', _copyFromPrev: 'Finn', copySel: ['f1'], _copyDone: false }, ts: Date.now() }));
  S().children.Finn.chores = [];
  w.cwOpenAdd(null); w.cwResumeDraft();
  check('C20 no-preset resume with a vanished source lands on the copy question', cur() === 'copyAsk' && D().copyFrom === null && D().copySel.length === 0 && D().child === 'Cora', 'step=' + cur());
  w.wzClose(); w.localStorage.removeItem('fb_cw_draft');
  // stale picks (source still there, one chore deleted) are dropped so Continue can't stage nothing
  w.localStorage.setItem('fb_cw_draft', JSON.stringify({ k: 'chore', mode: 'add', editName: null, idx: IDX.copySelect, draft: { ...E('cwBlankDraft()'), child: 'Cora', assign: ['Cora'], copyChoice: 'copy', copyFrom: 'Cora', _copyFromPrev: 'Cora', copySel: ['c1', 'gone'], _copyDone: false }, ts: Date.now() }));
  w.cwOpenAdd('Cora'); w.cwResumeDraft();
  check('C20 a deleted pick is dropped on resume, the live one kept', cur() === 'copySelect' && JSON.stringify(D().copySel) === '["c1"]', JSON.stringify(D().copySel));
  w.wzClose(); w.localStorage.removeItem('fb_cw_draft');

  // ── C21 (re-check): child switch rebuilds copies in place — order kept, manual chores kept ──
  w.cwOpenAdd(null); pick('Cora'); pick('copy'); w.cwCopyToggle('c1'); w.wzPrimary();   // [copy c1]
  D().chores.push({ name: 'Manual one', schedule: 'once', amount: 0, splitChk: 50 });          // as "+ Add another chore" would
  w.wzBack(); pick('copy'); w.cwCopyToggle('c2'); w.wzPrimary();                                 // [copy c1, manual, copy c2]
  check('C21 setup: copy, manual, copy for Cora', D().chores.map(c => c.name).join('|') === 'Make bed (copy)|Manual one|Feed the dog (copy)', D().chores.map(c => c.name).join('|'));
  w.wzBack(); w.wzBack(); pick('Finn');
  check('C21 after switching to Finn: same order, copies rebuilt plain, manual untouched', D().chores.map(c => c.name).join('|') === 'Make bed|Manual one|Feed the dog' && D().chores[0]._for === 'Finn' && D().chores[2]._for === 'Finn', D().chores.map(c => c.name).join('|'));
  w.wzClose(); w.localStorage.removeItem('fb_cw_draft');

  // ── C22 (re-check): an Edit in progress survives a re-copy ────────────────────────────────
  w.cwOpenAdd('Cora'); pick('copy'); w.cwCopyToggle('c1'); w.wzPrimary();
  w.cwReviewEditChore(0); D().cName = 'Renamed while editing';
  w.wzBack();                                                     // cName → copyAsk (edit still open)
  pick('copy'); w.cwCopyToggle('c2'); w.wzPrimary();
  check('C22 re-copy while editing returns to the open edit', cur() === 'cName' && D().cName === 'Renamed while editing' && D().curIdx === 0 && D().chores.length === 2, 'step=' + cur() + ' curIdx=' + D().curIdx);
  E('wz.steps.find(s=>s.id==="addAnother")').beforePick('done');
  check('C22 saving the edit updates slot 0, the new copy sits in slot 1', cur() === 'review' && D().chores.map(c => c.name).join('|') === 'Renamed while editing|Feed the dog (copy)', D().chores.map(c => c.name).join('|'));
  w.wzClose(); w.localStorage.removeItem('fb_cw_draft');

  // ── C23 (re-check): Back from an empty Review lands on the name step ──────────────────────
  E("state.children.Nell.chores = [];");
  w.cwOpenAdd('Nell', { copyFrom: 'Cora' }); w.cwReviewRemoveChore(1); w.cwReviewRemoveChore(0); w.wzBack();
  check('C23 Back from an empty Review → assign (3 kids)', cur() === 'assign', 'step=' + cur());
  w.wzBack();
  check('C23 Back again lands on a per-chore step, never on \'"" is ready.\'', cur() !== 'addAnother' && cur() !== 'review' && !/is ready/.test(body()), 'step=' + cur());
  w.wzGotoId('review');
  check('C23 nothing got staged on the way', D().chores.length === 0 && primaryDisabled(), foot());
  // progress bar must never move backward on the normal path (name step → reward step)
  w.wzGotoId('cName'); const fillAt = () => parseInt(w.document.getElementById('wz2-progress-fill').style.width, 10);
  const p1 = fillAt(); D().cName = 'Sweep'; w.wzPrimary(); const p2 = fillAt();
  check('C23 progress bar does not move backward after the name step', cur() === 'cReward' && p2 >= p1, 'cName=' + p1 + '% → ' + cur() + '=' + p2 + '%');
  w.wzClose(); w.localStorage.removeItem('fb_cw_draft');

  // ── C24 (re-check): a v38.3 draft parked AT the selection resumes there, not past it ───────
  const legacyMid = { ...E('cwBlankDraft()'), child: 'Cora', copyChoice: 'copy', copyFrom: 'Cora', _copyFromPrev: 'Cora', copySel: ['c1'], chores: [] }; delete legacyMid._copyDone;
  w.localStorage.setItem('fb_cw_draft', JSON.stringify({ k: 'chore', mode: 'add', editName: null, idx: IDX.copySelect, draft: legacyMid, ts: Date.now() }));
  w.cwOpenAdd('Cora'); w.cwResumeDraft();
  check('C24 legacy draft parked at the selection: still selecting, nothing staged yet', cur() === 'copySelect' && D().chores.length === 0 && JSON.stringify(D().copySel) === '["c1"]', 'step=' + cur());
  w.wzClose(); w.localStorage.removeItem('fb_cw_draft');

  // ── C25 (final audit #5): a v38.3 manual draft for a child who has chores resumes where it was ──
  const legacyManual = { ...E('cwBlankDraft()'), child: 'Cora', assign: ['Cora'], cName: 'Half done', cAmount: '2', chores: [] }; delete legacyManual._copyDone; delete legacyManual.copyChoice;
  w.localStorage.setItem('fb_cw_draft', JSON.stringify({ k: 'chore', mode: 'add', editName: null, idx: E('wz ? -1 : -1') === -1 ? IDX.cReward : 0, draft: legacyManual, ts: Date.now() }));
  w.cwOpenAdd('Cora'); w.cwResumeDraft();
  check('C25 legacy manual draft resumes at its step, copy question answered "manual" silently', cur() === 'cReward' && D().copyChoice === 'manual' && D().cName === 'Half done', 'step=' + cur() + ' copyChoice=' + D().copyChoice);
  w.wzClose(); w.localStorage.removeItem('fb_cw_draft');

  // ── C18 (v38.4-2): the user wizard's Review button honours its own disabled state too ─────
  w.localStorage.removeItem('fb_wiz_draft'); w.uwOpenAdd(); w.wzGotoId('review');
  check('C18 user wizard Review with required rows missing: Add button disabled', cur() === 'review' && E('uwInvalidSteps().length') > 0 && primaryDisabled(), foot() + ' disabled=' + primaryDisabled());
  w.wzClose(); w.localStorage.removeItem('fb_wiz_draft');

  // ── C11: no CSS / child-facing surface touched ─────────────────────────────────────────────
  const app = fs.readFileSync(path.join(REPO, 'app.js'), 'utf8');
  check('C11 renderChildChores untouched by v38.4-1', !/v38\.4-1/.test(app.slice(app.indexOf('function renderChildChores('), app.indexOf('function renderChildChores(') + 6000)));

  const fails = results.filter(r => !r.ok).length;
  console.log('\nDONE — ' + (results.length - fails) + '/' + results.length + ' PASS' + (fails ? ', ' + fails + ' FAIL' : ''));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL harness error: ' + (e.stack || e)); process.exit(1); });
