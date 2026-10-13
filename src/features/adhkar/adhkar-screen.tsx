/**
 * شاشة الأذكار — المرحلة 5.
 *
 * المحتوى: حزمة «حصن المسلم» المعتمدة (content/adhkar-data.json — بوابة 05).
 * - 135 فئة / 345 ذكرًا، نص فصحى مشكّلة من المصدر (لا توليد).
 * - النصوص القرآنية داخل الأذكار تُعرض من حزمة Tanzil المعتمدة (اتساق المصحف).
 * - العدّاد: بيانات المستخدم الفعلية في Realm (DhikrProgress) — سجل يومي لكل ذكر
 *   بسقف من المصدر؛ لا سجل = صفر (لا أرقام افتراضية).
 * - التكرار: القيمة من المصدر إن وُجدت، وإلا 1 (قاعدة موثقة في الحزمة).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../../design-system/theme';
import { fontFamilies, fontSizes, radius, spacing, touchTarget } from '../../design-system/tokens';
import { Screen, Card, SectionTitle } from '../../design-system/components';
import {
  getAdhkarCategories,
  getAdhkarItemsByCategory,
  getAdhkarDisplayText,
  type AdhkarItem,
} from '../../repositories/adhkar-content-repository';
import { getAdhkarProgressRepository } from '../../repositories/adhkar-progress-repository';
import { toArabicIndic } from '../quran/quran-content';

interface ProgressState {
  [adhkarId: string]: { countCompleted: number; targetCount: number };
}

export function AdhkarScreen() {
  const { tokens, fontScale } = useTheme();
  const focused = useIsFocused();
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [progress, setProgress] = useState<ProgressState>({});
  const [loaded, setLoaded] = useState(false);

  const categories = useMemo(() => getAdhkarCategories(), []);
  const items = useMemo(
    () => (categoryId === null ? [] : getAdhkarItemsByCategory(categoryId)),
    [categoryId],
  );

  const loadProgress = useCallback(() => {
    const repo = getAdhkarProgressRepository();
    const next: ProgressState = {};
    const targets = categoryId === null
      ? categories.flatMap(c => getAdhkarItemsByCategory(c.id).map(i => i.id))
      : items.map(i => i.id);
    for (const id of targets) {
      const p = repo.getToday(id);
      next[id] = { countCompleted: p.countCompleted, targetCount: p.targetCount };
    }
    setProgress(next);
    setLoaded(true);
  }, [categoryId, categories, items]);

  // قراءة التقدم عند كل تركيز (تغيير اليوم/مزامنة مع بقية الشاشات)
  useEffect(() => {
    if (!focused) return;
    loadProgress();
  }, [focused, loadProgress]);

  const increment = (item: AdhkarItem) => {
    const repo = getAdhkarProgressRepository();
    const p = repo.recordDhikr(item.id, item.count);
    setProgress(prev => ({ ...prev, [item.id]: { countCompleted: p.countCompleted, targetCount: p.targetCount } }));
  };

  const resetItem = (item: AdhkarItem) => {
    const repo = getAdhkarProgressRepository();
    repo.resetToday(item.id);
    setProgress(prev => ({ ...prev, [item.id]: { countCompleted: 0, targetCount: item.count } }));
  };

  const norm = (s: string) => s.replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim();
  const q = norm(search);
  const shownCategories = q
    ? categories.filter(c => norm(c.name).includes(q))
    : categories;
  const shownItems = q
    ? items.filter(i => norm(i.zekr).includes(q) || norm(i.category).includes(q))
    : items;

  const catProgress = (cid: number) => {
    const its = getAdhkarItemsByCategory(cid);
    let done = 0;
    for (const it of its) {
      const p = progress[it.id];
      if (p && p.countCompleted >= it.count) done += 1;
    }
    return { done, total: its.length };
  };

  const currentCat = categoryId === null ? null : categories.find(c => c.id === categoryId) ?? null;
  const catDone = currentCat ? catProgress(currentCat.id) : null;

  return (
    <Screen>
      <View style={{ gap: spacing.md, flex: 1 }}>
        <SectionTitle>
          {currentCat ? currentCat.name : 'الأذكار'}
        </SectionTitle>

        {currentCat && catDone ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.sm,
            }}
          >
            <Text style={{ color: tokens.muted, fontSize: fontSizes.sm * fontScale, fontFamily: fontFamilies.ui }}>
              اكتمل {toArabicIndic(catDone.done)} من {toArabicIndic(catDone.total)} اليوم
            </Text>
            {catDone.done > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`إعادة عدادات ${currentCat.name}`}
                onPress={() => {
                  const repo = getAdhkarProgressRepository();
                  for (const it of items) repo.resetToday(it.id);
                  loadProgress();
                }}
                style={({ pressed }) => ({
                  minWidth: touchTarget,
                  minHeight: touchTarget,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: tokens.border,
                  backgroundColor: pressed ? tokens.background : 'transparent',
                })}
              >
                <Text style={{ color: tokens.accent, fontSize: fontSizes.sm * fontScale, fontFamily: fontFamilies.uiMedium }}>
                  تصفير العدادات
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={currentCat ? 'البحث في الأذكار…' : 'البحث في الفئات…'}
          placeholderTextColor={tokens.muted}
          accessibilityLabel="بحث في الأذكار"
          style={{
            minHeight: touchTarget,
            paddingHorizontal: spacing.md,
            borderRadius: radius.card,
            backgroundColor: tokens.surface,
            borderWidth: 1,
            borderColor: tokens.border,
            color: tokens.text,
            fontSize: fontSizes.md * fontScale,
            fontFamily: fontFamilies.ui,
          }}
        />

        {currentCat ? (
          <FlatList
            data={shownItems}
            keyExtractor={i => i.id}
            contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}
            ListEmptyComponent={
              <Text style={{ color: tokens.muted, fontSize: fontSizes.md * fontScale, fontFamily: fontFamilies.ui, padding: spacing.lg, textAlign: 'center' }}>
                لا أذكار تطابق البحث
              </Text>
            }
            renderItem={({ item }) => {
              const p = progress[item.id] ?? { countCompleted: 0, targetCount: item.count };
              const completed = p.countCompleted >= item.count;
              const text = getAdhkarDisplayText(item);
              return (
                <Card>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`زاد ذكر: ${item.category}، التكرار ${toArabicIndic(p.countCompleted)} من ${toArabicIndic(item.count)}`}
                    onPress={() => increment(item)}
                    disabled={completed}
                    style={({ pressed }) => ({
                      gap: spacing.sm,
                      padding: spacing.md,
                      borderRadius: radius.card,
                      borderWidth: 1,
                      borderColor: completed ? tokens.accent : tokens.border,
                      backgroundColor: pressed ? tokens.background : 'transparent',
                      opacity: completed ? 0.9 : 1,
                      minHeight: touchTarget,
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                      <Text
                        style={{
                          color: tokens.text,
                          fontSize: fontSizes.md * fontScale,
                          fontFamily: fontFamilies.ui,
                          flex: 1,
                        }}
                      >
                        {text}
                      </Text>
                      {completed ? (
                        <View
                          style={{
                            minWidth: touchTarget,
                            height: touchTarget,
                            borderRadius: radius.card,
                            backgroundColor: tokens.accent,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          accessibilityLabel="مكتمل"
                        >
                          <Text style={{ color: tokens.text, fontSize: fontSizes.lg * fontScale, fontFamily: fontFamilies.uiBold }}>
                            ✓
                          </Text>
                        </View>
                      ) : (
                        <View
                          style={{
                            minWidth: touchTarget,
                            height: touchTarget,
                            borderRadius: radius.card,
                            borderWidth: 1,
                            borderColor: tokens.accent,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ color: tokens.accent, fontSize: fontSizes.md * fontScale, fontFamily: fontFamilies.uiBold }}>
                            {toArabicIndic(p.countCompleted)}/{toArabicIndic(item.count)}
                          </Text>
                        </View>
                      )}
                    </View>
                    {item.reference ? (
                      <Text numberOfLines={1} style={{ color: tokens.muted, fontSize: fontSizes.xs * fontScale, fontFamily: fontFamilies.ui }}>
                        المصدر: {item.reference}
                      </Text>
                    ) : null}
                    {item.description ? (
                      <Text numberOfLines={2} style={{ color: tokens.muted, fontSize: fontSizes.sm * fontScale, fontFamily: fontFamilies.ui }}>
                        {item.description}
                      </Text>
                    ) : null}
                  </Pressable>
                  {p.countCompleted > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`تصفير ${item.category}`}
                      onPress={() => resetItem(item)}
                      style={({ pressed }) => ({
                        alignSelf: 'flex-end',
                        minWidth: touchTarget,
                        minHeight: touchTarget,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: spacing.sm,
                        borderRadius: radius.sm,
                        backgroundColor: pressed ? tokens.background : 'transparent',
                      })}
                    >
                      <Text style={{ color: tokens.muted, fontSize: fontSizes.xs * fontScale, fontFamily: fontFamilies.ui }}>
                        تصفير
                      </Text>
                    </Pressable>
                  ) : null}
                </Card>
              );
            }}
          />
        ) : (
          <FlatList
            data={shownCategories}
            keyExtractor={c => String(c.id)}
            contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}
            ListEmptyComponent={
              <Text style={{ color: tokens.muted, fontSize: fontSizes.md * fontScale, fontFamily: fontFamilies.ui, padding: spacing.lg, textAlign: 'center' }}>
                لا فئات تطابق البحث
              </Text>
            }
            renderItem={({ item }) => {
              const p = catProgress(item.id);
              return (
                <Card>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`فتح فئة ${item.name}، اكتمل ${toArabicIndic(p.done)} من ${toArabicIndic(p.total)} اليوم`}
                    onPress={() => {
                      setSearch('');
                      setCategoryId(item.id);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: spacing.md,
                      minHeight: touchTarget,
                      paddingVertical: spacing.xs,
                      borderRadius: radius.card,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text numberOfLines={1} style={{ color: tokens.text, fontSize: fontSizes.md * fontScale, fontFamily: fontFamilies.uiMedium, flex: 1 }}>
                      {item.name}
                    </Text>
                    <Text style={{ color: p.done === p.total && p.total > 0 ? tokens.accent : tokens.muted, fontSize: fontSizes.sm * fontScale, fontFamily: fontFamilies.ui }}>
                      {toArabicIndic(p.done)}/{toArabicIndic(p.total)}
                    </Text>
                  </Pressable>
                </Card>
              );
            }}
          />
        )}

        {currentCat ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="العودة إلى الفئات"
            onPress={() => setCategoryId(null)}
            style={({ pressed }) => ({
              minHeight: touchTarget,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: pressed ? tokens.background : 'transparent',
            })}
          >
            <Text style={{ color: tokens.accent, fontSize: fontSizes.md * fontScale, fontFamily: fontFamilies.uiMedium }}>
              ← كل الفئات
            </Text>
          </Pressable>
        ) : null}

        <Text style={{ color: tokens.muted, fontSize: fontSizes.xs * fontScale, fontFamily: fontFamilies.ui, textAlign: 'center' }}>
          المصدر: حصن المسلم من أذكار الكتاب والسنة — نص معتمد (بوابات 05)؛ الآيات من Tanzil Uthmani المعتمد
        </Text>
      </View>
    </Screen>
  );
}
