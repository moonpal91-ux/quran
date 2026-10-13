/**
 * اختبار المرحلة 3 — المكتبة الشخصية:
 * [1] الجلسات: بدء/فريد/إنهاء + الورد اليومي + لا تكرار عند إعادة الفتح (بوابة 06-3).
 * [2] الاستعادة بعد إعادة التشغيل (إغلاق/فتح Realm).
 * [3] العلامات: تسمية (updateLabel) + استقرار القائمة.
 * [4] المفضلة: ربط السجل بنص الحزمة الحقيقية (عرض الشاشة يعتمد getAyah).
 * [5] الملاحظات: إضافة مرتبطة بآية + عدم تكرار «عند إعادة فتح الشاشة».
 */
import * as fs from 'fs';
import * as path from 'path';
import { openAppRealm, closeAppRealm, getOpenAppRealm } from '../src/database/realm/realm';
import { getReadingSessionRepository } from '../src/repositories/reading-session-repository';
import { getReadingSessionTracker } from '../src/repositories/reading-session-tracker';
import { getBookmarkRepository } from '../src/repositories/bookmark-repository';
import { getFavoriteAyahRepository } from '../src/repositories/favorite-ayah-repository';
import { getPersonalNoteRepository } from '../src/repositories/personal-note-repository';
import { getAyah, getSurahInfo, normalizeArabicForSearch } from '../src/repositories/quran-content-repository';

const ROOT = path.join(__dirname, '..', '..');
const TEST_DIR = path.join(ROOT, '.test-data');
const TEST_DB = path.join(TEST_DIR, 'stage3-library.realm');

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

function main(): void {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });

  openAppRealm(TEST_DB).then(async () => {
    const repo = getReadingSessionRepository();
    const tracker = getReadingSessionTracker();

    // ---------- [1] دورة جلسة كاملة + الفريد + الورد ----------
    console.log('\n[1] دورة الجلسة: بدء ← قراءة فريدة ← إنهاء ← الورد اليومي');
    tracker.reset();
    check('لا جلسة قبل أول اختيار (R1)', !tracker.isActive);

    tracker.markRead(2, 1);
    check('بدأت الجلسة عند أول اختيار متعمد', tracker.isActive);
    tracker.markRead(2, 2);
    tracker.markRead(2, 2); // تكرار داخل الجلسة — لا يُحتسب (R2)
    tracker.markRead(3, 1);
    const endedCount = tracker.end();
    check('عدد آيات الجلسة = 3 (فريد: 2:1، 2:2، 3:1)', endedCount === 3, String(endedCount));
    check('انتهت الجلسة (لا نشطة بعد الإنهاء)', !tracker.isActive);

    const sessions = repo.listSessions();
    check('سجل جلسة واحدة', sessions.length === 1, String(sessions.length));
    const s1 = sessions[0];
    check('بيانات الجلسة: بداية 2:1 ونهاية 3:1', s1.startSurahNumber === 2 && s1.startAyahNumber === 1 && s1.endSurahNumber === 3 && s1.endAyahNumber === 1);
    check('آيات الجلسة 3', s1.ayahsRead === 3, String(s1.ayahsRead));
    check('الجلسة منتهية بمدة ≥ 0', s1.endedAt instanceof Date && s1.durationSeconds >= 0);

    const today = repo.getTodayProgress();
    check('الورد اليومي = 3 (R5)', today?.ayahsRead === 3, String(today?.ayahsRead));

    // جلسة ثانية في نفس اليوم
    tracker.markRead(1, 1);
    tracker.markRead(1, 2);
    tracker.end();
    check('الجلسة الثانية: سجل واحد جديد (إجمالي 2)', repo.listSessions().length === 2);
    check('الورد تراكمي = 5', repo.getTodayProgress()?.ayahsRead === 5, String(repo.getTodayProgress()?.ayahsRead));

    // ---------- [2] الاستعادة بعد إعادة التشغيل + لا تكرار ----------
    console.log('\n[2] إعادة التشغيل: استعادة + لا تكرار سجلات (بوابة 06-3)');
    closeAppRealm();
    tracker.reset();
    await openAppRealm(TEST_DB);
    check('استُعيدت الجلسات (2) بعد إعادة الفتح', repo.listSessions().length === 2);
    check('استُعيد الورد اليومي (5)', repo.getTodayProgress()?.ayahsRead === 5);

    // محاكاة جلسة مفتوحة من سقوط سابق: إنشاء ثم «إقلاع» يُنهيها مرة واحدة
    const crashed = repo.createSession(18, 110);
    repo.updateSessionLive(crashed.id, 18, 112, 3);
    const closedCount = repo.closeOpenSessions();
    check('أُنهيت الجلسة المفتوحة عند الإقلاع', closedCount === 1, String(closedCount));
    check('إجمالي الجلسات 3 (لا سجل مكرر)', repo.listSessions().length === 3, String(repo.listSessions().length));
    check('إعادة closeOpenSessions لا تكرر (0)', repo.closeOpenSessions() === 0);
    check('الورد بعد جلسة السقوط = 8', repo.getTodayProgress()?.ayahsRead === 8, String(repo.getTodayProgress()?.ayahsRead));

    // ---------- [3] العلامات: تسمية ----------
    console.log('\n[3] العلامات المرجعية: تسمية + استقرار');
    const bmRepo = getBookmarkRepository();
    const bm = await bmRepo.add({ surahNumber: 2, ayahNumber: 255 });
    check('أُضيفت علامة بلا تسمية', bm.label === null);
    const updated = await bmRepo.updateLabel(bm.id, 'آية الكرسي');
    check('حُفظت التسمية', updated.label === 'آية الكرسي');
    const blank = await bmRepo.updateLabel(bm.id, '   ');
    check('تسمية فارغة → null (لا نص زائد)', blank.label === null);
    const list1 = await bmRepo.list();
    const list2 = await bmRepo.list(); // «إعادة فتح الشاشة»
    check('القائمة مستقرة بين الفتحين (لا تكرار)', list1.length === list2.length && list1.length === 1);

    // ---------- [4] المفضلة: الربط بنص الحزمة ----------
    console.log('\n[4] المفضلة: السجل يرتبط بنص الحزمة الحقيقي');
    const favRepo = getFavoriteAyahRepository();
    await favRepo.add({ surahNumber: 2, ayahNumber: 255 });
    const favs = await favRepo.list();
    check('سجل مفضل واحد', favs.length === 1);
    const ayahText = getAyah(favs[0].surahNumber, favs[0].ayahNumber)?.text ?? '';
    const surahName = getSurahInfo(favs[0].surahNumber)?.nameArabic ?? '';
    // مقارنة عبر التطبيع (لا نكتب محارف عربية في الاختبار — 05-1)
    const normText = normalizeArabicForSearch(ayahText);
    check('النص مسترجع من الحزمة (2:255)', ayahText.length > 20 && normText.includes('الله لا اله الا هو'), normText.slice(0, 30));
    check('اسم السورة مسترجع (البقرة)', surahName === 'البقرة', surahName);

    // ---------- [5] الملاحظات: ارتباط + استقرار ----------
    console.log('\n[5] الملاحظات: ارتباط بآية + لا تكرار');
    const noteRepo = getPersonalNoteRepository();
    await noteRepo.add({ surahNumber: 2, ayahNumber: 255, title: 'تأمل', body: 'التفتير في صفات الله' });
    await noteRepo.add({ surahNumber: 36, title: 'سورة', body: 'عنوان السورة' });
    const n1 = await noteRepo.list();
    const n2 = await noteRepo.list(); // إعادة «فتح الشاشة»
    check('الملاحظات مستقرة بين الفتحين', n1.length === n2.length && n1.length === 2);
    const linked = n1.find((n) => n.ayahNumber === 255);
    check('الملاحظة المرتبطة بآية صالحة في الحزمة', !!linked && !!getAyah(linked.surahNumber, linked.ayahNumber!));

    console.log(`\nالنتيجة: ${passed} نجح / ${failed} فشل`);
    closeAppRealm();
    process.exit(failed > 0 ? 1 : 0);
  });
}

main();
