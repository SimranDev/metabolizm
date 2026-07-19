/**
 * The three Android home-screen widgets, built from react-native-android-widget
 * primitives (rendered natively to RemoteViews). Layout/text uses Flex/Text
 * widgets; decorative artwork (day arc, plate, ring, cutlery, steam) is
 * generated SVG — placeholder illustrations until final art is provided.
 *
 * These are plain render functions invoked by the task handler / update calls,
 * never mounted by React — no hooks, no fragments (the library's tree builder
 * only understands its own primitives and arrays), no app runtime imports.
 */
'use no memo';

import {
  FlexWidget,
  OverlapWidget,
  SvgWidget,
  TextWidget,
  type WidgetInfo,
} from 'react-native-android-widget';

import {
  arcPoint,
  clamp01,
  dayFraction,
  formatGrams,
  formatKcal,
  isNight,
  leadingMacroLabel,
  macroKcalFractions,
  paceStatus,
  svgArcPath,
} from '../format';
import { paletteFor, type WidgetPalette } from '../palette';
import type { WidgetDayData } from '../types';

type Scheme = 'light' | 'dark';

const PADDING = 14;
const CORNER_RADIUS = 16;

function contentWidth(info: WidgetInfo): number {
  return Math.max(96, info.width - PADDING * 2);
}

function container(
  colors: WidgetPalette,
  children: React.ReactNode,
  options?: { centered?: boolean },
): React.JSX.Element {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'column',
        alignItems: options?.centered ? 'center' : 'flex-start',
        justifyContent: options?.centered ? 'center' : 'flex-start',
        padding: PADDING,
        backgroundColor: colors.surface as `#${string}`,
        borderRadius: CORNER_RADIUS,
      }}
    >
      {children}
    </FlexWidget>
  );
}

function setupPrompt(colors: WidgetPalette): React.JSX.Element {
  return container(
    colors,
    [
      <TextWidget
        key="title"
        text="Metabolizm"
        style={{ fontSize: 15, fontWeight: 'bold', color: colors.ink as `#${string}` }}
      />,
      <TextWidget
        key="hint"
        text="Finish setup to see your day"
        style={{ fontSize: 11, color: colors.textSecondary as `#${string}`, marginTop: 2 }}
      />,
    ],
    { centered: true },
  );
}

/** Horizontal progress bar with an optional pace tick, as stacked frames. */
function progressBar(params: {
  width: number;
  fillFraction: number;
  trackColor: string;
  fillColor: string;
  tickFraction?: number;
  tickColor?: string;
  bead?: { color: string; surface: string };
}): React.JSX.Element {
  const { width, fillFraction, trackColor, fillColor, tickFraction, tickColor, bead } = params;
  const fillW = fillFraction > 0 ? Math.max(10, Math.round(fillFraction * width)) : 0;
  return (
    <OverlapWidget style={{ width, height: 10 }}>
      <FlexWidget
        style={{
          width,
          height: 6,
          marginTop: 2,
          borderRadius: 3,
          backgroundColor: trackColor as `#${string}`,
        }}
      />
      {fillW > 0 ? (
        <FlexWidget
          style={{
            width: fillW,
            height: 6,
            marginTop: 2,
            borderRadius: 3,
            backgroundColor: fillColor as `#${string}`,
          }}
        />
      ) : null}
      {bead && fillW > 0 ? (
        <FlexWidget
          style={{
            width: 10,
            height: 10,
            marginLeft: Math.max(0, fillW - 10),
            borderRadius: 5,
            borderWidth: 2,
            borderColor: bead.color as `#${string}`,
            backgroundColor: bead.surface as `#${string}`,
          }}
        />
      ) : null}
      {tickFraction != null ? (
        <FlexWidget
          style={{
            width: 2,
            height: 10,
            marginLeft: Math.round(clamp01(tickFraction) * (width - 2)),
            borderRadius: 1,
            backgroundColor: (tickColor ?? '#C5CFC8') as `#${string}`,
          }}
        />
      ) : null}
    </OverlapWidget>
  );
}

// ---------------------------------------------------------------------------
// A · Pace + day arc
// ---------------------------------------------------------------------------

function dayArcSvg(width: number, height: number, timeFrac: number, night: boolean, colors: WidgetPalette): string {
  const cx = width / 2;
  const cy = height - 4;
  const radius = Math.min(height - 12, width / 2 - 12);
  const parts: string[] = [];
  for (let i = 0; i <= 12; i++) {
    const p = arcPoint(i / 12, radius);
    parts.push(`<circle cx="${cx + p.x}" cy="${cy + p.y}" r="1.5" fill="${colors.border}"/>`);
  }
  const end = arcPoint(1, radius);
  parts.push(
    `<circle cx="${cx + end.x}" cy="${cy + end.y}" r="4" fill="none" stroke="${colors.border}" stroke-width="1.5"/>`,
  );
  const orb = arcPoint(timeFrac, radius);
  const ox = cx + orb.x;
  const oy = cy + orb.y;
  if (night) {
    parts.push(`<circle cx="${ox}" cy="${oy}" r="5" fill="${colors.moon}"/>`);
    parts.push(`<circle cx="${ox + 2.5}" cy="${oy - 1.5}" r="4" fill="${colors.surface}"/>`);
  } else {
    parts.push(`<circle cx="${ox}" cy="${oy}" r="4.5" fill="${colors.sun}"/>`);
    for (let ray = 0; ray < 8; ray++) {
      const a = (ray * Math.PI) / 4;
      const x1 = ox + Math.cos(a) * 6.5;
      const y1 = oy + Math.sin(a) * 6.5;
      const x2 = ox + Math.cos(a) * 8.5;
      const y2 = oy + Math.sin(a) * 8.5;
      parts.push(
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors.sun}" stroke-width="1.5" stroke-linecap="round"/>`,
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`;
}

export function renderCaloriePace(
  data: WidgetDayData,
  info: WidgetInfo,
  scheme: Scheme,
): React.JSX.Element {
  const colors = paletteFor(scheme);
  if (!data.hasProfile) return setupPrompt(colors);

  const now = new Date();
  const width = contentWidth(info);
  const remaining = Math.max(0, data.targetCalories - data.consumedCalories);
  const consumedFrac = clamp01(data.consumedCalories / Math.max(1, data.targetCalories));
  const timeFrac = dayFraction(now);
  const status = paceStatus(data, now);
  const statusColor =
    status.tone === 'ok'
      ? colors.success
      : status.tone === 'ahead'
        ? colors.macroCarbsText
        : colors.textTertiary;
  const arcHeight = 44;

  return container(
    colors,
    [
      <OverlapWidget key="arc" style={{ width, height: arcHeight }}>
        <SvgWidget
          svg={dayArcSvg(width, arcHeight, timeFrac, isNight(now), colors)}
          style={{ width, height: arcHeight }}
        />
        <TextWidget
          text="CALORIES"
          style={{
            fontSize: 11,
            fontWeight: '600',
            letterSpacing: 0.12,
            color: colors.textSecondary as `#${string}`,
          }}
        />
      </OverlapWidget>,
      <FlexWidget key="spacer" style={{ flex: 1 }} />,
      <TextWidget
        key="kcal"
        text={formatKcal(remaining)}
        style={{ fontSize: 28, fontWeight: 'bold', color: colors.ink as `#${string}` }}
      />,
      <TextWidget
        key="caption"
        text="kcal remaining"
        style={{ fontSize: 11, color: colors.textSecondary as `#${string}`, marginBottom: 6 }}
      />,
      progressBar({
        width,
        fillFraction: consumedFrac,
        trackColor: colors.track,
        fillColor: colors.ink,
        tickFraction: timeFrac,
        tickColor: colors.border,
      }),
      <TextWidget
        key="status"
        text={status.label}
        style={{
          fontSize: 11,
          fontWeight: '500',
          color: statusColor as `#${string}`,
          marginTop: 4,
        }}
      />,
    ],
  );
}

// ---------------------------------------------------------------------------
// B · Macro bars + food marks
// ---------------------------------------------------------------------------

export function renderMacroBars(
  data: WidgetDayData,
  info: WidgetInfo,
  scheme: Scheme,
): React.JSX.Element {
  const colors = paletteFor(scheme);
  if (!data.hasProfile) return setupPrompt(colors);

  const width = contentWidth(info);
  const rows = [
    {
      label: 'Carbs',
      color: colors.macroCarbs,
      soft: colors.macroCarbsSoft,
      text: colors.macroCarbsText,
      macro: data.carbs,
    },
    {
      label: 'Fat',
      color: colors.macroFat,
      soft: colors.macroFatSoft,
      text: colors.macroFatText,
      macro: data.fat,
    },
    {
      label: 'Protein',
      color: colors.macroProtein,
      soft: colors.macroProteinSoft,
      text: colors.macroProteinText,
      macro: data.protein,
    },
  ];

  return container(
    colors,
    [
      <FlexWidget
        key="header"
        style={{ width, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <TextWidget
          text="MACROS"
          style={{
            fontSize: 11,
            fontWeight: '600',
            letterSpacing: 0.12,
            color: colors.textSecondary as `#${string}`,
          }}
        />
        <TextWidget
          text={formatKcal(data.consumedCalories)}
          style={{ fontSize: 15, fontWeight: 'bold', color: colors.ink as `#${string}` }}
        />
      </FlexWidget>,
      ...rows.map((row) => (
        <FlexWidget
          key={row.label}
          style={{ width, flexDirection: 'column', marginTop: 6 }}
        >
          <FlexWidget
            style={{
              width,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 3,
            }}
          >
            <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
              <FlexWidget
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: row.color as `#${string}`,
                  marginRight: 5,
                }}
              />
              <TextWidget
                text={row.label}
                style={{ fontSize: 12, fontWeight: '600', color: row.text as `#${string}` }}
              />
            </FlexWidget>
            <TextWidget
              text={formatGrams(row.macro.consumedG)}
              style={{ fontSize: 12, fontWeight: 'bold', color: colors.ink as `#${string}` }}
            />
          </FlexWidget>
          {progressBar({
            width,
            fillFraction: clamp01(row.macro.targetG > 0 ? row.macro.consumedG / row.macro.targetG : 0),
            trackColor: row.soft,
            fillColor: row.color,
            bead: row.macro.consumedG > 0 ? { color: row.color, surface: colors.surface } : undefined,
          })}
        </FlexWidget>
      )),
      <FlexWidget key="spacer" style={{ flex: 1 }} />,
      <TextWidget
        key="insight"
        text={`\u{1F331} ${leadingMacroLabel(data)}`}
        style={{ fontSize: 11, color: colors.textTertiary as `#${string}` }}
      />,
    ],
  );
}

// ---------------------------------------------------------------------------
// C · Plate + cutlery
// ---------------------------------------------------------------------------

function plateSvg(size: number, data: WidgetDayData, colors: WidgetPalette): string {
  const c = size / 2;
  const plateR = size * 0.34;
  const rimR = size * 0.225;
  const ringR = size * 0.415;
  const parts: string[] = [];

  // Cutlery placeholders: fork tines left, knife right.
  const forkX = c - ringR - size * 0.07;
  const knifeX = c + ringR + size * 0.07;
  const utensilTop = c - size * 0.14;
  const utensilBottom = c + size * 0.16;
  for (const dx of [-3, 0, 3]) {
    parts.push(
      `<line x1="${forkX + dx}" y1="${utensilTop}" x2="${forkX + dx}" y2="${utensilTop + 10}" stroke="${colors.border}" stroke-width="1.8" stroke-linecap="round"/>`,
    );
  }
  parts.push(
    `<line x1="${forkX}" y1="${utensilTop + 10}" x2="${forkX}" y2="${utensilBottom}" stroke="${colors.border}" stroke-width="1.8" stroke-linecap="round"/>`,
    `<path d="M ${knifeX - 2} ${utensilTop} Q ${knifeX + 4} ${utensilTop + 8} ${knifeX} ${utensilTop + 14} L ${knifeX} ${utensilBottom}" fill="none" stroke="${colors.border}" stroke-width="1.8" stroke-linecap="round"/>`,
  );

  // Plate + inner rim.
  parts.push(
    `<circle cx="${c}" cy="${c}" r="${plateR}" fill="${colors.surface}" stroke="${colors.track}" stroke-width="1"/>`,
    `<circle cx="${c}" cy="${c}" r="${rimR}" fill="none" stroke="${colors.track}" stroke-width="1.5"/>`,
  );

  // Macro ring: gray track + consumed arcs (carbs → fat → protein).
  parts.push(
    `<circle cx="${c}" cy="${c}" r="${ringR}" fill="none" stroke="${colors.track}" stroke-width="5"/>`,
  );
  const fractions = macroKcalFractions(data);
  const segments = [
    { fraction: fractions.carbs, color: colors.macroCarbs },
    { fraction: fractions.fat, color: colors.macroFat },
    { fraction: fractions.protein, color: colors.macroProtein },
  ];
  let cursor = 0;
  for (const segment of segments) {
    if (segment.fraction <= 0.005) continue;
    const start = cursor * 360;
    const end = Math.min(0.999, cursor + segment.fraction) * 360;
    parts.push(
      `<path d="${svgArcPath(c, c, ringR, start, end)}" fill="none" stroke="${segment.color}" stroke-width="5" stroke-linecap="round"/>`,
    );
    cursor += segment.fraction;
    if (cursor >= 1) break;
  }

  // Steam once a meal is logged.
  if (data.mealsLogged > 0) {
    const steamY = c - plateR - 4;
    for (const dx of [-7, 0, 7]) {
      parts.push(
        `<path d="M ${c + dx} ${steamY} q 2 -3 0 -6 q -2 -3 0 -6" fill="none" stroke="${colors.textTertiary}" stroke-width="1.5" stroke-linecap="round" opacity="0.35"/>`,
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${parts.join('')}</svg>`;
}

export function renderPlateRing(
  data: WidgetDayData,
  info: WidgetInfo,
  scheme: Scheme,
): React.JSX.Element {
  const colors = paletteFor(scheme);
  if (!data.hasProfile) return setupPrompt(colors);

  const remaining = Math.max(0, data.targetCalories - data.consumedCalories);
  const size = Math.max(96, Math.min(info.width, info.height) - PADDING * 2 - 18);
  const legend = [
    { color: colors.macroCarbs, text: colors.macroCarbsText, grams: data.carbs.consumedG },
    { color: colors.macroFat, text: colors.macroFatText, grams: data.fat.consumedG },
    { color: colors.macroProtein, text: colors.macroProteinText, grams: data.protein.consumedG },
  ];

  return container(
    colors,
    [
      <OverlapWidget key="plate" style={{ width: size, height: size }}>
        <SvgWidget svg={plateSvg(size, data, colors)} style={{ width: size, height: size }} />
        <FlexWidget
          style={{
            width: size,
            height: size,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TextWidget
            text={formatKcal(remaining)}
            style={{ fontSize: 19, fontWeight: 'bold', color: colors.ink as `#${string}` }}
          />
          <TextWidget
            text="kcal left"
            style={{ fontSize: 10, color: colors.textSecondary as `#${string}` }}
          />
        </FlexWidget>
      </OverlapWidget>,
      <FlexWidget key="legend" style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
        {legend.map((item, index) => (
          <FlexWidget
            key={`legend-${index}`}
            style={{ flexDirection: 'row', alignItems: 'center', marginLeft: index === 0 ? 0 : 10 }}
          >
            <FlexWidget
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: item.color as `#${string}`,
                marginRight: 3,
              }}
            />
            <TextWidget
              text={formatGrams(item.grams)}
              style={{ fontSize: 10, fontWeight: '600', color: item.text as `#${string}` }}
            />
          </FlexWidget>
        ))}
      </FlexWidget>,
    ],
    { centered: true },
  );
}
