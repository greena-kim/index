// 앱 화면 파일을 캐시해서 오프라인에서도 열리게 한다.
// 파일을 고친 뒤 배포할 때 VERSION 을 올리면 옛 캐시가 정리된다.
const VERSION = 'v1';
const CACHE = `family-cleaning-${VERSION}`;
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'logic.js',
  'presets.js',
  'store.js',
  'firebase-config.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('family-cleaning-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 같은 출처 파일: 캐시를 먼저 보여주고 뒤에서 새 버전 받아 두기 (stale-while-revalidate)
// Firebase 등 외부 요청은 건드리지 않음
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const network = fetch(request)
        .then((res) => { if (res.ok) cache.put(request, res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
