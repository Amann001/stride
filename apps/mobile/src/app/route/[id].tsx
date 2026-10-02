import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ACTIVITY_LABELS,
  decodePolyline,
  elevationProfile,
  formatDistance,
  formatDurationShort,
  routeDifficulty,
  type ActivityType,
  type RouteSummary,
} from '@repo/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { ElevationChart } from '@/components/elevation-chart';
import { DifficultyTag, routeSourceLabel } from '@/components/route-card';
import { RouteMap } from '@/components/route-map';
import { Stat } from '@/components/stat';
import { INK, useColors } from '@/constants/theme';
import { api } from '@/lib/api';
import { findRoute, rememberRoutes, setActiveRoute, toggleSaved, useSavedCopies } from '@/lib/route-store';

// Typical moving speed in km/h, used for the time estimate. Walkers and hikers also get
// Naismith's rule: 10 extra minutes per 100 m of climbing.
const TYPICAL_KMH: Record<ActivityType, number> = { run: 10, ride: 20, walk: 5, hike: 4 };

function estimateSeconds(route: RouteSummary): number {
  const flat = (route.distanceMeters / 1000 / TYPICAL_KMH[route.sport]) * 3600;
  const climb = route.sport === 'walk' || route.sport === 'hike' ? (route.elevationGainMeters / 100) * 600 : 0;
  return flat + climb;
}

// Loads a route by id: a suggestion held in memory, a saved route, or a past activity.
async function loadRoute(id: string): Promise<RouteSummary> {
  const known = findRoute(id);
  if (known) return known;
  try {
    return await api.getRoute(id);
  } catch {
    const a = await api.getActivity(id);
    return {
      id: a.id,
      source: 'activity',
      name: a.title,
      sport: a.type,
      distanceMeters: a.distanceMeters,
      elevationGainMeters: a.elevationGainMeters,
      polyline: a.polyline,
      elevationProfile: elevationProfile(a.points),
      start: { lat: a.points[0]?.lat ?? 0, lng: a.points[0]?.lng ?? 0 },
      difficulty: routeDifficulty(a.type, a.distanceMeters, a.elevationGainMeters),
      createdAt: a.startedAt,
    };
  }
}

// One route: where it goes, how long and hilly it is, and a Start button that takes you
// to Record with the route on the map to follow.
export default function RouteScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const savedCopies = useSavedCopies();
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadRoute(id).then(
      (r) => {
        rememberRoutes([r]);
        setRoute(r);
      },
      (err) => setError(err instanceof Error ? err.message : 'Route not found'),
    );
  }, [id]);

  const coords = useMemo(() => (route ? decodePolyline(route.polyline) : []), [route]);

  if (error) return <Text style={[styles.center, { color: colors.danger }]}>{error}</Text>;
  if (!route) return <ActivityIndicator style={styles.center} color={colors.accent} />;

  const savedId = savedCopies[route.id];
  // Saved routes get a Delete button; suggestions and activities get Save / Saved.
  const isSaved = !!savedId;

  const onSave = async () => {
    setBusy(true);
    try {
      const result = await toggleSaved(route, savedId);
      if (route.source === 'saved' && result === null) {
        router.back();
        return;
      }
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmSaveToggle = () =>
    route.source === 'saved'
      ? Alert.alert('Delete route?', `"${route.name}" will be removed from your saved routes.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: onSave },
        ])
      : onSave();

  const start = () => {
    setActiveRoute(route);
    router.navigate('/record');
  };

  return (
    <>
      <Stack.Screen options={{ title: route.name }} />
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
        <RouteMap coords={coords} style={styles.map} />
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <CategoryIcon type={route.sport} />
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text }]}>{route.name}</Text>
              <View style={styles.meta}>
                <DifficultyTag difficulty={route.difficulty} />
                <Text style={{ color: colors.textSecondary }}>{ACTIVITY_LABELS[route.sport]} · {routeSourceLabel(route)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.row}>
            <Stat label="Distance" value={formatDistance(route.distanceMeters)} />
            <Stat label="Elev gain" value={`${Math.round(route.elevationGainMeters)} m`} />
            <Stat label="Est. time" value={formatDurationShort(estimateSeconds(route))} />
          </View>
          <View style={styles.buttons}>
            <Pressable style={[styles.secondary, { borderColor: colors.border }]} onPress={confirmSaveToggle} disabled={busy}>
              <MaterialCommunityIcons name={route.source === 'saved' ? 'delete-outline' : isSaved ? 'bookmark' : 'bookmark-outline'}
                size={20} color={route.source === 'saved' ? colors.danger : colors.text} />
              <Text style={{ color: route.source === 'saved' ? colors.danger : colors.text, fontWeight: '700' }}>
                {route.source === 'saved' ? 'Delete' : isSaved ? 'Saved' : 'Save'}
              </Text>
            </Pressable>
            <Pressable style={[styles.secondary, { borderColor: colors.border }]}
              onPress={() => Share.share({ message: `${route.name}: a ${formatDistance(route.distanceMeters)} ${ACTIVITY_LABELS[route.sport].toLowerCase()} route with ${Math.round(route.elevationGainMeters)} m of climbing, on Stride.` })}>
              <MaterialCommunityIcons name="export-variant" size={20} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: '700' }}>Share</Text>
            </Pressable>
          </View>
          <Pressable style={[styles.primary, { backgroundColor: colors.brand }]} onPress={start}>
            <MaterialCommunityIcons name="play" size={22} color={INK} />
            <Text style={styles.primaryText}>Start {ACTIVITY_LABELS[route.sport]} with this route</Text>
          </Pressable>
        </View>

        {route.elevationProfile.length > 1 && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.section, { color: colors.text }]}>Elevation</Text>
            <ElevationChart type={route.sport} profile={route.elevationProfile} />
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { marginTop: 48, textAlign: 'center' },
  content: { gap: 12, paddingBottom: 40 },
  map: { height: 340 },
  card: { padding: 20, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, gap: 4 },
  title: { fontSize: 22, fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row' },
  buttons: { flexDirection: 'row', gap: 10 },
  secondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 10 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 14 },
  primaryText: { color: INK, fontWeight: '700', fontSize: 16 },
  section: { fontSize: 17, fontWeight: '700' },
});
