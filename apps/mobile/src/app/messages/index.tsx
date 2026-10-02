import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { Conversation } from '@repo/shared';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { useColors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { shortTime } from '@/lib/short-time';

// Messages: your private conversations, newest first. The pencil starts a new one.
export default function MessagesScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      const load = () => api.conversations().then(setConversations, () => setConversations((c) => c ?? []));
      load();
      // Keep the list fresh while it's open.
      const id = setInterval(load, 10_000);
      return () => clearInterval(id);
    }, []),
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Messages',
          headerRight: () => (
            <Pressable onPress={() => router.push('/messages/new')} hitSlop={10} accessibilityLabel="New message">
              <MaterialCommunityIcons name="square-edit-outline" size={25} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      {conversations === null ? (
        <ActivityIndicator style={styles.center} color={colors.accent} />
      ) : (
        <FlatList
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={styles.list}
          data={conversations}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => {
            const unread = item.unreadCount > 0;
            const last = item.lastMessage;
            return (
              <Pressable style={[styles.row, { borderColor: colors.border }]}
                onPress={() => router.push({ pathname: '/messages/[id]', params: { id: item.id, name: item.other.name, otherId: item.other.id } })}>
                <Avatar id={item.other.id} name={item.other.name} size={50} />
                <View style={styles.text}>
                  <View style={styles.topLine}>
                    <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.other.name}</Text>
                    {last && <Text style={{ color: unread ? colors.accent : colors.textSecondary, fontSize: 12 }}>{shortTime(last.createdAt)}</Text>}
                  </View>
                  <Text style={{ color: unread ? colors.text : colors.textSecondary, fontWeight: unread ? '700' : '400' }} numberOfLines={1}>
                    {last ? `${last.senderId === user?.id ? 'You: ' : ''}${last.body}` : ''}
                  </Text>
                </View>
                {unread && <View style={[styles.dot, { backgroundColor: colors.brand }]} />}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="chat-outline" size={52} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Messages</Text>
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                Messaging lets you privately chat with other athletes on Stride. Start a conversation to see it here.
              </Text>
              <Pressable style={[styles.button, { backgroundColor: colors.brand }]} onPress={() => router.push('/messages/new')}>
                <Text style={{ color: colors.onBrand, fontWeight: '800' }}>New Message</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: { marginTop: 48 },
  list: { flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, gap: 3 },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  button: { borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
});
