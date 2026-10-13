/**
 * سمة التنقل — تُشتق من رموز التصميم (04-UX-UI-SPEC).
 * React Navigation يحترم I18nManager فيقلب الأشرطة تلقائيًا في RTL.
 */
import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { useTheme } from '../design-system/theme';

export function buildNavTheme(): Theme {
  const { tokens, isDark } = useTheme();
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: tokens.primary,
      background: tokens.background,
      card: tokens.surface,
      text: tokens.text,
      border: tokens.border,
      notification: tokens.accent,
    },
  };
}
