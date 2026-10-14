#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# تجزئة المشروع إلى أرشيفات صغيرة قابلة للتحميل كلٌّ على حدة.
#
# الغرض: حين يتعذّر تحميل الأرشيف الكامل (24MB) دفعة واحدة، تُحمَّل الأجزاء
# منفردة وتُفكّ كلها في مجلد واحد فتتكوّن الشجرة الأصلية كاملة.
#
# الاستدعاء: bash scripts/package-parts.sh [مجلد_الإخراج]
# ═════════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
STAMP="$(date +%F)"
OUT="${1:-$ROOT/parts-$STAMP}"
mkdir -p "$OUT"

part() { # part <اسم> <مسارات...>
  local name="$1"; shift
  local list; list=$(mktemp)
  for p in "$@"; do [ -e "$p" ] && find "$p" -type f >> "$list" || true; done
  sort -u "$list" > "$list.s"
  local n; n=$(wc -l < "$list.s" | tr -d ' ')
  rm -f "$OUT/$name.zip"
  zip -q -X -r "$OUT/$name.zip" . -i@"$list.s"
  rm -f "$list" "$list.s"
  printf "  %-34s %4s ملف  %s\n" "$name.zip" "$n" "$(du -h "$OUT/$name.zip" | cut -f1)"
}

echo "== تجزئة المشروع → $OUT =="

part "1-code"      src App.tsx index.ts app.json package.json package-lock.json \
                   tsconfig.json tsconfig.test.json AGENTS.md LICENSE scripts tests
part "2-docs"      docs HANDOFF.md HANDOFF-*.md PROMPT-NEW-SESSION.md \
                   STAGE-PROGRESS.md START-HERE.md \
                   content/CONTENT-MANIFEST.md content/IMPORT-REPORT.md \
                   content/QA-IMPORT-REPORT.md content/ADHKAR-IMPORT-REPORT.md \
                   content/AUDIO-CATALOG.md content/validation-report.json
part "3-quran"     content/quran-data.json content/quran-uthmani.txt \
                   content/refs/tanzil-mirror-v1.1.txt \
                   content/refs/quran-metadata-tanzil-v1.0.xml
part "4-tafsir"    content/tafsir-data.json content/refs/tafsir
part "5-adhkar"    content/adhkar-data.json content/refs/adhkar \
                   content/refs/audio content/audio-catalog.json
part "6-assets"    assets public preview-screenshots
part "7-preview"   app-preview.html pwa-app.html
part "8-native"    android tools

echo ""
echo "== الإجمالي =="
du -sh "$OUT"
echo ""
echo "للتركيب: فكّ كل الأجزاء في مجلد واحد (تتكوّن الشجرة الأصلية):"
echo "  mkdir quran && cd quran && unzip -o ../*/1-code.zip && ... إلخ"
