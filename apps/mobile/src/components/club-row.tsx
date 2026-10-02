import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ACTIVITY_LABELS, type Club } from '@repo/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORY_LOOKS } from '@/constants/categories';
import { INK, useColors } from '@/constants/theme';

// The club's badge: its sport's icon on the sport's colour, in a rounded square.
export function ClubBadge({ club, size = 48 }: { club: Club; size?: number }) {
  const look = CATEGORY_LOOKS[club.sport];
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size * 0.25, backgroundColor: look.color }]}>
      <MaterialCommunityIcons name={look.icon} size={size * 0.55} color={INK} />
    </View>
  );
}

// A club in a list: badge, name, members and place.
export function ClubRow({ club }: { club: Club }) {
  const colors = useColors();
  const people = club.sport === 'ride' ? 'Cyclists' : club.sport === 'run' ? 'Runners' : 'Athletes';
  return (
    <Pressable style={[styles.row, { borderColor: colors.border }]}
      onPress={() => router.push({ pathname: '/club/[id]', params: { id: club.id } })}>
      <ClubBadge club={club} />
      <View style={styles.text}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{club.name}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1}>
          {club.memberCount.toLocaleString('en-US')} {club.memberCount === 1 ? 'member' : people} · {ACTIVITY_LABELS[club.sport]}
          {club.location ? ` · ${club.location}` : ''}
        </Text>
      </View>
      {club.isMember && <MaterialCommunityIcons name="check-circle" size={20} color={colors.accent} />}
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700' },
});
