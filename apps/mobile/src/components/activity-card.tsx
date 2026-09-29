import {
  ACTIVITY_LABELS,
  formatDistance,
  formatDuration,
  formatPaceOrSpeed,
  paceOrSpeedLabel,
  type ActivitySummary,
} from '@repo/shared';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Stat } from '@/components/stat';
import { useColors } from '@/constants/theme';

// One activity in the list. Tapping it opens the detail screen.
export function ActivityCard({ activity }: { activity: ActivitySummary }) {
  const colors = useColors();
  const date = new Date(activity.startedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <Link href={{ pathname: '/activity/[id]', params: { id: activity.id } }} asChild>
      <Pressable style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {ACTIVITY_LABELS[activity.type]} · {date}
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>{activity.title}</Text>
        <View style={styles.stats}>
          <Stat label="Distance" value={formatDistance(activity.distanceMeters)} />
          <Stat
            label={paceOrSpeedLabel(activity.type)}
            value={formatPaceOrSpeed(activity.type, activity.distanceMeters, activity.movingSeconds)}
          />
          <Stat label="Time" value={formatDuration(activity.movingSeconds)} />
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 12 },
  meta: { fontSize: 13 },
  title: { fontSize: 18, fontWeight: '700', marginTop: 4, marginBottom: 12 },
  stats: { flexDirection: 'row' },
});
