/**
 * واجهة المحتوى في طبقة المصباح (مصحف) — إعادة تصدير من المستودع.
 * المنطق الكامل (الحزمة، الفحص، البحث، Metadata) في
 * src/repositories/quran-content-repository.ts — خالٍ من RN وقابل للاختبار على Node.
 */
export {
  validateBundle,
  getQuranManifest,
  getQuranSurahs,
  getSurahInfo,
  getAyahsOfSurah,
  getAyah,
  normalizeArabicForSearch,
  searchAyahs,
  toArabicIndic,
  ensureContentMetadata,
  type SurahInfo,
  type AyahInfo,
  type QuranManifest,
  type QuranBundle,
  type AyahSearchHit,
} from '../../repositories/quran-content-repository';
