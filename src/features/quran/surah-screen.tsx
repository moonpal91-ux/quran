/**
 * شاشة السورة — قارئ المصحف (المرحلة 2).
 *
 * 07-A: عرض الآيات بالنص العثماني (Amiri Quran) مع العلامات كما هي،
 * الانتقال إلى سورة/آية محددة، حفظ آخر موضع واستعادته، أدوات الآية
 * (علامة/مفضلة/ملاحظة/نسخ/مشاركة — المرجع دون تغيير النص).
 *
 * قاعدة احتساب «آخر موضع» (03-REALM §4 — قاعدة واضحة موثقة):
 * يُحدَّث الموضع عند فتح السورة (على الآية المستهدفة أو الآية الأولى)
 * وعند اختيار أي آية — أي الموضع = الآية المعروضة/المختارة حاليًا.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
  Platform,
} from 'react-native';
import { setStringAsync } from 'expo-clipboard';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../../design-system/theme';
import { fontFamilies, fontSizes, spacing, touchTarget, radius, mushafPalettes } from '../../design-system/tokens';
import {
  getAyahsOfSurah,
  getSurahInfo,
  getQuranSurahs,
  toArabicIndic,
  type AyahInfo,
} from './quran-content';
import { getSettingsRepository } from '../../repositories/settings-repository';
import { getBookmarkRepository } from '../../repositories/bookmark-repository';
import { getFavoriteAyahRepository } from '../../repositories/favorite-ayah-repository';
import { getPersonalNoteRepository } from '../../repositories/personal-note-repository';
import { getReadingSessionTracker } from '../../repositories/reading-session-tracker';
import { getTafsir, getTafsirSources } from '../../repositories/quran-qa-repository';
import type { MushafScreenProps } from './mushaf-stack';
import type { MushafBg, PersonalNote } from '../../database/realm/types';

export function SurahScreen({ navigation, route }: MushafScreenProps<'Surah'>) {
  const { tokens, fontScale } = useTheme();
  const { surahNumber, ayahNumber } = route.params;
  const surah = getSurahInfo(surahNumber);
  const ayahs = useMemo(() => getAyahsOfSurah(surahNumber), [surahNumber]);
  const allSurahs = useMemo(() => getQuranSurahs(), []);

  const [activeAyah, setActiveAyah] = useState<number>(ayahNumber ?? 1);
  const [selectedAyah, setSelectedAyah] = useState<number | null>(null);
  const [jumpInput, setJumpInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [note, setNote] = useState<PersonalNote | null>(null);
  const [noteModal, setNoteModal] = useState<null | { title: string; body: string }>(null);
  /** خلفية صفحة المصحف المريحة (إعداد مستقل عن سمة الواجهة) */
  const [mushafBg, setMushafBg] = useState<MushafBg>('theme');
  /** مصدر التفسير المفتوح — null = المودال مغلق */
  const [tafsirSource, setTafsirSource] = useState<string | null>(null);
  const tafsirSources = useMemo(() => getTafsirSources(), []);
  const listRef = useRef<FlatList<AyahInfo>>(null);

  const screenFocused = useIsFocused();
  useEffect(() => {
    if (!screenFocused) return;
    let cancelled = false;
    getSettingsRepository()
      .getSettings()
      .then((st) => {
        if (!cancelled) setMushafBg(st.mushafBg);
      })
      .catch((e) => console.warn('[mushaf] فشل تحميل إعداد صفحة المصحف', e));
    return () => {
      cancelled = true;
    };
    // إعادة القراءة عند كل تركيز للشاشة: تغيير الإعداد يُطبَّق فورًا
  }, [screenFocused]);

  // لوحة صفحة القراءة: تتبّع السمة أو اللوحة المختارة (مريحة للعين)
  const palette = mushafBg === 'theme' ? null : mushafPalettes[mushafBg];
  const pageBg = palette?.page ?? tokens.background;
  const quranInk = palette?.quran ?? tokens.text;
  const metaInk = palette?.ayahMeta ?? tokens.muted;
  const pageBorder = palette?.border ?? tokens.border;

  const clampAyah = useCallback(
    (n: number) => Math.min(Math.max(1, n), surah?.ayahCount ?? 1),
    [surah],
  );

  // عنوان الترويسة باسم السورة (اسم المسار «Surah» إنجليزي — نعرض العربي)
  useLayoutEffect(() => {
    if (surah) navigation.setOptions({ title: `سورة ${surah.nameArabic}` });
  }, [navigation, surah]);

  /** حفظ آخر موضع (قاعدة موثقة أعلى الملف) */
  const savePosition = useCallback(
    (s: number, a: number) => {
      void getSettingsRepository()
        .updateSettings({ lastSurahNumber: s, lastAyahNumber: a, lastReadAt: new Date() })
        .catch((e) => console.warn('[mushaf] فشل حفظ الموضع', e));
    },
    [],
  );

  // عند فتح السورة (أو الانتقال بينها دون آية محددة): الموضع يبدأ من الآية
  // المستهدفة أو الأولى — ولا يُترك موضع السورة السابقة مضيئًا/محفوظًا
  useEffect(() => {
    const initial = clampAyah(route.params.ayahNumber ?? 1);
    setActiveAyah(initial);
    setSelectedAyah(null);
    savePosition(surahNumber, initial);
    // R1/R4: فتح موضع جديد في سورة = اختيار متعمد (كـ«الانتقال إلى آية»)
    // — القراءة المتصلة تُدمج في الجلسة المفتوحة وتُحسب آية المقصودة
    if (surahNumber >= 1 && surahNumber <= 114) {
      getReadingSessionTracker().markRead(surahNumber, initial);
    }
    listRef.current?.scrollToIndex({ index: initial - 1, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surahNumber, route.params?.ayahNumber]);

  // حالة أدوات الآية المختارة
  useEffect(() => {
    if (selectedAyah == null) {
      setIsBookmarked(false);
      setIsFavorited(false);
      setNote(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const b = await getBookmarkRepository().exists(surahNumber, selectedAyah);
      const f = await getFavoriteAyahRepository().exists(surahNumber, selectedAyah);
      const notes = await getPersonalNoteRepository().list();
      const n = notes.find((x) => x.surahNumber === surahNumber && x.ayahNumber === selectedAyah) ?? null;
      if (!cancelled) {
        setIsBookmarked(b);
        setIsFavorited(f);
        setNote(n);
      }
    })().catch((e) => console.warn('[mushaf] فشل تحميل حالة الآية', e));
    return () => {
      cancelled = true;
    };
  }, [selectedAyah, surahNumber]);

  if (!surah) {
    return <Text style={{ color: tokens.text, padding: spacing.lg }}>سورة غير موجودة</Text>;
  }

  const goSurah = (n: number) => navigation.navigate('Surah', { surahNumber: n });

  /** (ويب) حاوية التمرير القائمة فعليًا على الشاشة */
  const findListScroller = (): HTMLElement | null => {
    for (const d of Array.from(document.querySelectorAll('div'))) {
      if (d.offsetParent === null) continue;
      const r = d.getBoundingClientRect();
      if (r.height > 100 && d.scrollHeight > d.clientHeight + 50 && d.querySelector('[role=button][aria-label^="آية"]')) {
        return d;
      }
    }
    return null;
  };

  /** (ويب) العنصر البعيد قد لا يكون مرمَّزًا بعد — اسحب نحو النهاية حتى يرمَّز
   *  (محاولات محدودة؛ على الأجهزة الأصلية scrollToIndex يعمل مباشرة) */
  const jumpToAyahWeb = (target: number, attempt = 8): void => {
    const item = document.querySelector(`[role=button][aria-label^="آية ${target} "]`);
    if (item) {
      item.scrollIntoView({ block: 'center' });
      return;
    }
    if (attempt <= 0) return;
    const scroller = findListScroller();
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
    setTimeout(() => jumpToAyahWeb(target, attempt - 1), 250);
  };

  const jumpToAyah = () => {
    const n = Number(jumpInput.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
    if (!Number.isInteger(n) || n < 1) return;
    const target = clampAyah(n);
    setActiveAyah(target);
    setSelectedAyah(target);
    savePosition(surahNumber, target);
    // R1: الانتقال إلى آية = اختيار متعمد — يُحسب في الجلسة كلمس الآية
    getReadingSessionTracker().markRead(surahNumber, target);
    setJumpInput('');
    if (Platform.OS === 'web') {
      setTimeout(() => jumpToAyahWeb(target), 80);
    } else {
      listRef.current?.scrollToIndex({ index: target - 1, animated: true });
    }
  };

  const selectAyah = (a: number) => {
    setActiveAyah(a);
    setSelectedAyah(a);
    savePosition(surahNumber, a);
    // R1/R2: اختيار متعمد لآية = جلسة (إن لم تكن) + آية مقروءة (فريد داخل الجلسة)
    getReadingSessionTracker().markRead(surahNumber, a);
  };

  const shareText = (a: AyahInfo) =>
    `﴿${a.text}﴾\n— ${surah.nameArabic}، الآية ${toArabicIndic(a.ayah)}`;

  const doCopy = async (a: AyahInfo) => {
    await setStringAsync(shareText(a));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const doShare = async (a: AyahInfo) => {
    const text = shareText(a);
    if (Platform.OS === 'web') {
      // الويب: لا يوجد Sheet أصلي — نسخة احتياطية موثقة: الحافظة
      await setStringAsync(text);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
      return;
    }
    try {
      await Share.share({ message: text }, { dialogTitle: 'مشاركة آية' });
    } catch (e) {
      console.warn('[mushaf] فشل المشاركة', e);
    }
  };

  const toggleBookmark = async (a: AyahInfo) => {
    const repo = getBookmarkRepository();
    if (isBookmarked) {
      const list = await repo.list();
      const found = list.find((b) => b.surahNumber === surahNumber && b.ayahNumber === a.ayah);
      if (found) await repo.remove(found.id);
      setIsBookmarked(false);
    } else {
      await repo.add({ surahNumber, ayahNumber: a.ayah });
      setIsBookmarked(true);
    }
  };

  const toggleFavorite = async (a: AyahInfo) => {
    const repo = getFavoriteAyahRepository();
    if (isFavorited) {
      const list = await repo.list();
      const found = list.find((b) => b.surahNumber === surahNumber && b.ayahNumber === a.ayah);
      if (found) await repo.remove(found.id);
      setIsFavorited(false);
    } else {
      await repo.add({ surahNumber, ayahNumber: a.ayah });
      setIsFavorited(true);
    }
  };

  const saveNote = async (a: AyahInfo) => {
    if (!noteModal) return;
    const repo = getPersonalNoteRepository();
    const body = noteModal.body.trim();
    if (!body) return;
    if (note) {
      await repo.update(note.id, {
        body,
        title: noteModal.title.trim() ? noteModal.title : null,
      });
    } else {
      await repo.add({
        surahNumber,
        ayahNumber: a.ayah,
        title: noteModal.title.trim() ? noteModal.title : null,
        body,
      });
    }
    setNoteModal(null);
    const notes = await repo.list();
    setNote(notes.find((x) => x.surahNumber === surahNumber && x.ayahNumber === a.ayah) ?? null);
  };

  const deleteNote = async () => {
    if (!note) return;
    await getPersonalNoteRepository().remove(note.id);
    setNote(null);
  };

  const selected = selectedAyah ? ayahs[selectedAyah - 1] : null;

  return (
    <View style={{ flex: 1, backgroundColor: pageBg }}>
      {/* معلومات السورة + تنقّل + شارة الرسم العثماني */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
          <Text style={{ color: metaInk, fontSize: fontSizes.sm * fontScale, fontFamily: fontFamilies.ui }}>
            {toArabicIndic(surah.ayahCount)} آية · {surah.revelationType} · الجزء {toArabicIndic(ayahs[0]?.juz ?? 1)}
          </Text>
          <View
            accessibilityLabel="الرسم العثماني — نص Tanzil v1.1 حرفي دون تعديل"
            style={{ borderWidth: 1, borderColor: pageBorder, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 }}
          >
            <Text style={{ color: metaInk, fontSize: fontSizes.xs * fontScale, fontFamily: fontFamilies.ui }}>
              الرسم العثماني
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <NavBtn label="السابقة" disabled={surahNumber <= 1} onPress={() => goSurah(surahNumber - 1)} />
          <NavBtn label="التالية" disabled={surahNumber >= 114} onPress={() => goSurah(surahNumber + 1)} />
        </View>
      </View>

      {/* الانتقال إلى آية */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
          gap: spacing.sm,
        }}
      >
        <TextInput
          value={jumpInput}
          onChangeText={setJumpInput}
          placeholder={`الانتقال إلى آية (1–${toArabicIndic(surah.ayahCount)})`}
          placeholderTextColor={tokens.muted}
          keyboardType="number-pad"
          maxLength={3}
          style={{
            flex: 1,
            minHeight: touchTarget,
            color: tokens.text,
            backgroundColor: tokens.surface,
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: radius.full,
            paddingHorizontal: spacing.md,
            fontSize: fontSizes.sm * fontScale,
            fontFamily: fontFamilies.ui,
          }}
        />
        <Pressable
          accessibilityRole="button"
          onPress={jumpToAyah}
          style={({ pressed }) => ({
            minHeight: touchTarget,
            paddingHorizontal: spacing.md,
            backgroundColor: tokens.primary,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: '#fff', fontSize: fontSizes.sm * fontScale, fontWeight: '700', fontFamily: fontFamilies.uiBold }}>
            انتقال
          </Text>
        </Pressable>
      </View>

      {/* الآيات */}
      <FlatList
        ref={listRef}
        data={ayahs}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 160 }}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item }) => (
          <AyahItem
            ayah={item}
            active={item.ayah === activeAyah}
            selected={item.ayah === selectedAyah}
            fontScale={fontScale}
            quranColor={quranInk}
            metaColor={metaInk}
            onPress={() => selectAyah(item.ayah)}
          />
        )}
      />

      {/* شريط أدوات الآية */}
      {selected ? (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            left: 0,
            backgroundColor: tokens.surface,
            borderTopWidth: 1,
            borderTopColor: tokens.border,
            padding: spacing.md,
            gap: spacing.sm,
          }}
        >
          <Text style={{ color: tokens.muted, fontSize: fontSizes.xs * fontScale, fontFamily: fontFamilies.ui }}>
            {surah.nameArabic} — آية {toArabicIndic(selected.ayah)}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <ToolBtn
              label={isBookmarked ? 'إزالة العلامة' : 'علامة'}
              active={isBookmarked}
              onPress={() => void toggleBookmark(selected)}
            />
            <ToolBtn
              label={isFavorited ? 'إزالة من المفضلة' : 'مفضلة'}
              active={isFavorited}
              onPress={() => void toggleFavorite(selected)}
            />
            <ToolBtn
              label={note ? 'تعديل الملاحظة' : 'ملاحظة'}
              active={!!note}
              onPress={() =>
                setNoteModal({
                  title: note?.title ?? '',
                  body: note?.body ?? '',
                })
              }
            />
            <ToolBtn label="التفسير" active={false} onPress={() => setTafsirSource('ibnkathir')} />
            <ToolBtn label={copied ? 'نُسخ ✓' : 'نسخ'} active={copied} onPress={() => void doCopy(selected)} />
            <ToolBtn label={shared ? 'نُسخ للحافظة ✓' : 'مشاركة'} active={shared} onPress={() => void doShare(selected)} />
          </View>
          {note ? (
            <Pressable accessibilityRole="button" onPress={() => void deleteNote()} style={{ alignSelf: 'flex-start', marginTop: 2 }}>
              <Text style={{ color: tokens.error, fontSize: fontSizes.xs * fontScale, fontFamily: fontFamilies.ui }}>
                حذف الملاحظة
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* مودال الملاحظة */}
      <Modal visible={noteModal !== null} transparent animationType="slide" onRequestClose={() => setNoteModal(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tokens.surface, borderRadius: radius.card * 1.5, padding: spacing.lg, gap: spacing.md }}>
            <Text style={{ color: tokens.text, fontSize: fontSizes.lg * fontScale, fontWeight: '700', fontFamily: fontFamilies.uiBold }}>
              ملاحظة على آية {selected ? toArabicIndic(selected.ayah) : ''}
            </Text>
            <TextInput
              value={noteModal?.title ?? ''}
              onChangeText={(t) => setNoteModal((m) => (m ? { ...m, title: t } : m))}
              placeholder="عنوان (اختياري)"
              placeholderTextColor={tokens.muted}
              style={{
                color: tokens.text,
                minHeight: touchTarget,
                borderWidth: 1,
                borderColor: tokens.border,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.md,
                fontSize: fontSizes.md * fontScale,
                fontFamily: fontFamilies.ui,
              }}
            />
            <TextInput
              value={noteModal?.body ?? ''}
              onChangeText={(t) => setNoteModal((m) => (m ? { ...m, body: t } : m))}
              placeholder="نص الملاحظة…"
              placeholderTextColor={tokens.muted}
              multiline
              style={{
                color: tokens.text,
                minHeight: 120,
                borderWidth: 1,
                borderColor: tokens.border,
                borderRadius: radius.sm,
                padding: spacing.md,
                fontSize: fontSizes.md * fontScale,
                fontFamily: fontFamilies.ui,
                textAlignVertical: 'top',
              }}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="حفظ الملاحظة"
                onPress={() => {
                  if (selected) void saveNote(selected);
                }}
                style={{
                  flex: 1,
                  minHeight: touchTarget,
                  backgroundColor: tokens.primary,
                  borderRadius: radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: fontSizes.md * fontScale, fontWeight: '700', fontFamily: fontFamilies.uiBold }}>
                  حفظ
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="إلغاء الملاحظة"
                onPress={() => setNoteModal(null)}
                style={{
                  flex: 1,
                  minHeight: touchTarget,
                  borderWidth: 1,
                  borderColor: tokens.border,
                  borderRadius: radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: tokens.text, fontSize: fontSizes.md * fontScale, fontFamily: fontFamilies.ui }}>
                  إلغاء
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* مودال التفسير (مرحلة 4) — مصادر معتمدة: ابن كثير + البغوي */}
      <Modal visible={tafsirSource !== null} animationType="slide" onRequestClose={() => setTafsirSource(null)}>
        <View style={{ flex: 1, backgroundColor: tokens.background, paddingTop: 8 }}>
          <View style={{ paddingHorizontal: spacing.md, gap: spacing.xs, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: tokens.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={{ color: tokens.text, fontSize: fontSizes.lg * fontScale, fontWeight: '700', fontFamily: fontFamilies.uiBold, flex: 1 }}>
                التفسير
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="إغلاق التفسير"
                onPress={() => setTafsirSource(null)}
                style={{ width: touchTarget, height: touchTarget, borderRadius: radius.full, borderWidth: 1, borderColor: tokens.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: tokens.muted, fontSize: fontSizes.md * fontScale, fontFamily: fontFamilies.ui }}>✕</Text>
              </Pressable>
            </View>
            {selected ? (
              <Text style={{ color: tokens.text, fontSize: fontSizes.quran * fontScale, fontFamily: fontFamilies.quran, lineHeight: fontSizes.quran * fontScale + 10 }}>
                {selected.text}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
              {tafsirSources.map((src) => {
                const activeChip = src.id === tafsirSource;
                return (
                  <Pressable
                    key={src.id}
                    accessibilityRole="button"
                    accessibilityLabel={`عرض ${src.name}`}
                    onPress={() => setTafsirSource(src.id)}
                    style={{
                      paddingHorizontal: spacing.md,
                      minHeight: 36,
                      borderRadius: radius.full,
                      borderWidth: 1,
                      borderColor: activeChip ? tokens.primary : tokens.border,
                      backgroundColor: activeChip ? tokens.primary : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: activeChip ? '#fff' : tokens.primary, fontSize: fontSizes.xs * fontScale, fontWeight: '700', fontFamily: fontFamilies.uiBold }}>
                      {src.name.replace('تفسير ', '')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl }}
            style={{ flex: 1 }}
          >
            {selected && tafsirSource
              ? (() => {
                  const text = getTafsir(surahNumber, selected.ayah, tafsirSource);
                  if (!text) {
                    return (
                      <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
                        <Text style={{ color: tokens.muted, fontSize: fontSizes.md * fontScale, fontFamily: fontFamilies.ui, textAlign: 'center' }}>
                          لا يتوفر تفسير لهذه الآية في هذا المصدر
                        </Text>
                        <Text style={{ color: tokens.muted, fontSize: fontSizes.xs * fontScale, fontFamily: fontFamilies.ui, textAlign: 'center' }}>
                          (نواقص المصدر موثقة في سجل الاعتماد — جرّب مصدرًا آخر: البغوي مكتمل 6236 آية)
                        </Text>
                      </View>
                    );
                  }
                  return text
                    .split('\n')
                    .filter((p) => p.trim().length > 0)
                    .map((p, i) => (
                      <Text
                        key={i}
                        style={{ color: tokens.text, fontSize: fontSizes.md * fontScale, lineHeight: fontSizes.md * fontScale + 12, fontFamily: fontFamilies.ui }}
                      >
                        {p}
                      </Text>
                    ));
                })()
              : null}
          </ScrollView>
          {tafsirSource ? (
            <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: 2 }}>
              <Text style={{ color: tokens.muted, fontSize: fontSizes.xs * fontScale, fontFamily: fontFamilies.ui }}>
                المصدر: {tafsirSources.find((x) => x.id === tafsirSource)?.name} — {tafsirSources.find((x) => x.id === tafsirSource)?.author}
              </Text>
              <Text style={{ color: tokens.muted, fontSize: fontSizes.xs * fontScale, fontFamily: fontFamilies.ui }}>
                نص في الملك العام · مُوزَّع عبر {tafsirSources.find((x) => x.id === tafsirSource)?.distribution} · اعتمد بوابات 05 (بصمة/فحص)
              </Text>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function NavBtn({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  const { tokens, fontScale } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.sm + 4,
        minHeight: 36,
        borderWidth: 1,
        borderColor: tokens.border,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: tokens.primary, fontSize: fontSizes.xs * fontScale, fontWeight: '700', fontFamily: fontFamilies.uiBold }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ToolBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { tokens, fontScale } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: touchTarget,
        borderWidth: 1,
        borderColor: active ? tokens.primary : tokens.border,
        backgroundColor: active ? tokens.primary : 'transparent',
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        numberOfLines={1}
        style={{
          color: active ? '#fff' : tokens.primary,
          fontSize: fontSizes.xs * fontScale,
          fontWeight: '700',
          fontFamily: fontFamilies.uiBold,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function AyahItem({
  ayah,
  active,
  selected,
  fontScale,
  quranColor,
  metaColor,
  onPress,
}: {
  ayah: AyahInfo;
  active: boolean;
  selected: boolean;
  fontScale: number;
  /** لون نص المصحف حسب لوحة صفحة القراءة المختارة */
  quranColor: string;
  metaColor: string;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        padding: spacing.sm,
        borderRadius: radius.card,
        backgroundColor: selected ? tokens.surface : 'transparent',
        borderWidth: selected ? 1 : 0,
        borderColor: tokens.accent,
        opacity: pressed && !selected ? 0.85 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={`آية ${ayah.ayah} ${active ? '— الموضع الحالي' : ''}`}
    >
      <Text
        style={{
          color: quranColor,
          fontSize: fontSizes.quran * fontScale,
          fontFamily: fontFamilies.quran,
          lineHeight: fontSizes.quran * fontScale + 14,
        }}
      >
        {ayah.text}
        <Text
          style={{
            color: tokens.accent,
            fontSize: fontSizes.quran * fontScale * 0.8,
            fontFamily: fontFamilies.quran,
          }}
        >
          {'  '}
          ﴿{toArabicIndic(ayah.ayah)}﴾
        </Text>
        {ayah.sajdah ? (
          <Text style={{ color: metaColor, fontSize: fontSizes.xs * fontScale, fontFamily: fontFamilies.ui }}>
            {'  '}
            [سجدة]
          </Text>
        ) : null}
      </Text>
    </Pressable>
  );
}
