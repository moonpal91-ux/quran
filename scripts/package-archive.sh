#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# حزم أرشيف تسليم كامل (ZIP) لبدء محادثة تنفيذ جديدة.
#
# يُضمَّن: الشيفرة + المحتوى المُعتمد + الوثائق + التقارير + android/ + لقطات QA
#          + ملف التسليم الشامل (HANDOFF-*.md) + معاينة HTML + أدوات البناء.
# يُستثنى: node_modules, .git, .test-build, .bootstrap-out, dist, الأرشيفات السابقة.
#
# الاستدعاء: bash scripts/package-archive.sh [اسم_الملف.zip]
# ═════════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
STAMP="$(date +%F)"
OUT="${1:-$ROOT/quran-companion-$STAMP.zip}"
HANDOFF="$(ls -t "$ROOT"/HANDOFF-*.md 2>/dev/null | head -1)"

echo "== تجهيز قائمة الملفات =="
LIST=$(mktemp)
git ls-files > "$LIST" 2>/dev/null || true
# ملفات غير متتبعة لكنها مطلوبة (أدوات/أصول/معاينات) ولا تُستثنى
for extra in app-preview.html pwa-app.html assets tools android public; do
  [ -e "$extra" ] && find "$extra" -type f >> "$LIST" || true
done
[ -n "$HANDOFF" ] && echo "${HANDOFF#$ROOT/}" >> "$LIST"

# استثناءات
FILTERED=$(mktemp)
sort -u "$LIST" | grep -v -E '^(node_modules|\.git|\.test-build/|\.bootstrap-out/|dist/|web-build/)' \
  | grep -v -E '\.zip$' > "$FILTERED" || true

echo "== عدد الملفات: $(wc -l < "$FILTERED") =="
rm -f "$OUT"
zip -q -X -r "$OUT" . -i@"$FILTERED"
rm -f "$LIST" "$FILTERED"

echo "== الأرشيف: $OUT =="
ls -lh "$OUT" | awk '{print $5, $9}'
echo "== محتوياته (أول 20) =="
unzip -l "$OUT" | head -24
