/**
 * فهرس السور + البحث — المرحلة 2 (06 / 07-A).
 * قائمة 114 سورة بالترتيب + شريط بحث في الآيات وأسماء السور.
 * البحث يطبّع الاستعلام (03-REALM §5) ولا يغيّر النص المعروض.
 */
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../design-system/theme';
import { fontFamilies, fontSizes, spacing, touchTarget, radius } from '../../design-system/tokens';
import {
  getQuranSurahs,
  searchAyahs,
  toArabicIndic,
  type AyahSearchHit,
  type SurahInfo,
} from './quran-content';
import type { MushafScreenProps } from './mushaf-stack';

type Tab = 'surahs' | 'search';

export function MushafHomeScreen({ navigation }: MushafScreenProps<'MushafHome'>) {
  const { tokens, fontScale } = useTheme();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('surahs');
  const surahs = useMemo(() => getQuranSurahs(), []);
  const hits: AyahSearchHit[] = useMemo(
    () => (query.trim() ? searchAyahs(query, 100) : []),
    [query],
  );

  const openSurah = (n: number, ayah?: number) =>
    navigation.navigate('Surah', { surahNumber: n, ...(ayah ? { ayahNumber: ayah } : {}) });

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      {/* شريط البحث */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: tokens.surface,
            borderWidth: 1,
            borderColor: query ? tokens.primary : tokens.border,
            borderRadius: radius.full,
            paddingHorizontal: spacing.md,
            minHeight: touchTarget,
          }}
        >
          <Text style={{ color: tokens.muted, fontSize: fontSizes.md, marginLeft: spacing.xs }}>🔍</Text>
          <TextInput
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setTab(t.trim() ? 'search' : 'surahs');
            }}
            placeholder="ابحث في الآيات أو أسماء السور…"
            placeholderTextColor={tokens.muted}
            style={{
              flex: 1,
              color: tokens.text,
              fontSize: fontSizes.md * fontScale,
              fontFamily: fontFamilies.ui,
              paddingVertical: 0,
            }}
            returnKeyType="search"
          />
          {query ? (
            <Pressable accessibilityRole="button" onPress={() => setQuery('')} hitSlop={8} style={{ minWidth: 28, minHeight: 28 }}>
              <Text style={{ color: tokens.muted, fontSize: fontSizes.md }}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {tab === 'search' ? (
        <FlatList
          data={hits}
          keyExtractor={(h) => h.ayah.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
          ListEmptyComponent={
            <Text style={{ color: tokens.muted, fontSize: fontSizes.md, fontFamily: fontFamilies.ui, textAlign: 'center', paddingVertical: spacing.xl }}>
              لا نتائج مطابقة لـ«{query}»
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => openSurah(item.ayah.surah, item.ayah.ayah)}
              style={({ pressed }) => [
                {
                  backgroundColor: tokens.surface,
                  borderWidth: 1,
                  borderColor: tokens.border,
                  borderRadius: radius.card,
                  padding: spacing.md,
                  gap: spacing.xs,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: tokens.primary, fontSize: fontSizes.sm * fontScale, fontWeight: '700', fontFamily: fontFamilies.uiBold }}>
                  {item.surah.nameArabic} · آية {toArabicIndic(item.ayah.ayah)}
                </Text>
                <Text style={{ color: tokens.muted, fontSize: fontSizes.xs * fontScale, fontFamily: fontFamilies.ui }}>
                  الجزء {toArabicIndic(item.ayah.juz)}
                </Text>
              </View>
              <Text
                numberOfLines={2}
                style={{
                  color: tokens.text,
                  fontSize: fontSizes.md * fontScale,
                  fontFamily: fontFamilies.quran,
                  lineHeight: fontSizes.quran * fontScale + 10,
                }}
              >
                {item.ayah.text}
              </Text>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={surahs}
          keyExtractor={(s) => String(s.number)}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
          renderItem={({ item }) => <SurahRow surah={item} onPress={() => openSurah(item.number)} />}
        />
      )}
    </View>
  );
}

function SurahRow({ surah, onPress }: { surah: SurahInfo; onPress: () => void }) {
  const { tokens, fontScale } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: tokens.surface,
          borderWidth: 1,
          borderColor: tokens.border,
          borderRadius: radius.card,
          padding: spacing.md,
          gap: spacing.md,
          minHeight: touchTarget,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {/* رقم السورة في دوائر */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          borderWidth: 1.5,
          borderColor: tokens.accent,
          transform: [{ rotate: '45deg' }],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: tokens.accent,
            fontSize: fontSizes.sm * fontScale,
            fontWeight: '700',
            fontFamily: fontFamilies.uiBold,
            transform: [{ rotate: '-45deg' }],
          }}
        >
          {toArabicIndic(surah.number)}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: tokens.text, fontSize: fontSizes.lg * fontScale, fontWeight: '700', fontFamily: fontFamilies.uiBold }}>
          {surah.nameArabic}
        </Text>
        <Text style={{ color: tokens.muted, fontSize: fontSizes.xs * fontScale, fontFamily: fontFamilies.ui, marginTop: 2 }}>
          {toArabicIndic(surah.ayahCount)} آية · {surah.revelationType}
        </Text>
      </View>
      <Text style={{ color: tokens.muted, fontSize: fontSizes.md }}>›</Text>
    </Pressable>
  );
}
