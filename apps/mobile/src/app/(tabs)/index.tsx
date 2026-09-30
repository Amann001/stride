import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ActivitySummary, AthleteSummary, Challenge, UserStats } from '@repo/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { ChallengeCard } from '@/components/challenge-card';
import { HighlightsCarousel } from '@/components/highlights-carousel';
import { HeaderButton, TabHeader, Wordmark } from '@/components/tab-header';
import { WhoToFollow } from '@/components/who-to-follow';
import { useColors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBadges } from '@/lib/use-badges';

// Home tab: your streak and week at the top, then a feed of your activities and those of
// people you follow. Who to Follow and challenges appear after the first card.
export default function HomeScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const badges = useBadges();
  const [feed, setFeed] = useState<ActivitySummary[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [suggested, setSuggested] = useState<AthleteSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [f, s, c, who] = await Promise.all([api.feed(), api.getStats(), api.getChallenges(), api.suggestedAthletes()]);
      setFeed(f);
      setReachedEnd(f.length < 30);
      setStats(s);
      setChallenges(c.current.filter((x) => !x.joined));
      setSuggested(who);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your feed');
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

  // Older activities when you scroll to the bottom.
  const loadMore = async () => {
    if (loadingMore || reachedEnd || feed.length === 0) return;
    setLoadingMore(true);
    try {
      const older = await api.feed(feed[feed.length - 1].startedAt);
      setFeed((f) => [...f, ...older.filter((a) => !f.some((x) => x.id === a.id))]);
      setReachedEnd(older.length < 30);
    } finally {
      setLoadingMore(false);
    }
  };

  const hasFriendsActivity = feed.some((a) => a.userId !== user?.id);

  const findFriends = !hasFriendsActivity && (
    <Pressable style={[styles.prompt, { backgroundColor: colors.card }]} onPress={() => router.push('/search')}>
      <MaterialCommunityIcons name="account-multiple-plus-outline" size={30} color={colors.accent} />
      <View style={styles.promptText}>
        <Text style={[styles.promptTitle, { color: colors.text }]}>Way to go!</Text>
        <Text style={{ color: colors.textSecondary }}>Find friends to inspire your next activity.</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSecondary} />
    </Pressable>
  );

  const suggestedChallenges = challenges.length > 0 && (
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
        left={
          <>
            <HeaderButton icon="plus" label="Add manual activity" onPress={() => router.push('/manual')} />
            <HeaderButton icon="magnify" label="Find friends and clubs" onPress={() => router.push('/search')} />
          </>
        }
        title={<Wordmark />}
        right={
          <>
            <HeaderButton icon="chat-outline" label="Messages" dot={badges.messages > 0} onPress={() => router.push('/messages')} />
            <HeaderButton icon="bell-outline" label="Notifications" dot={badges.notifications > 0}
              onPress={() => router.push('/notifications')} />
          </>
        }
      />
      <FlatList
        contentContainerStyle={styles.list}
        data={feed}
        keyExtractor={(a) => a.id}
        renderItem={({ item, index }) => (
          <>
            <ActivityCard activity={item} />
            {index === 0 && (
              <>
                {findFriends}
                <WhoToFollow athletes={suggested} />
                {suggestedChallenges}
              </>
            )}
          </>
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.more} color={colors.accent} /> : null}
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
            {!error && (
              <>
                {findFriends}
                <WhoToFollow athletes={suggested} />
                {suggestedChallenges}
              </>
            )}
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
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, marginBottom: 16, alignSelf: 'stretch' },
  promptText: { flex: 1 },
  promptTitle: { fontSize: 16, fontWeight: '800' },
  more: { marginVertical: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
});
