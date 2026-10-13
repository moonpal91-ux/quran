/**
 * اختبار المرحلة 0 — إثبات أن Realm يفتح محليًا ويكتب ويقرأ ويستعيد.
 * يُشغَّل على Node (نفس حزمة realm 20.2.0 المستخدمة على React Native).
 *
 * بيانات الاختبار معزولة في ملف .test-data/ خاص ولا تدخل قاعدة التطبيق.
 * المرجع: بوابة قبول المرحلة 0 (06-IMPLEMENTATION-PLAN.md) + قائمة B (07-ACCEPTANCE-TESTS.md)
 *
 * ملاحظة تشغيلية: addon الخاص بـ Realm يُبقي عملية Node حية بعد close()،
 * لذلك يُنهى الاختبار بـ process.exit() صريحًا في نهاية كل مسار.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Realm } from 'realm';
import { userSchemas, USER_SCHEMA_VERSION } from '../src/database/realm/schemas';
import {
  APP_SETTINGS_ID,
  DEFAULT_SETTINGS,
} from '../src/database/realm/types';

const TEST_DIR = path.join(__dirname, '..', '.test-data');
const TEST_DB = path.join(TEST_DIR, 'stage0-test.realm');

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** جلب سجل واحد بمفتاحه الأساسي — النمط المعتمد في realm 20 (لا توجد object()) */
function byId<T = any>(realm: Realm, type: string, id: string): T | null {
  return realm.objects(type).filtered('id = $0', id)[0] as unknown as T | null;
}

async function main(): Promise<void> {
  // تجهيز بيئة اختبار نظيفة
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });

  console.log('\n[1] فتح قاعدة بيانات جديدة (أول تشغيل)');
  const wasFirstLaunch = !Realm.exists(TEST_DB);
  const realm: Realm = await Realm.open({
    path: TEST_DB,
    schema: userSchemas,
    schemaVersion: USER_SCHEMA_VERSION,
  });
  check('فُتح ملف Realm محليًا بنجاح', !realm.isClosed);
  check('إصدار المخطط = ' + USER_SCHEMA_VERSION, realm.schemaVersion === USER_SCHEMA_VERSION);
  check(
    'تُعرف كل المخططات العشرة',
    userSchemas.every((s) => realm.schema.some((x) => x.name === s.name)),
  );
  check('رُصد أول تشغيل بشكل صحيح', wasFirstLaunch);

  console.log('\n[2] الإعدادات: إنشاء ثم قراءة ثم تحديث داخل معاملة');
  realm.write(() => {
    realm.create('AppSettings', { ...DEFAULT_SETTINGS, id: APP_SETTINGS_ID });
  });
  let settings = byId(realm, 'AppSettings', APP_SETTINGS_ID);
  check('وُجد سجل الإعدادات', !!settings);
  check('القيمة الافتراضية theme = light', settings?.theme === 'light');
  realm.write(() => {
    const s = byId(realm, 'AppSettings', APP_SETTINGS_ID);
    if (s) {
      s.fontScale = 1.25;
      s.updatedAt = new Date();
    }
  });
  settings = byId(realm, 'AppSettings', APP_SETTINGS_ID);
  check('تحديث fontScale حُفظ داخل معاملة', settings?.fontScale === 1.25);

  console.log('\n[3] العلامات المرجعية: إنشاء وقراءة وحذف');
  const bm1 = newId('bm');
  const bm2 = newId('bm');
  const now = new Date();
  realm.write(() => {
    realm.create('Bookmark', { id: bm1, surahNumber: 1, ayahNumber: 5, label: 'تست', createdAt: now, updatedAt: now });
    realm.create('Bookmark', { id: bm2, surahNumber: 18, ayahNumber: 1, label: null, createdAt: now, updatedAt: now });
  });
  check('عدد العلامات = 2', realm.objects('Bookmark').length === 2);
  realm.write(() => {
    const target = realm.objects('Bookmark').filtered('id = $0', bm2);
    realm.delete(target);
  });
  check('حذف علامة أبقى على 1', realm.objects('Bookmark').length === 1);
  const remaining = realm.objects('Bookmark')[0];
  check(
    'العلامة المتبقية صحيحة (سورة 1 آية 5)',
    remaining?.surahNumber === 1 && remaining?.ayahNumber === 5,
  );

  console.log('\n[4] المفضلة: إنشاء');
  const favId = newId('fav');
  realm.write(() => {
    realm.create('FavoriteAyah', { id: favId, surahNumber: 94, ayahNumber: 6, createdAt: now });
  });
  check('وُجدت آية مفضلة', realm.objects('FavoriteAyah').length === 1);

  console.log('\n[5] الملاحظة الشخصية: إنشاء بتُغ ثم تحديث');
  const noteId = newId('note');
  realm.write(() => {
    realm.create('PersonalNote', {
      id: noteId,
      surahNumber: 1,
      ayahNumber: 1,
      title: 'ملاحظة اختبار',
      body: 'نص تجريبي معزول — لن يظهر في التطبيق.',
      tags: ['اختبار', 'stage0'],
      createdAt: now,
      updatedAt: now,
    });
  });
  let note = byId(realm, 'PersonalNote', noteId);
  check('وُجدت الملاحظة', !!note);
  check('حُفظت التُغ', note?.tags.length === 2 && note?.tags.includes('stage0'));
  realm.write(() => {
    const n = byId(realm, 'PersonalNote', noteId);
    if (n) n.body = 'نص محدث داخل معاملة.';
  });
  note = byId(realm, 'PersonalNote', noteId);
  check('تحديث نص الملاحظة حُفظ', note?.body === 'نص محدث داخل معاملة.');

  console.log('\n[6] معاملة مركبة: جلسة قراءة + تقدم يومي + تقدم ذكر');
  const session = newId('sess');
  const dhikr = newId('dhr');
  realm.write(() => {
    realm.create('ReadingSession', {
      id: session,
      startedAt: now,
      endedAt: now,
      startSurahNumber: 1,
      startAyahNumber: 1,
      endSurahNumber: 1,
      endAyahNumber: 20,
      pagesRead: 2,
      ayahsRead: 20,
      durationSeconds: 300,
      source: 'manual',
      createdAt: now,
    });
    realm.create('DailyProgress', {
      id: '2026-10-12',
      date: now,
      ayahsRead: 20,
      pagesRead: 2,
      audioMinutes: 0,
      adhkarCompleted: 1,
      wordsLearned: 0,
      updatedAt: now,
    });
    realm.create('DhikrProgress', {
      id: dhikr,
      contentId: 'dhikr-test-1',
      dateKey: '2026-10-12',
      countCompleted: 3,
      targetCount: 10,
      updatedAt: now,
    });
  });
  check('حُفظت الجلسة', realm.objects('ReadingSession').length === 1);
  check('حُفظ التقدم اليومي', realm.objects('DailyProgress').length === 1);
  check('حُفظ تقدم الذكر', realm.objects('DhikrProgress').length === 1);

  console.log('\n[7] المعرفات الفريدة تمنع التكرار غير المقصود');
  let dupBlocked = false;
  try {
    realm.write(() => {
      realm.create('FavoriteAyah', { id: favId, surahNumber: 2, ayahNumber: 2, createdAt: now });
    });
  } catch {
    dupBlocked = true;
  }
  check('معرّف مكرر رُفض', dupBlocked);
  check('لم يزد عدد المفضلة بعد الرفض', realm.objects('FavoriteAyah').length === 1);

  console.log('\n[8] إغلاق ثم إعادة فتح — استعادة البيانات بعد "إغلاق التطبيق"');
  realm.close();
  const realm2: Realm = await Realm.open({
    path: TEST_DB,
    schema: userSchemas,
    schemaVersion: USER_SCHEMA_VERSION,
  });
  check(
    'استُعيدت الإعدادات (fontScale 1.25)',
    byId(realm2, 'AppSettings', APP_SETTINGS_ID)?.fontScale === 1.25,
  );
  check('استُعيدت العلامة المرجعية', realm2.objects('Bookmark').length === 1);
  check('استُعيدت المفضلة', realm2.objects('FavoriteAyah').length === 1);
  check('استُعيدت الملاحظة', !!byId(realm2, 'PersonalNote', noteId));
  check('استُعيدت الجلسة المركبة', realm2.objects('ReadingSession').length === 1);
  realm2.close();

  console.log(`\nالنتيجة: ${passed} نجح / ${failed} فشل`);
  // addon realm يُبقي العملية حية — إنهاء صريح بالكود المناسب
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('فشل غير متوقع في الاختبار:', e);
  process.exit(1);
});
