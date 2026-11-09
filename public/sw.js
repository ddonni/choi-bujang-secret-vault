// 오프라인 안내 화면 한 장만 저장합니다. 메모 자료와 /api/ 응답은 저장하지 않습니다.
const CACHE = 'vault-offline-v1';
const OFFLINE_PAGE = '/offline.html';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(new Request(OFFLINE_PAGE, { cache: 'reload' }))));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(names => Promise.all(names.filter(name => name !== CACHE).map(name => caches.delete(name))))
    .then(() => self.clients.claim()));
});

// 같은 출처의 화면 이동만 다룹니다. 네트워크가 끊겼을 때만 안내 화면을 보여 주고, 그 밖의 요청은 건드리지 않습니다.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.mode !== 'navigate' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_PAGE)));
});
