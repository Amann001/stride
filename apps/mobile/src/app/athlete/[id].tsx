import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { formatDistance, type ActivitySummary, type AthleteProfile } from '@repo/shared';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { Avatar } from '@/components/avatar';
import { FollowButton } from '@/components/follow-button';
import { SafetyMenu } from '@/components/safety-menu';
import { Band, Section, SectionHeader } from '@/components/section';
import { useColors } from '@/constants/theme';
import { api } from '@/lib/api';

// Someone's profile: who they are, their followers, and the activities you're allowed to
// see. Follow them, or send a message.
export default function AthleteScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(() => {
    Promise.all([api.athlete(id), api.athleteActivities(id)]).then(
      ([a, list]) => {
        setAthlete(a);
        setActivities(list);
      },
      (err) => setError(err instanceof Error ? err.message : 'Athlete not found'),
    );
  }, [id]);

  useFocusEffect(load);

  const message = async () => {
    setOpening(true);
    try {
      const conversation = await api.startConversation(id);
      router.push({
        pathname: '/messages/[id]',
        params: { id: conversation.id, name: conversation.other.name, otherId: conversation.other.id },
      });
    } catch (err) {
      Alert.alert('Can’t message yet', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setOpening(false);
    }
  };

  if (error) return <Text style={[styles.center, { color: colors.danger }]}>{error}</Text>;
  if (!athlete) return <ActivityIndicator style={styles.center} color={colors.accent} />;

  const counts = [
    { label: athlete.followerCount === 1 ? 'Follower' : 'Followers', value: athlete.followerCount, list: 'followers' as const },
    { label: 'Following', value: athlete.followingCount, list: 'following' as const },
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.separator }} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: athlete.name,
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable hitSlop={10} accessibilityLabel="Share profile"
                onPress={() => Share.share({ message: `Follow ${athlete.name} on Stride! Search for "${athlete.name}" in the app.` })}>
                <MaterialCommunityIcons name="export-variant" size={24} color={colors.text} />
              </Pressable>
              {!athlete.isMe && (
                <Pressable hitSlop={10} accessibilityLabel="Report or block" onPress={() => setMenuOpen(true)}>
                  <MaterialCommunityIcons name="dots-horizontal" size={26} color={colors.text} />
                </Pressable>
              )}
            </View>
          ),
        }}
      />
      <View style={[styles.header, { backgroundColor: colors.card }]}>
      <View style={styles.top}>
        <Avatar id={athlete.id} name={athlete.name} size={84} />
        <View style={styles.topText}>
          <Text style={[styles.name, { color: colors.text }]}>{athlete.name}</Text>
          {!!athlete.location && (
            <View style={styles.location}>
              <MaterialCommunityIcons name="map-marker-outline" size={15} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary }}>{athlete.location}</Text>
            </View>
          )}
          {athlete.followsYou && !athlete.isMe && (
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>Follows you</Text>
          )}
        </View>
      </View>
      {!!athlete.bio && <Text style={[styles.bio, { color: colors.text }]}>{athlete.bio}</Text>}

      <View style={styles.counts}>
        {counts.map((c) => (
          <Pressable key={c.list} style={styles.count}
            onPress={() => router.push({ pathname: '/connections', params: { athleteId: athlete.id, list: c.list, name: athlete.name } })}>
            <Text style={[styles.countValue, { color: colors.text }]}>{c.value}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{c.label}</Text>
          </Pressable>
        ))}
        <View style={styles.count}>
          <Text style={[styles.countValue, { color: colors.text }]}>{athlete.activityCount}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Activities</Text>
        </View>
      </View>

      {athlete.isMe ? (
        <Pressable style={[styles.outline, { borderColor: colors.border }]} onPress={() => router.push('/edit-profile')}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Edit profile</Text>
        </Pressable>
      ) : athlete.blockedByYou ? (
        <Pressable style={[styles.outline, { borderColor: colors.border }]}
          onPress={() => api.unblockAthlete(athlete.id).then(load, () => Alert.alert('Could not unblock', 'Please try again.'))}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Unblock</Text>
        </Pressable>
      ) : (
        <View style={styles.buttons}>
          <View style={styles.flex}>
            <FollowButton athleteId={athlete.id} following={athlete.isFollowing} followsYou={athlete.followsYou} onChange={load} />
          </View>
          <Pressable style={[styles.outline, styles.flex, { borderColor: colors.border }]} onPress={message} disabled={opening}>
            {opening ? <ActivityIndicator color={colors.text} /> : (
              <View style={styles.messageRow}>
                <MaterialCommunityIcons name="chat-outline" size={18} color={colors.text} />
                <Text style={{ color: colors.text, fontWeight: '700' }}>Message</Text>
              </View>
            )}
          </Pressable>
        </View>
      )}

      <View style={[styles.card, { borderColor: colors.border }]}>
        <View style={styles.stat}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>This week</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{formatDistance(athlete.weekDistanceMeters)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>This year</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{formatDistance(athlete.yearDistanceMeters)}</Text>
        </View>
      </View>

      </View>

      <Band />
      <Section>
        <SectionHeader title="Activities" />
        {!activities.length && (
          <Text style={{ color: colors.textSecondary }}>
            {athlete.isFollowing || athlete.isMe ? 'No activities yet.' : `Follow ${athlete.name} to see activities they share with followers.`}
          </Text>
        )}
      </Section>
      {activities.map((a) => (
        <View key={a.id}>
          <Band height={1} />
          <ActivityCard activity={a} />
        </View>
      ))}
      <SafetyMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        athleteId={athlete.id}
        name={athlete.name}
        blockedByYou={athlete.blockedByYou}
        // After blocking, leave their profile; after unblocking, show it again.
        onBlockedChange={(blocked) => (blocked ? router.back() : load())}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { marginTop: 48, textAlign: 'center' },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  content: { paddingBottom: 40 },
  header: { padding: 16, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  topText: { flex: 1, gap: 4 },
  name: { fontSize: 24, fontWeight: '700' },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bio: { fontSize: 15, lineHeight: 21 },
  counts: { flexDirection: 'row', gap: 28 },
  count: { gap: 2 },
  countValue: { fontSize: 18, fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  outline: { borderWidth: 1, borderRadius: 999, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  messageRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  card: { flexDirection: 'row', paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 20, fontWeight: '700' },
  section: { fontSize: 20, fontWeight: '700', marginTop: 6 },
});
