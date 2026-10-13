/**
 * مكونات النظام المصممي — هوية هادئة: بطاقات بسيطة، مساحات مريحة، أهداف لمس ≥ 44.
 * المرجع: 04-UX-UI-SPEC.md
 */
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { fontFamilies, fontSizes, radius, spacing, touchTarget } from './tokens';

/** شاشة أساسية بخلفية السمة ومسافة افتراضية */
export function Screen({
  children,
  style,
  edges,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  const { tokens } = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: tokens.background }, style]} edges={edges ?? ['top', 'bottom', 'left', 'right']}>
      {children}
    </SafeAreaView>
  );
}

/** بطاقة سطح فاتح بحافة خفيفة */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: tokens.surface,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: tokens.border,
          padding: spacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** عنوان قسم */
export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { tokens, fontScale } = useTheme();
  return (
    <Text
      style={[
        {
          color: tokens.text,
          fontSize: fontSizes.md * fontScale,
          fontWeight: '700',
          fontFamily: fontFamilies.uiBold,
          marginBottom: spacing.sm,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** زر أساسي — هدف لمس ≥ 44، حالات (عادي/معطّل/ضغطة) */
export function Button({ label, onPress, variant = 'primary', disabled, style }: ButtonProps) {
  const { tokens, fontScale } = useTheme();
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: touchTarget,
          borderRadius: radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
          backgroundColor: isPrimary ? tokens.primary : 'transparent',
          borderWidth: isOutline ? 1 : 0,
          borderColor: isOutline ? tokens.primary : 'transparent',
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: isPrimary ? tokens.onPrimary : isOutline ? tokens.primary : tokens.text,
          fontSize: fontSizes.md * fontScale,
          fontWeight: '500',
          fontFamily: fontFamilies.uiMedium,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** حالة فارغة هادئة — تُظهر بصدق أن المحتوى غير متاح بعد (لا أزرار وهمية) */
export function EmptyState({
  title,
  subtitle,
  stage,
}: {
  title: string;
  subtitle?: string;
  stage?: string;
}) {
  const { tokens, fontScale } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.sm,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          borderWidth: 1.5,
          borderColor: tokens.accent,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xs,
        }}
      >
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: tokens.accent, opacity: 0.55 }} />
      </View>
      <Text
        style={{
          color: tokens.text,
          fontSize: fontSizes.lg * fontScale,
          fontWeight: '700',
          fontFamily: fontFamilies.uiBold,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            color: tokens.muted,
            fontSize: fontSizes.sm * fontScale,
            fontFamily: fontFamilies.ui,
            textAlign: 'center',
            lineHeight: fontSizes.sm * fontScale * 1.7,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
      {stage ? (
        <Text
          style={{
            marginTop: spacing.sm,
            color: tokens.muted,
            fontSize: fontSizes.xs * fontScale,
            fontFamily: fontFamilies.ui,
            backgroundColor: tokens.border,
            borderRadius: radius.full,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
          }}
        >
          {stage}
        </Text>
      ) : null}
    </View>
  );
}

/** صف قائمة (مكتبة) — مع إجراء اختياري على الطرف */
export function ListRow({
  title,
  subtitle,
  trailing,
  onPress,
  showChevron,
}: {
  title: string;
  subtitle?: string;
  trailing?: string;
  onPress?: () => void;
  showChevron?: boolean;
}) {
  const { tokens, fontScale } = useTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
      {showChevron ? (
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: tokens.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.accent }} />
        </View>
      ) : null}
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
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={{
              color: tokens.muted,
              fontSize: fontSizes.sm * fontScale,
              fontFamily: fontFamilies.ui,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <Text
          style={{
            color: tokens.muted,
            fontSize: fontSizes.sm * fontScale,
            fontFamily: fontFamilies.ui,
          }}
        >
          {trailing}
        </Text>
      ) : null}
    </View>
  );
  if (!onPress) {
    return <View style={[styles.rowBase, { borderColor: tokens.border }]}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.rowBase,
        { borderColor: tokens.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  rowBase: {
    backgroundColor: '#FFFFFF00',
    borderRadius: radius.sm,
    borderWidth: 1,
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
});
