/**
 * iOS side of widget sync: registers the three expo-widgets instances and
 * pushes a timeline on every data change. Only ever imported on iOS (lazily,
 * from src/widgets/sync.ts) — the Android expo-widgets module is a stub.
 *
 * Timeline shape: an entry now, one per upcoming hour (WidgetKit re-renders
 * each entry with its own `environment.date`, which moves the sun/pace tick
 * through the day without the app running), and a zeroed entry at midnight so
 * the widgets roll over to a fresh day.
 */

import { createWidget, type WidgetTimelineEntry } from 'expo-widgets';

import { todayKey } from '@/store/diary';

import { emptyDay, WIDGET_NAMES, type WidgetDayData } from '../types';
import { CaloriePaceWidget, MacroBarsWidget, PlateRingWidget } from './widgets';

const caloriePace = createWidget<WidgetDayData>(WIDGET_NAMES.caloriePace, CaloriePaceWidget);
const macroBars = createWidget<WidgetDayData>(WIDGET_NAMES.macroBars, MacroBarsWidget);
const plateRing = createWidget<WidgetDayData>(WIDGET_NAMES.plateRing, PlateRingWidget);

function buildTimeline(data: WidgetDayData, now = new Date()): WidgetTimelineEntry<WidgetDayData>[] {
  const entries: WidgetTimelineEntry<WidgetDayData>[] = [{ date: now, props: data }];

  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);

  const hourly = new Date(now);
  hourly.setMinutes(0, 0, 0);
  for (;;) {
    hourly.setHours(hourly.getHours() + 1);
    if (hourly.getTime() >= midnight.getTime()) break;
    entries.push({ date: new Date(hourly), props: data });
  }

  entries.push({ date: midnight, props: emptyDay(todayKey(midnight), data) });
  return entries;
}

export function updateIosWidgets(data: WidgetDayData): void {
  const timeline = buildTimeline(data);
  caloriePace.updateTimeline(timeline);
  macroBars.updateTimeline(timeline);
  plateRing.updateTimeline(timeline);
}
