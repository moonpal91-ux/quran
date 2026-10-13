/**
 * شاشة «حول التطبيق» — متطلب إلزامي (01-§8): عرض حقوق المصمم والمطور
 * وشفافية مصادر المحتوى وتراخيصها (01-7، 05).
 */
import { Linking, ScrollView, Text, View } from 'react-native';
import { Screen, Card, SectionTitle } from '../../design-system/components';
import { useTheme } from '../../design-system/theme';
import { fontFamilies, fontSizes, spacing } from '../../design-system/tokens';
import appConfig from '../../../app.json';

export function AboutScreen() {
  const { tokens, fontScale } = useTheme();
  const version = (appConfig as { expo?: { version?: string } }).expo?.version ?? '0.1.0';

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Card style={{ alignItems: 'center', gap: spacing.xs }}>
          <Text
            style={{
              color: tokens.primary,
              fontSize: fontSizes.xl * fontScale,
              fontWeight: '700',
              fontFamily: fontFamilies.uiBold,
            }}
          >
            رفيق القرآن الكريم
          </Text>
          <Text style={{ color: tokens.muted, fontSize: fontSizes.sm * fontScale, fontFamily: fontFamilies.ui }}>
            الإصدار {version}
          </Text>
        </Card>

        <Card style={{ gap: spacing.xs }}>
          <SectionTitle>الحقوق</SectionTitle>
          <Text style={[text(tokens, fontScale)]}>حقوق المصمم والمطور: إيهاب عجور أبو الأمير</Text>
          <Text style={[text(tokens, fontScale), { color: tokens.muted }]}>
            جميع الحقوق محفوظة — لا يُنسخ التطبيق أو يُوزَّع دون إذن صريح.
          </Text>
        </Card>

        <Card style={{ gap: spacing.xs }}>
          <SectionTitle>مصادر المحتوى والتراخيص</SectionTitle>
          <Text style={[text(tokens, fontScale)]}>
            نص القرآن الكريم: Tanzil Project — Tanzil Quran Text (Uthmani) الإصدار 1.1
          </Text>
          <Text style={[text(tokens, fontScale), { color: tokens.muted }]}>
            الترخيص: Creative Commons Attribution 3.0 (نسخ حرفية دون تغيير مع نسبة المصدر)
          </Text>
          <Text
            onPress={() => void Linking.openURL('https://tanzil.net/')}
            style={[text(tokens, fontScale), { color: tokens.primary }]}
          >
            tanzil.net
          </Text>
          <Text style={[text(tokens, fontScale), { color: tokens.muted }]}>
            يُعرض النص بالرسم العثماني حرفيًا (Tanzil v1.1) دون أي تغيير — والتطبيع للبحث فقط.
          </Text>
          <View style={{ height: spacing.xs }} />
          <Text style={[text(tokens, fontScale)]}>
            التفسير: ابن كثير (ت 1373هـ) والبغوي — معاني القرآن (ت 516هـ) — نصوص كلاسيكية في الملك العام
          </Text>
          <Text style={[text(tokens, fontScale), { color: tokens.muted }]}>
            مُوزَّعة عبر api.quran.com مع اعتماد بصمات SHA-256 وبوابة فحص (سجل الاعتماد في حزمة الإصدار)
          </Text>
          <View style={{ height: spacing.xs }} />
          <Text style={[text(tokens, fontScale)]}>
            الأذكار: حصن المسلم من أذكار الكتاب والسنة (د. سعيد القحطاني) — نص ديني في الملك العام
          </Text>
          <Text style={[text(tokens, fontScale), { color: tokens.muted }]}>
            اعتمد عبر بوابة فحص (345 ذكرًا / 135 فئة) مع تحقق مستقل (MIT)؛ الآيات المعروضة من Tanzil المعتمد
          </Text>
          <View style={{ height: spacing.xs }} />
          <Text style={[text(tokens, fontScale)]}>خط الواجهة: Tajawal — OFL (Boutros International)</Text>
          <Text style={[text(tokens, fontScale)]}>خط المصحف: Amiri Quran — OFL (Amiri Project)</Text>
          <Text style={[text(tokens, fontScale)]}>قاعدة البيانات المحلية: Realm — Apache 2.0</Text>
        </Card>

        <Card style={{ gap: spacing.xs }}>
          <SectionTitle>الخصوصية</SectionTitle>
          <Text style={[text(tokens, fontScale), { color: tokens.muted }]}>
            جميع بياناتك (الإعدادات والعلامات والملاحظات والتقدم) تُخزَّن محليًا على جهازك فقط،
            ولا تُرسل إلى أي خدمة خارجية، ولا يلزمك إنشاء حساب.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function text(tokens: ReturnType<typeof useTheme>['tokens'], fontScale: number) {
  return {
    color: tokens.text,
    fontSize: fontSizes.sm * fontScale,
    fontFamily: fontFamilies.ui,
    lineHeight: fontSizes.sm * fontScale * 1.8,
  } as const;
}
