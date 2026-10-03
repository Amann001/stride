import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { formatChallengeDate, formatChallengeValue, type Challenge } from '@repo/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { MEDAL_COLORS } from '@/components/achievements';
import { CATEGORY_LOOKS } from '@/constants/categories';
import { INK, LIME, useColors } from '@/constants/theme';
import { api } from '@/lib/api';

// The challenge's badge: its sport's icon, or a lightning bolt when every sport counts.
export function ChallengeBadge({ challenge, size = 56 }: { challenge: Challenge; size?: number }) {
  const look = challenge.sport ? CATEGORY_LOOKS[challenge.sport] : { icon: 'lightning-bolt' as const, color: LIME };
  const done = challenge.completed;
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: look.color },
      done && { borderWidth: 3, borderColor: MEDAL_COLORS[1] }]}>
      <MaterialCommunityIcons name={done ? 'trophy' : look.icon} size={size * 0.5} color={INK} />
    </View>
  );
}

// "Created by Riya · Ends 23 Oct", for a challenge someone created.
function customLine(c: Challenge): string | null {
  if (!c.custom) return null;
  const when = c.custom.status === 'upcoming'
    ? `Starts ${formatChallengeDate(c.custom.startDate)}`
    : `Ends ${formatChallengeDate(c.custom.endDate)}`;
  return `Created by ${c.custom.creator.name} · ${when}`;
}

const openChallenge = (id: string) => router.push({ pathname: '/challenge/[id]', params: { id } });

// One challenge: what to do, how far along you are, and a Join button. A challenge someone
// created opens its own page (with the leaderboard) when tapped; an invite can be accepted here.
export function ChallengeCard({ challenge, onChange, style }: {
  challenge: Challenge;
  // Called after joining or leaving, so the list can reload.
  onChange: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  const fraction = Math.min(1, challenge.progress / challenge.goal);

  const toggle = async () => {
    setBusy(true);
    try {
      if (challenge.custom) await api.acceptChallengeInvite(challenge.id);
      else if (challenge.joined) await api.leaveChallenge(challenge.id);
      else await api.joinChallenge(challenge.id);
      onChange();
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmLeave = () =>
    Alert.alert('Leave challenge?', `You can join "${challenge.title}" again any time this month.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: toggle },
    ]);

  const custom = customLine(challenge);
  const onButton = challenge.custom
    ? (challenge.joined ? () => openChallenge(challenge.id) : toggle)
    : (challenge.joined ? confirmLeave : toggle);
  // Filled button for something to do (join, accept); outlined once you're in.
  const outlined = challenge.joined;
  const label = challenge.custom
    ? (challenge.joined ? 'View Challenge' : 'Accept Invite')
    : (challenge.joined ? 'Joined' : 'Join Challenge');

  return (
    <Pressable disabled={!challenge.custom} onPress={() => openChallenge(challenge.id)}
      style={[styles.card, { backgroundColor: colors.raised }, style]}>
      <View style={styles.top}>
        <ChallengeBadge challenge={challenge} />
        <View style={styles.text}>
          <Text style={[styles.title, { color: colors.text }]}>{challenge.title}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{challenge.description}</Text>
        </View>
      </View>

      {challenge.joined && (
        <View style={styles.progress}>
          <View style={[styles.track, { backgroundColor: colors.border }]}>
            <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: colors.brand }]} />
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {challenge.completed
              ? 'Completed!'
              : `${formatChallengeValue(challenge.metric, challenge.progress)} of ${formatChallengeValue(challenge.metric, challenge.goal)}`}
          </Text>
        </View>
      )}

      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
        {custom ? `${custom} · ` : ''}
        {challenge.participants === 1 ? '1 athlete has joined' : `${challenge.participants} athletes have joined`}
      </Text>

      <Pressable
        disabled={busy}
        onPress={onButton}
        style={[styles.button, outlined ? { borderWidth: 1, borderColor: colors.border } : { backgroundColor: colors.brand }]}>
        {busy ? (
          <ActivityIndicator color={outlined ? colors.text : colors.onBrand} />
        ) : (
          <Text style={[styles.buttonText, { color: outlined ? colors.text : colors.onBrand }]}>{label}</Text>
        )}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 16, gap: 12 },
  top: { flexDirection: 'row', gap: 14 },
  badge: { alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 4 },
  title: { fontSize: 17, fontWeight: '700' },
  progress: { gap: 6 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  button: { borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  buttonText: { fontWeight: '700', fontSize: 15 },
});
