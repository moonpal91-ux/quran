/**
 * شاشة الإعدادات الأولية — المرحلة 1 (متطلب P0: حجم الخط والوضع الفاتح/الداكن + الدافئ).
 * القيم تُحفظ فورًا في قاعدة البيانات المحلية (SettingsRepository).
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { LibraryStackParamList } from './library-stack';
import { Screen, Card, SectionTitle, Button } from '../../design-system/components';
import { useTheme } from '../../design-system/theme';
import {
  fontFamilies,
  fontSizes,
  radius,
  spacing,
  themes,
  mushafPalettes,
  mushafBgLabels,
  type MushafBgChoice,
  type ThemeName,
} from '../../design-system/tokens';
import { getSettingsRepository } from '../../repositories/settings-repository';
import type { AppSettings, GoalUnit, MushafBg } from '../../database/realm/types';

const GOAL_UNITS: { value: GoalUnit; label: string }[] = [
  { value: 'ayahs', label: 'آيات' },
  { value: 'pages', label: 'صفحات' },
  { value: 'juz', label: 'أجزاء' },
];

export function SettingsScreen() {
  const { tokens, themeName, fontScale, themeLabels, setTheme, setFontScale } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<LibraryStackParamList>>();
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const load = useCallback(async () => {
    setSettings(await getSettingsRepository().getSettings());
  }, []);

  useEffect(() => {
    void load().catch((e) => console.warn('[settings]', e));
  }, [load]);

  const updateGoal = async (patch: Partial<Pick<AppSettings, 'dailyGoalUnit' | 'dailyGoalValue'>>) => {
    const s = await getSettingsRepository().updateSettings(patch);
    setSettings(s);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {/* المظهر */}
        <Card style={{ gap: spacing.sm }}>
          <SectionTitle>المظهر</SectionTitle>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {(Object.keys(themeLabels) as ThemeName[]).map((name) => {
              const active = themeName === name;
              const t = themes[name];
              return (
                <Pressable
                  key={name}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setTheme(name)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 72,
                    borderRadius: radius.sm,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? tokens.primary : tokens.border,
                    backgroundColor: t.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: t.primary,
                    }}
                  />
                  <Text
                    style={{
                      color: t.text,
                      fontSize: fontSizes.sm * fontScale,
                      fontWeight: active ? '700' : '500',
                      fontFamily: fontFamilies.uiMedium,
                    }}
                  >
                    {themeLabels[name]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>


        {/* صفحة المصحف — ألوان مريحة للعين (مرحلة 4) */}
        <Card style={{ gap: spacing.sm }}>
          <SectionTitle>صفحة المصحف</SectionTitle>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {(Object.keys(mushafBgLabels) as MushafBgChoice[]).map((bg) => {
              const active = settings?.mushafBg === bg;
              const swatch = bg === 'theme' ? themes[themeName].background : mushafPalettes[bg].page;
              return (
                <Pressable
                  key={bg}
                  accessibilityRole="button"
                  accessibilityLabel={`خلفية المصحف: ${mushafBgLabels[bg]}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => void getSettingsRepository().updateSettings({ mushafBg: bg as MushafBg }).then(setSettings)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 72,
                    borderRadius: radius.sm,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? tokens.primary : tokens.border,
                    backgroundColor: swatch,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: bg === 'theme' ? themes[themeName].primary : mushafPalettes[bg].quran,
                    }}
                  />
                  <Text
                    style={{
                      color: bg === 'theme' ? themes[themeName].text : mushafPalettes[bg].quran,
                      fontSize: fontSizes.xs * fontScale,
                      fontWeight: active ? '700' : '500',
                      fontFamily: fontFamilies.uiMedium,
                    }}
                  >
                    {mushafBgLabels[bg]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: tokens.muted, fontSize: fontSizes.xs * fontScale, fontFamily: fontFamilies.ui }}>
            خلفية مريحة للعين لصفحة القراءة فقط — لا تتغير بقية الواجهة
          </Text>
        </Card>

        {/* حجم الخط */}
        <Card style={{ gap: spacing.sm }}>
          <SectionTitle>حجم الخط</SectionTitle>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <StepButton
              label="−"
              onPress={() => setFontScale(fontScale - 0.05)}
              disabled={fontScale <= 0.75}
            />
            <Text
              style={{
                color: tokens.text,
                fontSize: fontSizes.lg * fontScale,
                fontFamily: fontFamilies.uiMedium,
                minWidth: 72,
                textAlign: 'center',
              }}
            >
              {Math.round(fontScale * 100)}٪
            </Text>
            <StepButton
              label="+"
              onPress={() => setFontScale(fontScale + 0.05)}
              disabled={fontScale >= 1.5}
            />
          </View>
          <Text
            style={{ color: tokens.muted, fontSize: fontSizes.xs * fontScale, fontFamily: fontFamilies.ui }}
          >
            من 75٪ إلى 150٪ — يُطبَّق على واجهة التطبيق
          </Text>
        </Card>

        {/* الورد اليومي */}
        <Card style={{ gap: spacing.sm }}>
          <SectionTitle>الورد اليومي</SectionTitle>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs }}>
            {GOAL_UNITS.map((u) => {
              const active = settings?.dailyGoalUnit === u.value;
              return (
                <Pressable
                  key={u.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => void updateGoal({ dailyGoalUnit: u.value })}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 40,
                    borderRadius: radius.sm,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? tokens.primary : tokens.border,
                    backgroundColor: active ? tokens.primary : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: active ? tokens.onPrimary : tokens.text,
                      fontSize: fontSizes.sm * fontScale,
                      fontWeight: '500',
                      fontFamily: fontFamilies.uiMedium,
                    }}
                  >
                    {u.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <StepButton
              label="−"
              onPress={() =>
                void updateGoal({
                  dailyGoalValue: Math.max(1, (settings?.dailyGoalValue ?? 20) - 1),
                })
              }
              disabled={(settings?.dailyGoalValue ?? 20) <= 1}
            />
            <Text
              style={{
                color: tokens.text,
                fontSize: fontSizes.lg * fontScale,
                fontFamily: fontFamilies.uiMedium,
                minWidth: 72,
                textAlign: 'center',
              }}
            >
              {settings?.dailyGoalValue ?? 20}
            </Text>
            <StepButton
              label="+"
              onPress={() =>
                void updateGoal({
                  dailyGoalValue: (settings?.dailyGoalValue ?? 20) + 1,
                })
              }
            />
          </View>
        </Card>

        <Button
          label="حول التطبيق"
          variant="outline"
          onPress={() => navigation.navigate('About')}
        />
      </ScrollView>
    </Screen>
  );
}

function StepButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { tokens, fontScale } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          color: tokens.primary,
          fontSize: fontSizes.lg * fontScale,
          fontWeight: '700',
          fontFamily: fontFamilies.uiBold,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
