// Service Worker - 오프라인 캐싱
const CACHE_NAME = 'jw-service-v2';
const urlsToCache = [
  '/Service-report/',
  '/Service-report/index.html',
  '/Service-report/styles.css',
  '/Service-report/app.js',
  '/Service-report/db.js',
  '/Service-report/sync.js',
  '/Service-report/manifest.json',
  '/Service-report/jw-service-icon-192.png',
  '/Service-report/jw-service-icon-512.png'
];

// 설치 이벤트 - 캐시에 파일 저장
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('캐시 열림');
        return cache.addAll(urlsToCache);
      })
  );
});

// 활성화 이벤트 - 오래된 캐시 삭제
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('오래된 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch 이벤트 - 캐시 우선 전략
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 캐시에 있으면 캐시 반환, 없으면 네트워크 요청
        return response || fetch(event.request);
      })
  );
});
