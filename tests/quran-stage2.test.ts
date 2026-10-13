/**
 * اختبار المرحلة 2 — بيانات المصحف: الحزمة مقابل المصادر + البحث + Metadata + آخر موضع.
 *
 * الطبقات:
 * [1] الحزمة مقابل المدخلات (إعادة تحليل مستقل للملفين — لا تعتمد على نتائج السكربت):
 *     البصمات، البنية، الأعداد، المطابقة بايت-ببايت، السجدات، العلامات، المعرفات.
 * [2] البحث (المستودع على Node — تطبيع + أسماء + ترحيل + حدود).
 * [3] Metadata المحتوى + آخر موضع قراءة على Realm حقيقي (حفظ/استعادة بعد الإغلاق).
 * [4] عيّنات بصرية (05-1): طباعة بداية/وسط/نهاية المصحف للمراجعة البشرية.
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { openAppRealm, closeAppRealm, getOpenAppRealm } from '../src/database/realm/realm';
import { getSettingsRepository } from '../src/repositories/settings-repository';
import {
  getQuranManifest,
  getQuranSurahs,
  getSurahInfo,
  getAyahsOfSurah,
  getAyah,
  searchAyahs,
  normalizeArabicForSearch,
  ensureContentMetadata,
} from '../src/repositories/quran-content-repository';

// عند التشغيل من .test-build: __dirname = <root>/.test-build/tests
const ROOT = path.join(__dirname, '..', '..');
const TEST_DIR = path.join(ROOT, '.test-data');
const TEST_DB = path.join(TEST_DIR, 'stage2-quran.realm');
const TEXT_FILE = path.join(ROOT, 'content', 'quran-uthmani.txt');
const META_FILE = path.join(ROOT, 'content', 'refs', 'quran-metadata-tanzil-v1.0.xml');
const BUNDLE_FILE = path.join(ROOT, 'content', 'quran-data.json');

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** عدد آيات كل سورة 1..114 — رواية حفص عن عاصم (مجموع 6236) — جدول مستقل */
const HAFS_COUNTS = [
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

function sha256File(f: string): string {
  return createHash('sha256').update(fs.readFileSync(f)).digest('hex');
}

function parseXmlTags(xml: string, tag: string): Record<string, string>[] {
  const re = new RegExp(`<${tag}\\s+([^>/]*)/?>`, 'g');
  const out: Record<string, string>[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const attrs: Record<string, string> = {};
    const are = /(\w+)="([^"]*)"/g;
    let am: RegExpExecArray | null;
    while ((am = are.exec(m[1]))) attrs[am[1]] = am[2];
    out.push(attrs);
  }
  return out;
}

function main(): void {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });

  const manifest = getQuranManifest();
  const surahs = getQuranSurahs();
  const bundleJson = fs.readFileSync(BUNDLE_FILE, 'utf8');

  // ---------- [1] الحزمة مقابل المصادر ----------
  console.log('\n[1] الحزمة مقابل المدخلات (إعادة تحليل مستقل)');

  check('بصمة الملف النصي == manifest.textChecksum', sha256File(TEXT_FILE) === manifest.textChecksum);
  check('بصمة الوصفية == manifest.metadataChecksum', sha256File(META_FILE) === manifest.metadataChecksum);

  check('114 سورة مرقمة 1..114 متتابعة', surahs.length === 114 && surahs.every((s, i) => s.number === i + 1));

  // إعادة تحليل الوصفية بشكل مستقل
  const metaXml = fs.readFileSync(META_FILE, 'utf8');
  const metaSuras = parseXmlTags(metaXml, 'sura').map((a) => ({
    number: Number(a.index),
    ayas: Number(a.ayas),
  }));
  check('عدد سجلات sura في الوصفية 114', metaSuras.length === 114);
  let countMismatch = 0;
  for (const ms of metaSuras) {
    const s = getSurahInfo(ms.number);
    if (!s || s.ayahCount !== ms.ayas) countMismatch++;
  }
  check('عدد آيات كل سورة في الحزمة == الوصفية (114/114)', countMismatch === 0, `${114 - countMismatch}/114`);

  let hafsMismatch = 0;
  for (let i = 0; i < 114; i++) {
    if (getSurahInfo(i + 1)?.ayahCount !== HAFS_COUNTS[i]) hafsMismatch++;
  }
  check('الأعداد == الجدول المستقل (حفص عن عاصم)', hafsMismatch === 0);

  let total = 0;
  for (let n = 1; n <= 114; n++) total += getSurahInfo(n)!.ayahCount;
  check('مجموع الآيات 6236', total === 6236, String(total));

  // اتساق startLine مع التراكم
  let startLineBad = 0;
  let cum = 0;
  for (const s of surahs) {
    if (s.startLine !== cum) startLineBad++;
    cum += s.ayahCount;
  }
  check('حقول startLine متسقة مع التراكم', startLineBad === 0);

  // المطابقة بايت-ببايت مع الملف النصي
  const dataLines = fs
    .readFileSync(TEXT_FILE, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '' && !l.startsWith('#'));
  check('عدد أسطر النص == عدد آيات الحزمة', dataLines.length === 6236, `${dataLines.length}`);
  let roundTripBad = -1;
  for (let i = 0; i < dataLines.length; i++) {
    const parts = dataLines[i].split('|');
    const s = Number(parts[0]);
    const ay = Number(parts[1]);
    const got = getAyah(s, ay);
    if (!got || got.text !== parts[2]) {
      roundTripBad = i;
      break;
    }
  }
  check('نص كل آية في الحزمة == نص الملف (بايت-ببايت)', roundTripBad === -1, roundTripBad >= 0 ? `فشل عند السطر ${roundTripBad}` : '6236/6236');

  // السجدات: أعلام الحزمة == سجلات الوصفية
  const metaSajdas = new Set(parseXmlTags(metaXml, 'sajda').map((a) => `${a.sura}:${a.aya}`));
  let sajdaBad = 0;
  const bundleSajdas = new Set<string>();
  for (let n = 1; n <= 114; n++) {
    for (const a of getAyahsOfSurah(n)) {
      if (a.sajdah) bundleSajdas.add(`${a.surah}:${a.ayah}`);
    }
  }
  for (const k of bundleSajdas) if (!metaSajdas.has(k)) sajdaBad++;
  for (const k of metaSajdas) if (!bundleSajdas.has(k)) sajdaBad++;
  check('مواضع السجدات: حزمة == وصفية (15)', sajdaBad === 0, `حزمة=${bundleSajdas.size} وصفية=${metaSajdas.size}`);

  // العلامات والتشكيل محفوظة
  const a11 = getAyah(1, 1)!;
  check('1:1 تحمل التشكيل (لم يُطبَّع النص)', /[\u064B-\u065F]/.test(a11.text) && a11.search !== a11.text);
  const allText = getAyahsOfSurah(2).map((x) => x.text).join(' ');
  check('علامات ۖ و ۞ موجودة في الحزمة', allText.includes('\u06D6') && allText.includes('\u06DE'));
  let dupIds = 0;
  const seen = new Set<string>();
  for (let n = 1; n <= 114; n++) {
    for (const a of getAyahsOfSurah(n)) {
      if (seen.has(a.id)) dupIds++;
      seen.add(a.id);
    }
  }
  check('لا معرفات آية مكررة', dupIds === 0);

  // بصمة المحتوى: إعادة حساب بصمة {surahs, ayahs}
  const parsed = JSON.parse(bundleJson) as { surahs: unknown; ayahs: unknown };
  const recomputed = createHash('sha256').update(JSON.stringify({ surahs: parsed.surahs, ayahs: parsed.ayahs }), 'utf8').digest('hex');
  check('manifest.contentChecksum == بصمة {surahs,ayahs} المعاد حسابها', recomputed === manifest.contentChecksum);

  // ---------- [2] البحث ----------
  console.log('\n[2] البحث (تطبيع + أسماء + ترحيل + حدود)');

  const h1 = searchAyahs('الرحيم');
  check('«الرحيم» يجد 1:1 (مع تشكيل النص الأصلي)', h1.some((h) => h.ayah.surah === 1 && h.ayah.ayah === 1));
  check('النتيجة تحمل اسم السورة ورقم الآية الصحيحين', h1.some((h) => h.surah.nameArabic === 'الفاتحة' && h.ayah.ayah === 1));

  const h2 = searchAyahs('بسم الله الرحمن');
  check('«بسم الله الرحمن» (بدون تشكيل) يجد 1:1', h2.some((h) => h.ayah.id === '1:1'));

  const h3 = searchAyahs('الفاتحة');
  check('بحث باسم السورة «الفاتحة» يعيد آياتها', h3.length >= 7 && h3.every((h) => h.surah.number === 1));

  const h4 = searchAyahs('Yaseen');
  check('الترحيل اللاتيني «Yaseen» يجد سورة يس (36)', h4.some((h) => h.surah.number === 36));

  check('استعلام فارغ → لا نتائج', searchAyahs('   ').length === 0);
  const h5 = searchAyahs('لا', 10);
  check('الحد الأقصى للنتائج محترم (limit=10)', h5.length === 10 && h5.length <= 10);

  const h6 = searchAyahs('الناس', 7000); // 179 نتيجة — الحد الافتراضي 100 يُقطعه قبل السورة 114
  // النص في المصدر: ٱلنَّاسِ (ألف وصل ٱ) — التطبيع يوحّدها إلى ا
  check('«الناس» (ألف وصل ٱ في المصدر) يجد 114:1', h6.some((h) => h.ayah.id === '114:1'));
  check('تطبيع الاستعلام يحذف التشكيل', normalizeArabicForSearch('ٱلْحَمْدُ') === 'الحمد');

  // ---------- [3] Metadata + آخر موضع على Realm حقيقي ----------
  console.log('\n[3] Metadata المحتوى + آخر موضع قراءة');

  openAppRealm(TEST_DB).then(async () => {
    ensureContentMetadata();
    const realm = getOpenAppRealm();
    const rows = realm.objects('ContentMetadata');
    check('سُجل ContentMetadata للمحتوى', rows.length === 1);
    const row = rows[0] as unknown as { id: string; validationStatus: string; checksum: string; contentType: string };
    check('الحالة passed والمحتوى quran-data', row.validationStatus === 'passed' && row.contentType === 'quran-data');
    check('البصمة المسجلة == بصمة الحزمة', row.checksum === manifest.contentChecksum);

    // idempotent
    ensureContentMetadata();
    check('تسجيل Metadata مكرر لا يكرر السجل', realm.objects('ContentMetadata').length === 1);

    // آخر موضع: حفظ → إغلاق → إعادة فتح → استعادة
    const repo = getSettingsRepository();
    await repo.updateSettings({ lastSurahNumber: 2, lastAyahNumber: 255, lastReadAt: new Date() });
    closeAppRealm();
    await openAppRealm(TEST_DB);
    const restored = await repo.getSettings();
    check('استُعيد آخر موضع (2:255) بعد إغلاق التطبيق', restored.lastSurahNumber === 2 && restored.lastAyahNumber === 255);
    check('تاريخ آخر قراءة محفوظ', restored.lastReadAt instanceof Date);

    // ---------- [4] عيّنات بصرية (05-1) ----------
    console.log('\n[4] عيّنات للمراجعة البصرية (بداية/وسط/نهاية)');
    console.log('  1:1   —', getAyah(1, 1)!.text);
    console.log('  2:255 —', getAyah(2, 255)!.text.slice(0, 60) + '…');
    console.log('  36:1  —', getAyah(36, 1)!.text.slice(0, 40) + '…');
    console.log('  114:6 —', getAyah(114, 6)!.text);

    console.log(`\nالنتيجة: ${passed} نجح / ${failed} فشل`);
    closeAppRealm();
    process.exit(failed > 0 ? 1 : 0);
  });
}

main();
