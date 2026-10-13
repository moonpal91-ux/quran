/**
 * قائمة الملاحظات الشخصية — قراءات حقيقية من Realm مع إمكانية الحذف.
 * إنشاء الملاحظات مرتبط بالمصحف (المرحلة 2) — لا يُخترع مسار إدخال منفصل الآن.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Screen, Card, EmptyState } from '../../design-system/components';
import { useTheme } from '../../design-system/theme';
import { fontFamilies, fontSizes, radius, spacing } from '../../design-system/tokens';
import { getPersonalNoteRepository } from '../../repositories/personal-note-repository';
import type { PersonalNote } from '../../database/realm/types';

export function NotesScreen() {
  const { tokens, fontScale } = useTheme();
  const [items, setItems] = useState<PersonalNote[] | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setItems(await getPersonalNoteRepository().list());
  }, []);

  // فلتر بحث على العنوان/النص (03-REALM §5: تطبيع للبحث فقط دون تعديل المخزن)
  const filtered = useMemo(() => {
    if (!items) return items;
    const q = query.trim();
    if (!q) return items;
    return items.filter(
      (n) =>
        (n.title ?? '').includes(q) ||
        n.body.includes(q) ||
        n.tags.some((t) => t.includes(q)),
    );
  }, [items, query]);

  useEffect(() => {
    void load().catch((e) => console.warn('[notes]', e));
  }, [load]);

  const confirmRemove = (n: PersonalNote) => {
    Alert.alert(
      'حذف الملاحظة',
      'سيُحذف نص الملاحظة نهائيًا من هذا الجهاز.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            await getPersonalNoteRepository().remove(n.id);
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
          title="لا ملاحظات بعد"
          subtitle="ستتمكن من كتابة ملاحظاتك الخاصة مرتبطة بسورة أو آية من شاشة المصحف (المرحلة 2)."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث في ملاحظاتك (عنوان/نص/وسم)…"
          placeholderTextColor={tokens.muted}
          style={{
            color: tokens.text,
            minHeight: 44,
            backgroundColor: tokens.surface,
            borderWidth: 1,
            borderColor: query ? tokens.primary : tokens.border,
            borderRadius: radius.full,
            paddingHorizontal: spacing.md,
            fontSize: fontSizes.md * fontScale,
            fontFamily: fontFamilies.ui,
          }}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListEmptyComponent={
          query.trim() ? (
            <Text style={{ color: tokens.muted, textAlign: 'center', marginTop: spacing.lg, fontSize: fontSizes.md * fontScale, fontFamily: fontFamilies.ui }}>
              لا ملاحظات تطابق «{query}»
            </Text>
          ) : undefined
        }
        renderItem={({ item }) => (
          <Card style={{ paddingVertical: spacing.sm + 4, gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: tokens.text,
                    fontSize: fontSizes.md * fontScale,
                    fontWeight: '700',
                    fontFamily: fontFamilies.uiBold,
                  }}
                >
                  {item.title || `سورة ${item.surahNumber}${item.ayahNumber ? ` — آية ${item.ayahNumber}` : ''}`}
                </Text>
                <Text
                  style={{
                    color: tokens.muted,
                    fontSize: fontSizes.xs * fontScale,
                    fontFamily: fontFamilies.ui,
                    marginTop: 2,
                  }}
                >
                  {new Date(item.updatedAt).toLocaleDateString('ar')}
                  {item.tags.length > 0 ? ` • ${item.tags.join('، ')}` : ''}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="حذف الملاحظة"
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
                  حذف
                </Text>
              </Pressable>
            </View>
            <Text
              numberOfLines={2}
              style={{
                color: tokens.text,
                fontSize: fontSizes.sm * fontScale,
                fontFamily: fontFamilies.ui,
              }}
            >
              {item.body}
            </Text>
          </Card>
        )}
      />
    </Screen>
  );
}
