// Minimal Google Apps Script environment for running Code.gs in Node (tests only).
// Covers what doGet/doPost, loadState/saveState, the email-link routes and the calendar sync use:
// SpreadsheetApp (Families + Ledger tabs in memory), CacheService (TTL), LockService (tryLock),
// ContentService, HtmlService, MailApp (records emails), CalendarApp (in-memory calendars with
// single events and recurring series), Utilities (formatDate for the patterns Code.gs uses,
// base64), ScriptApp, Session, Logger. Everything is inspectable through `mock`.
const fs = require('fs');
const vm = require('vm');

function makeMock() {
  const mock = { log: [], emails: [], sheets: {}, cache: {}, calendars: {}, lockAvailable: true, lockLog: [], now: null, tz: 'America/Chicago' };
  const clock = () => mock.now ? new Date(mock.now) : new Date();

  // ---- Spreadsheet -------------------------------------------------------------------------
  function sheet(name) {
    if (!mock.sheets[name]) mock.sheets[name] = { rows: [] };
    const s = mock.sheets[name];
    return {
      getName: () => name,
      getLastRow: () => s.rows.length,
      getLastColumn: () => s.rows.reduce((m, r) => Math.max(m, r.length), 0),
      appendRow: (row) => { s.rows.push(row.slice()); },
      getRange: (r, c, nr, nc) => ({
        getValues: () => { const out = []; for (let i = 0; i < (nr || 1); i++) { const row = s.rows[r - 1 + i] || []; const line = []; for (let j = 0; j < (nc || 1); j++) line.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); out.push(line); } return out; },
        getValue: () => { const row = s.rows[r - 1] || []; return row[c - 1] === undefined ? '' : row[c - 1]; },
        setValue: (v) => { while (s.rows.length < r) s.rows.push([]); const row = s.rows[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; },
        setValues: (vals) => { vals.forEach((line, i) => line.forEach((v, j) => { while (s.rows.length < r + i) s.rows.push([]); const row = s.rows[r - 1 + i]; while (row.length < c + j) row.push(''); row[c - 1 + j] = v; })); },
        clearContent: () => { for (let i = 0; i < (nr || 1); i++) if (s.rows[r - 1 + i]) for (let j = 0; j < (nc || 1); j++) s.rows[r - 1 + i][c - 1 + j] = ''; },
      }),
      deleteRow: (r) => { s.rows.splice(r - 1, 1); },
      clear: () => { s.rows = []; },
    };
  }
  const SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
      getSheetByName: (name) => mock.sheets[name] ? sheet(name) : null,
      insertSheet: (name) => sheet(name),
      getSheets: () => Object.keys(mock.sheets).map(sheet),
      getId: () => 'mock-spreadsheet',
    }),
  };

  // ---- Cache / Lock / Properties ------------------------------------------------------------
  const CacheService = { getScriptCache: () => ({
    get: (k) => { const e = mock.cache[k]; if (!e) return null; if (e.exp && e.exp < Date.now()) { delete mock.cache[k]; return null; } return e.v; },
    put: (k, v, ttl) => { mock.cache[k] = { v: String(v), exp: ttl ? Date.now() + ttl * 1000 : 0 }; },
    remove: (k) => { delete mock.cache[k]; },
  }) };
  const LockService = { getScriptLock: () => ({
    tryLock: (ms) => { mock.lockLog.push('tryLock'); return mock.lockAvailable; },
    waitLock: (ms) => { mock.lockLog.push('waitLock'); if (!mock.lockAvailable) throw new Error('Lock timeout'); },
    releaseLock: () => { mock.lockLog.push('release'); },
    hasLock: () => mock.lockAvailable,
  }) };
  const PropertiesService = { getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {}, deleteProperty: () => {} }) };

  // ---- Output ------------------------------------------------------------------------------
  const textOutput = (content) => { const o = { _content: content, _mime: null, getContent: () => o._content, setMimeType: (m) => { o._mime = m; return o; } }; return o; };
  const ContentService = { MimeType: { JSON: 'application/json', TEXT: 'text/plain', HTML: 'text/html' }, createTextOutput: textOutput };
  const HtmlService = { XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }, createHtmlOutput: (html) => { const o = { _html: html, getContent: () => o._html, setTitle: () => o, setXFrameOptionsMode: () => o }; return o; } };

  // ---- Mail --------------------------------------------------------------------------------
  const MailApp = { sendEmail: (a, b, c, d) => { mock.emails.push(typeof a === 'object' ? a : { to: a, subject: b, body: c, options: d }); }, getRemainingDailyQuota: () => 100 };
  const GmailApp = MailApp;

  // ---- Calendar ----------------------------------------------------------------------------
  let evSeq = 0;
  const Weekday = { SUNDAY: 'SU', MONDAY: 'MO', TUESDAY: 'TU', WEDNESDAY: 'WE', THURSDAY: 'TH', FRIDAY: 'FR', SATURDAY: 'SA' };
  const recurrence = () => { const r = { rules: [] }; const add = (kind) => { const rule = { kind, interval: 1, weekday: null, times: null, until: null }; r.rules.push(rule); const chain = { interval: (n) => { rule.interval = n; return chain; }, onlyOnWeekday: (d) => { rule.weekday = d; return chain; }, onlyOnWeekdays: (ds) => { rule.weekday = ds; return chain; }, times: (n) => { rule.times = n; return chain; }, until: (d) => { rule.until = d; return chain; }, addDailyRule: () => add('daily'), addWeeklyRule: () => add('weekly'), addMonthlyRule: () => add('monthly') }; return chain; }; r.addDailyRule = () => add('daily'); r.addWeeklyRule = () => add('weekly'); r.addMonthlyRule = () => add('monthly'); return r; };
  function eventObj(cal, e) {
    return {
      getId: () => e.id, getTitle: () => e.title, getDescription: () => e.description || '', getStartTime: () => e.start, getEndTime: () => e.end,
      isRecurringEvent: () => !!e.series, getEventSeries: () => ({ getId: () => e.series, deleteEventSeries: () => { cal.events = cal.events.filter(x => x.series !== e.series); mock.log.push('deleteSeries ' + e.series); } }),
      deleteEvent: () => { cal.events = cal.events.filter(x => x !== e); mock.log.push('deleteEvent ' + e.id); },
      setTitle: (t) => { e.title = t; }, setDescription: (d) => { e.description = d; }, setColor: (c) => { e.color = c; },
      addPopupReminder: (m) => { (e.reminders = e.reminders || []).push(m); }, removeAllReminders: () => { e.reminders = []; }, getPopupReminders: () => (e.reminders || []).slice(),
      _raw: e,
    };
  }
  function calendar(id) {
    if (!mock.calendars[id]) return null;
    const cal = mock.calendars[id];
    const make = (title, start, end, opts, series) => { const e = { id: 'ev' + (++evSeq), title, start, end, description: (opts && opts.description) || '', series: series || null, reminders: [] }; cal.events.push(e); mock.log.push((series ? 'createSeries ' : 'createEvent ') + title + ' @ ' + start.toISOString()); return eventObj(cal, e); };
    return {
      getId: () => id, getName: () => cal.name || id,
      createEvent: (title, start, end, opts) => make(title, start, end, opts, null),
      createEventSeries: (title, start, end, rec, opts) => { const ev = make(title, start, end, opts, 'series' + (evSeq + 1)); ev._raw.recurrence = rec.rules; return ev; },
      createAllDayEvent: (title, date, opts) => make(title, date, date, opts, null),
      getEvents: (start, end) => cal.events.filter(e => e.series ? true : (e.start >= start && e.start <= end)).map(e => eventObj(cal, e)),   // a series is always "in range" for the tests
      getEventsForDay: (day) => cal.events.map(e => eventObj(cal, e)),
      getEventById: (eid) => { const e = cal.events.find(x => x.id === eid); return e ? eventObj(cal, e) : null; },
    };
  }
  const CalendarApp = { Weekday, getCalendarById: (id) => calendar(id), getDefaultCalendar: () => calendar('default'), newRecurrence: recurrence, getCalendarsByName: () => [] };
  mock.addCalendar = (id, name) => { mock.calendars[id] = { name: name || id, events: [] }; };
  mock.calEvents = (id) => (mock.calendars[id] ? mock.calendars[id].events.map(e => ({ id: e.id, title: e.title, description: e.description, series: e.series, start: e.start, reminders: e.reminders })) : []);

  // ---- Utilities / misc --------------------------------------------------------------------
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const Utilities = {
    formatDate: (d, tz, fmt) => {   // local-time formatting is good enough for the tests (TZ is pinned by the runner)
      const dt = new Date(d); const h12 = dt.getHours() % 12 || 12; const ampm = dt.getHours() < 12 ? 'AM' : 'PM';
      return fmt.replace(/yyyy/g, dt.getFullYear()).replace(/MMMM/g, MONTHS[dt.getMonth()]).replace(/MMM/g, MONTHS[dt.getMonth()]).replace(/MM/g, pad(dt.getMonth() + 1))
        .replace(/EEEE/g, DAYS[dt.getDay()]).replace(/dd/g, pad(dt.getDate())).replace(/\bd\b/g, dt.getDate()).replace(/HH/g, pad(dt.getHours())).replace(/\bh\b/g, h12).replace(/mm/g, pad(dt.getMinutes())).replace(/\ba\b/g, ampm);
    },
    base64Encode: (s) => Buffer.from(String(s), 'utf8').toString('base64'),
    base64Decode: (s) => Array.from(Buffer.from(String(s), 'base64')),
    newBlob: (bytes, mime, name) => ({ bytes, mime, name, getName: () => name }),
    sleep: () => {}, getUuid: () => 'uuid-' + (++evSeq),
    computeDigest: (a, s) => Array.from(Buffer.from(String(s))), DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
  };
  const ScriptApp = { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/MOCK/exec' }), WeekDay: Weekday, getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ onWeekDay: () => ({ atHour: () => ({ create: () => {} }) }), atHour: () => ({ everyDays: () => ({ create: () => {} }), create: () => {} }), everyDays: () => ({ atHour: () => ({ create: () => {} }) }), onMonthDay: () => ({ atHour: () => ({ create: () => {} }) }) }) }) };
  const Session = { getActiveUser: () => ({ getEmail: () => 'mock@example.com' }), getScriptTimeZone: () => mock.tz };
  const Logger = { log: (m) => { mock.log.push(String(m)); } };
  const UrlFetchApp = { fetch: () => ({ getContentText: () => '{}', getResponseCode: () => 200 }) };

  mock.globals = { SpreadsheetApp, CacheService, LockService, PropertiesService, ContentService, HtmlService, MailApp, GmailApp, CalendarApp, Utilities, ScriptApp, Session, Logger, UrlFetchApp, console };
  return mock;
}

/** Load Code.gs into a fresh vm context with the mock services; returns { ctx, mock, call(fn, ...args) }. */
function loadCodeGs(codePath, mock) {
  mock = mock || makeMock();
  const src = fs.readFileSync(codePath, 'utf8');
  const ctx = vm.createContext(Object.assign({}, mock.globals));
  vm.runInContext(src, ctx, { filename: 'Code.gs' });
  const call = (fn, ...args) => vm.runInContext(fn, ctx)(...args);
  return { ctx, mock, call };
}

/** Helpers to talk to doGet/doPost the way the web app does. */
function get(env, params) { const out = env.call('doGet', { parameter: params || {} }); return parseOut(out); }
function post(env, body) { const out = env.call('doPost', { postData: { contents: JSON.stringify(body) } }); return parseOut(out); }
function parseOut(out) { const c = (out && out.getContent) ? out.getContent() : String(out); try { return JSON.parse(c); } catch (_) { return { _raw: c }; } }

module.exports = { makeMock, loadCodeGs, get, post };
