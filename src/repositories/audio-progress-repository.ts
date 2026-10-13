/**
 * مستودع تقدّم الاستماع (المرحلة 6) — «آخر موضع استماع» لكل (قارئ، سورة).
 *
 * القرارات:
 * - مفتاح السجل: `<reciterId>:<surahNumber>` — الاستماع لقارئَين لا يتشارك الموضع.
 * - لا سجل = البداية (آية 1، موضع 0) — لا قيم افتراضية مُخترعة.
 * - `positionMs` مفيد في نمط «السورة الكاملة»؛ `ayahNumber` مفيد في نمط «آية بآية».
 * - الحفظ متكرّر (كل بضع ثوانٍ) لكنه معاملة صغيرة واحدة — لا نص ولا بيانات كبيرة.
 */
import { getOpenAppRealm } from '../database/realm/realm';
import type { Realm } from 'realm';

export interface AudioProgressSnapshot {
  reciterId: string;
  surahNumber: number;
  ayahNumber: number;
  positionMs: number;
  completed: boolean;
  updatedAt: Date | null;
}

export interface AudioProgressRepository {
  /** آخر موضع محفوظ — إن لم يوجد: بداية السورة بلا طابع زمني */
  get(reciterId: string, surahNumber: number): AudioProgressSnapshot;
  /** سجّل موضعًا (يُنشئ أو يحدّث) */
  save(reciterId: string, surahNumber: number, ayahNumber: number, positionMs: number): void;
  /** علّم السورة مكتملة */
  markCompleted(reciterId: string, surahNumber: number): void;
  /** أحدث سجل استماع (لصفحة «تابع استماعك») */
  lastPlayed(): AudioProgressSnapshot | null;
  /** احذف سجل سورة (مثال: حذف التنزيل) */
  remove(reciterId: string, surahNumber: number): void;
  /** كل السجلات مرتبة بالأحدث */
  all(): AudioProgressSnapshot[];
}

function idOf(reciterId: string, surahNumber: number): string {
  return `${reciterId}:${surahNumber}`;
}

interface AudioProgressRow {
  id: string;
  reciterId: string;
  surahNumber: number;
  ayahNumber: number;
  positionMs: number;
  completed: boolean;
  updatedAt: Date;
}

function read(realm: Realm, id: string): AudioProgressRow | null {
  const recs = realm.objects('AudioProgress').filtered('id = $0', id);
  return recs.length > 0 ? (recs[0] as unknown as AudioProgressRow) : null;
}

function toSnapshot(row: AudioProgressRow | null, reciterId: string, surahNumber: number): AudioProgressSnapshot {
  if (!row) {
    return { reciterId, surahNumber, ayahNumber: 1, positionMs: 0, completed: false, updatedAt: null };
  }
  return {
    reciterId: row.reciterId,
    surahNumber: row.surahNumber,
    ayahNumber: row.ayahNumber,
    positionMs: row.positionMs,
    completed: row.completed,
    updatedAt: row.updatedAt,
  };
}

let cached: AudioProgressRepository | null = null;

export function getAudioProgressRepository(): AudioProgressRepository {
  if (cached) return cached;
  cached = {
    get(reciterId, surahNumber) {
      return toSnapshot(read(getOpenAppRealm(), idOf(reciterId, surahNumber)), reciterId, surahNumber);
    },
    save(reciterId, surahNumber, ayahNumber, positionMs) {
      const realm = getOpenAppRealm();
      const id = idOf(reciterId, surahNumber);
      realm.write(() => {
        const row = read(realm, id);
        if (row) {
          row.ayahNumber = ayahNumber;
          row.positionMs = positionMs;
          row.updatedAt = new Date();
        } else {
          realm.create('AudioProgress', {
            id,
            reciterId,
            surahNumber,
            ayahNumber,
            positionMs,
            completed: false,
            updatedAt: new Date(),
          });
        }
      });
    },
    markCompleted(reciterId, surahNumber) {
      const realm = getOpenAppRealm();
      const id = idOf(reciterId, surahNumber);
      realm.write(() => {
        const row = read(realm, id);
        if (row) {
          row.completed = true;
          row.updatedAt = new Date();
        } else {
          realm.create('AudioProgress', {
            id,
            reciterId,
            surahNumber,
            ayahNumber: 1,
            positionMs: 0,
            completed: true,
            updatedAt: new Date(),
          });
        }
      });
    },
    lastPlayed() {
      const rows = Array.from(getOpenAppRealm().objects('AudioProgress').sorted('updatedAt', true)) as unknown as AudioProgressRow[];
      const first = rows[0];
      return first ? toSnapshot(first, first.reciterId, first.surahNumber) : null;
    },
    remove(reciterId, surahNumber) {
      const realm = getOpenAppRealm();
      const id = idOf(reciterId, surahNumber);
      realm.write(() => {
        const row = read(realm, id);
        if (row) realm.delete(row);
      });
    },
    all() {
      const rows = Array.from(getOpenAppRealm().objects('AudioProgress').sorted('updatedAt', true)) as unknown as AudioProgressRow[];
      return rows.map((r) => toSnapshot(r, r.reciterId, r.surahNumber));
    },
  };
  return cached;
}

/** إعادة ضبط المخزن (اختبارات) */
export function _resetAudioProgressRepositoryForTests(): void {
  cached = null;
}
