/**
 * اختيار منشئ Realm — React Native (Android/iOS): حزمة realm الأصلية.
 * يُحلَّل هذا الملف تلقائيًا على المنصات الأصلية (متداد .native).
 */
import { Realm } from 'realm';

export type RealmCtor = typeof Realm;

export function getRealmCtor(): RealmCtor {
  return Realm;
}
