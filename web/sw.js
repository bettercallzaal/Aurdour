// sw.js — Service Worker for AURDOUR DJ PWA
// Caches app shell for offline use; API/audio calls are network-first

const CACHE_NAME = 'aurdour-v5';
const APP_SHELL = [
    '/',
    '/index.html',
    '/styles.css',
    '/player.js',
    '/dj/Deck.js',
    '/dj/AudioRouter.js',
    '/dj/Mixer.js',
    '/dj/Meters.js',
    '/dj/Library.js',
    '/dj/Sampler.js',
    '/dj/Recorder.js',
    '/dj/Visualizer.js',
    '/dj/MidiController.js',
    '/dj/BpmTap.js',
    '/dj/StreamBroadcast.js',
    '/dj/FX.js',
    '/dj/AutoTransition.js',
    '/dj/Setlist.js',
    '/dj/HarmonicMixer.js',
    '/dj/StemSeparator.js',
    '/dj/Storage.js',
    '/dj/BpmDetector.js',
    '/dj/JogWheel.js',
    '/dj/DragDrop.js',
    '/dj/CrashRecovery.js',
    '/dj/WaveformCache.js',
    '/dj/Playlists.js',
    '/dj/PerfMonitor.js',
    '/dj/Settings.js',
    '/dj/FlowMode.js',
];

// ── Install: pre-cache the app shell ──────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

// ── Activate: purge old caches ────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ── Fetch: route requests to the right strategy ───────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // 1. Skip non-GET requests entirely — let the browser handle them
    if (request.method !== 'GET') return;

    // 2. Skip schemes we cannot cache (blob:, chrome-extension:, data:, etc.)
    if (!url.protocol.startsWith('http')) return;

    // 3. Network-first for cross-origin requests (Audius API, CDN audio, etc.)
    if (url.origin !== self.location.origin) {
        event.respondWith(networkFirst(request));
        return;
    }

    // 4. Network-first for data/API paths on our own origin
    if (url.pathname.startsWith('/data/') || url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // 5. Cache-first for everything else (app shell / static assets)
    event.respondWith(cacheFirst(request));
});

// ── Strategies ────────────────────────────────────────────────────

/**
 * Network-first: try the network, fall back to cache, then offline stub.
 */
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        // Only cache successful same-origin or CORS responses (not opaque errors)
        if (response && response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (_) {
        const cached = await caches.match(request);
        return cached || offlineResponse();
    }
}

/**
 * Cache-first: serve from cache, fall back to network, then offline stub.
 */
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response && response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (_) {
        return offlineResponse();
    }
}

/**
 * Last-resort fallback so we never resolve with undefined.
 */
function offlineResponse() {
    return new Response('Offline – resource unavailable', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' },
    });
}
