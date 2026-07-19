/**
 * Headless entry the OS invokes for Android widget lifecycle events (added,
 * periodic update, resized). Runs in the RN runtime without UI: the MMKV-backed
 * diary store hydrates synchronously on import; the AsyncStorage-backed profile
 * store is awaited before rendering.
 */

import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { buildWidgetData, waitForProfileHydration } from '../data';
import { RENDERERS } from './index';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const render = RENDERERS[props.widgetInfo.widgetName];
  if (!render) return;

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      await waitForProfileHydration();
      const data = buildWidgetData();
      props.renderWidget({
        light: render(data, props.widgetInfo, 'light'),
        dark: render(data, props.widgetInfo, 'dark'),
      });
      break;
    }
    default:
      // WIDGET_DELETED / WIDGET_CLICK need no work: taps use the native
      // OPEN_APP click action and there is no per-widget state to clean up.
      break;
  }
}
