/**
 * مستودع الإعدادات — سجل واحد ثابت (id = app-settings).
 * المرجع: 02-ARCHITECTURE.md (القسم 5) و 03-REALM-DATABASE-SCHEMA.md
 */
import { getOpenAppRealm } from '../database/realm/realm';
import {
  APP_SETTINGS_ID,
  DEFAULT_SETTINGS,
  type AppSettings,
  type GoalUnit,
  type MushafBg,
  type ReadingMode,
} from '../database/realm/types';

export interface UpdateSettingsInput {
  theme?: AppSettings['theme'];
  fontScale?: number;
  readingMode?: ReadingMode;
  mushafBg?: MushafBg;
  lastSurahNumber?: number;
  lastAyahNumber?: number;
  lastReadAt?: Date | null;
  dailyGoalUnit?: GoalUnit;
  dailyGoalValue?: number;
  notificationsEnabled?: boolean;
  morningReminderTime?: string | null;
  eveningReminderTime?: string | null;
}

class SettingsRepository {
  private fetchRaw() {
    const realm = getOpenAppRealm();
    return realm.objects('AppSettings').filtered('id = $0', APP_SETTINGS_ID)[0] as unknown as
      | AppSettings
      | undefined;
  }

  /** يقرأ الإعدادات، وينشئها بقيمها الافتراضية عند أول تشغيل */
  async getSettings(): Promise<AppSettings> {
    const existing = this.fetchRaw();
    if (existing) {
      return { ...existing } as AppSettings;
    }
    const realm = getOpenAppRealm();
    realm.write(() => {
      realm.create('AppSettings', {
        ...DEFAULT_SETTINGS,
        id: APP_SETTINGS_ID,
        updatedAt: new Date(),
      });
    });
    const created = this.fetchRaw();
    if (!created) {
      throw new Error('تعذر إنشاء سجل الإعدادات');
    }
    return { ...created } as AppSettings;
  }

  /** يحدّث حقولًا محددة ويعيد النسخة المحدّثة (معاملة واحدة) */
  async updateSettings(input: UpdateSettingsInput): Promise<AppSettings> {
    // تأكد من وجود السجل أولًا
    await this.getSettings();
    const target = this.fetchRaw();
    if (!target) {
      throw new Error('تعذر الوصول لسجل الإعدادات');
    }
    const realm = getOpenAppRealm();
    realm.write(() => {
      const t = target as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(input)) {
        if (value !== undefined) {
          t[key] = value;
        }
      }
      t.updatedAt = new Date();
    });
    return { ...target } as AppSettings;
  }
}

let instance: SettingsRepository | null = null;

export function getSettingsRepository(): SettingsRepository {
  if (!instance) {
    instance = new SettingsRepository();
  }
  return instance;
}
