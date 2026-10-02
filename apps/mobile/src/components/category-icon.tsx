import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ActivityType } from '@repo/shared';
import { StyleSheet, View } from 'react-native';

import { CATEGORY_LOOKS } from '@/constants/categories';
import { INK } from '@/constants/theme';

// The activity's icon in a colored circle, e.g. a runner on lime for runs.
export function CategoryIcon({ type, size = 36 }: { type: ActivityType; size?: number }) {
  const look = CATEGORY_LOOKS[type];
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: look.color }]}>
      <MaterialCommunityIcons name={look.icon} size={size * 0.58} color={INK} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
