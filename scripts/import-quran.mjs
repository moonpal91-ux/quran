#!/usr/bin/env node
/**
 * خدمة استيراد بيانات المصحف — بوابة اعتماد المحتوى (05-CONTENT-AND-TRUST §5).
 *
 * المدخلات (مثبتتان بالبصمة — أي تغيير يوقف الاستيراد):
 *  1. content/quran-uthmani.txt                  — Tanzil Uthmani v1.1 (النص)
 *  2. content/refs/quran-metadata-tanzil-v1.0.xml — Tanzil Quran Metadata v1.0 (البنية)
 *
 * المخرجات:
 *  - content/quran-data.json  — حزمة المحتوى الموثقة (فهرس السور + الآيات + الحقول المشتقة)
 *  - content/IMPORT-REPORT.md — سجل بوابة الاعتماد (مصدر/إصدار/ترخيص/نتائج الفحص)
 *
 * طبقات الفحص (05-5):
 *  G1  بنية السور: 114 سورة مرقمة 1..114 متتابعة في النص وفي البيانات الوصفية.
 *  G2  عدد آيات كل سورة في النص == عدد الآيات في البيانات الوصفية (مصدر مستقل).
 *  G3  عدد الآيات == الجدول المستقل المعتمد (حفص عن عاصم، المجموع 6236).
 *  G4  مطابقة بايت-ببايت: إعادة بناء الأسطر s|a|text من الحزمة == أسطر الملف الأصلي.
 *  G5  السجدات: عدد ۩ في النص == عدد سجلات sajdah في الوصفية، ومطابقة المواضع.
 *  G6  العلامات محفوظة: ۖ و۞ موجودة، ولا يوجد تطبيع (النص كما هو — 05-1 «لا تصحيح تلقائي»).
 *  G7  أداة الفحص المستقلة (validate-quran.mjs) تنجح (18/18) كعملية فرعية.
 *  G8  لا معرفات مكررة: كل id سورة/آية فريد (05-5-3).
 *
 * لا يُستخدم نموذج لغوي في أي خطوة (05-1) — محلل حتمي بالكامل.
 *
 * الاستدعاء: node scripts/import-quran.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TEXT_FILE = path.join(ROOT, 'content', 'quran-uthmani.txt');
const META_FILE = path.join(ROOT, 'content', 'refs', 'quran-metadata-tanzil-v1.0.xml');
const OUT_JSON = path.join(ROOT, 'content', 'quran-data.json');
const OUT_REPORT = path.join(ROOT, 'content', 'IMPORT-REPORT.md');

/** البصمات المثبتة (Stage 0 — فُحصت بمقابل مرجعي مستقل) */
const PINNED_TEXT_SHA256 = '7f30c647331a61100ebf24a80507dc0fcdd9f2df97f1312b5b2dfcb982a7f326';
const PINNED_META_SHA256 = '8867c1d88191472adec9db694b3cd9f135b1a2ef580574d32cf888dcb22c5c7a';

/** عدد آيات كل سورة 1..114 — رواية حفص عن عاصم (مجموع 6236) — جدول مستقل من النص والوصفية */
const EXPECTED_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
  123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
  34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
  60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
  28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
  15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
  5, 4, 5, 6,
];

const WAQF_MARK = '\u06D6'; // ۖ
const SAJDAH_MARK = '\u06E9'; // ۩
const RUB_EL_HIZB = '\u06DE'; // ۞

const checks = [];
function check(id, name, ok, detail = '') {
  checks.push({ id, name, ok, detail });
  const mark = ok ? '✓' : '✗';
  console.log(`  ${mark} ${id} — ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) process.exitCode = 1;
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** تطبيع عربي للبحث فقط (03-REALM §5): يُخزن نص البحث مشتقًا، والنص الأصلي بلا تغيير.
 *  1) حذف التشكيل والتطويل  2) حذف علامات المصحف  3) توحيد الألف وة→ه وى→ي */
export function normalizeArabicForSearch(s) {
  return s
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // تشكيل + تطويل
    .replace(/[\u06D6\u06D7\u06D8\u06D9\u06DA\u06DE\u06DF\u06E9]/g, '') // علامات الوقف/الحزب/السجدة
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627') // آ أ إ ٱ → ا
    .replace(/\u0629/g, '\u0647') // ة → ه
    .replace(/\u0649/g, '\u064A') // ى → ي
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- قراءة المدخلات ----------
console.log('== قراءة المدخلات وثبات البصمات ==');
if (!existsSync(TEXT_FILE)) throw new Error('الملف النصي مفقود: ' + TEXT_FILE);
if (!existsSync(META_FILE)) throw new Error('ملف الوصفية مفقود: ' + META_FILE);

const textSha = sha256(TEXT_FILE);
const metaSha = sha256(META_FILE);
check('S1', 'بصمة الملف النصي مطابقة للمثبتة', textSha === PINNED_TEXT_SHA256, textSha.slice(0, 16) + '…');
check('S2', 'بصمة ملف الوصفية مطابقة للمثبتة', metaSha === PINNED_META_SHA256, metaSha.slice(0, 16) + '…');
if (process.exitCode) {
  console.error('أوقف الاستيراد: المدخلات غير مطابقة للبصمات المثبتة. حدّث البصمات في السكربت مع توثيق سبب التغيير.');
  process.exit(1);
}

const rawLines = readFileSync(TEXT_FILE, 'utf8').split('\n');
const dataLines = rawLines.filter((l) => l.trim() !== '' && !l.startsWith('#'));
const rawXml = readFileSync(META_FILE, 'utf8');

// ---------- تحليل الوصفية (XML) ----------
function parseTags(xml, tag) {
  const re = new RegExp(`<${tag}\\s+([^>/]*)/?>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(xml))) {
    const attrs = {};
    const are = /(\w+)="([^"]*)"/g;
    let am;
    while ((am = are.exec(m[1]))) attrs[am[1]] = am[2];
    out.push(attrs);
  }
  return out;
}

const metaSuras = parseTags(rawXml, 'sura').map((a) => ({
  number: Number(a.index),
  ayahCount: Number(a.ayas),
  startLine: Number(a.start),
  nameArabic: a.name,
  nameTransliteration: a.tname,
  revelationType: a.type, // Meccan | Medinan
  rukus: Number(a.rukus),
}));
const metaJuz = parseTags(rawXml, 'juz').map((a) => ({ index: Number(a.index), sura: Number(a.sura), aya: Number(a.aya) }));
const metaQuarter = parseTags(rawXml, 'quarter').map((a) => ({ index: Number(a.index), sura: Number(a.sura), aya: Number(a.aya) }));
const metaManzil = parseTags(rawXml, 'manzil').map((a) => ({ index: Number(a.index), sura: Number(a.sura), aya: Number(a.aya) }));
const metaRuku = parseTags(rawXml, 'ruku').map((a) => ({ index: Number(a.index), sura: Number(a.sura), aya: Number(a.aya) }));
const metaPage = parseTags(rawXml, 'page').map((a) => ({ index: Number(a.index), sura: Number(a.sura), aya: Number(a.aya) }));
const metaSajda = parseTags(rawXml, 'sajda').map((a) => ({ index: Number(a.index), sura: Number(a.sura), aya: Number(a.aya), type: a.type }));

// ---------- تحليل النص ----------
const ayahs = [];
const textCounts = new Map();
for (const line of dataLines) {
  const parts = line.split('|');
  if (parts.length !== 3) {
    check('F1', 'بنية الأسطر s|a|text', false, line.slice(0, 40));
    process.exit(1);
  }
  const [sRaw, aRaw, text] = parts;
  const s = Number(sRaw);
  const a = Number(aRaw);
  if (!Number.isInteger(s) || !Number.isInteger(a) || s < 1 || s > 114 || a < 1) {
    check('F1', 'ترقيم صالح لكل سطر', false, line.slice(0, 40));
    process.exit(1);
  }
  textCounts.set(s, (textCounts.get(s) ?? 0) + 1);
  ayahs.push({ surah: s, ayah: a, text });
}

// ---------- G1: بنية السور ----------
const suraNumbersOk = metaSuras.length === 114 && metaSuras.every((x, i) => x.number === i + 1);
check('G1', '114 سورة مرقمة 1..114 متتابعة (الوصفية)', suraNumbersOk);
const textSuraOrderOk = dataLines.every((line, i) => {
  const s = Number(line.split('|')[0]);
  const a = Number(line.split('|')[1]);
  const prev = i === 0 ? null : dataLines[i - 1].split('|').map(Number);
  if (i === 0) return s === 1 && a === 1;
  const [ps, pa] = prev;
  if (s === ps) return a === pa + 1;
  return s === ps + 1 && a === 1;
});
check('G1b', 'ترقيم النص متتابع (سورة/آية) من 1:1 إلى 114:نهاية', textSuraOrderOk, `آخر سطر: ${dataLines[dataLines.length - 1].slice(0, 12)}…`);

// ---------- G2: عدد الآيات == الوصفية ----------
let g2Bad = 0;
for (const ms of metaSuras) {
  const t = textCounts.get(ms.number) ?? 0;
  if (t !== ms.ayahCount) {
    g2Bad++;
    if (g2Bad <= 5) console.error(`    mismatch سورة ${ms.number}: نص=${t} وصفية=${ms.ayahCount}`);
  }
}
check('G2', 'عدد آيات كل سورة في النص == البيانات الوصفية (مصدر مستقل)', g2Bad === 0, `${114 - g2Bad}/114 مطابقة`);

// ---------- G3: الجدول المستقل (حفص عن عاصم) ----------
let g3Bad = 0;
for (let i = 0; i < 114; i++) {
  const t = textCounts.get(i + 1) ?? 0;
  if (t !== EXPECTED_AYAH_COUNTS[i]) g3Bad++;
}
check('G3', 'عدد الآيات == الجدول المستقل (حفص عن عاصم)', g3Bad === 0, `المجموع=${ayahs.length}/6236`);

// ---------- G4: مطابقة بايت-ببايت ----------
const rebuilt = ayahs.map((x) => `${x.surah}|${x.ayah}|${x.text}`);
let g4Bad = -1;
if (rebuilt.length === dataLines.length) {
  for (let i = 0; i < dataLines.length; i++) {
    if (rebuilt[i] !== dataLines[i]) {
      g4Bad = i;
      break;
    }
  }
}
check('G4', 'إعادة بناء السطر من الحزمة == الملف الأصلي (بايت-ببايت)', g4Bad === -1, g4Bad === -1 ? `${dataLines.length} سطر` : `اختلاف عند السطر ${g4Bad}`);

// ---------- G5: السجدات ----------
const sajdaSet = new Set(metaSajda.map((x) => `${x.sura}:${x.aya}`));
let g5Detail = `وصفية=${metaSajda.length}`;
const textSajdaLines = new Set();
for (const x of ayahs) {
  if (x.text.endsWith(SAJDAH_MARK)) textSajdaLines.add(`${x.surah}:${x.ayah}`);
}
g5Detail += `، نص=${textSajdaLines.size}`;
let g5Mismatch = 0;
for (const k of textSajdaLines) if (!sajdaSet.has(k)) g5Mismatch++;
for (const k of sajdaSet) if (!textSajdaLines.has(k)) g5Mismatch++;
check('G5', 'مواضع السجدات ۩ في النص == سجلات sajdah في الوصفية', g5Mismatch === 0, g5Detail);

// ---------- G6: العلامات محفوظة بلا تطبيع ----------
const hasWaqf = ayahs.some((x) => x.text.includes(WAQF_MARK));
const hasRub = ayahs.some((x) => x.text.includes(RUB_EL_HIZB));
const hasTashkeel = ayahs[0].text.includes('\u0650'); // 1:1 فيها كسرة/فتحة
check('G6', 'العلامات (ۖ ۞ ۩) والتشكيل محفوظة كما في المصدر', hasWaqf && hasRub && hasTashkeel);

// ---------- G7: أداة الفحص المستقلة ----------
const validator = spawnSync('node', [path.join(__dirname, 'validate-quran.mjs'), TEXT_FILE], { encoding: 'utf8' });
check('G7', 'أداة الفحص المستقلة (18/18) تنجح', validator.status === 0, validator.status === 0 ? 'exit 0' : `exit ${validator.status}`);

// ---------- G8: معرفات فريدة ----------
const seen = new Set();
let dup = 0;
for (const x of ayahs) {
  const id = `${x.surah}:${x.ayah}`;
  if (seen.has(id)) dup++;
  seen.add(id);
}
check('G8', 'لا معرفات آية مكررة (s:a فريد)', dup === 0, `${ayahs.length} معرف`);

// ---------- الحقول المشتقة (تقسيم المصحف) ----------
function cmpPos(s, a, t) {
  // يرجع true إذا كان (s,a) ≥ موضع البداية (t.sura, t.aya)
  return s > t.sura || (s === t.sura && a >= t.aya);
}
function lastAtOrBefore(s, a, list) {
  // قائمة مرتبة بموضع البداية — نأخذ آخر عنصر ≤ (s,a) (بحث خطي كافٍ: القوائم قصيرة)
  let best = list[0];
  for (const t of list) {
    if (cmpPos(s, a, t)) best = t;
    else break;
  }
  return best;
}
const sajdahPos = new Set(metaSajda.map((x) => `${x.sura}:${x.aya}`));

const bundleAyahs = ayahs.map((x) => ({
  id: `${x.surah}:${x.ayah}`,
  surah: x.surah,
  ayah: x.ayah,
  text: x.text,
  search: normalizeArabicForSearch(x.text),
  juz: lastAtOrBefore(x.surah, x.ayah, metaJuz).index,
  quarter: lastAtOrBefore(x.surah, x.ayah, metaQuarter).index,
  manzil: lastAtOrBefore(x.surah, x.ayah, metaManzil).index,
  ruku: lastAtOrBefore(x.surah, x.ayah, metaRuku).index,
  page: lastAtOrBefore(x.surah, x.ayah, metaPage).index,
  sajdah: sajdahPos.has(`${x.surah}:${x.ayah}`),
}));

const bundleSurahs = metaSuras.map((s) => ({
  number: s.number,
  nameArabic: s.nameArabic,
  nameTransliteration: s.nameTransliteration,
  ayahCount: s.ayahCount,
  revelationType: s.revelationType === 'Medinan' ? 'مدنية' : 'مكية',
  startLine: s.startLine,
  rukus: s.rukus,
}));

const content = {
  surahs: bundleSurahs,
  ayahs: bundleAyahs,
};
const contentJson = JSON.stringify(content);
const bundleChecksum = createHash('sha256').update(contentJson, 'utf8').digest('hex');

const bundle = {
  manifest: {
    id: 'tanzil-uthmani-quran-1.1',
    sourceName: 'Tanzil Project — Tanzil Quran Text (Uthmani)',
    sourceVersion: '1.1',
    license: 'CC-BY 3.0 (نسخ حرفية فقط مع نسبة المصدر)',
    sourceUrl: 'https://tanzil.net/',
    textChecksum: textSha,
    metadataSourceName: 'Tanzil Project — Quran Metadata',
    metadataSourceVersion: '1.0',
    metadataLicense: 'CC-BY (حسب ترويسة الملف: license="cc-by")',
    metadataUrl: 'https://tanzil.net/docs/Quran_Metadata',
    metadataChecksum: metaSha,
    surahCount: 114,
    ayahCount: ayahs.length,
    contentChecksum: bundleChecksum,
    generatedAt: new Date().toISOString(),
    searchNormalization:
      'بحث فقط (لا يُعرض للمستخدم): حذف التشكيل/التطويل/علامات المصحف، توحيد الألف (آأإٱ→ا)، ة→ه، ى→ي',
    validation: {
      status: checks.every((c) => c.ok) ? 'passed' : 'failed',
      checks: checks.map((c) => ({ id: c.id, name: c.name, ok: c.ok, detail: c.detail })),
    },
  },
  ...content,
};

if (checks.every((c) => c.ok)) {
  writeFileSync(OUT_JSON, JSON.stringify(bundle), 'utf8');
  console.log(`\n== الحزمة كُتبت: ${path.relative(ROOT, OUT_JSON)} (${(JSON.stringify(bundle).length / 1024).toFixed(0)} KB) ==`);
} else {
  console.error('\n== فشل بوابة الاعتماد — لم تُكتب الحزمة ==');
  process.exit(1);
}

// ---------- سجل البوابة (05-5-7: تسجيل إصدار الحزمة ونتيجة الفحص) ----------
const report = `# سجل اعتماد حزمة بيانات المصحف — المرحلة 2

**تاريخ الاعتماد:** ${new Date().toISOString()}
**الحالة:** ${checks.every((c) => c.ok) ? '✅ ناجحة — الحزمة مقبولة' : '❌ فاشلة — لم تُكتب الحزمة'}

## المصادر (05-1: تسجيل اسم المصدر والإصدار والترخيص وتاريخ الاستيراد)
| العنصر | القيمة |
|---|---|
| النص القرآني | Tanzil Project — Tanzil Quran Text (Uthmani) **v1.1** |
| ترخيص النص | CC-BY 3.0 — نسخ حرفية فقط + نسبة المصدر + رابط tanzil.net (05-1) |
| رابط المصدر | https://tanzil.net/ |
| بصمة النص SHA-256 | \`${textSha}\` |
| البيانات الوصفية | Tanzil Project — Quran Metadata **v1.0** |
| ترخيص الوصفية | CC-BY (ترويسة الملف) |
| رابط الوصفية | https://tanzil.net/docs/Quran_Metadata |
| بصمة الوصفية SHA-256 | \`${metaSha}\` |
| بصمة محتوى الحزمة (content) | \`${bundleChecksum}\` |

## نتائج بوابة الاعتماد (05-5)
| # | الفحص | النتيجة | التفصيل |
|---|---|---|---|
${checks.map((c) => `| ${c.id} | ${c.name} | ${c.ok ? '✓ نجح' : '✗ فشل'} | ${c.detail} |`).join('\n')}

## المخرجات
- \`content/quran-data.json\` — 114 سورة، ${ayahs.length} آية، مع حقول مشتقة (جزء/ربع حزب/موضع/ركوع/صفحة مدنية/سجدة) وحقل بحث مُطبَّع.
- النص القرآني **بلا أي تغيير** (G4 بايت-ببايت، G6 علامات وتشكيل محفوظة).
- لم يُستخدم نموذج لغوي في أي خطوة (05-1).

## مراجعة بشرية (05-5-6)
عيّنات مطبوعة لمراجعة بصرية (بداية/وسط/نهاية):
- 1:1 — ${ayahs[0].text}
- 2:255 — ${ayahs.find((x) => x.surah === 2 && x.ayah === 255).text.slice(0, 80)}…
- 36:1 — ${ayahs.find((x) => x.surah === 36 && x.ayah === 1).text.slice(0, 60)}…
- 114:6 — ${ayahs.find((x) => x.surah === 114 && x.ayah === 6).text}

**المُراجع:** إيهاب عجور أبو الأمير (مطور التطبيق) — تُوثَّق المراجعة في STAGE-PROGRESS.md.
`;
writeFileSync(OUT_REPORT, report, 'utf8');
console.log(`== السجل كُتب: ${path.relative(ROOT, OUT_REPORT)} ==`);

const failed = checks.filter((c) => !c.ok).length;
console.log(`النتيجة: ${checks.length - failed}/${checks.length} فحصًا ناجحًا`);
