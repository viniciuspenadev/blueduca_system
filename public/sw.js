// Service Worker for Push Notifications
// BlueEduca PWA - Escola V2

const CACHE_NAME = 'blueduca-v1';
const OFFLINE_URL = '/offline.html';

// Install event - cache essential resources
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching app shell');
            return cache.addAll([
                '/',
                '/offline.html',
                '/logo_blueduca.png'
            ]).catch(err => {
                console.warn('[SW] Failed to cache some resources:', err);
            });
        })
    );
    self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).catch(() => {
                // If both cache and network fail, return offline page for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match(OFFLINE_URL);
                }
            });
        })
    );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received:', event);

    let notificationData = {
        title: 'BlueEduca',
        body: 'Você tem uma nova notificação',
        icon: '/logo_blueduca.png',
        badge: '/logo_blueduca.png',
        data: {
            url: '/'
        }
    };

    // Parse payload if available
    if (event.data) {
        try {
            const payload = event.data.json();
            notificationData = {
                title: payload.title || notificationData.title,
                body: payload.body || notificationData.body,
                icon: payload.icon || notificationData.icon,
                badge: payload.badge || notificationData.badge,
                data: {
                    url: payload.url || payload.data?.url || '/',
                    ...payload.data
                },
                tag: payload.tag || 'blueduca-notification',
                requireInteraction: payload.requireInteraction || false,
                vibrate: payload.vibrate || [200, 100, 200],
            };
        } catch (error) {
            console.error('[SW] Error parsing push payload:', error);
        }
    }

    event.waitUntil(
        self.registration.showNotification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
            badge: notificationData.badge,
            data: notificationData.data,
            tag: notificationData.tag,
            requireInteraction: notificationData.requireInteraction,
            vibrate: notificationData.vibrate,
        })
    );
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.notification);

    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if there's already a window open
            for (const client of clientList) {
                if (client.url === new URL(urlToOpen, self.location.origin).href && 'focus' in client) {
                    return client.focus();
                }
            }
            // If no window found, open a new one
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Background sync (future enhancement)
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);
    // Can be used for offline message queuing
});

console.log('[SW] Service Worker loaded');
