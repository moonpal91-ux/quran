/**
 * مستودع الأذكار (المرحلة 5) — الوصول إلى حزمة الأذكار المعتمدة.
 *
 * نفس القرار المعماري لحزمتي المصحف والتفسير (03-REALM §3): المحتوى الثابت في
 * **حزمة إصدار موثقة** (content/adhkar-data.json) منفصلًا عن بيانات المستخدم في Realm.
 *
 * الحزمة مُنتجة بـ scripts/import-adhkar.mjs وفق بوابة الاعتماد (05):
 * - المصدر: osamayy/azkar-db @ fbdfa017782c (نص «حصن المسلم من أذكار الكتاب
 *   والسنة» — نص ديني في الملكية العامة؛ المستوديو بلا رخصة صريحة = مخاطرة موثقة).
 * - التحقق المستقل: Seen-Arabic (MIT) لأذكار الصباح/المساء + حزمة Tanzil المعتمدة
 *   لكل نص قرآني داخل الأذكار (12/12 متطابقًا).
 * - لا توليد بنماذج لغوية؛ التطبيع الوحيد: تنظيف هيكلي (أقواس/أسطر).
 *
 * قاعدة العرض: العنصر ذو `quranRef` يُعرض نصه من حزمة Tanzil المعتمدة
 * (اتساق مع المصحف) — لا من المصدر الخام.
 *
 * هذا الملف خالٍ من أي اعتماد على React Native — يُختبر مباشرة على Node.
 */
import rawBundle from '../../content/adhkar-data.json';
import { getAyahsOfSurah, getAyah } from './quran-content-repository';

export interface AdhkarManifest {
  name: string;
  version: string;
  importedAt: string;
  contentLicense: string;
  sha256Source: string;
  rules: string[];
}

export interface AdhkarCategory {
  id: number;
  name: string;
}

export interface AdhkarItem {
  /** معرّف مستقر: <فئة>-<ترتيب> (مثال 1-3) */
  id: string;
  categoryId: number;
  category: string;
  /** النص كما في المصدر (فصحى مشكّلة) — للعرض غير القرآني */
  zekr: string;
  /** عدد التكرار: القيمة من المصدر، وإلا 1 (قاعدة موثقة) */
  count: number;
  /** المصدر (آية/سورة/حديث) إن وُجد */
  reference: string | null;
  /** البيان/الفضل إن وُجد */
  description: string | null;
  /** مرجع قرآني: "سورة:آية" أو "سورة:*" (سورة كاملة) — إن وُجد يُعرض من Tanzil */
  quranRef: string | null;
}

interface RawBundle {
  manifest: AdhkarManifest;
  categories: AdhkarCategory[];
  items: AdhkarItem[];
}

const bundle = rawBundle as unknown as RawBundle;

let validated = false;
/** فحص بنيوي عند أول استخدام — يطابق سياسة حزمي المصحف والتفسير */
export function validateAdhkarBundle(): void {
  if (validated) return;
  if (!Array.isArray(bundle.items) || bundle.items.length !== 345) {
    throw new Error(`حزمة الأذكار: عدد العناصر غير متوقع (${bundle.items?.length})`);
  }
  if (!Array.isArray(bundle.categories) || bundle.categories.length !== 135) {
    throw new Error(`حزمة الأذكار: عدد الفئات غير متوقع (${bundle.categories?.length})`);
  }
  for (const it of bundle.items) {
    if (!it.id || !it.zekr || it.zekr.trim().length < 5 || !(it.count >= 1)) {
      throw new Error(`حزمة الأذكار: عنصر تالف (${it.id})`);
    }
  }
  if (new Set(bundle.items.map(i => i.id)).size !== bundle.items.length) {
    throw new Error('حزمة الأذكار: معرفات مكررة');
  }
  validated = true;
}

/** بيانات الحزمة (إصدار/ترخيص/مصادر) — لشاشة «حول التطبيق» */
export function getAdhkarManifest(): AdhkarManifest {
  validateAdhkarBundle();
  return bundle.manifest;
}

/** الفئات بالترتيب مع عدد عناصر كل فئة */
export function getAdhkarCategories(): (AdhkarCategory & { itemCount: number })[] {
  validateAdhkarBundle();
  const counts = new Map<number, number>();
  for (const it of bundle.items) counts.set(it.categoryId, (counts.get(it.categoryId) || 0) + 1);
  return bundle.categories.map(c => ({ ...c, itemCount: counts.get(c.id) || 0 }));
}

/** عناصر فئة */
export function getAdhkarItemsByCategory(categoryId: number): AdhkarItem[] {
  validateAdhkarBundle();
  return bundle.items.filter(i => i.categoryId === categoryId);
}

/** عنصر بالمعرف */
export function getAdhkarItem(id: string): AdhkarItem | undefined {
  validateAdhkarBundle();
  return bundle.items.find(i => i.id === id);
}

/**
 * نص العرض: إن كان العنصر قرآنيًا (quranRef) يُؤخذ من حزمة Tanzil المعتمدة
 * (اتساق المصحف)، وإلا نص المصدر (فصحى مشكّلة) كما هو دون تعديل.
 */
export function getAdhkarDisplayText(item: AdhkarItem): string {
  validateAdhkarBundle();
  if (!item.quranRef) return item.zekr;
  const [sRaw, aRaw] = item.quranRef.split(':');
  const surah = parseInt(sRaw, 10);
  if (aRaw === '*') {
    return getAyahsOfSurah(surah).map(a => a.text).join('');
  }
  const ayah = parseInt(aRaw, 10);
  const rec = getAyah(surah, ayah);
  return rec ? rec.text : item.zekr;
}
