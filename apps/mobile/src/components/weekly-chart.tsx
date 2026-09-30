import type { WeekTotals } from '@repo/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { useColors } from '@/constants/theme';

const HEIGHT = 150;
const PAD_TOP = 10;
const PAD_BOTTOM = 22; // room for month names
const PAD_RIGHT = 52; // room for the value scale

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Rounds a maximum up to 1, 2 or 5 times a power of ten, so the scale has tidy numbers.
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 5, 10].map((m) => m * p).find((n) => n >= v)!;
}

// "Past 12 weeks": a line with a dot per week, this week highlighted on the right.
export function WeeklyChart({ weeks, value, format, color }: {
  weeks: WeekTotals[];
  value: (w: WeekTotals) => number;
  format: (v: number) => string;
  color: string;
}) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const values = weeks.map(value);
  const max = niceMax(Math.max(...values));
  const plotW = Math.max(0, width - PAD_RIGHT);
  const x = (i: number) => (values.length > 1 ? (i / (values.length - 1)) * plotW : 0);
  const y = (v: number) => PAD_TOP + (1 - v / max) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
  const baseline = y(0);

  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const area = `${line} L${x(values.length - 1)},${baseline} L0,${baseline} Z`;
  // A month name under the first week that starts in a new month.
  const monthTicks = weeks
    .map((w, i) => ({ i, m: Number(w.weekStart.slice(5, 7)) - 1 }))
    .filter(({ i, m }) => i > 0 && m !== Number(weeks[i - 1].weekStart.slice(5, 7)) - 1);

  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          {[0, 0.5, 1].map((f) => (
            <SvgText key={f} x={width - 4} y={y(max * f) + 4} fontSize={11} fill={colors.textSecondary} textAnchor="end">
              {format(max * f)}
            </SvgText>
          ))}
          <Line x1={0} x2={plotW} y1={baseline} y2={baseline} stroke={colors.border} strokeWidth={1} />
          {/* A vertical line marking this week. */}
          <Line x1={plotW} x2={plotW} y1={PAD_TOP} y2={baseline} stroke={colors.text} strokeWidth={1.5} />
          <Path d={area} fill={color} fillOpacity={0.15} />
          <Path d={line} stroke={color} strokeWidth={2} fill="none" />
          {values.map((v, i) => (
            <Circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 5 : 3.5}
              fill={i === values.length - 1 ? color : colors.card} stroke={color} strokeWidth={2} />
          ))}
          {monthTicks.map(({ i, m }) => (
            <SvgText key={i} x={x(i)} y={HEIGHT - 4} fontSize={11} fill={colors.textSecondary} textAnchor="middle">
              {MONTHS[m]}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: HEIGHT },
});
