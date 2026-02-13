/**
 * SGND - Service Worker for PWA
 */

const CACHE_NAME = 'sgnd-cache-v73';
const HTML_NETWORK_TIMEOUT_MS = 3500;
const OFFLINE_URL = '/offline.html';

// Assets to cache
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/variables.css',
    '/css/base.css',
    '/css/components.css',
    '/css/layout.css',
    '/css/pages.css',
    '/css/animations.css',
    '/js/config.js',
    '/js/data.js',
    '/js/api-client.js',
    '/js/auth.js',
    '/js/utils.js',
    '/js/offline.js',
    '/js/notifications.js',
    '/js/ujier.js',
    '/js/dashboard.js',
    '/js/reports.js',
    '/js/asignaciones.js',
    '/js/usuarios.js',
    '/js/app.js',
    '/assets/icons/icon.svg'
];

// External resources to cache
const EXTERNAL_RESOURCES = [
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app shell');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                // Cache external resources separately (they might fail)
                return caches.open(CACHE_NAME).then((cache) => {
                    return Promise.allSettled(
                        EXTERNAL_RESOURCES.map(url =>
                            cache.add(url).catch(err => console.log(`[SW] Failed to cache: ${url}`))
                        )
                    );
                });
            })
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => caches.delete(name))
                );
            })
            .then(async () => {
                if (self.registration.navigationPreload) {
                    await self.registration.navigationPreload.enable();
                }

                if (self.registration.active) {
                    return self.clients.claim();
                }
            })
    );
});

// Allow clients to request immediate activation of a waiting worker
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

function isCacheableResponse(response) {
    return response && (response.ok || response.type === 'opaque');
}

function putInCache(request, response) {
    if (!isCacheableResponse(response) || request.url.startsWith('chrome-extension')) {
        return;
    }

    const responseClone = response.clone();
    caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, responseClone);
    }).catch(() => { });
}

function getAssetCacheKey(request) {
    const url = new URL(request.url);
    const isSameOrigin = url.origin === self.location.origin;
    const isVersionedAsset = /\.(js|css)$/i.test(url.pathname);

    // Unify cache keys for versioned JS/CSS (?v=) to avoid duplicate entries and speed warm caches
    if (isSameOrigin && isVersionedAsset) {
        return new Request(url.pathname, { method: 'GET' });
    }

    return request;
}

function networkFirstHtml(event) {
    const { request } = event;

    const networkPromise = (async () => {
        const preloadedResponse = await event.preloadResponse;
        if (preloadedResponse) {
            putInCache(request, preloadedResponse);
            return preloadedResponse;
        }

        return fetch(request);
    })()
        .then((response) => {
            if (response.ok) {
                putInCache(request, response);
            }
            return response;
        });

    const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('network-timeout')), HTML_NETWORK_TIMEOUT_MS);
    });

    return Promise.race([networkPromise, timeoutPromise])
        .catch(async () => {
            const cachedResponse = await caches.match(request);
            return cachedResponse || caches.match('/index.html');
        });
}

function staleWhileRevalidateAsset(request) {
    const cacheKey = getAssetCacheKey(request);

    return caches.match(cacheKey)
        .then((cachedResponse) => {
            const networkUpdate = fetch(request)
                .then((response) => {
                    if (isCacheableResponse(response)) {
                        putInCache(cacheKey, response);
                    }
                    return response;
                })
                .catch(() => null);

            if (cachedResponse) {
                return cachedResponse;
            }

            return networkUpdate.then((response) => response || caches.match('/index.html'));
        });
}

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip API calls - always go to network to get fresh data
    if (url.pathname.includes('/api/')) {
        event.respondWith(
            fetch(request)
                .catch(() => {
                    // Return empty response for failed API calls
                    return new Response(JSON.stringify({ data: null, error: 'Offline', success: false }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
        return;
    }

    // For HTML pages - network first with timeout fallback to keep UX responsive
    if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(networkFirstHtml(event));
        return;
    }

    // For static assets - stale-while-revalidate (fast + updates in background)
    event.respondWith(staleWhileRevalidateAsset(request));
});

// Background sync for offline queue
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-notifications') {
        console.log('[SW] Background sync triggered');
        event.waitUntil(syncOfflineData());
    }
});

// Sync offline data
async function syncOfflineData() {
    console.log('[SW] Syncing offline data...');
}

console.log('[SW] Service Worker loaded');
