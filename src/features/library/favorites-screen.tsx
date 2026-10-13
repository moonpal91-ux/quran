/**
 * قائمة الآيات المفضلة — قراءات حقيقية من Realm مع إمكانية الحذف.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { Screen, Card, EmptyState } from '../../design-system/components';
import { useTheme } from '../../design-system/theme';
import { fontFamilies, fontSizes, radius, spacing } from '../../design-system/tokens';
import { getFavoriteAyahRepository } from '../../repositories/favorite-ayah-repository';
import { getAyah, getSurahInfo, toArabicIndic } from '../../features/quran/quran-content';
import type { FavoriteAyah } from '../../database/realm/types';

export function FavoritesScreen() {
  const { tokens, fontScale } = useTheme();
  const [items, setItems] = useState<FavoriteAyah[] | null>(null);

  const load = useCallback(async () => {
    setItems(await getFavoriteAyahRepository().list());
  }, []);

  useEffect(() => {
    void load().catch((e) => console.warn('[favorites]', e));
  }, [load]);

  const confirmRemove = (f: FavoriteAyah) => {
    Alert.alert(
      'إزالة من المفضلة',
      `إزالة سورة ${f.surahNumber} — آية ${f.ayahNumber} من المفضلة؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إزالة',
          style: 'destructive',
          onPress: async () => {
            await getFavoriteAyahRepository().remove(f.id);
            await load();
          },
        },
      ],
    );
  };

  if (items === null) {
    return (
      <Screen>
        <Text
          style={{
            color: tokens.muted,
            textAlign: 'center',
            marginTop: spacing.xl,
            fontSize: fontSizes.md * fontScale,
            fontFamily: fontFamilies.ui,
          }}
        >
          جارٍ التحميل…
        </Text>
      </Screen>
    );
  }

  if (items.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="لا آيات مفضلة بعد"
          subtitle="أضف الآيات التي تودّ العودة إليها من لوحة آية المصحف (المرحلة 2)."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        renderItem={({ item }) => {
          const ayah = getAyah(item.surahNumber, item.ayahNumber);
          const surah = getSurahInfo(item.surahNumber);
          return (
          <Card style={{ paddingVertical: spacing.sm + 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  numberOfLines={2}
                  style={{
                    color: tokens.text,
                    fontSize: fontSizes.quran * fontScale,
                    fontFamily: fontFamilies.quran,
                    lineHeight: fontSizes.quran * fontScale + 8,
                  }}
                >
                  {ayah?.text ?? '…'}
                </Text>
                <Text
                  style={{
                    color: tokens.muted,
                    fontSize: fontSizes.sm * fontScale,
                    fontFamily: fontFamilies.ui,
                  }}
                >
                  {surah?.nameArabic ?? `سورة ${item.surahNumber}`} — آية {toArabicIndic(item.ayahNumber)}
                  {'  •  '}
                  {new Date(item.createdAt).toLocaleDateString('ar')}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`إزالة سورة ${item.surahNumber} آية ${item.ayahNumber} من المفضلة`}
                onPress={() => confirmRemove(item)}
                style={({ pressed }) => ({
                  minHeight: 36,
                  minWidth: 36,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: tokens.error,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: spacing.sm + 4,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: tokens.error,
                    fontSize: fontSizes.sm * fontScale,
                    fontFamily: fontFamilies.uiMedium,
                  }}
                >
                  إزالة
                </Text>
              </Pressable>
            </View>
          </Card>
          );
        }}
      />
    </Screen>
  );
}
