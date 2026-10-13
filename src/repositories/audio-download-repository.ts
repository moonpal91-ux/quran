/**
 * مستودع سجلات التنزيل الصوتي (المرحلة 6) — يعيد استخدام كائن DownloadRecord القائم.
 *
 * لماذا لا كائن جديد؟ `DownloadRecord` في المخطط مُصمَّم أصلاً لأي محتوى قابل
 * للتنزيل (contentType/contentId/version/status/bytesDownloaded/totalBytes) —
 * فلا داعي لمخطط موازٍ. الاصطلاح هنا:
 *   contentType = 'audio'
 *   contentId   = `<reciterId>|<mode>|<number>`      (مثال: `ar.alafasy|surah|1`)
 *   version     = `<bitrate>`                        (مثال: `128`)
 *
 * قواعد:
 * - لا سجل = غير مُنزَّل (لا أرقام افتراضية).
 * - الحذف من القرص يقع في طبقة التنزيل (audio-downloader)؛ هذا المستودع يسجّل الحالة فقط.
 * - كل العمليات داخل معاملات Realm عبر repositories (لا كتابة من الشاشات).
 */
import { getOpenAppRealm } from '../database/realm/realm';
import type { AudioMode } from '../database/realm/types';
import type { Realm } from 'realm';

export type DownloadStatus = 'pending' | 'downloading' | 'downloaded' | 'failed';

export interface AudioDownloadRecord {
  id: string;
  contentType: string;
  contentId: string;
  version: string;
  status: DownloadStatus;
  bytesDownloaded: number;
  totalBytes: number | null;
  updatedAt: Date;
}

export interface AudioDownloadRepository {
  /** مفتاح السجل الموحّد */
  key(reciterId: string, mode: AudioMode, number: number): string;
  get(reciterId: string, mode: AudioMode, number: number): AudioDownloadRecord | null;
  isDownloaded(reciterId: string, mode: AudioMode, number: number): boolean;
  /** ابدأ/جدّد تنزيلًا — يسجّل pending ثم downloading */
  markDownloading(reciterId: string, mode: AudioMode, number: number, bitrate: string): void;
  /** اكتمل التنزيل — يسجّل الحجم الفعلي */
  markDownloaded(reciterId: string, mode: AudioMode, number: number, bitrate: string, bytes: number): void;
  /** فشل — يترك الحجم المحلي كما هو للاستئناف */
  markFailed(reciterId: string, mode: AudioMode, number: number, bitrate: string): void;
  /** احذف السجل (بعد حذف الملف من القرص) */
  remove(reciterId: string, mode: AudioMode, number: number): void;
  /** كل سجلات الصوت */
  all(): AudioDownloadRecord[];
  /** المكتملة فقط لقارئ ونمط محدَّدين */
  downloadedFor(reciterId: string, mode: AudioMode): AudioDownloadRecord[];
  /** إجمالي البايتات المكتملة (لعرض استهلاك التخزين) */
  totalDownloadedBytes(): number;
  /** عدد الملفات المكتملة */
  countDownloaded(reciterId?: string, mode?: AudioMode): number;
}

function idOf(reciterId: string, mode: AudioMode, number: number): string {
  return `audio:${reciterId}|${mode}|${number}`;
}

function read(realm: Realm, id: string): AudioDownloadRecord | null {
  const recs = realm.objects('DownloadRecord').filtered('id = $0', id);
  return recs.length > 0 ? (recs[0] as unknown as AudioDownloadRecord) : null;
}

function upsert(
  realm: Realm,
  id: string,
  contentId: string,
  bitrate: string,
  patch: Partial<AudioDownloadRecord>,
): void {
  realm.write(() => {
    const existing = read(realm, id);
    if (existing) {
      if (patch.status !== undefined) existing.status = patch.status;
      if (patch.bytesDownloaded !== undefined) existing.bytesDownloaded = patch.bytesDownloaded;
      if (patch.totalBytes !== undefined) existing.totalBytes = patch.totalBytes;
      existing.updatedAt = new Date();
    } else {
      realm.create('DownloadRecord', {
        id,
        contentType: 'audio',
        contentId,
        version: bitrate,
        status: patch.status ?? 'pending',
        bytesDownloaded: patch.bytesDownloaded ?? 0,
        totalBytes: patch.totalBytes ?? null,
        updatedAt: new Date(),
      });
    }
  });
}

let cached: AudioDownloadRepository | null = null;

export function getAudioDownloadRepository(): AudioDownloadRepository {
  if (cached) return cached;
  cached = {
    key(reciterId, mode, number) {
      return `${reciterId}|${mode}|${number}`;
    },
    get(reciterId, mode, number) {
      return read(getOpenAppRealm(), idOf(reciterId, mode, number));
    },
    isDownloaded(reciterId, mode, number) {
      const rec = read(getOpenAppRealm(), idOf(reciterId, mode, number));
      return !!rec && rec.status === 'downloaded';
    },
    markDownloading(reciterId, mode, number, bitrate) {
      const id = idOf(reciterId, mode, number);
      upsert(getOpenAppRealm(), id, this.key(reciterId, mode, number), bitrate, {
        status: 'downloading',
        bytesDownloaded: 0,
      });
    },
    markDownloaded(reciterId, mode, number, bitrate, bytes) {
      const id = idOf(reciterId, mode, number);
      upsert(getOpenAppRealm(), id, this.key(reciterId, mode, number), bitrate, {
        status: 'downloaded',
        bytesDownloaded: bytes,
        totalBytes: bytes,
      });
    },
    markFailed(reciterId, mode, number, bitrate) {
      const id = idOf(reciterId, mode, number);
      upsert(getOpenAppRealm(), id, this.key(reciterId, mode, number), bitrate, { status: 'failed' });
    },
    remove(reciterId, mode, number) {
      const realm = getOpenAppRealm();
      const id = idOf(reciterId, mode, number);
      realm.write(() => {
        const rec = read(realm, id);
        if (rec) realm.delete(rec);
      });
    },
    all() {
      const recs = getOpenAppRealm()
        .objects('DownloadRecord')
        .filtered('contentType = "audio"');
      return Array.from(recs) as unknown as AudioDownloadRecord[];
    },
    downloadedFor(reciterId, mode) {
      return this.all().filter(
        (r) => r.status === 'downloaded' && r.contentId.startsWith(`${reciterId}|${mode}|`),
      );
    },
    totalDownloadedBytes() {
      return this.all()
        .filter((r) => r.status === 'downloaded')
        .reduce((sum, r) => sum + (r.bytesDownloaded || 0), 0);
    },
    countDownloaded(reciterId, mode) {
      let list = this.all().filter((r) => r.status === 'downloaded');
      if (reciterId) list = list.filter((r) => r.contentId.startsWith(`${reciterId}|`));
      if (mode) list = list.filter((r) => r.contentId.includes(`|${mode}|`));
      return list.length;
    },
  };
  return cached;
}

/** إعادة ضبط المخزن (اختبارات) */
export function _resetAudioDownloadRepositoryForTests(): void {
  cached = null;
}
