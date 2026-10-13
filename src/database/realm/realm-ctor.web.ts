/**
 * اختيار منشئ Realm — Web (معاينة فقط): محوّل تخزين المتصفح خلف الواجهات نفسها.
 * المرجع: 02-ARCHITECTURE.md (القسم 7) — لا يُدَّعى أن نسخة الويب تخزن في Realm.
 */
import BrowserRealm from './browser-adapter';
import type { Realm } from 'realm';

export type RealmCtor = typeof Realm;

export function getRealmCtor(): RealmCtor {
  return BrowserRealm as unknown as RealmCtor;
}
