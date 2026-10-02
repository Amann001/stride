import { StyleSheet, Text, View } from 'react-native';

import { INK } from '@/constants/theme';

// Friendly colours for people's avatars, picked from their id so each person always
// gets the same one.
const COLORS = ['#C8F31D', '#38BDF8', '#FBBF24', '#FB923C', '#A78BFA', '#34D399', '#F472B6', '#F87171'];

function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

// A round avatar with someone's initials (there are no profile photos yet).
export function Avatar({ id, name, size = 40 }: { id: string; name: string; size?: number }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: colorFor(id) }]}>
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { color: INK, fontWeight: '800' },
});
