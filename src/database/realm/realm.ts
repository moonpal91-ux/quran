/**
 * تهيئة قاعدة بيانات المستخدم المحلية (Realm) وإدارتها.
 * المرجع: 02-ARCHITECTURE.md (القسم 2 و7 و8) و 03-REALM-DATABASE-SCHEMA.md
 *
 * اختيار الحزمة حسب المنصة عبر ملفات منصة React Native (realm-ctor.*):
 * - Android/iOS (realm-ctor.native.ts): حزمة realm الأصلية.
 * - Web (realm-ctor.web.ts — معاينة فقط): محوّل تخزين المتصفح خلف الواجهات نفسها
 *   وفق 02-§7 — لا يُدَّعى أن نسخة الويب تخزن في Realm.
 * - Node/اختبارات (realm-ctor.ts): حزمة realm الأصلية (نفس إصدار React Native).
 *
 * ملاحظة توافق (تحقق المرحلة 0 — realm 20.2.0):
 * - دالة الترحيل تُمرر عبر `onMigration` (وليس `migration` في الإصدارات القديمة).
 * - لا يوجد `onFirstLaunch` في الإصدار 20؛ يُكتشف أول تشغيل بمقارنة الإصدار قبل الفتح.
 * - لا توجد `realm.object(type, key)`؛ الجلب بالمفتاح عبر `objects(type).filtered('id = $0', key)`.
 *
 * قواعد صارمة:
 * - الفتح مرة واحدة لكل جلسة تشغيل، والكتابة داخل معاملات فقط عبر repositories.
 * - فشل الفتح أو الترحيل يُعرض للمستخدم برسالة واضحة ولا يُخفى.
 * - الترحيل: أي إصدار قادم يجب أن يحمل منطقًا صريحًا داخل onMigration ويُختبر قبل اعتماده.
 */
import { userSchemas, USER_SCHEMA_VERSION, APP_DB_PATH } from './schemas';
import { getRealmCtor } from './realm-ctor';
import type { Realm } from 'realm';

let appRealm: Realm | null = null;

export interface RealmOpenError {
  stage: 'open' | 'migrate' | 'unknown';
  message: string;
}

/**
 * افتح قاعدة بيانات المستخدم.
 * @param path مسار مطلق (للاختبارات على Node)؛ إن حُذف يُستخدم المسار الافتراضي
 *          على الجهاز (يُحله Realm داخل مساحة التخزين الخاصة بالتطبيق).
 */
export async function openAppRealm(path?: string): Promise<Realm> {
  if (appRealm) {
    return appRealm;
  }
  const RealmCtor = getRealmCtor();
  const targetPath = path ?? APP_DB_PATH;
  const isFirstLaunch = !RealmCtor.exists(targetPath);
  try {
    const realm = await RealmCtor.open({
      path: targetPath,
      schema: userSchemas,
      schemaVersion: USER_SCHEMA_VERSION,
      onMigration: (oldRealm: unknown, newRealm: unknown) => {
        const o = oldRealm as { schemaVersion?: number };
        const n = newRealm as {
          schemaVersion?: number;
          write(cb: () => void): void;
          objects(name: string): Iterable<Record<string, unknown>>;
        };
        // 1 → 2: إضافة mushafBg إلى AppSettings (الافتراضي: 'theme' — يتبع السمة)
        // الترحيل يعمل داخل معاملة كتابة ضمنية — التعديل المباشر يكفي (لا write() هنا)
        if (o.schemaVersion !== undefined && o.schemaVersion < 2) {
          const recs = Array.from(n.objects('AppSettings'));
          for (const rec of recs) {
            rec.mushafBg = 'theme';
          }
        }
        // 2 → 3: حقول الصوت الاختيارية في AppSettings (المرحلة 6)
        // الحقول الاختيارية جديدة بالكامل — القيم الافتراضية تُضبط صراحةً
        // حتى لا يبقى أي سجل قديم بلا قيمة (لا `undefined` في Realm).
        if (o.schemaVersion !== undefined && o.schemaVersion < 3) {
          const recs = Array.from(n.objects('AppSettings'));
          for (const rec of recs) {
            // ملاحظة مقيسة: Realm يُرجع `null` (لا `undefined`) للحقل الاختياري
            // المضاف حديثًا على سجل قديم — لذا الفحص يجب أن يغطي الاثنين.
            if (rec.preferredReciterId == null) rec.preferredReciterId = null;
            if (rec.audioBitrate == null) rec.audioBitrate = '128';
            if (rec.audioPlaybackRate == null) rec.audioPlaybackRate = 1.0;
            if (rec.audioRepeatMode == null) rec.audioRepeatMode = 'off';
            if (rec.audioMode == null) rec.audioMode = 'surah';
          }
        }
        console.warn(`[realm] ترحيل المخطط من ${o.schemaVersion} إلى ${n.schemaVersion}`);
      },
    });
    appRealm = realm;
    if (isFirstLaunch) {
      console.info('[realm] قاعدة البيانات أُنشئت لأول مرة');
    }
    return realm;
  } catch (e) {
    appRealm = null;
    const message = e instanceof Error ? e.message : String(e);
    const stage: RealmOpenError['stage'] = /migrat/i.test(message) ? 'migrate' : 'open';
    throw { stage, message } satisfies RealmOpenError;
  }
}

/** أعد قاعدة البيانات المفتوحة (إن وُجدت) */
export function closeAppRealm(): void {
  if (appRealm) {
    appRealm.close();
    appRealm = null;
  }
}

/** القاعدة المفتوحة حاليًا — تُستخدم داخليًا من repositories فقط */
export function getOpenAppRealm(): Realm {
  if (!appRealm) {
    throw new Error('قاعدة البيانات غير مفتوحة — استُدعي المستودع قبل openAppRealm()');
  }
  return appRealm;
}
