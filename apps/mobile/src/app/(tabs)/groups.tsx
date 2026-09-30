import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ACTIVITY_LABELS, ACTIVITY_TYPES, type ActivityType, type Challenge, type Club } from '@repo/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChallengeCard } from '@/components/challenge-card';
import { ClubRow } from '@/components/club-row';
import { HeaderButton, TabHeader } from '@/components/tab-header';
import { CATEGORY_LOOKS } from '@/constants/categories';
import { INK, useColors } from '@/constants/theme';
import { api } from '@/lib/api';

// Groups tab, like Strava's: Challenges (this month's, filter by sport, join and watch your
// progress fill up) and Clubs (yours, and popular ones to join).
export default function GroupsScreen() {
  const colors = useColors();
  const [section, setSection] = useState<'challenges' | 'clubs'>('challenges');
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [popular, setPopular] = useState<Club[]>([]);
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [filter, setFilter] = useState<ActivityType | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [c, mine, all] = await Promise.all([api.getChallenges(), api.myClubs(), api.clubs()]);
      setChallenges(c.current);
      setMyClubs(mine);
      setPopular(all.filter((x) => !x.isMember));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load challenges');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // "All sports" challenges show under every filter.
  const shown = (challenges ?? []).filter((c) => filter === 'all' || c.sport === filter || c.sport === null);
  const joined = shown.filter((c) => c.joined);
  const others = shown.filter((c) => !c.joined);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TabHeader
        left={<HeaderButton icon="magnify" label="Search clubs" onPress={() => router.push({ pathname: '/search', params: { tab: 'clubs' } })} />}
        title="Groups"
        right={<HeaderButton icon="chat-outline" label="Messages" onPress={() => router.push('/messages')} />}
      />
      <View style={[styles.segments, { borderColor: colors.border }]}>
        {(['challenges', 'clubs'] as const).map((key) => (
          <Pressable key={key} onPress={() => setSection(key)} style={[styles.segment, section === key && { borderBottomColor: colors.accent }]}>
            <Text style={{ color: section === key ? colors.text : colors.textSecondary, fontWeight: '700', fontSize: 16 }}>
              {key === 'challenges' ? 'Challenges' : 'Clubs'}
            </Text>
          </Pressable>
        ))}
      </View>
      {section === 'clubs' ? (
        <ScrollView style={{ backgroundColor: colors.separator }} contentContainerStyle={styles.content}>
          <Pressable style={[styles.createClub, { backgroundColor: colors.card }]} onPress={() => router.push('/clubs/new')}>
            <MaterialCommunityIcons name="account-group" size={32} color={colors.accent} />
            <View style={styles.createText}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Create Your Own Club</Text>
              <Text style={{ color: colors.textSecondary }}>Give your community a motivating home base on Stride.</Text>
            </View>
          </Pressable>
          {myClubs.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Clubs</Text>
              {myClubs.map((c) => <ClubRow key={c.id} club={c} />)}
            </View>
          )}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Popular Clubs</Text>
            {popular.length ? popular.map((c) => <ClubRow key={c.id} club={c} />) : (
              <Text style={{ color: colors.textSecondary, marginTop: 6 }}>
                {myClubs.length ? "You've joined every club so far." : 'No clubs yet. Create the first one!'}
              </Text>
            )}
          </View>
        </ScrollView>
      ) : (
      <ScrollView
        style={{ backgroundColor: colors.separator }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }} />}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: colors.card, flexGrow: 0 }}
          contentContainerStyle={styles.chips}>
          <FilterChip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          {ACTIVITY_TYPES.map((t) => (
            <FilterChip key={t} type={t} label={ACTIVITY_LABELS[t]} selected={filter === t} onPress={() => setFilter(t)} />
          ))}
        </ScrollView>

        {error && <Text style={[styles.message, { color: colors.danger }]}>{error}</Text>}

        {joined.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Challenges</Text>
            {joined.map((c) => <ChallengeCard key={c.id} challenge={c} onChange={load} />)}
          </View>
        )}

        {others.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recommended For You</Text>
            <Text style={{ color: colors.textSecondary, marginTop: -6 }}>
              New challenges every month. Join one and your activities count automatically.
            </Text>
            {others.map((c) => <ChallengeCard key={c.id} challenge={c} onChange={load} />)}
          </View>
        )}
      </ScrollView>
      )}
    </View>
  );
}

function FilterChip({ label, type, selected, onPress }: {
  label: string; type?: ActivityType; selected: boolean; onPress: () => void;
}) {
  const colors = useColors();
  const fill = type ? CATEGORY_LOOKS[type].color : colors.brand;
  return (
    <Pressable onPress={onPress}
      style={[styles.chip, { borderColor: colors.border }, selected && { backgroundColor: fill, borderColor: fill }]}>
      {type && <MaterialCommunityIcons name={CATEGORY_LOOKS[type].icon} size={16} color={selected ? INK : colors.text} />}
      <Text style={{ color: selected ? INK : colors.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Full-width sections with a band between each, like Strava.
  content: { gap: 8, paddingBottom: 32 },
  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  message: { textAlign: 'center', marginTop: 24 },
  section: { gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  segments: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  createClub: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 18 },
  createText: { flex: 1, gap: 4 },
});
