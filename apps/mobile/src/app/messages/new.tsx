import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { AthleteSummary } from '@repo/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { useColors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

// New Message: pick someone you follow or who follows you.
export default function NewMessageScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const [people, setPeople] = useState<AthleteSummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([api.connections(user.id, 'following'), api.connections(user.id, 'followers')]).then(
      ([following, followers]) => {
        const all = new Map<string, AthleteSummary>();
        for (const p of [...following, ...followers]) all.set(p.id, p);
        setPeople([...all.values()].sort((a, b) => a.name.localeCompare(b.name)));
      },
      () => setPeople([]),
    );
  }, [user]);

  const open = async (athlete: AthleteSummary) => {
    setOpening(athlete.id);
    try {
      const c = await api.startConversation(athlete.id);
      router.replace({ pathname: '/messages/[id]', params: { id: c.id, name: c.other.name, otherId: c.other.id } });
    } catch (err) {
      Alert.alert('Can’t message yet', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setOpening(null);
    }
  };

  const shown = (people ?? []).filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.search, { backgroundColor: colors.raised }]}>
        <Text style={{ color: colors.textSecondary }}>To:</Text>
        <TextInput style={[styles.input, { color: colors.text }]} value={query} onChangeText={setQuery} autoFocus
          placeholder="Search people you follow" placeholderTextColor={colors.textSecondary} />
      </View>
      {people === null ? (
        <ActivityIndicator style={styles.center} color={colors.accent} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable style={[styles.row, { borderColor: colors.border }]} onPress={() => open(item)} disabled={!!opening}>
              <Avatar id={item.id} name={item.name} size={44} />
              <View style={styles.text}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{item.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {item.isFollowing && item.followsYou ? 'You follow each other' : item.isFollowing ? 'You follow them' : 'Follows you'}
                </Text>
              </View>
              {opening === item.id && <ActivityIndicator color={colors.accent} />}
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="account-search-outline" size={48} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                {people.length ? 'No one by that name.' : 'You can message people you follow or who follow you. Find friends first.'}
              </Text>
              {!people.length && (
                <Pressable style={[styles.button, { backgroundColor: colors.brand }]} onPress={() => router.replace('/search')}>
                  <Text style={{ color: colors.onBrand, fontWeight: '700' }}>Find Friends</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { marginTop: 48 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, borderRadius: 12, paddingHorizontal: 14, height: 46 },
  input: { flex: 1, fontSize: 16 },
  list: { paddingHorizontal: 16, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  button: { borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12 },
});
