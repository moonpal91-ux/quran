/**
 * رموز التصميم — المرجع: 04-UX-UI-SPEC.md (القسم 2)
 * هوية إسلامية معاصرة هادئة: أخضر زمردي + ذهبي + خلفية دافئة.
 *
 * ملاحظة: قيم الوضع الدافئ والداكن (نصوص/تباين) مشتقة من لوحة الألوان المعتمدة
 * وتُراجع فعليًا وفق WCAG عند الاختبار على المنصات (متطلب 04-2).
 */

export interface ThemeTokens {
  /** الخلفية العامة */
  background: string;
  /** خلفية البطاقات والأسطح */
  surface: string;
  /** اللون الأساسي (أخضر زمردي) */
  primary: string;
  primaryDark: string;
  /** الذهبي الهادئ للتأكيدات */
  accent: string;
  /** النص الأساسي */
  text: string;
  /** النص الثانوي */
  muted: string;
  /** حافة خفيفة للبطاقات */
  border: string;
  /** لون الخطأ/التحذير */
  error: string;
  /** خلفية أزرار أساسية (نص أبيض فوقها) */
  onPrimary: string;
}

export const lightTheme: ThemeTokens = {
  background: '#F8F6F0',
  surface: '#FFFFFF',
  primary: '#145A46',
  primaryDark: '#0B3B30',
  accent: '#C7A45D',
  text: '#1F2925',
  muted: '#66736D',
  border: '#E5E1D8',
  error: '#8C2F2F',
  onPrimary: '#FFFFFF',
};

export const darkTheme: ThemeTokens = {
  background: '#111A17',
  surface: '#1B2823',
  primary: '#2E8B6E',
  primaryDark: '#145A46',
  accent: '#D4B87A',
  text: '#E8ECE9',
  muted: '#93A39B',
  border: '#2A3A33',
  error: '#D08770',
  onPrimary: '#FFFFFF',
};

/** وضع القراءة الدافئة — خلفية كريمية للقراءة المريحة */
export const warmTheme: ThemeTokens = {
  background: '#F7F0E3',
  surface: '#FDF9F0',
  primary: '#145A46',
  primaryDark: '#0B3B30',
  accent: '#B08D4F',
  text: '#2B2620',
  muted: '#7A715F',
  border: '#E8DFC9',
  error: '#8C2F2F',
  onPrimary: '#FFFFFF',
};

export type ThemeName = 'light' | 'dark' | 'warm';

export const themes: Record<ThemeName, ThemeTokens> = {
  light: lightTheme,
  dark: darkTheme,
  warm: warmTheme,
};

export const themeLabels: Record<ThemeName, string> = {
  light: 'فاتح',
  dark: 'داكن',
  warm: 'دافئ',
};

/** المسافات — أساس 8 (04-2) */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** أنصاف الأقطار — بطاقة 18 (04-2) */
export const radius = {
  sm: 10,
  card: 18,
  lg: 24,
  full: 999,
} as const;

/** الحد الأدنى لأهداف اللمس (04-2) */
export const touchTarget = 44;

/** أحجام الخطوط الأساسية (تُضرب في fontScale) */
export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  /** نص المصحف — Amiri Quran يتطلب مسافة أسطر واسعة للتشكيل */
  quran: 22,
} as const;

export const fontFamilies = {
  ui: 'Tajawal_Regular',
  uiMedium: 'Tajawal_Medium',
  uiBold: 'Tajawal_Bold',
  quran: 'AmiriQuran',
} as const;

/** لوحات «صفحة المصحف» — ألوان مريحة للعين للقراءة الطويلة (مرحلة 4).
 *  تُطبَّق على صفحة القراءة فقط (لا على بقية التطبيق)، ويمكن أن تختلف عن سمة الواجهة. */
export interface MushafPalette {
  /** خلفية الصفحة */
  page: string;
  /** نص المصحف */
  quran: string;
  /** أرقام الآيات والتفاصيل الثانوية */
  ayahMeta: string;
  /** حدود خفيفة داخل الصفحة */
  border: string;
}

export const mushafPalettes: Record<'parchment' | 'night' | 'forest', MushafPalette> = {
  /** رَقّ — كريمي دافئ كلاسيكي */
  parchment: { page: '#F6F1E4', quran: '#2A2417', ayahMeta: '#8A7B57', border: '#E7DEC8' },
  /** ليل — أسود مخضرّم ناعم (وضع ليلي) */
  night: { page: '#101413', quran: '#E9E6DA', ayahMeta: '#7E8A84', border: '#232B28' },
  /** غابة — أخضر زمردي داكن هادئ */
  forest: { page: '#13221C', quran: '#DCE8DF', ayahMeta: '#7FA08F', border: '#244034' },
};

export type MushafBgChoice = 'theme' | 'parchment' | 'night' | 'forest';

export const mushafBgLabels: Record<MushafBgChoice, string> = {
  theme: 'يتبع السمة',
  parchment: 'رَقّ',
  night: 'ليل',
  forest: 'غابة',
};
