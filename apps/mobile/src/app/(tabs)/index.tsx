import type { ActivitySummary, Challenge, UserStats } from '@repo/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { ChallengeCard } from '@/components/challenge-card';
import { HighlightsCarousel } from '@/components/highlights-carousel';
import { HeaderButton, TabHeader, Wordmark } from '@/components/tab-header';
import { useColors } from '@/constants/theme';
import { api } from '@/lib/api';

// Home tab: your streak and week at the top, then your activities, newest first, with
// challenges you could join after the first one. Pull down to refresh.
// (In the next phase the feed also includes people you follow.)
export default function HomeScreen() {
  const colors = useColors();
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [list, s, c] = await Promise.all([api.listActivities(), api.getStats(), api.getChallenges()]);
      setActivities(list);
      setStats(s);
      setChallenges(c.current.filter((x) => !x.joined));
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

  const suggested = challenges.length > 0 && (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Suggested Challenges</Text>
      <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>
        Make staying active a little easier and more fun.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.challengeRow}>
        {challenges.map((c) => (
          <ChallengeCard key={c.id} challenge={c} onChange={load} style={styles.challengeCard} />
        ))}
      </ScrollView>
      <Pressable onPress={() => router.navigate('/groups')} style={styles.seeAll}>
        <Text style={{ color: colors.accent, fontWeight: '700' }}>Explore All Challenges</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TabHeader
        left={<HeaderButton icon="plus" label="Add manual activity" onPress={() => router.push('/manual')} />}
        title={<Wordmark />}
        right={<HeaderButton icon="bell-outline" label="Notifications" onPress={() => router.push('/notifications')} />}
      />
      <FlatList
        contentContainerStyle={styles.list}
        data={activities}
        keyExtractor={(a) => a.id}
        renderItem={({ item, index }) => (
          <>
            <ActivityCard activity={item} />
            {index === 0 && suggested}
          </>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <HighlightsCarousel stats={stats} />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {error ? "Couldn't reach the server" : 'No activities yet'}
            </Text>
            <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
              {error ?? 'Tap Record and head out for a run, ride, walk or hike.'}
            </Text>
            {!error && suggested}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: 12, flexGrow: 1 },
  header: { marginBottom: 12 },
  section: { marginTop: 8, marginBottom: 20, alignSelf: 'stretch' },
  sectionTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  challengeRow: { gap: 12 },
  challengeCard: { width: 300 },
  seeAll: { alignSelf: 'flex-end', marginTop: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
});
