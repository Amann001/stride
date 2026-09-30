import { formatDistance, formatDurationShort, formatElevation, type UserStats } from '@repo/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HIGHLIGHT_HEIGHT } from '@/components/streak-card';
import { useColors } from '@/constants/theme';

// "This week": your totals across every sport. The full breakdown is in You > Progress.
export function WeekSummary({ stats }: { stats: UserStats | null }) {
  const colors = useColors();
  const week = stats?.thisWeek;
  const items = [
    { label: 'Distance', value: formatDistance(week?.distanceMeters ?? 0) },
    { label: 'Time', value: formatDurationShort(week?.movingSeconds ?? 0) },
    { label: 'Elev Gain', value: formatElevation(week?.elevationGainMeters ?? 0) },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={[styles.heading, { color: colors.text }]}>
          This week{week?.count ? ` · ${week.count} ${week.count === 1 ? 'activity' : 'activities'}` : ''}
        </Text>
        <Pressable onPress={() => router.navigate('/profile')} hitSlop={8}>
          <Text style={[styles.link, { color: colors.accent }]}>See progress</Text>
        </Pressable>
      </View>
      <View style={styles.stats}>
        {items.map((s) => (
          <View key={s.label} style={styles.stat}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{s.label}</Text>
            <Text style={[styles.value, { color: colors.text }]}>{s.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { height: HIGHLIGHT_HEIGHT, paddingHorizontal: 16, paddingTop: 16, gap: 18 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { fontSize: 17, fontWeight: '700' },
  link: { fontSize: 14, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 28 },
  stat: { gap: 2 },
  label: { fontSize: 13 },
  value: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
