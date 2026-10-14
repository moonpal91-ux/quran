/**
 * نقطة دخول التطبيق — تسلسل الإقلاع (المرحلة 1):
 * 1) فتح قاعدة بيانات المستخدم (Realm) — الفشل يعرض رسالة واضحة ولا يُخفى.
 * 2) تحميل الخطوط المضمّنة (يعمل دون اتصال).
 * 3) سمة + تنقل: الرئيسية | المصحف | الأذكار | مكتبتي
 */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { openAppRealm } from './src/database/realm/realm';
import { loadAppFonts } from './src/design-system/fonts';
import { ThemeProvider } from './src/design-system/theme';
import { fontFamilies, fontSizes, themes } from './src/design-system/tokens';
import { ensureContentMetadata } from './src/features/quran/quran-content';
import { getReadingSessionRepository } from './src/repositories/reading-session-repository';
import { RootNavigator } from './src/app/root-navigator';
import { buildNavTheme } from './src/app/navigation-theme';

type Phase =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready' };

export default function App() {
  const [phase, setPhase] = useState<Phase>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await openAppRealm();
        // تسجيل Metadata المحتوى (سجل واحد ثابت) + فحص بنيوي خفيف للحزمة
        ensureContentMetadata();
        // R4: إنهاء أي جلسة مفتوحة من تشغيل سابق (انغلاق/سقوط) — دون تكرار سجلات
        getReadingSessionRepository().closeOpenSessions();
        await loadAppFonts();
        if (!cancelled) setPhase({ state: 'ready' });
      } catch (e) {
        if (cancelled) return;
        const message =
          e && typeof e === 'object' && 'message' in e
            ? String((e as { message: unknown }).message)
            : String(e);
        setPhase({ state: 'error', message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaProvider>
      {phase.state === 'error' ? (
        <BootScreen
          title="تعذر إقلاع التطبيق"
          message={`حدث خطأ أثناء التهيئة: ${phase.message}`}
        />
      ) : phase.state === 'loading' ? (
        <BootScreen title="رفيق القرآن الكريم" message="جارٍ التحضير…" />
      ) : (
        <ThemeProvider>
          <ThemedNavigation />
        </ThemeProvider>
      )}
    </SafeAreaProvider>
  );
}

function ThemedNavigation() {
  const theme = buildNavTheme();
  return (
    <>
      <StatusBar style="auto" />
      <NavigationContainer theme={theme}>
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}

/** شاشة الإقلاع/الخطأ — قبل تهيئة السمة، تستخدم الرموز الفاتحة مباشرة */
function BootScreen({ title, message }: { title: string; message: string }) {
  const tokens = themes.light;
  const isError = title === 'تعذر إقلاع التطبيق';
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: tokens.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}
    >
      <Text
        style={{
          color: tokens.primary,
          fontSize: fontSizes.xxl,
          fontWeight: '700',
          fontFamily: fontFamilies.uiBold,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          marginTop: 12,
          color: isError ? tokens.error : tokens.muted,
          fontSize: fontSizes.md,
          fontFamily: fontFamilies.ui,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
      <Text
        style={{
          position: 'absolute',
          bottom: 24,
          color: tokens.muted,
          fontSize: fontSizes.xs,
          fontFamily: fontFamilies.ui,
        }}
      >
        حقوق المصمم والمطور: إيهاب عجور أبو الأمير
      </Text>
    </SafeAreaView>
  );
}
