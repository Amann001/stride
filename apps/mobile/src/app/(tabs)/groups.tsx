import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ACTIVITY_LABELS, ACTIVITY_TYPES, type ActivityType, type Challenge } from '@repo/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChallengeCard } from '@/components/challenge-card';
import { TabHeader } from '@/components/tab-header';
import { CATEGORY_LOOKS } from '@/constants/categories';
import { INK, useColors } from '@/constants/theme';
import { api } from '@/lib/api';

// Groups tab: this month's challenges. Filter by sport, join one, and watch your progress
// fill up as you record. (Clubs and events arrive with following friends in the next phase.)
export default function GroupsScreen() {
  const colors = useColors();
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [filter, setFilter] = useState<ActivityType | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setChallenges((await api.getChallenges()).current);
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
      <TabHeader title="Challenges" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }} />}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <FilterChip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          {ACTIVITY_TYPES.map((t) => (
            <FilterChip key={t} type={t} label={ACTIVITY_LABELS[t]} selected={filter === t} onPress={() => setFilter(t)} />
          ))}
        </ScrollView>

        {error && <Text style={[styles.message, { color: colors.danger }]}>{error}</Text>}

        {joined.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Challenges</Text>
            {joined.map((c) => <ChallengeCard key={c.id} challenge={c} onChange={load} />)}
          </View>
        )}

        {others.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recommended For You</Text>
            <Text style={{ color: colors.textSecondary, marginTop: -6 }}>
              New challenges every month. Join one and your activities count automatically.
            </Text>
            {others.map((c) => <ChallengeCard key={c.id} challenge={c} onChange={load} />)}
          </View>
        )}
      </ScrollView>
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
  content: { padding: 12, gap: 16, paddingBottom: 32 },
  chips: { gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  message: { textAlign: 'center', marginTop: 24 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '800' },
});
