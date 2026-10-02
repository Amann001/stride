import type { AthleteRef } from '@repo/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { useColors } from '@/constants/theme';
import { api } from '@/lib/api';

// People you've blocked. They don't show up anywhere else in the app, so this is where
// you can unblock them.
export default function BlockedScreen() {
  const colors = useColors();
  const [people, setPeople] = useState<AthleteRef[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.blockedAthletes().then(
      (list) => {
        setError(null);
        setPeople(list);
      },
      (err) => setError(err instanceof Error ? err.message : 'Could not load'),
    );
  }, []);
  useFocusEffect(load);

  const unblock = (p: AthleteRef) =>
    Alert.alert(`Unblock ${p.name}?`, 'You will be able to see and follow each other again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: () => api.unblockAthlete(p.id).then(load, () => Alert.alert('Could not unblock', 'Please try again.')),
      },
    ]);

  if (error) return <Text style={[styles.center, { color: colors.danger }]}>{error}</Text>;
  if (!people) return <ActivityIndicator style={styles.center} color={colors.accent} />;

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      data={people}
      keyExtractor={(p) => p.id}
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          You haven’t blocked anyone. To block someone, open their profile and tap ⋯.
        </Text>
      }
      renderItem={({ item }) => (
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <Avatar id={item.id} name={item.name} size={40} />
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
          <Pressable style={[styles.button, { borderColor: colors.border }]} onPress={() => unblock(item)}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Unblock</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { marginTop: 48, textAlign: 'center' },
  list: { padding: 16, flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: 40, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
  button: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
});
