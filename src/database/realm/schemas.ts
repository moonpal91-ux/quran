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
 *
 * 1 → 2 (المرحلة 4): mushafBg على AppSettings.
 * 2 → 3 (المرحلة 6 — الاستماع): كائن AudioProgress + حقول الصوت الاختيارية.
 * 3 → 4 (2026-10-14): **إزالة** المرحلة 6 بالكامل بطلب المستخدم (التبويب كان يعطي
 *   شاشة بيضاء). يُحذف كائن AudioProgress وحقول الصوت الخمسة من AppSettings.
 *   الترحيل آمن: Realm يحذف الصنف والخصائص تلقائيًا عند رفع الإصدار، ولا يُفقد
 *   أي شيء من بيانات المستخدم (القراءة والأذكار والخطط).
 */
export const USER_SCHEMA_VERSION = 4;

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
  DownloadRecordSchema,
  ContentMetadataSchema,
];
