#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════════
// مولّد أيقونات PWA — بلا أي اعتماد خارجي (zlib من Node فقط)
//
// يرسم الأيقونات من ألوان نظام التصميم في src/design-system/tokens.ts:
//   أخضر عميق #145A46 (خلفية) + ذهبي #C7A45D (هلال وحلقة)
// الشكل: هلال داخل حلقة — رمز محايد غير تشخيصي، مقروء على 192px.
//
// الاستدعاء: node scripts/generate-pwa-icons.mjs
// المخرجات: public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon,favicon-32}.png
//
// ملاحظة: هذه أيقونات «بديلة» إلى حين وصول أصول التصميم الأصلية (BIN-RAW.md).
// استبدالها = وضع PNGs بنفس الأسماء في public/icons/ (أو حذفها وإعادة التشغيل).
// ═════════════════════════════════════════════════════════════════════════════
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'icons');

// ───────────────────────── كتابة PNG (RGBA) ─────────────────────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function writePng(file, w, h, rgba) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // فلتر: None
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // عمق البت
  ihdr[9] = 6;   // نوع اللون: RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, png);
  return png.length;
}

// ───────────────────────── الرسم ─────────────────────────
const GREEN = [0x14, 0x5a, 0x46];
const GOLD = [0xc7, 0xa4, 0x5d];
const SS = 4;                       // عيّنات فرعية لكل بُعد (تنعيم الحواف)
const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

/**
 * @param {number} size          طول الضلع بالبكسل
 * @param {object} opts
 * @param {boolean} opts.maskable هامش أمان 80٪ وخلفية ممتلئة (Android adaptive)
 * @param {number} [opts.radius]  نسبة تدوير الزوايا (0 = مربع كامل)
 */
function drawIcon(size, { maskable = false, radius = 0.22 } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const S = size;
  const artScale = maskable ? 0.60 : 1;      // تصغير الفن داخل منطقة الأمان
  const bgRadius = maskable ? 0 : radius * S;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // تنعيم: معدّل تغطية الخلفية + الهلال + الحلقة
      let bgCov = 0, ringCov = 0, crescentCov = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const pxX = x + (sx + 0.5) / SS;
          const pxY = y + (sy + 0.5) / SS;
          if (inRoundRect(pxX, pxY, 0, 0, S, S, bgRadius)) bgCov++;
          // إحداثيات فنية مُطبَّعة حول المركز
          const u = (pxX - S / 2) / S / artScale;     // −0.5..0.5
          const v = (pxY - S / 2) / S / artScale;
          const inside = (cx, cy, r) => inCircle(u, v, cx, cy, r);
          const inRing = inside(0, 0, 0.360) && !inside(0, 0, 0.313);
          const inCrescent = inside(0.010, 0.020, 0.250) && !inside(0.098, -0.030, 0.215);
          if (inRing) ringCov++;
          if (inCrescent) crescentCov++;
        }
      }
      const n = SS * SS;
      const aBg = bgCov / n;
      const aRing = (ringCov / n) * aBg;
      const aCres = (crescentCov / n) * aBg;
      // دمج: خلفية ← حلقة ذهبية ← هلال ذهبي
      let r = GREEN[0], g = GREEN[1], b = GREEN[2], a = aBg;
      const blend = (cov) => {
        r = Math.round(r * (1 - cov) + GOLD[0] * cov);
        g = Math.round(g * (1 - cov) + GOLD[1] * cov);
        b = Math.round(b * (1 - cov) + GOLD[2] * cov);
        a = Math.max(a, cov);
      };
      blend(aRing);
      blend(aCres);
      const i = (y * S + x) * 4;
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = Math.round(a * 255);
    }
  }
  return px;
}

const TARGETS = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, { radius: 0 }],
  ['favicon-32.png', 32, {}],
];

console.log('== أيقونات PWA (من ألوان نظام التصميم) ==');
for (const [name, size, opts] of TARGETS) {
  const bytes = writePng(join(OUT, name), size, size, drawIcon(size, opts));
  console.log(`  public/icons/${name} — ${size}×${size} — ${(bytes / 1024).toFixed(1)}KB`);
}
console.log('بديلة حتى وصول أصول التصميم الأصلية (BIN-RAW.md).');
