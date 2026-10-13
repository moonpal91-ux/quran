/**
 * منزّل التلاوات (المرحلة 6) — طبقة النظام الأساسي (expo-file-system).
 *
 * قواعد صارمة:
 * - **لا تنزيل تلقائي**: كل تنزيل بطلب صريح من المستخدم (أولًا-أوفلاين، واحترامًا للرخصة).
 * - **لا تخزين لحجم وهمي**: الحجم المسجَّل هو حجم الملف الفعلي بعد الاكتمال.
 * - أي فشل يُسجَّل `failed` ويُرفع للمستخدم برسالة واضحة — لا ابتلاع للأخطاء.
 * - الملفات داخل `Paths.document/audio/<reciter>/<mode>/` آمنة من حذف النظام.
 *
 * هذا الملف لا يُستورد في الاختبارات (يعتمد على وحدات أصلية).
 */
import { Directory, File, Paths, DownloadTask } from 'expo-file-system';
import { getAudioCatalogRepository } from '../../repositories/audio-catalog-repository';
import { getAudioDownloadRepository } from '../../repositories/audio-download-repository';
import type { AudioMode } from '../../database/realm/types';

export interface DownloadProgress {
  completed: number;
  total: number;
  bytes: number;
  /** آخر ملف اكتمل (لعرض الحالة) */
  lastFile?: string;
}

export interface StorageInfo {
  usedBytes: number;
  availableBytes: number;
  totalBytes: number;
  fileCount: number;
}

function padded(mode: AudioMode, n: number): string {
  return String(n).padStart(mode === 'surah' ? 3 : 4, '0');
}

/** مسار الملف المحلي لملف تلاوة */
export function audioFileOf(reciterId: string, mode: AudioMode, number: number): File {
  return new File(Paths.document, 'audio', reciterId, mode, `${padded(mode, number)}.mp3`);
}

function ensureDirectory(reciterId: string, mode: AudioMode): Directory {
  const dir = new Directory(Paths.document, 'audio', reciterId, mode);
  if (!dir.exists) dir.create();
  return dir;
}

/** هل الملف مُنزَّل فعليًا على القرص؟ (القرص هو الحقيقة، لا السجل) */
export function isFileOnDisk(reciterId: string, mode: AudioMode, number: number): boolean {
  try {
    return audioFileOf(reciterId, mode, number).exists;
  } catch {
    return false;
  }
}

/** مسار التشغيل: الملف المحلي إن وُجد، وإلا رابط البث المباشر */
export function playbackSource(
  reciterId: string,
  mode: AudioMode,
  number: number,
  bitrate?: string,
): string {
  const file = audioFileOf(reciterId, mode, number);
  if (file.exists) return file.uri;
  const catalog = getAudioCatalogRepository();
  return mode === 'surah'
    ? catalog.surahFileUrl(reciterId, number, bitrate)
    : catalog.ayahFileUrl(reciterId, number, bitrate);
}

/**
 * نزّل ملفًا واحدًا. يعيد حجم الملف بالبايت.
 * @param onProgress تقدّم هذا الملف (0..1) إن توفّر
 */
export async function downloadOne(
  reciterId: string,
  mode: AudioMode,
  number: number,
  bitrate: string,
  onProgress?: (fraction: number) => void,
): Promise<number> {
  const catalog = getAudioCatalogRepository();
  const downloads = getAudioDownloadRepository();
  const url =
    mode === 'surah'
      ? catalog.surahFileUrl(reciterId, number, bitrate)
      : catalog.ayahFileUrl(reciterId, number, bitrate);

  ensureDirectory(reciterId, mode);
  downloads.markDownloading(reciterId, mode, number, bitrate);

  const file = audioFileOf(reciterId, mode, number);
  if (file.exists) {
    try {
      file.delete();
    } catch {
      /* يُكمل بالكتابة فوقه عبر idempotent */
    }
  }

  try {
    const task: DownloadTask = File.createDownloadTask(url, file, {
      headers: { Accept: 'audio/mpeg' },
      onProgress: (data) => {
        // totalBytes = -1 إن لم يُرسل الخادم Content-Length
        if (data.totalBytes > 0) onProgress?.(Math.min(1, data.bytesWritten / data.totalBytes));
      },
    });
    const result = await task.downloadAsync();
    if (!result) {
      downloads.markFailed(reciterId, mode, number, bitrate);
      throw new Error('أُوقف التنزيل قبل اكتماله');
    }
    const size = result.size;
    downloads.markDownloaded(reciterId, mode, number, bitrate, size);
    onProgress?.(1);
    return size;
  } catch (e) {
    downloads.markFailed(reciterId, mode, number, bitrate);
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`تعذّر تنزيل الملف (${url}): ${message}`);
  }
}

/**
 * نزّل مجموعة ملفات (سورة كاملة أو المصحف كاملًا) بتوازٍ محدود.
 * @param numbers أرقام السور (نمط surah) أو الآيات (نمط ayah)
 * @param concurrency عدد التنزيلات المتوازية (3 افتراضيًا)
 */
export async function downloadMany(
  reciterId: string,
  mode: AudioMode,
  numbers: number[],
  bitrate: string,
  onProgress?: (p: DownloadProgress) => void,
  concurrency = 3,
): Promise<{ ok: number; failed: number; bytes: number }> {
  let done = 0;
  let bytes = 0;
  let failed = 0;
  let index = 0;

  async function worker(): Promise<void> {
    while (index < numbers.length) {
      const n = numbers[index++];
      try {
        bytes += await downloadOne(reciterId, mode, n, bitrate);
      } catch {
        failed += 1;
      }
      done += 1;
      onProgress?.({ completed: done, total: numbers.length, bytes, lastFile: `${n}.mp3` });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, numbers.length) }, () => worker());
  await Promise.all(workers);
  return { ok: numbers.length - failed, failed, bytes };
}

/** احذف ملفًا مُنزَّلًا (القرص + السجل) */
export function deleteDownloaded(reciterId: string, mode: AudioMode, number: number): void {
  const file = audioFileOf(reciterId, mode, number);
  if (file.exists) file.delete();
  getAudioDownloadRepository().remove(reciterId, mode, number);
}

/** احذف كل ملفات قارئ بنمط محدَّد */
export function deleteReciter(reciterId: string, mode: AudioMode): number {
  const repo = getAudioDownloadRepository();
  const list = repo.downloadedFor(reciterId, mode);
  let removed = 0;
  for (const rec of list) {
    const n = Number(rec.contentId.split('|')[2]);
    const file = audioFileOf(reciterId, mode, n);
    if (file.exists) {
      file.delete();
    }
    repo.remove(reciterId, mode, n);
    removed += 1;
  }
  return removed;
}

/** معلومات التخزين المستخدمة والمتاحة */
export function storageInfo(): StorageInfo {
  return {
    usedBytes: getAudioDownloadRepository().totalDownloadedBytes(),
    availableBytes: Paths.availableDiskSpace,
    totalBytes: Paths.totalDiskSpace,
    fileCount: getAudioDownloadRepository().countDownloaded(),
  };
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 بايت';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} جيجابايت`;
  if (mb >= 1) return `${mb.toFixed(1)} ميجابايت`;
  return `${Math.max(1, Math.round(bytes / 1024))} كيلوبايت`;
}
