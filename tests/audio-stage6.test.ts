/**
 * اختبار المرحلة 6 — الاستماع:
 * [1] بوابة الاعتماد على فهرس التلاوات (المادة الخام + بصمتها + المنشئ الحتمي).
 * [2] بناء الروابط: مطابقة حرفية لأمثلة وثيقة CDN + رفض خارج المجال.
 * [3] سجلات التنزيل (Realm حقيقي): pending → downloading → downloaded + حذف + إحصاءات.
 * [4] تقدّم الاستماع: لا سجل = البداية + حفظ/استئناف + عزل القارئ + اكتمال السورة.
 * [5] الترحيل 2 → 3: سجل إعدادات قديم يحصل على حقول الصوت الافتراضية + كائن AudioProgress.
 *
 * ملاحظة: لا تشغيل صوتي فعلي في الاختبارات (لا وحدات أصلية) — المُختبَر هنا
 * هو البيانات والمنطق، وهو ما يمكن التحقق منه deterministically على Node.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Realm } from 'realm';
import { openAppRealm, closeAppRealm } from '../src/database/realm/realm';
import { USER_SCHEMA_VERSION, userSchemas } from '../src/database/realm/schemas';
import { getAudioCatalogRepository, _resetAudioCatalogRepositoryForTests } from '../src/repositories/audio-catalog-repository';
import {
  getAudioDownloadRepository,
  _resetAudioDownloadRepositoryForTests,
} from '../src/repositories/audio-download-repository';
import {
  getAudioProgressRepository,
  _resetAudioProgressRepositoryForTests,
} from '../src/repositories/audio-progress-repository';
import { getGlobalAyahNumber, getSurahInfo, getQuranSurahs } from '../src/repositories/quran-content-repository';

const ROOT = path.join(__dirname, '..', '..');
const RAW = path.join(ROOT, 'content', 'refs', 'audio', 'alquran-cloud-cdn.json');
const PACK = path.join(ROOT, 'content', 'audio-catalog.json');
const TMP = path.join(ROOT, '.test-data', 'audio-stage6.realm');

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
  // ── [1] بوابة الاعتماد ─────────────────────────────────────────────────────
  console.log('== [1] بوابة الاعتماد (الفهرس) ==');
  check('المادة الخام موجودة', fs.existsSync(RAW));
  const rawText = fs.readFileSync(RAW, 'utf-8');
  const raw = JSON.parse(rawText);
  const pack = JSON.parse(fs.readFileSync(PACK, 'utf-8'));
  check('بصمة الخام داخل الحزمة مطابقة', pack.manifest.rawSha256 === sha256(RAW));
  check('الحزمة تُصرّح بعدم التحقق (بيئة محجوبة)', pack.manifest.verification.status !== 'verified');
  check('كل قارئ في الحزمة له أصل في الخام', pack.reciters.every((r: { id: string }) => raw.editions.some((e: { identifier: string }) => e.identifier === r.id)));
  check('لا اسم فارغ ولا معرّف فارغ', pack.reciters.every((r: { id: string; nameAr: string }) => !!r.id && !!r.nameAr));

  const catalog = getAudioCatalogRepository();
  const reciters = catalog.reciters();
  check('13 قارئًا في الفهرس', reciters.length === 13, `الفعلي: ${reciters.length}`);
  check('معرّفات فريدة', new Set(reciters.map((r) => r.id)).size === reciters.length);
  check('لكل قارئ نمط تلاوة موثّق', reciters.every((r) => ['مرتَّل', 'مجوَّد', 'مُعلِّم'].includes(r.styleAr)));
  check('لكل قارئ معدل بِتّ افتراضي من الوثيقة', reciters.every((r) => ['192', '128', '64'].includes(r.defaultBitrate)));

  // ── [2] بناء الروابط (مطابقة حرفية لأمثلة الوثيقة الرسمية) ─────────────────
  console.log('== [2] بناء الروابط ==');
  check(
    'رابط آية == مثال وثيقة CDN حرفيًا',
    catalog.ayahFileUrl('ar.alafasy', 262, '128') === 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/262.mp3',
    catalog.ayahFileUrl('ar.alafasy', 262, '128'),
  );
  check(
    'رابط سورة == مثال وثيقة CDN حرفيًا',
    catalog.surahFileUrl('ar.alafasy', 1, '128') === 'https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/1.mp3',
    catalog.surahFileUrl('ar.alafasy', 1, '128'),
  );
  check('المعرّف الافتراضي إن لم يُمرَّر بِتّ', catalog.ayahFileUrl('ar.sudais', 1) === 'https://cdn.islamic.network/quran/audio/192/ar.sudais/1.mp3');
  let threw = false;
  try {
    catalog.ayahFileUrl('ar.alafasy', 6237);
  } catch {
    threw = true;
  }
  check('يرفض رقم آية خارج 1..6236', threw);
  threw = false;
  try {
    catalog.surahFileUrl('ar.alafasy', 115);
  } catch {
    threw = true;
  }
  check('يرفض رقم سورة خارج 1..114', threw);
  threw = false;
  try {
    catalog.ayahFileUrl('قارئ-غير-موجود', 1);
  } catch {
    threw = true;
  }
  check('يرفض قارئًا غير موجود', threw);
  check(
    'مسار الحفظ: مجلد لكل قارئ ونمط + ترقيم ثابت العرض',
    catalog.localRelativePath('ar.alafasy', 'surah', 1) === 'audio/ar.alafasy/surah/001.mp3' &&
      catalog.localRelativePath('ar.alafasy', 'ayah', 6236) === 'audio/ar.alafasy/ayah/6236.mp3',
  );

  // الرقم العالمي للآية من حزمة المصحف (يستخدمه نمط آية-بآية)
  check('الرقم العالمي: 1:1 = 1', getGlobalAyahNumber(1, 1) === 1);
  check('الرقم العالمي: 2:1 = 8', getGlobalAyahNumber(2, 1) === 8, String(getGlobalAyahNumber(2, 1)));
  check('الرقم العالمي: 114:6 = 6236', getGlobalAyahNumber(114, 6) === 6236, String(getGlobalAyahNumber(114, 6)));
  const surahs = getQuranSurahs();
  check(
    'مجموع آيات السور = 6236 (اتساق الفهرس مع المصحف)',
    surahs.reduce((a, s) => a + s.ayahCount, 0) === 6236,
  );

  // ── [3] سجلات التنزيل (Realm) ──────────────────────────────────────────────
  console.log('== [3] سجلات التنزيل (Realm حقيقي) ==');
  fs.mkdirSync(path.dirname(TMP), { recursive: true });
  if (fs.existsSync(TMP)) fs.unlinkSync(TMP);
  if (fs.existsSync(`${TMP}.lock`)) fs.unlinkSync(`${TMP}.lock`);
  _resetAudioDownloadRepositoryForTests();
  _resetAudioProgressRepositoryForTests();
  const realm = await openAppRealm(TMP);
  check('إصدار المخطط = 3', realm.schemaVersion === USER_SCHEMA_VERSION, String(realm.schemaVersion));

  const downloads = getAudioDownloadRepository();
  check('المفتاح موحّد: قارئ|نمط|رقم', downloads.key('ar.alafasy', 'surah', 1) === 'ar.alafasy|surah|1');
  check('لا سجل = غير مُنزَّل', downloads.isDownloaded('ar.alafasy', 'surah', 1) === false);
  downloads.markDownloading('ar.alafasy', 'surah', 1, '128');
  check('بعد البدء: الحالة downloading', downloads.get('ar.alafasy', 'surah', 1)?.status === 'downloading');
  check('أثناء التنزيل: ليس مكتملًا', downloads.isDownloaded('ar.alafasy', 'surah', 1) === false);
  downloads.markDownloaded('ar.alafasy', 'surah', 1, '128', 4_200_000);
  check('بعد الاكتمال: downloaded + الحجم مسجَّل', downloads.get('ar.alafasy', 'surah', 1)?.status === 'downloaded' && downloads.get('ar.alafasy', 'surah', 1)?.bytesDownloaded === 4_200_000);
  downloads.markDownloaded('ar.alafasy', 'surah', 2, '128', 1_000_000);
  downloads.markFailed('ar.husary', 'surah', 1, '128');
  check('الفشل لا يُحتسب مكتملًا', downloads.isDownloaded('ar.husary', 'surah', 1) === false);
  check('عدّاد المكتملة لقارئ ونمط = 2', downloads.countDownloaded('ar.alafasy', 'surah') === 2);
  check('إجمالي البايتات = 5.2MB', downloads.totalDownloadedBytes() === 5_200_000);
  check('سجلات الصوت فقط تُحصى (contentType=audio)', downloads.all().every((r) => r.contentType === 'audio'));
  downloads.remove('ar.alafasy', 'surah', 1);
  check('بعد الحذف: لا سجل', downloads.get('ar.alafasy', 'surah', 1) === null);
  check('إجمالي البايتات بعد الحذف = 1MB', downloads.totalDownloadedBytes() === 1_000_000);
  downloads.markDownloaded('ar.alafasy', 'ayah', 1, '128', 12_000);
  check('عزل النمط: ayah لا يُخلط مع surah', downloads.countDownloaded('ar.alafasy', 'surah') === 1 && downloads.countDownloaded('ar.alafasy', 'ayah') === 1);

  // ── [4] تقدّم الاستماع ─────────────────────────────────────────────────────
  console.log('== [4] تقدّم الاستماع ==');
  const progress = getAudioProgressRepository();
  const initial = progress.get('ar.alafasy', 114);
  check('لا سجل = بداية السورة (آية 1، موضع 0)', initial.ayahNumber === 1 && initial.positionMs === 0 && initial.updatedAt === null);
  progress.save('ar.alafasy', 114, 3, 45_000);
  const saved = progress.get('ar.alafasy', 114);
  check('الحفظ: آية 3 وموضع 45000ms', saved.ayahNumber === 3 && saved.positionMs === 45_000);
  check('طابع زمني بعد الحفظ', saved.updatedAt instanceof Date);
  progress.save('ar.alafasy', 114, 5, 90_000);
  check('التحديث يستبدل نفس السجل (لا تكرار)', progress.all().filter((p) => p.surahNumber === 114).length === 1 && progress.get('ar.alafasy', 114).ayahNumber === 5);
  progress.save('ar.husary', 114, 2, 10_000);
  check('عزل القارئ: نفس السورة بموضع مختلف', progress.get('ar.husary', 114).ayahNumber === 2 && progress.get('ar.alafasy', 114).ayahNumber === 5);
  const last = progress.lastPlayed();
  check('آخر استماع = الأحدث تحديثًا', !!last && last.reciterId === 'ar.husary' && last.surahNumber === 114);
  progress.markCompleted('ar.alafasy', 1);
  check('اكتمال السورة مسجَّل', progress.get('ar.alafasy', 1).completed === true);
  check('الاكتمال لا يؤثر على سورة أخرى', progress.get('ar.alafasy', 114).completed === false);
  progress.remove('ar.alafasy', 114);
  check('الحذف يعيد البداية', progress.get('ar.alafasy', 114).updatedAt === null);

  // ── [5] الترحيل 2 → 3 ──────────────────────────────────────────────────────
  console.log('== [5] الترحيل 2 → 3 ==');
  closeAppRealm();
  const MIG = path.join(ROOT, '.test-data', 'audio-migrate.realm');
  if (fs.existsSync(MIG)) fs.unlinkSync(MIG);
  // مخطط v2: نفس المخطط ناقص كائن AudioProgress وحقول الصوت
  const v2Schemas = userSchemas
    .filter((s) => s.name !== 'AudioProgress')
    .map((s) => {
      if (s.name !== 'AppSettings') return s;
      const props: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(s.properties)) {
        if (!k.startsWith('audio') && k !== 'preferredReciterId') props[k] = v;
      }
      return { ...s, properties: props };
    });
  const v2 = await Realm.open({ path: MIG, schema: v2Schemas as never, schemaVersion: 2 });
  v2.write(() => {
    v2.create('AppSettings', {
      id: 'app-settings',
      theme: 'light',
      fontScale: 1.0,
      readingMode: 'continuous',
      mushafBg: 'theme',
      lastSurahNumber: 2,
      lastAyahNumber: 5,
      lastReadAt: null,
      dailyGoalUnit: 'ayahs',
      dailyGoalValue: 20,
      notificationsEnabled: false,
      morningReminderTime: null,
      eveningReminderTime: null,
      updatedAt: new Date(),
    });
  });
  check('قاعدة v2 أُنشئت بالإصدار 2', v2.schemaVersion === 2);
  v2.close();

  _resetAudioDownloadRepositoryForTests();
  _resetAudioProgressRepositoryForTests();
  _resetAudioCatalogRepositoryForTests();
  const migrated = await openAppRealm(MIG);
  check('الإصدار بعد الترحيل = 3', migrated.schemaVersion === USER_SCHEMA_VERSION);
  const settings = migrated.objects('AppSettings')[0] as unknown as Record<string, unknown>;
  check('حقل audioBitrate افتراضيًا 128', settings.audioBitrate === '128', String(settings.audioBitrate));
  check('حقل audioPlaybackRate افتراضيًا 1.0', settings.audioPlaybackRate === 1.0, String(settings.audioPlaybackRate));
  check('حقل audioRepeatMode افتراضيًا off', settings.audioRepeatMode === 'off', String(settings.audioRepeatMode));
  check('حقل audioMode افتراضيًا surah', settings.audioMode === 'surah', String(settings.audioMode));
  check('حقل preferredReciterId فارغ (اختياري)', settings.preferredReciterId === null, String(settings.preferredReciterId));
  check('بيانات المستخدم القديمة محفوظة (lastSurahNumber=2)', settings.lastSurahNumber === 2);
  check('كائن AudioProgress متاح بعد الترحيل', migrated.objects('AudioProgress').length === 0);
  migrated.write(() => {
    migrated.create('AudioProgress', {
      id: 'ar.alafasy:1',
      reciterId: 'ar.alafasy',
      surahNumber: 1,
      ayahNumber: 1,
      positionMs: 0,
      completed: false,
      updatedAt: new Date(),
    });
  });
  check('الكتابة على AudioProgress تعمل', migrated.objects('AudioProgress').length === 1);

  closeAppRealm();

  console.log('');
  console.log(`النتيجة: ${passed} نجح / ${failed} فشل`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('خطأ غير متوقع:', e);
  process.exit(1);
});
