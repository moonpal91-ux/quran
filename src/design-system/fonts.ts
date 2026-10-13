/**
 * تحميل الخطوط المضمّنة (يعمل دون اتصال).
 * - Tajawal (OFL — Boutros International 2017): خط الواجهة العربية.
 * - Amiri Quran (OFL — Amiri Project): خط الرسم العثماني لنص القرآن.
 * الخطوط في assets/fonts/ مع وثائق الترخيص في docs/FONTS.md.
 */
import { loadAsync } from 'expo-font';

const FONT_MAP: Record<string, string> = {
  Tajawal_Regular: require('../../assets/fonts/Tajawal-Regular.ttf'),
  Tajawal_Medium: require('../../assets/fonts/Tajawal-Medium.ttf'),
  Tajawal_Bold: require('../../assets/fonts/Tajawal-Bold.ttf'),
  AmiriQuran: require('../../assets/fonts/AmiriQuran.ttf'),
};

let loadPromise: Promise<void> | null = null;

/** تحميل جميع الخطوط مرة واحدة (يدعى عند إقلاع التطبيق) */
export function loadAppFonts(): Promise<void> {
  if (!loadPromise) {
    loadPromise = loadAsync(FONT_MAP).catch((e: unknown) => {
      loadPromise = null;
      throw e;
    });
  }
  return loadPromise;
}
