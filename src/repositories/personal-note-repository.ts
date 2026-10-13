/**
 * مستودع الملاحظات الشخصية — المرجع: 02-ARCHITECTURE.md (القسم 5) و 03-REALM-DATABASE-SCHEMA.md
 * الملاحظة مرتبطة بسورة (وجزئيًا بآية)، وتُخزن محليًا فقط ولا تُرسل لأي خدمة خارجية (02-8).
 */
import { getOpenAppRealm } from '../database/realm/realm';
import type { PersonalNote } from '../database/realm/types';

export interface NoteInput {
  surahNumber: number;
  ayahNumber?: number | null;
  title?: string | null;
  body: string;
  tags?: string[];
}

const SURAH_MIN = 1;
const SURAH_MAX = 114;
const AYAH_MAX = 286;

class PersonalNoteRepository {
  validate(input: NoteInput): void {
    if (!Number.isInteger(input.surahNumber) || input.surahNumber < SURAH_MIN || input.surahNumber > SURAH_MAX) {
      throw new Error(`رقم السورة خارج النطاق: ${input.surahNumber}`);
    }
    if (input.ayahNumber !== null && input.ayahNumber !== undefined) {
      if (!Number.isInteger(input.ayahNumber) || (input.ayahNumber as number) < 1 || (input.ayahNumber as number) > AYAH_MAX) {
        throw new Error(`رقم الآية خارج النطاق: ${input.ayahNumber}`);
      }
    }
    if (!input.body || !input.body.trim()) {
      throw new Error('نص الملاحظة فارغ');
    }
  }

  async list(): Promise<PersonalNote[]> {
    const realm = getOpenAppRealm();
    const all = realm.objects('PersonalNote') as unknown as PersonalNote[];
    return all.map((n) => ({ ...n })) as PersonalNote[];
  }

  async add(input: NoteInput): Promise<PersonalNote> {
    this.validate(input);
    const realm = getOpenAppRealm();
    const now = new Date();
    const id = `note-${input.surahNumber}-${now.getTime()}`;
    realm.write(() => {
      realm.create('PersonalNote', {
        id,
        surahNumber: input.surahNumber,
        ayahNumber: input.ayahNumber ?? null,
        title: input.title ?? null,
        body: input.body,
        tags: input.tags ?? [],
        createdAt: now,
        updatedAt: now,
      });
    });
    const found = realm.objects('PersonalNote').filtered('id = $0', id)[0] as unknown as
      | PersonalNote
      | undefined;
    if (!found) {
      throw new Error('فشل حفظ الملاحظة');
    }
    return { ...found };
  }

  async update(id: string, input: Partial<NoteInput>): Promise<PersonalNote> {
    const realm = getOpenAppRealm();
    const target = realm.objects('PersonalNote').filtered('id = $0', id)[0] as unknown as
      | PersonalNote
      | undefined;
    if (!target) {
      throw new Error('الملاحظة غير موجودة');
    }
    if (input.body !== undefined && !input.body.trim()) {
      throw new Error('نص الملاحظة فارغ');
    }
    realm.write(() => {
      const t = target as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(input)) {
        if (value !== undefined) {
          t[key] = value;
        }
      }
      t.updatedAt = new Date();
    });
    return { ...target } as PersonalNote;
  }

  async remove(id: string): Promise<void> {
    const realm = getOpenAppRealm();
    const target = realm.objects('PersonalNote').filtered('id = $0', id)[0];
    if (target) {
      realm.write(() => {
        realm.delete(target);
      });
    }
  }
}

let instance: PersonalNoteRepository | null = null;

export function getPersonalNoteRepository(): PersonalNoteRepository {
  if (!instance) {
    instance = new PersonalNoteRepository();
  }
  return instance;
}
