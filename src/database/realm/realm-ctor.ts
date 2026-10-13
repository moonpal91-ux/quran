/**
 * اختيار منشئ Realm حسب المنصة — عبر ملفات منصة React Native:
 * - realm-ctor.ts        ← Node (اختبارات): حزمة realm الأصلية
 * - realm-ctor.native.ts ← Android/iOS: حزمة realm الأصلية
 * - realm-ctor.web.ts    ← Web (معاينة فقط): محوّل تخزين المتصفح
 */
import type { Realm as RealmType } from 'realm';

export type RealmCtor = typeof RealmType;

let cached: RealmCtor | null = null;

export function getRealmCtor(): RealmCtor {
  if (!cached) {
    cached = (require('realm') as { Realm: RealmCtor }).Realm;
  }
  return cached;
}
