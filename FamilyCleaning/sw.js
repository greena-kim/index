// 앱 화면 파일을 캐시해서 오프라인에서도 열리게 한다.
// 파일을 고친 뒤 배포할 때 VERSION 을 올리면 옛 캐시가 정리된다.
const VERSION = 'v3';
const CACHE = `family-cleaning-${VERSION}`;
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'fonts/pretendard/pretendardvariable-dynamic-subset.css',
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

// 폰트 조각은 내용이 바뀌지 않으니 한 번 받으면 캐시에서만 꺼내 쓴다 (앱 버전이 바뀌어도 유지)
const FONT_CACHE = 'pretendard-v1.3.9';

// 같은 출처 파일: 캐시를 먼저 보여주고 뒤에서 새 버전 받아 두기 (stale-while-revalidate)
// Firebase 등 외부 요청은 건드리지 않음
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.url.endsWith('.woff2')) {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

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
