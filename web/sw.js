// sw.js — Service Worker for AURDOUR DJ PWA
// Caches app shell for offline use; audio files are network-first

const CACHE_NAME = 'aurdour-v4';
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

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Network-first for audio/data files and CDN resources
    if (url.pathname.startsWith('/data/') || url.hostname !== location.hostname) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache-first for app shell
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
