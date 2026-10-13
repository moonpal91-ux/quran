#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════════
// تجهيز حزمة الويب كـ PWA قابلة للتثبيت (بعد `expo export --platform web`)
//
// ما يفعله:
//   1) ينسخ public/ (manifest + أيقونات) إلى dist/ إن لم ينسخها Expo.
//   2) يضخّ في dist/index.html: رابط manifest، theme-color، أيقونات Apple،
//      وتسجيل عامل الخدمة.
//   3) يولّد dist/sw.js من القالب public/sw.js مع قائمة تخزين مسبق حقيقية
//      (index.html + حزمة JS المُهشَّمة + manifest + الأيقونات) وطابع إصدار.
//   4) يطبع ملخّصًا وكيفية التشغيل.
//
// الاستدعاء: node scripts/prepare-pwa.mjs [--dist dist] [--no-precache-bundle]
// ═════════════════════════════════════════════════════════════════════════════
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1] ?? true;
};
const DIST = join(ROOT, flag('--dist') ?? 'dist');
const NO_BUNDLE = args.includes('--no-precache-bundle');

const kb = (f) => (statSync(f).size / 1024).toFixed(1) + 'KB';

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`✗ لا يوجد ${relative(ROOT, DIST)}/index.html — نفّذ أولًا:
  NODE_OPTIONS=--max-old-space-size=3000 npx expo export --platform web`);
  process.exit(1);
}

// ── 1) نسخ public/ ────────────────────────────────────────────────────────────
const PUBLIC = join(ROOT, 'public');
function copyDir(from, to) {
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, entry.name);
    const dst = join(to, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(dst, { recursive: true });
      copyDir(src, dst);
    } else {
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
      console.log(`  • نُسخ: ${relative(ROOT, dst)}`);
    }
  }
}
if (existsSync(PUBLIC)) copyDir(PUBLIC, DIST);

// ── 2) فهرسة الأصول ───────────────────────────────────────────────────────────
const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
const distFiles = walk(DIST);
const rel = (f) => './' + relative(DIST, f).split('\\').join('/');

const ICONS = distFiles.filter((f) => relative(DIST, f).split(sep).includes('icons'));
const BUNDLES = distFiles.filter((f) => extname(f) === '.js' && relative(DIST, f).split(sep).includes('_expo'));
const SHELL = ['./', './index.html', './manifest.webmanifest', ...ICONS.map(rel)];
const PRECACHE = NO_BUNDLE ? SHELL : [...SHELL, ...BUNDLES.map(rel)];

const stamp = createHash('sha256')
  .update(distFiles.filter((f) => extname(f) === '.js').map((f) => rel(f)).sort().join('|'))
  .digest('hex')
  .slice(0, 10);
const VERSION = `quran-companion-${stamp}`;

// ── 3) توليد sw.js ───────────────────────────────────────────────────────────
const swTemplate = readFileSync(join(ROOT, 'public', 'sw.js'), 'utf8');
// استبدالٌ مُثبَّت على السطرين المقصودين فقط (لا على أي ذكر في التعليقات)
const sw = swTemplate
  .replace("const VERSION = '__VERSION__';", `const VERSION = '${VERSION}';`)
  .replace('const PRECACHE = __PRECACHE__;', `const PRECACHE = ${JSON.stringify(PRECACHE, null, 2)};`);
// تحقّق: لا يجوز أن يبقى أي عنصر نائب (كان يستبدل النسخة داخل التعليق قديمًا)
if (sw.includes('__VERSION__') || sw.includes('__PRECACHE__')) {
  console.error('✗ بقي عنصر نائب في sw.js — أصلِح القالب public/sw.js وأعد المحاولة.');
  process.exit(1);
}
writeFileSync(join(DIST, 'sw.js'), sw, 'utf8');
console.log(`  • كُتب: ${relative(ROOT, DIST)}/sw.js — الإصدار ${VERSION} — ${PRECACHE.length} عنصرًا`);

// ── 4) ضخّ وسوم PWA في index.html ─────────────────────────────────────────────
const HEAD_TAGS = [
  '<meta name="theme-color" content="#145A46">',
  '<meta name="description" content="مصحف بالرسم العثماني مع التفسير والأذكار — يعمل دون اتصال.">',
  '<link rel="manifest" href="./manifest.webmanifest">',
  '<link rel="icon" href="./icons/favicon-32.png" sizes="32x32" type="image/png">',
  '<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="apple-mobile-web-app-title" content="رفيق القرآن">',
  '<meta name="application-name" content="رفيق القرآن">',
].join('\n    ');

const REGISTER = `
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('./sw.js').catch(function (e) {
            console.warn('[pwa] تعذّر تسجيل عامل الخدمة:', e);
          });
        });
      }
    </script>
`;

const indexPath = join(DIST, 'index.html');
let html = readFileSync(indexPath, 'utf8');
const before = html;
if (!html.includes('rel="manifest"')) {
  html = html.replace(/<\/head>/i, `    ${HEAD_TAGS}\n  </head>`);
}
if (!html.includes('serviceWorker.register')) {
  html = html.replace(/<\/body>/i, `${REGISTER}  </body>`);
}
if (html !== before) {
  writeFileSync(indexPath, html, 'utf8');
  console.log(`  • عُدّل: ${relative(ROOT, indexPath)} (+ وسوم PWA + تسجيل عامل الخدمة)`);
} else {
  console.log(`  • ${relative(ROOT, indexPath)} مضبوط مسبقًا (لا تغيير)`);
}

// ── 5) ملخّص ──────────────────────────────────────────────────────────────────
console.log('\n== جاهز: PWA في ' + relative(ROOT, DIST) + ' ==');
for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', ...ICONS.map(rel)]) {
  const p = join(DIST, f.replace('./', ''));
  if (existsSync(p)) console.log(`  ${f.padEnd(30)} ${kb(p)}`);
}
console.log(`  حزم JS المُسبقة التخزين: ${NO_BUNDLE ? '0 (--no-precache-bundle)' : BUNDLES.length}`);
console.log(`
التشغيل:  cd ${relative(ROOT, DIST)} && python3 -m http.server 8081 --bind 0.0.0.0
التثبيت:  Chrome/Edge ← زر «تثبيت» · Android ← «إضافة إلى الشاشة الرئيسية» · iOS ← Safari «مشاركة ← إضافة للشاشة الرئيسية»
الأوفلاين: بعد أول تحميل كامل، أغلق الشبكة وأعد الفتح — يعمل من الذاكرة المحلية.`);
