/**
 * مستودع فهرس التلاوات (المرحلة 6) — الوصول إلى حزمة الفهرس الموثّقة.
 *
 * نفس القرار المعماري لباقي الحزم (03-REALM §3): المحتوى الثابت في حزمة إصدار
 * موثّقة (content/audio-catalog.json) مُنتَجة بـ scripts/import-audio-catalog.mjs
 * من مادة خام مُثبَّتة (content/refs/audio/alquran-cloud-cdn.json) منسوخة حرفيًا
 * من وثيقة CDN الرسمية وواجهة الإصدارات الرسمية.
 *
 * قواعد صارمة:
 * - **لا ملفات صوت داخل الحزمة** — الفهرس «وصفات روابط» فقط؛ التنزيل على جهاز المستخدم.
 * - **لا أسماء مُختلقة**: كل حقل منسوخ من المصدر، والاختلافات بين المصدرين موثّقة في notes.
 * - حالة التحقق (`verification.status`) تُعرض للمستخدم كما هي — لا تُجمَّل.
 *
 * هذا الملف خالٍ من أي اعتماد على React Native — يُختبر مباشرة على Node.
 */
import rawBundle from '../../content/audio-catalog.json';

export type AudioRepeatMode = 'off' | 'ayah' | 'surah';
export type AudioMode = 'surah' | 'ayah';

export interface Reciter {
  /** معرّف الإصدار كما يستخدمه الـ CDN (مثال ar.alafasy) */
  id: string;
  /** اسم القارئ بالعربية (من المصدر) */
  nameAr: string;
  nameEn: string;
  /** نمط التلاوة: مرتَّل / مجوَّد / مُعلِّم */
  styleAr: string;
  styleEn: string;
  /** معدل البِتّ الموصى به من المصدر */
  defaultBitrate: string;
  /** معدلات البِتّ المتاحة حسب الوثيقة (التوفّر الفعلي يختلف — يتحقق عند التنزيل) */
  bitrates: string[];
  /** نمط رابط الآية بعد استبدال الإصدار: .../audio/{bitrate}/ar.alafasy/{number}.mp3 */
  ayahUrl: string;
  /** نمط رابط السورة: .../audio-surah/{bitrate}/ar.alafasy/{number}.mp3 */
  surahUrl: string;
  sourceId: string;
  ayahVerified: boolean;
  surahVerified: boolean;
  notes: string | null;
}

export interface AudioCatalogManifest {
  contentType: string;
  sourceName: string;
  sourceUrl: string;
  licenseNote: string;
  licenseReviewRequired: boolean;
  ranges: { ayah: { min: number; max: number }; surah: { min: number; max: number } };
  reciterCount: number;
  rawFile: string;
  rawSha256: string;
  verification: { status: string; method?: string; note?: string; checkedAt?: string };
  generatedAt: string;
}

export interface AudioCatalogBundle {
  manifest: AudioCatalogManifest;
  patterns: { ayah: string; surah: string };
  bitrates: string[];
  reciters: Reciter[];
}

export interface AudioCatalogRepository {
  manifest(): AudioCatalogManifest;
  reciters(): Reciter[];
  getReciter(id: string): Reciter | null;
  /** هل الفهرس مُتحقَّق منه فعليًا (روابط مختبرة) — يُعرض للمستخدم بصدق */
  isVerified(): boolean;
  /**
   * ابنِ رابط ملف آية. يرفع استثناءً عند رقم خارج 1..6236 (لا روابط وهمية).
   */
  ayahFileUrl(reciterId: string, ayahGlobal: number, bitrate?: string): string;
  /** ابنِ رابط ملف سورة كاملة — يرفع استثناءً عند رقم خارج 1..114 */
  surahFileUrl(reciterId: string, surahNumber: number, bitrate?: string): string;
  /** مسار الحفظ النسبي داخل مجلد الصوت بالتطبيق */
  localRelativePath(reciterId: string, mode: AudioMode, number: number): string;
}

const bundle = rawBundle as unknown as AudioCatalogBundle;

let cached: AudioCatalogRepository | null = null;

function requireReciter(id: string): Reciter {
  const r = bundle.reciters.find((x) => x.id === id);
  if (!r) throw new Error(`قارئ غير موجود في الفهرس: ${id}`);
  return r;
}

function checkRange(n: number, min: number, max: number, what: string): void {
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${what} خارج المجال المسموح (${min}..${max}): ${n}`);
  }
}

export function getAudioCatalogRepository(): AudioCatalogRepository {
  if (cached) return cached;
  cached = {
    manifest() {
      return bundle.manifest;
    },
    reciters() {
      return bundle.reciters.slice();
    },
    getReciter(id) {
      return bundle.reciters.find((x) => x.id === id) ?? null;
    },
    isVerified() {
      return bundle.manifest.verification?.status === 'verified';
    },
    ayahFileUrl(reciterId, ayahGlobal, bitrate) {
      const r = requireReciter(reciterId);
      checkRange(ayahGlobal, bundle.manifest.ranges.ayah.min, bundle.manifest.ranges.ayah.max, 'رقم الآية');
      return r.ayahUrl
        .replace('{bitrate}', bitrate ?? r.defaultBitrate)
        .replace('{number}', String(ayahGlobal));
    },
    surahFileUrl(reciterId, surahNumber, bitrate) {
      const r = requireReciter(reciterId);
      checkRange(surahNumber, bundle.manifest.ranges.surah.min, bundle.manifest.ranges.surah.max, 'رقم السورة');
      return r.surahUrl
        .replace('{bitrate}', bitrate ?? r.defaultBitrate)
        .replace('{number}', String(surahNumber));
    },
    localRelativePath(reciterId, mode, number) {
      // مجلد لكل قارئ + نمط، واسم الملف برقم ثابت العرض (ترتيب أبجدي صحيح)
      const padded = String(number).padStart(mode === 'surah' ? 3 : 4, '0');
      return `audio/${reciterId}/${mode}/${padded}.mp3`;
    },
  };
  return cached;
}

/** إعادة ضبط المخزن (اختبارات) */
export function _resetAudioCatalogRepositoryForTests(): void {
  cached = null;
}
