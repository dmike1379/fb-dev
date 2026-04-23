/* ╔═══════════════════════════════════════════════════════════════════╗
   ║                FAMILY BANK — service-worker.js  v34.1            ║
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

const SW_VERSION  = 'v37.0';
const CACHE_NAME  = 'family-bank-' + SW_VERSION;
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './vendor/chart.umd.min.js',
  './vendor/phosphor-sprite.svg',
  './vendor/jspdf.umd.min.js'
];

// ── Install: pre-cache the shell ───────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(CORE_ASSETS).catch(() => {/* silent — not all assets may exist on first install */}))
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
  return caches.open(CACHE_NAME).then(cache =>
    cache.match(req).then(cached => {
      const fetchPromise = fetch(req)
        .then(res => {
          if (res && res.status === 200) cache.put(req, res.clone());
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
          if (data && data.version && data.version !== SW_VERSION.replace('v', '')) {
            // Tell every open page there's a new version available
            self.clients.matchAll().then(clients => {
              clients.forEach(c => c.postMessage({
                type: 'NEW_VERSION_AVAILABLE',
                newVersion: data.version,
                currentVersion: SW_VERSION.replace('v', '')
              }));
            });
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
