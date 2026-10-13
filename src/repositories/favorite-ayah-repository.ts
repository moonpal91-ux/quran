/**
 * مستودع الآيات المفضلة — مفتاح مركب (سورة، آية) يمنع التكرار.
 * المرجع: 02-ARCHITECTURE.md (القسم 5) و 03 (قواعد الاتساق)
 */
import { getOpenAppRealm } from '../database/realm/realm';
import type { FavoriteAyah } from '../database/realm/types';

export interface FavoriteAyahInput {
  surahNumber: number;
  ayahNumber: number;
}

const SURAH_MIN = 1;
const SURAH_MAX = 114;
const AYAH_MAX = 286;

class FavoriteAyahRepository {
  validate(input: FavoriteAyahInput): void {
    const { surahNumber, ayahNumber } = input;
    if (!Number.isInteger(surahNumber) || surahNumber < SURAH_MIN || surahNumber > SURAH_MAX) {
      throw new Error(`رقم السورة خارج النطاق: ${surahNumber}`);
    }
    if (!Number.isInteger(ayahNumber) || ayahNumber < 1 || ayahNumber > AYAH_MAX) {
      throw new Error(`رقم الآية خارج النطاق: ${ayahNumber}`);
    }
  }

  async list(): Promise<FavoriteAyah[]> {
    const realm = getOpenAppRealm();
    const all = realm.objects('FavoriteAyah') as unknown as FavoriteAyah[];
    return all.map((f) => ({ ...f })) as FavoriteAyah[];
  }

  async exists(surahNumber: number, ayahNumber: number): Promise<boolean> {
    const realm = getOpenAppRealm();
    const found = realm
      .objects('FavoriteAyah')
      .filtered('surahNumber = $0 AND ayahNumber = $1', surahNumber, ayahNumber);
    return found.length > 0;
  }

  async add(input: FavoriteAyahInput): Promise<FavoriteAyah> {
    this.validate(input);
    const realm = getOpenAppRealm();
    if (await this.exists(input.surahNumber, input.ayahNumber)) {
      throw new Error('هذه الآية في المفضلة بالفعل');
    }
    const now = new Date();
    const id = `fav-${input.surahNumber}:${input.ayahNumber}-${now.getTime()}`;
    realm.write(() => {
      realm.create('FavoriteAyah', {
        id,
        surahNumber: input.surahNumber,
        ayahNumber: input.ayahNumber,
        createdAt: now,
      });
    });
    const found = realm.objects('FavoriteAyah').filtered('id = $0', id)[0] as unknown as
      | FavoriteAyah
      | undefined;
    if (!found) {
      throw new Error('فشل حفظ الآية في المفضلة');
    }
    return { ...found };
  }

  async remove(id: string): Promise<void> {
    const realm = getOpenAppRealm();
    const target = realm.objects('FavoriteAyah').filtered('id = $0', id)[0];
    if (target) {
      realm.write(() => {
        realm.delete(target);
      });
    }
  }
}

let instance: FavoriteAyahRepository | null = null;

export function getFavoriteAyahRepository(): FavoriteAyahRepository {
  if (!instance) {
    instance = new FavoriteAyahRepository();
  }
  return instance;
}
