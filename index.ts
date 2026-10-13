import { I18nManager, Platform } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';

// التطبيق عربي RTL افتراضيًا — RTL فعلي على مستوى التخطيط وليس محاذاة نص فقط (04-10)
if (Platform.OS === 'web') {
  // على الويب: RTL عبر سمات DOM (I18nManager لا يقلب التخطيط في متصفح الويب)
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ar');
  }
} else {
  I18nManager.forceRTL(true);
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
