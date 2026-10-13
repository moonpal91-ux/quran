/**
 * الشاشة الرئيسية — المرحلة 1:
 * تحية + بطاقة «تابع قراءتك» (آخر موضع حقيقي من قاعدة البيانات) + تقدم الورد اليومي
 * (من سجل التقدم اليومي الفعلي) + اختصارات فعّالة.
 *
 * الأقسام التي تعتمد على محتوى يُستورد لاحقًا (آية اليوم، أذكار اليوم، الخطة)
 * لا تظهر هنا حتى تكتمل وحداتها — لا عناصر وهمية (01-6).
 */
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Screen, Card, SectionTitle } from '../../design-system/components';
import { useTheme } from '../../design-system/theme';
import { fontFamilies, fontSizes, spacing, touchTarget } from '../../design-system/tokens';
import { getSettingsRepository } from '../../repositories/settings-repository';
import { getAudioProgressRepository } from '../../repositories/audio-progress-repository';
import { getAudioCatalogRepository } from '../../repositories/audio-catalog-repository';
import { getSurahInfo } from '../../features/quran/quran-content';
import { getOpenAppRealm } from '../../database/realm/realm';
import type { AppSettings } from '../../database/realm/types';
import type { RootTabNavigation } from '../../app/root-navigator';

const GOAL_UNITS_LABEL: Record<string, string> = {
  ayahs: 'آيات',
  pages: 'صفحات',
  juz: 'أجزاء',
};

function todayKey(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function HomeScreen() {
  const { tokens, fontScale } = useTheme();
  const navigation = useNavigation<RootTabNavigation>();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [ayahsToday, setAyahsToday] = useState(0);
  // المرحلة 6 — آخر موضع استماع (قد يكون null: لا بطاقة وهمية)
  const [lastAudio, setLastAudio] = useState<{
    reciterId: string;
    surahNumber: number;
    ayahNumber: number;
    completed: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    const s = await getSettingsRepository().getSettings();
    setSettings(s);
    try {
      const last = getAudioProgressRepository().lastPlayed();
      setLastAudio(
        last
          ? {
              reciterId: last.reciterId,
              surahNumber: last.surahNumber,
              ayahNumber: last.ayahNumber,
              completed: last.completed,
            }
          : null,
      );
    } catch {
      setLastAudio(null);
    }
    const realm = getOpenAppRealm();
    const row = realm.objects('DailyProgress').filtered('id = $0', todayKey())[0] as unknown as
      | { ayahsRead: number }
      | undefined;
    setAyahsToday(row?.ayahsRead ?? 0);
  }, []);

  // إعادة التحميل عند كل تركيز للتبويب — «تابع قراءتك» يعكس آخر موضع حاليًا
  // + إعادة قراءة مؤجلة (700ms) لالتقاط إنهاء جلسة القراءة التي تكتب في نفس اللحظة
  // (مغادرة تبويب المصحف تنهي الجلسة — سباق توقيت موثق)
  useFocusEffect(
    useCallback(() => {
      void load().catch((e) => console.warn('[home] فشل تحميل البيانات', e));
      const t = setTimeout(() => {
        void load().catch(() => {});
      }, 700);
      return () => clearTimeout(t);
    }, [load]),
  );

  const goal = settings?.dailyGoalValue ?? 20;
  const goalUnit = GOAL_UNITS_LABEL[settings?.dailyGoalUnit ?? 'ayahs'] ?? 'آيات';
  const progress = goal > 0 ? Math.min(1, ayahsToday / goal) : 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {/* 1) تحية */}
        <Text
          style={{
            color: tokens.text,
            fontSize: fontSizes.xl * fontScale,
            fontWeight: '700',
            fontFamily: fontFamilies.uiBold,
          }}
        >
          سلامٌ عليك
        </Text>

        {/* 2) تابع قراءتك */}
        <Pressable
          onPress={() =>
            settings &&
            navigation.navigate('المصحف', {
              screen: 'Surah',
              params: {
                surahNumber: settings.lastSurahNumber,
                ayahNumber: settings.lastAyahNumber,
              },
            })
          }
          style={({ pressed }) => ({
            borderRadius: 18,
            borderWidth: 1,
            borderColor: tokens.border,
            backgroundColor: tokens.surface,
            padding: 16,
            opacity: pressed ? 0.8 : 1,
          })}
          accessibilityRole="button"
        >
          <SectionTitle>تابع قراءتك</SectionTitle>
          {settings ? (
            <>
              <Text
                style={{
                  color: tokens.text,
                  fontSize: fontSizes.lg * fontScale,
                  fontWeight: '700',
                  fontFamily: fontFamilies.uiBold,
                }}
              >
                {(() => {
                  const s = getSurahInfo(settings.lastSurahNumber);
                  return s
                    ? `${s.nameArabic} — آية ${settings.lastAyahNumber}`
                    : `سورة ${settings.lastSurahNumber} — آية ${settings.lastAyahNumber}`;
                })()}
              </Text>
              <Text
                style={{
                  color: tokens.muted,
                  fontSize: fontSizes.sm * fontScale,
                  fontFamily: fontFamilies.ui,
                  marginTop: spacing.xs,
                }}
              >
                {settings.lastReadAt
                  ? `آخر قراءة: ${new Date(settings.lastReadAt).toLocaleDateString('ar')}`
                  : 'ابدأ قراءتك الأولى — آخر موضع: الفاتحة 1'}
              </Text>
            </>
          ) : (
            <Text
              style={{
                color: tokens.muted,
                fontSize: fontSizes.md * fontScale,
                fontFamily: fontFamilies.ui,
              }}
            >
              جارٍ التحميل…
            </Text>
          )}
        </Pressable>

        {/* 2-ب) تابع استماعك — المرحلة 6 (لا تظهر إن لم يستمع المستخدم بعد) */}
        {lastAudio ? (
          <Pressable
            onPress={() => navigation.navigate('الاستماع')}
            style={({ pressed }) => ({
              borderRadius: 18,
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: tokens.surface,
              padding: 16,
              opacity: pressed ? 0.8 : 1,
            })}
            accessibilityRole="button"
          >
            <SectionTitle>تابع استماعك</SectionTitle>
            <Text
              style={{
                color: tokens.text,
                fontSize: fontSizes.lg * fontScale,
                fontWeight: '700',
                fontFamily: fontFamilies.uiBold,
              }}
            >
              {(() => {
                const surah = getSurahInfo(lastAudio.surahNumber);
                const reciter = getAudioCatalogRepository().getReciter(lastAudio.reciterId);
                const where = surah ? surah.nameArabic : `سورة ${lastAudio.surahNumber}`;
                const who = reciter ? ` — ${reciter.nameAr}` : '';
                return `${where} — آية ${lastAudio.ayahNumber}${who}`;
              })()}
            </Text>
            <Text
              style={{
                color: tokens.muted,
                fontSize: fontSizes.sm * fontScale,
                fontFamily: fontFamilies.ui,
                marginTop: spacing.xs,
              }}
            >
              {lastAudio.completed ? 'أتممتَ سماع هذه السورة' : 'اضغط للانتقال إلى تبويب الاستماع'}
            </Text>
          </Pressable>
        ) : null}

        {/* 3) تقدم الورد اليومي (بيانات فعلية) */}
        <Card>
          <SectionTitle>الورد اليومي</SectionTitle>
          <Text
            style={{
              color: tokens.text,
              fontSize: fontSizes.md * fontScale,
              fontFamily: fontFamilies.uiMedium,
            }}
          >
            {ayahsToday} / {goal} {goalUnit}
          </Text>
          <View
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: tokens.border,
              marginTop: spacing.sm,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${progress * 100}%`,
                backgroundColor: tokens.accent,
                borderRadius: 4,
              }}
            />
          </View>
          <Text
            style={{
              color: tokens.muted,
              fontSize: fontSizes.xs * fontScale,
              fontFamily: fontFamilies.ui,
              marginTop: spacing.xs,
            }}
          >
            يُحتسب الورد من القراءة الفعلية المسجلة في المصحف
          </Text>
        </Card>

        {/* 7) اختصارات فعّالة */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Shortcut label="المصحف" onPress={() => navigation.navigate('المصحف')} />
          <Shortcut label="الأذكار" onPress={() => navigation.navigate('الأذكار')} />
          <Shortcut label="الاستماع" onPress={() => navigation.navigate('الاستماع')} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Shortcut({ label, onPress }: { label: string; onPress: () => void }) {
  const { tokens, fontScale } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          minHeight: touchTarget,
          backgroundColor: tokens.surface,
          borderWidth: 1,
          borderColor: tokens.border,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: tokens.primary,
          fontSize: fontSizes.sm * fontScale,
          fontWeight: '500',
          fontFamily: fontFamilies.uiMedium,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
