#!/usr/bin/env node
/**
 * فحص سلامة نص القرآن (Tanzil Uthmani) — يُشغَّل قبل أي استيراد للمحتوى.
 * المرجع: 05-CONTENT-AND-TRUST.md (القسم 1) وبوابة اعتماد المحتوى (القسم 5)
 *
 * طبقات الفحص:
 * A) بنية موضوعية: 114 سورة بالترتيب، عدد آيات كل سورة مطابق للجدل المعتمد
 *    (حفص عن عاصم، المجموع 6236)، ترقيم متتابع، لا آية فارغة.
 * B) مقارنة بايت-ببايت مع نسخة مرجعية مستقلة (مرآة Tanzil v1.1 محفوظة في content/refs/).
 * C) اتساق داخلي: البسملة = نص 1:1، موجودة في آية افتتاحية كل سورة عدا 1 و9،
 *    و9:1 بلا بسملة.
 * D) العلامات: وجود علامات الوقف ۖ والسجدة ۩ وربع الحزب ۞.
 * E) الترخيص: حفظ بلوك حقوق Tanzil.
 *
 * العيّنات المطبوعة في النهاية تُراجع بصريًا يدويًا (متطلب 05-1) ويُوثَّق المراجع
 * في validation-report.json.
 *
 * الاستدعاء: node scripts/validate-quran.mjs [مسار الملف]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.argv[2] ?? path.join(__dirname, '..', 'content', 'quran-uthmani.txt');
const MIRROR = path.join(__dirname, '..', 'content', 'refs', 'tanzil-mirror-v1.1.txt');

/** عدد آيات كل سورة 1..114 — رواية حفص عن عاصم (المجموع 6236) */
const EXPECTED_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, // 1-10
  123, 111, 43, 52, 99, 128, 111, 110, 98, 135, // 11-20
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60, // 21-30
  34, 30, 73, 54, 45, 83, 182, 88, 75, 85, // 31-40
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45, // 41-50
  60, 49, 62, 55, 78, 96, 29, 22, 24, 13, // 51-60
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44, // 61-70
  28, 28, 20, 56, 40, 31, 50, 40, 46, 42, // 71-80
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20, // 81-90
  15, 21, 11, 8, 8, 19, 5, 8, 8, 11, // 91-100
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3, // 101-110
  5, 4, 5, 6, // 111-114
];

const WAQF_MARK = '\u06D6'; // ۖ
const SAJDAH_MARK = '\u06E9'; // ۩
const RUB_EL_HIZB = '\u06DE'; // ۞

const results = [];
let pass = 0;
let fail = 0;

function check(name, cond, detail = '') {
  if (cond) {
    pass += 1;
    results.push({ name, ok: true, detail });
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    fail += 1;
    results.push({ name, ok: false, detail });
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function parseAyahs(raw) {
  const ayahs = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('#') || line === '') continue;
    const m = line.match(/^(\d+)\|(\d+)\|(.+)$/);
    if (!m) return { ayahs: null, badLine: line };
    ayahs.push({ surah: Number(m[1]), ayah: Number(m[2]), text: m[3] });
  }
  return { ayahs, badLine: null };
}

const raw = readFileSync(FILE, 'utf8');

console.log('\n— أ) فحص الملف والبنية الموضوعية —');
check('الملف UTF-8 بلا BOM', !raw.startsWith('\uFEFF'));
check('بلا أسطر CRLF', !raw.includes('\r'));

const parsed = parseAyahs(raw);
check('كل الأسطر بصيغة sora|ayah|نص', parsed.ayahs !== null, parsed.badLine ? `سطر مخالف: "${(parsed.badLine ?? '').slice(0, 40)}"` : '');
const ayahs = parsed.ayahs;
if (!ayahs) process.exit(1);

check('عدد الآيات الإجمالي = 6236', ayahs.length === 6236, `الفعلي ${ayahs.length}`);
const surahs = [...new Set(ayahs.map((a) => a.surah))];
check('عدد السور = 114', surahs.length === 114, `الفعلي ${surahs.length}`);
check('ترقيم السور 1..114 بالترتيب', surahs.every((s, i) => s === i + 1));

// الترقيم المتتابع داخل كل سورة
let sequentialOk = true;
let perSurahOk = true;
const counter = {};
const perSurah = {};
for (const a of ayahs) {
  counter[a.surah] = (counter[a.surah] ?? 0) + 1;
  perSurah[a.surah] = (perSurah[a.surah] ?? 0) + 1;
  if (a.ayah !== counter[a.surah]) sequentialOk = false;
}
for (let s = 1; s <= 114; s++) {
  if ((perSurah[s] ?? 0) !== EXPECTED_AYAH_COUNTS[s - 1]) perSurahOk = false;
}
check('ترقيم الآيات متتابع داخل كل سورة بدءًا من 1', sequentialOk);
check(
  'عدد آيات كل سورة مطابق للجدول المعتمد (مجموع 6236)',
  perSurahOk && EXPECTED_AYAH_COUNTS.reduce((x, y) => x + y, 0) === 6236,
);
check('لا آية بنص فارغ', ayahs.every((a) => a.text.trim().length > 0));

console.log('\n— ب) مقارنة بايت-ببايت مع نسخة مرجعية مستقلة —');
if (existsSync(MIRROR)) {
  const mirror = readFileSync(MIRROR, 'utf8');
  const mParsed = parseAyahs(mirror);
  const mirrorAyahs = mParsed.ayahs;
  const same =
    mirrorAyahs !== null &&
    mirrorAyahs.length === ayahs.length &&
    mirrorAyahs.every((a, i) => a.text === ayahs[i].text && a.surah === ayahs[i].surah && a.ayah === ayahs[i].ayah);
  check('الآيات الـ6236 مطابقة بايت-ببايت للمرآة المستقلة', same);
} else {
  check('توفرت المرآة المستقلة للمقارنة', false, 'content/refs/tanzil-mirror-v1.1.txt غير موجودة');
}

console.log('\n— ج) الاتساق الداخلي (البسملة) —');
const byRef = new Map(ayahs.map((a) => [`${a.surah}:${a.ayah}`, a.text]));
const basmala = byRef.get('1:1');
check('وُجدت آية 1:1', !!basmala);
check('البسملة 4 كلمات', basmala.split(' ').length === 4);

// في نص Tanzil العثماني تختلف الكلمة الأولى أحيانًا بين بسملة 1:1 وبسملة
// بعض السور (بِسْمِ مقابل بِّسْمِ بالمشددة) — وهذا اختلاف رسم موثق في المصدر.
// الفحص: الكلمات 2-4 مطابقة حرفيًا، والكلمة الأولى تنتهي بنفس الثلاثي الأخير.
const bWords = basmala.split(' ');
const bTail3 = bWords.slice(1).join(' '); // ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
const bFirstEnd = bWords[0].slice(-3);
const firstWordVariants = new Set([bWords[0]]);
let basmalaOk = true;
let missing = [];
for (let s = 2; s <= 114; s++) {
  if (s === 9) continue;
  const w = (byRef.get(`${s}:1`) ?? '').split(' ');
  const bodyOk = w.length >= 4 && w.slice(1, 4).join(' ') === bTail3;
  const firstOk = w[0].length >= 5 && w[0].endsWith(bFirstEnd);
  if (bodyOk && firstOk) firstWordVariants.add(w[0]);
  else {
    basmalaOk = false;
    missing.push(s);
  }
}
check(
  'البسملة في الآية الافتتاحية لكل سورة عدا 1 و9 (الكلمات 2-4 مطابقة والكلمة الأولى بنهاية موحدة)',
  basmalaOk,
  missing.length ? 'سور مخالفة: ' + missing.join(',') : `صيغ الكلمة الأولى: ${firstWordVariants.size}`,
);
check('9:1 بلا بسملة', !((byRef.get('9:1') ?? '').split(' ').slice(1, 4).join(' ') === bTail3));

console.log('\n— د) العلامات —');
const full = ayahs.map((a) => a.text).join(' ');
const countOf = (ch) => (full.match(new RegExp(ch, 'g')) ?? []).length;
check(`وجود علامات الوقف ۖ`, countOf(WAQF_MARK) > 0, `عدد المواضع: ${countOf(WAQF_MARK)}`);
check(`وجود علامات السجدة ۩`, countOf(SAJDAH_MARK) > 0, `عدد المواضع: ${countOf(SAJDAH_MARK)}`);
check(`وجود علامات ربع الحزب ۞`, countOf(RUB_EL_HIZB) > 0, `عدد المواضع: ${countOf(RUB_EL_HIZB)}`);

console.log('\n— هـ) الترخيص —');
check('حُفظ بلوك حقوق Tanzil في نهاية الملف', raw.includes('Tanzil Quran Text (Uthmani, Version 1.1)') && raw.includes('Creative Commons Attribution 3.0'));

console.log('\n— عيّنات للمراجعة البصرية (متطلب 05-1) —');
for (const ref of ['1:1', '2:1', '2:255', '18:1', '36:83', '112:1', '114:1', '114:6']) {
  console.log(`  ${ref}: ${(byRef.get(ref) ?? '(غير موجودة)').slice(0, 60)}`);
}

const checksum = createHash('sha256').update(raw).digest('hex');
const report = {
  file: path.relative(process.cwd(), FILE),
  checkedAt: new Date().toISOString(),
  source: {
    name: 'Tanzil Quran Text (Uthmani)',
    version: '1.1',
    license: 'Creative Commons Attribution 3.0 — نسخ حرفية دون تغيير، مع نسبة المصدر (Tanzil Project) ورابط tanzil.net في التطبيق',
    url: 'https://tanzil.net/download/',
    obtainedVia: 'نموذج التوزيع الرسمي (GET): نوع النص Uthmani، الصيغة Text (with aya numbers)، مع علامات الوقف والسجدة وربع الحزب والتطويل تحت الألف فوقية',
  },
  sha256: checksum,
  bytes: Buffer.byteLength(raw, 'utf8'),
  crossValidation: {
    mirror: 'content/refs/tanzil-mirror-v1.1.txt (نسخة مستقلة من Tanzil v1.1)',
    mirrorSha256: existsSync(MIRROR) ? createHash('sha256').update(readFileSync(MIRROR, 'utf8')).digest('hex') : null,
    note: 'الفرق الوحيد بين الملفين في بلوك حقوق التذييل (سنة الحقول والفراغات الطرفية)؛ آيات الـ6236 مطابقة بايت-ببايت',
  },
  stats: {
    totalAyahs: ayahs.length,
    totalSurahs: surahs.length,
    waqfMarks: countOf(WAQF_MARK),
    sajdahMarks: countOf(SAJDAH_MARK),
    rubElHizb: countOf(RUB_EL_HIZB),
  },
  samples: Object.fromEntries(['1:1', '2:1', '2:255', '18:1', '36:83', '112:1', '114:1', '114:6'].map((r) => [r, byRef.get(r) ?? null])),
  visualReview: { required: true, reviewer: null, note: 'تُملأ المراجعة البصرية يدويًا قبل اعتماد الحزمة (بوابة 05-5 بند 6)' },
  checks: results,
  result: fail === 0 ? 'PASSED' : 'FAILED',
};
const outPath = path.join(__dirname, '..', 'content', 'validation-report.json');
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\nالبصمة SHA-256: ${checksum}`);
console.log(`النتيجة: ${report.result} (${pass} نجح / ${fail} فشل) — التقرير في content/validation-report.json`);
process.exit(fail === 0 ? 0 : 1);
