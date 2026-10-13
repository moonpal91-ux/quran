/**
 * اختبار المرحلة 4 — التفسير + تأكيد الرسم العثماني + ألوان صفحة المصحف:
 * [1] إعادة التحقق من بوابة الاعتماد على الملفات الخام الملتقطة (بصمات/أعداد/نواقص).
 * [2] سلامة الحزمة: 6236 مفتاح × مصدرين + تطابق التطبيع مع الخام (عينات) + لا فراغ.
 * [3] المستودع: البحث + سلوك النواقص الموثقة + معرفات مرفوضة.
 * [4] بوابة العرض العثماني: النص المعروض == الحزمة بايت-ببايت (عينات) + حرف ٱ
 *     موجود في العرض + التطبيع للبحث فقط (النص المعروض ≠ المطبع).
 * [5] كلمات الآية (تقسيم النص المعتمد — أساس «معاني الكلمات»).
 * [6] لوحات صفحة المصحف المريحة.
 * [7] ترحيل المخطط 1→2 (إضافة mushafBg = 'theme' للسجلات القديمة).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { openAppRealm, closeAppRealm, getOpenAppRealm } from '../src/database/realm/realm';
import { getRealmCtor } from '../src/database/realm/realm-ctor';
import {
  validateTafsirBundle,
  getTafsirSources,
  getTafsir,
  getTafsirGaps,
  getAyahWords,
} from '../src/repositories/quran-qa-repository';
import {
  getAyah,
  getQuranSurahs,
  normalizeArabicForSearch,
} from '../src/repositories/quran-content-repository';
import { mushafPalettes, mushafBgLabels, type MushafBgChoice } from '../src/design-system/tokens';

const ROOT = path.join(__dirname, '..', '..');
const CONTENT = path.join(ROOT, 'content');
const REFS = path.join(CONTENT, 'refs', 'tafsir');
const BUNDLE = path.join(CONTENT, 'tafsir-data.json');
const MANIFEST = path.join(REFS, 'manifest.sha256');
const QURAN_BUNDLE = path.join(CONTENT, 'quran-data.json');

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

const stripAllWs = (s: string) =>
  [...s.replace(/\s+/g, '')].join('');

function htmlToPlain(html: string): string {
  let t = String(html ?? '');
  t = t.replace(/\r\n?/g, '\n');
  t = t.replace(/<\/p\s*>/gi, '\n');
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<[^>]+>/g, '');
  t = t
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  t = t.replace(/^\uFEFF/, '');
  return t
    .split('\n')
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0)
    .join('\n');
}

/** المخطط القديم (الإصدار 1) — لإنشاء قاعدة بيانات «قبل الترحيل» */
const OLD_APP_SETTINGS_SCHEMA = [
  {
    name: 'AppSettings',
    primaryKey: 'id',
    properties: {
      id: 'string',
      theme: 'string',
      fontScale: 'double',
      readingMode: 'string',
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
  },
];

function main(): void {
  /* ---------- [1] البوابة على الخام ---------- */
  const quran = JSON.parse(fs.readFileSync(QURAN_BUNDLE, 'utf8')) as {
    surahs: { number: number; nameArabic: string; ayahCount: number }[];
  };
  const expectedCounts = quran.surahs.map((s) => s.ayahCount);

  check('[1] قائمة البصمات موجودة', fs.existsSync(MANIFEST));
  const manifestLines = fs.readFileSync(MANIFEST, 'utf8').trim().split('\n');
  check('[1] 228 بصمة (114 × مصدرين)', manifestLines.length === 228, `${manifestLines.length}`);

  let manifestOk = true;
  for (const line of manifestLines) {
    const [hash, file] = line.split(/\s+/);
    const buf = fs.readFileSync(path.join(REFS, file));
    if (crypto.createHash('sha256').update(buf).digest('hex') !== hash) {
      manifestOk = false;
      break;
    }
  }
  check('[1] إعادة حساب بصمات الخام == القائمة', manifestOk);

  const SOURCES = [
    { id: 'ibnkathir', resource_id: 14, gapList: ['5:97', '6:56', '11:47', '20:68', '20:79', '23:37', '26:104', '26:159', '26:164', '26:174', '26:175', '26:178', '26:179', '26:180', '30:16', '33:47', '37:137', '38:70', '42:31', '43:27', '47:28', '53:15', '54:35', '74:15', '74:32', '74:46', '75:28', '77:14', '77:18', '77:23', '86:16'] },
    { id: 'baghawi', resource_id: 94, gapList: [] },
  ];

  const rawCache: Record<string, Record<string, string>> = {};
  for (const src of SOURCES) {
    let total = 0;
    let perSurahOk = true;
    let resourceIdOk = true;
    for (let n = 1; n <= 114; n++) {
      const raw = JSON.parse(fs.readFileSync(path.join(REFS, src.id, `chapter-${n}.json`), 'utf8')) as {
        tafsirs: { resource_id: number; verse_key: string; text: string }[];
      };
      const seen = new Set<number>();
      for (const row of raw.tafsirs) {
        if (row.resource_id !== src.resource_id) resourceIdOk = false;
        const [s, a] = row.verse_key.split(':').map(Number);
        if (s !== n) perSurahOk = false;
        seen.add(a);
        total++;
        rawCache[src.id] = rawCache[src.id] ?? {};
        rawCache[src.id][`${n}:${a}`] = htmlToPlain(row.text);
      }
      if (seen.size !== expectedCounts[n - 1] - (src.gapList.filter((k) => k.startsWith(`${n}:`)).length)) perSurahOk = false;
    }
    check(`[1] ${src.id}: عدد الآيات سورة بسورة == حزمة المصحف (مع النواقص الموثقة)`, perSurahOk && resourceIdOk, `${total} آية`);
  }
  check('[1] baghawi مكتمل 6236', Object.keys(rawCache['baghawi']).length === 6236);
  check('[1] ibnkathir 6236 − 31 موثقة', Object.keys(rawCache['ibnkathir']).length === 6236 - 31, `${Object.keys(rawCache['ibnkathir']).length}`);

  /* ---------- [2] سلامة الحزمة + تطابق التطبيع ---------- */
  const bundle = JSON.parse(fs.readFileSync(BUNDLE, 'utf8')) as {
    sources: { id: string }[];
    gaps: Record<string, string[]>;
    tafsir: Record<string, Record<string, string>>;
  };
  check('[2] مصدران في الحزمة', bundle.sources.length === 2 && bundle.sources.some((x) => x.id === 'ibnkathir') && bundle.sources.some((x) => x.id === 'baghawi'));
  check('[2] 6236 مفتاحًا', Object.keys(bundle.tafsir).length === 6236, `${Object.keys(bundle.tafsir).length}`);
  check('[2] نواقص الحزمة == القائمة الموثقة', JSON.stringify(bundle.gaps['ibnkathir']) === JSON.stringify(SOURCES[0].gapList) && bundle.gaps['baghawi'].length === 0);

  const SAMPLES = ['1:1', '2:255', '33:42', '67:1', '112:1', '114:6'];
  let samplesOk = true;
  let emptyOk = true;
  for (const [key, vals] of Object.entries(bundle.tafsir)) {
    for (const v of Object.values(vals)) {
      if (v.trim().length < 3) emptyOk = false;
    }
  }
  for (const key of SAMPLES) {
    for (const src of SOURCES) {
      const rawPlain = rawCache[src.id][key];
      const bundled = bundle.tafsir[key]?.[src.id];
      if (rawPlain === undefined || bundled === undefined || stripAllWs(rawPlain) !== stripAllWs(bundled)) {
        samplesOk = false;
      }
    }
  }
  check('[2] التطبيع == الخام (6 عينات × مصدرين، بعد إسقاط الوسوم)', samplesOk);
  check('[2] لا نصوص فارغة/تالفة', emptyOk);

  /* ---------- [3] المستودع ---------- */
  validateTafsirBundle();
  check('[3] الفحص البنيوي للحزمة ناجح (بدون استثناء)', true);
  const srcs = getTafsirSources();
  check('[3] مصادر = 2 (ibnkathir/baghawi)', srcs.length === 2 && srcs.some((x) => x.id === 'ibnkathir') && srcs.some((x) => x.id === 'baghawi'));
  const ik11 = getTafsir(1, 1, 'ibnkathir');
  check('[3] getTafsir(1,1,ibnkathir) غير فارغ وطويل', ik11 !== null && ik11.length > 1000, ik11 ? `طول=${ik11.length}` : 'null');
  check('[3] getTafsir(1,1,baghawi) غير فارغ', getTafsir(1, 1, 'baghawi') !== null);
  check('[3] نقص موثق (5:97 ibnkathir) → null', getTafsir(5, 97, 'ibnkathir') === null);
  check('[3] نفس الآية في البغوي موجودة', getTafsir(5, 97, 'baghawi') !== null);
  check('[3] معرف مصدر مرفوض → null', getTafsir(1, 1, 'bogus') === null);
  check('[3] خارج النطاق (200:1) → null', getTafsir(200, 1, 'ibnkathir') === null);
  check('[3] getTafsirGaps(ibnkathir) = 31', getTafsirGaps('ibnkathir').length === 31);

  /* ---------- [4] بوابة العرض العثماني ---------- */
  const UTHMANI_AYAH_SET: [number, number][] = [
    [1, 1], [1, 2], [1, 5], [2, 255], [36, 1], [52, 1], [66, 1], [114, 5],
  ];
  let displayOk = true;
  for (const [s, a] of UTHMANI_AYAH_SET) {
    const info = getAyah(s, a);
    const raw = (JSON.parse(fs.readFileSync(QURAN_BUNDLE, 'utf8')) as { ayahs: { surah: number; ayah: number; text: string }[] }).ayahs.find(
      (x) => x.surah === s && x.ayah === a,
    );
    if (!info || !raw || info.text !== raw.text) displayOk = false;
  }
  check('[4] النص المعروض == حزمة Tanzil بايت-ببايت (8 عينات تشمل ٱ)', displayOk);
  const f11 = getAyah(1, 1);
  const f12 = getAyah(1, 2);
  check('[4] حرف الهمزة الواصلة ٱ (U+0671) في عرض 1:1 و 1:2', !!f11 && f11.text.includes('\u0671') && !!f12 && f12.text.includes('\u0671'));
  check('[4] التطبيع للبحث فقط: النص المعروض ≠ المطبع', !!f11 && normalizeArabicForSearch(f11.text) !== f11.text);

  /* ---------- [5] كلمات الآية ---------- */
  const words11 = getAyahWords(1, 1);
  check('[5] كلمات 1:1 غير فارغة', words11.length > 0, `${words11.length} كلمة`);
  if (f11) {
    const rejoined = words11.join(' ');
    const textNorm = f11.text.replace(/\s+/g, ' ').trim();
    check('[5] إعادة تجميع الكلمات == نص الآية المعتمد (بدون تغيير)', rejoined === textNorm);
  } else {
    check('[5] إعادة تجميع الكلمات == نص الآية المعتمد (بدون تغيير)', false, 'لا آية 1:1');
  }
  check('[5] سورة غير موجودة → []', getAyahWords(999, 1).length === 0);

  /* ---------- [6] لوحات صفحة المصحف ---------- */
  const hexOk = (c: string) => /^#[0-9a-fA-F]{6}$/.test(c);
  check(
    '[6] لوحات (رَقّ/ليل/غابة) بألوان hex صحيحة',
    Object.values(mushafPalettes).every((p) => hexOk(p.page) && hexOk(p.quran) && hexOk(p.ayahMeta) && hexOk(p.border)),
  );
  check(
    '[6] تسميات لكل الخيارات الأربعة',
    (Object.keys(mushafBgLabels) as MushafBgChoice[]).length === 4,
  );
  check(
    '[6] خلفية ليلية/غاباوية داكنة فعلًا (راحة العين)',
    (['night', 'forest'] as const).every((k) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(mushafPalettes[k].page.slice(i, i + 2), 16));
      return (r + g + b) / 3 < 80;
    }),
  );

  /* ---------- [7] ترحيل المخطط 1→2 ---------- */
  const TEST_DIR = path.join(ROOT, '.test-data');
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
  const MIG_DB = path.join(TEST_DIR, 'stage4-migration.realm');
  const RealmCtor = getRealmCtor();
  if (fs.existsSync(MIG_DB)) fs.unlinkSync(MIG_DB);
  Promise.resolve().then(async () => {
    // قاعدة قديمة بالإصدار 1
    const oldRealm = await RealmCtor.open({ path: MIG_DB, schema: OLD_APP_SETTINGS_SCHEMA, schemaVersion: 1 });
    oldRealm.write(() => {
      oldRealm.create('AppSettings', {
        id: 'app-settings',
        theme: 'dark',
        fontScale: 1.1,
        readingMode: 'continuous',
        lastSurahNumber: 2,
        lastAyahNumber: 1,
        lastReadAt: null,
        dailyGoalUnit: 'ayahs',
        dailyGoalValue: 20,
        notificationsEnabled: false,
        morningReminderTime: null,
        eveningReminderTime: null,
        updatedAt: new Date(),
      });
    });
    oldRealm.close();

    // الفتح بالإصدار الجديد → يُنفَّذ الترحيل
    await openAppRealm(MIG_DB);
    const rec = getOpenAppRealm().objects('AppSettings').filtered('id = $0', 'app-settings')[0] as unknown as {
      mushafBg?: string;
      theme: string;
      lastSurahNumber: number;
    };
    check('[7] الترحيل 1→2 أضاف mushafBg = theme', rec?.mushafBg === 'theme', `الموجود: ${JSON.stringify(rec?.mushafBg)}`);
    check('[7] بقيت البيانات القديمة سليمة (theme/الموضع)', rec?.theme === 'dark' && rec?.lastSurahNumber === 2);
    closeAppRealm();

    /* ---------- [8] خيط تحويل الأرقام الهندية في «الانتقال إلى آية» ---------- */
  const screenSrc = fs.readFileSync(path.join(ROOT, 'src', 'features', 'quran', 'surah-screen.tsx'), 'utf8');
  const dm = screenSrc.match(/String\('([٠-٩]+)\'\.indexOf\(d\)\)/);
  check('[8] خيط الأرقام الهندية مكتمل (٠–٩)', dm !== null && dm[1] === '٠١٢٣٤٥٦٧٨٩', dm ? dm[1] : 'لم يُعثر عليه');

  /* ---------- النتيجة ---------- */
    console.log(`\nالنتيجة: ${passed} نجح / ${failed} فشل`);
    if (failed > 0) process.exit(1);
    process.exit(0);
  }).catch((e: unknown) => {
    console.error('فشل فتح قاعدة الترحيل', e);
    process.exit(1);
  });
}

main();
