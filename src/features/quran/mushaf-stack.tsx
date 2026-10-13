/**
 * «المصحف» — Stack (المرحلة 2): فهرس السور + البحث ← شاشة السورة.
 * + مراقب جلسة القراءة (المرحلة 3): تُنهى الجلسة عند مغادرة تبويب المصحف
 *   أو إخفاء التطبيق (قواعد R1–R3 في reading-session-repository.ts).
 * المرجع: 06-IMPLEMENTATION-PLAN (المراحل 2–3) و 07-ACCEPTANCE-TESTS (A).
 */
import { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import { AppState, Platform } from 'react-native';
import { useTheme } from '../../design-system/theme';
import { MushafHomeScreen } from './mushaf-home-screen';
import { SurahScreen } from './surah-screen';
import { getReadingSessionTracker } from '../../repositories/reading-session-tracker';

export type MushafStackParamList = {
  MushafHome: undefined;
  Surah: { surahNumber: number; ayahNumber?: number };
};

const Stack = createNativeStackNavigator<MushafStackParamList>();

/** يُنهى الجلسة عند مغادرة التبويب (أو إخفاء التطبيق) — دون تسجيل دون قراءة فعلية */
function SessionWatcher() {
  const focused = useIsFocused();

  useEffect(() => {
    if (!focused) {
      getReadingSessionTracker().end();
    }
  }, [focused]);

  // الويب: إغلاق/إخفاء التبويب
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onHide = () => getReadingSessionTracker().end();
    const onVis = () => {
      if (document.visibilityState === 'hidden') getReadingSessionTracker().end();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // أجهزة: انتقال التطبيق للخلفية — تُنهى الجلسة فلا تبقى مفتوحة (R3)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') getReadingSessionTracker().end();
    });
    return () => sub.remove();
  }, []);

  return null;
}

export function MushafStack() {
  const { tokens } = useTheme();
  return (
    <>
      <SessionWatcher />
      <Stack.Navigator
        initialRouteName="MushafHome"
        screenOptions={{
          headerStyle: { backgroundColor: tokens.background },
          headerTintColor: tokens.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: tokens.background },
        }}
      >
        <Stack.Screen name="MushafHome" component={MushafHomeScreen} options={{ title: 'المصحف' }} />
        <Stack.Screen name="Surah" component={SurahScreen} />
      </Stack.Navigator>
    </>
  );
}

export type MushafScreenProps<T extends keyof MushafStackParamList> = NativeStackScreenProps<
  MushafStackParamList,
  T
>;
