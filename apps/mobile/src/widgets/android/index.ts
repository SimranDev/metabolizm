/**
 * Android side of widget sync: pushes the current payload to every added
 * instance of the three widgets. Only ever imported on Android (lazily, from
 * src/widgets/sync.ts).
 */

import { requestWidgetUpdate, type WidgetInfo } from 'react-native-android-widget';

import { WIDGET_NAMES, type WidgetDayData } from '../types';
import { renderCaloriePace, renderMacroBars, renderPlateRing } from './widgets';

type Renderer = (
  data: WidgetDayData,
  info: WidgetInfo,
  scheme: 'light' | 'dark',
) => React.JSX.Element;

export const RENDERERS: Record<string, Renderer> = {
  [WIDGET_NAMES.caloriePace]: renderCaloriePace,
  [WIDGET_NAMES.macroBars]: renderMacroBars,
  [WIDGET_NAMES.plateRing]: renderPlateRing,
};

export async function updateAndroidWidgets(data: WidgetDayData): Promise<void> {
  await Promise.all(
    Object.entries(RENDERERS).map(([widgetName, render]) =>
      requestWidgetUpdate({
        widgetName,
        renderWidget: (info) => ({
          light: render(data, info, 'light'),
          dark: render(data, info, 'dark'),
        }),
      }),
    ),
  );
}
