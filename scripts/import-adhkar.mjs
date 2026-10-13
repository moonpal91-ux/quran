/**
 * استيراد حزمة الأذكار (المرحلة 5) — بوابة 05.
 *
 * المصدر الرئيسي: osamayy/azkar-db @ fbdfa017782c (نص حصن المسلم — ملكية عامة،
 * المخاطرة الرخصية موثقة في manifest.json).
 * التحقق المستقل: Seen-Arabic (MIT) لأذكار الصباح + حزمة Tanzil المعتمدة لكل
 * نص قرآني داخل الأذكار.
 *
 * لا يُولَّد أي نص هنا — فقط: تنظيف هيكلي + تحقق + تجميع.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const refDir = path.join(ROOT, 'content', 'refs', 'adhkar');
const quran = JSON.parse(readFileSync(path.join(ROOT, 'content', 'quran-data.json'), 'utf8'));

const azkar = JSON.parse(readFileSync(path.join(refDir, 'azkar_obj.json'), 'utf8'));
const seenMorning = JSON.parse(readFileSync(path.join(refDir, 'morning_seen_ar.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(path.join(refDir, 'manifest.json'), 'utf8'));

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(name); console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

// ---------- أدوات تطبيع ----------
function orthoNorm(s) {
  s = String(s);
  // المَدّ (U+0670): بعد التاتيل/الواو/الياء = بدل عن الألف (→ا)، وبسواها = مدّ صوتي (يُحذف)
  let out = '';
  for (const c of s) {
    if (c === '\u0670') {
      const p = out[out.length - 1];
      if (p === '\u0640' || p === '\u0648' || p === '\u064A') out += 'ا';
    } else out += c;
  }
  s = out.replace(/[\u064B-\u065F\u0653\u06D6-\u06ED\u0640]/g, '');
  s = s.replace(/[أإآٱ]/g, 'ا').replace(/[ى]/g, 'ي').replace(/ة/g, 'ه').replace(/[ءؤئ]/g, '');
  s = s.replace(/[,،.!?؟؛;:()[\]«»\-\u2329\u232A]/g, '');
  return s.replace(/\s+/g, '');
}
// للمقارنة فقط: حذف الألف (أكثر حرف تقلبًا بين الرسمين) — العرض لا يتأثر
function noAlif(s) {
  return String(s).replace(/[ا\u0670]/g, '');
}
function stripArabicDiacritics(s) {
  return String(s).replace(/[\u064B-\u065F\u0670\u0653\u0640]/g, '');
}
function cleanZekr(z) {
  let s = String(z).replace(/\r\n?/g, '\n').trim();
  // أقواس غير متوازنة حول النص (حرفية المصدر) — تُحذف إذا أحاطت بالنص كاملًا
  const open = (s.match(/\(/g) || []).length;
  const close = (s.match(/\)/g) || []).length;
  if (open === close + 1 && s.startsWith('(')) s = s.slice(1).trim();
  if (close === open + 1 && s.endsWith(')')) s = s.slice(0, -1).trim();
  s = s.replace(/\n{2,}/g, '\n').replace(/[ \t]+\n/g, '\n');
  return s;
}

// ---------- خريطة السور من الحزمة المعتمدة ----------
const surahByName = new Map();
for (const s of quran.surahs) surahByName.set(orthoNorm(s.nameArabic), s.number);
const ayahText = new Map();
const ayahSearch = new Map();
for (const a of quran.ayahs) {
  ayahText.set(`${a.surah}:${a.ayah}`, a.text);
  if (a.search) ayahSearch.set(`${a.surah}:${a.ayah}`, a.search);
}

console.log('== [1] بنية المصدر ==');
check('العناصر = 345', azkar.length === 345, `الموجود ${azkar.length}`);
check('كل عنصر: category + zekr غير فارغة', azkar.every(a => (a.category || '').trim() && (a.zekr || '').trim()));
check('كل zekr نص عربي سليم (≥5 أحرف، بلا رموز تحكم)',
  azkar.every(a => {
    const t = (a.zekr || '').replace(/\r/g, '');
    return t.length >= 5 && /[ء-ي]/.test(t) && !/[\u0000-\u0008\u000B-\u001F\u007F]/.test(t);
  }));
const cats = [...new Set(azkar.map(a => a.category.trim()))];
check('الفئات = 135 فريدة', cats.length === 135, `الموجود ${cats.length}`);
check('الفئات الأساسية متوفرة', ['أذكار الصباح', 'أذكار المساء', 'أذكار النوم', 'دعاء الاستفتاح'].every(c => cats.includes(c)));
const countStats = azkar.filter(a => Number.isInteger(a.count)).length;
console.log(`  (count رقمي في المصدر: ${countStats}/345 — الباقي = 1 حسب القاعدة الموثقة)`);

console.log('== [2] التحقق القرآني (نص الآيات == Tanzil المعتمد) ==');
const SURAH_RE = /سورة\s+([ء-ي]{2,20})(?:\s+(\d{1,3}))?/;
let quranItems = 0, quranMatched = 0, quranMissed = 0;
const quranMap = [];
for (const a of azkar) {
  const ref = a.reference || '';
  const m = ref.match(SURAH_RE);
  if (!m) continue;
  const name = m[1].replace(/^ال/, '').replace(/^السورة/, '');
  const n = surahByName.get(orthoNorm(m[1])) || surahByName.get(orthoNorm('سورة ' + m[1]));
  if (!n) continue;
  quranItems++;
  const ayahAt = (k) => {
    const rec = ayahSearch.get(`${n}:${k}`) || ayahText.get(`${n}:${k}`) || '';
    return orthoNorm(rec);
  };
  let expected;
  if (m[2]) {
    const parts = m[2].split(/\s*[-–]\s*/).map(x => x.trim());
    expected = parts.map(p => ayahAt(parseInt(p))).join('');
  } else {
    let k = 1;
    while (ayahSearch.has(`${n}:${k}`) || ayahText.has(`${n}:${k}`)) { expected = (expected || '') + ayahAt(k); k++; }
  }
  const zekrN = noAlif(orthoNorm(a.zekr));
  const ok = expected.length > 20 && zekrN.includes(noAlif(expected));
  if (ok) quranMatched++; else quranMissed++;
  quranMap.push({ ref: a.reference, surah: n, ok });
}
check(`آيات القرآن داخل الأذكار متطابقة مع Tanzil (${quranMatched}/${quranItems})`,
  quranItems >= 5 && quranMissed === 0,
  quranMissed ? JSON.stringify(quranMap.filter(q => !q.ok).slice(0, 5)) : '');

console.log('== [3] التحقق المستقل: مصدر MIT (صباح + مساء ممزوجان) ==');
const allNorm = azkar.map(a => noAlif(orthoNorm(a.zekr)));
let seenMatched = 0, seenCountChecked = 0, seenCountOk = 0;
const seenMissing = [];
const countDiscrepancies = [];
for (const sm of seenMorning) {
  const core = noAlif(orthoNorm(stripArabicDiacritics(sm.content).replace(/\n/g, ' ')));
  const frag = core.slice(0, 30);
  let hitIdx = -1;
  if (core.length > 25) {
    hitIdx = allNorm.findIndex(m => m.includes(frag));
    if (hitIdx < 0) hitIdx = allNorm.findIndex(m => m.includes(core.slice(0, 15)));
  }
  if (hitIdx >= 0) {
    seenMatched++;
    const hit = azkar[hitIdx];
    if (hit.category === 'أذكار الصباح' || hit.category === 'أذكار المساء') {
      seenCountChecked++;
      const oc = Number.isInteger(hit.count) ? hit.count : 1;
      if (oc === sm.count) seenCountOk++;
      else countDiscrepancies.push({ t: sm.content.slice(0, 25).replace(/\n/g, ' '), cat: hit.category, mit: sm.count, db: oc });
    }
  } else {
    seenMissing.push({ t: sm.content.slice(0, 35).replace(/\n/g, ' '), count: sm.count });
  }
}
check(`نصوص MIT (صباح+مساء) موجودة في الحزمة (${seenMatched}/${seenMorning.length} ≥ 85٪)`,
  seenMatched >= Math.ceil(seenMorning.length * 0.85), JSON.stringify(seenMissing.slice(0, 3)));
if (seenMissing.length > 0)
  console.log(`  موثق: ${seenMissing.length} عنصرًا بمصاغة/رواية مختلفة أو غير موجود (تفصيل في التقرير): ${JSON.stringify(seenMissing.map(m => m.t.slice(0, 30)))}`);
if (countDiscrepancies.length > 0)
  console.log(`  تحذير موثق: اختلاف تكرارات بين المصدرين (${countDiscrepancies.length}): ${JSON.stringify(countDiscrepancies)}`);

console.log('== [4] تجميع الحزمة ==');
const catIndex = new Map();
const categories = [];
for (const c of cats) {
  catIndex.set(c, categories.length);
  categories.push({ id: categories.length + 1, name: c });
}
const items = [];
for (let i = 0; i < azkar.length; i++) {
  const a = azkar[i];
  const cat = a.category.trim();
  const seq = items.filter(x => x.categoryId === catIndex.get(cat) + 1).length + 1;
  const ref = (a.reference || '').trim();
  const rm = ref.match(SURAH_RE);
  let quranRef = null;
  if (rm) {
    const n = surahByName.get(orthoNorm(rm[1])) || surahByName.get(orthoNorm('سورة ' + rm[1]));
    if (n) {
      quranRef = rm[2] ? `${n}:${parseInt(rm[2])}` : `${n}:1`; // السورة كاملة: أول آية = علامة "سورة كاملة"
      if (!rm[2]) quranRef = `${n}:*`;
    }
  }
  items.push({
    id: `${catIndex.get(cat) + 1}-${seq}`,
    categoryId: catIndex.get(cat) + 1,
    category: cat,
    zekr: cleanZekr(a.zekr),
    count: Number.isInteger(a.count) && a.count > 0 ? a.count : 1,
    reference: ref || null,
    description: (a.description || '').trim() || null,
    quranRef,
  });
}
check('المخرجات = 345 عنصرًا', items.length === 345);
check('كل عنصر: id فريد + count ≥ 1',
  new Set(items.map(i => i.id)).size === items.length && items.every(i => i.count >= 1));
const withQuran = items.filter(i => i.quranRef);
console.log(`  (عناصر قرآنية: ${withQuran.length} — تُعرض من Tanzil في التطبيق)`);

const bundle = {
  manifest: {
    name: 'حصن المسلم — أذكار وأدعية',
    version: 'adhkar-1.0',
    importedAt: manifest.generated,
    sources: manifest.sources,
    rules: manifest.rules,
    contentLicense: 'نص ديني في الملكية العامة (كتاب حصن المسلم — توزيع حر). المستوديان بلا رخصة صريحة: مخاطرة موثقة في content/refs/adhkar/manifest.json.',
    sha256Source: manifest.sources[0].sha256,
  },
  categories,
  items,
};
const outPath = path.join(ROOT, 'content', 'adhkar-data.json');
writeFileSync(outPath, JSON.stringify(bundle, null, 1), 'utf8');
const outSha = createHash('sha256').update(readFileSync(outPath)).digest('hex');
console.log(`  الحزمة: content/adhkar-data.json — ${items.length} ذكرًا / ${categories.length} فئة — sha256 ${outSha.slice(0, 16)}…`);

console.log('== [5] إعادة الفتح والتحقق ==');
const back = JSON.parse(readFileSync(outPath, 'utf8'));
check('إعادة الفتح: نفس الأعداد', back.items.length === 345 && back.categories.length === 135);
check('إعادة الفحص: لا نصوص فارغة', back.items.every(i => i.zekr.length >= 5));

console.log(`\nالنتيجة: ${pass} نجح / ${fail} فشل`);
if (fail > 0) {
  console.log('الفشل:', failures.join(' | '));
  process.exit(1);
}
writeFileSync(path.join(ROOT, 'content', 'ADHKAR-IMPORT-REPORT.md'),
  `# تقرير استيراد الأذكار (المرحلة 5) — بوابة 05\n\n**النتيجة: ${pass} نجح / ${fail} فشل** (${manifest.generated})\n\n## المصادر\n| المصدر | الدور | النسخة | الرخصة |\n|---|---|---|---|\n| osamayy/azkar-db (azkar_obj.json) | النص الكامل: 345 ذكرًا / 135 فئة | commit fbdfa017782c | بلا رخصة صريحة — نص ديني عام (مخاطرة موثقة) |\n| Seen-Arabic (morning_ar.json) | تحقق مستقل: أذكار الصباح (34) | commit 29d7623fede5 | MIT |\n| content/quran-data.json (Tanzil Uthmani v1.1) | كل نص قرآني داخل الأذكار | معتمدة بالمرحلة 2 | ملكية عامة + بصمة |\n\n## الفحوص\n- البنية: 345 عنصرًا، 135 فئة، نصوص عربية سليمة، بلا رموز تحكم.
- اختلافات التكرار بين المصدرين (${countDiscrepancies.length}): ${countDiscrepancies.map(d => `«${d.t}» (MIT: ${d.mit} / الحزمة: ${d.db})`).join('، ') || 'لا شيء'} — يُعرض عدّاد المصدر المعتمد (osamayy).
- عناصر MIT غير المطابقة نصًا (${seenMissing.length}): ${seenMissing.map(m => `«${m.t}»`).join('، ') || 'لا شيء'} — فروق مصاغة/رواية موثقة بين المصدرين (نفس الذكر بصيغة أخرى) أو غياب من المصدر المعتمد؛ لا تُعد خللًا في النصوص المطابقة (${seenMatched}/${seenMorning.length}).\n- القرآن: ${quranMatched}/${quranItems} نصًا قرآنيًا متطابق مع Tanzil بعد تطبيع الرسم (العثماني/الاعلمي).\n- الصباح (تحقق MIT): ${seenMatched}/${seenMorning.length} نصًا متطابقًا، التكرارات ${seenCountOk}/${seenMatched} متطابقة.\n- قاعدة التكرار: القيمة الرقمية إن وُجدت في المصدر، وإلا 1 (يُقال مرة).\n\n## قاعدة العرض في التطبيق\n- العنصر ذو quranRef يُعرض نصه من حزمة Tanzil المعتمدة (اتساق مع المصحف) — لا من هذا المصدر.\n- سائر الأذكار تُعرض كنص المصدر (فصحى مشكّلة) دون أي توليد أو تعديل.\n`, 'utf8');
console.log('التقرير: content/ADHKAR-IMPORT-REPORT.md');
