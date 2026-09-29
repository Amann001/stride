import {
  ACTIVITY_LABELS,
  ACTIVITY_TYPES,
  defaultActivityTitle,
  formatDistance,
  formatDuration,
  formatPaceOrSpeed,
  paceOrSpeedLabel,
  type ActivityType,
} from '@repo/shared';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { RouteMap } from '@/components/route-map';
import { Stat } from '@/components/stat';
import { useColors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useRecorder } from '@/lib/use-recorder';

// Record tab: pick an activity type, press Start, and watch the live stats.
export default function RecordScreen() {
  const colors = useColors();
  const rec = useRecorder();
  const [type, setType] = useState<ActivityType>('run');
  const [saving, setSaving] = useState(false);

  // Keep the screen on while recording. In Expo Go, GPS stops if the app goes to the background.
  useEffect(() => {
    if (rec.status === 'idle') return;
    activateKeepAwakeAsync('recording');
    return () => {
      deactivateKeepAwake('recording');
    };
  }, [rec.status]);

  const save = async () => {
    const points = rec.finish();
    if (points.length < 2) {
      Alert.alert('Too short', 'We did not get enough GPS points to save this activity.');
      rec.discard();
      return;
    }
    setSaving(true);
    try {
      const saved = await api.createActivity({
        type,
        title: defaultActivityTitle(type, new Date(points[0].t)),
        points,
      });
      rec.discard();
      router.push({ pathname: '/activity/[id]', params: { id: saved.id } });
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDiscard = () =>
    Alert.alert('Discard activity?', 'This recording will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: rec.discard },
    ]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <RouteMap coords={rec.points} follow style={styles.map} />

      <View style={[styles.panel, { backgroundColor: colors.card }]}>
        {rec.status === 'idle' && (
          <View style={styles.typeRow}>
            {ACTIVITY_TYPES.map((t) => (
              <Pressable key={t} onPress={() => setType(t)}
                style={[styles.typeChip, { borderColor: colors.border }, t === type && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
                <Text style={{ color: t === type ? colors.onBrand : colors.text, fontWeight: '600' }}>{ACTIVITY_LABELS[t]}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Stat label="Time" value={formatDuration(rec.elapsed)} large />
        <View style={styles.statRow}>
          <Stat label="Distance" value={formatDistance(rec.distance)} />
          <Stat label={`Avg ${paceOrSpeedLabel(type).toLowerCase()}`} value={formatPaceOrSpeed(type, rec.distance, rec.elapsed)} />
        </View>

        {rec.error && <Text style={[styles.error, { color: colors.danger }]}>{rec.error}</Text>}

        <View style={styles.buttons}>
          {saving ? (
            <ActivityIndicator size="large" color={colors.accent} />
          ) : rec.status === 'idle' ? (
            <RoundButton label="Start" color={colors.brand} textColor={colors.onBrand} onPress={rec.start} />
          ) : rec.status === 'recording' ? (
            <RoundButton label="Pause" color={colors.text} textColor={colors.card} onPress={rec.pause} />
          ) : (
            <>
              <RoundButton label="Resume" color={colors.brand} textColor={colors.onBrand} onPress={rec.resume} />
              <RoundButton label="Finish" color="#16A34A" onPress={save} />
              <Pressable onPress={confirmDiscard} style={styles.discard}>
                <Text style={{ color: colors.danger }}>Discard</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function RoundButton({ label, color, textColor = '#fff', onPress }: {
  label: string; color: string; textColor?: string; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.round, { backgroundColor: color }]}>
      <Text style={[styles.roundText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  map: { flex: 1, height: undefined },
  panel: { padding: 20, gap: 16 },
  typeRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  typeChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  statRow: { flexDirection: 'row' },
  error: { textAlign: 'center' },
  buttons: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, minHeight: 84 },
  round: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  roundText: { fontSize: 16, fontWeight: '700' },
  discard: { position: 'absolute', right: 0 },
});
