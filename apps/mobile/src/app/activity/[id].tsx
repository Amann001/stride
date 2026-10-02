import {
  ACTIVITY_LABELS,
  CATEGORIES,
  computeSplits,
  effortName,
  elevationProfile,
  formatDuration,
  formatPaceOrSpeed,
  type ActivityDetail,
} from '@repo/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AchievementList } from '@/components/achievements';
import { CategoryIcon } from '@/components/category-icon';
import { ElevationChart } from '@/components/elevation-chart';
import { RouteMap } from '@/components/route-map';
import { SplitsTable } from '@/components/splits-table';
import { Stat } from '@/components/stat';
import { useColors } from '@/constants/theme';
import { detailStats } from '@/lib/activity-stats';
import { api } from '@/lib/api';

// One activity: route map, achievements, and a breakdown that fits the kind of activity
// (splits and best efforts for runs and rides, the hill profile first for hikes).
export default function ActivityScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getActivity(id).then(setActivity, (err) => setError(err.message));
  }, [id]);

  const splits = useMemo(
    () => (activity ? computeSplits(activity.points, CATEGORIES[activity.type].splitMeters) : []),
    [activity],
  );
  const profile = useMemo(() => (activity ? elevationProfile(activity.points) : []), [activity]);

  const confirmDelete = () =>
    Alert.alert('Delete activity?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await api.deleteActivity(id);
          router.back();
        },
      },
    ]);

  if (error) return <Text style={[styles.center, { color: colors.danger }]}>{error}</Text>;
  if (!activity) return <ActivityIndicator style={styles.center} color={colors.accent} />;

  const date = new Date(activity.startedAt).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
  const highest = profile.length ? Math.max(...profile.map((p) => p.altitude)) : null;
  const stats = detailStats(activity, highest);
  const statRows = Array.from({ length: Math.ceil(stats.length / 3) }, (_, i) => stats.slice(i * 3, i * 3 + 3));

  const splitsSection = splits.length > 1 && (
    <Section title="Splits">
      <SplitsTable type={activity.type} splits={splits} />
    </Section>
  );
  const elevationSection = profile.length > 0 && (
    <Section title="Elevation">
      <ElevationChart type={activity.type} profile={profile} />
    </Section>
  );

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <RouteMap coords={activity.points} style={styles.map} />

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.header}>
          <CategoryIcon type={activity.type} />
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {ACTIVITY_LABELS[activity.type]} · {date}
          </Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{activity.title}</Text>
        {statRows.map((row, i) => (
          <View key={i} style={styles.row}>
            {row.map((s) => <Stat key={s.label} label={s.label} value={s.value} />)}
            {/* Keep columns lined up when the last row is short. */}
            {Array.from({ length: 3 - row.length }, (_, k) => <View key={k} style={styles.spacer} />)}
          </View>
        ))}
      </View>

      {activity.achievements.length > 0 && (
        <Section title={`Achievements (${activity.achievements.length})`}>
          <AchievementList achievements={activity.achievements} />
        </Section>
      )}

      {activity.type === 'hike' ? (
        <>
          {elevationSection}
          {splitsSection}
        </>
      ) : (
        <>
          {splitsSection}
          {elevationSection}
        </>
      )}

      {activity.bestEfforts.length > 0 && (
        <Section title="Best efforts">
          {activity.bestEfforts.map((e) => (
            <View key={e.distanceMeters} style={styles.effort}>
              <Text style={[styles.effortName, { color: colors.text }]}>{effortName(e.distanceMeters)}</Text>
              <Text style={[styles.effortValue, { color: colors.text }]}>{formatDuration(e.seconds)}</Text>
              <Text style={[styles.effortPace, { color: colors.textSecondary }]}>
                {formatPaceOrSpeed(activity.type, e.distanceMeters, e.seconds)}
              </Text>
            </View>
          ))}
        </Section>
      )}

      <Pressable onPress={confirmDelete} style={styles.delete}>
        <Text style={{ color: colors.danger, fontWeight: '600' }}>Delete activity</Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { marginTop: 48, textAlign: 'center' },
  content: { gap: 12, paddingBottom: 32 },
  map: { height: 320 },
  card: { padding: 20, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meta: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', marginTop: -6 },
  row: { flexDirection: 'row' },
  spacer: { flex: 1 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  effort: { flexDirection: 'row', alignItems: 'center' },
  effortName: { flex: 1, fontSize: 15, fontWeight: '600' },
  effortValue: { width: 80, fontWeight: '700', fontVariant: ['tabular-nums'] },
  effortPace: { width: 90, textAlign: 'right', fontVariant: ['tabular-nums'] },
  delete: { alignItems: 'center', paddingVertical: 12 },
});
