/**
 * موفّر السمة — يدير الوضع (فاتح/داكن/دافئ) وحجم الخط ويحفظهما في Realm.
 * الفصل عن طبقة البيانات عبر SettingsRepository فقط.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { themes, themeLabels, type ThemeName, type ThemeTokens } from './tokens';
import { getSettingsRepository } from '../repositories/settings-repository';

interface ThemeContextValue {
  tokens: ThemeTokens;
  themeName: ThemeName;
  fontScale: number;
  themeLabels: Record<ThemeName, string>;
  isDark: boolean;
  settingsLoaded: boolean;
  setTheme: (name: ThemeName) => void;
  setFontScale: (scale: number) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>('light');
  const [fontScale, setFontScaleState] = useState(1.0);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettingsRepository()
      .getSettings()
      .then((s) => {
        if (cancelled) return;
        setThemeName(s.theme);
        setFontScaleState(s.fontScale);
        setSettingsLoaded(true);
      })
      .catch((e) => {
        console.warn('[theme] تعذر قراءة الإعدادات، استخدام الافتراضي', e);
        if (!cancelled) setSettingsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback((name: ThemeName) => {
    setThemeName(name);
    void getSettingsRepository().updateSettings({ theme: name });
  }, []);

  const setFontScale = useCallback((scale: number) => {
    const clamped = Math.min(1.5, Math.max(0.75, scale));
    setFontScaleState(clamped);
    void getSettingsRepository().updateSettings({ fontScale: clamped });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      tokens: themes[themeName],
      themeName,
      fontScale,
      themeLabels,
      isDark: themeName === 'dark',
      settingsLoaded,
      setTheme,
      setFontScale,
    }),
    [themeName, fontScale, settingsLoaded, setTheme, setFontScale],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme يجب استخدامه داخل ThemeProvider');
  }
  return ctx;
}
