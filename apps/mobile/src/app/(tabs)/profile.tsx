import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/constants/theme';
import { API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';

// "You" tab: your profile. Stats, follower counts and settings come in later phases.
export default function ProfileScreen() {
  const colors = useColors();
  const { user, signOut } = useAuth();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
        <Text style={[styles.avatarText, { color: colors.onBrand }]}>{user?.name.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>
      <Text style={{ color: colors.textSecondary }}>{user?.email}</Text>

      <Pressable style={[styles.button, { borderColor: colors.border }]} onPress={signOut}>
        <Text style={{ color: colors.danger, fontWeight: '600' }}>Log out</Text>
      </Pressable>

      <Text style={[styles.debug, { color: colors.textSecondary }]}>Server: {API_URL}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 36, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  button: { marginTop: 32, borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32 },
  debug: { marginTop: 'auto', marginBottom: 24, fontSize: 12 },
});
