# الخطوط المضمّنة — التراخيص والتحقق
# المرجع: 04-UX-UI-SPEC.md (القسم 3) — لا يُفترض خط الواجهة مناسبًا للرسم العثماني

## الخطوط
| الخط | الاستخدام | المصدر | الترخيص |
|---|---|---|---|
| Tajawal (Regular/Medium/Bold) | واجهة التطبيق | google/fonts — Boutros International (2017) | SIL Open Font License 1.1 |
| Amiri Quran | نص المصحف (الرسم العثماني) | aliftype/amiri — Amiri Project (Khaled Hosny) | SIL Open Font License 1.1 |

## الملفات
- `assets/fonts/Tajawal-Regular.ttf` (60,364 بايت)
- `assets/fonts/Tajawal-Medium.ttf` (62,280 بايت)
- `assets/fonts/Tajawal-Bold.ttf` (59,988 بايت)
- `assets/fonts/AmiriQuran.ttf` (167,976 بايت)

## التحقق
- الملفات صالحة TrueType (فُحص رأس الملف وتوقيع «TrueType Font data»).
- Amiri Quran مصمم خصيصًا للرسم العثماني (حرف الالف الواسلة ٱ، التطويل، التشكيل المزدوج) — الاختبار البصري الكامل للحروف المتصلة والتشكيل وعلامات الوقف يُنفَّذ على المنصات المستهدفة (متطلب 04-3) ويُسجَّل في اختبارات المصحف (المرحلة 2) واختبارات UX (المرحلة 7).

## الالتزامات
- تبقى ملفات الخطوط مع التطبيق الموزَّع (المشروع يعمل دون اتصال).
- يُحفظ نص الترخيص OFL في ملفات الخطوط الأصلية؛ يُعاد النشر تحت شروط OFL 1.1 نفسها.
