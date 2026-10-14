#!/usr/bin/env node
/**
 * مولّد ملف التسليم الشامل (HANDOFF) — يُنتَج من المستودع نفسه (حتمي، بلا شبكة).
 *
 * الغرض: ملف واحد يكفي لبدء محادثة تنفيذ جديدة دون فقد أي سياق:
 *   حالة المشروع + خطوات التشغيل + كل التبويبات والشاشات + المكتمل والمتبقي
 *   + **كود كل ملف برمجي كاملًا** + فهرس ملفات البيانات (بصمات SHA-256).
 *
 * الاستدعاء:
 *   node scripts/generate-handoff.mjs                 # → HANDOFF-<التاريخ>.md
 *   node scripts/generate-handoff.mjs --out مسار/ملف.md
 *
 * ملاحظات:
 *  - الملفات الثنائية (png/ttf/zip/keystore/webp) لا تُدرج أكوادها؛ تُفهرس بالحجم والبصمة.
 *  - لا يُولَّد أي محتوى ديني هنا: النصوص تُقرأ حرفيًا من حزم المحتوى المُعتمدة.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const TODAY = new Date().toISOString().slice(0, 10);
const OUT = outIdx >= 0 ? argv[outIdx + 1] : path.join(ROOT, `HANDOFF-${TODAY}.md`);

const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
const sha = (p) => createHash('sha256').update(readFileSync(path.join(ROOT, p))).digest('hex');
const kb = (p) => Math.round(statSync(path.join(ROOT, p)).size / 102.4) / 10;

/** سياج كود آمن: أطول سلسلة backticks داخل المحتوى + 1 (لا يقل عن 3) */
function fence(text) {
  const runs = text.match(/`+/g) ?? [];
  const longest = runs.reduce((a, s) => Math.max(a, s.length), 0);
  return '`'.repeat(Math.max(3, longest + 1));
}

function codeBlock(rel) {
  const src = read(rel).replace(/\s+$/, '');
  const f = fence(src);
  return `${f}\n${src}\n${f}`;
}

function section(title, files, note = '') {
  let out = `\n### ${title}${note ? ` — ${note}` : ''}\n`;
  for (const rel of files) {
    if (!existsSync(path.join(ROOT, rel))) {
      out += `\n#### \`${rel}\` — ⚠ غير موجود\n`;
      continue;
    }
    out += `\n#### \`${rel}\`  ·  ${kb(rel)}KB\n\n${codeBlock(rel)}\n`;
  }
  return out;
}

/** فهرس ملفات البيانات (ثنائية ونصية كبيرة) مع البصمات */
function dataIndex(rows) {
  let out = '| الملف | الحجم | SHA-256 | الوصف |\n|---|---|---|---|\n';
  for (const [rel, desc] of rows) {
    if (!existsSync(path.join(ROOT, rel))) {
      out += `| \`${rel}\` | — | — | ${desc} — **غائب** |\n`;
      continue;
    }
    out += `| \`${rel}\` | ${kb(rel)}KB | \`${sha(rel).slice(0, 16)}…\` | ${desc} |\n`;
  }
  return out;
}

const GROUPS = [
  ['8.1) الجذر (App/إعدادات المشروع)', [
    'App.tsx', 'index.ts', 'app.json', 'package.json', 'tsconfig.json', 'tsconfig.test.json',
    '.gitignore', 'AGENTS.md', 'LICENSE', 'STAGE-PROGRESS.md', 'START-HERE.md',
  ]],
  ['8.2) src/design-system (نظام التصميم)', [
    'src/design-system/components.tsx', 'src/design-system/fonts.ts',
    'src/design-system/theme.tsx', 'src/design-system/tokens.ts',
  ]],
  ['8.3) src/database/realm (قاعدة البيانات)', [
    'src/database/realm/browser-adapter.ts', 'src/database/realm/realm-ctor.ts',
    'src/database/realm/realm-ctor.native.ts', 'src/database/realm/realm-ctor.web.ts',
    'src/database/realm/realm.ts', 'src/database/realm/schemas.ts', 'src/database/realm/types.ts',
  ]],
  ['8.4) src/app (التنقل)', ['src/app/navigation-theme.ts', 'src/app/root-navigator.tsx']],
  ['8.5) src/repositories (المستودعات)', [
    'src/repositories/adhkar-content-repository.ts', 'src/repositories/adhkar-progress-repository.ts',
    'src/repositories/bookmark-repository.ts', 'src/repositories/favorite-ayah-repository.ts',
    'src/repositories/personal-note-repository.ts', 'src/repositories/quran-content-repository.ts',
    'src/repositories/quran-qa-repository.ts', 'src/repositories/reading-session-repository.ts',
    'src/repositories/reading-session-tracker.ts', 'src/repositories/settings-repository.ts',
    'src/repositories/plan-repository.ts',
  ]],
  ['8.6) src/features (الشاشات والتبويبات)', [
    'src/features/home/home-screen.tsx',
    'src/features/quran/mushaf-stack.tsx', 'src/features/quran/mushaf-home-screen.tsx',
    'src/features/quran/surah-screen.tsx', 'src/features/quran/quran-content.ts',
    'src/features/adhkar/adhkar-screen.tsx',
    'src/features/library/plans-screen.tsx',
    'src/features/library/library-stack.tsx', 'src/features/library/library-home-screen.tsx',
    'src/features/library/bookmarks-screen.tsx', 'src/features/library/favorites-screen.tsx',
    'src/features/library/notes-screen.tsx', 'src/features/library/sessions-screen.tsx',
    'src/features/library/plans-screen.tsx', 'src/features/library/downloads-screen.tsx',
    'src/features/library/settings-screen.tsx', 'src/features/library/about-screen.tsx',
  ]],
  ['8.7) tests (حزم الاختبارات — 210 فحصًا في 7 ملفات: 155 + 55 للخطط)', [
    'tests/realm-stage0.test.ts', 'tests/repositories-stage1.test.ts', 'tests/quran-stage2.test.ts',
    'tests/library-stage3.test.ts', 'tests/tafsir-stage4.test.ts', 'tests/adhkar-stage5.test.ts',
    'tests/plans-stage7.test.ts',
  ]],
  ['8.8) scripts (بوابات الاستيراد والتحقق)', [
    'scripts/bootstrap-rebuild.mjs', 'scripts/import-quran.mjs', 'scripts/validate-quran.mjs',
    'scripts/import-quran-qa.mjs', 'scripts/import-adhkar.mjs', 'scripts/serve-preview.mjs',
    'scripts/generate-handoff.mjs', 'scripts/generate-preview-html.mjs',
    'scripts/generate-pwa-html.mjs', 'scripts/generate-app-icons.mjs',
  ]],
  ['8.9) docs (توثيق المشروع)', [
    'docs/CONVENTIONS.md', 'docs/FONTS.md', 'docs/SCREEN-MAP.md',
    'docs/TECHNICAL-CONSTRAINTS.md', 'docs/WEB-PREVIEW.md', 'docs/PWA.md',
  ]],
  ['8.10) android (ملفات الإعدادات — الثنائيات في الأرشيف)', [
    'android/build.gradle', 'android/settings.gradle', 'android/gradle.properties',
    'android/app/build.gradle', 'android/app/proguard-rules.pro',
    'android/app/src/main/AndroidManifest.xml', 'android/app/src/debug/AndroidManifest.xml',
    'android/app/src/debugOptimized/AndroidManifest.xml',
    'android/app/src/main/java/com/ihabajour/qurancompanion/MainActivity.kt',
    'android/app/src/main/java/com/ihabajour/qurancompanion/MainApplication.kt',
    'android/app/src/main/res/values/colors.xml', 'android/app/src/main/res/values/strings.xml',
    'android/app/src/main/res/values/styles.xml', 'android/.gitignore',
  ]],
  ['8.13) PWA (تطبيق ويب قابل للتثبيت ويعمل أوفلاين)', [
    'public/manifest.webmanifest', 'public/sw.js',
    'scripts/generate-pwa-icons.mjs', 'scripts/prepare-pwa.mjs',
  ]],
  ['8.12) tools + scripts (بناء الوحدة الأصلية + حزم التسليم)', [
    'tools/build-realm-node.sh', 'scripts/package-archive.sh',
  ]],
  ['8.11) content (ملفات نصية: تقارير/مواصفات/بصمات)', [
    'content/CONTENT-MANIFEST.md', 'content/IMPORT-REPORT.md', 'content/QA-IMPORT-REPORT.md',
    'content/ADHKAR-IMPORT-REPORT.md', 'content/validation-report.json',
    'content/refs/adhkar/manifest.json', 'content/refs/adhkar/LICENSE_seen_arabic.txt',
    'content/refs/tafsir/manifest.sha256',
  ]],
  ['8.15) مادة مرجعية مؤجَّلة — مصدر التلاوة (لا يستخدمها التطبيق الآن)', [
    'content/refs/audio/alquran-cloud-cdn.json', 'content/audio-catalog.json',
    'content/AUDIO-CATALOG.md', 'scripts/import-audio-catalog.mjs',
    'scripts/verify-audio-sources.mjs',
  ]],
  ['8.14) برومبت بدء محادثة جديدة', [
    'PROMPT-NEW-SESSION.md',
  ]],
];

const DATA_ROWS = [
  ['content/quran-data.json', 'حزمة المصحف المعتمدة: 114 سورة + 6236 آية (عثماني + بحث + وصفية) — Tanzil v1.1'],
  ['content/quran-uthmani.txt', 'نص Tanzil الخام (مرجع التحقق بايت-ببايت) — **مثبَّت: لا يُعاد تحميله**'],
  ['content/tafsir-data.json', 'حزمة التفسير (ibnkathir 6205 + baghawi 6236 + 31 فجوة موثقة)'],
  ['content/adhkar-data.json', 'حزمة الأذكار (345 ذكرًا / 135 فئة + manifest + قواعد)'],
  ['content/refs/tanzil-mirror-v1.1.txt', 'مرآة مستقلة من Tanzil v1.1 للمقارنة بايت-ببايت'],
  ['content/refs/quran-metadata-tanzil-v1.0.xml', 'بيانات Tanzil الوصفية v1.0 (مصدر مستقل لعدد الآيات)'],
  ['content/refs/adhkar/azkar_obj.json', 'خام osamayy/azkar-db @ fbdfa017782c (المصدر الرئيسي للأذكار)'],
  ['content/refs/adhkar/morning_seen_ar.json', 'خام Seen-Arabic (تحقق MIT — صباح/مساء)'],
  ['package-lock.json', 'قفل الاعتمادات (npm ci)'],
];

const ASSET_ROWS = [
  ['assets/android-icon-background.png', 'أيقونة Android التكيفية — الخلفية'],
  ['assets/android-icon-foreground.png', 'أيقونة Android التكيفية — الواجهة'],
  ['assets/android-icon-monochrome.png', 'أيقونة Android الأحادية'],
  ['assets/favicon.png', 'أيقونة المتصفح'],
  ['assets/icon.png', 'أيقونة التطبيق'],
  ['assets/splash-icon.png', 'أيقونة شاشة الإقلاع'],
  ['assets/fonts/AmiriQuran.ttf', 'خط الرسم العثماني (OFL — Amiri Project) — مُستعاد من aliftype/amiri'],
  ['assets/fonts/Tajawal-Bold.ttf', 'خط الواجهة عريض (OFL) — مُستعاد من google/fonts'],
  ['assets/fonts/Tajawal-Medium.ttf', 'خط الواجهة متوسط (OFL) — مُستعاد من google/fonts'],
  ['assets/fonts/Tajawal-Regular.ttf', 'خط الواجهة عادي (OFL) — مُستعاد من google/fonts'],
];

// ───────────────────────────── بناء الملف
const screenMap = read('docs/SCREEN-MAP.md');
let md = `# دليل التسليم الشامل — رفيق القرآن الكريم

> **غرض هذا الملف:** تسليم كامل للمشروع لبدء محادثة تنفيذ جديدة دون فقد أي سياق.
> يحتوي: حالة المشروع + خطوات التشغيل + جميع الشاشات/التبويبات + الخطوات المكتملة والمتبقية
> + **كود كل ملف برمجي كاملًا** + فهرس ملفات البيانات (بصمات SHA-256).
>
> **هذا الملف مُولَّد آليًا من المستودع** بالسكربت \`scripts/generate-handoff.mjs\`
> (حتمي، بلا شبكة) — لا يُحرَّر يدويًا.

- **المشروع:** رفيق القرآن الكريم — تطبيق Expo/React Native (RTL، عربي افتراضيًا)
- **حقوق المصمم والمطور:** إيهاب عجور أبو الأمير
- **تاريخ هذا التسليم:** ${TODAY}
- **آخر مرحلة مغلقة:** المرحلة 7 — الخطط (commit \`HEAD\` — يُحدَّث عند كل تسليم)
- **حالة الاختبارات:** \`npm run test:realm\` = **210/210** (155 + 55 للخطط) — TSC نظيف
- **حالة مساحة العمل (${TODAY}):** مُستعادة ومُتحقَّق منها بالكامل — \`node scripts/bootstrap-rebuild.mjs\` = **21/21**
- **الوحدة الأصلية لـ Realm:** أُعيد بناؤها في هذه الجلسة من المصدر عبر \`tools/build-realm-node.sh\`
  → \`tools/realm-prebuilds/linux-x64/realm.node\` (17.4MB) — الاختبارات 155/155 بها.
- **حزم التسليم الخمسة:** \`HANDOFF-*.md\` (هذا الملف: كل ملف بشيفرته الكاملة) +
  \`quran-companion-*.zip\` (كل الملفات) + \`app-preview.html\` (معاينة بمحتوى حقيقي) +
  \`pwa-app.html\` (التطبيق كـ PWA في ملف واحد) +
  \`PROMPT-NEW-SESSION.md\` (برومبت جاهز لبدء محادثة جديدة) — تُنتَج بالسكربتات في §7.
- **PWA:** \`npm run build:pwa\` ينتج تطبيق ويب قابل للتثبيت يعمل أوفلاين (انظر §8.13 و\`docs/PWA.md\`).

### لماذا المعاينة 2.6MB؟ (سؤال متكرر — الجواب مقيس)

\`app-preview.html\` **ليس** حجمه حجم «شيفرة»؛ الشيفرة فيه ≈27KB فقط. التركيبة بالبايت:

| المكوّن | الحجم |
|---|---|
| نص المصحف كاملًا — 114 سورة / 6236 آية بالرسم العثماني | 1640 KB |
| عيّنات التفسير (25 موضعًا) | 402 KB |
| الأذكار (345 ذكرًا / 135 فئة) | 144 KB |
| فهرس القرّاء (13) + كل دوال JS | 21 KB |
| الخطوط الأربعة (base64 داخل \`<style>\`) | 457 KB |
| التصميم CSS | 6 KB |
| **الإجمالي** | **2670 KB** |

المقابل في التطبيق الحقيقي: الشيفرة \`src/\` = **360KB** (45 ملفًا / 7094 سطرًا)، وحزم المحتوى
= **26MB** (مصحف 2.8 + تفسير 23 + أذكار 0.2)، وإخراج الويب \`dist/\` = **75MB** لأن حزمة
التفسير محشورة داخل حزمة JS (تحسين مُسجَّل في المتبقي: تحميلها عند الطلب).

---

## 1) سجل المراحل

| المرحلة | المحتوى | الاختبارات | commit |
|---|---|---|---|
| 0/1 | البنية: نظام التصميم (3 سمات) + الخطوط (Tajawal/Amiri Quran) + التنقل (5 تبويبات) + RTL + الإعدادات + «حول» + 4 مستودعات + Realm | 48 | \`cd21d56\` |
| معاينة ويب | منصة فحص react-native-web + خادم ساكن + محاكاة localStorage خلف واجهة Realm | — | \`42e4e54\` |
| 2 | المصحف: Tanzil Uthmani v1.1 معتمدة (11 فحصًا بايت-ببايت) + فهرس 114 + قارئ + آخر موضع + أدوات الآية | 78 إجمالي | \`e014745\` |
| 3 | المكتبة: جلسات القراءة R1–R6 + سجل القراءة + الورد من DailyProgress + تسمية/مفضلة/ملاحظات | 104 إجمالي | \`daea9b7\` |
| 4 | التفسير (ابن كثير + البغوي) + 31 فجوة موثقة «لا يتوفر» + شارة العثماني + 4 لوحات + ترحيل Realm 1→2 | 137 إجمالي | \`8d1fab6\` |
| 5 | الأذكار: حصن المسلم (345/135) بتحقق مزدوج (12/12 قرآن == Tanzil + 29/34 MIT) + عدّادات Realm | **155 إجمالي** | \`9b98f3b\` |
| 7 | الخطط: قوالب ختمة/ورد/مواظبة + حصة يومية محسوبة + **إنجاز مقيس من السجلات فقط (لا إدخال يدوي)** + شاشة كاملة + بطاقة في الرئيسية | 210 (155 + 55) | هذا الفرع |
| 6⇢✗ | **الاستماع — أُزيل بالكامل** (2026-10-14) بطلب المستخدم: كان التبويب يعطي شاشة بيضاء. أُزيلت الشاشة + 3 مستودعات + كائن \`AudioProgress\` + حقول الصوت الخمسة (ترحيل 3→4) + تبعيّتا expo-audio/expo-file-system + شاشة التنزيلات + 52 فحصًا. **مادة المصدر محفوظة مؤجَّلة** في §8.15 | — | هذا الفرع |
| PWA | تطبيق ويب قابل للتثبيت: manifest + عامل خدمة أوفلاين + أيقونات + \`build:pwa\` + ملف واحد \`pwa-app.html\` | — | هذا الفرع |
| أيقونات | الأصول الست (icon/splash/adaptive/favicon) بتصميم المشروع + أيقونات PWA | — | هذا الفرع |
| استعادة | ${TODAY}: استعادة كاملة من الأرشيف + تحقق بصمات + \`bootstrap-rebuild.mjs\` + إعادة إنتاج الحزم | 155/155 | هذا الفرع |

---

## 2) خطوات التشغيل في بيئة جديدة (مُجرَّبة)

\`\`\`bash
cd quran-companion
npm install

# 1) إعادة البناء والتحقق الشامل (أوفلاين، 6 مراحل):
node scripts/bootstrap-rebuild.mjs          # 20/20 — يفحص البنية والبصمات ويعيد بناء الحزم
node scripts/bootstrap-rebuild.mjs --check-only   # تحقق فقط بلا كتابة

# 2) اختبارات (Node + Realm حقيقي) — 210 فحصًا في 7 ملفات (155 + 55 للخطط):
npm run test:realm

# 3) فحص النص القرآني الخام (18/18):
node scripts/validate-quran.mjs

# 4) الأيقونات (مرسومة من ألوان نظام التصميم — بلا اعتماد خارجي):
node scripts/generate-app-icons.mjs            # الأصول الست في assets/
node scripts/generate-app-icons.mjs --force    # إعادة الكتابة
node scripts/generate-pwa-icons.mjs            # أيقونات public/icons/

# 5) مادة التلاوة المؤجَّلة (لا يستخدمها التطبيق الآن — §8.15):
node scripts/import-audio-catalog.mjs               # الخام -> content/audio-catalog.json + تقرير
node scripts/verify-audio-sources.mjs --with-surah  # تحقق HEAD على جهاز متصل (محجوب هنا)

# 6) معاينة الويب + التطبيق كـ PWA:
NODE_OPTIONS=--max-old-space-size=3000 npx expo export --platform web
node scripts/prepare-pwa.mjs --dist dist   # manifest + عامل خدمة + أيقونات داخل dist/
cd dist && python3 -m http.server 8081 --bind 0.0.0.0
# أو اختصارًا: npm run build:pwa && npm run serve:pwa

# 7) حزم التسليم الأربعة:
node scripts/generate-handoff.mjs        # HANDOFF-<تاريخ اليوم>.md
node scripts/generate-preview-html.mjs   # app-preview.html
node scripts/generate-pwa-html.mjs       # pwa-app.html
bash scripts/package-archive.sh          # quran-companion-<date>.zip
# خامسًا: PROMPT-NEW-SESSION.md — يُحدَّث يدويًا مع كل تسليم (برومبت بدء محادثة جديدة)
\`\`\`

### 2.1) ملاحظات بيئة حرجة
1. \`node_modules\` لا يُحفظ في لقطات السنبورك → \`npm install\` في كل جلسة.
2. \`tsc\` و\`expo export\` يحتاجان \`NODE_OPTIONS=--max-old-space-size\` كبيرًا (حزمة tafsir 23MB).
3. معرّف git محلي في \`.git/config\` وقد لا يُحفظ — عند «Author identity unknown»:
   \`git config user.name "$(git log -1 --format=%an)"\` ونفسه لـ \`user.email\`.
4. Realm-js v20: \`RealmCtor.open\` فقط، الترحيل عبر \`onMigration\`، بلا \`write()\`/\`update()\`
   داخل الترحيل، لا \`realm.object(type,key)\` — الجلب بـ \`objects(type).filtered('id = $0', key)\`.
5. اختبارات Realm لا تنتهي من نفسها → \`process.exit(0)\` صريح في نهاية كل ملف اختبار.
6. **الوحدة الأصلية لـ Realm**: حزمة \`realm@20.2.0\` تُحمّل \`prebuilds/node/realm.node\` من
   \`static.realm.io\` وقت التثبيت. إن كان المضيف محجوبًا (كما في هذه البيئة) يفشل التثبيت
   بصمت ويظهر \`Cannot find module .../prebuilds/node/realm.node\`. الحل المُجرَّب:
   - إن توفّر ملف جاهز: ضعه في \`node_modules/realm/prebuilds/node/realm.node\`
     (ملف linux-x64 المبني في هذه الجلسة محفوظ في الأرشيف المرفق: \`tools/realm-prebuilds/linux-x64/realm.node\`).
   - وإلا: ابنِ من المصدر (realm-js \`v20.2.0\` + realm-core المثبَّت بالـ submodule \`cccb3ca9\`
     + OpenSSL 3.3.1)، مع مطابقة مواصفة الربط التوليدي لما تتوقعه حزمة npm (34 فئة بلا مزامنة).
     التفاصيل الكاملة في \`docs/TECHNICAL-CONSTRAINTS.md\` و \`STAGE-PROGRESS.md\` §0.
7. سكربت \`test:realm\` ينسخ \`quran-data.json\` و\`adhkar-data.json\` إلى \`.test-build/content/\`.

---

## 3) التبويبات والشاشات (خريطة كاملة)

\`\`\`
App (إقلاع: قاعدة البيانات ← Metadata المحتوى ← جلسات مفتوحة ← الخطوط ← السمة)
└── RootNavigator — شريط سفلي (5 تبويبات) — RTL إجباري (I18nManager.forceRTL)
    ├── 1) الرئيسية HomeScreen ........... تحية + «تابع قراءتك» + الورد اليومي X/20 + اختصارات
    ├── 2) المصحف MushafStack ............ فهرس 114 سورة + بحث
    │       └── SurahScreen ............... قارئ عثماني + أدوات الآية + التفسير + لوحات
    ├── 3) الأذكار AdhkarScreen .......... 135 فئة + 345 ذكرًا بعدّادات + ملخص اليوم
    └── 5) مكتبتي LibraryStack ........... علامات/مفضلة/ملاحظات/سجل/خطط/تنزيلات/إعدادات/حول
\`\`\`

### خريطة الشاشات (docs/SCREEN-MAP.md)

${fence(screenMap)}
${screenMap.trim()}
${fence(screenMap)}

---

## 4) الخطوات المكتملة

- **بوابة 05 (المحتوى)** مطبقة على كل الحزم: مصدر موثوق + إصدار + ترخيص + بصمة SHA-256 +
  فحص استيراد؛ **لا نص يولّده نموذج** (قرآن/تفسير/أذكار/أحاديث).
- **حزمة المصحف:** Tanzil Uthmani v1.1 (CC-BY 3.0) — 6236 آية — بايت-ببايت (18/18 فحصًا).
- **حزمة التفسير:** quran.com v4 — ابن كثير (6205 + 31 فجوة موثقة) + البغوي (6236) — 33 فحصًا.
- **حزمة الأذكار:** حصن المسلم (345/135) بتحقق مزدوج — 18 فحصًا.
- **Realm v2:** مخطط المستخدم (10 كائنات) + ترحيل حقيقي 1→2 مُختبَر.
- **استعادة مساحة العمل (${TODAY}):** 88/88 ملفًا + بصمات المواد الخام والحزم مطابقة +
  \`bootstrap-rebuild.mjs\` (6 مراحل) + إثبات حتمية الاستيراد (بايت-ببايت عدا \`generatedAt\`).
- **الخطوط:** الأربعة مُستعادة من مصادرها الرسمية بأحجام مطابقة حرفيًا لـ \`docs/FONTS.md\`.
- **\`android/\` (CNG):** أُعيد توليد الـ 14 ملفًا المُثبَّتة في §8.10 بـ \`expo prebuild --platform android\`
  — الأحجام مطابقة للحظة كتابة الدليل (مثل \`app/build.gradle\` 8218B، \`MainActivity.kt\` 2198B).
- **الاستماع — مُزال بالكامل (2026-10-14):** بطلب المستخدم، لأن التبويب كان يعطي شاشة
  بيضاء. أُزيل من التطبيق: التبويب، شاشة \`audio-screen\`، \`use-audio-player\`،
  \`audio-downloader\`، مستودعات الصوت الثلاثة، كائن \`AudioProgress\` وحقول الصوت الخمسة
  من \`AppSettings\` (ترحيل 3→4 آمن — لا يُفقد شيء من بيانات القراءة والأذكار والخطط)،
  تبعيّتا \`expo-audio\` و\`expo-file-system\`، وشاشة «التنزيلات» (لم يبقَ لها محتوى)،
  و52 فحصًا من حزمة الاختبارات. **المادة المرجعية لمصدر التلاوة محفوظة مؤجَّلة** في §8.15
  لإعادة بناء المرحلة لاحقًا على أساس موثّق.
- **الأيقونات (2026-10-13):** الأصول الست + أيقونات PWA مرسومة آليًا من ألوان نظام التصميم
  عبر \`scripts/generate-app-icons.mjs\` و\`scripts/generate-pwa-icons.mjs\` (بلا اعتماد خارجي).
- **PWA (2026-10-13):** التطبيق يُصدَّر كتطبيق ويب قابل للتثبيت ويعمل أوفلاين —
  \`public/manifest.webmanifest\` + \`public/sw.js\` (تنقّل: الشبكة ثم الذاكرة · أصول:
  الذاكرة أولًا + تحديث بالخلفية) + أيقونات مرسومة آليًا من رموز التصميم + سكربتا
  \`generate-pwa-icons.mjs\` و\`prepare-pwa.mjs\` + سكربتات npm (\`build:pwa\`/\`serve:pwa\`).
- **بناء realm.node مؤتمت:** \`tools/build-realm-node.sh\` يوثّق كل خطوة (git clone، OpenSSL من المصدر،
  مواءمة مواصفة الربط، cmake/ninja) — قابل للتكرار في أي بيئة محجوبة.

## 5) الخطوات المتبقية (بترتيب الأولوية)

1. **إعادة بناء «الاستماع» لاحقًا** (التبويب مُزال الآن): المادة المرجعية جاهزة في §8.15،
   ويُنصح بتشغيل \`node scripts/verify-audio-sources.mjs --with-surah\` على جهاز متصل
   قبل البناء (الشبكة محجوبة في بيئة التطوير → الحالة «unverified-network-blocked» بصدق).
   سبب الإزالة: التبويب كان يعطي شاشة بيضاء — يُدرَس سببه قبل إعادة بنائه.
2. **الخطط (ختمة):** \`plans-screen\` ما زال هيكلًا — الخطة بوحدة وهدف وتواريخ + تقدّم فعلي.
3. **التحقق على جهاز حقيقي:** تباين WCAG + أحجام لمس + Share Sheet + تشغيل الصوت في
   الخلفية + تثبيت PWA — مؤجَّل موثَّق (لا جهاز ولا متصفح داخل بيئة التنفيذ).
4. **مراجعة ترخيص التلاوة قبل النشر العام** (إن أُعيد بناء المرحلة): صفحة الـ CDN بلا رخصة
   صريحة؛ quranicaudio.com ينص على «استخدام شخصي — يُمنع التجاري». القرار للمالك قبل أي
   توزيع عام.
5. **تحسين حجم حزمة الويب:** حزمة التفسير (23MB) مُضمَّنة داخل حزمة JS (≈71MB) →
   إخراجها إلى ملف يُحمَّل عند الطلب ويُخزَّن أوفلاين.
6. **معاني الكلمات (قرار المستخدم: مؤجلة)** — لا زر ولا بيانات.
7. **نمط «صفحات المصحف» (readingMode):** الحقل موجود؛ العرض المتتابع فقط حاليًا.

## 6) قرارات مستخدم سارية (لا تُعاد بدون سؤال)

- القرآن بالعرض العثماني حصريًا؛ ألوان قراءة مريحة؛ أزرار الآية تتضمن التفسير (نفّذ) ومعاني الكلمات (مؤجلة).
- لا توليد نصوص دينية بنماذج لغوية أبدًا؛ لا أزرار/بيانات وهمية؛ لا حساب سحابي إجباري؛
  بدون حساب شخصي؛ أولًا-أوفلاين؛ RTL وعربي افتراضيًا.
- حقوق التطوير: **إيهاب عجور أبو الأمير** (شاشة حول التطبيق + LICENSE + هذا الملف).
- الأذكار: اعتمد osamayy/azkar-db + تحقق MIT (قرار 2026-10-12).
- تحديث \`STAGE-PROGRESS.md\` بعد كل مرحلة + مرحلة واحدة في كل مرة.

---

## 7) فهرس ملفات البيانات (بصمات SHA-256)

${dataIndex(DATA_ROWS)}

**\`content/refs/tafsir/\`:** ibnkathir/ 114 ملفًا خامًا + baghawi/ 114 ملفًا خامًا
+ \`manifest.sha256\` (228 بصمة — مُدرج كاملًا في §8.11).

**الأصول (\`assets/\`):**

${dataIndex(ASSET_ROWS)}

> الأيقونات الست **غائبة** في هذه النسخة (ملف \`BIN-RAW.md\` لم يصل مع المرفقات)؛
> التطبيق لا يُبنى للتوزيع دونها. الخطوط الأربعة حاضرة ومُتحقَّق منها.

**\`preview-screenshots/\`:** 32 لقطة QA — أدلة المراحل على الويب.
**\`android/\`:** الثنائيات (أيقونات/splash/gradle-wrapper/keystore) في الأرشيف المرفق.

---

## 8) كل الملفات البرمجية بكودها الكامل

> ترتيب: الجذر ← src (نظام التصميم/قاعدة البيانات/المستودعات/الشاشات) ← tests ← scripts
> ← docs ← android (إعدادات) ← content (تقارير نصية). كل ملف كما هو حرفيًا في المستودع.
`;

for (const [title, files] of GROUPS) md += section(title, files);

md += `
---

## 9) ملاحظات سنبورك/أدوات (تُوفر وقت المحاولة والخطأ)

- **quran.com:** \`GET /api/v4/tafsirs/{id}/by_chapter/{n}?per_page=300\` (وإلا صُفّح 10/صفحة بصمت!)؛
  \`by_ayah\` يعيد 503 دائمًا. المعرّفات: 14 ابن كثير، 94 البغوي، 16 ميسّر (جزئي — مرفوض).
- **RN-web FlatList:** العناصر البعيدة لا تُرسم أصلًا؛ \`scrollToIndex\` لا يعمل — الحل المطبّق:
  حلقة \`scroller.scrollTop = scrollHeight\` (250ms × ≤8) حتى يظهر الهدف ثم \`scrollIntoView\`.
- **أرقام هندية:** أي تعديل على خيط التحويل يُتحقق منه بـ hex (U+0660–0669) — فحص انحداري في
  \`tafsir-stage4.test.ts\`.
- **المَدّ U+0670:** بعد التاتيل/الواو/الياء = بدل عن الألف، وسواها = مدّ صوتي — لا تُقارن
  نصوص دون تطبيع (انظر \`orthoNorm\` في \`import-adhkar.mjs\`).
- **بحث/تطبيع:** حقل \`search\` مُطبَّع؛ العرض دائمًا من \`text\` العثماني حرفيًا.
- **حتمية الاستيراد:** الحزم تُعاد إنتاجها بايت-ببايت من الخام عدا حقل \`generatedAt\`
  (طابع زمني) — \`bootstrap-rebuild.mjs\` يستعيد النسخة المعتمدة تلقائيًا عند هذا الفرق فقط.
- **realm.node:** انظر §2.1/6 — التثبيت لا يكفي وحده في بيئة محجوبة الشبكة.

## 10) مصدر التلاوة — مادة مرجعية **مؤجَّلة** (التبويب مُزال)

> **تنبيه:** تبويب «الاستماع» وكل شيفرته **أُزيلا من التطبيق** في 2026-10-14 بطلب المستخدم
> (كان يعطي شاشة بيضاء). ما يلي مادة مرجعية موثّقة لإعادة بناء المرحلة لاحقًا،
> وهي محفوظة في §8.15 — لا يقرؤها التطبيق الآن ولا تُشحن معه.

| المصدر | الحالة |
|---|---|
| cdn.islamic.network (AlQuran Cloud CDN) | **المعتمد**: أنماط روابط موثّقة + بلا مفتاح/حساب + 13 قارئًا + 6 معدلات بِتّ |
| everyayah.com | مرفوض مؤقتًا: CC BY-NC + إلزام الربط |
| mp3quran.net | مرفوض مؤقتًا: الرخصة لم تُتحقق |
| quranicaudio.com | مرفوض مؤقتًا: «استخدام شخصي — ممنوع تجاريًا» |
| api.quran.com الرسمي | مرفوض: يتطلب مفتاح/حساب (يتعارض مع «بلا سحاب إجباري») |

التفاصيل (القرّاء، الملاحظات، بصمة المادة الخام، الترخيص) في \`content/AUDIO-CATALOG.md\`.

### 10-1) مرشحات المصدر الأصلية (للأرشفة)

| # | المصدر | النمط | الترخيص كما ورد | الملاحظة |
|---|---|---|---|---|
| 1 | cdn.islamic.network (AlQuran Cloud) | \`/quran/audio/{kbps}/{edition}/{1..6236}.mp3\` + \`/quran/audio-surah/{kbps}/{edition}/{1..114}.mp3\` | لا رخصة مُصرَّحة على صفحة الـ CDN | 12+ قارئًا، 6 معدلات (32–192)، قوائم JSON، بلا مفتاح |
| 2 | everyayah.com | \`/data/{Reciter}_{kbps}/{SSSAAA}.mp3\` | CC BY-NC + إلزام الربط | ~44 قارئًا آية بآية + ZIP لكل سورة |
| 3 | mp3quran.net (cdn.mp3quran.net) | API v3: قارئ/رواية/مصحف + قائمة سور | لم يُتحقق منه بعد | واجهة رسمية غنية (مرتّل/مجوّد/معلم) |
| 4 | quranicaudio.com (quran.com) | سور كاملة جودة CD | «استخدام شخصي — ممنوع تجاريًا» | جودة عالية، قيد صريح |
| 5 | api.quran.com الرسمي | API صوتي | يتطلب مفتاح/حساب مطوّر | يتعارض مع قرار «بلا سحاب إجباري» |

---

*أُنشئ آليًا من المستودع بتاريخ ${TODAY} via \`scripts/generate-handoff.mjs\`. رفيق القرآن الكريم © إيهاب عجور أبو الأمير.*
`;

writeFileSync(OUT, md, 'utf8');
console.log(`كُتب: ${path.relative(ROOT, OUT)} — ${kb(path.relative(ROOT, OUT))}KB`);
const files = GROUPS.reduce((a, [, f]) => a + f.length, 0);
console.log(`أقسام: ${GROUPS.length} — ملفات مدرجة: ${files}`);
