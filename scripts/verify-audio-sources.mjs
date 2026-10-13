#!/usr/bin/env node
/**
 * التحقق الفعلي من روابط التلاوات (المرحلة 6) — يحتاج شبكة.
 *
 * يفحص لكل قارئ عيّنة صغيرة:
 *   • آية بآية: الآيات 1 و262 و6236 بمعدل البِتّ الافتراضي
 *   • سورة كاملة: السور 1 و114 (إن رُغب: --with-surah)
 * ثم يحدّث content/AUDIO-CATALOG.md ويختم حالة التحقق في content/audio-catalog.json.
 *
 * الأمانة أولًا: أي تعذّر في الاتصال يُبلَّغ كـ «تعذّر التحقق» ولا يُسجَّل نجاحًا.
 * (بيئة التطوير الحالية محجوبة عن cdn.islamic.network — سيُخرج «تعذّر الاتصال».)
 *
 * الاستدعاء:
 *   node scripts/verify-audio-sources.mjs                 # العيّنة الافتراضية
 *   node scripts/verify-audio-sources.mjs --with-surah     # + نمط السورة الكاملة
 *   node scripts/verify-audio-sources.mjs --reciter ar.alafasy
 *   node scripts/verify-audio-sources.mjs --dry-run        # طباعة الروابط بلا طلب
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = join(ROOT, 'content', 'audio-catalog.json');
const REPORT = join(ROOT, 'content', 'AUDIO-CATALOG.md');

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const value = (f) => {
  const i = args.indexOf(f);
  return i === -1 ? null : args[i + 1];
};

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
const withSurah = has('--with-surah');
const dryRun = has('--dry-run');
const only = value('--reciter');
const timeoutMs = Number(value('--timeout') ?? 8000);

const targets = catalog.reciters.filter((r) => !only || r.id === only);
const AYAH_SAMPLE = [1, 262, 6236];
const SURAH_SAMPLE = [1, 114];

async function head(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal });
    return { ok: res.ok, status: res.status, type: res.headers.get('content-type') };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, error: /abort/i.test(msg) ? 'انتهت المهلة' : msg.split('\n')[0] };
  } finally {
    clearTimeout(timer);
  }
}

const results = [];
let networkBlocked = true;

console.log(`== التحقق من ${targets.length} قارئًا (عيّنة: ${AYAH_SAMPLE.join('، ')}${withSurah ? ' + سور ' + SURAH_SAMPLE.join('، ') : ''}) ==`);
if (dryRun) console.log('(وضع dry-run: طباعة الروابط فقط)');

for (const r of targets) {
  const rows = [];
  for (const ayah of AYAH_SAMPLE) {
    const url = r.ayahUrl.replace('{bitrate}', r.defaultBitrate).replace('{number}', String(ayah));
    if (dryRun) {
      console.log(`  ${r.id} · آية ${ayah}: ${url}`);
      continue;
    }
    const res = await head(url);
    if (res.status) networkBlocked = false;
    rows.push({ kind: 'ayah', n: ayah, ...res });
    process.stdout.write(`  ${r.id} · آية ${ayah}: ${res.ok ? '✓ ' + res.status : '✗ ' + (res.status || res.error)}\n`);
  }
  if (withSurah) {
    for (const surah of SURAH_SAMPLE) {
      const url = r.surahUrl.replace('{bitrate}', r.defaultBitrate).replace('{number}', String(surah));
      if (dryRun) {
        console.log(`  ${r.id} · سورة ${surah}: ${url}`);
        continue;
      }
      const res = await head(url);
      if (res.status) networkBlocked = false;
      rows.push({ kind: 'surah', n: surah, ...res });
      process.stdout.write(`  ${r.id} · سورة ${surah}: ${res.ok ? '✓ ' + res.status : '✗ ' + (res.status || res.error)}\n`);
    }
  }
  if (!dryRun) {
    const ayahRows = rows.filter((x) => x.kind === 'ayah');
    const surahRows = rows.filter((x) => x.kind === 'surah');
    r.ayahVerified = ayahRows.length > 0 && ayahRows.every((x) => x.ok);
    r.surahVerified = surahRows.length > 0 && surahRows.every((x) => x.ok);
    results.push({ id: r.id, nameAr: r.nameAr, ayahVerified: r.ayahVerified, surahVerified: r.surahVerified, rows });
  }
}

if (dryRun) {
  console.log('\n(لا تحديث للملفات في وضع dry-run)');
  process.exit(0);
}

const allAyah = results.filter((x) => x.ayahVerified).length;
const status = networkBlocked
  ? 'unverified-network-blocked'
  : allAyah === results.length
    ? 'verified'
    : 'partial';

catalog.manifest.verification = {
  status,
  method: 'scripts/verify-audio-sources.mjs (HEAD على عيّنة)',
  checkedAt: new Date().toISOString(),
  sample: { ayahs: AYAH_SAMPLE, surahs: withSurah ? SURAH_SAMPLE : [] },
  verifiedReciters: allAyah,
  totalChecked: results.length,
  note: networkBlocked
    ? 'تعذّر الاتصال بالمضيف من بيئة التنفيذ — لم يُسجَّل أي تحقق. شغّل السكربت على جهاز متصل.'
    : 'نتائج فعلية من طلبات HEAD؛ راجع الجدول أدناه.',
};
writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n', 'utf8');

const table = results
  .map(
    (x) =>
      `| \`${x.id}\` | ${x.nameAr} | ${x.ayahVerified ? '✅' : '❌'} | ${
        x.surahVerified === null ? '—' : x.surahVerified ? '✅' : '❌'
      } | ${x.rows.map((r) => `${r.kind === 'ayah' ? 'آ' : 'س'}${r.n}:${r.ok ? r.status : 'فشل'}`).join(' · ')} |`,
  )
  .join('\n');

const report = readFileSync(REPORT, 'utf8').replace(
  /## حالة التحقق[\s\S]*$/,
  `## حالة التحقق

- **الحالة:** \`${status}\`
- **تاريخ الفحص:** ${catalog.manifest.verification.checkedAt}
- **الطريقة:** طلبات \`HEAD\` على عيّنة (آيات ${AYAH_SAMPLE.join('، ')}${withSurah ? ` · سور ${SURAH_SAMPLE.join('، ')}` : ''})
- **القرّاء المتحقَّقون:** ${allAyah} / ${results.length}

| المعرّف | القارئ | آية بآية | سورة كاملة | التفاصيل |
|---|---|---|---|---|
${table || '| — | لا نتائج (تعذّر الاتصال) | — | — | — |'}

> ${
    networkBlocked
      ? 'تعذّر الاتصال بالمضيف من بيئة التنفيذ (الشبكة محجوبة) — لم يُسجَّل أي تحقق، ولم يُدَّعَ نجاح.'
      : 'نتائج فعلية؛ أي قارئ يظهر ❌ يُستبعد من واجهة الاختيار حتى يُصلح.'
  }

## قواعد محفوظة

- لا نص قرآني ولا اسم مُولَّد: كل الأسماء والمعرّفات منسوخة من المصدرين، والاختلافات موثّقة.
- لا تنزيل داخل بيئة التطوير؛ التنزيل على جهاز المستخدم عند الطلب (أولًا-أوفلاين).
- لا حساب ولا تتبّع: الروابط تُطلب مباشرة من الـ CDN دون مرور بخدمة وسيطة.
`,
);
writeFileSync(REPORT, report, 'utf8');
console.log(`\nالحالة: ${status} — المتحقَّقون: ${allAyah}/${results.length}`);
