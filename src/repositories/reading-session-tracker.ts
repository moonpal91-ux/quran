/**
 * متتبع جلسة القراءة النشطة — Singleton وقت التشغيل (المرحلة 3).
 * يطبّق قواعد R1–R3 الموثقة في reading-session-repository.ts:
 * - تبدأ الجلسة عند أول اختيار متعمد لآية (startIfNeeded).
 * - يُحتسب فريد (سورة، آية) داخل الجلسة (markRead).
 * - تُنهي الجلسة (end) فتُسجل نهائيًا وتُضاف للورد اليومي — مرة واحدة.
 *
 * بلا اعتمادات React Native — يُختبر على Node.
 */
import { getReadingSessionRepository } from './reading-session-repository';

interface ActiveSession {
  id: string;
  readIds: Set<string>;
  lastSurah: number;
  lastAyah: number;
}

class ReadingSessionTracker {
  private active: ActiveSession | null = null;

  get isActive(): boolean {
    return this.active !== null;
  }

  /** R1: لا جلسة دون اختيار متعمد أول — فتح السورة وحدها لا يبدأها */
  startIfNeeded(surahNumber: number, ayahNumber: number, now: Date = new Date()): void {
    if (this.active) return;
    const repo = getReadingSessionRepository();
    const session = repo.createSession(surahNumber, ayahNumber, now);
    this.active = { id: session.id, readIds: new Set(), lastSurah: surahNumber, lastAyah: ayahNumber };
    repo.updateSessionLive(session.id, surahNumber, ayahNumber, 0, now);
  }

  /** R2: اختيار الآية = قراءة؛ الفريد داخل الجلسة */
  markRead(surahNumber: number, ayahNumber: number, now: Date = new Date()): void {
    if (!this.active) this.startIfNeeded(surahNumber, ayahNumber, now);
    const a = this.active;
    if (!a) return;
    a.readIds.add(`${surahNumber}:${ayahNumber}`);
    a.lastSurah = surahNumber;
    a.lastAyah = ayahNumber;
    getReadingSessionRepository().updateSessionLive(a.id, surahNumber, ayahNumber, a.readIds.size, now);
  }

  /** R3/R5: إنهاء الجلسة نهائيًا — مرة واحدة؛ يعيد عدد الآيات المحتسبة */
  end(now: Date = new Date()): number {
    if (!this.active) return 0;
    const a = this.active;
    this.active = null;
    const count = a.readIds.size;
    getReadingSessionRepository().endSession(a.id, a.lastSurah, a.lastAyah, count, now);
    return count;
  }

  /** بيئة اختبار فقط */
  reset(): void {
    this.active = null;
  }
}

let instance: ReadingSessionTracker | null = null;
export function getReadingSessionTracker(): ReadingSessionTracker {
  if (!instance) instance = new ReadingSessionTracker();
  return instance;
}
