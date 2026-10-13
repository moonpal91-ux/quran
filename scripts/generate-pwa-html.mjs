#!/usr/bin/env node
/**
 * مولّد «ملف HTML واحد للتطبيق كـ PWA» (pwa-app.html).
 *
 * يبني على المعاينة الثابتة (app-preview.html — محتواها من الحزم المعتمدة) ويضيف طبقة PWA:
 *   1) بيان تطبيق مضمّن كـ data: URI (الاسم عربي/RTL، standalone، أيقونات كـ data: URI).
 *   2) أيقونة Apple (apple-touch-icon) + theme-color + أوضاع العرض المستقلة.
 *   3) تسجيل عامل خدمة من `./sw.js` عند الخدمة عبر http(s) — ويُتجاهل بصمت على file://.
 *   4) زر «تثبيت» يعمل عبر حدث beforeinstallprompt حيث تدعمه المتصفحات.
 *
 * الصدق: الملف وحدة واحدة تعمل أوفلاين بطبيعتها (لا موارد خارجية). التثبيت الكامل
 * (أيقونة على الشاشة الرئيسية) يعتمد على دعم المتصفح للبيانات المضمّنة؛ ويظل
 * الخيار الأكمل هو حزمة `dist/` المُنتَجة بـ `npm run build:pwa`
 * (manifest.webmanifest + sw.js + أيقونات كملفات منفصلة).
 *
 * الاستدعاء: node scripts/generate-pwa-html.mjs [--out المسار]
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const oi = argv.indexOf('--out');
const OUT = oi >= 0 ? argv[oi + 1] : path.join(ROOT, 'pwa-app.html');
const PREVIEW = path.join(ROOT, 'app-preview.html');

if (!existsSync(PREVIEW)) {
  console.error('✗ app-preview.html غائب — نفّذ أولًا: node scripts/generate-preview-html.mjs');
  process.exit(1);
}

const icon = (p) => `data:image/png;base64,${readFileSync(path.join(ROOT, p)).toString('base64')}`;
const ICONS = {
  '192': icon('public/icons/icon-192.png'),
  '512': icon('public/icons/icon-512.png'),
  '512-maskable': icon('public/icons/icon-maskable-512.png'),
  '180': icon('public/icons/apple-touch-icon.png'),
  '32': icon('public/icons/favicon-32.png'),
};

const manifest = {
  id: './',
  name: 'رفيق القرآن الكريم',
  short_name: 'رفيق القرآن',
  description: 'مصحف بالرسم العثماني مع التفسير والأذكار والاستماع — يعمل دون اتصال.',
  lang: 'ar',
  dir: 'rtl',
  start_url: './pwa-app.html',
  scope: './',
  display: 'standalone',
  display_override: ['standalone', 'minimal-ui', 'browser'],
  orientation: 'portrait',
  background_color: '#F8F6F0',
  theme_color: '#145A46',
  icons: [
    { src: ICONS['192'], sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: ICONS['512'], sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: ICONS['512-maskable'], sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

const manifestUrl = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`;

const HEAD = `
    <!-- ══════════════ طبقة PWA ══════════════ -->
    <meta name="theme-color" content="#145A46">
    <meta name="description" content="${manifest.description}">
    <meta name="application-name" content="رفيق القرآن">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="رفيق القرآن">
    <link rel="manifest" href="${manifestUrl}">
    <link rel="icon" href="${ICONS['32']}" sizes="32x32" type="image/png">
    <link rel="apple-touch-icon" href="${ICONS['180']}">
    <style>
      #pwa-bar{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;
        background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:8px 10px;margin:0 0 10px}
      #pwa-bar .btn{min-height:40px;padding:0 14px;border-radius:8px;border:1px solid var(--primary);
        background:var(--primary);color:var(--onPrimary);font-family:inherit;font-size:13px;cursor:pointer}
      #pwa-bar .btn.ghost{background:transparent;color:var(--primary)}
      #pwa-bar .muted{color:var(--muted);font-size:12px}
      #pwa-install[hidden]{display:none}
    </style>
`;

const BODY_SCRIPT = `
    <!-- ══════════════ سلوك PWA ══════════════ -->
    <script>
      /* (1) عامل الخدمة: للتخزين الأوفلاين عند الخدمة عبر http(s) — لا يعمل على file:// */
      if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('./sw.js').then(function (reg) {
            console.log('[pwa] عامل الخدمة مُسجَّل:', reg.scope);
          }).catch(function (e) {
            console.info('[pwa] لا يوجد sw.js بجانب الملف — الملف ذاتي الاكتفاء ويعمل أوفلاين:', e && e.message);
          });
        });
      }

      /* (2) التثبيت: التقاط دعوة التثبيت حيث تدعمها المتصفحات */
      var deferredPrompt = null;
      var installBtn = document.getElementById('pwa-install');
      window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferredPrompt = e;
        if (installBtn) installBtn.hidden = false;
      });
      window.addEventListener('appinstalled', function () {
        if (installBtn) installBtn.hidden = true;
        var st = document.getElementById('pwa-status');
        if (st) st.textContent = 'مُثبَّت على هذا الجهاز ✔';
      });
      function installApp() {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (choice) {
          deferredPrompt = null;
          if (installBtn) installBtn.hidden = true;
          var st = document.getElementById('pwa-status');
          if (st) st.textContent = choice.outcome === 'accepted' ? 'تم التثبيت ✔' : 'أُلغي التثبيت';
        });
      }

      /* (3) حالة الشبكة — عرض صادق (أولًا-أوفلاين) */
      function updateNet() {
        var st = document.getElementById('pwa-net');
        if (st) st.textContent = navigator.onLine ? 'متصل' : 'غير متصل — يعمل من الملف';
      }
      window.addEventListener('online', updateNet);
      window.addEventListener('offline', updateNet);
      updateNet();
    <\/script>
`;

let html = readFileSync(PREVIEW, 'utf8');

// 1) وسوم PWA في <head>
html = html.replace('</head>', `${HEAD}\n</head>`);

// 2) شريط PWA أعلى الهاتف (بعد بداية جسم الصفحة)
const bar = `
  <div id="pwa-bar">
    <button id="pwa-install" class="btn" hidden onclick="installApp()">تثبيت التطبيق</button>
    <span class="muted">الحالة: <span id="pwa-net">—</span></span>
    <span class="muted">·</span>
    <span class="muted" id="pwa-status">ملف واحد مكتفٍ بذاته — يعمل أوفلاين</span>
  </div>
`;
html = html.replace('<div class="phone" id="phone">', `${bar}\n  <div class="phone" id="phone">`);

// 3) سكربت PWA قبل </body>
html = html.replace('</body>', `${BODY_SCRIPT}\n</body>`);

writeFileSync(OUT, html, 'utf8');
const mb = (statSync(OUT).size / 1024 / 1024).toFixed(2);
console.log(`كُتب: ${path.relative(ROOT, OUT)} — ${mb}MB (تطبيق + PWA في ملف واحد)`);
console.log('البيان: data: URI (standalone · rtl · 3 أيقونات مضمّنة) · عامل الخدمة: ./sw.js عند الخدمة عبر http(s)');
