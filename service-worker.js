/* ╔═══════════════════════════════════════════════════════════════════╗
   ║                FAMILY BANK — service-worker.js  v38.3            ║
   ║                                                                   ║
   ║  HOW THE AUTO-UPDATE WORKS:                                       ║
   ║  1. SW fetches version.json on every page load (network-first).  ║
   ║  2. If version.json reports a NEW version, SW posts a message    ║
   ║     to the page.                                                  ║
   ║  3. The page waits until the user is idle (no taps for 30 sec)   ║
   ║     then quietly reloads to pick up the new version.             ║
   ║                                                                   ║
   ║  All other assets (HTML, CSS, JS, vendored Chart.js, Phosphor    ║
   ║  sprite) are cached with stale-while-revalidate: instant load    ║
   ║  from cache, fresh copy fetched in background.                   ║
   ║                                                                   ║
   ║  script.google.com is always bypassed — never cached.            ║
   ╚═══════════════════════════════════════════════════════════════════╝ */

const SW_VERSION  = 'v38.3-1';
const CACHE_NAME  = 'family-bank-' + SW_VERSION;
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './vendor/chart.umd.min.js',
  './vendor/phosphor-sprite.svg'
];

// ── Install: pre-cache the shell ───────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      // v38.3-2 — cache:'reload' bypasses the HTTP cache, so a new worker never precaches
      // the previous version's files (max-age=600 on GitHub Pages made that possible).
      // One missing file no longer empties the whole precache (addAll is all-or-nothing).
      .then(c => Promise.allSettled(CORE_ASSETS.map(u => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: nuke old caches ─────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: route by request type ──────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never cache the Apps Script API
  if (url.hostname.includes('script.google.com')) return;

  // Only handle GET
  if (e.request.method !== 'GET') return;

  // version.json: network-first, used for update detection
  if (url.pathname.endsWith('/version.json')) {
    e.respondWith(handleVersionCheck(e.request));
    return;
  }

  // Everything else: stale-while-revalidate
  e.respondWith(staleWhileRevalidate(e.request));
});

// ── Stale-while-revalidate: instant from cache, refresh in background
function staleWhileRevalidate(req) {
  // v38.3-2 — same-origin files revalidate with the server on every background refresh
  // (conditional request; 304 when unchanged) instead of re-reading the HTTP cache.
  const sameOrigin = new URL(req.url).origin === self.location.origin;
  const refresh = sameOrigin ? new Request(req, { cache: 'no-cache' }) : req;   // keeps redirect/credentials/headers; navigate mode becomes same-origin
  return caches.open(CACHE_NAME).then(cache =>
    cache.match(req).then(cached => {
      const fetchPromise = fetch(refresh)
        .then(res => {
          if (res && res.status === 200 && !res.redirected) cache.put(req, res.clone());   // v38.3-2 — a redirected response must not be stored under a navigation key
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
}

// ── Version check: fetch, compare, notify clients on change ───────
function handleVersionCheck(req) {
  return fetch(req)
    .then(res => {
      if (res && res.status === 200) {
        res.clone().json().then(data => {
          if (data && data.version) {
            // v38.1 final (In-6) — normalize both sides: strip a leading "v" and
            // whitespace so "v38.1-final" and "38.1-final" compare equal.
            var norm = function(s){ return String(s || '').trim().replace(/^v/i, ''); };
            var remote = norm(data.version + (data.build ? '-' + data.build : ''));
            var local  = norm(SW_VERSION);
            if (remote !== local) {
              // Tell every open page there's a new version available
              self.clients.matchAll().then(clients => {
                clients.forEach(c => c.postMessage({
                  type: 'NEW_VERSION_AVAILABLE',
                  newVersion: remote,
                  currentVersion: local
                }));
              });
            }
          }
        }).catch(() => {});
      }
      return res;
    })
    .catch(() => caches.match(req));
}

// ── Allow page to trigger an immediate cache nuke + reload ────────
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'CLEAR_CACHE_AND_RELOAD') {
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.matchAll())
      .then(clients => clients.forEach(c => c.navigate(c.url)));
  }
});
