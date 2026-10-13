/**
 * شاشة التنزيلات (المرحلة 6) — إدارة ملفات التلاوة على الجهاز.
 *
 * - الحقيقة من القرص + سجلات Realm معًا (أي تعارض يُعرض: «السجل دون ملف»).
 * - حذف صريح فقط؛ لا تنزيل تلقائي في الخلفية.
 * - لا أرقام مُقدَّرة: الحجم المعروض من سجل التنزيل الفعلي.
 */
import { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Card, SectionTitle, Button } from '../../design-system/components';
import { useTheme } from '../../design-system/theme';
import { spacing, fontSizes, fontFamilies } from '../../design-system/tokens';
import { getAudioCatalogRepository } from '../../repositories/audio-catalog-repository';
import { getAudioDownloadRepository } from '../../repositories/audio-download-repository';
import { getQuranSurahs, toArabicIndic } from '../../repositories/quran-content-repository';
import {
  deleteDownloaded,
  deleteReciter,
  downloadMany,
  formatBytes,
  isFileOnDisk,
  storageInfo,
} from '../audio/audio-downloader';
import type { AudioMode } from '../../database/realm/types';

export function DownloadsScreen() {
  const { tokens, fontScale } = useTheme();
  const catalog = useMemo(() => getAudioCatalogRepository(), []);
  const surahs = useMemo(() => getQuranSurahs(), []);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>('');

  const downloads = getAudioDownloadRepository();
  const records = useMemo(() => downloads.all(), [downloads, refresh]);
  const storage = storageInfo();

  const byReciter = useMemo(() => {
    const map = new Map<string, { mode: AudioMode; files: number; bytes: number }[]>();
    for (const rec of records.filter((r) => r.status === 'downloaded')) {
      const [reciterId, mode, num] = rec.contentId.split('|');
      const list = map.get(reciterId) ?? [];
      const entry = list.find((e) => e.mode === (mode as AudioMode));
      if (entry) {
        entry.files += 1;
        entry.bytes += rec.bytesDownloaded || 0;
      } else {
        list.push({ mode: mode as AudioMode, files: 1, bytes: rec.bytesDownloaded || 0 });
      }
      map.set(reciterId, list);
    }
    return map;
  }, [records]);

  async function downloadAllFor(reciterId: string, mode: AudioMode): Promise<void> {
    setBusy(true);
    setNote('');
    try {
      const numbers = mode === 'surah' ? surahs.map((s) => s.number) : Array.from({ length: 6236 }, (_, i) => i + 1);
      const res = await downloadMany(reciterId, mode, numbers, '128', (p) =>
        setNote(`${toArabicIndic(p.completed)} / ${toArabicIndic(p.total)} — ${formatBytes(p.bytes)}`),
      );
      setNote(`اكتمل ${toArabicIndic(res.ok)} · فشل ${toArabicIndic(res.failed)}`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setRefresh((k) => k + 1);
    }
  }

  const s = styles(tokens, fontScale);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: tokens.background }} contentContainerStyle={{ padding: spacing.md }}>
      <SectionTitle>التنزيلات</SectionTitle>

      <Card>
        <Text style={s.body}>المستخدم: {formatBytes(storage.usedBytes)}</Text>
        <Text style={s.muted}>
          المتاح: {formatBytes(storage.availableBytes)} من {formatBytes(storage.totalBytes)} · عدد الملفات:{' '}
          {toArabicIndic(storage.fileCount)}
        </Text>
      </Card>

      {records.length === 0 ? (
        <Card>
          <Text style={s.body}>لا تنزيلات بعد</Text>
          <Text style={s.muted}>
            نزّل تلاوة من تبويب «الاستماع» للعمل دون اتصال. لا يُنزَّل أي شيء تلقائيًا.
          </Text>
        </Card>
      ) : null}

      {[...byReciter.entries()].map(([reciterId, entries]) => {
        const reciter = catalog.getReciter(reciterId);
        return (
          <Card key={reciterId}>
            <Text style={s.body}>{reciter?.nameAr ?? reciterId}</Text>
            {entries.map((e) => (
              <View key={e.mode} style={{ marginTop: spacing.xs }}>
                <Text style={s.muted}>
                  {e.mode === 'surah' ? 'سور كاملة' : 'آية بآية'}: {toArabicIndic(e.files)} ملف ·{' '}
                  {formatBytes(e.bytes)}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
                  <Button
                    label={busy ? '…' : 'استكمال التنزيل'}
                    variant="outline"
                    disabled={busy}
                    onPress={() => void downloadAllFor(reciterId, e.mode)}
                  />
                  <Button
                    label="حذف الكل"
                    variant="ghost"
                    disabled={busy}
                    onPress={() => {
                      deleteReciter(reciterId, e.mode);
                      setRefresh((k) => k + 1);
                    }}
                  />
                </View>
              </View>
            ))}
          </Card>
        );
      })}

      {note ? (
        <Card>
          <Text style={s.muted}>{note}</Text>
        </Card>
      ) : null}

      <SectionTitle>الملفات</SectionTitle>
      {records.slice(0, 200).map((rec) => {
        const [reciterId, mode, num] = rec.contentId.split('|');
        const onDisk = isFileOnDisk(reciterId, mode as AudioMode, Number(num));
        return (
          <Card key={rec.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={s.body}>
                  {catalog.getReciter(reciterId)?.nameAr ?? reciterId} ·{' '}
                  {mode === 'surah' ? `سورة ${toArabicIndic(Number(num))}` : `آية ${toArabicIndic(Number(num))}`}
                </Text>
                <Text style={s.muted}>
                  {rec.status === 'downloaded' ? 'مكتمل' : rec.status === 'failed' ? 'فشل' : rec.status} ·{' '}
                  {formatBytes(rec.bytesDownloaded)} · {rec.version} kbps
                  {rec.status === 'downloaded' && !onDisk ? ' · ⚠️ السجل بلا ملف على القرص' : ''}
                </Text>
              </View>
              <Button
                label="حذف"
                variant="ghost"
                onPress={() => {
                  deleteDownloaded(reciterId, mode as AudioMode, Number(num));
                  setRefresh((k) => k + 1);
                }}
              />
            </View>
          </Card>
        );
      })}
      {records.length > 200 ? (
        <Text style={s.muted}>يُعرض أول ٢٠٠ ملفًا من {toArabicIndic(records.length)}.</Text>
      ) : null}
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

function styles(tokens: ReturnType<typeof useTheme>['tokens'], fontScale: number) {
  return StyleSheet.create({
    body: { color: tokens.text, fontFamily: fontFamilies.uiMedium, fontSize: 15 * fontScale },
    muted: { color: tokens.muted, fontFamily: fontFamilies.ui, fontSize: 13 * fontScale, marginTop: spacing.xs },
  });
}
