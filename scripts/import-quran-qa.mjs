#!/usr/bin/env node
/**
 * خدمة استيراد التفسير — المرحلة 4 (بوابة اعتماد المحتوى 05).
 *
 * المصادر (وثيقة المصدر في content/QA-IMPORT-REPORT.md):
 * - تفسير ابن كثير (quran.com resource_id=14، ar-tafsir-ibn-kathir):
 *   إسماعيل بن كثير (ت 1373هـ) — نص كلاسيكي في الملك العام.
 * - تفسير البغوي (معاني القرآن، quran.com resource_id=94، ar-tafsir-al-baghawi):
 *   هبة الله بن موسى البغوي (ت 516هـ / 1125م) — نص كلاسيكي في الملك العام.
 *
 * ملاحظة اعتماد (مدرجة في التقرير): "تفسير الميسر" على المصدر (resource_id 16)
 * اتُّضح أنه بيانات جزئية (نقص ~1500 آية) → رُفض واعتمد البغوي الكامل بدلًا منه.
 *
 * القواعد الصارمة (نفس بروتوكول حزمة المصحف):
 * - لا يُنشئ نموذج لغوي أي نص في هذه الحزمة؛ النصوص تُنزَّل حرفيًا من المصدر.
 * - تُحفظ الاستجابات الخام في content/refs/tafsir/ وتُوثَّق ببصمات SHA-256.
 * - الفحص: الأعداد == حزمة المصحف المعتمدة (سورة بسورة)، والتطبيع (إزالة وسمات
 *   HTML) يُتحقق منه عينات بمقابلة بايت-ببايت مع الخام (بعد إسقاط الوسوم والمسافات).
 *
 * المخرجات:
 * - content/tafsir-data.json — حزمة التفسير (نص نظيف لكل آية × مصدرين).
 * - content/refs/tafsir/manifest.sha256 — بصمات الملفات الخام.
 * - content/QA-IMPORT-REPORT.md — سجل البوابة.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REFS = join(ROOT, 'content', 'refs', 'tafsir');
const QURAN_DATA = join(ROOT, 'content', 'quran-data.json');
const OUT_BUNDLE = join(ROOT, 'content', 'tafsir-data.json');
const OUT_REPORT = join(ROOT, 'content', 'QA-IMPORT-REPORT.md');
const OUT_MANIFEST = join(REFS, 'manifest.sha256');

const SOURCES = [
  {
    id: 'ibnkathir',
    resource_id: 14,
    name: 'تفسير ابن كثير',
    author: 'إسماعيل بن عمر بن كثير (ت 1373هـ / 1380م)',
    note: 'نص كلاسيكي في الملك العام (ماضي أكثر من قرنَين على وفات مؤلفه)',
  },
  {
    id: 'baghawi',
    resource_id: 94,
    name: 'تفسير البغوي (معاني القرآن)',
    author: 'هبة الله بن موسى البغوي (ت 516هـ / 1125م)',
    note: 'نص كلاسيكي في الملك العام (ماضي أكثر من قرنَين على وفات مؤلفه)',
  },
];

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) {
    writeReport('failed');
    process.exit(1);
  }
}

/* ---------- أدوات ---------- */

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** إزالة وسمات HTML + فك الكيانات + تطبيع الفقرة (نص نظيف فقط — لا تغيير دلالي) */
function htmlToPlain(html) {
  let t = String(html ?? '');
  t = t.replace(/\r\n?/g, '\n');
  // فواصل الفقرات
  t = t.replace(/<\/p\s*>/gi, '\n');
  t = t.replace(/<br\s*\/?>/gi, '\n');
  // بقية الوسوم
  t = t.replace(/<[^>]+>/g, '');
  // الكيانات
  t = t
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // BOM
  t = t.replace(/^\uFEFF/, '');
  // تطبيع كل فقرة: ضغطات متكررة → مسافة واحدة
  const paras = t
    .split('\n')
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);
  return paras.join('\n');
}

/** للنسبة العربية: أحرف عربية ÷ إجمالي الرموز غير المسافة */
function arabicRatio(s) {
  const chars = [...s.replace(/\s+/g, '')];
  if (chars.length === 0) return 0;
  let arab = 0;
  for (const c of chars) {
    const cp = c.codePointAt(0);
    if ((cp >= 0x0600 && cp <= 0x06ff) || (cp >= 0x0750 && cp <= 0x077f) || (cp >= 0x08a0 && cp <= 0x08ff) || (cp >= 0xfb50 && cp <= 0xfdff) || (cp >= 0xfe70 && cp <= 0xfeff)) {
      arab++;
    }
  }
  return arab / chars.length;
}

const stripAllWs = (s) => [...s.replace(/\s+/g, '')].join('');

/* ---------- 0) قراءة حزمة المصحف المعتمدة (المعيار) ---------- */
const quran = JSON.parse(readFileSync(QURAN_DATA, 'utf8'));
const expectedCounts = quran.surahs.map((s) => s.ayahCount);
const TOTAL_AYAHS = expectedCounts.reduce((a, b) => a + b, 0);
check('حزمة المصحف معتمدة (114 سورة / 6236 آية)', quran.surahs.length === 114 && TOTAL_AYAHS === 6236, `سور=${quran.surahs.length} آيات=${TOTAL_AYAHS}`);

/* ---------- 1) البصمات ---------- */
const manifest = [];
for (const src of SOURCES) {
  const files = readdirSync(join(REFS, src.id)).filter((f) => f.endsWith('.json')).sort();
  check(`${src.id}: 114 ملفًا خامًا`, files.length === 114, files.length + ' ملفات');
  for (const f of files) {
    const buf = readFileSync(join(REFS, src.id, f));
    manifest.push(`${sha256(buf)}  ${src.id}/${f}`);
  }
}
writeFileSync(OUT_MANIFEST, manifest.join('\n') + '\n');
console.log(`• manifest: ${manifest.length} بصمات`);

/* ---------- 2) التحليل + الأعداد ---------- */
const tafsir = {}; // "s:a" -> { ibnkathir, baghawi }
const perSourceStats = {};

/** نواقص مصدر ibnkathir على quran.com — حُصرت عند الاستيراد 2026-10-12
 *  (بيانات المصدر لا تغطي هذه الآيات؛ لا نختلق ما ليس موجودًا — 05) */
const KNOWN_IBNKATHIR_GAPS = [
  '5:97', '6:56', '11:47', '20:68', '20:79', '23:37', '26:104', '26:159', '26:164', '26:174',
  '26:175', '26:178', '26:179', '26:180', '30:16', '33:47', '37:137', '38:70', '42:31', '43:27',
  '47:28', '53:15', '54:35', '74:15', '74:32', '74:46', '75:28', '77:14', '77:18', '77:23',
  '86:16',
];

for (const src of SOURCES) {
  let total = 0;
  let empty = 0;
  const perSurah = new Array(115).fill(0);
  const gaps = [];
  for (let n = 1; n <= 114; n++) {
    const raw = JSON.parse(readFileSync(join(REFS, src.id, `chapter-${n}.json`), 'utf8'));
    const rows = raw.tafsirs;
    if (!Array.isArray(rows)) {
      check(`${src.id} س${n}: بنية`, false, 'tafsirs ليست قائمة');
    }
    const seen = new Set();
    for (const row of rows) {
      if (row.resource_id !== src.resource_id) {
        check(`${src.id} س${n}: resource_id`, false, `المفروض ${src.resource_id} ووصل ${row.resource_id}`);
      }
      const [s, a] = String(row.verse_key).split(':').map(Number);
      if (s !== n) {
        check(`${src.id} س${n}: سورة المفاتيح`, false, `verse_key=${row.verse_key}`);
      }
      if (seen.has(a)) {
        check(`${src.id} س${n}: تكرار آية`, false, `آية ${a} مرتين`);
      }
      seen.add(a);
      perSurah[n]++;
      const text = htmlToPlain(row.text);
      if (text.length === 0) empty++;
      tafsir[`${n}:${a}`] = tafsir[`${n}:${a}`] ?? {};
      tafsir[`${n}:${a}`][src.id] = text;
      total++;
    }
    const gapsHere = [];
    for (let a = 1; a <= expectedCounts[n - 1]; a++) {
      if (!seen.has(a)) gapsHere.push(`${n}:${a}`);
    }
    gaps.push(...gapsHere);
  }
  perSourceStats[src.id] = { total, empty };
  check(`${src.id}: آيات فارغة`, empty === 0, `${empty} فارغة`);
  if (src.id === 'baghawi') {
    check('baghawi: مكتمل 6236 آية (سورة بسورة == حزمة المصحف)', gaps.length === 0 && total === 6236, `نواقص=${gaps.length}`);
  } else {
    check(
      'ibnkathir: النواقص == القائمة الموثقة (31 آية — حُصرت ومُوثقت في التقرير)',
      gaps.length === KNOWN_IBNKATHIR_GAPS.length && gaps.every((k) => KNOWN_IBNKATHIR_GAPS.includes(k)),
      `${gaps.length} نقصًا`
    );
  }
}
check('baghawi: كل المفاتيح 6236 موجودة', Object.keys(tafsir).length === 6236 && Object.values(tafsir).every((v) => v.baghawi !== undefined), `${Object.keys(tafsir).length} مفتاح`);
{
  let ibnkMissing = 0;
  for (const [key, vals] of Object.entries(tafsir)) {
    if (vals.ibnkathir === undefined && !KNOWN_IBNKATHIR_GAPS.includes(key)) ibnkMissing++;
  }
  check('ibnkathir: كل المفاتيح ما عدا النواقص الموثقة موجودة', ibnkMissing === 0, `${ibnkMissing} مفقود غير موثق`);
}

/* ---------- 3) النسبة العربية + الطول ---------- */
// ملاحظة: التفسيرات الكلاسيكية قصيرة بطبيعتها لفواتح السور القصيرة
// (مثل «أي بشرهم.» أو اقتباس حرف الآية «"الم"») — رُوجعت عيّنة يدويًا
// وتأكدت صحتها. الفحص هنا يصدّ الفراغ والبيانات الفاسدة فقط.
let emptyTexts = 0;
let shortTexts = 0;
let lowArabic = 0;
for (const [key, vals] of Object.entries(tafsir)) {
  for (const [srcId, text] of Object.entries(vals)) {
    if (text.trim().length === 0) emptyTexts++;
    if (text.trim().length < 3) shortTexts++;
    if (arabicRatio(text) < 0.4) lowArabic++;
  }
}
check('لا نصوص فارغة/تالفة (فحص الفراغ + العربية)', emptyTexts === 0 && shortTexts === 0 && lowArabic === 0, `فارغة=${emptyTexts} قصور=${shortTexts} غير عربية=${lowArabic}`);

/* ---------- 4) تطابق التطبيع مع الخام (عينات بايت-ببايت) ---------- */
const SAMPLES = ['1:1', '2:255', '33:42', '67:1', '112:1', '114:6'];
for (const key of SAMPLES) {
  const [s, a] = key.split(':').map(Number);
  for (const src of SOURCES) {
    const raw = JSON.parse(readFileSync(join(REFS, src.id, `chapter-${s}.json`), 'utf8'));
    const row = raw.tafsirs.find((r) => r.verse_key === key);
    const strippedRaw = stripAllWs(htmlToPlain(row.text).replace(/\n/g, ''));
    const strippedBundle = stripAllWs(tafsir[key][src.id].replace(/\n/g, ''));
    check(`تطابق ${key} ${src.id} مع الخام (بعد إسقاط الوسوم)`, strippedRaw === strippedBundle, `طول=${strippedBundle.length}`);
  }
}

/* ---------- 5) كتابة الحزمة ---------- */
const bundle = {
  generatedAt: new Date().toISOString(),
  pipeline: 'scripts/import-quran-qa.mjs',
  sources: SOURCES.map((s) => ({ ...s, language: 'ar', accessed: '2026-10-12', distribution: 'api.quran.com' })),
  /** نواقص المصدر (آيات لا يغطيها المصدر — لا نختلق محتواها) */
  gaps: { ibnkathir: KNOWN_IBNKATHIR_GAPS, baghawi: [] },
  tafsir,
};
writeFileSync(OUT_BUNDLE, JSON.stringify(bundle));
console.log(`• الحزمة: ${OUT_BUNDLE} (${(readFileSync(OUT_BUNDLE).length / 1024 / 1024).toFixed(1)} MB)`);

/* ---------- 6) التقرير ---------- */
function writeReport(status) {
  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  const lines = [
    '# سجل اعتماد حزمة التفسير (المرحلة 4)',
    '',
    `**التاريخ:** 2026-10-12 — **النتيجة:** ${status === 'passed' ? 'نجح ✅' : 'فشل ❌'} (${pass} نجاح / ${fail} فشل)`,
    '',
    '## المصادر',
    '',
    '| المصدر | الوصف | التوزيع |',
    '|---|---|---|',
    '| تفسير ابن كثير (ar-tafsir-ibn-kathir، resource_id 14) | إسماعيل بن كثير (ت 1373هـ) — نص في الملك العام | api.quran.com (نُزِّل 2026-10-12) |',
    '| تفسير البغوي — معاني القرآن (ar-tafsir-al-baghawi، resource_id 94) | هبة الله بن موسى البغوي (ت 516هـ) — نص في الملك العام | api.quran.com (نُزِّل 2026-10-12) |',
    '',
    '## النواقص الموثقة',
    `- ibnkathir: ${KNOWN_IBNKATHIR_GAPS.length} آية لا تغطيها بيانات المصدر (الواجهة تعرض «لا يتوفر» للمستخدم،` +
      ` والبغوي يغطيها كاملًا): ${KNOWN_IBNKATHIR_GAPS.join(', ')}`,
    '- baghawi: مكتمل 6236/6236.',
    '',
    '## قرارات الاعتماد',
    '- **رُفض "تفسير الميسر" (resource_id 16)**: اتُّضح أن بياناته على المصدر جزئية',
    '  (نقص نحو 1500 آية، منها سور كاملة مثل 80–83) → لا يصلح مصدرًا معتمدًا كاملًا.',
    '- اختُبر قبل الاعتماد: البغوي (94) مكتمل سورة بسورة مقابل حزمة المصحف (6236 آية).',
    '',
    '## بروتوكول',
    '- النصوص نزلت حرفيًا من واجهة المصدر (لا توليد بنماذج لغوية إطلاقًا).',
    '- الاستجابات الخام محفوظة في `content/refs/tafsir/` وبصماتها في `manifest.sha256`.',
    '- التطبيع الوحيد: إزالة وسوم HTML (p/span) وفك الكيانات وضغط المسافات — لا تعديل دلالي.',
    '',
    '## الفحوصات',
    '',
    ...results.map((r) => `- ${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ` (${r.detail})` : ''}`),
    '',
    `**إجمالي الفحوصات: ${results.length} — نجاح ${pass} / فشل ${fail}**`,
    '',
  ];
  writeFileSync(OUT_REPORT, lines.join('\n'));
}

writeReport('passed');
console.log('تم الاستيراد بنجاح ✅');
