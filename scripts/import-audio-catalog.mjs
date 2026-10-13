#!/usr/bin/env node
/**
 * بوابة استيراد فهرس التلاوات (المرحلة 6) — حتمية، بلا شبكة.
 *
 * المدخل  : content/refs/audio/alquran-cloud-cdn.json  (مادة خام مُثبَّتة — منسوخة حرفيًا من مصدرَين رسميَين)
 * المخرج  : content/audio-catalog.json  (حزمة التطبيق: أنماط الروابط + القرّاء)
 * تقرير   : content/AUDIO-CATALOG.md
 *
 * قواعد بوابة المحتوى (05) مطبَّقة هنا:
 *  - مصدر موثّق + تاريخ جلب + بصمة SHA-256 للخام.
 *  - لا نص ديني مُولَّد: الأسماء والمعرّفات منسوخة من المصدر (أو موثّق اختلافها).
 *  - حتمية: نفس الخام ⟹ نفس الحزمة بايت-ببايت عدا حقل generatedAt.
 *  - لا شبكة: لا تنزيل ولا تحميل داخل هذه البيئة (التحقّق الفعلي بسكربت منفصل على جهاز متصل).
 *
 * الاستدعاء: node scripts/import-audio-catalog.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'content', 'refs', 'audio', 'alquran-cloud-cdn.json');
const OUT = join(ROOT, 'content', 'audio-catalog.json');
const REPORT = join(ROOT, 'content', 'AUDIO-CATALOG.md');

if (!existsSync(RAW)) {
  console.error('✗ المادة الخام غائبة:', RAW);
  process.exit(1);
}

const rawText = readFileSync(RAW, 'utf8');
const raw = JSON.parse(rawText);
const rawSha256 = createHash('sha256').update(rawText).digest('hex');

const STYLE_AR = {
  Murattal: 'مرتَّل',
  Mujawwad: 'مجوَّد',
  Muallim: 'مُعلِّم',
};

const reciters = raw.editions.map((e) => {
  const id = e.identifier;
  return {
    id,
    nameAr: e.cdnName || e.apiName,
    nameEn: e.cdnNameEn || e.apiNameEn,
    styleAr: STYLE_AR[e.styleEn] ?? e.styleEn,
    styleEn: e.styleEn,
    defaultBitrate: String(e.defaultKbps),
    bitrates: raw.bitrates.slice(),
    // أنماط مُستبدَلة مسبقًا بمعرّف القارئ — التطبيق يستبدل {bitrate} و {number}
    ayahUrl: raw.patterns.ayah.replace('{edition}', id),
    surahUrl: raw.patterns.surah.replace('{edition}', id),
    sourceId: 'alquran-cloud-cdn',
    ayahVerified: false,
    surahVerified: false,
    notes: e.notes ?? null,
  };
});

const pack = {
  manifest: {
    contentType: 'audio-catalog',
    sourceName: 'AlQuran Cloud CDN (cdn.islamic.network) + api.alquran.cloud',
    sourceUrl: 'https://alquran.cloud/cdn',
    licenseNote: raw.license.text,
    licenseReviewRequired: raw.license.reviewRequiredBeforePublicRelease,
    ranges: raw.ranges,
    reciterCount: reciters.length,
    rawFile: 'content/refs/audio/alquran-cloud-cdn.json',
    rawSha256,
    verification: {
      status: 'unverified',
      method: 'scripts/verify-audio-sources.mjs (على جهاز متصل)',
      note:
        'البيئة الحالية محجوبة الشبكة فلم يُختبر أي رابط فعليًا؛ الحزمة تحمل الأنماط كما وثّقها ' +
        'المصدر، والتطبيق يتحقق عند التنزيل ويعرض الخطأ بوضوح.',
    },
    generatedAt: new Date().toISOString(),
  },
  patterns: raw.patterns,
  bitrates: raw.bitrates,
  reciters,
};

writeFileSync(OUT, JSON.stringify(pack, null, 2) + '\n', 'utf8');

// ── التقرير ──────────────────────────────────────────────────────────────────
const rows = reciters
  .map(
    (r, i) =>
      `| ${i + 1} | \`${r.id}\` | ${r.nameAr} | ${r.styleAr} | ${r.defaultBitrate} | ${
        r.notes ? '⚠️ ' + r.notes : '—'
      } |`,
  )
  .join('\n');

const report = `# فهرس التلاوات — تقرير الاستيراد (المرحلة 6)

- **المصدر:** ${pack.manifest.sourceName}
- **الوثيقة:** ${pack.manifest.sourceUrl}
- **المادة الخام:** \`content/refs/audio/alquran-cloud-cdn.json\`
- **بصمة الخام (SHA-256):** \`${rawSha256}\`
- **الحزمة الناتجة:** \`content/audio-catalog.json\`
- **عدد القرّاء:** ${reciters.length}
- **تاريخ التوليد:** ${pack.manifest.generatedAt}

## أنماط الروابط (كما وثّقها المصدر)

| النوع | النمط | المجال |
|---|---|---|
| آية بآية | \`${raw.patterns.ayah}\` | 1 … 6236 |
| سورة كاملة | \`${raw.patterns.surah}\` | 1 … 114 |

معدلات البِتّ المتاحة حسب الوثيقة: ${raw.bitrates.join(' · ')}.

## القرّاء

| # | المعرّف | القارئ | النمط | kbps افتراضي | ملاحظة |
|---|---|---|---|---|---|
${rows}

## الترخيص

${raw.license.text}

## حالة التحقق

- **غير مُتحقَّق منه بعد** داخل بيئة التطوير (الشبكة محجوبة عن هذه المضيفات).
- للتحقق على جهاز متصل: \`node scripts/verify-audio-sources.mjs\` — يفحص HEAD لعيّنة
  (الآيات 1 و262 و6236 والسور 1 و114) لكل قارئ ويحدّث هذا التقرير وحقل \`verification\`.
- داخل التطبيق: أي فشل تنزيل يُعرض للمستخدم برسالة واضحة، ولا يُخفى.

## قواعد محفوظة

- لا نص قرآني ولا اسم مُولَّد: كل الأسماء والمعرّفات منسوخة من المصدرين، والاختلافات موثّقة.
- لا تنزيل داخل بيئة التطوير؛ التنزيل على جهاز المستخدم عند الطلب (أولًا-أوفلاين).
- لا حساب ولا تتبّع: الروابط تُطلب مباشرة من الـ CDN دون مرور بخدمة وسيطة.
`;
writeFileSync(REPORT, report, 'utf8');

console.log(`✓ كُتب: content/audio-catalog.json — ${reciters.length} قارئًا`);
console.log(`✓ كُتب: content/AUDIO-CATALOG.md`);
console.log(`  بصمة الخام: ${rawSha256}`);
