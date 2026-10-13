/**
 * مستودع محتوى المصحف (المرحلة 2) — الوصول إلى الحزمة الموثقة + البحث.
 *
 * القرار المعماري (03-REALM §3): المحتوى القرآني الثابت يبقى في **حزمة إصدار موثقة**
 * (content/quran-data.json) منفصلًا عن بيانات المستخدم في Realm — لا يُنسخ 6236 سجلًا
 * إلى قاعدة البيانات. ما يُسجل في Realm: سجل ContentMetadata واحد (05-1).
 *
 * الحزمة مُنتجة بمعرفة بوابة الاعتماد (05-5) في scripts/import-quran.mjs، وتُفحص
 * هنا فحصًا بنيويًا خفيفًا عند أول استخدام (لا يُعاد حساب البصمة داخل التطبيق).
 *
 * هذا الملف خالٍ من أي اعتماد على React Native — يُختبر مباشرة على Node.
 */
import rawBundle from '../../content/quran-data.json';
import { getOpenAppRealm } from '../database/realm/realm';

export interface SurahInfo {
  number: number;
  nameArabic: string;
  nameTransliteration: string;
  ayahCount: number;
  revelationType: 'مكية' | 'مدنية';
  startLine: number;
  rukus: number;
}

export interface AyahInfo {
  id: string;
  surah: number;
  ayah: number;
  /** النص القرآني العثماني كما هو من المصدر — بلا أي تعديل (05-1) */
  text: string;
  /** حقل بحث مُطبَّع (03-REALM §5) — لا يُعرض للمستخدم */
  search: string;
  juz: number;
  quarter: number;
  manzil: number;
  ruku: number;
  page: number;
  sajdah: boolean;
}

export interface QuranManifest {
  id: string;
  sourceName: string;
  sourceVersion: string;
  license: string;
  sourceUrl: string;
  textChecksum: string;
  metadataSourceName: string;
  metadataSourceVersion: string;
  metadataLicense: string;
  metadataUrl: string;
  metadataChecksum: string;
  surahCount: number;
  ayahCount: number;
  contentChecksum: string;
  generatedAt: string;
  searchNormalization: string;
  validation: { status: string; checks: { id: string; name: string; ok: boolean; detail: string }[] };
}

export interface QuranBundle {
  manifest: QuranManifest;
  surahs: SurahInfo[];
  ayahs: AyahInfo[];
}

const bundle = rawBundle as unknown as QuranBundle;

let validated = false;

/** فحص بنيوي للحزمة عند أول استخدام — فشل الفحص يظهر للمستخدم ولا يُخفى (02-1) */
export function validateBundle(): void {
  if (validated) return;
  const m = bundle.manifest;
  if (m.validation.status !== 'passed') {
    throw new Error('حزمة المحتوى غير معتمدة (نتيجة بوابة الفحص ليست passed)');
  }
  if (bundle.surahs.length !== 114 || m.surahCount !== 114) {
    throw new Error('حزمة المحتوى: عدد السور غير مطابق (114)');
  }
  let total = 0;
  const seen = new Set<string>();
  for (const a of bundle.ayahs) {
    total += 1;
    if (seen.has(a.id)) throw new Error(`حزمة المحتوى: معرف آية مكرر ${a.id}`);
    seen.add(a.id);
  }
  if (total !== 6236 || m.ayahCount !== 6236) {
    throw new Error('حزمة المحتوى: عدد الآيات غير مطابق (6236)');
  }
  validated = true;
}

export function getQuranManifest(): QuranManifest {
  validateBundle();
  return bundle.manifest;
}

export function getQuranSurahs(): SurahInfo[] {
  validateBundle();
  return bundle.surahs;
}

export function getSurahInfo(number: number): SurahInfo | undefined {
  validateBundle();
  return bundle.surahs[number - 1];
}

export function getAyahsOfSurah(surahNumber: number): AyahInfo[] {
  validateBundle();
  const info = getSurahInfo(surahNumber);
  if (!info) return [];
  return bundle.ayahs.slice(info.startLine, info.startLine + info.ayahCount);
}

export function getAyah(surahNumber: number, ayahNumber: number): AyahInfo | undefined {
  validateBundle();
  const info = getSurahInfo(surahNumber);
  if (!info || ayahNumber < 1 || ayahNumber > info.ayahCount) return undefined;
  return bundle.ayahs[info.startLine + ayahNumber - 1];
}

/**
 * الرقم العالمي للآية (1..6236) كما يستخدمه خادم التلاوات آيةً بآية.
 * الحزمة مرتّبة ترتيب المصحف، و`startLine` هو موضع أول آية في السورة،
 * فالرقم العالمي = startLine + رقم الآية داخل السورة.
 */
export function getGlobalAyahNumber(surahNumber: number, ayahInSurah: number): number {
  validateBundle();
  const info = getSurahInfo(surahNumber);
  if (!info) throw new Error(`سورة غير موجودة: ${surahNumber}`);
  if (ayahInSurah < 1 || ayahInSurah > info.ayahCount) {
    throw new Error(`رقم آية خارج مجال السورة ${surahNumber}: ${ayahInSurah}`);
  }
  return info.startLine + ayahInSurah;
}

/**
 * تطبيع عربي للبحث فقط (مطابق لخوارزمية الاستيراد — موثقة في manifest.searchNormalization):
 * حذف التشكيل/التطويل/علامات المصحف، توحيد الألف (آأإٱ→ا)، ة→ه، ى→ي.
 * يُطبَّق على الاستعلام ليطابق حقل search المشتق؛ النص الأصلي لا يُعرض مطبعًا أبدًا (03-REALM §5).
 */
export function normalizeArabicForSearch(s: string): string {
  return s
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[\u06D6\u06D7\u06D8\u06D9\u06DA\u06DE\u06DF\u06E9]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0649/g, '\u064A')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface AyahSearchHit {
  surah: SurahInfo;
  ayah: AyahInfo;
}

/**
 * البحث في الآيات وأسماء السور (07-A: النتيجة تعرض اسم السورة ورقم الآية الصحيحين).
 * مطابقة جزئية في: النص المطبع، الاسم العربي المطبع، الترحيل اللاتيني (case-insensitive).
 */
export function searchAyahs(query: string, limit = 100): AyahSearchHit[] {
  validateBundle();
  const q = normalizeArabicForSearch(query);
  const qLatin = query.trim().toLowerCase();
  if (!q && !qLatin) return [];
  const hits: AyahSearchHit[] = [];
  for (const s of bundle.surahs) {
    const nameMatch =
      (q.length > 0 && normalizeArabicForSearch(s.nameArabic).includes(q)) ||
      (qLatin.length > 0 && s.nameTransliteration.toLowerCase().includes(qLatin));
    const ayahs = getAyahsOfSurah(s.number);
    for (const a of ayahs) {
      if (a.search.includes(q) || nameMatch) {
        hits.push({ surah: s, ayah: a });
        if (hits.length >= limit) return hits;
      }
    }
  }
  return hits;
}

/** رقم إلى أرقام هندية شرقية (٠-٩) لعرض الترقيم */
export function toArabicIndic(n: number): string {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

const META_ID = `content:${bundle.manifest.id}`;

/**
 * تسجيل Metadata المحتوى في قاعدة بيانات المستخدم (05-1: تسجيل المصدر والإصدار
 * والترخيص وتاريخ الاستيراد + 05-5-7: نتيجة الفحص). العملية idempotent — سجل واحد ثابت.
 */
export function ensureContentMetadata(): void {
  const m = getQuranManifest();
  const realm = getOpenAppRealm();
  const existing = realm.objects('ContentMetadata').filtered('id = $0', META_ID)[0];
  if (existing) return;
  realm.write(() => {
    realm.create('ContentMetadata', {
      id: META_ID,
      contentType: 'quran-data',
      sourceName: `${m.sourceName} + ${m.metadataSourceName}`,
      sourceVersion: `نص ${m.sourceVersion} / وصفية ${m.metadataSourceVersion}`,
      license: m.license,
      sourceUrl: m.sourceUrl,
      checksum: m.contentChecksum,
      importedAt: new Date(),
      validationStatus: m.validation.status,
    });
  });
}
