import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { Message } from '@repo/shared';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { INK, useColors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const POLL_MS = 3000;

// Labels for messages still being sent, so a failed one can be retried.
let pendingCounter = 0;
const nextPendingKey = () => `pending-${++pendingCounter}`;

// Adds messages to a list without duplicates, oldest first.
function merge(list: Message[], more: Message[]): Message[] {
  const byId = new Map(list.map((m) => [m.id, m]));
  for (const m of more) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// A private chat with one person. New messages show up within a few seconds.
export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id, name, otherId } = useLocalSearchParams<{ id: string; name?: string; otherId?: string }>();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [pending, setPending] = useState<{ key: string; body: string; failed: boolean }[]>([]);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList>(null);
  const latest = useRef<string | undefined>(undefined);

  // Load the chat, then check for new messages every few seconds while it's open.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const fetchNew = async () => {
        try {
          const more = await api.messages(id, latest.current);
          if (cancelled) return;
          if (more.length) latest.current = more[more.length - 1].createdAt;
          setMessages((m) => merge(m ?? [], more));
          if (more.some((m) => m.senderId !== user?.id)) api.markConversationRead(id).catch(() => {});
        } catch {
          if (!cancelled) setMessages((m) => m ?? []);
        }
      };
      fetchNew();
      api.markConversationRead(id).catch(() => {});
      const timer = setInterval(fetchNew, POLL_MS);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }, [id, user?.id]),
  );

  // `retryKey` resends a message that failed; new messages get a fresh key.
  const send = async (body: string, retryKey?: string) => {
    const text = body.trim();
    if (!text) return;
    const key = retryKey ?? nextPendingKey();
    setDraft('');
    setPending((p) => [...p.filter((x) => x.key !== key), { key, body: text, failed: false }]);
    try {
      const sent = await api.sendMessage(id, text);
      setPending((p) => p.filter((x) => x.key !== key));
      setMessages((m) => merge(m ?? [], [sent]));
    } catch {
      setPending((p) => p.map((x) => (x.key === key ? { ...x, failed: true } : x)));
    }
  };

  type Row = { kind: 'message'; m: Message } | { kind: 'pending'; key: string; body: string; failed: boolean };
  const rows: Row[] = [
    ...(messages ?? []).map((m) => ({ kind: 'message' as const, m })),
    ...pending.map((p) => ({ kind: 'pending' as const, ...p })),
  ];

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.background }]} behavior="padding"
      keyboardVerticalOffset={insets.top + 44}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Pressable style={styles.title} disabled={!otherId}
              onPress={() => otherId && router.push({ pathname: '/athlete/[id]', params: { id: otherId } })}>
              {otherId && <Avatar id={otherId} name={name ?? '?'} size={28} />}
              <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>{name ?? 'Chat'}</Text>
            </Pressable>
          ),
        }}
      />
      {messages === null ? (
        <ActivityIndicator style={styles.center} color={colors.accent} />
      ) : (
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(r) => (r.kind === 'message' ? r.m.id : `pending-${r.key}`)}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item, index }) => {
            const mine = item.kind === 'pending' || item.m.senderId === user?.id;
            const body = item.kind === 'pending' ? item.body : item.m.body;
            const prev = rows[index - 1];
            const showTime = item.kind === 'message' && (!prev || prev.kind !== 'message'
              || new Date(item.m.createdAt).getTime() - new Date(prev.m.createdAt).getTime() > 15 * 60_000);
            return (
              <View>
                {showTime && item.kind === 'message' && (
                  <Text style={[styles.time, { color: colors.textSecondary }]}>
                    {new Date(item.m.createdAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                  </Text>
                )}
                <View style={[styles.bubble, mine
                  ? [styles.mine, { backgroundColor: colors.brand, opacity: item.kind === 'pending' && !item.failed ? 0.6 : 1 }]
                  : [styles.theirs, { backgroundColor: colors.raised }]]}>
                  <Text style={{ color: mine ? INK : colors.text, fontSize: 16 }}>{body}</Text>
                </View>
                {item.kind === 'pending' && item.failed && (
                  <Pressable onPress={() => send(item.body, item.key)} style={styles.failed}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={14} color={colors.danger} />
                    <Text style={{ color: colors.danger, fontSize: 12 }}>Not sent. Tap to try again.</Text>
                  </Pressable>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              {otherId && <Avatar id={otherId} name={name ?? '?'} size={72} />}
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{name}</Text>
              <Text style={{ color: colors.textSecondary }}>Say hi and plan your next run together.</Text>
            </View>
          }
        />
      )}
      <View style={[styles.inputBar, { borderColor: colors.border, backgroundColor: colors.card, paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.raised }]}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={2000}
        />
        <Pressable onPress={() => send(draft)} disabled={!draft.trim()} accessibilityLabel="Send"
          style={[styles.send, { backgroundColor: draft.trim() ? colors.brand : colors.border }]}>
          <MaterialCommunityIcons name="arrow-up" size={22} color={INK} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { marginTop: 48 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 240 },
  titleText: { fontSize: 17, fontWeight: '700' },
  list: { padding: 12, gap: 4, flexGrow: 1 },
  time: { textAlign: 'center', fontSize: 12, marginVertical: 8 },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, marginVertical: 2 },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  failed: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 16, maxHeight: 120 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
