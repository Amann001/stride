import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ACTIVITY_LABELS,
  ACTIVITY_TYPES,
  formatDistance,
  formatDurationShort,
  formatElevation,
  type ActivityType,
  type UserStats,
} from '@repo/shared';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Stat } from '@/components/stat';
import { CATEGORY_LOOKS } from '@/constants/categories';
import { INK, useColors } from '@/constants/theme';

// "This week" totals, for everything or one kind of activity.
export function WeekSummary({ stats }: { stats: UserStats | null }) {
  const colors = useColors();
  const [filter, setFilter] = useState<ActivityType | 'all'>('all');
  const totals = !stats ? null : filter === 'all' ? stats.thisWeek : stats.byType[filter].thisWeek;

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.heading, { color: colors.text }]}>This week</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        {ACTIVITY_TYPES.map((t) => (
          <Chip key={t} type={t} label={ACTIVITY_LABELS[t]} selected={filter === t} onPress={() => setFilter(t)} />
        ))}
      </ScrollView>
      <View style={styles.stats}>
        <Stat label="Activities" value={String(totals?.count ?? 0)} />
        <Stat label="Distance" value={formatDistance(totals?.distanceMeters ?? 0)} />
        <Stat label="Time" value={formatDurationShort(totals?.movingSeconds ?? 0)} />
        <Stat label="Elev" value={formatElevation(totals?.elevationGainMeters ?? 0)} />
      </View>
    </View>
  );
}

function Chip({ label, type, selected, onPress }: {
  label: string; type?: ActivityType; selected: boolean; onPress: () => void;
}) {
  const colors = useColors();
  const fill = type ? CATEGORY_LOOKS[type].color : colors.brand;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { borderColor: colors.border }, selected && { backgroundColor: fill, borderColor: fill }]}>
      {type && <MaterialCommunityIcons name={CATEGORY_LOOKS[type].icon} size={16} color={selected ? INK : colors.text} />}
      <Text style={{ color: selected ? INK : colors.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, gap: 14 },
  heading: { fontSize: 17, fontWeight: '700' },
  chips: { gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  stats: { flexDirection: 'row' },
});
