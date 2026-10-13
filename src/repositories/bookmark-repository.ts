/**
 * مستودع العلامات المرجعية — المرجع: 02-ARCHITECTURE.md (القسم 5) و 03 (قواعد الاتساق)
 * - مفتاح مركب (سورة، آية) يمنع التكرار غير المقصود.
 * - تحقق من حدود السورة/الآية (1..114 و 1..286 — الحدود الدقيقة تُفحص ببيانات المصدر في المرحلة 2).
 */
import { getOpenAppRealm } from '../database/realm/realm';
import type { Bookmark } from '../database/realm/types';

export interface BookmarkInput {
  surahNumber: number;
  ayahNumber: number;
  label?: string | null;
}

const SURAH_MIN = 1;
const SURAH_MAX = 114;
const AYAH_MAX = 286; // أكبر آية في المصحف (2:255..2:286)

class BookmarkRepository {
  validate(input: BookmarkInput): void {
    const { surahNumber, ayahNumber } = input;
    if (!Number.isInteger(surahNumber) || surahNumber < SURAH_MIN || surahNumber > SURAH_MAX) {
      throw new Error(`رقم السورة خارج النطاق: ${surahNumber}`);
    }
    if (!Number.isInteger(ayahNumber) || ayahNumber < 1 || ayahNumber > AYAH_MAX) {
      throw new Error(`رقم الآية خارج النطاق: ${ayahNumber}`);
    }
  }

  async list(): Promise<Bookmark[]> {
    const realm = getOpenAppRealm();
    const all = realm.objects('Bookmark') as unknown as Bookmark[];
    return all.map((b) => ({ ...b })) as Bookmark[];
  }

  async exists(surahNumber: number, ayahNumber: number): Promise<boolean> {
    const realm = getOpenAppRealm();
    const found = realm
      .objects('Bookmark')
      .filtered('surahNumber = $0 AND ayahNumber = $1', surahNumber, ayahNumber);
    return found.length > 0;
  }

  /** يضيف علامة جديدة؛ يرفض الموضع المكرر (قاعدة اتساق 03-4) */
  async add(input: BookmarkInput): Promise<Bookmark> {
    this.validate(input);
    const realm = getOpenAppRealm();
    if (await this.exists(input.surahNumber, input.ayahNumber)) {
      throw new Error('توجد علامة مرجعية على هذا الموضع بالفعل');
    }
    const now = new Date();
    const id = `bm-${input.surahNumber}:${input.ayahNumber}-${now.getTime()}`;
    realm.write(() => {
      realm.create('Bookmark', {
        id,
        surahNumber: input.surahNumber,
        ayahNumber: input.ayahNumber,
        label: input.label ?? null,
        createdAt: now,
        updatedAt: now,
      });
    });
    const saved = this.byId(id);
    if (!saved) {
      throw new Error('فشل حفظ العلامة');
    }
    return saved;
  }

  /** يحدّث التسمية (أو يمسحها بـ null) ويعيد النسخة المحدّثة */
  async updateLabel(id: string, label: string | null): Promise<Bookmark> {
    const realm = getOpenAppRealm();
    const target = realm.objects('Bookmark').filtered('id = $0', id)[0] as unknown as
      | (Bookmark & Record<string, unknown>)
      | undefined;
    if (!target) {
      throw new Error('العلامة غير موجودة');
    }
    const now = new Date();
    realm.write(() => {
      target.label = label && label.trim() ? label.trim() : null;
      target.updatedAt = now;
    });
    const saved = this.byId(id);
    if (!saved) {
      throw new Error('فشل حفظ التسمية');
    }
    return saved;
  }

  private byId(id: string): Bookmark | null {
    const realm = getOpenAppRealm();
    const found = realm.objects('Bookmark').filtered('id = $0', id)[0] as unknown as
      | Bookmark
      | undefined;
    return found ? { ...found } : null;
  }

  async remove(id: string): Promise<void> {
    const realm = getOpenAppRealm();
    const target = realm.objects('Bookmark').filtered('id = $0', id)[0];
    if (target) {
      realm.write(() => {
        realm.delete(target);
      });
    }
  }
}

let instance: BookmarkRepository | null = null;

export function getBookmarkRepository(): BookmarkRepository {
  if (!instance) {
    instance = new BookmarkRepository();
  }
  return instance;
}
