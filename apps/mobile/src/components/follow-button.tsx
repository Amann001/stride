import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import { INK, useColors } from '@/constants/theme';
import { api } from '@/lib/api';

// Follow / Following. Changes straight away, then undoes itself if the server says no.
export function FollowButton({ athleteId, following, followsYou = false, onChange, compact = false }: {
  athleteId: string;
  following: boolean;
  followsYou?: boolean;
  onChange?: (following: boolean) => void;
  compact?: boolean;
}) {
  const colors = useColors();
  const [isFollowing, setIsFollowing] = useState(following);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    const next = !isFollowing;
    setIsFollowing(next);
    setBusy(true);
    try {
      if (next) await api.follow(athleteId);
      else await api.unfollow(athleteId);
      onChange?.(next);
    } catch (err) {
      setIsFollowing(!next);
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={toggle}
      disabled={busy}
      style={[
        compact ? styles.compact : styles.button,
        isFollowing ? { borderWidth: 1, borderColor: colors.border } : { backgroundColor: colors.brand },
      ]}>
      <Text style={[styles.text, { color: isFollowing ? colors.text : INK }]}>
        {isFollowing ? 'Following' : followsYou ? 'Follow Back' : 'Follow'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 999, paddingVertical: 9, paddingHorizontal: 18, alignItems: 'center' },
  compact: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14, alignItems: 'center' },
  text: { fontWeight: '700', fontSize: 14 },
});
