import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ACTIVITY_LABELS, formatDistance, type ClubDetail } from '@repo/shared';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { Avatar } from '@/components/avatar';
import { ClubBadge } from '@/components/club-row';
import { MEDAL_COLORS } from '@/components/achievements';
import { INK, useColors } from '@/constants/theme';
import { api } from '@/lib/api';

type Tab = 'leaderboard' | 'activities' | 'members';

// A club's page: join or leave, this week's leaderboard, members' recent activities, and
// who's in it.
export default function ClubScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [club, setClub] = useState<ClubDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('leaderboard');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.club(id).then(setClub, (err) => setError(err instanceof Error ? err.message : 'Club not found'));
  }, [id]);
  useFocusEffect(load);

  const toggleMembership = async () => {
    if (!club) return;
    setBusy(true);
    try {
      if (club.isMember) await api.leaveClub(club.id);
      else await api.joinClub(club.id);
      load();
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Text style={[styles.center, { color: colors.danger }]}>{error}</Text>;
  if (!club) return <ActivityIndicator style={styles.center} color={colors.accent} />;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: club.name,
          headerRight: () => (
            <Pressable hitSlop={10} accessibilityLabel="Share club"
              onPress={() => Share.share({ message: `Join ${club.name} on Stride! Search for it under Groups > Clubs.` })}>
              <MaterialCommunityIcons name="export-variant" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <View style={[styles.hero, { backgroundColor: colors.card }]}>
        <ClubBadge club={club} size={72} />
        <Text style={[styles.name, { color: colors.text }]}>{club.name}</Text>
        <Text style={{ color: colors.textSecondary }}>
          {ACTIVITY_LABELS[club.sport]}{club.location ? ` · ${club.location}` : ''} · {club.memberCount} {club.memberCount === 1 ? 'member' : 'members'}
        </Text>
        {!!club.description && <Text style={[styles.description, { color: colors.text }]}>{club.description}</Text>}
        {club.isOwner ? (
          <Text style={{ color: colors.accent, fontWeight: '700' }}>You created this club</Text>
        ) : (
          <Pressable onPress={toggleMembership} disabled={busy}
            style={[styles.join, club.isMember ? { borderWidth: 1, borderColor: colors.border } : { backgroundColor: colors.brand }]}>
            {busy ? <ActivityIndicator color={club.isMember ? colors.text : INK} /> : (
              <Text style={{ color: club.isMember ? colors.text : INK, fontWeight: '800' }}>
                {club.isMember ? 'Joined' : 'Join Club'}
              </Text>
            )}
          </Pressable>
        )}
      </View>

      <View style={[styles.tabs, { borderColor: colors.border }]}>
        {([['leaderboard', 'Leaderboard'], ['activities', 'Activities'], ['members', 'Members']] as const).map(([key, label]) => (
          <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && { borderBottomColor: colors.accent }]}>
            <Text style={{ color: tab === key ? colors.text : colors.textSecondary, fontWeight: '700' }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'leaderboard' && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>This week’s {ACTIVITY_LABELS[club.sport].toLowerCase()} distance</Text>
          {club.leaderboard.length ? club.leaderboard.map((l, i) => (
            <Pressable key={l.athlete.id} style={styles.leader}
              onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: l.athlete.id } })}>
              <Text style={[styles.rank, { color: i < 3 ? MEDAL_COLORS[(i + 1) as 1 | 2 | 3] : colors.textSecondary }]}>{i + 1}</Text>
              <Avatar id={l.athlete.id} name={l.athlete.name} size={36} />
              <Text style={[styles.leaderName, { color: colors.text }]} numberOfLines={1}>{l.athlete.name}</Text>
              <View style={styles.leaderStats}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{formatDistance(l.distanceMeters)}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{l.activityCount} {l.activityCount === 1 ? 'activity' : 'activities'}</Text>
              </View>
            </Pressable>
          )) : (
            <Text style={{ color: colors.textSecondary }}>No {ACTIVITY_LABELS[club.sport].toLowerCase()}s logged by members this week yet. Be the first!</Text>
          )}
        </View>
      )}

      {tab === 'activities' && (club.recentActivities.length ? (
        club.recentActivities.map((a) => <ActivityCard key={a.id} activity={a} />)
      ) : (
        <Text style={[styles.note, { color: colors.textSecondary }]}>Members’ recent activities will show up here.</Text>
      ))}

      {tab === 'members' && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {club.members.map((m, i) => (
            <Pressable key={m.id} style={styles.leader} onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: m.id } })}>
              <Avatar id={m.id} name={m.name} size={36} />
              <Text style={[styles.leaderName, { color: colors.text }]}>{m.name}</Text>
              {i === 0 && <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>Owner</Text>}
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { marginTop: 48, textAlign: 'center' },
  content: { padding: 12, gap: 12, paddingBottom: 40 },
  hero: { borderRadius: 16, padding: 20, alignItems: 'center', gap: 8 },
  name: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  description: { textAlign: 'center', fontSize: 15 },
  join: { borderRadius: 999, paddingVertical: 11, paddingHorizontal: 36, marginTop: 6, minWidth: 160, alignItems: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  card: { borderRadius: 16, padding: 16, gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  leader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: { width: 22, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  leaderName: { flex: 1, fontSize: 15, fontWeight: '600' },
  leaderStats: { alignItems: 'flex-end' },
  note: { textAlign: 'center', marginTop: 24 },
});
