/**
 * اختبار المرحلة 5 — الأذكار:
 * [1] إعادة التحقق من بوابة الاعتماد على الملفات الخام (بصمات/أعداد).
 * [2] سلامة الحزمة: 345 عنصرًا / 135 فئة + معرفات فريدة + بلا نصوص تالفة.
 * [3] المستودع: الفئات بالعدود + الجلب بالمعرف.
 * [4] قاعدة العرض: النص القرآني == Tanzil المعتمد بايت-ببايت + غير القرآني == المصدر.
 * [5] تقدم الأذكار (Realm حقيقي): زيادة/سقف/تصفير/ملخص فئة/استعادة بعد إعادة الفتح.
 * [6] عزل اليوم: سجل بتاريخ سابق لا يؤثر على «اليوم».
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { openAppRealm, closeAppRealm } from '../src/database/realm/realm';
import {
  validateAdhkarBundle,
  getAdhkarCategories,
  getAdhkarItemsByCategory,
  getAdhkarItem,
  getAdhkarDisplayText,
} from '../src/repositories/adhkar-content-repository';
import { getAdhkarProgressRepository, _resetAdhkarProgressRepositoryForTests } from '../src/repositories/adhkar-progress-repository';
import { getAyah, getAyahsOfSurah } from '../src/repositories/quran-content-repository';

const ROOT = path.join(__dirname, '..', '..');
const REFS = path.join(ROOT, 'content', 'refs', 'adhkar');
const RAW = path.join(REFS, 'azkar_obj.json');
const RAW_MIT = path.join(REFS, 'morning_seen_ar.json');
const MANIFEST = path.join(REFS, 'manifest.json');

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

const sha256 = (p: string) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));
  const src = manifest.sources.find((s: { dataset: string }) => s.dataset === 'osamayy/azkar-db');
  const mit = manifest.sources.find((s: { dataset: string }) => s.dataset.includes('Seen-Arabic'));

  console.log('== [1] بوابة الاعتماد (الملفات الخام) ==');
  check('بصمة المصدر الرئيسي == الـ manifest', !!(src && sha256(RAW) === src.sha256));
  check('بصمة مصدر التحقق (MIT) == الـ manifest', !!(mit && sha256(RAW_MIT) === mit.sha256));
  const raw = JSON.parse(fs.readFileSync(RAW, 'utf-8'));
  check('الخام = 345 عنصرًا', Array.isArray(raw) && raw.length === 345);

  console.log('== [2] سلامة الحزمة ==');
  validateAdhkarBundle();
  check('الاستدعاء الأول (فحص بنيوي) نجح', true);
  const cats = getAdhkarCategories();
  check('135 فئة وعدود مطابقة للمجموع', cats.length === 135 && cats.reduce((a, c) => a + c.itemCount, 0) === 345);
  const morning = cats.find(c => c.name === 'أذكار الصباح');
  const evening = cats.find(c => c.name === 'أذكار المساء');
  check('الصباح 31 والمساء 30 (حصن المسلم)', morning?.itemCount === 31 && evening?.itemCount === 30);

  console.log('== [3] المستودع ==');
  const first = morning ? getAdhkarItemsByCategory(morning.id)[0] : undefined;
  check('جلب عناصر الصباح (31)', !!(morning && getAdhkarItemsByCategory(morning.id).length === 31));
  check('جلب بالمعرف == نفس العنصر', !!(first && getAdhkarItem(first.id)?.zekr === first.zekr));

  console.log('== [4] قاعدة العرض ==');
  // عنصر قرآني كامل (الإخلاص)
  const ikhlas = getAdhkarItemsByCategory(morning!.id).find(i => i.quranRef === '112:*')
    || getAdhkarItemsByCategory(morning!.id).find(i => (i.reference || '').includes('الإخلاص'));
  check('وُجد عنصر الإخلاص بمرجع قرآني', !!ikhlas && !!ikhlas.quranRef, JSON.stringify(ikhlas?.quranRef));
  if (ikhlas) {
    const tanzil = getAyahsOfSurah(112).map(a => a.text).join('');
    check('نص الإخلاص المعروض == Tanzil بايت-ببايت', getAdhkarDisplayText(ikhlas) === tanzil);
  }
  // آية مفردة (الكرسي)
  const kursi = getAdhkarItemsByCategory(morning!.id).find(i => i.quranRef === '2:255');
  if (kursi) {
    const t = getAyah(2, 255)?.text ?? '';
    check('نص الكرسي المعروض == Tanzil (2:255) بايت-ببايت', getAdhkarDisplayText(kursi) === t);
  } else {
    check('وُجد عنصر الكرسي بمرجع 2:255', false);
  }
  // غير قرآني == المصدر
  const plain = getAdhkarItemsByCategory(morning!.id).find(i => !i.quranRef);
  check('غير القرآني == نص المصدر (بلا تعديل)', !!plain && getAdhkarDisplayText(plain) === plain.zekr);

  console.log('== [5] تقدم الأذكار (Realm حقيقي) ==');
  const TEST_DIR = path.join(ROOT, '.test-data');
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
  const TEST_DB = path.join(TEST_DIR, 'stage5-adhkar.realm');
  await openAppRealm(TEST_DB);
  _resetAdhkarProgressRepositoryForTests();
  const repo = getAdhkarProgressRepository();
  const target = 3;
  const idA = '5-1';
  check('بدون سجل = صفر', repo.getToday(idA).countCompleted === 0);
  const r1 = repo.recordDhikr(idA, target);
  const r2 = repo.recordDhikr(idA, target);
  const r3 = repo.recordDhikr(idA, target);
  const r4 = repo.recordDhikr(idA, target); // فوق السقف
  check('زيادة 0→1→2→3 ثم سقف (لا 4)', r1.countCompleted === 1 && r2.countCompleted === 2 && r3.countCompleted === 3 && r4.countCompleted === 3 && r4.completed);
  const items = [
    { id: idA, count: target },
    { id: '5-2', count: 1 },
    { id: '5-3', count: 7 },
  ];
  repo.recordDhikr('5-2', 1);
  check('ملخص الفئة: 2/3 مكتمل (3-1 و 5-2)', repo.getCategoryToday(items).done === 2 && repo.getCategoryToday(items).total === 3);
  repo.resetToday(idA);
  check('تصفير = صفر', repo.getToday(idA).countCompleted === 0);

  // استعادة بعد إعادة الفتح
  closeAppRealm();
  await openAppRealm(TEST_DB);
  _resetAdhkarProgressRepositoryForTests();
  const repo2 = getAdhkarProgressRepository();
  check('استعادة بعد إعادة الفتح: 5-2 = 1/1 مكتمل', repo2.getToday('5-2').countCompleted === 1 && repo2.getToday('5-2').completed);

  console.log('== [6] عزل اليوم ==');
  const pastKey = '2020-01-01';
  repo2.recordDhikr('5-3', 7, pastKey);
  check('سجل بتاريخ سابق لا يظهر في «اليوم»', repo2.getToday('5-3').countCompleted === 0 && repo2.getToday('5-3', pastKey).countCompleted === 1);
  closeAppRealm();

  console.log(`\nالنتيجة: ${passed} نجح / ${failed} فشل`);
  // Realm الأصلية تحافظ على حلقة الأحداث — إغلاق صريح بعد اكتمال الفحوص
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('فشل تشغيل الاختبار:', e);
  process.exit(1);
});
