#!/usr/bin/env node
// FamilyBank test runner — `npm test` (all) or `npm run test:quick` (skips the 60 s race harness).
// Runs each harness against THIS repo, streams progress, and ends with one DONE line + exit code.
//   node tests/run.js [--quick] [repo path]
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const quick = args.includes('--quick');
const REPO = args.find(a => !a.startsWith('--')) || path.resolve(__dirname, '..');
const T0 = Date.now();

const SUITES = [
  { name: 'helpers', file: 'unit_helpers.js', expect: /helpers PASS/,      about: 'fmt() / fmtLedgerDate() unit checks',                secs: 1 },
  { name: 'smoke',   file: 'smoke.js',        expect: /DONE — \d+\/\d+ PASS$/, about: 'v38.2 wizard, deny, expired-chore, ledger checks', secs: 5 },
  { name: 'copy',    file: 'copy.js',         expect: /DONE — \d+\/\d+ PASS$/, about: 'v38.4/v38.5 copy-chore and copy-child flows',       secs: 6 },
  { name: 'race',    file: 'race.js',         expect: /DONE — \d+\/\d+ PASS$/, about: 'v38.3 save race + lost-reply verification (real timers)', secs: 60, slow: true },
];

try { require.resolve('jsdom'); }
catch (_) { console.log('jsdom is not installed — run `npm install` once (it only creates node_modules/, which is git-ignored).'); process.exit(2); }

const elapsed = () => ((Date.now() - T0) / 1000).toFixed(1) + 's';
const results = [];
const suites = SUITES.filter(s => !(quick && s.slow));
console.log(`FamilyBank tests — ${suites.length} suite${suites.length === 1 ? '' : 's'}${quick ? ' (quick: race skipped)' : ''} — repo ${REPO}`);
console.log(`ETA ~${suites.reduce((a, s) => a + s.secs, 0)} s. Progress lines follow; the last line always starts with DONE.\n`);

suites.forEach((s, i) => {
  const file = path.join(__dirname, s.file);
  console.log(`[${i + 1}/${suites.length}] ${s.name} — ${s.about} (~${s.secs} s) …`);
  const r = spawnSync(process.execPath, [file, REPO], { cwd: REPO, encoding: 'utf8', env: { ...process.env, TZ: process.env.TZ || 'America/Chicago' }, timeout: 300000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const lines = out.trim().split('\n');
  const last = lines[lines.length - 1] || '';
  const ok = r.status === 0 && s.expect.test(last);
  const fails = lines.filter(l => /^FAIL/.test(l));
  results.push({ name: s.name, ok, last, fails });
  console.log(`      ${ok ? 'PASS' : 'FAIL'} — ${last}   (${elapsed()} elapsed)`);
  if (!ok) { fails.slice(0, 10).forEach(l => console.log('      ' + l)); if (!fails.length) console.log(out.split('\n').slice(-12).join('\n')); }
});

const failed = results.filter(r => !r.ok);
console.log('');
console.log(`DONE — ${results.length - failed.length}/${results.length} suites PASS${failed.length ? ' — FAILED: ' + failed.map(r => r.name).join(', ') : ''} — ${elapsed()}`);
process.exit(failed.length ? 1 : 0);
