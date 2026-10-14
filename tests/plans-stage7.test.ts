/**
 * اختبار المرحلة 7 — الخطط (ختمة / ورد / مواظبة):
 * [1] إنشاء الخطة: قوالب + رفض القيم الفاسدة + **رفض أي إنجاز يدوي**.
 * [2] حساب الحصة اليومية (توزيع الهدف على الأيام) + المدة الافتراضية.
 * [3] التقدّم من السجلات الفعلية فقط (DailyProgress / DhikrProgress) + عزل المجال الزمني.
 * [4] عزل الوحدات: آيات / أجزاء / أذكار / أيام مواظبة — ولا خطة على الصفحات.
 * [5] دورة الحياة: إيقاف مؤقت + استئناف + أرشفة + حذف + لا بيانات وهمية عند الفراغ.
 *
 * القاعدة الحاكمة: التقدّم مقيس، لا مُدخل. لذلك كل اختبار هنا يكتب سجلات فعلية
 * (جلسة قراءة / ذكر) ثم يتحقق أن الخطة تعكسها — ولا يختبر أي zر «تحديد يدوي».
 */
import * as fs from 'fs';
import * as path from 'path';
import { openAppRealm, closeAppRealm, getOpenAppRealm } from '../src/database/realm/realm';
import { USER_SCHEMA_VERSION } from '../src/database/realm/schemas';
import {
  AYAHS_PER_JUZ,
  TOTAL_AYAHS,
  TOTAL_JUZ,
  getPlanRepository,
} from '../src/repositories/plan-repository';
import type { ReadingPlan } from '../src/database/realm/types';

const ROOT = path.join(__dirname, '..', '..');
const TMP = path.join(ROOT, '.test-data', 'plans-stage7.realm');

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

const DAY = 24 * 60 * 60 * 1000;
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function startOfDay(d: Date): Date {
  const c = new Date(d.getTime());
  c.setHours(0, 0, 0, 0);
  return c;
}
/** يكتب سجل تقدّم يومي فعلي (كما يفعل متتبّع الجلسات عند إنهاء جلسة حقيقية) */
function addDailyProgress(realm: RealmLike, date: Date, ayahs: number): void {
  realm.write(() => {
    realm.create('DailyProgress', {
      id: dayKey(date),
      date: startOfDay(date),
      ayahsRead: ayahs,
      pagesRead: 0,
      audioMinutes: 0,
      adhkarCompleted: 0,
      wordsLearned: 0,
      updatedAt: new Date(),
    });
  });
}
/** يكتب عدّاد ذكر فعلي (كما يفعل مستودع الأذكار) */
function addDhikr(realm: RealmLike, date: Date, contentId: string, count: number): void {
  realm.write(() => {
    realm.create('DhikrProgress', {
      id: `${contentId}|${dayKey(date)}`,
      contentId,
      dateKey: dayKey(date),
      countCompleted: count,
      targetCount: 1,
      updatedAt: new Date(),
    });
  });
}
interface RealmLike {
  write(cb: () => void): void;
  create(name: string, value: Record<string, unknown>): unknown;
  objects(name: string): unknown[];
}
/** نفس مقبض قاعدة البيانات الذي تستخدمه المستودعات (نكتب به السجلات الفعلية) */
const r = (): RealmLike => getOpenAppRealm() as unknown as RealmLike;

async function main() {
  // ── [1] الإنشاء ─────────────────────────────────────────────────────────────
  console.log('== [1] إنشاء الخطة ==');
  closeAppRealm();
  if (fs.existsSync(TMP)) fs.unlinkSync(TMP);
  if (fs.existsSync(`${TMP}.lock`)) fs.unlinkSync(`${TMP}.lock`);
  if (fs.existsSync(`${TMP}.management`)) fs.rmSync(`${TMP}.management`, { recursive: true, force: true });
  const realm = await openAppRealm(TMP);
  check('إصدار المخطط = 3 (الخطط لا تحتاج ترحيلًا)', realm.schemaVersion === USER_SCHEMA_VERSION, String(realm.schemaVersion));

  const repo = getPlanRepository();
  check('لا خطط عند البداية', repo.listPlans().length === 0);

  const khatma = repo.createPlan({
    title: 'ختمة في شهر',
    planType: 'khatmah',
    goalUnit: 'ayahs',
    goalValue: TOTAL_AYAHS,
    durationDays: 30,
  });
  check('خطة الختمة أُنشئت بحالة نشطة', khatma.status === 'active');
  check('هدف الختمة = 6236 آية', khatma.goalValue === TOTAL_AYAHS);
  check(
    'لا حقل إنجاز مخزّن مع الخطة (لا تحديد يدوي)',
    Object.keys(khatma).every((k) => !/done|progress|completed/i.test(k)),
    Object.keys(khatma).join(','),
  );

  let threw = false;
  try {
    repo.createPlan({ title: 'فاسدة', planType: 'custom', goalUnit: 'ayahs', goalValue: 0, durationDays: 10 });
  } catch {
    threw = true;
  }
  check('يرفض هدفًا بقيمة صفر', threw);

  threw = false;
  try {
    repo.createPlan({ title: '  ', planType: 'custom', goalUnit: 'ayahs', goalValue: 10, durationDays: 10 });
  } catch {
    threw = true;
  }
  check('يرفض عنوانًا فارغًا', threw);

  threw = false;
  try {
    repo.createPlan({
      title: 'خطة على الصفحات',
      planType: 'custom',
      goalUnit: 'pages',
      goalValue: 604,
      durationDays: 30,
    });
  } catch {
    threw = true;
  }
  check('يرفض وحدة «صفحات» (لا مصدر بيانات لها)', threw);

  threw = false;
  try {
    repo.createPlan({
      title: 'إنجاز يدوي',
      planType: 'custom',
      goalUnit: 'ayahs',
      goalValue: 100,
      durationDays: 10,
      // @ts-expect-error — حقل مرفوض قصدًا: لا يُحفظ إنجاز يدوي
      done: 50,
    });
  } catch {
    threw = true;
  }
  check('يرفض أي حقل إنجاز يدوي (done/progress/completed)', threw);

  threw = false;
  try {
    const start = new Date();
    repo.createPlan({
      title: 'تاريخ مقلوب',
      planType: 'custom',
      goalUnit: 'ayahs',
      goalValue: 100,
      startDate: start,
      targetEndDate: new Date(start.getTime() - 5 * DAY),
    });
  } catch {
    threw = true;
  }
  check('يرفض تاريخ انتهاء قبل البداية', threw);

  // ── [2] الحصة اليومية ───────────────────────────────────────────────────────
  console.log('== [2] الحصة اليومية ==');
  check('6236 آية ÷ 30 يومًا = 208 آية/يوم', repo.dailyTarget(khatma) === Math.ceil(TOTAL_AYAHS / 30), String(repo.dailyTarget(khatma)));
  check('30 جزءًا ÷ 30 يومًا = جزء واحد/يوم', (() => {
    const p = repo.createPlan({ title: 'أجزاء', planType: 'khatmah', goalUnit: 'juz', goalValue: TOTAL_JUZ, durationDays: 30 });
    const t = repo.dailyTarget(p);
    repo.deletePlan(p.id);
    return t === 1;
  })());
  check('المدة الافتراضية 30 يومًا إن لم تُحدَّد', (() => {
    const p = repo.createPlan({ title: 'بلا مدة', planType: 'custom', goalUnit: 'ayahs', goalValue: 300 });
    const d = repo.totalDays(p);
    repo.deletePlan(p.id);
    return d === 30;
  })());
  check('متوسط آيات الجزء = 6236 ÷ 30', Math.abs(AYAHS_PER_JUZ - TOTAL_AYAHS / TOTAL_JUZ) < 1e-9);

  // ── [3] التقدّم من السجلات الفعلية + عزل المجال ─────────────────────────────
  console.log('== [3] التقدّم من السجلات الفعلية ==');
  const today = new Date();
  const start = new Date(today.getTime() - 4 * DAY); // بدأت قبل 5 أيام (اليوم الخامس)
  const plan = repo.createPlan({
    title: 'ورد 5 أيام',
    planType: 'custom',
    goalUnit: 'ayahs',
    goalValue: 500,
    startDate: start,
    durationDays: 10,
  });
  check('المدة = 10 أيام', repo.totalDays(plan) === 10);
  check('الحصة اليومية = 50 آية', repo.dailyTarget(plan) === 50);

  let pr = repo.progress(plan);
  check('بلا قراءة: المنجَز صفر (لا بيانات وهمية)', pr.done === 0, String(pr.done));
  check('بلا قراءة: خارج المسار', pr.onTrack === false);
  check('المتوقع حتى اليوم = 250 (50 × 5 أيام)', pr.expectedByToday === 250, String(pr.expectedByToday));

  // سجلات فعلية: 3 أيام داخل المجال + يوم قبل البداية (يجب ألا يُحتسب)
  addDailyProgress(r(), today, 60); // اليوم
  addDailyProgress(r(), new Date(today.getTime() - DAY), 40);
  addDailyProgress(r(), new Date(today.getTime() - 2 * DAY), 50);
  addDailyProgress(r(), new Date(today.getTime() - 30 * DAY), 9999); // خارج المجال

  pr = repo.progress(plan);
  check('المنجَز = 150 آية فعلية', pr.done === 150, String(pr.done));
  check('سجل خارج مجال الخطة لا يُحتسب (لا 9999)', pr.done < 9999);
  check('النسبة = 30%', pr.percent === 30, String(pr.percent));
  check('الباقي = 350', pr.remaining === 350, String(pr.remaining));
  check('إنجاز اليوم = 60', pr.todayDone === 60, String(pr.todayDone));
  check('متأخر عن المتوقع (150 < 250)', pr.onTrack === false);
  check('المعدل المطلوب = 70 آية/يوم لإنهاء 350 في 5 أيام', pr.pacePerDay === 70, String(pr.pacePerDay));
  check('الأيام المتبقية = 5', pr.daysLeft === 5, String(pr.daysLeft));
  check('تاريخ إنهاء متوقع محسوب', pr.projectedEndDate instanceof Date);

  // إكمال الهدف → على المسار + مكتملة
  addDailyProgress(r(), new Date(today.getTime() - 3 * DAY), 350);
  pr = repo.progress(plan);
  check('بعد استكمال 500: المنجَز = 500', pr.done === 500, String(pr.done));
  check('الخطة مكتملة', pr.finished === true);
  check('على المسار بعد الاستكمال', pr.onTrack === true);
  check('النسبة لا تتجاوز 100%', pr.percent <= 100, String(pr.percent));

  // ── [4] عزل الوحدات ────────────────────────────────────────────────────────
  console.log('== [4] عزل الوحدات ==');
  const juzPlan = repo.createPlan({
    title: 'ختمة بالأجزاء',
    planType: 'khatmah',
    goalUnit: 'juz',
    goalValue: TOTAL_JUZ,
    startDate: start,
    durationDays: 30,
  });
  const jp = repo.progress(juzPlan);
  check('الأجزاء = الآيات ÷ المتوسط (500 آية ≈ 2.4 جزء)', Math.abs(jp.done - 500 / AYAHS_PER_JUZ) < 1e-6, String(jp.done));
  check('وحدة الخطة محفوظة = juz', jp.unit === 'juz');

  const adhkarPlan = repo.createPlan({
    title: 'ورد أذكار',
    planType: 'review',
    goalUnit: 'adhkar',
    goalValue: 100,
    startDate: start,
    durationDays: 10,
  });
  check('بلا أذكار: صفر', repo.progress(adhkarPlan).done === 0);
  addDhikr(r(), today, 'dhikr-1', 3);
  addDhikr(r(), new Date(today.getTime() - DAY), 'dhikr-2', 2);
  check('الأذكار تُحتسب من عدّاداتها الفعلية (5)', repo.progress(adhkarPlan).done === 5, String(repo.progress(adhkarPlan).done));
  check('خطة الآيات لا تتأثر بعدّاد الأذكار', repo.progress(plan).done === 500);

  const daysPlan = repo.createPlan({
    title: 'مواظبة 30 يومًا',
    planType: 'review',
    goalUnit: 'days',
    goalValue: 30,
    startDate: start,
    durationDays: 30,
  });
  const dp = repo.progress(daysPlan);
  check('أيام المواظبة = عدد الأيام بنشاط فعلي (4)', dp.done === 4, String(dp.done));
  check('وحدة المواظبة = days', dp.unit === 'days');

  // ── [5] دورة الحياة ────────────────────────────────────────────────────────
  console.log('== [5] دورة الحياة ==');
  check('الخطط النشطة = 5', repo.activePlans().length === 5, String(repo.activePlans().length));
  repo.setStatus(plan.id, 'paused');
  check('إيقاف مؤقت يعمل', repo.getPlan(plan.id)?.status === 'paused');
  check('الموقوفة لا تُعدّ نشطة', repo.activePlans().length === 4);
  repo.setStatus(plan.id, 'active');
  check('الاستئناف يعمل', repo.getPlan(plan.id)?.status === 'active');
  repo.setStatus(plan.id, 'archived');
  check('الأرشفة تعمل', repo.getPlan(plan.id)?.status === 'archived');
  check('كل الخطط تشمل المؤرشفة', repo.listPlans().length === 5);
  check('الفلترة بالحالة (archived) = 1', repo.listPlans('archived').length === 1);

  const renamed = repo.updatePlan(adhkarPlan.id, { title: 'ورد أذكار الصباح' });
  check('تعديل العنوان يعمل', renamed?.title === 'ورد أذكار الصباح');
  const changed = repo.updatePlan(adhkarPlan.id, { goalValue: 200 });
  check('تعديل الهدف يعمل', changed?.goalValue === 200);
  check('تعديل خطة غير موجودة = null', repo.updatePlan('لا-يوجد', { title: 'x' }) === null);

  check('حذف خطة = true', repo.deletePlan(daysPlan.id) === true);
  check('بعد الحذف: لا سجل', repo.getPlan(daysPlan.id) === null);
  check('حذف خطة محذوفة = false', repo.deletePlan(daysPlan.id) === false);
  check('العدد بعد الحذف = 4', repo.listPlans().length === 4, String(repo.listPlans().length));

  const all = repo.listPlans();
  check('كل خطة لها عنوان ومعرّف ووحدة', all.every((p: ReadingPlan) => !!p.title && !!p.id && !!p.goalUnit));
  check('التقدّم لكل خطة محسوب بلا استثناء', all.every((p: ReadingPlan) => typeof repo.progress(p).percent === 'number'));

  closeAppRealm();

  console.log('');
  console.log(`النتيجة: ${passed} نجح / ${failed} فشل`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
