#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════════
// مولّد أيقونات التطبيق الرسمية (من تصميم المشروع نفسه — بلا أي اعتماد خارجي)
//
// الفكرة التصميمية (هوية واحدة مع أيقونات PWA):
//   • أرضية: أخضر عميق #145A46 (لون العلامة في نظام التصميم)
//   • حلقة ذهبية #C7A45D ترمز للمصحف، وهلال داخلها يرمز للبداية والهدي
//   • لا رسم تشخيصي، ولا نص داخل الأيقونة — مقروءة عند 48px و1024px
//
// المخرجات (تطابق أسماء HANDOFF §8 / app.json):
//   assets/icon.png 1024            — أيقونة التطبيق (مربّعة بحواف دائرية)
//   assets/splash-icon.png 1024     — شعار شاشة الإقلاع (شفاف، بمساحة أمان)
//   assets/android-icon-background.png 1024 — طبقة الخلفية (أخضر ممتد)
//   assets/android-icon-foreground.png 1024 — طبقة الواجهة (فنّ شفاف 62٪)
//   assets/android-icon-monochrome.png 1024 — نسخة أحادية (أبيض) للأيقونات المُلوَّنة
//   assets/favicon.png 48           — أيقونة المتصفح
//
// الاستدعاء: node scripts/generate-app-icons.mjs
// ═════════════════════════════════════════════════════════════════════════════
import { mkdirSync, existsSync, statSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawIcon, writePng } from './generate-pwa-icons.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'assets');
const SS = 4;

// ── رسم طبقة «فنّ فقط» (بلا أرضية): حلقة + هلال، بلون قابل للتحديد ──────────
function drawArt(size, color, scale) {
  const buf = Buffer.alloc(size * size * 4);
  const inCircle = (u, v, cx, cy, r) => (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cov = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const pxX = x + (sx + 0.5) / SS;
          const pxY = y + (sy + 0.5) / SS;
          const u = (pxX - size / 2) / size / scale;
          const v = (pxY - size / 2) / size / scale;
          const ring = inCircle(u, v, 0, 0, 0.360) && !inCircle(u, v, 0, 0, 0.313);
          const crescent =
            inCircle(u, v, 0.010, 0.020, 0.250) && !inCircle(u, v, 0.098, -0.030, 0.215);
          if (ring || crescent) cov++;
        }
      }
      const a = cov / (SS * SS);
      const i = (y * size + x) * 4;
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = Math.round(a * 255);
    }
  }
  return buf;
}

// ── طبقة لون مصمتة ───────────────────────────────────────────────────────────
function drawSolid(size, color) {
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    buf[i * 4] = color[0];
    buf[i * 4 + 1] = color[1];
    buf[i * 4 + 2] = color[2];
    buf[i * 4 + 3] = 255;
  }
  return buf;
}

const GREEN = [0x14, 0x5a, 0x46];
const GOLD = [0xc7, 0xa4, 0x5d];
const WHITE = [0xff, 0xff, 0xff];

const TARGETS = [
  {
    file: 'icon.png',
    size: 1024,
    px: () => drawIcon(1024, { radius: 0.22 }),
    note: 'أيقونة التطبيق (حواف دائرية 22٪)',
  },
  {
    file: 'splash-icon.png',
    size: 1024,
    // الشعار على أرضية شفافة داخل مساحة أمان (70٪) ليكون آمنًا على كل الشاشات
    px: () => {
      const bg = drawSolid(1024, GREEN);
      const art = drawArt(1024, GOLD, 0.70);
      // دمج الفنّ فوق قرص أخضر مُدوَّر قطره 70٪ (خلفية الشعار)
      const S = 1024;
      const out = Buffer.alloc(S * S * 4);
      const discR = S * 0.35;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = (y * S + x) * 4;
          const inDisc = (x - S / 2) ** 2 + (y - S / 2) ** 2 <= discR * discR;
          const aBg = inDisc ? 255 : 0;
          const aArt = art[i + 3];
          const a = Math.max(aBg / 255, aArt / 255);
          const srcA = aArt > 0 ? art : bg;
          out[i] = srcA[i];
          out[i + 1] = srcA[i + 1];
          out[i + 2] = srcA[i + 2];
          out[i + 3] = Math.round(a * 255);
        }
      }
      return out;
    },
    note: 'شعار الإقلاع: قرص أخضر + فنّ ذهبي، شفاف حوله',
  },
  {
    file: 'android-icon-background.png',
    size: 1024,
    px: () => drawSolid(1024, GREEN),
    note: 'طبقة الخلفية لأيقونة Android التكيفية',
  },
  {
    file: 'android-icon-foreground.png',
    size: 1024,
    px: () => drawArt(1024, GOLD, 0.62),
    note: 'طبقة الواجهة (داخل منطقة الأمان 66٪)',
  },
  {
    file: 'android-icon-monochrome.png',
    size: 1024,
    px: () => drawArt(1024, WHITE, 0.62),
    note: 'نسخة أحادية للأيقونات المُلوَّنة بنظام Android',
  },
  { file: 'favicon.png', size: 48, px: () => drawIcon(48, { radius: 0.22 }), note: 'أيقونة المتصفح' },
];

const isMain = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  mkdirSync(ASSETS, { recursive: true });
  console.log('== أيقونات التطبيق الرسمية (تصميم المشروع) ==');
  const force = process.argv.includes('--force');
  let made = 0;
  let skipped = 0;
  for (const t of TARGETS) {
    const target = join(ASSETS, t.file);
    // حماية: لا نستبدل أيقونة أصلية (من BIN-RAW) إلا بطلب صريح --force
    if (existsSync(target) && !force) {
      console.log(`  ~ تخطّي (موجود): assets/${t.file} — استخدم --force للاستبدال`);
      skipped++;
      continue;
    }
    const bytes = writePng(target, t.size, t.size, t.px());
    const kb = (bytes / 1024).toFixed(1);
    console.log(`  assets/${t.file.padEnd(32)} ${t.size}×${t.size} — ${kb}KB — ${t.note}`);
    made++;
  }
  console.log(`\nأُنتج: ${made} · تُخطّي: ${skipped}`);
  console.log('الخطوة التالية: npx expo prebuild --platform android (إن لزم إعادة توليد android/)');
}
