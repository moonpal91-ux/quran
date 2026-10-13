/* ══════════════════════════════════════════════════════════════════════════
 * عامل خدمة (Service Worker) — رفيق القرآن الكريم
 *
 * الهدف: «أولًا-أوفلاين» — بعد أول تحميل يحفظ التطبيق كل ما يحتاجه محليًا،
 * فيعمل بلا شبكة تمامًا (المصحف والتفسير والأذكار كلها داخل الحزمة).
 *
 * الاستراتيجية:
 *   • التنقّل (navigations): الشبكة أولًا ثم الذاكرة — ليصل أي تحديث، والسقوط
 *     على النسخة المحفوظة عند انعدام الاتصال.
 *   • الأصول (JS/CSS/خطوط/صور/بيانات): الذاكرة أولًا + تحديث بالخلفية (stale
 *     while revalidate) — فتح فوري، وتحديث يظهر في الزيارة التالية.
 *   • لا يُخزَّن أي طلب خارج النطاق، ولا أي طلب غير GET.
 *
 * ملاحظة: هذا الملف «قالب». يستبدل `scripts/prepare-pwa.mjs` سطري الثابتين
 * (قائمة التخزين المسبق وطابع الإصدار) بقيم البناء الفعلية، ثم يكتب الناتج
 * في `dist/sw.js` — ويتحقق من خلوّه من أي عنصر نائب قبل الاعتماد.
 * ══════════════════════════════════════════════════════════════════════════ */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .catch((err) => console.warn('[sw] تعذّر التخزين المسبق:', err)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) {
    // تحديث بالخلفية دون تعطيل الاستجابة الفورية
    fetch(request)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') cache.put(request, res.clone()).catch(() => {});
      })
      .catch(() => {});
    return hit;
  }
  const response = await fetch(request);
  if (response && response.ok && response.type === 'basic') {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

async function navigationHandler(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put('./index.html', response.clone()).catch(() => {});
    return response;
  } catch (err) {
    return (
      (await cache.match('./index.html')) ||
      (await cache.match('./')) ||
      new Response('لا يتوفر اتصال، ولم تُحفظ نسخة بعد.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // لا تخزين لطلبات خارجية
  if (url.pathname.indexOf('/sw.js') !== -1) return; // العامل نفسه: دائمًا طازج

  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
