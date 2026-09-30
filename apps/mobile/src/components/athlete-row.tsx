import type { AthleteSummary } from '@repo/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { FollowButton } from '@/components/follow-button';
import { useColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

// A person in a list: avatar, name, why they're here, and a Follow button.
export function AthleteRow({ athlete }: { athlete: AthleteSummary }) {
  const colors = useColors();
  const { user } = useAuth();
  const subtitle = athlete.reason ?? athlete.location ?? (athlete.followsYou ? 'Follows you' : null);
  return (
    <Pressable style={[styles.row, { borderColor: colors.border }]}
      onPress={() => router.push({ pathname: '/athlete/[id]', params: { id: athlete.id } })}>
      <Avatar id={athlete.id} name={athlete.name} size={46} />
      <View style={styles.text}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{athlete.name}</Text>
        {subtitle && <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {athlete.id !== user?.id && (
        <FollowButton compact athleteId={athlete.id} following={athlete.isFollowing} followsYou={athlete.followsYou} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700' },
});
