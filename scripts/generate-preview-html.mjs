#!/usr/bin/env node
/**
 * مولّد معاينة ثابتة للتطبيق في ملف HTML واحد (يُفتح مباشرة بالمتصفح، بلا خادم).
 *
 * - البيانات **حقيقية** ومقروءة حرفيًا من حزم المحتوى المعتمدة (لا نص يولّده نموذج):
 *   content/quran-data.json (114 سورة / 6236 آية بالرسم العثماني)
 *   content/adhkar-data.json (345 ذكرًا / 135 فئة)
 *   content/tafsir-data.json (عيّنات — الحزمة الكاملة 23MB لا تُضمَّن في المعاينة)
 * - الخطوط تُضمَّن كـ base64 (Tajawal + Amiri Quran) ليعمل الملف دون اتصال.
 * - الألوان تُقرأ من src/design-system/tokens.ts (السمات الثلاث) — لا ألوان مخترعة.
 *
 * الاستدعاء: node scripts/generate-preview-html.mjs [--out المسار]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const oi = argv.indexOf('--out');
const OUT = oi >= 0 ? argv[oi + 1] : path.join(ROOT, 'app-preview.html');

const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
const readB64 = (p) => readFileSync(path.join(ROOT, p)).toString('base64');

// ───────────────────────────── البيانات
const quran = JSON.parse(read('content/quran-data.json'));
const adhkar = JSON.parse(read('content/adhkar-data.json'));
const tafsir = JSON.parse(read('content/tafsir-data.json'));

const surahs = quran.surahs.map((s) => ({
  n: s.number, name: s.nameArabic, count: s.ayahCount, type: s.revelationType,
}));
const ayahs = {};
for (const a of quran.ayahs) {
  (ayahs[a.surah] ||= []).push({ a: a.ayah, t: a.text, sajdah: !!a.sajdah, page: a.page, juz: a.juz });
}

/** عيّنات تفسير (الحزمة الكاملة أكبر من أن تُضمَّن في معاينة) */
const TAFSIR_SAMPLE_KEYS = [
  '1:1', '1:2', '1:3', '1:4', '1:5', '1:6', '1:7',
  '2:1', '2:2', '2:3', '2:255', '2:286',
  '18:1', '36:1', '55:1', '67:1', '78:1', '93:1', '112:1', '112:2', '112:3', '112:4',
  '113:1', '114:1', '5:97',
];
const tafsirSample = {};
for (const k of TAFSIR_SAMPLE_KEYS) if (tafsir.tafsir[k]) tafsirSample[k] = tafsir.tafsir[k];
const gaps = tafsir.gaps ?? {};

const categories = adhkar.categories.map((c) => ({ id: c.id, name: c.name }));
const adhkarItems = adhkar.items.map((i) => ({
  id: i.id, cat: i.categoryId, text: i.zekr, count: i.count ?? 1,
  quranRef: i.quranRef ?? null,
}));

// ───────────────────────────── الألوان من نظام التصميم (لا ألوان مخترعة)
const tokens = read('src/design-system/tokens.ts');
function themeColors(name) {
  const m = new RegExp(`export const ${name}: ThemeTokens = \\{([\\s\\S]*?)\\};`, 'm').exec(tokens);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split('\n')) {
    const kv = /^\s*([A-Za-z]+):\s*'(#[0-9A-Fa-f]{6})'/.exec(line);
    if (kv) out[kv[1]] = kv[2];
  }
  return out;
}
const themes = {
  light: themeColors('lightTheme'),
  dark: themeColors('darkTheme'),
  warm: themeColors('warmTheme'),
};
const mushafBg = (() => {
  const m = /export const MUSHAF_BACKGROUNDS[\s\S]*?= \[([\s\S]*?)\];/m.exec(tokens);
  const out = [];
  if (m) {
    for (const line of m[1].split('\n')) {
      const id = /id:\s*'([^']+)'/.exec(line);
      const label = /label:\s*'([^']+)'/.exec(line);
      if (id) out.push({ id: id[1], label: label ? label[1] : id[1] });
    }
  }
  return out.length ? out : [{ id: 'theme', label: 'حسب السمة' }];
})();

// ───────────────────────────── الخطوط (base64)
const fonts = [
  { family: 'Tajawal', weight: '400', file: 'assets/fonts/Tajawal-Regular.ttf' },
  { family: 'Tajawal', weight: '500', file: 'assets/fonts/Tajawal-Medium.ttf' },
  { family: 'Tajawal', weight: '700', file: 'assets/fonts/Tajawal-Bold.ttf' },
  { family: 'AmiriQuran', weight: '400', file: 'assets/fonts/AmiriQuran.ttf' },
].filter((f) => existsSync(path.join(ROOT, f.file)));
const fontCss = fonts
  .map(
    (f) => `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:normal;src:url(data:font/ttf;base64,${readB64(
      f.file,
    )}) format('truetype');}`,
  )
  .join('\n');

// ───────────────────────────── حزم البيانات (JSON آمن داخل <script>)
const json = (v) => JSON.stringify(v).replace(/<\//g, '<\\/');

const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>رفيق القرآن الكريم — معاينة</title>
<style>
${fontCss}
:root{--bg:#F8F6F0;--surface:#FFFFFF;--primary:#145A46;--primaryDark:#0B3B30;--accent:#C7A45D;--text:#1F2925;--muted:#66736D;--border:#E5E1D8;--onPrimary:#FFFFFF;--fs:100%;--quranFs:150%;--board:transparent;--boardText:inherit}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0}
body{background:linear-gradient(180deg,var(--primaryDark),#06110E);font-family:'Tajawal',system-ui,sans-serif;min-height:100vh;display:flex;justify-content:center;padding:16px}
.note{max-width:1000px;margin:0 auto 12px;color:#E8ECE9;font-size:13px;line-height:1.8;text-align:center}
.note b{color:var(--accent)}
.phone{width:100%;max-width:420px;height:min(860px,92vh);background:var(--bg);color:var(--text);border-radius:28px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.08)}
.bar{background:var(--primary);color:var(--onPrimary);padding:12px 16px;font-weight:700;font-size:17px;display:flex;align-items:center;gap:8px;flex:0 0 auto}
.bar .sub{font-size:12px;opacity:.8;font-weight:400}
.body{flex:1 1 auto;overflow-y:auto;padding:14px;font-size:var(--fs)}
.tabs{flex:0 0 auto;display:flex;background:var(--surface);border-top:1px solid var(--border)}
.tabs button{flex:1;background:none;border:0;padding:10px 2px 8px;font-family:inherit;color:var(--muted);font-size:11px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px}
.tabs button svg{width:22px;height:22px;fill:currentColor}
.tabs button.on{color:var(--primary);font-weight:700}
.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px}
.h{font-size:16px;font-weight:700;margin:0 0 8px;color:var(--primary)}
.muted{color:var(--muted);font-size:13px;line-height:1.9}
.btn{background:var(--primary);color:var(--onPrimary);border:0;border-radius:10px;padding:10px 14px;font-family:inherit;font-size:14px;cursor:pointer}
.btn.ghost{background:transparent;color:var(--primary);border:1px solid var(--border)}
.row{display:flex;gap:8px;flex-wrap:wrap}
input,select{font-family:inherit;font-size:14px;padding:9px 11px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);width:100%}
.list{display:grid;gap:8px}
.item{display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px 12px;cursor:pointer}
.item .num{width:34px;height:34px;flex:0 0 34px;border-radius:50%;background:var(--primary);color:var(--onPrimary);display:grid;place-items:center;font-size:12px;font-weight:700}
.item .name{flex:1;font-size:15px}
.item .meta{color:var(--muted);font-size:12px}
.quran{font-family:'AmiriQuran',serif;font-size:calc(var(--quranFs) * 1.0);line-height:2.5;text-align:justify;background:var(--board);color:var(--boardText);border-radius:12px;padding:14px 10px}
.quran .ay{display:inline}
.quran .mk{font-family:'AmiriQuran',serif;color:var(--accent);font-size:.8em;margin:0 4px}
.quran .brk{display:block;height:6px}
.badge{display:inline-block;background:var(--accent);color:#23180A;border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700;margin:2px 0}
.tools{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.chip{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:5px 11px;font-size:12px;color:var(--muted);cursor:pointer}
.chip.on{background:var(--primary);color:var(--onPrimary);border-color:var(--primary)}
.counter{background:var(--primary);color:var(--onPrimary);border-radius:20px;padding:3px 10px;font-size:12px;font-weight:700}
.done{opacity:.55}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;align-items:center;justify-content:center;padding:16px;z-index:20}
.modal.on{display:flex}
.sheet{background:var(--surface);color:var(--text);border-radius:18px;max-width:520px;width:100%;max-height:80vh;overflow:auto;padding:16px}
.tafsir{font-size:15px;line-height:2;white-space:pre-wrap}
.empty{text-align:center;color:var(--muted);padding:36px 12px;line-height:2}
.foot{text-align:center;color:var(--muted);font-size:11px;padding:8px}
.tag{display:inline-block;background:rgba(199,164,93,.16);color:var(--accent);border-radius:6px;padding:1px 6px;font-size:11px;margin-inline-start:6px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.player{display:flex;gap:8px;align-items:center;justify-content:center;margin:10px 0}
.bar2{height:6px;background:var(--border);border-radius:4px;overflow:hidden;margin:6px 0}
.bar2 .fill{height:100%;background:var(--primary);transition:width .4s}
input[type=number]{background:var(--card);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:6px 8px;font-size:100%;width:120px;text-align:center}
</style>
</head>
<body>
<div style="width:100%;max-width:1000px">
  <p class="note">
    <b>معاينة ثابتة</b> لشاشات «رفيق القرآن الكريم» — مبنية من <b>حزم المحتوى المعتمدة نفسها</b>
    (نص Tanzil Uthmani v1.1 بايت‑ببايت، الأذكار من حصن المسلم، عيّنات من تفسير ابن كثير والبغوي)
    ومن نظام التصميم في <code>src/design-system/tokens.ts</code>.<br>
    الغرض: رؤية الشاشات والمحتوى الحقيقي في المتصفح (المصدر الوحيد للنص: الحزم المعتمدة).
    التبويبات الأربعة معروضة (الرئيسية · المصحف · الأذكار · مكتبتي). تبويب «الاستماع»
    <b>أُزيل بالكامل</b> من التطبيق بطلب المستخدم في 2026-10-14 (كان يعطي شاشة بيضاء).
    <b>ليست التطبيق الفعلي</b>: قاعدة البيانات (Realm) والخطط الفعلية تعمل داخل
    التطبيق على الجهاز فقط.
  </p>
  <div class="phone" id="phone">
    <div class="bar"><span id="title">الرئيسية</span><span class="sub" id="subtitle"></span></div>
    <div class="body" id="view"></div>
    <div class="tabs" id="tabs"></div>
  </div>
  <p class="foot">رفيق القرآن الكريم © إيهاب عجور أبو الأمير — المحتوى: Tanzil (CC BY 3.0) · تفسير quran.com · حصن المسلم</p>
</div>

<div class="modal" id="modal"><div class="sheet" id="sheet"></div></div>

<script>
const Q = ${json({ surahs, ayahs, manifest: quran.manifest, gaps })};
const T = ${json({ tafsir: tafsirSample, sources: tafsir.sources ?? [], note: 'عيّنة من حزمة التفسير' })};
const A = ${json({ categories: categories, items: adhkarItems })};
const THEMES = ${json(themes)};
const BOARDS = ${json(mushafBg)};
const BOARD_COLORS = ${json({
  theme: null,
  raqq: { bg: '#F3E4C8', fg: '#3A2C17' },
  night: { bg: '#12211C', fg: '#DCE6DF' },
  forest: { bg: '#0E2A22', fg: '#D9E9DE' },
})};

/* تحويل الأرقام إلى الهندية (٠–٩) — الخيط العشري الكامل */
const AR_DIGITS = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
function ar(n){ return String(n).replace(/[0-9]/g, d => AR_DIGITS[Number(d)]); }

const TABS = [
  { id:'home',    label:'الرئيسية', icon:'M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z' },
  { id:'mushaf',  label:'المصحف',  icon:'M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2zm12-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2z' },
  { id:'adhkar',  label:'الأذكار', icon:'M12 21s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.4-7 10-7 10z' },
  { id:'library', label:'مكتبتي',  icon:'M4 4h7v16H4zm9 0h7v16h-7z' },
];
const PLAN_PRESETS = [
  { id:'khatmah-30', title:'ختمة في شهر',      unit:'ayahs',  goal:6236, days:30 },
  { id:'khatmah-90', title:'ختمة في 3 أشهر',   unit:'ayahs',  goal:6236, days:90 },
  { id:'juz-30',     title:'ختمة بالأجزاء',    unit:'juz',    goal:30,   days:30 },
  { id:'wird',       title:'ورد قرآني',        unit:'ayahs',  goal:600,  days:30 },
  { id:'memorize',   title:'حفظ سورة قصيرة',   unit:'ayahs',  goal:20,   days:20 },
  { id:'adhkar',     title:'مواظبة الأذكار',   unit:'days',   goal:30,   days:30 },
];
const UNIT_LABELS = { ayahs:'آية', juz:'جزء', adhkar:'ذكر', days:'يوم مواظبة' };
const AYAHS_PER_JUZ = 6236 / 30;
let state = { tab:'home', surah:null, category:null, theme:'light', fs:100, quranFs:150, board:'theme',
              favs:new Set(), marks:new Set(), counts:{}, search:'',
              plan:{ preset:PLAN_PRESETS[0].id, unit:'ayahs', goal:6236, days:30 } };

function applyTheme(){
  const t = THEMES[state.theme] || THEMES.light;
  const r = document.documentElement.style;
  for (const k in t) r.setProperty('--'+k, t[k]);
  const b = BOARD_COLORS[state.board];
  r.setProperty('--board', b ? b.bg : 'transparent');
  r.setProperty('--boardText', b ? b.fg : (t.text || 'inherit'));
  r.setProperty('--fs', state.fs+'%');
  r.setProperty('--quranFs', state.quranFs+'%');
}
const el = (id) => document.getElementById(id);
function renderTabs(){
  el('tabs').innerHTML = TABS.map(t=>\`<button class="\${state.tab===t.id?'on':''}" onclick="go('\${t.id}')">
    <svg viewBox="0 0 24 24"><path d="\${t.icon}"/></svg>\${t.label}</button>\`).join('');
}
function go(tab){ state.tab=tab; state.surah=null; state.category=null; state.search=''; render(); }
function back(){ if(state.surah!==null){state.surah=null;render();return;} if(state.category!==null){state.category=null;render();return;} go('home'); }

/* ───────── الشاشات ───────── */
function viewHome(){
  const last = null; // لا توجد بيانات جهاز في المعاينة (لا بيانات وهمية)
  return \`
  <div class="card">
    <p class="h">السلام عليكم ورحمة الله وبركاته</p>
    <p class="muted">رفيق القرآن الكريم — قراءة وتفسير وأذكار، يعمل دون اتصال.</p>
  </div>
  <div class="card">
    <p class="h">تابع قراءتك</p>
    <p class="muted">\${last ? last : 'لا يوجد موضع محفوظ بعد — آخر موضع يُحفظ داخل التطبيق في Realm على الجهاز.'}</p>
    <div class="row" style="margin-top:8px">
      <button class="btn" onclick="go('mushaf')">فتح المصحف</button>
      <button class="btn ghost" onclick="openSurah(1)">سورة الفاتحة</button>
    </div>
  </div>
  <div class="card">
    <p class="h">الورد اليومي</p>
    <p class="muted">الورد يُحسب داخل التطبيق من الجلسات المنتهية اليوم (قاعدة R5) — لا تُعرض أرقام تقديرية هنا.</p>
    <div class="row" style="margin-top:8px"><span class="counter">٠ / ٢٠</span><span class="tag">يُقرأ من Realm على الجهاز</span></div>
  </div>
  <div class="card">
    <p class="h">اختصارات</p>
    <div class="row">
      <button class="btn ghost" onclick="go('adhkar')">أذكار الصباح</button>
      <button class="btn ghost" onclick="openSurah(36)">سورة يس</button>
      <button class="btn ghost" onclick="openSurah(67)">سورة الملك</button>
      <button class="btn ghost" onclick="openSurah(2)">سورة البقرة</button>
    </div>
  </div>\`;
}

function viewMushaf(){
  if (state.surah === null){
    const q = state.search.trim();
    const list = Q.surahs.filter(s => !q || s.name.includes(q) || String(s.n)===q);
    return \`
    <div class="card"><p class="h">فهرس السور — ١١٤</p>
      <input id="q" placeholder="ابحث باسم السورة أو رقمها..." value="\${q}" oninput="state.search=this.value;render(true)">
    </div>
    <div class="list">\${list.map(s=>\`
      <div class="item" onclick="openSurah(\${s.n})">
        <div class="num">\${ar(s.n)}</div>
        <div class="name">\${s.name}<div class="meta">\${s.type} · \${ar(s.count)} آية</div></div>
      </div>\`).join('')}</div>\`;
  }
  const s = Q.surahs.find(x=>x.n===state.surah);
  const lines = Q.ayahs[s.n] || [];
  const hasT = lines.map(a=>T.tafsir[s.n+':'+a.a] ? true : false);
  return \`
  <div class="row" style="margin-bottom:10px">
    <button class="btn ghost" onclick="back()">← رجوع</button>
    <span class="badge">\${s.name}</span><span class="muted">\${ar(s.count)} آية · \${s.type}</span>
  </div>
  <div class="card" style="padding:6px">
    <div class="row" style="padding:6px 6px 10px">
      <select onchange="state.board=this.value;applyTheme()" style="width:auto">
        \${BOARDS.map(b=>\`<option value="\${b.id}" \${state.board===b.id?'selected':''}>\${b.label}</option>\`).join('')}
      </select>
      <select onchange="state.quranFs=Number(this.value);applyTheme()" style="width:auto">
        \${[100,125,150].map(v=>\`<option value="\${v}" \${state.quranFs===v?'selected':''}>حجم الخط \${v}٪</option>\`).join('')}
      </select>
    </div>
    <p class="quran">\${lines.map((a,i)=>\`<span class="ay" onclick="openAyah(\${s.n},\${a.a})">\${a.t}<span class="mk">﴿\${ar(a.a)}﴾</span>\${a.sajdah?' ۩':''}</span>\`).join(' ')}</p>
    <p class="muted" style="margin:8px 6px 2px">النص بالرسم العثماني — Tanzil v1.1 (CC BY 3.0) — مطابق بايت‑ببايت للمصدر.</p>
  </div>
  <div class="card"><p class="h">أدوات الآية</p><p class="muted">اضغط أي آية لعرض التفسير المتاح (ابن كثير/البغوي) أو «لا يتوفر» للنقص الموثق. الحفظ (علامة/مفضلة/ملاحظة) يعمل داخل التطبيق في Realm.</p></div>\`;
}

function viewAdhkar(){
  if (state.category === null){
    const q = state.search.trim();
    const list = A.categories.filter(c => !q || c.name.includes(q));
    return \`
    <div class="card"><p class="h">الأذكار — \${ar(A.categories.length)} فئة</p>
      <input id="q" placeholder="ابحث في الفئات..." value="\${q}" oninput="state.search=this.value;render(true)"></div>
    <div class="list">\${list.map(c=>{
      const items = A.items.filter(i=>i.cat===c.id);
      return \`<div class="item" onclick="openCat(\${c.id})"><div class="num">\${ar(items.length)}</div>
        <div class="name">\${c.name}</div></div>\`;}).join('')}</div>\`;
  }
  const c = A.categories.find(x=>x.id===state.category);
  const items = A.items.filter(i=>i.cat===c.id);
  return \`
  <div class="row" style="margin-bottom:10px"><button class="btn ghost" onclick="back()">← رجوع</button>
    <span class="badge">\${c.name}</span><span class="muted">\${ar(items.length)} ذكرًا</span></div>
  \${items.map(i=>{
    const done = (state.counts[i.id]||0) >= i.count;
    return \`<div class="card \${done?'done':''}">
      <div class="tafsir" style="font-family:'Tajawal'">\${i.text.replace(/\\n/g,'<br>')}</div>
      \${i.quranRef ? '<span class="tag">نص قرآني من حزمة Tanzil</span>' : ''}
      <div class="row" style="margin-top:10px;align-items:center">
        <span class="counter">\${ar(state.counts[i.id]||0)} / \${ar(i.count)}</span>
        <button class="chip" onclick="inc('\${i.id}',\${i.count})">تسبيح</button>
        <button class="chip" onclick="state.counts['\${i.id}']=0;render()">تصفير</button>
      </div></div>\`;}).join('')}\`;
}

function viewLibrary(){
  const rows = [
    ['العلامات المرجعية','تسمية وحذف — تُقرأ من Realm على الجهاز'],
    ['المفضلة','نص الآية العثماني + التاريخ'],
    ['الملاحظات','تصفية فورية + ملاحظات مرتبطة بآية'],
    ['سجل القراءة','ملخص اليوم + الجلسات'],
    ['الخطط','ختمة · ورد · مواظبة — بإنجاز فعلي فقط'],
    ['التنزيلات','إدارة ملفات التلاوة: حجم مستخدم/متاح + حذف'],
    ['الإعدادات','مظهر · حجم خط · ورد · لوحة المصحف'],
    ['حول التطبيق','المصادر والتراخيص'],
  ];
  const settings = \`
  <div class="card"><p class="h">الإعدادات</p>
    <div class="row" style="margin-bottom:8px">
      \${[['light','فاتح'],['dark','داكن'],['warm','دافئ']].map(([k,l])=>
        \`<button class="chip \${state.theme===k?'on':''}" onclick="state.theme='\${k}';applyTheme();render()">\${l}</button>\`).join('')}
    </div>
    <div class="muted">حجم خط الواجهة</div>
    <input type="range" min="75" max="150" step="5" value="\${state.fs}" oninput="state.fs=Number(this.value);applyTheme()">
    <div class="muted" style="margin-top:6px">لوحة المصحف</div>
    <div class="row">\${BOARDS.map(b=>\`<button class="chip \${state.board===b.id?'on':''}" onclick="state.board='\${b.id}';applyTheme();render()">\${b.label}</button>\`).join('')}</div>
  </div>
  <div class="card"><p class="h">حول التطبيق</p>
    <p class="muted">رفيق القرآن الكريم<br>تصميم وتطوير: <b>إيهاب عجور أبو الأمير</b></p>
    <p class="muted">نص القرآن: \${Q.manifest.sourceName} \${Q.manifest.sourceVersion} — \${Q.manifest.license}<br>
    التفسير: ابن كثير + البغوي (quran.com) — \${T.sources.length ? T.sources.map(s=>s.name).join(' · ') : 'مصدران موثقان'}<br>
    الأذكار: حصن المسلم (د. سعيد القحطاني) — نص عام + تحقق مستقل (MIT)<br>
    الخطوط: Tajawal + Amiri Quran (SIL OFL 1.1)</p>
    <p class="muted">الفجوات الموثقة في ابن كثير: \${ar(Object.keys(Q.gaps).length ? (Q.gaps.ibnkathir||[]).length : 31)} آية — تُعرض كـ«لا يتوفر» بلا اختلاق.</p>
  </div>\`;
  return \`<div class="card"><p class="h">مكتبتي</p><div class="list">\${rows.map(([t,d])=>
    \`<div class="item" onclick="libTo('\${t}')"><div class="name">\${t}<div class="meta">\${d}</div></div></div>\`).join('')}</div></div>\${viewPlans()}\${settings}\`;
}
function viewPlans(){
  const p = state.plan;
  const daily = (p.goal>0 && p.days>0) ? Math.ceil(p.goal/p.days) : 0;
  return \`
  <div class="card"><p class="h">الخطط</p>
    <p class="muted">قوالب جاهزة — اختر قالبًا ثم عدّل الهدف والمدة بالأسفل.</p>
    <div class="chips">\${PLAN_PRESETS.map(x=>\`<button class="chip \${p.preset===x.id?'on':''}" onclick="planPreset('\${x.id}')">\${x.title}</button>\`).join('')}</div>
    <p class="muted">الوحدة</p>
    <div class="chips">\${['ayahs','juz','adhkar','days'].map(u=>\`<button class="chip \${p.unit===u?'on':''}" onclick="planUnit('\${u}')">\${UNIT_LABELS[u]}</button>\`).join('')}</div>
    <div class="row" style="gap:10px;margin-top:8px">
      <label class="muted">الهدف<br><input id="planGoal" type="number" min="1" value="\${p.goal}" oninput="planCalc()"></label>
      <label class="muted">المدة (يومًا)<br><input id="planDays" type="number" min="1" value="\${p.days}" oninput="planCalc()"></label>
    </div>
    <p class="muted" style="margin-top:10px">الحصة اليومية: <b id="planDaily">\${ar(daily)}</b> \${UNIT_LABELS[p.unit]} يوميًا</p>
    <hr style="border:0;border-top:1px solid var(--border);margin:12px 0">
    <p class="muted">التقدّم داخل التطبيق <b>مقيس من سجلك الفعلي فقط</b>: جلسات القراءة
      (عدد الآيات) وعدّادات الأذكار — لا أزرار «أنهيت اليوم»، ولا إنجاز يُدخل باليد.</p>
    <p class="muted">الأجزاء تُقاس بمتوسط \${ar(Math.round(AYAHS_PER_JUZ))} آية للجزء (حدود الأجزاء
      غير متساوية في عدد الآيات — تقريب معلوم ومُصرَّح به).</p>
    <p class="muted">لا خطة على «الصفحات»: عدد الصفحات غير مقيس بعد (يأتي مع نمط عرض الصفحات)،
      ولا تُبنى خطة على رقم معدوم.</p>
  </div>\`;
}
function libTo(t){ if(t==='الإعدادات'||t==='حول التطبيق'){ document.getElementById('view').scrollTop=9999; } }
function planPreset(id){ const x=PLAN_PRESETS.find(p=>p.id===id)||PLAN_PRESETS[0]; state.plan={preset:x.id,unit:x.unit,goal:x.goal,days:x.days}; render(); }
function planUnit(u){ state.plan.unit=u; render(); }
function planCalc(){
  const g=Number(el('planGoal').value)||0, d=Number(el('planDays').value)||0;
  state.plan.goal=g; state.plan.days=d;
  const out=el('planDaily'); if(out) out.textContent = ar((g>0&&d>0)?Math.ceil(g/d):0);
}

/* ───────── تفاعلات ───────── */
function openSurah(n){ state.tab='mushaf'; state.surah=n; render(); }
function openCat(id){ state.tab='adhkar'; state.category=id; render(); }
function inc(id, max){ const v=(state.counts[id]||0)+1; state.counts[id]= Math.min(v,max); render(); }
function openAyah(s,a){
  const key = s+':'+a;
  const t = T.tafsir[key];
  const gap = (Q.gaps.ibnkathir||[]).includes(key);
  const ayah = (Q.ayahs[s]||[]).find(x=>x.a===a);
  el('sheet').innerHTML = \`
    <p class="h">آية \${ar(a)} من سورة \${Q.surahs.find(x=>x.n===s).name}</p>
    <p class="quran" style="font-size:130%">\${ayah?ayah.t:''}</p>
    <div class="tools">
      <span class="chip">علامة</span><span class="chip">مفضلة</span><span class="chip">ملاحظة</span><span class="chip">نسخ</span><span class="chip">مشاركة</span>
    </div>
    <p class="muted" style="margin-top:8px">الحفظ الفعلي لهذه الأدوات داخل التطبيق (Realm).</p>
    <hr style="border:0;border-top:1px solid var(--border);margin:14px 0">
    <p class="h">التفسير</p>
    \${t ? \`<p class="tafsir">\${t.ibnkathir ? '<b>ابن كثير:</b><br>'+t.ibnkathir.replace(/\\n/g,'<br>')+(t.baghawi?'<br><br><b>البغوي:</b><br>'+t.baghawi.replace(/\\n/g,'<br>'):'') : (t.baghawi?'<b>البغوي:</b><br>'+t.baghawi.replace(/\\n/g,'<br>'):'')}</p>\`
       : \`<div class="empty">\${gap ? 'لا يتوفر تفسير ابن كثير لهذه الآية في المصدر (فجوة موثقة — لا اختلاق)' : 'هذه المعاينة تحمل عيّنة من التفسير؛ الحزمة الكاملة (ابن كثير ٦٢٠٥ + البغوي ٦٢٣٦) تعمل داخل التطبيق.'}</div>\`}
    <div class="row" style="margin-top:14px"><button class="btn" onclick="closeModal()">إغلاق</button></div>\`;
  el('modal').classList.add('on');
}
function closeModal(){ el('modal').classList.remove('on'); }
el('modal').addEventListener('click', (e)=>{ if(e.target.id==='modal') closeModal(); });

const TITLES = { home:'الرئيسية', mushaf:'المصحف', adhkar:'الأذكار', library:'مكتبتي' };
function render(keepFocus){
  renderTabs();
  const v = el('view');
  const scroll = keepFocus ? v.scrollTop : 0;
  el('title').textContent = TITLES[state.tab];
  el('subtitle').textContent = state.surah!==null ? ('سورة '+Q.surahs.find(x=>x.n===state.surah).name)
    : (state.category!==null ? A.categories.find(x=>x.id===state.category).name : '');
  v.innerHTML = state.tab==='home' ? viewHome()
    : state.tab==='mushaf' ? viewMushaf()
    : state.tab==='adhkar' ? viewAdhkar()
    : viewLibrary();
  v.scrollTop = scroll;
  if (keepFocus){ const i=document.getElementById('q'); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length); } }
}
applyTheme();
render();
</script>
</body>
</html>
`;

writeFileSync(OUT, html, 'utf8');
const sizeMB = (Buffer.byteLength(html, 'utf8') / 1048576).toFixed(2);
console.log(`كُتبت المعاينة: ${path.relative(ROOT, OUT)} — ${sizeMB}MB`);
console.log(`سور: ${surahs.length} · آيات: ${quran.ayahs.length} · أذكار: ${adhkarItems.length}/${categories.length} · عيّنات تفسير: ${Object.keys(tafsirSample).length} · خطوط: ${fonts.length}`);
