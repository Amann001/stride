import type { AthleteSummary } from '@repo/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text } from 'react-native';

import { AthleteRow } from '@/components/athlete-row';
import { useColors } from '@/constants/theme';
import { api } from '@/lib/api';

// Someone's followers, or the people they follow.
export default function ConnectionsScreen() {
  const colors = useColors();
  const { athleteId, list, name } = useLocalSearchParams<{ athleteId: string; list: 'followers' | 'following'; name?: string }>();
  const [people, setPeople] = useState<AthleteSummary[] | null>(null);

  useEffect(() => {
    api.connections(athleteId, list).then(setPeople, () => setPeople([]));
  }, [athleteId, list]);

  return (
    <>
      <Stack.Screen options={{ title: list === 'followers' ? 'Followers' : 'Following' }} />
      {people === null ? (
        <ActivityIndicator style={styles.center} color={colors.accent} />
      ) : (
        <FlatList
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={styles.list}
          data={people}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => <AthleteRow athlete={item} />}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              {list === 'followers' ? `No one follows ${name ?? 'them'} yet.` : `${name ?? 'This athlete'} isn't following anyone yet.`}
            </Text>
          }
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: { marginTop: 48 },
  list: { paddingHorizontal: 16, flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: 48 },
});
