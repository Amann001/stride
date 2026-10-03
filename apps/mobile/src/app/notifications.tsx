import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { Achievement, ActivitySummary, Notification } from '@repo/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Medal, MEDAL_COLORS } from '@/components/achievements';
import { Avatar } from '@/components/avatar';
import { useColors } from '@/constants/theme';
import { api } from '@/lib/api';

type Item =
  | { key: string; at: string; kind: 'social'; n: Notification }
  | { key: string; at: string; kind: 'achievement'; achievement: Achievement; activity: ActivitySummary };

const VERB: Record<Notification['kind'], string> = {
  follow: 'started following you',
  kudos: 'gave you kudos on',
  comment: 'commented on',
  challenge_invite: 'invited you to the challenge',
};

const KIND_ICON = {
  follow: 'account-plus',
  kudos: 'thumb-up',
  comment: 'comment',
  challenge_invite: 'flag-checkered',
} as const satisfies Record<Notification['kind'], string>;

// Notifications: who followed you, gave kudos, commented or invited you to a challenge, plus
// every achievement you've earned. Newest first. Opening this screen marks them as read.
export default function NotificationsScreen() {
  const colors = useColors();
  const [items, setItems] = useState<Item[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([api.notifications(), api.listActivities()]).then(
        ([social, mine]) => {
          const all: Item[] = [
            ...social.map((n): Item => ({ key: n.id, at: n.createdAt, kind: 'social', n })),
            ...mine.flatMap((activity) =>
              activity.achievements.map((achievement, i): Item => ({
                key: `${activity.id}-${i}`, at: activity.startedAt, kind: 'achievement', achievement, activity,
              })),
            ),
          ];
          setItems(all.sort((a, b) => b.at.localeCompare(a.at)));
          if (social.some((n) => !n.read)) api.markNotificationsRead().catch(() => {});
        },
        () => setItems([]),
      );
    }, []),
  );

  const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      data={items ?? []}
      keyExtractor={(i) => i.key}
      renderItem={({ item }) => {
        if (item.kind === 'social') {
          const { n } = item;
          const open = () =>
            n.challenge
              ? router.push({ pathname: '/challenge/[id]', params: { id: n.challenge.id } })
              : n.activity
                ? router.push({ pathname: '/activity/[id]', params: { id: n.activity.id, show: n.kind === 'comment' ? 'comments' : undefined } })
                : router.push({ pathname: '/athlete/[id]', params: { id: n.actor.id } });
          return (
            <Pressable style={[styles.row, { borderColor: colors.border }, !n.read && { backgroundColor: colors.card }]} onPress={open}>
              <View>
                <Avatar id={n.actor.id} name={n.actor.name} size={42} />
                <View style={[styles.kindIcon, { backgroundColor: colors.brand }]}>
                  <MaterialCommunityIcons name={KIND_ICON[n.kind]} size={11} color={colors.onBrand} />
                </View>
              </View>
              <View style={styles.text}>
                <Text style={{ color: colors.text, fontSize: 15 }}>
                  <Text style={styles.bold}>{n.actor.name}</Text> {VERB[n.kind]}
                  {n.activity ? <Text style={styles.bold}> {n.activity.title}</Text> : null}
                  {n.challenge ? <Text style={styles.bold}> {n.challenge.title}</Text> : null}
                  {n.text ? `: "${n.text}"` : '.'}
                </Text>
                <Text style={[styles.time, { color: colors.textSecondary }]}>{when(n.createdAt)}</Text>
              </View>
              {!n.read && <View style={[styles.unread, { backgroundColor: colors.brand }]} />}
            </Pressable>
          );
        }
        const { achievement, activity } = item;
        return (
          <Pressable style={[styles.row, { borderColor: colors.border }]}
            onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}>
            <View style={[styles.medal, { borderColor: MEDAL_COLORS[achievement.rank] }]}>
              <Medal achievement={achievement} size={22} />
            </View>
            <View style={styles.text}>
              <Text style={{ color: colors.text, fontSize: 15 }}>
                You earned <Text style={styles.bold}>{achievement.title}</Text>
                {achievement.detail ? ` (${achievement.detail})` : ''} on {activity.title}.
              </Text>
              <Text style={[styles.time, { color: colors.textSecondary }]}>{when(activity.startedAt)}</Text>
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        items ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="bell-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications yet</Text>
            <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
              Kudos, comments, new followers, challenge invites and your achievements will show up here.
            </Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1 },
  row: { flexDirection: 'row', gap: 12, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  kindIcon: { position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  medal: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  bold: { fontWeight: '700' },
  time: { fontSize: 12, marginTop: 2 },
  unread: { width: 9, height: 9, borderRadius: 5 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
});
