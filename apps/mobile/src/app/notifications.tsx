import type { Achievement, ActivitySummary } from '@repo/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Medal, MEDAL_COLORS } from '@/components/achievements';
import { useColors } from '@/constants/theme';
import { api } from '@/lib/api';

interface Item {
  key: string;
  achievement: Achievement;
  activity: ActivitySummary;
}

// Notifications: every achievement you've earned, newest first. Tapping one opens the
// activity. (Kudos and comments from friends will show up here in the next phase.)
export default function NotificationsScreen() {
  const colors = useColors();
  const [items, setItems] = useState<Item[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.listActivities().then(
        (list) =>
          setItems(list.flatMap((activity) =>
            activity.achievements.map((achievement, i) => ({ key: `${activity.id}-${i}`, achievement, activity })),
          )),
        () => setItems([]),
      );
    }, []),
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      data={items ?? []}
      keyExtractor={(i) => i.key}
      renderItem={({ item }) => (
        <Pressable
          style={[styles.row, { borderColor: colors.border }]}
          onPress={() => router.push({ pathname: '/activity/[id]', params: { id: item.activity.id } })}>
          <View style={[styles.medal, { borderColor: MEDAL_COLORS[item.achievement.rank] }]}>
            <Medal achievement={item.achievement} size={22} />
          </View>
          <View style={styles.text}>
            <Text style={{ color: colors.text, fontSize: 15 }}>
              You earned <Text style={styles.bold}>{item.achievement.title}</Text>
              {item.achievement.detail ? ` (${item.achievement.detail})` : ''} on {item.activity.title}.
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
              {new Date(item.activity.startedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </Text>
          </View>
        </Pressable>
      )}
      ListEmptyComponent={
        items ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications yet</Text>
            <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
              Record an activity to start earning achievements.
            </Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1 },
  row: { flexDirection: 'row', gap: 12, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  medal: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  bold: { fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
});
