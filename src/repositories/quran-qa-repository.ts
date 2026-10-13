/**
 * مستودع التفسير (المرحلة 4) — الوصول إلى حزمة التفسير المعتمدة.
 *
 * نفس القرار المعماري لحزمة المصحف (03-REALM §3): المحتوى الثابت في **حزمة إصدار
 * موثقة** (content/tafsir-data.json) منفصلًا عن بيانات المستخدم في Realm.
 *
 * الحزمة مُنتجة بـ scripts/import-quran-qa.mjs وفق بوابة الاعتماد (05):
 * - المصدر: api.quran.com — تفسير ابن كثير (resource_id 14) + تفسير البغوي/معاني
 *   القرآن (resource_id 94)، كلاهما نصوص كلاسيكية في الملك العام.
 * - لا توليد بنماذج لغوية؛ التطبيع الوحيد: إزالة وسوم HTML.
 * - نواقص المصدر (ibnkathir: 31 آية موثقة في content/QA-IMPORT-REPORT.md) تُعرض
 *   للمستخدم «لا يتوفر» — لا نختلق محتواها.
 *
 * هذا الملف خالٍ من أي اعتماد على React Native — يُختبر مباشرة على Node.
 */
import rawBundle from '../../content/tafsir-data.json';
import { getAyah } from './quran-content-repository';

export interface TafsirSourceMeta {
  id: string;
  resource_id: number;
  name: string;
  author: string;
  note: string;
  language: string;
  accessed: string;
  distribution: string;
}

interface RawBundle {
  generatedAt: string;
  pipeline: string;
  sources: TafsirSourceMeta[];
  gaps: Record<string, string[]>;
  tafsir: Record<string, Record<string, string>>;
}

const bundle = rawBundle as unknown as RawBundle;

/** فحص بنيوي خفيف عند أول استخدام — يطابق سياسة حزمة المصحف */
let validated = false;
export function validateTafsirBundle(): void {
  if (validated) return;
  if (!Array.isArray(bundle.sources) || bundle.sources.length !== 2) {
    throw new Error('حزمة التفسير: عدد المصادر غير متوقع');
  }
  const keys = Object.keys(bundle.tafsir);
  if (keys.length !== 6236) {
    throw new Error(`حزمة التفسير: عدد المفاتيح ${keys.length} ≠ 6236`);
  }
  for (const src of bundle.sources) {
    if (!Array.isArray(bundle.gaps[src.id])) {
      throw new Error(`حزمة التفسير: نواقص المصدر ${src.id} غير موجودة`);
    }
  }
  validated = true;
}

/** مصادر التفسير المعتمدة */
export function getTafsirSources(): TafsirSourceMeta[] {
  validateTafsirBundle();
  return bundle.sources;
}

/** قائمة المفاتيح التي لا يغطيها المصدر (نواقص موثقة) */
export function getTafsirGaps(sourceId: string): string[] {
  validateTafsirBundle();
  return bundle.gaps[sourceId] ?? [];
}

/**
 * نص التفسير للآية من مصدر معتمد.
 * @returns النص (فقاعات مفصولة بـ \n) أو null إن غاب عن المصدر (نواقص موثقة/معرف مرفوض)
 */
export function getTafsir(surahNumber: number, ayahNumber: number, sourceId: string): string | null {
  validateTafsirBundle();
  if (!bundle.sources.some((s) => s.id === sourceId)) return null;
  const entry = bundle.tafsir[`${surahNumber}:${ayahNumber}`];
  const text = entry?.[sourceId];
  return text && text.trim().length > 0 ? text : null;
}

/**
 * كلمات الآية (تقسيم النص العثماني المعتمد على مسافات) — أساس «معاني الكلمات».
 * النص من حزمة المصحف نفسها (رسم عثماني حرفي) فلا تغيير على القرآن أبدًا.
 */
export function getAyahWords(surahNumber: number, ayahNumber: number): string[] {
  const ayah = getAyah(surahNumber, ayahNumber);
  if (!ayah) return [];
  return ayah.text.split(/\s+/).filter((w) => w.length > 0);
}
