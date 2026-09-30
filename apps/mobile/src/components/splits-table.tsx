import { CATEGORIES, formatPace, formatSpeed, type ActivityType, type Split } from '@repo/shared';
import { StyleSheet, Text, View } from 'react-native';

import { CATEGORY_LOOKS } from '@/constants/categories';
import { useColors } from '@/constants/theme';

// One row per km (per 5 km for rides): pace or speed, a bar showing how fast it was
// compared with your fastest split, and how much you climbed or dropped.
export function SplitsTable({ type, splits }: { type: ActivityType; splits: Split[] }) {
  const colors = useColors();
  const speed = CATEGORIES[type].metric === 'speed';
  const speeds = splits.map((s) => (s.movingSeconds > 0 ? s.distanceMeters / s.movingSeconds : 0));
  const fastest = Math.max(...speeds, 0.01);
  // Distance at the end of each split: "1", "2", ... and e.g. "5.4" for a short last split.
  const labels = splits.map((s, i) => {
    const covered = splits.slice(0, i + 1).reduce((sum, x) => sum + x.distanceMeters, 0) / 1000;
    const full = Math.abs(s.distanceMeters - CATEGORIES[type].splitMeters) < 1;
    return full ? String(Math.round(covered)) : covered.toFixed(1);
  });

  return (
    <View style={styles.table}>
      <View style={styles.row}>
        <Text style={[styles.km, styles.head, { color: colors.textSecondary }]}>Km</Text>
        <Text style={[styles.value, styles.head, { color: colors.textSecondary }]}>{speed ? 'Speed' : 'Pace'}</Text>
        <View style={styles.barTrack} />
        <Text style={[styles.elev, styles.head, { color: colors.textSecondary }]}>Elev</Text>
      </View>
      {splits.map((s, i) => {
        const value = speed
          ? formatSpeed(speeds[i])
          : formatPace(s.movingSeconds / (s.distanceMeters / 1000)).replace(' /km', '');
        return (
          <View key={i} style={styles.row}>
            <Text style={[styles.km, { color: colors.text }]}>{labels[i]}</Text>
            <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
            <View style={styles.barTrack}>
              <View
                style={[styles.bar, { width: `${(speeds[i] / fastest) * 100}%`, backgroundColor: CATEGORY_LOOKS[type].color }]}
              />
            </View>
            <Text style={[styles.elev, { color: colors.textSecondary }]}>
              {s.elevationChangeMeters == null ? '' : `${s.elevationChangeMeters > 0 ? '+' : ''}${s.elevationChangeMeters}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  table: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  head: { fontSize: 12, fontWeight: '600' },
  km: { width: 32, fontVariant: ['tabular-nums'] },
  value: { width: 76, fontWeight: '600', fontVariant: ['tabular-nums'] },
  barTrack: { flex: 1, height: 14 },
  bar: { height: 14, borderRadius: 4 },
  elev: { width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
