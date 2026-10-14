import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ACTIVITY_LABELS,
  CATEGORIES,
  computeSplits,
  decodePolyline,
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
import { router, useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MusicSheet } from '@/components/music-sheet';
import { RouteMap } from '@/components/route-map';
import { SportSheet } from '@/components/sport-sheet';
import type { IconName } from '@/constants/categories';
import { CATEGORY_LOOKS } from '@/constants/categories';
import { INK, useColors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { addPending, isRetryable, newClientId, type PendingActivity } from '@/lib/pending-activities';
import { useGpsSignal } from '@/lib/use-gps-signal';
import { setActiveRoute, useActiveRoute } from '@/lib/route-store';
import { useRecorder } from '@/lib/use-recorder';
import { speak } from '@/lib/voice';

type Item = { label: string; value: string };

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

// Record tab: a full-screen map with your stats underneath. Pick a sport, wait for
// "GPS Acquired", press Start. Tap the arrows to switch to big numbers and splits.
// A voice reads out your progress at every split, turning your music down while it speaks.
export default function RecordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { user } = useAuth();
  const rec = useRecorder();
  const [type, setType] = useState<ActivityType>('run');
  const [voiceOn, setVoiceOn] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [sportSheetOpen, setSportSheetOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const gps = useGpsSignal(focused && rec.status === 'idle');
  const config = CATEGORIES[type];
  const look = CATEGORY_LOOKS[type];

  // A route picked on the Maps tab or from Saved Routes, shown on the map to follow.
  const activeRoute = useActiveRoute();
  const guide = useMemo(() => (activeRoute ? decodePolyline(activeRoute.polyline) : undefined), [activeRoute]);
  // Picking a route also picks its sport (adjusting state during render, as React recommends).
  const [routeForType, setRouteForType] = useState<string | null>(null);
  if (activeRoute && activeRoute.id !== routeForType && rec.status === 'idle') {
    setRouteForType(activeRoute.id);
    setType(activeRoute.sport);
  }

  const say = (text: string) => {
    if (voiceOn) speak(text);
  };

  // Keep the screen on while recording. In Expo Go, GPS stops if the app goes to the background.
  useEffect(() => {
    if (rec.status === 'idle') return;
    // A browser may refuse (battery saver, for example): the screen can then dim, but the
    // recording carries on, so that's not an error.
    activateKeepAwakeAsync('recording').catch(() => {});
    return () => {
      deactivateKeepAwake('recording').catch(() => {});
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
      speak(splitAnnouncement(type, n * config.splitMeters, rec.elapsed, lastSplitSeconds, { steps: rec.steps, climb }));
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
    // The clientId means this exact recording can be uploaded again later without duplicates.
    const activity: PendingActivity = {
      type,
      title: defaultActivityTitle(type, new Date(points[0].t)),
      points,
      steps: steps ?? undefined,
      clientId: newClientId(),
    };
    try {
      const saved = await api.createActivity(activity);
      rec.discard();
      setExpanded(false);
      const n = saved.achievements.length;
      say(`${ACTIVITY_LABELS[type]} saved.${n ? ` You earned ${n} ${n === 1 ? 'achievement' : 'achievements'}!` : ' Nice work.'}`);
      router.push({ pathname: '/activity/[id]', params: { id: saved.id } });
    } catch (err) {
      // No signal or a server hiccup: keep the recording on the phone and upload it later.
      if (isRetryable(err) && user) {
        try {
          await addPending(user.id, activity);
          rec.discard();
          setExpanded(false);
          say(`${ACTIVITY_LABELS[type]} saved on your phone.`);
          Alert.alert(
            'Saved on your phone',
            `There's no connection right now, so your ${ACTIVITY_LABELS[type].toLowerCase()} is stored safely on this phone. It will upload by itself as soon as you're back online.`,
          );
          return;
        } catch {
          // Couldn't even store it on the phone: fall through so the recording isn't discarded.
        }
      }
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDiscard = () =>
    Alert.alert('Discard activity?', 'This recording will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { rec.discard(); setExpanded(false); } },
    ]);

  // The numbers for each sport: three in the small panel, more in the big view.
  const time = { label: 'Time', value: formatDuration(rec.elapsed) };
  const distance = { label: 'Distance (km)', value: (rec.distance / 1000).toFixed(2) };
  const avg = {
    label: config.metric === 'speed' ? 'Avg speed' : 'Avg pace (/km)',
    value: formatPaceOrSpeed(type, rec.distance, rec.elapsed).replace(' /km', ''),
  };
  const steps = { label: 'Steps', value: rec.steps == null ? '--' : formatSteps(rec.steps) };
  const climbItem = { label: 'Climb', value: formatElevation(climb) };
  const layout: Record<ActivityType, { panel: Item[]; big: Item[] }> = {
    run: { panel: [time, avg, distance], big: [avg, distance, { label: 'Split pace (/km)', value: formatPace(splitPace).replace(' /km', '') }] },
    ride: {
      panel: [time, { label: 'Speed', value: formatSpeed(speedNow) }, distance],
      big: [{ label: 'Speed', value: formatSpeed(speedNow) }, distance, avg, { label: 'Max speed', value: formatSpeed(topSpeed) }],
    },
    walk: { panel: [time, steps, distance], big: [distance, steps, avg] },
    hike: {
      panel: [time, climbItem, distance],
      big: [distance, climbItem, { label: 'Altitude', value: altitude == null ? '--' : formatElevation(altitude) }],
    },
  };
  const { panel, big } = layout[type];

  const status =
    rec.status === 'recording' ? { text: 'Recording', bg: colors.brand, fg: INK }
    : rec.status === 'paused' ? { text: 'Paused', bg: '#F59E0B', fg: INK }
    : gps === 'ready' ? { text: 'GPS Acquired', bg: '#15803D', fg: '#fff' }
    : gps === 'denied'
      ? { text: Platform.OS === 'web' ? 'Location is off. Allow it for this site in your browser' : 'Location is off. Turn it on in Settings', bg: colors.danger, fg: '#fff' }
    : { text: 'Acquiring GPS…', bg: colors.border, fg: colors.text };

  const controls = (
    <View style={[styles.controls, { paddingBottom: insets.bottom + 12 }]}>
      {saving ? (
        <ActivityIndicator size="large" color={colors.accent} style={styles.centerControl} />
      ) : rec.status === 'idle' ? (
        <>
          <SideButton icon={look.icon} label={ACTIVITY_LABELS[type]} onPress={() => setSportSheetOpen(true)} tint={look.color} />
          <BigButton icon="play" color={colors.brand} iconColor={INK} label="Start" onPress={start} />
          <SideButton icon="map-marker-path" label={activeRoute ? 'Change Route' : 'Add Route'}
            onPress={() => router.push({ pathname: '/routes/saved', params: { pick: '1' } })}
            tint={activeRoute ? colors.accent : undefined} />
        </>
      ) : rec.status === 'recording' ? (
        <>
          <View style={styles.sideSpacer} />
          <BigButton icon="pause" color={colors.text} iconColor={colors.background} label="Pause" onPress={pause} />
          <View style={styles.sideSpacer} />
        </>
      ) : (
        <>
          <SideButton icon="delete-outline" label="Discard" onPress={confirmDiscard} tint={colors.danger} />
          <BigButton icon="play" color={colors.brand} iconColor={INK} label="Resume" onPress={resume} />
          <SideButton icon="flag-checkered" label="Finish" onPress={save} tint="#16A34A" />
        </>
      )}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {expanded ? (
        // Big numbers, like a sports watch.
        <View style={[styles.big, { paddingTop: insets.top + 12 }]}>
          <View style={styles.bigTop}>
            <Text style={[styles.bigTime, { color: colors.text }]}>{formatDuration(rec.elapsed)}</Text>
            <Pressable onPress={() => setExpanded(false)} hitSlop={12} accessibilityLabel="Show map">
              <MaterialCommunityIcons name="arrow-collapse" size={26} color={colors.text} />
            </Pressable>
          </View>
          {big.map((s) => (
            <View key={s.label} style={styles.bigStat}>
              <Text style={[styles.bigValue, { color: colors.text }]}>{s.value}</Text>
              <Text style={[styles.bigLabel, { color: colors.textSecondary }]}>{s.label}</Text>
            </View>
          ))}
          <View style={styles.splitBars}>
            {Array.from({ length: Math.max(3, doneSplits.length) }, (_, i) => doneSplits[i]).slice(-6).map((s, i) => (
              <View key={i} style={[styles.splitBar, { backgroundColor: s ? look.color : colors.border }]}>
                {s && <Text style={styles.splitText}>{formatDuration(s.movingSeconds)}</Text>}
              </View>
            ))}
          </View>
          <Text style={[styles.bigLabel, { color: colors.textSecondary, textAlign: 'center' }]}>
            Splits ({config.splitMeters / 1000} km)
          </Text>
        </View>
      ) : (
        <>
          <RouteMap coords={rec.points} guide={guide} follow style={styles.map} />
          <Pressable onPress={() => router.navigate('/')} accessibilityLabel="Close"
            style={[styles.floating, styles.close, { top: insets.top + 8, backgroundColor: colors.card }]}>
            <MaterialCommunityIcons name="chevron-down" size={28} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => setVoiceOn((v) => !v)} accessibilityLabel={voiceOn ? 'Turn voice updates off' : 'Turn voice updates on'}
            style={[styles.floating, styles.voice, { top: insets.top + 8, backgroundColor: colors.card }]}>
            <MaterialCommunityIcons name={voiceOn ? 'volume-high' : 'volume-off'} size={24} color={voiceOn ? colors.accent : colors.text} />
          </Pressable>
          <Pressable onPress={() => setMusicOpen(true)} accessibilityLabel="Play music"
            style={[styles.floating, styles.music, { top: insets.top + 64, backgroundColor: colors.card }]}>
            <MaterialCommunityIcons name="music-note" size={24} color={colors.text} />
          </Pressable>
          {activeRoute && (
            <View style={[styles.routeChip, { top: insets.top + 12, backgroundColor: colors.card }]}>
              <MaterialCommunityIcons name="map-marker-path" size={18} color="#38BDF8" />
              <Text style={{ color: colors.text, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
                {activeRoute.name} · {formatDistance(activeRoute.distanceMeters)}
              </Text>
              {rec.status === 'idle' && (
                <Pressable onPress={() => setActiveRoute(null)} hitSlop={10} accessibilityLabel="Remove route">
                  <MaterialCommunityIcons name="close-circle" size={20} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>
          )}
          <View style={[styles.panel, { backgroundColor: colors.card }]}>
            <View style={[styles.status, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.fg }]}>{status.text}</Text>
              <Pressable onPress={() => setExpanded(true)} hitSlop={12} accessibilityLabel="Show big numbers" style={styles.expand}>
                <MaterialCommunityIcons name="arrow-expand" size={20} color={status.fg} />
              </Pressable>
            </View>
            <View style={styles.panelStats}>
              {panel.map((s) => (
                <View key={s.label} style={styles.panelStat}>
                  <Text style={[styles.panelValue, { color: colors.text }]}>{s.value}</Text>
                  <Text style={[styles.panelLabel, { color: colors.textSecondary }]}>{s.label}</Text>
                </View>
              ))}
            </View>
            {rec.error && <Text style={[styles.error, { color: colors.danger }]}>{rec.error}</Text>}
          </View>
        </>
      )}

      {/* A browser stops reading GPS when you switch apps or lock the phone. */}
      {Platform.OS === 'web' && rec.status === 'idle' && (
        <Text style={[styles.webHint, { color: colors.textSecondary, backgroundColor: colors.card }]}>
          Keep Stride open with the screen on while you record.
        </Text>
      )}
      <View style={{ backgroundColor: colors.card }}>{controls}</View>

      <MusicSheet visible={musicOpen} recording={rec.status !== 'idle'} onClose={() => setMusicOpen(false)} />
      <SportSheet visible={sportSheetOpen} selected={type} onSelect={setType} onClose={() => setSportSheetOpen(false)} />
    </View>
  );
}

function BigButton({ icon, label, color, iconColor, onPress }: {
  icon: IconName; label: string; color: string; iconColor: string; onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={styles.centerControl}>
      <View style={[styles.bigButton, { backgroundColor: color }]}>
        <MaterialCommunityIcons name={icon} size={40} color={iconColor} />
      </View>
      <Text style={[styles.controlLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function SideButton({ icon, label, onPress, tint }: { icon: IconName; label: string; onPress: () => void; tint?: string }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={styles.side}>
      <View style={[styles.sideButton, { backgroundColor: colors.raised }]}>
        <MaterialCommunityIcons name={icon} size={26} color={tint ?? colors.text} />
      </View>
      <Text style={[styles.controlLabel, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  map: { flex: 1, height: undefined },
  // Round buttons floating over the map: close on the left, voice and music on the right.
  floating: {
    position: 'absolute', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  close: { left: 12 },
  panel: { paddingTop: 0 },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  statusText: { fontWeight: '700', fontSize: 15 },
  expand: { position: 'absolute', right: 14 },
  panelStats: { flexDirection: 'row', paddingVertical: 14 },
  panelStat: { flex: 1, alignItems: 'center' },
  panelValue: { fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'] },
  panelLabel: { fontSize: 12, marginTop: 2 },
  error: { textAlign: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  webHint: { textAlign: 'center', fontSize: 13, paddingTop: 10, paddingHorizontal: 20 },
  controls: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around', paddingTop: 12 },
  centerControl: { alignItems: 'center', width: 110 },
  bigButton: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  side: { alignItems: 'center', width: 90, paddingTop: 8 },
  sideButton: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  sideSpacer: { width: 90 },
  controlLabel: { marginTop: 6, fontWeight: '600', fontSize: 13 },
  big: { flex: 1, paddingHorizontal: 20, gap: 18 },
  bigTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bigTime: { fontSize: 64, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bigStat: { alignItems: 'center' },
  bigValue: { fontSize: 54, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bigLabel: { fontSize: 15, fontWeight: '600' },
  splitBars: { flexDirection: 'row', gap: 6, marginTop: 'auto' },
  splitBar: { flex: 1, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  splitText: { color: INK, fontWeight: '700', fontSize: 12 },
  voice: { right: 12 },
  music: { right: 12 },
  routeChip: {
    position: 'absolute', left: 68, right: 68, flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
});
