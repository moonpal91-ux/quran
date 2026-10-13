# قواعد تسمية المشروع — رفيق القرآن الكريم
# المرجع: مخرجات المرحلة 0 (06-IMPLEMENTATION-PLAN.md)

## اللغة
- **الكود والتعليقات والواجهات الداخلية**: عربي.
- **أسماء الملفات والمعرّفات والمتغيرات**: إنجليزي (lowercase / camelCase).
- **نصوص المحتوى الديني**: كما وردت في المصدر المعتمد، دون أي تعديل أو إعادة صياغة.

## الملفات
- مكوّنات React: PascalCase.tsx — `MushafScreen.tsx`
- ملفات المنطق والبيانات: kebab-case أو camelCase.ts — `bookmark-repository.ts`
- ملفات الاختبارات: `*.test.ts` داخل `tests/`
- المستندات: UPPERCASE-KEBAB.md — `CONTENT-MANIFEST.md`

## المتغيرات والدوال
- دوال: camelCase فعل + اسم — `openAppRealm`, `saveBookmark`
- ثوابت: UPPER_SNAKE_CASE — `USER_SCHEMA_VERSION`, `APP_SETTINGS_ID`
- أنواع TypeScript: PascalCase — `AppSettings`, `GoalUnit`

## قاعدة بيانات Realm
- أسماء الكيانات: PascalCase مطابقة لمسميات 03-REALM-DATABASE-SCHEMA.md
- حقول: camelCase مطابقة للمخطط المنطقي
- معرفات: `string` فريد لكل سجل؛ للآيات يُستخدم `س:أ` بصيغة المصدر عند الربط
- رفع `USER_SCHEMA_VERSION` يتطلب دالة ترحيل صريحة واختبارًا موثقًا

## البنية
| المجلد | المحتوى |
|---|---|
| `src/app` | نقطة الدخول، الإعدادات العامة، التنقل |
| `src/features/*` | وحدات: quran, tafsir, words, adhkar, duas, audio, plans, search, library |
| `src/database/realm` | المخططات والتهيئة والترحيل |
| `src/repositories` | واجهات القراءة/الكتابة (طبقة البيانات) |
| `src/services` | الاستيراد، التحقق، التنزيل، النسخ الاحتياطي |
| `src/design-system` | الألوان والخطوط والمكونات المشتركة |
| `src/localization` | العربية وRTL |
| `tests` | الاختبارات |
| `content` | حزم المحتوى المرخّصة + `CONTENT-MANIFEST.md` |
| `docs` | الوثائق: القيود، الترخيص، أدلة البناء |
