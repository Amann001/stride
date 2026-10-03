import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  challengeDays,
  formatChallengeValue,
  type AthleteSummary,
  type CustomChallengeDetail,
} from '@repo/shared';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MEDAL_COLORS } from '@/components/achievements';
import { Avatar } from '@/components/avatar';
import { ChallengeBadge } from '@/components/challenge-card';
import { INK, useColors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

// Today on the phone's calendar, as "2026-10-05".
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "Starts in 3 days", "5 days left", "Last day", "Ended".
function timeLabel(c: CustomChallengeDetail): string {
  const { status, startDate, endDate } = c.custom;
  if (status === 'ended') return 'Ended';
  if (status === 'upcoming') {
    const n = challengeDays(todayIso(), startDate) - 1;
    return n <= 1 ? 'Starts tomorrow' : `Starts in ${n} days`;
  }
  const left = challengeDays(todayIso(), endDate);
  return left <= 1 ? 'Last day' : `${left} days left`;
}

// A challenge someone created: your progress, the leaderboard, who's invited, and inviting
// more friends. The creator can delete it; everyone else can leave.
export default function CustomChallengeScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [challenge, setChallenge] = useState<CustomChallengeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The "Invite friends" list: null while closed.
  const [friends, setFriends] = useState<AthleteSummary[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    api.customChallenge(id).then(setChallenge, (err) => setError(err instanceof Error ? err.message : 'Challenge not found'));
  }, [id]);
  useFocusEffect(load);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Text style={[styles.center, { color: colors.danger }]}>{error}</Text>;
  if (!challenge) return <ActivityIndicator style={styles.center} color={colors.accent} />;

  const c = challenge;
  const ended = c.custom.status === 'ended';
  const fraction = Math.min(1, c.progress / c.goal);
  const inChallenge = new Set([...c.leaderboard.map((l) => l.athlete.id), ...c.invited.map((p) => p.id)]);

  const accept = () => run(async () => {
    await api.acceptChallengeInvite(c.id);
    load();
  });
  const decline = () => run(async () => {
    await api.leaveCustomChallenge(c.id);
    router.back();
  });
  const confirmLeave = () =>
    Alert.alert('Leave challenge?', `You'll be taken off the "${c.title}" leaderboard.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: decline },
    ]);
  const confirmDelete = () =>
    Alert.alert('Delete challenge?', `"${c.title}" will be removed for everyone in it. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => run(async () => {
        await api.deleteCustomChallenge(c.id);
        router.back();
      }) },
    ]);

  const openInvites = () => {
    if (!user) return;
    setPicked(new Set());
    api.connections(user.id, 'following').then(
      (list) => setFriends(list.filter((f) => !inChallenge.has(f.id))),
      () => setFriends([]),
    );
  };
  const sendInvites = () => run(async () => {
    await api.inviteToChallenge(c.id, [...picked]);
    setFriends(null);
    load();
  });

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: c.title }} />

      <View style={[styles.hero, { backgroundColor: colors.card }]}>
        <ChallengeBadge challenge={c} size={72} />
        <Text style={[styles.title, { color: colors.text }]}>{c.title}</Text>
        <Text style={[styles.description, { color: colors.text }]}>{c.description}</Text>
        <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
          Created by {c.custom.creator.name} · {c.participants} {c.participants === 1 ? 'athlete' : 'athletes'} · {timeLabel(c)}
        </Text>

        {c.custom.invited ? (
          <View style={styles.inviteButtons}>
            <Pressable onPress={accept} disabled={busy || ended} style={[styles.button, { backgroundColor: colors.brand }]}>
              {busy ? <ActivityIndicator color={INK} /> : <Text style={styles.buttonText}>{ended ? 'Ended' : 'Accept Invite'}</Text>}
            </Pressable>
            <Pressable onPress={decline} disabled={busy} style={[styles.button, { borderWidth: 1, borderColor: colors.border }]}>
              <Text style={[styles.buttonText, { color: colors.text }]}>Decline</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.progress}>
            <View style={[styles.track, { backgroundColor: colors.border }]}>
              <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: colors.brand }]} />
            </View>
            <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
              {c.completed
                ? 'Completed! It’s in your Trophy Case.'
                : `You: ${formatChallengeValue(c.metric, c.progress)} of ${formatChallengeValue(c.metric, c.goal)}`}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Leaderboard</Text>
        {c.leaderboard.map((l, i) => (
          <Pressable key={l.athlete.id} style={styles.leader}
            onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: l.athlete.id } })}>
            <Text style={[styles.rank, { color: i < 3 && l.progress > 0 ? MEDAL_COLORS[(i + 1) as 1 | 2 | 3] : colors.textSecondary }]}>{i + 1}</Text>
            <Avatar id={l.athlete.id} name={l.athlete.name} size={36} />
            <View style={styles.leaderMain}>
              <Text style={[styles.stackedName, { color: colors.text }]} numberOfLines={1}>
                {l.athlete.id === user?.id ? 'You' : l.athlete.name}
              </Text>
              <View style={[styles.miniTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.miniFill, { width: `${Math.min(1, l.progress / c.goal) * 100}%`, backgroundColor: colors.brand }]} />
              </View>
            </View>
            <View style={styles.leaderStats}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{formatChallengeValue(c.metric, l.progress)}</Text>
              {l.completed && <MaterialCommunityIcons name="trophy" size={16} color={MEDAL_COLORS[1]} />}
            </View>
          </Pressable>
        ))}
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          Activities set to “Only you” don’t count, so nobody else sees them.
        </Text>
      </View>

      {c.invited.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Invited</Text>
          {c.invited.map((p) => (
            <Pressable key={p.id} style={styles.leader} onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: p.id } })}>
              <Avatar id={p.id} name={p.name} size={36} />
              <Text style={[styles.leaderName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Hasn’t answered yet</Text>
            </Pressable>
          ))}
        </View>
      )}

      {c.joined && !ended && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {friends === null ? (
            <Pressable onPress={openInvites} style={[styles.button, { borderWidth: 1, borderColor: colors.border }]}>
              <Text style={[styles.buttonText, { color: colors.text }]}>Invite Friends</Text>
            </Pressable>
          ) : (
            <>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Invite friends</Text>
              {friends.length ? friends.map((f) => {
                const on = picked.has(f.id);
                return (
                  <Pressable key={f.id} style={styles.leader} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                    onPress={() => setPicked((prev) => {
                      const next = new Set(prev);
                      if (next.has(f.id)) next.delete(f.id);
                      else next.add(f.id);
                      return next;
                    })}>
                    <Avatar id={f.id} name={f.name} size={36} />
                    <Text style={[styles.leaderName, { color: colors.text }]} numberOfLines={1}>{f.name}</Text>
                    <MaterialCommunityIcons name={on ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={26}
                      color={on ? colors.accent : colors.textSecondary} />
                  </Pressable>
                );
              }) : (
                <Text style={{ color: colors.textSecondary }}>Everyone you follow is already in this challenge.</Text>
              )}
              <View style={styles.inviteButtons}>
                <Pressable onPress={sendInvites} disabled={busy || !picked.size}
                  style={[styles.button, { backgroundColor: colors.brand, opacity: picked.size ? 1 : 0.5 }]}>
                  {busy ? <ActivityIndicator color={INK} /> : (
                    <Text style={styles.buttonText}>{picked.size ? `Send ${picked.size} ${picked.size === 1 ? 'Invite' : 'Invites'}` : 'Send Invites'}</Text>
                  )}
                </Pressable>
                <Pressable onPress={() => setFriends(null)} style={[styles.button, { borderWidth: 1, borderColor: colors.border }]}>
                  <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      )}

      {c.isCreator ? (
        <Pressable onPress={confirmDelete} disabled={busy} style={styles.danger}>
          <Text style={{ color: colors.danger, fontWeight: '700' }}>Delete Challenge</Text>
        </Pressable>
      ) : c.joined ? (
        <Pressable onPress={confirmLeave} disabled={busy} style={styles.danger}>
          <Text style={{ color: colors.danger, fontWeight: '700' }}>Leave Challenge</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { marginTop: 48, textAlign: 'center' },
  content: { padding: 12, gap: 12, paddingBottom: 40 },
  hero: { borderRadius: 16, padding: 20, alignItems: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  description: { textAlign: 'center', fontSize: 15 },
  progress: { alignSelf: 'stretch', gap: 6, marginTop: 6 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  inviteButtons: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 6 },
  button: { flex: 1, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: INK, fontWeight: '700', fontSize: 15 },
  card: { borderRadius: 16, padding: 16, gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  leader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: { width: 22, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  leaderMain: { flex: 1, gap: 6 },
  leaderName: { flex: 1, fontSize: 15, fontWeight: '600' },
  stackedName: { fontSize: 15, fontWeight: '600' },
  miniTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  miniFill: { height: 5, borderRadius: 3 },
  // Fixed width, so every row's progress bar is the same length.
  leaderStats: { alignItems: 'flex-end', gap: 2, width: 84 },
  danger: { alignItems: 'center', paddingVertical: 14 },
});
