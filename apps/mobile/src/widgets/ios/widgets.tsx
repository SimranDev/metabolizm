/**
 * The three iOS home-screen widgets, authored as expo-widgets `'widget'`
 * components rendered natively by WidgetKit.
 *
 * CONSTRAINT — self-contained functions only: the babel transform extracts
 * each directive-marked function's own source as a string and evaluates it in
 * the widget extension, where the only ambient names are `@expo/ui/swift-ui`
 * components/modifiers (provided as globals) and JS builtins. Module-level
 * helpers, constants, or components referenced from inside a widget function
 * would be ReferenceErrors at render time — every widget below therefore
 * inlines its palette, formatting, and math (duplication is the platform's
 * price). Avoid object/array spread inside the functions: those compile to
 * module-scope babel helpers, which are equally unavailable.
 *
 * Sun/moon, cutlery, and steam are SF Symbol / shape placeholders until final
 * art is provided.
 */

import {
  Capsule,
  Circle,
  HStack,
  Image,
  RoundedRectangle,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  font,
  foregroundColor,
  frame,
  kerning,
  monospacedDigit,
  offset,
  opacity,
  rotationEffect,
  scaleEffect,
  shadow,
  strokeBorder,
} from '@expo/ui/swift-ui/modifiers';
import type { WidgetEnvironment } from 'expo-widgets';

import type { WidgetDayData } from '../types';

// ---------------------------------------------------------------------------
// A · Pace + day arc
// ---------------------------------------------------------------------------

export function CaloriePaceWidget(
  props: WidgetDayData,
  environment: WidgetEnvironment,
): React.JSX.Element {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const P = dark
    ? {
        ink: '#ECF2EF',
        textSecondary: '#9DAFA9',
        textTertiary: '#77878F',
        track: '#22302D',
        border: '#374743',
        success: '#4ED98B',
        ahead: '#FFC24B',
        sun: '#E8A33D',
        moon: '#8A97A6',
      }
    : {
        ink: '#1C5279',
        textSecondary: '#4A5A57',
        textTertiary: '#5E6D69',
        track: '#E7ECE6',
        border: '#C5CFC8',
        success: '#1D7A47',
        ahead: '#8F6200',
        sun: '#E8A33D',
        moon: '#8A97A6',
      };

  if (props.hasProfile !== true) {
    return (
      <VStack spacing={4}>
        <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundColor(P.ink)]}>
          Metabolizm
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundColor(P.textSecondary)]}>
          Finish setup to see your day
        </Text>
      </VStack>
    );
  }

  const fmt = function (n: number): string {
    const s = String(Math.max(0, Math.round(n)));
    let out = '';
    for (let i = 0; i < s.length; i++) {
      out += s[i];
      const rem = s.length - 1 - i;
      if (rem > 0 && rem % 3 === 0) out += ',';
    }
    return out;
  };

  const target = props.targetCalories > 0 ? props.targetCalories : 2000;
  const consumed = props.consumedCalories > 0 ? props.consumedCalories : 0;
  const remaining = Math.max(0, target - consumed);
  let consumedFrac = consumed / target;
  if (consumedFrac > 1) consumedFrac = 1;

  const now = environment.date || new Date();
  const hour = now.getHours();
  let timeFrac = (hour + now.getMinutes() / 60 - 6) / 16;
  if (timeFrac < 0) timeFrac = 0;
  if (timeFrac > 1) timeFrac = 1;
  const night = hour >= 20 || hour < 6;

  let statusLabel = '';
  let statusColor = P.success;
  if (consumed <= 0) {
    statusLabel = 'log your first meal';
    statusColor = P.textTertiary;
  } else {
    const expected = timeFrac * target;
    const threshold = expected * 1.15 > 200 ? expected * 1.15 : 200;
    if (consumed > threshold) {
      statusLabel = 'a bit ahead of pace';
      statusColor = P.ahead;
    } else {
      statusLabel = 'on track for ' + (hour < 11 ? 'lunch' : hour < 17 ? 'dinner' : 'today');
      statusColor = P.success;
    }
  }

  const barW = environment.widgetFamily === 'systemMedium' ? 296 : 122;
  const arcR = 44;
  const arcCenterY = 22;
  const arcDots = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * (1 - i / 12);
    arcDots.push(
      <Circle
        key={'dot-' + i}
        modifiers={[
          frame({ width: 3, height: 3 }),
          foregroundColor(P.border),
          offset({ x: Math.cos(a) * arcR, y: arcCenterY - Math.sin(a) * arcR }),
        ]}
      />,
    );
  }
  const orbAngle = Math.PI * (1 - timeFrac);

  return (
    <VStack alignment="leading" spacing={2}>
      <ZStack modifiers={[frame({ width: barW, height: 52 })]}>
        {arcDots}
        <Circle
          modifiers={[
            frame({ width: 8, height: 8 }),
            strokeBorder({ color: P.border, style: { lineWidth: 1.5 } }),
            offset({ x: arcR, y: arcCenterY }),
          ]}
        />
        <Image
          systemName={night ? 'moon.fill' : 'sun.max.fill'}
          size={15}
          color={night ? P.moon : P.sun}
          modifiers={[
            offset({
              x: Math.cos(orbAngle) * arcR,
              y: arcCenterY - Math.sin(orbAngle) * arcR,
            }),
          ]}
        />
        <Text
          modifiers={[
            font({ size: 11, weight: 'semibold' }),
            kerning(1.2),
            foregroundColor(P.textSecondary),
            offset({ x: -barW / 2 + 34, y: -18 }),
          ]}
        >
          CALORIES
        </Text>
      </ZStack>
      <Spacer minLength={0} />
      <Text
        modifiers={[
          font({ size: environment.widgetFamily === 'systemMedium' ? 38 : 30, weight: 'bold' }),
          monospacedDigit(),
          foregroundColor(P.ink),
        ]}
      >
        {fmt(remaining)}
      </Text>
      <Text modifiers={[font({ size: 12 }), foregroundColor(P.textSecondary)]}>
        kcal remaining
      </Text>
      <ZStack alignment="leading" modifiers={[frame({ width: barW, height: 10 })]}>
        <Capsule modifiers={[frame({ width: barW, height: 6 }), foregroundColor(P.track)]} />
        {consumedFrac > 0 ? (
          <Capsule
            modifiers={[
              frame({ width: consumedFrac * barW > 6 ? consumedFrac * barW : 6, height: 6 }),
              foregroundColor(P.ink),
            ]}
          />
        ) : null}
        <RoundedRectangle
          cornerRadius={1}
          modifiers={[
            frame({ width: 2, height: 10 }),
            foregroundColor(P.border),
            offset({ x: timeFrac * (barW - 2) }),
          ]}
        />
      </ZStack>
      <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundColor(statusColor)]}>
        {statusLabel}
      </Text>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// B · Macro bars + food marks
// ---------------------------------------------------------------------------

export function MacroBarsWidget(
  props: WidgetDayData,
  environment: WidgetEnvironment,
): React.JSX.Element {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const P = dark
    ? {
        surface: '#161E1C',
        ink: '#ECF2EF',
        textSecondary: '#9DAFA9',
        textTertiary: '#77878F',
        success: '#4ED98B',
        carbs: '#FFC24B',
        carbsSoft: '#FFC24B1F',
        carbsText: '#FFC24B',
        fat: '#3FD0EC',
        fatSoft: '#3FD0EC1F',
        fatText: '#3FD0EC',
        protein: '#B49BFF',
        proteinSoft: '#B49BFF1F',
        proteinText: '#B49BFF',
      }
    : {
        surface: '#FFFFFF',
        ink: '#1C5279',
        textSecondary: '#4A5A57',
        textTertiary: '#5E6D69',
        success: '#1D7A47',
        carbs: '#B87E00',
        carbsSoft: '#B87E0018',
        carbsText: '#8F6200',
        fat: '#0898B5',
        fatSoft: '#0898B518',
        fatText: '#0B7E96',
        protein: '#6D4AD8',
        proteinSoft: '#6D4AD818',
        proteinText: '#6A45D6',
      };

  if (props.hasProfile !== true) {
    return (
      <VStack spacing={4}>
        <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundColor(P.ink)]}>
          Metabolizm
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundColor(P.textSecondary)]}>
          Finish setup to see your day
        </Text>
      </VStack>
    );
  }

  const fmt = function (n: number): string {
    const s = String(Math.max(0, Math.round(n)));
    let out = '';
    for (let i = 0; i < s.length; i++) {
      out += s[i];
      const rem = s.length - 1 - i;
      if (rem > 0 && rem % 3 === 0) out += ',';
    }
    return out;
  };
  const fmtG = function (n: number): string {
    const r = Math.round(n * 10) / 10;
    return (r % 1 === 0 ? String(Math.round(r)) : String(r)) + 'g';
  };

  const barW = environment.widgetFamily === 'systemMedium' ? 296 : 122;
  const rows = [
    {
      label: 'Carbs',
      icon: 'carrot.fill' as const,
      color: P.carbs,
      soft: P.carbsSoft,
      text: P.carbsText,
      g: props.carbs ? props.carbs.consumedG : 0,
      t: props.carbs ? props.carbs.targetG : 0,
    },
    {
      label: 'Fat',
      icon: 'drop.fill' as const,
      color: P.fat,
      soft: P.fatSoft,
      text: P.fatText,
      g: props.fat ? props.fat.consumedG : 0,
      t: props.fat ? props.fat.targetG : 0,
    },
    {
      label: 'Protein',
      icon: 'fish.fill' as const,
      color: P.protein,
      soft: P.proteinSoft,
      text: P.proteinText,
      g: props.protein ? props.protein.consumedG : 0,
      t: props.protein ? props.protein.targetG : 0,
    },
  ];

  let leading = rows[0];
  let leadingFrac = -1;
  for (let i = 0; i < rows.length; i++) {
    const f = rows[i].t > 0 ? rows[i].g / rows[i].t : 0;
    if (f > leadingFrac) {
      leadingFrac = f;
      leading = rows[i];
    }
  }
  const insight =
    props.consumedCalories > 0 ? leading.label.toLowerCase() + ' leading today' : 'log your first meal';

  return (
    <VStack alignment="leading" spacing={5}>
      <HStack spacing={0}>
        <Text
          modifiers={[
            font({ size: 11, weight: 'semibold' }),
            kerning(1.2),
            foregroundColor(P.textSecondary),
          ]}
        >
          MACROS
        </Text>
        <Spacer minLength={8} />
        <Text
          modifiers={[
            font({ size: 15, weight: 'bold' }),
            monospacedDigit(),
            foregroundColor(P.ink),
          ]}
        >
          {fmt(props.consumedCalories > 0 ? props.consumedCalories : 0)}
        </Text>
      </HStack>
      {rows.map(function (row) {
        let fillFrac = row.t > 0 ? row.g / row.t : 0;
        if (fillFrac > 1) fillFrac = 1;
        let fillW = row.g > 0 ? fillFrac * barW : 0;
        if (fillW > 0 && fillW < 10) fillW = 10;
        return (
          <VStack key={row.label} alignment="leading" spacing={3}>
            <HStack spacing={4}>
              <Image systemName={row.icon} size={11} color={row.text} />
              <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundColor(row.text)]}>
                {row.label}
              </Text>
              <Spacer minLength={8} />
              <Text
                modifiers={[
                  font({ size: 12, weight: 'bold' }),
                  monospacedDigit(),
                  foregroundColor(P.ink),
                ]}
              >
                {fmtG(row.g)}
              </Text>
            </HStack>
            <ZStack alignment="leading" modifiers={[frame({ width: barW, height: 9 })]}>
              <Capsule
                modifiers={[frame({ width: barW, height: 6 }), foregroundColor(row.soft)]}
              />
              {fillW > 0 ? (
                <Capsule
                  modifiers={[frame({ width: fillW, height: 6 }), foregroundColor(row.color)]}
                />
              ) : null}
              {fillW > 0 ? (
                <Circle
                  modifiers={[
                    frame({ width: 9, height: 9 }),
                    foregroundColor(P.surface),
                    strokeBorder({ color: row.color, style: { lineWidth: 2.5 } }),
                    offset({ x: fillW - 9 }),
                  ]}
                />
              ) : null}
            </ZStack>
          </VStack>
        );
      })}
      <Spacer minLength={0} />
      <HStack spacing={4}>
        <Image systemName="leaf.fill" size={10} color={P.success} />
        <Text modifiers={[font({ size: 11 }), foregroundColor(P.textTertiary)]}>{insight}</Text>
      </HStack>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// C · Plate + cutlery
// ---------------------------------------------------------------------------

export function PlateRingWidget(
  props: WidgetDayData,
  environment: WidgetEnvironment,
): React.JSX.Element {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const P = dark
    ? {
        surface: '#161E1C',
        ink: '#ECF2EF',
        textSecondary: '#9DAFA9',
        textTertiary: '#77878F',
        track: '#22302D',
        border: '#374743',
        carbs: '#FFC24B',
        carbsText: '#FFC24B',
        fat: '#3FD0EC',
        fatText: '#3FD0EC',
        protein: '#B49BFF',
        proteinText: '#B49BFF',
      }
    : {
        surface: '#FFFFFF',
        ink: '#1C5279',
        textSecondary: '#4A5A57',
        textTertiary: '#5E6D69',
        track: '#E7ECE6',
        border: '#C5CFC8',
        carbs: '#B87E00',
        carbsText: '#8F6200',
        fat: '#0898B5',
        fatText: '#0B7E96',
        protein: '#6D4AD8',
        proteinText: '#6A45D6',
      };

  if (props.hasProfile !== true) {
    return (
      <VStack spacing={4}>
        <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundColor(P.ink)]}>
          Metabolizm
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundColor(P.textSecondary)]}>
          Finish setup to see your day
        </Text>
      </VStack>
    );
  }

  const fmt = function (n: number): string {
    const s = String(Math.max(0, Math.round(n)));
    let out = '';
    for (let i = 0; i < s.length; i++) {
      out += s[i];
      const rem = s.length - 1 - i;
      if (rem > 0 && rem % 3 === 0) out += ',';
    }
    return out;
  };
  const fmtG = function (n: number): string {
    const r = Math.round(n * 10) / 10;
    return (r % 1 === 0 ? String(Math.round(r)) : String(r)) + 'g';
  };

  const target = props.targetCalories > 0 ? props.targetCalories : 2000;
  const consumed = props.consumedCalories > 0 ? props.consumedCalories : 0;
  const remaining = Math.max(0, target - consumed);
  const carbsG = props.carbs ? props.carbs.consumedG : 0;
  const fatG = props.fat ? props.fat.consumedG : 0;
  const proteinG = props.protein ? props.protein.consumedG : 0;

  let carbsEnd = (carbsG * 4) / target;
  if (carbsEnd > 1) carbsEnd = 1;
  let fatEnd = carbsEnd + (fatG * 9) / target;
  if (fatEnd > 1) fatEnd = 1;
  let proteinEnd = fatEnd + (proteinG * 4) / target;
  if (proteinEnd > 1) proteinEnd = 1;

  const ringR = 34;
  const ringDots = [];
  for (let i = 0; i < 36; i++) {
    const f = i / 36;
    const a = (f * 360 - 90) * (Math.PI / 180);
    let dotColor = P.track;
    if (consumed > 0 && f < carbsEnd) dotColor = P.carbs;
    else if (consumed > 0 && f < fatEnd) dotColor = P.fat;
    else if (consumed > 0 && f < proteinEnd) dotColor = P.protein;
    ringDots.push(
      <Circle
        key={'ring-' + i}
        modifiers={[
          frame({ width: 5, height: 5 }),
          foregroundColor(dotColor),
          offset({ x: Math.cos(a) * ringR, y: Math.sin(a) * ringR }),
        ]}
      />,
    );
  }

  const steam = [];
  if (props.mealsLogged > 0) {
    const xs = [-9, 0, 9];
    for (let i = 0; i < xs.length; i++) {
      steam.push(
        <Capsule
          key={'steam-' + i}
          modifiers={[
            frame({ width: 2.5, height: 9 }),
            foregroundColor(P.textTertiary),
            opacity(0.35),
            rotationEffect(i === 1 ? -6 : 6),
            offset({ x: xs[i], y: -52 }),
          ]}
        />,
      );
    }
  }

  const legend = [
    { color: P.carbs, text: P.carbsText, g: carbsG },
    { color: P.fat, text: P.fatText, g: fatG },
    { color: P.protein, text: P.proteinText, g: proteinG },
  ];

  return (
    <VStack spacing={5}>
      <ZStack modifiers={[frame({ width: 128, height: 100 })]}>
        <Image
          systemName="fork.knife"
          size={16}
          color={P.border}
          modifiers={[offset({ x: -56 })]}
        />
        <Image
          systemName="fork.knife"
          size={16}
          color={P.border}
          modifiers={[scaleEffect({ x: -1, y: 1 }), offset({ x: 56 })]}
        />
        <Circle
          modifiers={[
            frame({ width: 84, height: 84 }),
            foregroundColor(P.surface),
            shadow({ radius: 3, y: 1, color: '#00000012' }),
          ]}
        />
        <Circle
          modifiers={[
            frame({ width: 58, height: 58 }),
            strokeBorder({ color: P.track, style: { lineWidth: 1.5 } }),
          ]}
        />
        {ringDots}
        {steam}
        <VStack spacing={0}>
          <Text
            modifiers={[
              font({ size: 20, weight: 'bold' }),
              monospacedDigit(),
              foregroundColor(P.ink),
            ]}
          >
            {fmt(remaining)}
          </Text>
          <Text modifiers={[font({ size: 10 }), foregroundColor(P.textSecondary)]}>kcal left</Text>
        </VStack>
      </ZStack>
      <HStack spacing={10}>
        {legend.map(function (item, index) {
          return (
            <HStack key={'legend-' + index} spacing={3}>
              <Circle modifiers={[frame({ width: 6, height: 6 }), foregroundColor(item.color)]} />
              <Text modifiers={[font({ size: 10, weight: 'semibold' }), foregroundColor(item.text)]}>
                {fmtG(item.g)}
              </Text>
            </HStack>
          );
        })}
      </HStack>
    </VStack>
  );
}
