import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ActivitySummary, AthleteSummary, Comment } from '@repo/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { KudosButton } from '@/components/activity-card';
import { Avatar } from '@/components/avatar';
import { INK, useColors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { shortTime } from '@/lib/short-time';

// Kudos and comments under an activity.
export function ActivitySocial({ activity, autoFocusComment = false }: { activity: ActivitySummary; autoFocusComment?: boolean }) {
  const colors = useColors();
  const { user } = useAuth();
  const [kudos, setKudos] = useState<AthleteSummary[]>([]);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const mine = activity.userId === user?.id;

  useEffect(() => {
    api.kudosList(activity.id).then(setKudos, () => {});
    api.comments(activity.id).then(setComments, () => setComments([]));
  }, [activity.id, activity.kudosCount]);

  const post = async () => {
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    try {
      const c = await api.addComment(activity.id, body);
      setComments((list) => [...(list ?? []), c]);
      setDraft('');
    } catch (err) {
      Alert.alert('Could not post', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const remove = (c: Comment) =>
    Alert.alert('Delete comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await api.deleteComment(c.id).catch(() => {});
          setComments((list) => (list ?? []).filter((x) => x.id !== c.id));
        },
      },
    ]);

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.kudosRow}>
        {!mine && <KudosButton activity={activity} />}
        <View style={styles.kudosText}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            {kudos.length ? `${kudos.length} ${kudos.length === 1 ? 'kudos' : 'kudos'}` : mine ? 'No kudos yet' : 'Be the first to give kudos'}
          </Text>
          {kudos.length > 0 && (
            <View style={styles.faces}>
              {kudos.slice(0, 8).map((k, i) => (
                <Pressable key={k.id} style={{ marginLeft: i ? -8 : 0 }}
                  onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: k.id } })}>
                  <View style={[styles.faceRing, { borderColor: colors.card }]}>
                    <Avatar id={k.id} name={k.name} size={28} />
                  </View>
                </Pressable>
              ))}
              {kudos.length > 8 && <Text style={{ color: colors.textSecondary, marginLeft: 6 }}>+{kudos.length - 8}</Text>}
            </View>
          )}
        </View>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>Comments{comments?.length ? ` (${comments.length})` : ''}</Text>
      {comments === null ? <ActivityIndicator color={colors.accent} /> : comments.map((c) => (
        <Pressable key={c.id} style={styles.comment} onLongPress={() => (c.athlete.id === user?.id || mine) && remove(c)}>
          <Pressable onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: c.athlete.id } })}>
            <Avatar id={c.athlete.id} name={c.athlete.name} size={34} />
          </Pressable>
          <View style={styles.commentText}>
            <Text style={{ color: colors.text }}>
              <Text style={{ fontWeight: '700' }}>{c.athlete.name}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>  {shortTime(c.createdAt)}</Text>
            </Text>
            <Text style={{ color: colors.text, fontSize: 15 }}>{c.body}</Text>
          </View>
        </Pressable>
      ))}
      {comments?.length === 0 && <Text style={{ color: colors.textSecondary }}>Say something nice.</Text>}

      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.background }]}
          placeholder="Add a comment…"
          placeholderTextColor={colors.textSecondary}
          value={draft}
          onChangeText={setDraft}
          autoFocus={autoFocusComment}
          multiline
          maxLength={1000}
        />
        <Pressable onPress={post} disabled={!draft.trim() || posting} accessibilityLabel="Post comment"
          style={[styles.send, { backgroundColor: draft.trim() ? colors.brand : colors.border }]}>
          {posting ? <ActivityIndicator size="small" color={INK} /> : <MaterialCommunityIcons name="arrow-up" size={20} color={INK} />}
        </Pressable>
      </View>
      {comments && comments.length > 0 && (
        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Long-press your comment (or any on your activity) to delete it.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 14 },
  kudosRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kudosText: { flex: 1, gap: 6 },
  faces: { flexDirection: 'row', alignItems: 'center' },
  faceRing: { borderWidth: 2, borderRadius: 16 },
  title: { fontSize: 17, fontWeight: '700' },
  comment: { flexDirection: 'row', gap: 10 },
  commentText: { flex: 1, gap: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 15, maxHeight: 100 },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
