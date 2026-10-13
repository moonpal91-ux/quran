/**
 * اختبار المرحلة 1 — طبقة المستودعات على قاعدة بيانات Realm حقيقية.
 * يغطي: الإعدادات (إنشاء افتراضي/تحديث/استعادة) + العلامات + المفضلة + الملاحظات
 * (إضافة، رفض المكرر، تحقق الحدود، حذف).
 * بيانات الاختبار معزولة في .test-data/ ولا تدخل قاعدة التطبيق.
 */
import * as fs from 'fs';
import * as path from 'path';
import { openAppRealm, closeAppRealm } from '../src/database/realm/realm';
import { getSettingsRepository } from '../src/repositories/settings-repository';
import { getBookmarkRepository } from '../src/repositories/bookmark-repository';
import { getFavoriteAyahRepository } from '../src/repositories/favorite-ayah-repository';
import { getPersonalNoteRepository } from '../src/repositories/personal-note-repository';

const TEST_DIR = path.join(__dirname, '..', '.test-data');
const TEST_DB = path.join(TEST_DIR, 'stage1-repos.realm');

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

async function expectReject(promise: Promise<unknown>, name: string): Promise<void> {
  let rejected = false;
  try {
    await promise;
  } catch {
    rejected = true;
  }
  check(name, rejected);
}

async function main(): Promise<void> {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });

  await openAppRealm(TEST_DB);

  console.log('\n[1] الإعدادات: إنشاء افتراضي ثم تحديث ثم استعادة');
  const settingsRepo = getSettingsRepository();
  const s1 = await settingsRepo.getSettings();
  check('أُنشئ سجل الإعدادات', s1.id === 'app-settings');
  check('الافتراضي: theme=light', s1.theme === 'light');
  check('الافتراضي: fontScale=1', s1.fontScale === 1);
  check('الافتراضي: الورد 20 آية', s1.dailyGoalValue === 20 && s1.dailyGoalUnit === 'ayahs');

  const s2 = await settingsRepo.updateSettings({ theme: 'dark', fontScale: 1.2 });
  check('تحديث المظهر إلى dark', s2.theme === 'dark');
  check('تحديث حجم الخط إلى 1.2', s2.fontScale === 1.2);

  const s3 = await settingsRepo.updateSettings({ lastSurahNumber: 18, lastAyahNumber: 110, lastReadAt: new Date() });
  check('حفظ آخر موضع قراءة (18:110)', s3.lastSurahNumber === 18 && s3.lastAyahNumber === 110);

  // استعادة بعد إغلاق وفتح (محاكاة إعادة تشغيل التطبيق)
  closeAppRealm();
  await openAppRealm(TEST_DB);
  const s4 = await settingsRepo.getSettings();
  check('استُعيد المظهر dark بعد الإغلاق', s4.theme === 'dark');
  check('استُعيد آخر موضع بعد الإغلاق', s4.lastSurahNumber === 18 && s4.lastAyahNumber === 110);

  console.log('\n[2] العلامات المرجعية');
  const bookmarkRepo = getBookmarkRepository();
  const bm = await bookmarkRepo.add({ surahNumber: 2, ayahNumber: 255, label: 'آية الكرسي' });
  check('أُضيفت علامة', bm.surahNumber === 2 && bm.ayahNumber === 255 && bm.label === 'آية الكرسي');
  await expectReject(bookmarkRepo.add({ surahNumber: 2, ayahNumber: 255 }), 'رُفض موضع مكرر');
  await expectReject(bookmarkRepo.add({ surahNumber: 115, ayahNumber: 1 }), 'رُفض رقم سورة خارج النطاق');
  await expectReject(bookmarkRepo.add({ surahNumber: 1, ayahNumber: 287 }), 'رُفض رقم آية خارج النطاق');
  const bms = await bookmarkRepo.list();
  check('القائمة تحتوي علامة واحدة', bms.length === 1);
  await bookmarkRepo.remove(bm.id);
  check('حُذفت العلامة', (await bookmarkRepo.list()).length === 0);

  console.log('\n[3] المفضلة');
  const favRepo = getFavoriteAyahRepository();
  await favRepo.add({ surahNumber: 94, ayahNumber: 6 });
  check('أُضيفت آية مفضلة (94:6)', (await favRepo.list()).length === 1);
  await expectReject(favRepo.add({ surahNumber: 94, ayahNumber: 6 }), 'رُفضت آية مكررة');
  await expectReject(favRepo.add({ surahNumber: 0, ayahNumber: 1 }), 'رُفضت سورة صفر');

  console.log('\n[4] الملاحظات');
  const noteRepo = getPersonalNoteRepository();
  const note = await noteRepo.add({
    surahNumber: 18,
    ayahNumber: 110,
    title: 'دعاء الخروج',
    body: 'ملاحظة اختبار معزولة.',
    tags: ['اختبار'],
  });
  check('أُنشئت الملاحظة', note.title === 'دعاء الخروج' && note.tags.length === 1);
  await expectReject(noteRepo.add({ surahNumber: 1, body: '   ' }), 'رُفضت ملاحظة فارغة');
  await expectReject(noteRepo.add({ surahNumber: 5, ayahNumber: -1, body: 'نص' }), 'رُفضت آية سالبة');
  const updated = await noteRepo.update(note.id, { body: 'نص محدث.' });
  check('حُدّثت الملاحظة', updated.body === 'نص محدث.');
  await expectReject(noteRepo.update('nonexistent', { body: 'x' }), 'رُفض تحديث ملاحظة غير موجودة');
  check('القائمة تحتوي ملاحظة واحدة', (await noteRepo.list()).length === 1);

  closeAppRealm();
  console.log(`\nالنتيجة: ${passed} نجح / ${failed} فشل`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('فشل غير متوقع:', e);
  process.exit(1);
});
