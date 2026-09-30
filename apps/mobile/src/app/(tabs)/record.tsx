import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ACTIVITY_LABELS,
  ACTIVITY_TYPES,
  CATEGORIES,
  computeSplits,
  defaultActivityTitle,
  elevationGain,
  formatDistance,
  formatDuration,
  formatElevation,
  formatPace,
  formatPaceOrSpeed,
  formatSpeed,
  formatSteps,
  maxSpeed,
  recentSpeed,
  speakDuration,
  type ActivityType,
} from '@repo/shared';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { RouteMap } from '@/components/route-map';
import { Stat } from '@/components/stat';
import { CATEGORY_LOOKS } from '@/constants/categories';
import { INK, useColors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useRecorder } from '@/lib/use-recorder';

// What the voice says after each split, e.g. every kilometer on a run.
function splitAnnouncement(type: ActivityType, meters: number, elapsed: number, splitSeconds: number,
  extra: { steps: number | null; climb: number }): string {
  const km = meters / 1000;
  const parts = [`${km} ${km === 1 ? 'kilometer' : 'kilometers'}.`, `Time ${speakDuration(elapsed)}.`];
  if (CATEGORIES[type].metric === 'speed') {
    parts.push(`Average speed ${((meters / elapsed) * 3.6).toFixed(1)} kilometers per hour.`);
  } else {
    parts.push(`Last kilometer ${speakDuration(splitSeconds)}.`);
  }
  if (type === 'walk' && extra.steps) parts.push(`${extra.steps} steps.`);
  if (type === 'hike') parts.push(`Climbed ${Math.round(extra.climb)} meters.`);
  return parts.join(' ');
}

// Record tab: pick a kind of activity, press Start, and watch the stats that matter
// for it. A voice reads out your progress at every split.
export default function RecordScreen() {
  const colors = useColors();
  const rec = useRecorder();
  const [type, setType] = useState<ActivityType>('run');
  const [voiceOn, setVoiceOn] = useState(true);
  const [saving, setSaving] = useState(false);
  const config = CATEGORIES[type];
  const look = CATEGORY_LOOKS[type];

  const say = (text: string) => {
    if (voiceOn) Speech.speak(text);
  };

  // Keep the screen on while recording. In Expo Go, GPS stops if the app goes to the background.
  useEffect(() => {
    if (rec.status === 'idle') return;
    activateKeepAwakeAsync('recording');
    return () => {
      deactivateKeepAwake('recording');
    };
  }, [rec.status]);

  // Live numbers some categories need. The timer re-renders this screen every second.
  const climb = useMemo(() => (type === 'hike' ? elevationGain(rec.points) : 0), [type, rec.points]);
  const topSpeed = useMemo(() => (type === 'ride' ? maxSpeed(rec.points) : 0), [type, rec.points]);
  const altitude = rec.points[rec.points.length - 1]?.alt ?? null;
  const speedNow = type === 'ride' && rec.status === 'recording' ? recentSpeed(rec.points, rec.clock) : 0;

  // Splits so far, the same way the activity screen works them out (moving time only).
  // The last one is the split you're in now, once it's 50 m long.
  const splits = useMemo(() => computeSplits(rec.points, config.splitMeters), [rec.points, config.splitMeters]);
  const doneSplits = splits.filter((s) => Math.abs(s.distanceMeters - config.splitMeters) < 1);
  const currentSplit = splits.length > doneSplits.length ? splits[splits.length - 1] : null;
  const splitPace = currentSplit ? currentSplit.movingSeconds / (currentSplit.distanceMeters / 1000) : NaN;
  const lastSplitSeconds = doneSplits[doneSplits.length - 1]?.movingSeconds ?? 0;

  // Speak once each time a split is completed.
  const announced = useRef(0);
  useEffect(() => {
    if (rec.status === 'idle') {
      announced.current = 0;
      return;
    }
    const n = doneSplits.length;
    if (n <= announced.current) return;
    announced.current = n;
    if (voiceOn) {
      Speech.speak(splitAnnouncement(type, n * config.splitMeters, rec.elapsed, lastSplitSeconds, { steps: rec.steps, climb }));
    }
  }, [doneSplits.length, lastSplitSeconds, rec.elapsed, rec.status, rec.steps, config.splitMeters, type, voiceOn, climb]);

  const start = async () => {
    await rec.start(type);
    say(`${ACTIVITY_LABELS[type]} started.`);
  };
  const pause = () => {
    rec.pause();
    say('Paused.');
  };
  const resume = async () => {
    await rec.resume();
    say('Resumed.');
  };

  const save = async () => {
    const { points, steps } = rec.finish();
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
        steps: steps ?? undefined,
      });
      rec.discard();
      const n = saved.achievements.length;
      say(`${ACTIVITY_LABELS[type]} saved.${n ? ` You earned ${n} ${n === 1 ? 'achievement' : 'achievements'}!` : ' Nice work.'}`);
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

  const time = { label: 'Time', value: formatDuration(rec.elapsed) };
  const distance = { label: 'Distance', value: formatDistance(rec.distance) };
  const avg = { label: config.metric === 'speed' ? 'Avg speed' : 'Avg pace', value: formatPaceOrSpeed(type, rec.distance, rec.elapsed) };
  type Item = { label: string; value: string };
  const live: { big: Item; rows: Item[][] } = {
    run: { big: time, rows: [[distance, avg, { label: 'Split pace', value: formatPace(splitPace) }]] },
    ride: {
      big: { label: 'Speed', value: formatSpeed(speedNow) },
      rows: [[time, distance], [avg, { label: 'Max speed', value: formatSpeed(topSpeed) }]],
    },
    walk: { big: time, rows: [[distance, { label: 'Steps', value: rec.steps == null ? '--' : formatSteps(rec.steps) }, avg]] },
    hike: {
      big: time,
      rows: [[distance, { label: 'Climb', value: formatElevation(climb) }, { label: 'Altitude', value: altitude == null ? '--' : formatElevation(altitude) }]],
    },
  }[type];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <RouteMap coords={rec.points} follow style={styles.map} />

      <View style={[styles.panel, { backgroundColor: colors.card }]}>
        {rec.status === 'idle' ? (
          <>
            <View style={styles.tiles}>
              {ACTIVITY_TYPES.map((t) => {
                const selected = t === type;
                const l = CATEGORY_LOOKS[t];
                return (
                  <Pressable key={t} onPress={() => setType(t)}
                    style={[styles.tile, { borderColor: selected ? l.color : colors.border }, selected && { backgroundColor: l.color }]}>
                    <MaterialCommunityIcons name={l.icon} size={26} color={selected ? INK : colors.text} />
                    <View style={styles.tileText}>
                      <Text style={[styles.tileLabel, { color: selected ? INK : colors.text }]}>{ACTIVITY_LABELS[t]}</Text>
                      <Text style={[styles.tileTagline, { color: selected ? INK : colors.textSecondary }]} numberOfLines={1}>{l.tagline}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Pressable onPress={() => setVoiceOn((v) => !v)} style={styles.voice}>
              <MaterialCommunityIcons name={voiceOn ? 'volume-high' : 'volume-off'} size={20} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary }}>
                {voiceOn ? `Voice updates every ${config.splitMeters / 1000} km` : 'Voice updates off'}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Stat label={live.big.label} value={live.big.value} large />
            {live.rows.map((row, i) => (
              <View key={i} style={styles.statRow}>
                {row.map((s) => <Stat key={s.label} label={s.label} value={s.value} />)}
              </View>
            ))}
          </>
        )}

        {rec.error && <Text style={[styles.error, { color: colors.danger }]}>{rec.error}</Text>}

        <View style={styles.buttons}>
          {saving ? (
            <ActivityIndicator size="large" color={colors.accent} />
          ) : rec.status === 'idle' ? (
            <RoundButton label="Start" color={look.color} textColor={INK} onPress={start} />
          ) : rec.status === 'recording' ? (
            <RoundButton label="Pause" color={colors.text} textColor={colors.card} onPress={pause} />
          ) : (
            <>
              <RoundButton label="Resume" color={look.color} textColor={INK} onPress={resume} />
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
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
  },
  tileText: { flex: 1 },
  tileLabel: { fontSize: 16, fontWeight: '700' },
  tileTagline: { fontSize: 12 },
  voice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  statRow: { flexDirection: 'row' },
  error: { textAlign: 'center' },
  buttons: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, minHeight: 84 },
  round: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  roundText: { fontSize: 16, fontWeight: '700' },
  discard: { position: 'absolute', right: 0 },
});
