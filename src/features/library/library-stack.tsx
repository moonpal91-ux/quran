/**
 * «مكتبتي» — Stack: العلامات | المفضلة | الملاحظات | الخطط | التنزيلات | الإعدادات | حول التطبيق
 * (01-PRODUCT-SPEC §6)
 */
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../design-system/theme';
import { LibraryHomeScreen } from './library-home-screen';
import { BookmarksScreen } from './bookmarks-screen';
import { FavoritesScreen } from './favorites-screen';
import { NotesScreen } from './notes-screen';
import { SessionsScreen } from './sessions-screen';
import { PlansScreen } from './plans-screen';
import { DownloadsScreen } from './downloads-screen';
import { SettingsScreen } from './settings-screen';
import { AboutScreen } from './about-screen';

export type LibraryStackParamList = {
  LibraryHome: undefined;
  Bookmarks: undefined;
  Favorites: undefined;
  Notes: undefined;
  Sessions: undefined;
  Plans: undefined;
  Downloads: undefined;
  Settings: undefined;
  About: undefined;
};

const Stack = createNativeStackNavigator<LibraryStackParamList>();

export function LibraryStack() {
  const { tokens } = useTheme();
  return (
    <Stack.Navigator
      initialRouteName="LibraryHome"
      screenOptions={{
        headerStyle: { backgroundColor: tokens.background },
        headerTintColor: tokens.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: tokens.background },
      }}
    >
      <Stack.Screen
        name="LibraryHome"
        component={LibraryHomeScreen}
        options={{ title: 'مكتبتي', headerShown: false }}
      />
      <Stack.Screen name="Bookmarks" component={BookmarksScreen} options={{ title: 'العلامات المرجعية' }} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'المفضلة' }} />
      <Stack.Screen name="Notes" component={NotesScreen} options={{ title: 'الملاحظات' }} />
      <Stack.Screen name="Sessions" component={SessionsScreen} options={{ title: 'سجل القراءة' }} />
      <Stack.Screen name="Plans" component={PlansScreen} options={{ title: 'الخطط' }} />
      <Stack.Screen name="Downloads" component={DownloadsScreen} options={{ title: 'التنزيلات' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'الإعدادات' }} />
      <Stack.Screen name="About" component={AboutScreen} options={{ title: 'حول التطبيق' }} />
    </Stack.Navigator>
  );
}

export type LibraryScreenProps<T extends keyof LibraryStackParamList> = NativeStackScreenProps<
  LibraryStackParamList,
  T
>;
