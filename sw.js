/**
 * SGND - Service Worker for PWA
 * Version: 43.19
 */

const CACHE_NAME = 'sgnd-cache-v118';
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
            .then(() => self.skipWaiting())
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
            .then(() => {
                if (self.registration.active) {
                    return self.clients.claim();
                }
            })
    );
});

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

    // Network-first for HTML pages and root
    if (request.headers.get('accept')?.includes('text/html') || url.pathname === '/' || url.pathname.endsWith('index.html')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Clone and cache the response
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    return caches.match(request)
                        .then((cachedResponse) => {
                            if (cachedResponse) return cachedResponse;
                            return caches.match('/index.html')
                                .then(idxResponse => {
                                    return idxResponse || new Response('Offline - No cache available', {
                                        status: 503,
                                        statusText: 'Service Unavailable',
                                        headers: new Headers({ 'Content-Type': 'text/plain' })
                                    });
                                });
                        });
                })
        );
        return;
    }

    // For other assets - cache first, then network
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Update cache in background
                    fetch(request).then((response) => {
                        if (response.ok) {
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, response);
                            });
                        }
                    }).catch(() => { });

                    return cachedResponse;
                }

                return fetch(request)
                    .then((response) => {
                        // Cache new resources (skip chrome-extension URLs)
                        if (response.ok && !request.url.startsWith('chrome-extension')) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, responseClone);
                            });
                        }
                        return response;
                    })
                    .catch(() => {
                        // Crucial: always return a Response, never undefined/reject to avoid Safari crash
                        return new Response('', { status: 408, statusText: 'Request Timeout' });
                    });
            })
    );
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

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
