/**
 * مستودع جلسات القراءة (المرحلة 3) — 03-REALM-DATABASE-SCHEMA (ReadingSession/DailyProgress).
 *
 * قواعد الاحتساب (03-REALM §4 — «لا تعدّ الآية مقروءة بمجرد فتحها؛ حدّد قاعدة واضحة»):
 * R1) الجلسة تبدأ عند أول اختيار متعمد لآية في المصحف (لمس أو انتقال) بعد الإقلاع
 *     أو بعد مغادرة تبويب المصحف — مجرد فتح السورة لا يبدؤها ولا يقرأ آياتها.
 * R2) الآية تُعدّ «مقروءة» عند اختيارها (اختيار متعمد). اختيار الآية نفسها مرتين
 *     في جلسة واحدة يُحتسب مرة واحدة (فريد داخل الجلسة).
 * R3) الجلسة تُسجل في قاعدة البيانات عند بدايتها، وتُحدَّث حيًّا مع كل آية جديدة،
 *     وتُنهى عند مغادرة تبويب المصحف أو إغلاق التطبيق.
 * R4) عند إقلاع التطبيق: أي جلسة غير منتهية (انغلاق التطبيق/سقوط) تُنهي في إقلاع واحد
 *     فقط — لا تكرر سجلات الجلسات عند إعادة الفتح (03-REALM §4 وبوابة 06-مرحلة 3).
 * R5) «الورد اليومي» (DailyProgress.ayahsRead) يزداد بعدد آيات الجلسة الفريدة عند نهايتها،
 *     ويُحسب ليوم بدء الجلسة بالتقويم المحلي. ملاحظة صريحة (حد v1): إعادة قراءة آية
 *     في جلسة مستقلة خلال نفس اليوم تُحتسب قراءة جديدة — الفهرس اليومي للأيات
 *     يُخطط لتحسينه في مراحل لاحقة دون تغيير المخطط.
 * R6) pagesRead = 0 في v1 (احتساب صفحات المصحف المعروضة يأتي مع نمط الصفحات — مرحلة 6).
 *
 * الملف خالٍ من React Native — يُختبر مباشرة على Node.
 */
import { getOpenAppRealm } from '../database/realm/realm';
import type { DailyProgress, ReadingSession } from '../database/realm/types';

/** معرف محلي ثابت دون تبعيات (لا نفترض وجود crypto.randomUUID على كل المنصات) */
let seq = 0;
function localId(prefix: string): string {
  seq = (seq + 1) % 1296;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function todayKey(d: Date = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

class ReadingSessionRepository {
  /** R4: إنهاء الجلسات المفتوحة عند الإقلاع — مرة واحدة، دون تكرار سجلات */
  closeOpenSessions(now: Date = new Date()): number {
    const realm = getOpenAppRealm();
    const open = realm.objects('ReadingSession').filtered('endedAt = NULL') as unknown as ReadingSession[];
    // نثبّت العدد قبل المعاملة: الاستعلام حي يُعاد تقييمه بعد الكتابة فيعود 0
    const count = open.length;
    if (count === 0) return 0;
    const snapshot = open.map((s) => ({
      id: s.id,
      startedAt: new Date(s.startedAt),
      ayahsRead: s.ayahsRead,
    }));
    realm.write(() => {
      for (const s of snapshot) {
        const live = realm.objects('ReadingSession').filtered('id = $0', s.id)[0] as unknown as
          | (ReadingSession & Record<string, unknown>);
        if (!live) continue;
        live.endedAt = now;
        live.durationSeconds = Math.max(0, Math.round((now.getTime() - s.startedAt.getTime()) / 1000));
        // الورد يضاف ليوم بدء الجلسة
        this.addDailyProgress(s.startedAt, s.ayahsRead);
      }
    });
    return count;
  }

  createSession(startSurahNumber: number, startAyahNumber: number, now: Date = new Date()): ReadingSession {
    const realm = getOpenAppRealm();
    const id = localId('rs');
    realm.write(() => {
      realm.create('ReadingSession', {
        id,
        startedAt: now,
        endedAt: null,
        startSurahNumber,
        startAyahNumber,
        endSurahNumber: null,
        endAyahNumber: null,
        pagesRead: 0, // R6
        ayahsRead: 0,
        durationSeconds: 0,
        source: 'reader',
        createdAt: now,
      });
    });
    const created = realm.objects('ReadingSession').filtered('id = $0', id)[0] as unknown as ReadingSession;
    return { ...created };
  }

  /** R3: تحديث حي مع كل آية جديدة (الفريد داخل الجلسة يحسبه المتتبع) */
  updateSessionLive(
    id: string,
    endSurahNumber: number,
    endAyahNumber: number,
    ayahsRead: number,
    now: Date = new Date(),
  ): void {
    const realm = getOpenAppRealm();
    const target = realm.objects('ReadingSession').filtered('id = $0', id)[0] as unknown as
      | (ReadingSession & Record<string, unknown>)
      | undefined;
    if (!target) return;
    realm.write(() => {
      target.endSurahNumber = endSurahNumber;
      target.endAyahNumber = endAyahNumber;
      target.ayahsRead = ayahsRead;
      target.durationSeconds = Math.max(0, Math.round((now.getTime() - target.startedAt.getTime()) / 1000));
    });
  }

  endSession(
    id: string,
    endSurahNumber: number | null,
    endAyahNumber: number | null,
    ayahsRead: number,
    now: Date = new Date(),
  ): ReadingSession | null {
    const realm = getOpenAppRealm();
    const target = realm.objects('ReadingSession').filtered('id = $0', id)[0] as unknown as
      | (ReadingSession & Record<string, unknown>)
      | undefined;
    if (!target) return null;
    const startedAt = new Date(target.startedAt);
    realm.write(() => {
      if (target.endedAt === null || target.endedAt === undefined) {
        target.endedAt = now;
        target.durationSeconds = Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 1000));
      }
      if (endSurahNumber !== null) target.endSurahNumber = endSurahNumber;
      if (endAyahNumber !== null) target.endAyahNumber = endAyahNumber;
      target.ayahsRead = ayahsRead;
      this.addDailyProgress(startedAt, ayahsRead); // R5 — مرة واحدة عند الإنهاء الفعلي
    });
    const final = realm.objects('ReadingSession').filtered('id = $0', id)[0] as unknown as ReadingSession;
    return { ...final };
  }

  listSessions(limit = 50): ReadingSession[] {
    const realm = getOpenAppRealm();
    const all = realm.objects('ReadingSession') as unknown as ReadingSession[];
    return [...all]
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit)
      .map((s) => ({ ...s }));
  }

  getTodayProgress(now: Date = new Date()): DailyProgress | null {
    const realm = getOpenAppRealm();
    const row = realm.objects('DailyProgress').filtered('id = $0', todayKey(now))[0] as unknown as
      | DailyProgress
      | undefined;
    return row ? { ...row } : null;
  }

  private addDailyProgress(date: Date, ayahs: number): void {
    if (ayahs <= 0) return;
    const realm = getOpenAppRealm();
    const key = todayKey(date);
    const existing = realm.objects('DailyProgress').filtered('id = $0', key)[0] as unknown as
      | (DailyProgress & Record<string, unknown>)
      | undefined;
    if (existing) {
      existing.ayahsRead = (existing.ayahsRead ?? 0) + ayahs;
      existing.updatedAt = new Date();
    } else {
      realm.create('DailyProgress', {
        id: key,
        date,
        ayahsRead: ayahs,
        pagesRead: 0,
        audioMinutes: 0,
        adhkarCompleted: 0,
        wordsLearned: 0,
        updatedAt: new Date(),
      });
    }
  }
}

let instance: ReadingSessionRepository | null = null;
export function getReadingSessionRepository(): ReadingSessionRepository {
  if (!instance) instance = new ReadingSessionRepository();
  return instance;
}
