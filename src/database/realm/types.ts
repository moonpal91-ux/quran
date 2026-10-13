/**
 * أنواع بيانات المستخدم (بدون استيراد Realm) — تُستخدم في الواجهات والخزائن.
 * المرجع: 03-REALM-DATABASE-SCHEMA.md
 */

/** سمة التطبيق: فاتح | داكن | دافئ */
export type AppTheme = 'light' | 'dark' | 'warm';

/** نمط قراءة المصحف: متتابع | صفحة مصحف */
export type ReadingMode = 'continuous' | 'mushaf-page';

/** لون صفحة المصحف (خلفية مريحة للعين): يتبع السمة | رَقّ | ليل | غابة */
export type MushafBg = 'theme' | 'parchment' | 'night' | 'forest';

/** وحدة الهدف اليومي */
export type GoalUnit = 'pages' | 'ayahs' | 'juz';

/** نوع الخطة */
export type PlanType = 'khatmah' | 'custom' | 'memorization' | 'review';

/** حالة الخطة */
export type PlanStatus = 'active' | 'paused' | 'completed' | 'archived';

/** نوع محتوى التنزيل */
export type DownloadContentType = 'audio' | 'tafsir' | 'dictionary' | 'quran-data';

/** حالة التنزيل */
export type DownloadStatus = 'queued' | 'downloading' | 'completed' | 'failed' | 'removed';

/** حالة فحص صحة المحتوى المستورد */
export type ValidationStatus = 'pending' | 'passed' | 'failed';

/** سجل الإعدادات — سجل واحد ثابت id = 'app-settings' */
export interface AppSettings {
  id: string;
  theme: AppTheme;
  fontScale: number;
  readingMode: ReadingMode;
  /** خلفية صفحة المصحف (مريحة للعين) — الافتراضي: يتبع سمة التطبيق */
  mushafBg: MushafBg;
  lastSurahNumber: number;
  lastAyahNumber: number;
  lastReadAt?: Date | null;
  dailyGoalUnit: GoalUnit;
  dailyGoalValue: number;
  notificationsEnabled: boolean;
  morningReminderTime?: string | null;
  eveningReminderTime?: string | null;
  // ── المرحلة 6 (الاستماع)
  /** القارئ المفضَّل (معرّف فهرس التلاوات) */
  preferredReciterId?: string | null;
  /** معدل البِتّ المفضَّل للتنزيل */
  audioBitrate?: string | null;
  /** سرعة التشغيل */
  audioPlaybackRate?: number | null;
  /** نمط التكرار: بلا تكرار / تكرار الآية / تكرار السورة */
  audioRepeatMode?: AudioRepeatMode | null;
  /** نمط الملفات: ملف سورة كامل / ملف لكل آية */
  audioMode?: AudioMode | null;
  updatedAt: Date;
}

/** نمط تكرار التشغيل (المرحلة 6) */
export type AudioRepeatMode = 'off' | 'ayah' | 'surah';

/** نمط ملفات التلاوة: ملف واحد للسورة، أو ملف لكل آية */
export type AudioMode = 'surah' | 'ayah';

/** سجل تقدّم الاستماع — آخر موضع لكل (قارئ، سورة) — المرحلة 6 */
export interface AudioProgress {
  /** المفتاح: `<reciterId>:<surahNumber>` */
  id: string;
  reciterId: string;
  surahNumber: number;
  /** آخر آية سُمعت (1..عدد الآيات) */
  ayahNumber: number;
  /** الموضع داخل ملف السورة (ميلي ثانية) */
  positionMs: number;
  completed: boolean;
  updatedAt: Date;
}

export interface Bookmark {
  id: string;
  surahNumber: number;
  ayahNumber: number;
  label?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FavoriteAyah {
  id: string;
  surahNumber: number;
  ayahNumber: number;
  createdAt: Date;
}

export interface PersonalNote {
  id: string;
  surahNumber: number;
  ayahNumber?: number | null;
  title?: string | null;
  body: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReadingPlan {
  id: string;
  title: string;
  planType: PlanType;
  startDate: Date;
  targetEndDate?: Date | null;
  goalUnit: GoalUnit;
  goalValue: number;
  status: PlanStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReadingSession {
  id: string;
  startedAt: Date;
  endedAt?: Date | null;
  startSurahNumber: number;
  startAyahNumber: number;
  endSurahNumber?: number | null;
  endAyahNumber?: number | null;
  pagesRead: number;
  ayahsRead: number;
  durationSeconds: number;
  source: 'manual' | 'reader';
  createdAt: Date;
}

/** مفتاح يومي ثابت بصيغة YYYY-MM-DD حسب التقويم المحلي المحدد */
export interface DailyProgress {
  id: string;
  date: Date;
  ayahsRead: number;
  pagesRead: number;
  audioMinutes: number;
  adhkarCompleted: number;
  wordsLearned: number;
  updatedAt: Date;
}

export interface DhikrProgress {
  id: string;
  contentId: string;
  dateKey: string;
  countCompleted: number;
  targetCount: number;
  updatedAt: Date;
}

export interface DownloadRecord {
  id: string;
  contentType: DownloadContentType;
  contentId: string;
  version: string;
  status: DownloadStatus;
  bytesDownloaded: number;
  totalBytes?: number | null;
  updatedAt: Date;
}

export interface ContentMetadata {
  id: string;
  contentType: string;
  sourceName: string;
  sourceVersion: string;
  license: string;
  sourceUrl?: string | null;
  checksum?: string | null;
  importedAt: Date;
  validationStatus: ValidationStatus;
}

/** معرّف ثابت للإعدادات الوحيدة */
export const APP_SETTINGS_ID = 'app-settings';

/** قيم افتراضية للإعدادات — تُنشأ عند أول تشغيل فقط */
export const DEFAULT_SETTINGS: Omit<AppSettings, 'id'> = {
  theme: 'light',
  fontScale: 1.0,
  readingMode: 'continuous',
  mushafBg: 'theme',
  lastSurahNumber: 1,
  lastAyahNumber: 1,
  lastReadAt: null,
  dailyGoalUnit: 'ayahs',
  dailyGoalValue: 20,
  notificationsEnabled: false,
  morningReminderTime: null,
  eveningReminderTime: null,
  // ── المرحلة 6 (الاستماع) — قيم افتراضية موثّقة
  preferredReciterId: null,
  audioBitrate: '128',
  audioPlaybackRate: 1.0,
  audioRepeatMode: 'off',
  audioMode: 'surah',
  updatedAt: new Date(),
};
