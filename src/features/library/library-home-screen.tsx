/**
 * شاشة «مكتبتي» — نقطة الدخول: قائمة الأقسام مع عدّادات حقيقية من قاعدة البيانات.
 * (01-PRODUCT-SPEC §6: تضم الخطط، المفضلة، العلامات، الملاحظات، الإعدادات)
 *
 * ملاحظة (2026-10-14): «التنزيلات» أُزيلت مع تبويب الاستماع (كانت لإدارة ملفات
 * التلاوة فقط) — ولا تُترك شاشة بلا وظيفة.
 */
import { useCallback, useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen, Card, ListRow, SectionTitle } from '../../design-system/components';
import { spacing } from '../../design-system/tokens';
import { getBookmarkRepository } from '../../repositories/bookmark-repository';
import { getFavoriteAyahRepository } from '../../repositories/favorite-ayah-repository';
import { getPersonalNoteRepository } from '../../repositories/personal-note-repository';
import { getReadingSessionRepository } from '../../repositories/reading-session-repository';
import type { LibraryStackParamList } from './library-stack';

export function LibraryHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<LibraryStackParamList>>();
  const [counts, setCounts] = useState({ bookmarks: 0, favorites: 0, notes: 0, sessions: 0 });

  const load = useCallback(async () => {
    const [b, f, n, s] = await Promise.all([
      getBookmarkRepository().list(),
      getFavoriteAyahRepository().list(),
      getPersonalNoteRepository().list(),
      getReadingSessionRepository().listSessions(100),
    ]);
    setCounts({ bookmarks: b.length, favorites: f.length, notes: n.length, sessions: s.length });
  }, []);

  useEffect(() => {
    void load().catch((e) => console.warn('[library]', e));
  }, [load]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <SectionTitle style={{ marginTop: spacing.xs }}>القراءات المحفوظة</SectionTitle>
        <Card style={{ paddingVertical: spacing.sm + 2, gap: spacing.sm }}>
          <ListRow
            title="العلامات المرجعية"
            trailing={counts.bookmarks > 0 ? String(counts.bookmarks) : undefined}
            onPress={() => navigation.navigate('Bookmarks')}
            showChevron
          />
          <ListRow
            title="المفضلة"
            trailing={counts.favorites > 0 ? String(counts.favorites) : undefined}
            onPress={() => navigation.navigate('Favorites')}
            showChevron
          />
          <ListRow
            title="الملاحظات"
            trailing={counts.notes > 0 ? String(counts.notes) : undefined}
            onPress={() => navigation.navigate('Notes')}
            showChevron
          />
          <ListRow
            title="سجل القراءة"
            subtitle="جلسات القراءة والورد اليومي"
            trailing={counts.sessions > 0 ? String(counts.sessions) : undefined}
            onPress={() => navigation.navigate('Sessions')}
            showChevron
          />
        </Card>

        <SectionTitle>التخطيط</SectionTitle>
        <Card style={{ paddingVertical: spacing.sm + 2, gap: spacing.sm }}>
          <ListRow
            title="الخطط"
            subtitle="خطط القراءة والختمة"
            onPress={() => navigation.navigate('Plans')}
            showChevron
          />
        </Card>

        <SectionTitle>التطبيق</SectionTitle>
        <Card style={{ paddingVertical: spacing.sm + 2, gap: spacing.sm }}>
          <ListRow
            title="الإعدادات"
            subtitle="المظهر وحجم الخط والورد اليومي"
            onPress={() => navigation.navigate('Settings')}
            showChevron
          />
          <ListRow
            title="حول التطبيق"
            subtitle="الحقوق ومصادر المحتوى"
            onPress={() => navigation.navigate('About')}
            showChevron
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}
