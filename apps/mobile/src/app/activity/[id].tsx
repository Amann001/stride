import {
  ACTIVITY_LABELS,
  formatDistance,
  formatDuration,
  formatPaceOrSpeed,
  paceOrSpeedLabel,
  type ActivityDetail,
} from '@repo/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RouteMap } from '@/components/route-map';
import { Stat } from '@/components/stat';
import { useColors } from '@/constants/theme';
import { api } from '@/lib/api';

// One activity: route map and all its stats.
export default function ActivityScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getActivity(id).then(setActivity, (err) => setError(err.message));
  }, [id]);

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

  return (
    <ScrollView style={{ backgroundColor: colors.background }}>
      <RouteMap coords={activity.points} style={styles.map} />
      <View style={[styles.body, { backgroundColor: colors.card }]}>
        <Text style={{ color: colors.textSecondary }}>{ACTIVITY_LABELS[activity.type]} · {date}</Text>
        <Text style={[styles.title, { color: colors.text }]}>{activity.title}</Text>
        <View style={styles.row}>
          <Stat label="Distance" value={formatDistance(activity.distanceMeters)} />
          <Stat
            label={paceOrSpeedLabel(activity.type)}
            value={formatPaceOrSpeed(activity.type, activity.distanceMeters, activity.movingSeconds)}
          />
        </View>
        <View style={styles.row}>
          <Stat label="Moving time" value={formatDuration(activity.movingSeconds)} />
          <Stat label="Elapsed time" value={formatDuration(activity.elapsedSeconds)} />
        </View>
        <View style={styles.row}>
          <Stat label="Elevation gain" value={`${activity.elevationGainMeters} m`} />
          <Stat label="GPS points" value={String(activity.points.length)} />
        </View>
        <Pressable onPress={confirmDelete} style={styles.delete}>
          <Text style={{ color: colors.danger, fontWeight: '600' }}>Delete activity</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { marginTop: 48, textAlign: 'center' },
  map: { height: 320 },
  body: { padding: 20, gap: 20 },
  title: { fontSize: 24, fontWeight: '800', marginTop: -12 },
  row: { flexDirection: 'row' },
  delete: { alignItems: 'center', paddingVertical: 12 },
});
