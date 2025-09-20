// Enhanced Service Worker for Smart Barcode Scanner
const CACHE_NAME = 'barcode-scanner-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    'https://unpkg.com/quagga@0.12.1/dist/quagga.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    console.log('[SW] تثبيت Service Worker...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] فتح الذاكرة المؤقتة وإضافة الملفات');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('[SW] تم تثبيت جميع الملفات في الذاكرة المؤقتة');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] خطأ في التثبيت:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] تفعيل Service Worker...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] حذف الذاكرة المؤقتة القديمة:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] تم تفعيل Service Worker بنجاح');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Handle Excel file requests differently
    if (request.url.includes('.xlsx') || request.url.includes('.xls')) {
        event.respondWith(handleExcelRequest(request));
        return;
    }
    
    // Handle other requests with cache-first strategy
    event.respondWith(
        caches.match(request)
            .then((response) => {
                // Return cached version if available
                if (response) {
                    console.log('[SW] تقديم من الذاكرة المؤقتة:', request.url);
                    return response;
                }
                
                // Fetch from network
                console.log('[SW] تحميل من الشبكة:', request.url);
                return fetch(request)
                    .then((response) => {
                        // Don't cache if not successful
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clone the response
                        const responseToCache = response.clone();
                        
                        // Add to cache for future use
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch((error) => {
                        console.error('[SW] خطأ في الشبكة:', error);
                        
                        // Return offline page if available
                        if (request.destination === 'document') {
                            return caches.match('/index.html');
                        }
                        
                        throw error;
                    });
            })
    );
});

// Handle Excel file requests with special caching strategy
async function handleExcelRequest(request) {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = `excel-${request.url}`;
    
    try {
        // Try to fetch fresh data
        const networkResponse = await fetch(request, {
            cache: 'no-cache'
        });
        
        if (networkResponse.ok) {
            // Cache the fresh data
            const responseToCache = networkResponse.clone();
            await cache.put(cacheKey, responseToCache);
            
            console.log('[SW] تم تحديث ملف Excel في الذاكرة المؤقتة');
            return networkResponse;
        }
        
        throw new Error('Network response not ok');
        
    } catch (error) {
        console.log('[SW] فشل تحميل Excel من الشبكة، محاولة الذاكرة المؤقتة...');
        
        // Fallback to cached version
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
            console.log('[SW] تقديم ملف Excel من الذاكرة المؤقتة');
            return cachedResponse;
        }
        
        // If no cache available, throw error
        throw new Error('No cached Excel file available');
    }
}

// Handle background sync for data updates
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync triggered:', event.tag);
    
    if (event.tag === 'data-sync') {
        event.waitUntil(syncData());
    }
});

// Sync data when background sync is triggered
async function syncData() {
    try {
        // Get stored data URL
        const clients = await self.clients.matchAll();
        if (clients.length > 0) {
            // Notify client to check for updates
            clients[0].postMessage({
                type: 'CHECK_UPDATES',
                message: 'Checking for data updates...'
            });
        }
        
        console.log('[SW] تم تشغيل مزامنة البيانات في الخلفية');
    } catch (error) {
        console.error('[SW] خطأ في مزامنة البيانات:', error);
    }
}

// Listen for messages from main app
self.addEventListener('message', (event) => {
    console.log('[SW] تم استلام رسالة:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_EXCEL') {
        // Cache Excel file when requested
        const { url } = event.data;
        cacheExcelFile(url);
    }
});

// Cache Excel file manually
async function cacheExcelFile(url) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const response = await fetch(url);
        
        if (response.ok) {
            await cache.put(`excel-${url}`, response);
            console.log('[SW] تم حفظ ملف Excel في الذاكرة المؤقتة');
        }
    } catch (error) {
        console.error('[SW] خطأ في حفظ ملف Excel:', error);
    }
}

console.log('[SW] Service Worker loaded successfully');