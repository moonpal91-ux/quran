/**
 * مخططات Realm لبيانات المستخدم المحلية.
 * المرجع: 03-REALM-DATABASE-SCHEMA.md (قسم 2 — المخططات المنطقية)
 *
 * ملاحظات:
 * - معرفات ثابتة وفريدة لكل كيان (primary key).
 * - التواريخ تُخزن Date/UTC وتُعرض بالتوقيت المحلي.
 * - لا تُخزن نصوص كبيرة في سجلات التقدم.
 * - فهارس على حقول البحث والربط كثيرة الاستخدام.
 */
import type { ObjectSchema } from 'realm';

/**
 * إصدار مخطط قاعدة بيانات المستخدم — يُرفع فقط مع ترحيل صريح.
 * 2 → 3 (المرحلة 6 — الاستماع): كائن AudioProgress (آخر موضع استماع لكل قارئ/سورة)
 * + حقول الصوت الاختيارية في AppSettings (القارئ المفضّل، معدل البِتّ، السرعة، التكرار، النمط).
 */
export const USER_SCHEMA_VERSION = 3;

/** اسم ملف قاعدة بيانات المستخدم (نسبي — يحله Realm داخل مساحة التطبيق على الأجهزة) */
export const APP_DB_PATH = 'QuranCompanion.realm';

export const AppSettingsSchema: ObjectSchema = {
  name: 'AppSettings',
  primaryKey: 'id',
  properties: {
    id: 'string',
    theme: 'string',
    fontScale: 'double',
    readingMode: 'string',
    mushafBg: 'string',
    lastSurahNumber: 'int',
    lastAyahNumber: 'int',
    lastReadAt: 'date?',
    dailyGoalUnit: 'string',
    dailyGoalValue: 'int',
    notificationsEnabled: 'bool',
    morningReminderTime: 'string?',
    eveningReminderTime: 'string?',
    // ── المرحلة 6 (الاستماع) — كلها اختيارية: لا سجل قديم يفقد قيمته عند الترحيل
    /** القارئ المفضَّل (معرّف فهرس التلاوات، مثال ar.alafasy) */
    preferredReciterId: 'string?',
    /** معدل البِتّ المفضَّل للتنزيل: '192' | '128' | '64' | '48' | '40' | '32' */
    audioBitrate: 'string?',
    /** سرعة التشغيل (1.0 عادية) */
    audioPlaybackRate: 'double?',
    /** نمط التكرار: 'off' | 'ayah' | 'surah' */
    audioRepeatMode: 'string?',
    /** نمط الملفات: 'surah' (ملف سورة كامل) | 'ayah' (ملف لكل آية) */
    audioMode: 'string?',
    updatedAt: 'date',
  },
};

export const BookmarkSchema: ObjectSchema = {
  name: 'Bookmark',
  primaryKey: 'id',
  properties: {
    id: 'string',
    surahNumber: 'int',
    ayahNumber: 'int',
    label: 'string?',
    createdAt: 'date',
    updatedAt: 'date',
  },
  // فهرس على موضع العلامة للبحث السريع في المكتبة
};

export const FavoriteAyahSchema: ObjectSchema = {
  name: 'FavoriteAyah',
  primaryKey: 'id',
  properties: {
    id: 'string',
    surahNumber: 'int',
    ayahNumber: 'int',
    createdAt: 'date',
  },
};

export const PersonalNoteSchema: ObjectSchema = {
  name: 'PersonalNote',
  primaryKey: 'id',
  properties: {
    id: 'string',
    surahNumber: 'int',
    ayahNumber: 'int?',
    title: 'string?',
    body: 'string',
    tags: 'string[]',
    createdAt: 'date',
    updatedAt: 'date',
  },
};

export const ReadingPlanSchema: ObjectSchema = {
  name: 'ReadingPlan',
  primaryKey: 'id',
  properties: {
    id: 'string',
    title: 'string',
    planType: 'string',
    startDate: 'date',
    targetEndDate: 'date?',
    goalUnit: 'string',
    goalValue: 'int',
    status: 'string',
    createdAt: 'date',
    updatedAt: 'date',
  },
};

export const ReadingSessionSchema: ObjectSchema = {
  name: 'ReadingSession',
  primaryKey: 'id',
  properties: {
    id: 'string',
    startedAt: 'date',
    endedAt: 'date?',
    startSurahNumber: 'int',
    startAyahNumber: 'int',
    endSurahNumber: 'int?',
    endAyahNumber: 'int?',
    pagesRead: 'int',
    ayahsRead: 'int',
    durationSeconds: 'int',
    source: 'string',
    createdAt: 'date',
  },
};

export const DailyProgressSchema: ObjectSchema = {
  name: 'DailyProgress',
  primaryKey: 'id',
  properties: {
    id: 'string',
    date: 'date',
    ayahsRead: 'int',
    pagesRead: 'int',
    audioMinutes: 'int',
    adhkarCompleted: 'int',
    wordsLearned: 'int',
    updatedAt: 'date',
  },
};

export const DhikrProgressSchema: ObjectSchema = {
  name: 'DhikrProgress',
  primaryKey: 'id',
  properties: {
    id: 'string',
    contentId: 'string',
    dateKey: 'string',
    countCompleted: 'int',
    targetCount: 'int',
    updatedAt: 'date',
  },
};

export const DownloadRecordSchema: ObjectSchema = {
  name: 'DownloadRecord',
  primaryKey: 'id',
  properties: {
    id: 'string',
    contentType: 'string',
    contentId: 'string',
    version: 'string',
    status: 'string',
    bytesDownloaded: 'int',
    totalBytes: 'int?',
    updatedAt: 'date',
  },
};

/**
 * تقدّم الاستماع (المرحلة 6) — آخر موضع لكل (قارئ، سورة).
 * المفتاح: `id = <reciterId>:<surahNumber>` — يسمح باستئناف مختلف لكل قارئ.
 * لا يُشتق من جلسات القراءة: الاستماع نشاط مستقل.
 */
export const AudioProgressSchema: ObjectSchema = {
  name: 'AudioProgress',
  primaryKey: 'id',
  properties: {
    id: 'string',
    reciterId: 'string',
    surahNumber: 'int',
    /** آخر آية سُمعت (1..عدد الآيات) — 1 = بداية السورة */
    ayahNumber: 'int',
    /** الموضع داخل ملف السورة بالميلي ثانية (نمط «السورة الكاملة») */
    positionMs: 'int',
    /** هل أُتمّ تشغيل السورة إلى نهايتها */
    completed: 'bool',
    updatedAt: 'date',
  },
};

export const ContentMetadataSchema: ObjectSchema = {
  name: 'ContentMetadata',
  primaryKey: 'id',
  properties: {
    id: 'string',
    contentType: 'string',
    sourceName: 'string',
    sourceVersion: 'string',
    license: 'string',
    sourceUrl: 'string?',
    checksum: 'string?',
    importedAt: 'date',
    validationStatus: 'string',
  },
};

/** المخططات الكاملة لقاعدة بيانات المستخدم */
export const userSchemas: ObjectSchema[] = [
  AppSettingsSchema,
  BookmarkSchema,
  FavoriteAyahSchema,
  PersonalNoteSchema,
  ReadingPlanSchema,
  ReadingSessionSchema,
  DailyProgressSchema,
  DhikrProgressSchema,
  AudioProgressSchema,
  DownloadRecordSchema,
  ContentMetadataSchema,
];
