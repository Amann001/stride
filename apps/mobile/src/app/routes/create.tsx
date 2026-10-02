import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ACTIVITY_LABELS,
  decodePolyline,
  defaultActivityTitle,
  formatDistance,
  type ActivityType,
  type LatLng,
} from '@repo/shared';
import * as Location from 'expo-location';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import MapView, { Marker, Polyline, type MapPressEvent } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SportSheet } from '@/components/sport-sheet';
import { CATEGORY_LOOKS } from '@/constants/categories';
import { INK, LIME, useColors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useMapPrefs } from '@/lib/map-prefs';
import { rememberRoutes } from '@/lib/route-store';

// Create Route: tap the map to add points. The route follows roads and paths between
// them (or straight lines if you switch that off). Save it to use later.
export default function CreateRouteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const prefs = useMapPrefs();
  const mapRef = useRef<MapView>(null);
  const [sport, setSport] = useState<ActivityType>('run');
  const [points, setPoints] = useState<LatLng[]>([]);
  const [line, setLine] = useState<LatLng[]>([]);
  const [distance, setDistance] = useState(0);
  const [snap, setSnap] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sportOpen, setSportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Only the newest planning request counts, if you tap faster than the server answers.
  const requestId = useRef(0);

  useEffect(() => {
    (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return;
      const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync());
      mapRef.current?.animateToRegion(
        { latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 },
        400,
      );
    })();
  }, []);

  // Work out the route whenever the points, sport or snapping change.
  useEffect(() => {
    if (points.length < 2) return;
    const id = ++requestId.current;
    let cancelled = false;
    (async () => {
      setPlanning(true);
      setError(null);
      try {
        const plan = await api.planRoute({ sport, waypoints: points, snap });
        if (cancelled || id !== requestId.current) return;
        setLine(decodePolyline(plan.polyline));
        setDistance(plan.distanceMeters);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't plan that route");
      } finally {
        if (!cancelled && id === requestId.current) setPlanning(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [points, sport, snap]);

  const shownLine = points.length < 2 ? [] : line;
  const shownDistance = points.length < 2 ? 0 : distance;

  const addPoint = (e: MapPressEvent) => {
    const c = e.nativeEvent.coordinate;
    if (points.length >= 25) {
      Alert.alert('That’s a lot of points', 'A route can have up to 25 points.');
      return;
    }
    setPoints((p) => [...p, { lat: c.latitude, lng: c.longitude }]);
  };

  const save = () =>
    Alert.prompt('Name your route', undefined, async (name) => {
      if (!name?.trim()) return;
      setSaving(true);
      try {
        const polyline = (await api.planRoute({ sport, waypoints: points, snap })).polyline;
        const saved = await api.saveRoute({ name: name.trim(), sport, polyline });
        rememberRoutes([saved]);
        router.replace({ pathname: '/route/[id]', params: { id: saved.id } });
      } catch (err) {
        Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
      } finally {
        setSaving(false);
      }
    }, 'plain-text', defaultActivityTitle(sport, new Date()).replace(ACTIVITY_LABELS[sport], `${ACTIVITY_LABELS[sport]} Route`));

  const toLatLng = (p: LatLng) => ({ latitude: p.lat, longitude: p.lng });

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Create Route' }} />
      <MapView ref={mapRef} style={StyleSheet.absoluteFill} mapType={prefs.mapStyle} showsUserLocation onPress={addPoint}>
        {shownLine.length > 1 && <Polyline coordinates={shownLine.map(toLatLng)} strokeColor={INK} strokeWidth={8} />}
        {shownLine.length > 1 && <Polyline coordinates={shownLine.map(toLatLng)} strokeColor={LIME} strokeWidth={5} />}
        {points.map((p, i) => (
          <Marker key={`${i}-${p.lat}-${p.lng}`} coordinate={toLatLng(p)} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.point, { backgroundColor: i === 0 ? '#22C55E' : colors.card, borderColor: INK }]}>
              <Text style={[styles.pointText, { color: i === 0 ? INK : colors.text }]}>{i + 1}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {points.length === 0 && (
        <View style={[styles.hint, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>Tap the map to add your start point</Text>
        </View>
      )}

      <View style={[styles.panel, { backgroundColor: colors.card, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.topRow}>
          <Pressable style={[styles.sport, { borderColor: colors.border }]} onPress={() => setSportOpen(true)}>
            <MaterialCommunityIcons name={CATEGORY_LOOKS[sport].icon} size={20} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: '700' }}>{ACTIVITY_LABELS[sport]}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.distance}>
            {planning && <ActivityIndicator size="small" color={colors.accent} />}
            <Text style={[styles.distanceText, { color: colors.text }]}>{formatDistance(shownDistance)}</Text>
          </View>
        </View>
        <View style={styles.snapRow}>
          <Text style={{ color: colors.text, flex: 1 }}>Follow roads and paths</Text>
          <Switch value={snap} onValueChange={setSnap} trackColor={{ true: colors.brand }} />
        </View>
        {error && <Text style={{ color: colors.danger }}>{error}</Text>}
        <View style={styles.actions}>
          <Action icon="undo" label="Undo" disabled={!points.length} onPress={() => setPoints((p) => p.slice(0, -1))} />
          <Action icon="backup-restore" label="Back to start" disabled={points.length < 2}
            onPress={() => setPoints((p) => [...p, p[0]])} />
          <Action icon="delete-outline" label="Clear" disabled={!points.length} onPress={() => setPoints([])} />
          <Pressable disabled={points.length < 2 || saving} onPress={save}
            style={[styles.save, { backgroundColor: points.length < 2 ? colors.border : colors.brand }]}>
            {saving ? <ActivityIndicator color={INK} /> : <Text style={styles.saveText}>Save</Text>}
          </Pressable>
        </View>
      </View>
      <SportSheet visible={sportOpen} selected={sport} onSelect={setSport} onClose={() => setSportOpen(false)} />
    </View>
  );
}

function Action({ icon, label, disabled, onPress }: {
  icon: 'undo' | 'backup-restore' | 'delete-outline'; label: string; disabled: boolean; onPress: () => void;
}) {
  const colors = useColors();
  const tint = disabled ? colors.border : colors.text;
  return (
    <Pressable disabled={disabled} onPress={onPress} style={styles.action} accessibilityLabel={label}>
      <MaterialCommunityIcons name={icon} size={24} color={tint} />
      <Text style={{ color: tint, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hint: { position: 'absolute', top: 16, alignSelf: 'center', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  point: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pointText: { fontSize: 11, fontWeight: '700' },
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sport: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  distance: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  distanceText: { fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'] },
  snapRow: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  action: { alignItems: 'center', width: 70, gap: 2 },
  save: { flex: 1, borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
  saveText: { color: INK, fontWeight: '700', fontSize: 16 },
});
