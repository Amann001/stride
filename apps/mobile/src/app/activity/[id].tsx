import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
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
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AchievementList } from '@/components/achievements';
import { ActivitySocial } from '@/components/activity-social';
import { Avatar } from '@/components/avatar';
import { CategoryIcon } from '@/components/category-icon';
import { EditActivitySheet, VISIBILITY_LOOK } from '@/components/edit-activity-sheet';
import { ElevationChart } from '@/components/elevation-chart';
import { RouteMap } from '@/components/route-map';
import { SplitsTable } from '@/components/splits-table';
import { Stat } from '@/components/stat';
import { useColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { detailStats } from '@/lib/activity-stats';
import { api } from '@/lib/api';
import { formatFullDateTime } from '@/lib/dates';

// One activity: route map, achievements, and a breakdown that fits the kind of activity
// (splits and best efforts for runs and rides, the hill profile first for hikes).
export default function ActivityScreen() {
  const colors = useColors();
  const { id, show } = useLocalSearchParams<{ id: string; show?: 'comments' | 'kudos' }>();
  const scrollRef = useRef<ScrollView>(null);
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const { user } = useAuth();

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

  const date = formatFullDateTime(activity.startedAt);
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

  const mine = activity.userId === user?.id;

  return (
    <ScrollView ref={scrollRef} style={{ backgroundColor: colors.separator }} contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
      <Stack.Screen
        options={{
          headerRight: mine
            ? () => (
                <Pressable onPress={() => setEditing(true)} hitSlop={10}>
                  <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>Edit</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      {mine && (
        <EditActivitySheet activity={activity} visible={editing} onClose={() => setEditing(false)}
          onSaved={(u) => setActivity({ ...activity, ...u })} />
      )}
      {/* Activities added by hand have no GPS track, so no map. */}
      {activity.points.length > 1 && <RouteMap coords={activity.points} style={styles.map} />}

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {!mine && (
          <Pressable style={styles.athlete} onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: activity.athlete.id } })}>
            <Avatar id={activity.athlete.id} name={activity.athlete.name} size={36} />
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{activity.athlete.name}</Text>
          </Pressable>
        )}
        <View style={styles.header}>
          <CategoryIcon type={activity.type} />
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {ACTIVITY_LABELS[activity.type]} · {date}
          </Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{activity.title}</Text>
        {!!activity.description && <Text style={{ color: colors.text, fontSize: 15, marginTop: -6 }}>{activity.description}</Text>}
        {mine && (
          <View style={styles.visibility}>
            <MaterialCommunityIcons name={VISIBILITY_LOOK[activity.visibility].icon} size={14} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Visible to {VISIBILITY_LOOK[activity.visibility].label.toLowerCase()}</Text>
          </View>
        )}
        {statRows.map((row, i) => (
          <View key={i} style={styles.row}>
            {row.map((s) => <Stat key={s.label} label={s.label} value={s.value} align="left" />)}
            {/* Keep columns lined up when the last row is short. */}
            {Array.from({ length: 3 - row.length }, (_, k) => <View key={k} style={styles.spacer} />)}
          </View>
        ))}
      </View>

      <View onLayout={(e) => {
        // Opened from the Comment button on a feed card: scroll down to the comments.
        if (show) scrollRef.current?.scrollTo({ y: e.nativeEvent.layout.y - 12, animated: true });
      }}>
        <ActivitySocial activity={activity} autoFocusComment={show === 'comments'} />
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

      {mine && (
        <Pressable onPress={confirmDelete} style={[styles.delete, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.danger, fontWeight: '600' }}>Delete activity</Text>
        </Pressable>
      )}
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
  // Sections with a thin band between them (the page colour shows through the gap).
  content: { gap: 8, paddingBottom: 32 },
  map: { height: 320 },
  card: { paddingHorizontal: 16, paddingVertical: 18, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meta: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700', marginTop: -6 },
  row: { flexDirection: 'row' },
  athlete: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  visibility: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -8 },
  spacer: { flex: 1 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  effort: { flexDirection: 'row', alignItems: 'center' },
  effortName: { flex: 1, fontSize: 15, fontWeight: '600' },
  effortValue: { width: 80, fontWeight: '700', fontVariant: ['tabular-nums'] },
  effortPace: { width: 90, textAlign: 'right', fontVariant: ['tabular-nums'] },
  delete: { alignItems: 'center', paddingVertical: 16 },
});
