import type { AthleteSummary } from '@repo/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { FollowButton } from '@/components/follow-button';
import { useColors } from '@/constants/theme';

// "Who to Follow": swipeable cards with Follow and Remove, like Strava's Home tab.
export function WhoToFollow({ athletes }: { athletes: AthleteSummary[] }) {
  const colors = useColors();
  const [hidden, setHidden] = useState<string[]>([]);
  const shown = athletes.filter((a) => !hidden.includes(a.id));
  if (shown.length === 0) return null;

  return (
    <View style={[styles.section, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Who to Follow</Text>
        <Pressable onPress={() => router.push('/search')} hitSlop={8}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>See All</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={styles.cards}>
        {shown.map((a) => (
          <Pressable key={a.id} style={[styles.card, { backgroundColor: colors.raised }]}
            onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: a.id } })}>
            <Avatar id={a.id} name={a.name} size={64} />
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{a.name}</Text>
            <Text style={[styles.reason, { color: colors.textSecondary }]} numberOfLines={2}>{a.reason ?? a.location ?? ' '}</Text>
            <View style={styles.buttons}>
              <FollowButton compact athleteId={a.id} following={a.isFollowing} followsYou={a.followsYou} />
              <Pressable onPress={() => setHidden((h) => [...h, a.id])} style={[styles.remove, { borderColor: colors.border }]}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13 }}>Remove</Text>
              </Pressable>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: 16, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  // Cards keep their own height instead of stretching to fill the screen.
  row: { flexGrow: 0 },
  cards: { gap: 12, paddingHorizontal: 16, alignItems: 'flex-start' },
  card: { width: 190, borderRadius: 14, padding: 16, alignItems: 'center', gap: 6 },
  name: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  reason: { fontSize: 12, textAlign: 'center', minHeight: 32 },
  buttons: { flexDirection: 'row', gap: 6, marginTop: 4 },
  remove: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
});
