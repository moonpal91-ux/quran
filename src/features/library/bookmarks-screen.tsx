/**
 * قائمة العلامات المرجعية — قراءات حقيقية من Realm مع إمكانية الحذف.
 * الانتقال إلى الموضع يتم من شاشة المصحف (المرحلة 2).
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Screen, Card, EmptyState } from '../../design-system/components';
import { useTheme } from '../../design-system/theme';
import { fontFamilies, fontSizes, radius, spacing, touchTarget } from '../../design-system/tokens';
import { getBookmarkRepository } from '../../repositories/bookmark-repository';
import type { Bookmark } from '../../database/realm/types';

export function BookmarksScreen() {
  const { tokens, fontScale } = useTheme();
  const [items, setItems] = useState<Bookmark[] | null>(null);
  const [editing, setEditing] = useState<Bookmark | null>(null);
  const [labelDraft, setLabelDraft] = useState('');

  const load = useCallback(async () => {
    setItems(await getBookmarkRepository().list());
  }, []);

  const openEdit = (b: Bookmark) => {
    setLabelDraft(b.label ?? '');
    setEditing(b);
  };

  const saveLabel = async () => {
    if (!editing) return;
    await getBookmarkRepository().updateLabel(editing.id, labelDraft.trim() || null);
    setEditing(null);
    await load();
  };

  useEffect(() => {
    void load().catch((e) => console.warn('[bookmarks]', e));
  }, [load]);

  const confirmRemove = (b: Bookmark) => {
    Alert.alert(
      'حذف العلامة',
      `حذف العلامة على سورة ${b.surahNumber} — آية ${b.ayahNumber}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            await getBookmarkRepository().remove(b.id);
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
          title="لا علامات بعد"
          subtitle="عند قراءة المصحف يمكنك إضافة علامة مرجعية على أي آية لتعود إليها لاحقًا."
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
        renderItem={({ item }) => (
          <Card style={{ paddingVertical: spacing.sm + 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: tokens.text,
                    fontSize: fontSizes.md * fontScale,
                    fontWeight: '500',
                    fontFamily: fontFamilies.uiMedium,
                  }}
                >
                  {item.label
                    ? item.label
                    : `سورة ${item.surahNumber} — آية ${item.ayahNumber}`}
                </Text>
                <Text
                  style={{
                    color: tokens.muted,
                    fontSize: fontSizes.sm * fontScale,
                    fontFamily: fontFamilies.ui,
                  }}
                >
                  {item.label
                    ? `سورة ${item.surahNumber} — آية ${item.ayahNumber} • ${new Date(item.createdAt).toLocaleDateString('ar')}`
                    : new Date(item.createdAt).toLocaleDateString('ar')}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`تعديل تسمية علامة سورة ${item.surahNumber} آية ${item.ayahNumber}`}
                onPress={() => openEdit(item)}
                style={({ pressed }) => ({
                  minHeight: 36,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: tokens.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: spacing.sm + 4,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: tokens.primary,
                    fontSize: fontSizes.sm * fontScale,
                    fontFamily: fontFamilies.uiMedium,
                  }}
                >
                  تسمية
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`حذف العلامة سورة ${item.surahNumber} آية ${item.ayahNumber}`}
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
          </Card>
        )}
      />

      {/* مودال تسمية العلامة */}
      <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tokens.surface, borderRadius: radius.card * 1.5, padding: spacing.lg, gap: spacing.md }}>
            <Text style={{ color: tokens.text, fontSize: fontSizes.lg * fontScale, fontWeight: '700', fontFamily: fontFamilies.uiBold }}>
              تسمية العلامة
            </Text>
            {editing ? (
              <Text style={{ color: tokens.muted, fontSize: fontSizes.sm * fontScale, fontFamily: fontFamilies.ui }}>
                سورة {editing.surahNumber} — آية {editing.ayahNumber}
              </Text>
            ) : null}
            <TextInput
              value={labelDraft}
              onChangeText={setLabelDraft}
              placeholder="مثال: آية الكرسي"
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
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => void saveLabel()}
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
                onPress={() => setEditing(null)}
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
    </Screen>
  );
}
