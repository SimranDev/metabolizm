/**
 * Custom entry point. Replaces the bare `expo-router/entry` main so the Android
 * home-screen widget task handler can be registered at bundle load — the OS
 * launches this bundle headless (no UI) for periodic widget updates, and the
 * handler must already be registered by then.
 */
import 'expo-router/entry';

import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  // Android-only: keep the widget renderer out of the iOS startup path.
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widgets/android/widget-task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
