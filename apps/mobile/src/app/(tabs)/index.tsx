import type { ActivitySummary, UserStats } from '@repo/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { StreakCard } from '@/components/streak-card';
import { WeekSummary } from '@/components/week-summary';
import { useColors } from '@/constants/theme';
import { api } from '@/lib/api';

// Home tab: your weekly streak, this week's totals, then your activities, newest first.
// Pull down to refresh. (In Phase 2 the feed also includes people you follow.)
export default function HomeScreen() {
  const colors = useColors();
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [list, s] = await Promise.all([api.listActivities(), api.getStats()]);
      setActivities(list);
      setStats(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load activities');
    }
  }, []);

  // Reload whenever this tab comes into view, e.g. after saving a new activity.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      data={activities}
      keyExtractor={(a) => a.id}
      renderItem={({ item }) => <ActivityCard activity={item} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <StreakCard stats={stats} />
          <WeekSummary stats={stats} />
          {activities.length > 0 && <Text style={[styles.section, { color: colors.text }]}>Recent activities</Text>}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {error ? "Couldn't reach the server" : 'No activities yet'}
          </Text>
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
            {error ?? 'Go to the Record tab and head out for a run, ride, walk or hike.'}
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, flexGrow: 1 },
  header: { gap: 12, marginBottom: 12 },
  section: { fontSize: 17, fontWeight: '700', marginTop: 8, marginLeft: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
});
