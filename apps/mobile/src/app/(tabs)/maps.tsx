import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ACTIVITY_LABELS,
  ACTIVITY_TYPES,
  decodePolyline,
  formatDistance,
  type ActivitySummary,
  type ActivityType,
} from '@repo/shared';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORY_LOOKS } from '@/constants/categories';
import { INK, useColors } from '@/constants/theme';
import { api } from '@/lib/api';

// Maps tab: every route you've recorded on one map, colored by sport, so you can see
// where you've been. Tap a route to see which activity it was.
export default function MapsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [filter, setFilter] = useState<ActivityType | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.listActivities().then(setActivities, () => {});
    }, []),
  );

  const routes = useMemo(
    () =>
      activities
        .filter((a) => a.polyline && (filter === 'all' || a.type === filter))
        .map((a) => ({ activity: a, coords: decodePolyline(a.polyline).map((c) => ({ latitude: c.lat, longitude: c.lng })) }))
        .filter((r) => r.coords.length > 1),
    [activities, filter],
  );
  const selected = routes.find((r) => r.activity.id === selectedId)?.activity;
  const totalMeters = routes.reduce((n, r) => n + r.activity.distanceMeters, 0);

  const fitAll = useCallback(() => {
    const all = routes.flatMap((r) => r.coords);
    if (all.length > 1) {
      mapRef.current?.fitToCoordinates(all, { edgePadding: { top: 160, right: 40, bottom: 200, left: 40 }, animated: true });
    }
  }, [routes]);

  // Zoom to fit your routes once they load, and again when the sport filter changes.
  useEffect(() => {
    fitAll();
  }, [fitAll]);

  const goToMe = async () => {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return;
    const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync());
    mapRef.current?.animateToRegion(
      { latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      500,
    );
  };

  return (
    <View style={styles.screen}>
      <MapView ref={mapRef} style={StyleSheet.absoluteFill} showsUserLocation onMapReady={fitAll}
        onPress={() => setSelectedId(null)}>
        {routes.map(({ activity, coords }) => {
          const isSelected = activity.id === selectedId;
          return (
            <Polyline key={activity.id} coordinates={coords} tappable onPress={() => setSelectedId(activity.id)}
              strokeColor={isSelected ? INK : CATEGORY_LOOKS[activity.type].color}
              strokeWidth={isSelected ? 6 : 4} zIndex={isSelected ? 2 : 1} />
          );
        })}
      </MapView>

      {/* Sport filter chips floating over the map. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={[styles.chipBar, { top: insets.top + 8 }]} contentContainerStyle={styles.chips}>
        {(['all', ...ACTIVITY_TYPES] as const).map((t) => {
          const active = filter === t;
          const fill = t === 'all' ? colors.brand : CATEGORY_LOOKS[t].color;
          return (
            <Pressable key={t} onPress={() => { setFilter(t); setSelectedId(null); }}
              style={[styles.chip, { backgroundColor: active ? fill : colors.card }]}>
              {t !== 'all' && <MaterialCommunityIcons name={CATEGORY_LOOKS[t].icon} size={16} color={active ? INK : colors.text} />}
              <Text style={{ color: active ? INK : colors.text, fontWeight: '600' }}>{t === 'all' ? 'All' : ACTIVITY_LABELS[t]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.mapButtons, { top: insets.top + 64 }]}>
        <RoundMapButton icon="crosshairs-gps" label="Go to my location" onPress={goToMe} />
        <RoundMapButton icon="fit-to-screen-outline" label="Show all routes" onPress={fitAll} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {selected ? (
          <Pressable style={styles.cardRow} onPress={() => router.push({ pathname: '/activity/[id]', params: { id: selected.id } })}>
            <View style={[styles.dot, { backgroundColor: CATEGORY_LOOKS[selected.type].color }]}>
              <MaterialCommunityIcons name={CATEGORY_LOOKS[selected.type].icon} size={20} color={INK} />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{selected.title}</Text>
              <Text style={{ color: colors.textSecondary }}>
                {formatDistance(selected.distanceMeters)} · {new Date(selected.startedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Your routes</Text>
            <Text style={{ color: colors.textSecondary }}>
              {routes.length === 0
                ? 'Record an activity with GPS and its route will show up here.'
                : `${routes.length} ${routes.length === 1 ? 'route' : 'routes'} · ${formatDistance(totalMeters)}. Tap one to open it.`}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function RoundMapButton({ icon, label, onPress }: {
  icon: 'crosshairs-gps' | 'fit-to-screen-outline'; label: string; onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={[styles.roundButton, { backgroundColor: colors.card }]}>
      <MaterialCommunityIcons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  chipBar: { position: 'absolute', left: 0, right: 0 },
  chips: { gap: 8, paddingHorizontal: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  mapButtons: { position: 'absolute', right: 12, gap: 10 },
  roundButton: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  card: { position: 'absolute', left: 12, right: 12, bottom: 12, borderRadius: 16, padding: 16 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 2 },
});
