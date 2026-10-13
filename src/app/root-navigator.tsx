/**
 * الموجّه الجذري — شريط سفلي بخمسة تبويبات (01-PRODUCT-SPEC §6):
 * الرئيسية | المصحف | الأذكار | الاستماع | مكتبتي
 *
 * «المصحف» (المرحلة 2) أصبح Stack داخلي: فهرس السور + البحث ← شاشة السورة.
 * خريطة الشاشات الكاملة موثقة في docs/SCREEN-MAP.md
 */
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../design-system/theme';
import { HomeScreen } from '../features/home/home-screen';
import { MushafStack, type MushafStackParamList } from '../features/quran/mushaf-stack';
import { AdhkarScreen } from '../features/adhkar/adhkar-screen';
import { AudioScreen } from '../features/audio/audio-screen';
import { LibraryStack } from '../features/library/library-stack';

/** أسماء التبويبات — تُستخدم في التنقل بين الشاشات */
export type RootTabParamList = {
  'الرئيسية': undefined;
  'المصحف': NavigatorScreenParams<MushafStackParamList> | undefined;
  'الأذكار': undefined;
  'الاستماع': undefined;
  'مكتبتي': undefined;
};

export type RootTabNavigation = BottomTabNavigationProp<RootTabParamList>;

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICONS: Record<keyof RootTabParamList, keyof typeof MaterialCommunityIcons.glyphMap> = {
  'الرئيسية': 'home',
  'المصحف': 'book-open-variant',
  'الأذكار': 'hand-peace',
  'الاستماع': 'headphones',
  'مكتبتي': 'library',
};

export function RootNavigator() {
  const { tokens } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: tokens.primary,
        tabBarInactiveTintColor: tokens.muted,
        tabBarStyle: {
          backgroundColor: tokens.surface,
          borderTopColor: tokens.border,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
        sceneStyle: { backgroundColor: tokens.background },
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons name={TAB_ICONS[route.name]} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen name="الرئيسية" component={HomeScreen} />
      <Tab.Screen name="المصحف" component={MushafStack} />
      <Tab.Screen name="الأذكار" component={AdhkarScreen} />
      <Tab.Screen name="الاستماع" component={AudioScreen} />
      <Tab.Screen name="مكتبتي" component={LibraryStack} />
    </Tab.Navigator>
  );
}
