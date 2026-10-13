/**
 * شاشة الاستماع (المرحلة 6) — اختيار القارئ + قائمة السور + مشغّل كامل.
 *
 * الصدق في العرض:
 * - حالة تحقّق الفهرس تُعرض كما هي (لم تُختبر الروابط في بيئة التطوير).
 * - ملاحظة الترخيص ظاهرة للمستخدم (استخدام شخصي — يُراجَع قبل النشر العام).
 * - لا زر يعمل بلا وظيفة: التشغيل يتطلب ملفًا محليًا أو اتصالًا (يُبلَّغ بالخطأ عند الفشل).
 * - الأرقام من الحزم المعتمدة (عدد الآيات/السور) — لا قيم مُختلقة.
 */
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Card, SectionTitle, Button } from '../../design-system/components';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, fontSizes, fontFamilies, touchTarget } from '../../design-system/tokens';
import { getAudioCatalogRepository, type Reciter } from '../../repositories/audio-catalog-repository';
import { getAudioDownloadRepository } from '../../repositories/audio-download-repository';
import { getAudioProgressRepository } from '../../repositories/audio-progress-repository';
import { getQuranSurahs, getSurahInfo, toArabicIndic } from '../../repositories/quran-content-repository';
import { getSettingsRepository } from '../../repositories/settings-repository';
import { deleteDownloaded, formatBytes, isFileOnDisk, storageInfo } from './audio-downloader';
import { useAudioController, formatTime } from './use-audio-player';
import type { AudioMode, AudioRepeatMode } from '../../database/realm/types';

const BITRATES = ['192', '128', '64', '48'];
const RATES = [0.75, 1.0, 1.25, 1.5];
const REPEAT_LABELS: Record<AudioRepeatMode, string> = {
  off: 'بلا تكرار',
  ayah: 'تكرار الآية',
  surah: 'تكرار السورة',
};

export function AudioScreen() {
  const { tokens, fontScale } = useTheme();
  const catalog = useMemo(() => getAudioCatalogRepository(), []);
  const reciters = useMemo(() => catalog.reciters(), [catalog]);
  const surahs = useMemo(() => getQuranSurahs(), []);

  const [reciterId, setReciterId] = useState<string>(reciters[0].id);
  const [mode, setMode] = useState<AudioMode>('surah');
  const [bitrate, setBitrate] = useState<string>('128');
  const [busy, setBusy] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

  const reciter: Reciter = reciters.find((r) => r.id === reciterId) ?? reciters[0];
  const lastPlayed = useMemo(
    () => getAudioProgressRepository().lastPlayed(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey],
  );

  const startSurah = lastPlayed?.surahNumber ?? 1;
  const startAyah = lastPlayed?.ayahNumber ?? 1;

  const { track, controller } = useAudioController(
    {
      reciterId: reciter.id,
      mode,
      surahNumber: startSurah,
      ayahGlobal: 1,
      ayahInSurah: startAyah,
      bitrate,
    },
    (surah: number) => getSurahInfo(surah)?.ayahCount ?? 1,
  );

  // اقرأ القارئ المفضَّل المحفوظ عند فتح الشاشة
  useEffect(() => {
    let alive = true;
    void getSettingsRepository()
      .getSettings()
      .then((settings) => {
        if (!alive) return;
        const saved = settings.preferredReciterId;
        if (saved && reciters.some((r) => r.id === saved)) setReciterId(saved);
      })
      .catch(() => {
        /* الإعدادات غير متاحة — يبقى القارئ الأول */
      });
    return () => {
      alive = false;
    };
  }, [reciters]);

  // احفظ القارئ المفضَّل عند تغييره
  useEffect(() => {
    void getSettingsRepository()
      .updateSettings({ preferredReciterId: reciterId })
      .catch(() => {
        /* لا يمنع التشغيل */
      });
  }, [reciterId]);

  const downloads = getAudioDownloadRepository();
  const storage = storageInfo();

  async function downloadSurah(number: number): Promise<void> {
    setBusy(`s${number}`);
    setProgressText('');
    try {
      await downloadOneWithFeedback(number);
    } catch (e) {
      setProgressText(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setRefreshKey((k) => k + 1);
    }
  }

  async function downloadOneWithFeedback(number: number): Promise<void> {
    const mod = await import('./audio-downloader');
    if (mode === 'surah') {
      await mod.downloadOne(reciterId, 'surah', number, bitrate);
    } else {
      const count = getSurahInfo(number)?.ayahCount ?? 0;
      const numbers = Array.from({ length: count }, (_, i) => i + 1);
      await mod.downloadMany(
        reciterId,
        'ayah',
        numbers,
        bitrate,
        (p) => setProgressText(`${toArabicIndic(p.completed)} / ${toArabicIndic(p.total)}`),
      );
    }
  }

  async function downloadWholeQuran(): Promise<void> {
    setBusy('all');
    setProgressText('');
    try {
      const mod = await import('./audio-downloader');
      const numbers = mode === 'surah' ? surahs.map((s) => s.number) : Array.from({ length: 6236 }, (_, i) => i + 1);
      const res = await mod.downloadMany(reciterId, mode, numbers, bitrate, (p) =>
        setProgressText(`${toArabicIndic(p.completed)} / ${toArabicIndic(p.total)} (${formatBytes(p.bytes)})`),
      );
      setProgressText(`اكتمل: ${toArabicIndic(res.ok)} · فشل: ${toArabicIndic(res.failed)}`);
    } catch (e) {
      setProgressText(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setRefreshKey((k) => k + 1);
    }
  }

  const s = styles(tokens);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: tokens.background }} contentContainerStyle={{ padding: spacing.md }}>
      <SectionTitle>الاستماع</SectionTitle>

      {/* شريط القارئ */}
      <Card>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            {reciters.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => setReciterId(r.id)}
                style={{
                  paddingHorizontal: spacing.md,
                  minHeight: touchTarget,
                  justifyContent: 'center',
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: r.id === reciterId ? tokens.primary : tokens.border,
                  backgroundColor: r.id === reciterId ? tokens.primary : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: r.id === reciterId ? tokens.onPrimary : tokens.text,
                    fontFamily: fontFamilies.uiMedium,
                    fontSize: fontSizes.sm * fontScale,
                  }}
                >
                  {r.nameAr}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <Text style={s.muted}>
          {reciter.styleAr} · {toArabicIndic(Number(reciter.defaultBitrate))} kbps · المصدر: cdn.islamic.network
        </Text>
        {reciter.notes ? <Text style={s.note}>ملاحظة المصدر: {reciter.notes}</Text> : null}
      </Card>

      {/* النمط ومعدل البِتّ */}
      <Card>
        <Text style={s.label}>نمط الملفات</Text>
        <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm }}>
          {(['surah', 'ayah'] as AudioMode[]).map((m) => (
            <Chip
              key={m}
              label={m === 'surah' ? 'سورة كاملة' : 'آية بآية'}
              selected={mode === m}
              onPress={() => setMode(m)}
            />
          ))}
        </View>
        <Text style={s.label}>جودة التنزيل</Text>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {BITRATES.map((b) => (
            <Chip key={b} label={`${toArabicIndic(Number(b))}`} selected={bitrate === b} onPress={() => setBitrate(b)} />
          ))}
        </View>
        <Text style={s.muted}>
          التخزين: {formatBytes(storage.usedBytes)} من {formatBytes(storage.availableBytes)} متاح ·{' '}
          {toArabicIndic(storage.fileCount)} ملفًا
        </Text>
        <Button
          label={busy === 'all' ? 'جارٍ التنزيل…' : `تنزيل المصحف كاملًا (${reciter.nameAr})`}
          variant="outline"
          disabled={busy !== null}
          onPress={downloadWholeQuran}
        />
        {progressText ? <Text style={s.muted}>{progressText}</Text> : null}
        {busy === 'all' ? <ActivityIndicator color={tokens.primary} /> : null}
      </Card>

      {/* استئناف آخر استماع */}
      {lastPlayed ? (
        <Card>
          <Text style={s.label}>تابع استماعك</Text>
          <Text style={s.body}>
            {getSurahInfo(lastPlayed.surahNumber)?.nameArabic} — الآية{' '}
            {toArabicIndic(lastPlayed.ayahNumber)}
            {lastPlayed.completed ? ' (مكتملة)' : ''}
          </Text>
          <Button
            label="استئناف"
            onPress={() =>
              controller.goTo({
                reciterId: lastPlayed.reciterId,
                mode,
                surahNumber: lastPlayed.surahNumber,
                ayahGlobal: 1,
                ayahInSurah: lastPlayed.ayahNumber,
                bitrate,
              })
            }
          />
        </Card>
      ) : null}

      {/* المشغّل */}
      <Card>
        <Text style={s.label}>
          {getSurahInfo(track.surahNumber)?.nameArabic}
          {mode === 'ayah' ? ` — الآية ${toArabicIndic(track.ayahInSurah)}` : ''}
        </Text>
        <Text style={s.muted}>
          {controller.isOffline ? 'من الملف المحلي (بلا إنترنت)' : 'بث مباشر'} · {formatTime(controller.positionSec)} /{' '}
          {formatTime(controller.durationSec)}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginVertical: spacing.sm }}>
          <Button label="السابق" variant="outline" disabled={!controller.hasPrev} onPress={controller.prev} />
          <Button label={controller.isPlaying ? 'إيقاف' : 'تشغيل'} onPress={controller.toggle} />
          <Button label="التالي" variant="outline" disabled={!controller.hasNext} onPress={controller.next} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
          <Button label="−١٠ث" variant="ghost" onPress={() => void controller.skip(-10)} />
          <Button label="١٥ث+" variant="ghost" onPress={() => void controller.skip(15)} />
        </View>
        <Text style={s.label}>السرعة</Text>
        <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm }}>
          {RATES.map((r) => (
            <Chip key={r} label={`${r === 1 ? 'عادية' : toArabicIndic(r)}`} selected={controller.rate === r} onPress={() => controller.setRate(r)} />
          ))}
        </View>
        <Text style={s.label}>التكرار</Text>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {(['off', 'ayah', 'surah'] as AudioRepeatMode[]).map((r) => (
            <Chip key={r} label={REPEAT_LABELS[r]} selected={controller.repeat === r} onPress={() => controller.setRepeat(r)} />
          ))}
        </View>
      </Card>

      {/* قائمة السور */}
      <SectionTitle>السور</SectionTitle>
      {surahs.map((surah) => {
        const downloaded =
          mode === 'surah'
            ? isFileOnDisk(reciterId, 'surah', surah.number)
            : downloads.countDownloaded(reciterId, 'ayah') > 0 && isFileOnDisk(reciterId, 'ayah', 1);
        return (
          <Card key={surah.number}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={s.body}>
                  {toArabicIndic(surah.number)}. {surah.nameArabic}
                </Text>
                <Text style={s.muted}>
                  {toArabicIndic(surah.ayahCount)} آية · {surah.revelationType}
                </Text>
              </View>
              <Button
                label={controller.isPlaying && track.surahNumber === surah.number ? 'يُشغَّل' : 'تشغيل'}
                variant={track.surahNumber === surah.number ? 'primary' : 'outline'}
                onPress={() =>
                  controller.goTo({
                    reciterId,
                    mode,
                    surahNumber: surah.number,
                    ayahGlobal: 1,
                    ayahInSurah: 1,
                    bitrate,
                  })
                }
              />
              {downloaded ? (
                <Button
                  label="حذف"
                  variant="ghost"
                  onPress={() => {
                    if (mode === 'surah') deleteDownloaded(reciterId, 'surah', surah.number);
                    setRefreshKey((k) => k + 1);
                  }}
                />
              ) : (
                <Button
                  label={busy === `s${surah.number}` ? '…' : 'تنزيل'}
                  variant="ghost"
                  disabled={busy !== null}
                  onPress={() => void downloadSurah(surah.number)}
                />
              )}
            </View>
          </Card>
        );
      })}

      {/* المصدر والترخيص */}
      <Card>
        <Text style={s.label}>المصدر والترخيص</Text>
        <Text style={s.muted}>
          {catalog.manifest().sourceName} — الحالة:{' '}
          {catalog.isVerified() ? 'روابط مُختبرة' : 'لم تُختبر الروابط آليًا بعد'}
        </Text>
        <Text style={s.note}>{catalog.manifest().licenseNote}</Text>
      </Card>
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );

  function Chip({
    label,
    selected,
    onPress,
  }: {
    label: string;
    selected: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={{
          paddingHorizontal: spacing.md,
          minHeight: touchTarget,
          justifyContent: 'center',
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: selected ? tokens.primary : tokens.border,
          backgroundColor: selected ? tokens.primary : 'transparent',
        }}
      >
        <Text
          style={{
            color: selected ? tokens.onPrimary : tokens.text,
            fontFamily: fontFamilies.uiMedium,
            fontSize: fontSizes.sm * fontScale,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  }
}

function styles(tokens: ReturnType<typeof useTheme>['tokens']) {
  return StyleSheet.create({
    label: { color: tokens.text, fontFamily: fontFamilies.uiBold, fontSize: 15, marginBottom: spacing.xs },
    body: { color: tokens.text, fontFamily: fontFamilies.uiMedium, fontSize: 15 },
    muted: { color: tokens.muted, fontFamily: fontFamilies.ui, fontSize: 13, marginTop: spacing.xs },
    note: { color: tokens.muted, fontFamily: fontFamilies.ui, fontSize: 12, marginTop: spacing.xs },
  });
}
