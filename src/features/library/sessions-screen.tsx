/**
 * سجل جلسات القراءة (المرحلة 3) — 06-IMPLEMENTATION-PLAN: «سجل جلسات القراءة».
 * قائمة حية من Realm: كل جلسة (بداية/نهاية/آيات/مدة) + ملخص اليوم مقابل الهدف.
 * لا تكرار سجلات عند إعادة فتح الشاشة (06-بوابة المرحلة 3) — القراءة فقط من المستودع.
 */
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Screen, Card, EmptyState, SectionTitle } from '../../design-system/components';
import { useTheme } from '../../design-system/theme';
import { fontFamilies, fontSizes, radius, spacing } from '../../design-system/tokens';
import {
  getReadingSessionRepository,
} from '../../repositories/reading-session-repository';
import { getSettingsRepository } from '../../repositories/settings-repository';
import { getSurahInfo, toArabicIndic } from '../../features/quran/quran-content';
import type { ReadingSession } from '../../database/realm/types';

export function SessionsScreen() {
  const { tokens, fontScale } = useTheme();
  const [sessions, setSessions] = useState<ReadingSession[] | null>(null);
  const [todayAyahs, setTodayAyahs] = useState(0);
  const [goal, setGoal] = useState(20);

  const load = useCallback(async () => {
    const [list, today, settings] = await Promise.all([
      getReadingSessionRepository().listSessions(50),
      getReadingSessionRepository().getTodayProgress(),
      getSettingsRepository().getSettings(),
    ]);
    setSessions(list);
    setTodayAyahs(today?.ayahsRead ?? 0);
    setGoal(settings.dailyGoalValue);
  }, []);

  useEffect(() => {
    void load().catch((e) => console.warn('[sessions]', e));
  }, [load]);

  if (sessions === null) {
    return (
      <Screen>
        <Text style={{ color: tokens.muted, textAlign: 'center', marginTop: spacing.xl, fontSize: fontSizes.md * fontScale, fontFamily: fontFamilies.ui }}>
          جارٍ التحميل…
        </Text>
      </Screen>
    );
  }

  const pos = (s: number, a: number) => {
    const name = getSurahInfo(s)?.nameArabic ?? `سورة ${s}`;
    return `${name} ${toArabicIndic(a)}`;
  };

  return (
    <Screen>
      <FlatList
        data={sessions}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, marginBottom: spacing.xs }}>
            <Card>
              <SectionTitle>اليوم</SectionTitle>
              <Text style={{ color: tokens.text, fontSize: fontSizes.lg * fontScale, fontWeight: '700', fontFamily: fontFamilies.uiBold }}>
                {toArabicIndic(todayAyahs)} / {toArabicIndic(goal)} آية
              </Text>
              <Text style={{ color: tokens.muted, fontSize: fontSizes.sm * fontScale, fontFamily: fontFamilies.ui, marginTop: spacing.xs }}>
                الورد يُحتسب من آيات الجلسات المنتهية اليوم (قاعدة R5 الموثقة)
              </Text>
            </Card>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="لا جلسات قراءة بعد"
            subtitle="عند اختيارك آيات من المصحف تُسجل جلسة تلقائيًا وتظهر هنا مع عدد الآيات والمدة."
          />
        }
        renderItem={({ item }) => (
          <Card style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: tokens.text, fontSize: fontSizes.md * fontScale, fontWeight: '700', fontFamily: fontFamilies.uiBold }}>
                {toArabicIndic(item.ayahsRead)} آية
              </Text>
              {item.endedAt ? (
                <Text style={{ color: tokens.muted, fontSize: fontSizes.xs * fontScale, fontFamily: fontFamilies.ui }}>
                  {Math.max(1, Math.round(item.durationSeconds / 60))} دقيقة
                </Text>
              ) : (
                <View style={{ backgroundColor: tokens.accent, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 }}>
                  <Text style={{ color: '#fff', fontSize: fontSizes.xs * fontScale, fontFamily: fontFamilies.uiBold }}>
                    جارية
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ color: tokens.text, fontSize: fontSizes.sm * fontScale, fontFamily: fontFamilies.ui }}>
              من {pos(item.startSurahNumber, item.startAyahNumber)}
              {item.endSurahNumber != null && item.endAyahNumber != null
                ? ` إلى ${pos(item.endSurahNumber, item.endAyahNumber)}`
                : ''}
            </Text>
            <Text style={{ color: tokens.muted, fontSize: fontSizes.xs * fontScale, fontFamily: fontFamilies.ui }}>
              {new Date(item.startedAt).toLocaleDateString('ar')} —{' '}
              {new Date(item.startedAt).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </Card>
        )}
      />
    </Screen>
  );
}
