#!/usr/bin/env node
/**
 * إعادة بناء مساحة العمل والتحقق منها — bootstrap-rebuild (HANDOFF §2.1).
 *
 * الغرض: إثبات أن مساحة العمل يمكن إعادة إنشائها والتحقق منها بالكامل **دون اتصال**
 * ومن مواد خام مثبتة بالبصمة، قبل السماح بأي عمل جديد (بوابة: 155/155 في test:realm).
 *
 * المراحل (بالترتيب):
 *   [1] بنية المستودع — كل ملف مذكور في HANDOFF.md §8 (8.1–8.11) موجود وحجمه مطابق.
 *   [2] المواد الخام المثبتة — بصمات SHA-256 للنص/المرآة/الوصفية/مراجع الأذكار
 *       (QURAN-RAW مثبت مسبقًا في content/ — لا يُعاد تحميله من الموقع).
 *   [3] إعادة البناء — تشغيل مستوردي المحتوى (import-quran / import-adhkar /
 *       import-quran-qa) لإنتاج الحزم من الخام حتميًا (بلا شبكة).
 *   [4] البصمات بعد البناء — إن لم تُطابق الحزم المُعاد بناؤها البصمات المثبتة
 *       بايت-ببايت: تُستعاد النسخ الأصلية ويُبلَّغ الفشل صراحةً (لا صمت، لا ترقيع).
 *   [5] بيئة الاختبار — وجود الوحدة الأصلية لـ Realm (اختبارات test:realm تحتاجها).
 *   [6] الأصول الثنائية assets/ — الأيقونات والخطوط (من BIN-RAW)؛ غيابها لا يمنع
 *       الاختبارات لكنه يمنع تشغيل التطبيق.
 *
 * قواعد المشروع الحاكمة هنا:
 *  - لا توليد نصوص دينية: هذا السكربت لا ينشئ نصًا قرآنيًا ولا تفسيرًا ولا ذكرًا؛
 *    كل ما يفعله: استيراد حتمي + تحقق + مقارنة بصمات.
 *  - أولوية أوفلاين: لا أي طلب شبكي في أي مرحلة.
 *  - الأثر الجانبي محصور: كل ملف يُلمَس يُنسخ احتياطيًا إلى .bootstrap-out/ أولًا.
 *
 * الاستدعاء:
 *   node scripts/bootstrap-rebuild.mjs               # إعادة بناء كاملة + تحقق
 *   node scripts/bootstrap-rebuild.mjs --check-only  # تحقق فقط (بلا كتابة)
 *   node scripts/bootstrap-rebuild.mjs --skip-tafsir # تخطّي إعادة بناء حزمة التفسير
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HANDOFF = path.join(ROOT, 'HANDOFF.md');
const OUT_DIR = path.join(ROOT, '.bootstrap-out');

const argv = process.argv.slice(2);
const CHECK_ONLY = argv.includes('--check-only');
const SKIP_TAFSIR = argv.includes('--skip-tafsir');

let pass = 0;
let fail = 0;
const failures = [];
const warnings = [];

function check(name, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
  }
  return ok;
}

function warn(name, detail = '') {
  warnings.push(name);
  console.log(`  ! ${name}${detail ? ' — ' + detail : ''}`);
}

function sha256File(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

/**
 * البصمات المثبتة.
 * المصدر: HANDOFF.md §7 (بصمات مبثوثة — أول 16 خانة) و content/CONTENT-MANIFEST.md
 * (البصمة الكاملة للنص) و content/refs/adhkar/manifest.json (بصمات مراجع الأذكار).
 * بصمات الحزم الثلاث مُثبَتة هنا بالقيمة الكاملة المقيسة على التسليم المُعتمد
 * (commit 9b98f3b) — أي انحراف بعد إعادة البناء = فشل صريح.
 */
const PINNED = [
  {
    file: 'content/quran-uthmani.txt',
    sha256: '7f30c647331a61100ebf24a80507dc0fcdd9f2df97f1312b5b2dfcb982a7f326',
    kind: 'raw',
    note: 'نص المصحف الخام (Tanzil Uthmani v1.1) — مثبت، لا يُعاد تحميله',
  },
  {
    file: 'content/refs/tanzil-mirror-v1.1.txt',
    sha256: 'f64fe7657dbe2e185e9995e14f7a67ee6cf1a30773f39184883d7a763d70fb19',
    kind: 'raw',
    note: 'مرآة مستقلة للمقارنة بايت-ببايت',
  },
  {
    file: 'content/refs/quran-metadata-tanzil-v1.0.xml',
    sha256: '8867c1d88191472adec9db694b3cd9f135b1a2ef580574d32cf888dcb22c5c7a',
    kind: 'raw',
    note: 'بيانات Tanzil الوصفية v1.0 (مصدر مستقل لعدد الآيات)',
  },
  {
    file: 'content/refs/adhkar/azkar_obj.json',
    sha256: 'a8daa71a118a9a659effb361a826e99fe7e2e1dec391fe77735f8e17c2be62b3',
    kind: 'raw',
    note: 'خام osamayy/azkar-db @ fbdfa017782c',
  },
  {
    file: 'content/refs/adhkar/morning_seen_ar.json',
    sha256: '9e0dd6a10d26ddc0e2b36b94098c287644996c7f81b707f8ad24f1ce40b8c821',
    kind: 'raw',
    note: 'خام Seen-Arabic (تحقق MIT)',
  },
  {
    file: 'content/quran-data.json',
    sha256: '81b5e6e5f9b7e118ab8205dcacbe71650b4bf3d9371d3c33f8068645693819fb',
    kind: 'pack',
    note: 'حزمة المصحف (114 سورة / 6236 آية)',
  },
  {
    file: 'content/tafsir-data.json',
    sha256: 'a94c8030cc70b6c7d89316b658d33e3b24b52f87c9dab966bae47ee0958ba325',
    kind: 'pack',
    note: 'حزمة التفسير (ابن كثير 6205 + البغوي 6236)',
  },
  {
    file: 'content/adhkar-data.json',
    sha256: '839075beea5f933d18dba6742b33611c07d70bcf54ae3e7ff4b76f835c5512e0',
    kind: 'pack',
    note: 'حزمة الأذكار (345 ذكرًا / 135 فئة)',
  },
];

/** مستوردو المحتوى: الحزمة الناتجة ← السكربت (الكل يعمل دون اتصال) */
const IMPORTERS = [
  { script: 'scripts/import-quran.mjs', pack: 'content/quran-data.json', label: 'المصحف' },
  { script: 'scripts/import-adhkar.mjs', pack: 'content/adhkar-data.json', label: 'الأذكار' },
  {
    script: 'scripts/import-quran-qa.mjs',
    pack: 'content/tafsir-data.json',
    label: 'التفسير',
    skip: SKIP_TAFSIR,
  },
];

/** ملفات التقارير التي يعيد المستوردون كتابتها (قد تتغير تواريخها فقط) */
const REPORT_FILES = [
  'content/IMPORT-REPORT.md',
  'content/QA-IMPORT-REPORT.md',
  'content/ADHKAR-IMPORT-REPORT.md',
  'content/validation-report.json',
  'content/refs/tafsir/manifest.sha256',
];

/** الأصول الثنائية (BIN-RAW) — من HANDOFF §7: الاسم ← الحجم بالكيلوبايت */
const ASSETS = [
  ['assets/android-icon-background.png', 17.1],
  ['assets/android-icon-foreground.png', 76.9],
  ['assets/android-icon-monochrome.png', 4.0],
  ['assets/favicon.png', 1.1],
  ['assets/icon.png', 384.3],
  ['assets/splash-icon.png', 17.1],
  ['assets/fonts/AmiriQuran.ttf', 164.0],
  ['assets/fonts/Tajawal-Bold.ttf', 58.6],
  ['assets/fonts/Tajawal-Medium.ttf', 60.8],
  ['assets/fonts/Tajawal-Regular.ttf', 58.9],
];

function humanKB(bytes) {
  return Math.round((bytes / 1024) * 10) / 10;
}

console.log('══ bootstrap-rebuild — رفيق القرآن الكريم ══');
console.log(CHECK_ONLY ? 'النمط: تحقق فقط (بلا إعادة بناء)' : 'النمط: إعادة بناء كاملة + تحقق');
console.log('');

// ───────────────────────────── [1] بنية المستودع (HANDOFF §8.1–8.11)
console.log('— [1] بنية المستودع (كل ملف في HANDOFF §8) —');
{
  const handoff = readFileSync(HANDOFF, 'utf8');
  const lines = handoff.split('\n');
  // سطر الفهرس: #### `المسار`  ·  4.3KB
  const entries = [];
  for (const line of lines) {
    const m = /^####\s+`([^`]+)`\s*·\s*([0-9]+(?:\.[0-9]+)?)\s*(KB|B)\b/.exec(line);
    if (m) entries.push({ file: m[1], kb: m[3] === 'B' ? Number(m[2]) / 1024 : Number(m[2]) });
  }
  const m2 = entries.length;
  check(`عدد ملفات الفهرس في HANDOFF §8 معقول (${m2})`, m2 >= 40, 'تحقّق من صيغة الفهرس');

  // سجلات حيّة: يُتحقق من وجودها فقط، لأن أحجامها تنمو طبيعيًا مع كل مرحلة
  // (الحجم المُثبّت في HANDOFF §8 يعكس لحظة كتابة الدليل، لا الحجم النهائي).
  const SIZE_EXEMPT = new Set([
    'STAGE-PROGRESS.md',   // سجل مراحل حيّ
    // ملفات نُفِّذت بعد كتابة الدليل: كان الدليل يورد حجم «الهيكل» (stub)،
    // والتنفيذ الفعلي للمرحلتين 5 و6 كبّرها — النمو مقصود ومُوثَّق، لا تلف.
    'src/database/realm/realm.ts',            // + ترحيل 2→3
    'src/database/realm/schemas.ts',          // + AudioProgress + حقول الصوت
    'src/database/realm/types.ts',            // + أنواع الصوت
    'src/features/audio/audio-screen.tsx',    // شاشة الاستماع كاملة
    'src/features/home/home-screen.tsx',      // + بطاقة «تابع استماعك»
    'src/features/library/downloads-screen.tsx', // شاشة التنزيلات كاملة
    'src/features/library/plans-screen.tsx',    // شاشة الخطط كاملة (المرحلة 7)
    'docs/SCREEN-MAP.md',                     // + وصف شاشات المرحلة 6
  ]);
  let missing = 0;
  let sizeMismatch = 0;
  const missingList = [];
  const sizeList = [];
  const exemptList = [];
  for (const e of entries) {
    const p = path.join(ROOT, e.file);
    if (!existsSync(p)) {
      missing++;
      missingList.push(e.file);
      continue;
    }
    if (SIZE_EXEMPT.has(e.file)) {
      exemptList.push(`${e.file} (${humanKB(statSync(p).size)}KB بدل ~${e.kb}KB المُثبّتة — نموّ مقصود بالتنفيذ)`);
      continue;
    }
    const bytes = statSync(p).size;
    // الفهرس يورد الأحجام مقرّبة (مثل 4.3KB) — السماح 2% + 1KB
    const diff = Math.abs(bytes / 1024 - e.kb);
    if (diff > Math.max(1.0, e.kb * 0.02)) {
      sizeMismatch++;
      sizeList.push(`${e.file} (المتوقع ~${e.kb}KB / الفعلي ${humanKB(bytes)}KB)`);
    }
  }
  check(`كل ملفات §8 موجودة (${entries.length - missing}/${entries.length})`, missing === 0, missingList.join(' | '));
  const sizeBase = entries.length - missing - exemptList.length;
  check(
    `أحجام ملفات §8 مطابقة (${sizeBase - sizeMismatch}/${sizeBase})`,
    sizeMismatch === 0,
    sizeList.join(' | '),
  );
  if (exemptList.length) console.log(`  ~ ${exemptList.join(' | ')}`);
}

// ───────────────────────────── [2] بصمات المواد الخام المثبتة
console.log('');
console.log('— [2] بصمات المواد الخام المثبتة (لا تحميل من الشبكة) —');
{
  for (const item of PINNED.filter((p) => p.kind === 'raw')) {
    const p = path.join(ROOT, item.file);
    if (!existsSync(p)) {
      check(`${item.file}`, false, 'الملف غائب');
      continue;
    }
    const sha = sha256File(p);
    check(`${item.file} — ${item.note}`, sha === item.sha256, sha === item.sha256 ? '' : `البصمة ${sha.slice(0, 16)}… ≠ المثبتة ${item.sha256.slice(0, 16)}…`);
  }
}

// ───────────────────────────── [3] إعادة البناء من الخام
function backup(file) {
  const src = path.join(ROOT, file);
  if (!existsSync(src)) return null;
  const dest = path.join(OUT_DIR, file.replace(/\//g, '__'));
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  return dest;
}

function restore(file) {
  const dest = path.join(ROOT, file);
  const src = path.join(OUT_DIR, file.replace(/\//g, '__'));
  if (existsSync(src)) copyFileSync(src, dest);
}

/** هل يختلف الملف عن النسخة الاحتياطية في التواريخ فقط؟ (تقارير المستوردين) */
function differsOnlyByDate(file) {
  const cur = path.join(ROOT, file);
  const bak = path.join(OUT_DIR, file.replace(/\//g, '__'));
  if (!existsSync(cur) || !existsSync(bak)) return false;
  const norm = (s) =>
    s
      .replace(/20\d\d-\d\d-\d\dT[\d:.]+Z/g, '<ISO>')
      .replace(/20\d\d-\d\d-\d\d/g, '<DATE>')
      .replace(/\*\*التاريخ:\*\*[^\n]*/g, '<DATE>');
  return norm(readFileSync(cur, 'utf8')) === norm(readFileSync(bak, 'utf8'));
}

if (CHECK_ONLY) {
  console.log('');
  console.log('— [3] إعادة البناء — مُتخطّاة (--check-only) —');
} else {
  console.log('');
  console.log('— [3] إعادة بناء الحزم من المواد الخام (حتمي، بلا شبكة) —');
  mkdirSync(OUT_DIR, { recursive: true });
  // شرط البدء: الحزم الحالية مطابقة للبصمات المُعتمدة (لا إعادة بناء فوق حزمة منحرفة)
  let startClean = true;
  for (const item of PINNED.filter((p) => p.kind === 'pack')) {
    const p = path.join(ROOT, item.file);
    if (!existsSync(p) || sha256File(p) !== item.sha256) {
      startClean = false;
      console.log(`  ✗ نقطة البداية غير مُعتمدة: ${item.file}`);
    }
  }
  if (!startClean) {
    check('إعادة البناء من نقطة بداية مُعتمدة', false, 'أصلِح الحزم (أو استخرجها من الأرشيف) قبل إعادة البناء');
  } else {
    for (const f of [...IMPORTERS.map((i) => i.pack), ...REPORT_FILES]) backup(f);

    for (const imp of IMPORTERS) {
      if (imp.skip) {
        console.log(`  ~ تخطّي ${imp.label} (--skip-tafsir)`);
        continue;
      }
      const scriptPath = path.join(ROOT, imp.script);
      if (!existsSync(scriptPath)) {
        check(`${imp.label}: سكربت الاستيراد موجود`, false, imp.script);
        continue;
      }
      const r = spawnSync(process.execPath, [scriptPath], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      const out = `${r.stdout || ''}${r.stderr || ''}`;
      check(`${imp.label}: ${path.basename(imp.script)} اكتمل (exit ${r.status})`, r.status === 0, (out.trim().split('\n').slice(-3).join(' / ') || '').slice(0, 300));
    }
  }

  // إعادة التقارير التي تغيّرت تواريخها فقط (حفظ سجل الاعتماد الأصلي)
  let restored = 0;
  for (const f of REPORT_FILES) {
    if (differsOnlyByDate(f)) {
      restore(f);
      restored++;
    }
  }
  if (restored) console.log(`  ~ أُعيدت ${restored} تقريرًا (الفرق تواريخ فقط — حُفظ السجل الأصلي)`);
}

// ───────────────────────────── [4] بصمات الحزم بعد البناء
// ملاحظة حتمية موثّقة: الحقول الوحيدة غير الحتمية في الحزم هي طوابع «generatedAt»
// (زمن التشغيل). كل ما عداها يُعاد إنتاجه بايت-ببايت من المواد الخام المثبتة.
console.log('');
console.log('— [4] بصمات الحزم (حتمية الاستيراد: بايت-ببايت عدا طابع التوليد) —');
{
  const ISO = /20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d\.\d\d\dZ/g;
  const normalize = (file) => readFileSync(file, 'utf8').replace(ISO, '<ISO>');

  for (const item of PINNED.filter((p) => p.kind === 'pack')) {
    const p = path.join(ROOT, item.file);
    if (!existsSync(p)) {
      check(`${item.file}`, false, 'الحزمة غائبة');
      continue;
    }
    if (CHECK_ONLY) {
      const sha = sha256File(p);
      check(`${item.file} — ${item.note}`, sha === item.sha256, sha === item.sha256 ? '' : `البصمة ${sha.slice(0, 16)}… ≠ المثبتة ${item.sha256.slice(0, 16)}…`);
      continue;
    }
    const backupFile = path.join(OUT_DIR, item.file.replace(/\//g, '__'));
    const exact = sha256File(p) === sha256File(backupFile);
    const moduloDate = !exact && normalize(p) === normalize(backupFile);
    const ok = exact || moduloDate;
    check(
      `${item.file} — ${item.note}`,
      ok,
      ok ? '' : 'الحزمة المُعاد بناؤها تختلف عن الأصل في غير الطابع الزمني',
    );
    if (exact) {
      check(`  ↳ ${item.file}: مطابقة بايت-ببايت`, true);
    } else if (moduloDate) {
      console.log(`  ↳ ${item.file}: مطابقة بايت-ببايت عدا حقل «generatedAt» (طابع زمني) — أُعيد الأصل لحفظ سجل الاعتماد`);
      restore(item.file);
    } else {
      // لا نترك حزمة منحرفة في مكانها: استعادة الأصل + حفظ المُعاد بناؤه للفحص
      const rebuilt = path.join(OUT_DIR, `rebuilt-${path.basename(item.file)}`);
      copyFileSync(p, rebuilt);
      restore(item.file);
      console.log(`    ↩ استُعيد الأصل؛ النسخة المُعاد بناؤها محفوظة للفحص: ${path.relative(ROOT, rebuilt)}`);
    }
    // بعد الاستعادة: التأكد من أن الملف المُعتمد ما زال مطابقًا للبصمة المثبتة
    check(`  ↳ ${item.file}: البصمة المُعتمدة محفوظة`, sha256File(p) === item.sha256);
  }
}

// ───────────────────────────── [5] بيئة الاختبار (الوحدة الأصلية لـ Realm)
console.log('');
console.log('— [5] بيئة الاختبار —');
{
  const binding = path.join(ROOT, 'node_modules', 'realm', 'prebuilds', 'node', 'realm.node');
  if (existsSync(binding)) {
    check('وحدة Realm الأصلية (prebuilds/node/realm.node) متاحة', true);
  } else {
    warn(
      'وحدة Realm الأصلية غائبة — npm install لا تكفي وحدها',
      'ثبّت realm.node (napi v6) أو ابنها من المصدر قبل npm run test:realm',
    );
  }
  check('node_modules مثبّتة', existsSync(path.join(ROOT, 'node_modules', 'realm', 'package.json')));
}

// ───────────────────────────── [6] الأصول الثنائية (BIN-RAW)
console.log('');
console.log('— [6] الأصول الثنائية assets/ (أيقونات + خطوط) —');
{
  let missing = 0;
  for (const [file, kb] of ASSETS) {
    const p = path.join(ROOT, file);
    if (!existsSync(p)) {
      missing++;
      console.log(`  ✗ ${file} غائب (~${kb}KB)`);
    } else {
      const bytes = statSync(p).size;
      const diff = Math.abs(bytes / 1024 - kb);
      if (diff > Math.max(1.0, kb * 0.02)) {
        console.log(`  ! ${file} — حجمه ${humanKB(bytes)}KB ≠ المتوقع ~${kb}KB`);
      } else {
        console.log(`  ✓ ${file} (${humanKB(bytes)}KB)`);
      }
    }
  }
  if (missing) {
    warn(`${missing}/${ASSETS.length} من الأصول الثنائية غائبة`, 'التطبيق لا يقلع دونها (الخطوط/الأيقونات)؛ الاختبارات لا تحتاجها');
  } else {
    check('كل الأصول الثنائية حاضرة', true);
  }
}

// ───────────────────────────── النتيجة
console.log('');
console.log('════════════════════════════════════════');
console.log(`النتيجة: ${pass} نجح / ${fail} فشل — ${warnings.length} تحذير`);
if (failures.length) console.log('الفشل: ' + failures.join(' | '));
if (warnings.length) console.log('تحذيرات: ' + warnings.join(' | '));
console.log('════════════════════════════════════════');
process.exit(fail === 0 ? 0 : 1);
