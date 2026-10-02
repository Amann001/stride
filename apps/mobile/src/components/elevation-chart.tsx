import { formatDistance, formatElevation, type ActivityType, type ProfilePoint } from '@repo/shared';
import { StyleSheet, Text, View } from 'react-native';

import { CATEGORY_LOOKS } from '@/constants/categories';
import { useColors } from '@/constants/theme';

const CHART_HEIGHT = 110;

// A hill-shaped bar chart of altitude along the route.
export function ElevationChart({ type, profile }: { type: ActivityType; profile: ProfilePoint[] }) {
  const colors = useColors();
  const alts = profile.map((p) => p.altitude);
  const min = Math.min(...alts);
  const max = Math.max(...alts);
  // Keep at least 20 m of range, so a flat route looks flat instead of a jagged mountain.
  const range = Math.max(max - min, 20);
  const total = profile[profile.length - 1].distanceMeters;

  return (
    <View>
      <View style={styles.chart}>
        <View style={styles.axis}>
          <Text style={[styles.axisText, { color: colors.textSecondary }]}>{formatElevation(max)}</Text>
          <Text style={[styles.axisText, { color: colors.textSecondary }]}>{formatElevation(min)}</Text>
        </View>
        <View style={[styles.bars, { borderColor: colors.border }]}>
          {profile.map((p, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                { height: 8 + ((p.altitude - min) / range) * (CHART_HEIGHT - 8), backgroundColor: CATEGORY_LOOKS[type].color },
              ]}
            />
          ))}
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={[styles.axisText, { color: colors.textSecondary }]}>0 km</Text>
        <Text style={[styles.axisText, { color: colors.textSecondary }]}>{formatDistance(total)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', height: CHART_HEIGHT },
  axis: { justifyContent: 'space-between', paddingRight: 8 },
  axisText: { fontSize: 11, fontVariant: ['tabular-nums'] },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 1, borderBottomWidth: StyleSheet.hairlineWidth },
  bar: { flex: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2, opacity: 0.85 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginLeft: 44, marginTop: 4 },
});
