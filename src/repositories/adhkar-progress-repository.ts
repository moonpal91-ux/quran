/**
 * مستودع تقدم الأذكار (المرحلة 5) — بيانات المستخدم في Realm (مخطط v2: DhikrProgress).
 *
 * سجلات مستقلة عن جلسات القراءة (قرار 06-مرحلة 5):
 * - `DhikrProgress` بمفتاح `id = <adhkarId>@<dateKey>` — تقدم يومي لكل ذكر.
 * - `countCompleted` يرتفع بلمس العنصر ويعلو عند `targetCount` (سقف المصدر).
 * - لا أرقام افتراضية: لا سجل = صفر.
 */
import { getOpenAppRealm } from '../database/realm/realm';
import { todayKey } from './reading-session-repository';
import type { Realm } from 'realm';

export interface DhikrProgressRecord {
  id: string;
  contentId: string;
  dateKey: string;
  countCompleted: number;
  targetCount: number;
  updatedAt: Date;
}

export interface AdhkarProgressRepository {
  /** تقدم ذكر اليوم (أو سجل فارغ — لا رقم افتراضي) */
  getToday(adhkarId: string, dateKey?: string): { countCompleted: number; targetCount: number; completed: boolean };
  /** لمسة زيادة (تعلو عند الهدف) — تعيد التقدم الجديد */
  recordDhikr(adhkarId: string, targetCount: number, dateKey?: string): { countCompleted: number; targetCount: number; completed: boolean };
  /** تصفير اليوم */
  resetToday(adhkarId: string, dateKey?: string): void;
  /** ملخص فئة اليوم: { done, total } من سجلات الفئات فقط (الهدف من الحزمة) */
  getCategoryToday(
    items: { id: string; count: number }[],
    dateKey?: string,
  ): { done: number; total: number };
}

function keyOf(adhkarId: string, dateKey: string): string {
  return `${adhkarId}@${dateKey}`;
}

function readRecord(realm: Realm, k: string): DhikrProgressRecord | null {
  const recs = realm.objects('DhikrProgress').filtered('id = $0', k);
  return recs.length > 0 ? (recs[0] as unknown as DhikrProgressRecord) : null;
}

let cached: AdhkarProgressRepository | null = null;

export function getAdhkarProgressRepository(): AdhkarProgressRepository {
  if (cached) return cached;
  cached = {
    getToday(adhkarId: string, dk?: string) {
      const dateKey = dk ?? todayKey();
      const rec = readRecord(getOpenAppRealm(), keyOf(adhkarId, dateKey));
      if (!rec) return { countCompleted: 0, targetCount: 0, completed: false };
      return {
        countCompleted: rec.countCompleted,
        targetCount: rec.targetCount,
        completed: rec.countCompleted >= rec.targetCount,
      };
    },
    recordDhikr(adhkarId: string, targetCount: number, dk?: string) {
      const dateKey = dk ?? todayKey();
      const realm = getOpenAppRealm();
      const k = keyOf(adhkarId, dateKey);
      realm.write(() => {
        const rec = readRecord(realm, k);
        if (rec) {
          rec.countCompleted = Math.min(rec.countCompleted + 1, targetCount);
          rec.targetCount = targetCount;
          rec.updatedAt = new Date();
        } else {
          realm.create('DhikrProgress', {
            id: k,
            contentId: adhkarId,
            dateKey,
            countCompleted: 1,
            targetCount,
            updatedAt: new Date(),
          });
        }
      });
      const after = readRecord(realm, k)!;
      return {
        countCompleted: after.countCompleted,
        targetCount: after.targetCount,
        completed: after.countCompleted >= after.targetCount,
      };
    },
    resetToday(adhkarId: string, dk?: string) {
      const dateKey = dk ?? todayKey();
      const realm = getOpenAppRealm();
      const k = keyOf(adhkarId, dateKey);
      realm.write(() => {
        const recs = realm.objects('DhikrProgress').filtered('id = $0', k);
        for (const rec of recs) realm.delete(rec);
      });
    },
    getCategoryToday(items: { id: string; count: number }[], dk?: string) {
      const dateKey = dk ?? todayKey();
      const realm = getOpenAppRealm();
      let done = 0;
      for (const it of items) {
        const rec = readRecord(realm, keyOf(it.id, dateKey));
        if (rec && rec.countCompleted >= it.count) done += 1;
      }
      return { done, total: items.length };
    },
  };
  return cached;
}

/** إعادة ضبط المخزن (اختبارات) */
export function _resetAdhkarProgressRepositoryForTests(): void {
  cached = null;
}
