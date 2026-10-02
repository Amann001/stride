import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ACTIVITY_LABELS,
  decodePolyline,
  HEATMAP_INFO,
  distanceBetween,
  elevationBand,
  formatDistance,
  LENGTH_FILTERS,
  type ActivitySummary,
  type ActivityType,
  type ElevationBand,
  type LatLng,
  type RouteDifficulty,
  type RouteSummary,
} from '@repo/shared';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/bottom-sheet';
import { MapLayersSheet } from '@/components/map-layers-sheet';
import { MapsTabMap, type MapsTabMapHandle } from '@/components/maps-tab-map';
import { OptionSheet, type Option } from '@/components/option-sheet';
import { DIFFICULTY_LOOK, DifficultyTag, RouteCard, routeSourceLabel } from '@/components/route-card';
import { SportSheet } from '@/components/sport-sheet';
import { CATEGORY_LOOKS, type IconName } from '@/constants/categories';
import { INK, useColors } from '@/constants/theme';
import { api, heatmapTileUrl } from '@/lib/api';
import { useMapPrefs, type MapStyle } from '@/lib/map-prefs';
import { storage } from '@/lib/storage';
import { rememberRoutes, toggleSaved, useSavedCopies } from '@/lib/route-store';

type Mode = 'routes' | 'activities';

const AROUND_HERE: Record<ActivityType, string> = { run: 'Runs', ride: 'Rides', walk: 'Walks', hike: 'Hikes' };
const BIKE_LANES_URL = 'https://a.tile-cyclosm.openstreetmap.fr/cyclosm-lite/{z}/{x}/{y}.png';
const TOKEN_TTL_MS = 11 * 3600_000;
// Show "Search Here" once the map has moved this far from where routes were found.
const SEARCH_HERE_METERS = 300;

const toLatLng = (r: { latitude: number; longitude: number }): LatLng => ({ lat: r.latitude, lng: r.longitude });

// A short place name for a point, like "Greater Noida".
async function placeName(p: LatLng): Promise<string | null> {
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude: p.lat, longitude: p.lng });
    return a?.district ?? a?.city ?? a?.subregion ?? a?.region ?? null;
  } catch {
    return null;
  }
}

// Maps tab, like Strava's: find routes around you or anywhere you search, filter them,
// switch map style or turn on heatmaps, and draw your own. Tap a route for details.
export default function MapsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const prefs = useMapPrefs();
  const savedCopies = useSavedCopies();
  const mapRef = useRef<MapsTabMapHandle>(null);

  const [sport, setSport] = useState<ActivityType>('run');
  const [mode, setMode] = useState<Mode>('routes');
  const [lengthIdx, setLengthIdx] = useState<number | null>(null);
  const [elevation, setElevation] = useState<ElevationBand | null>(null);
  const [difficulty, setDifficulty] = useState<RouteDifficulty | null>(null);
  const [variant, setVariant] = useState(0);

  const [searchCenter, setSearchCenter] = useState<LatLng | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLng | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [query, setQuery] = useState('');

  const [suggested, setSuggested] = useState<RouteSummary[] | null>(null);
  const [nearby, setNearby] = useState<RouteSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [tile, setTile] = useState<{ token: string; at: number } | null>(null);
  const [pitched, setPitched] = useState(false);
  // A one-time hint pointing at Layers, until you've opened it once.
  const [showLayersHint, setShowLayersHint] = useState(false);
  useEffect(() => {
    storage.get(LAYERS_HINT_KEY).then((seen) => setShowLayersHint(!seen), () => {});
  }, []);
  const dismissHint = () => {
    setShowLayersHint(false);
    storage.set(LAYERS_HINT_KEY, '1').catch(() => {});
  };
  const [sheet, setSheet] = useState<'sport' | 'layers' | 'mode' | 'length' | 'elevation' | 'difficulty' | null>(null);

  // Find routes of a sport (and length) around a point. Called by whatever the user did:
  // opening the tab, searching, tapping Search Here, or changing a filter.
  const load = useCallback(async (center: LatLng, opts: { sport: ActivityType; lengthIdx: number | null; variant?: number }) => {
    const { sport, lengthIdx } = opts;
    setSearchCenter(center);
    setLoading(true);
    setError(null);
    setSelectedId(null);
    placeName(center).then(setPlace);
    const len = lengthIdx == null ? null : LENGTH_FILTERS[sport][lengthIdx];
    const [s, n] = await Promise.allSettled([
      api.suggestRoutes({ start: center, sport, minKm: len?.min, maxKm: len?.max, variant: opts.variant ?? 0 }),
      api.nearbyRoutes(center.lat, center.lng, sport),
    ]);
    if (s.status === 'fulfilled') {
      rememberRoutes(s.value);
      setSuggested(s.value);
    } else {
      setSuggested([]);
      setError(s.reason instanceof Error ? s.reason.message : 'Could not find routes');
    }
    if (n.status === 'fulfilled') {
      rememberRoutes(n.value);
      setNearby(n.value);
    }
    setLoading(false);
  }, []);
  const filters = { sport, lengthIdx };

  const goTo = (p: LatLng, zoom = 0.03) => mapRef.current?.goTo(p, zoom);

  // Start where you are.
  const locateMe = useCallback(async () => {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) {
      setLocationDenied(true);
      return null;
    }
    setLocationDenied(false);
    const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync());
    return toLatLng(pos.coords);
  }, []);

  // New sport or length: search the same place again.
  const changeSport = (s: ActivityType) => {
    setSport(s);
    setLengthIdx(null);
    if (searchCenter) load(searchCenter, { sport: s, lengthIdx: null });
  };
  const changeLength = (i: number | null) => {
    setLengthIdx(i);
    if (searchCenter) load(searchCenter, { sport, lengthIdx: i });
  };

  // The first time the tab opens, find routes around you. Also keep the heatmap key and
  // your activities fresh whenever the tab opens.
  const [started, setStarted] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (!started) {
        setStarted(true);
        locateMe().then((here) => {
          if (!here) return;
          goTo(here);
          load(here, { sport: 'run', lengthIdx: null });
        });
      }
      if (!tile || Date.now() - tile.at > TOKEN_TTL_MS) {
        api.heatmapToken().then((t) => setTile({ token: t.token, at: Date.now() }), () => {});
      }
      api.listActivities().then(setActivities, () => {});
    }, [tile, started, locateMe, load]),
  );

  const matchesFilters = useCallback(
    (r: RouteSummary) =>
      (!elevation || elevationBand(r.distanceMeters, r.elevationGainMeters) === elevation) &&
      (!difficulty || r.difficulty === difficulty),
    [elevation, difficulty],
  );
  const shownSuggested = useMemo(() => (suggested ?? []).filter(matchesFilters), [suggested, matchesFilters]);
  const shownNearby = useMemo(() => nearby.filter(matchesFilters), [nearby, matchesFilters]);
  const allRoutes = useMemo(() => [...shownSuggested, ...shownNearby], [shownSuggested, shownNearby]);
  const selected = allRoutes.find((r) => r.id === selectedId) ?? null;

  const lines = useMemo(
    () => allRoutes.map((r) => ({ id: r.id, coords: decodePolyline(r.polyline), selected: r.id === selectedId })),
    [allRoutes, selectedId],
  );
  const activityLines = useMemo(
    () =>
      activities
        .filter((a) => a.polyline && a.type === sport)
        .map((a) => ({ id: a.id, activity: a, coords: decodePolyline(a.polyline), color: CATEGORY_LOOKS[a.type].color }))
        .filter((l) => l.coords.length > 1),
    [activities, sport],
  );

  const showSearchHere = mode === 'routes' && !loading && mapCenter && searchCenter
    && distanceBetween(mapCenter, searchCenter) > SEARCH_HERE_METERS;

  const toggle3d = async () => {
    const next = !pitched;
    setPitched(next);
    await mapRef.current?.setPitched(next);
  };

  const searchPlace = async () => {
    const text = query.trim();
    if (!text) return;
    try {
      const [hit] = await Location.geocodeAsync(text);
      if (!hit) {
        setError(`Couldn't find "${text}"`);
        return;
      }
      const p = toLatLng(hit);
      goTo(p, 0.05);
      setMode('routes');
      load(p, filters);
    } catch {
      setError(`Couldn't search for "${text}" right now`);
    }
  };

  const layersOn = (prefs.heatmap ? 1 : 0) + (prefs.bikeLanes ? 1 : 0) + (prefs.mapStyle !== 'standard' ? 1 : 0);
  // The Layers chip says what's on, so it's clear where map types and heatmaps live.
  const layersLabel = prefs.heatmap
    ? `${HEATMAP_INFO[prefs.heatmap].label} heatmap`
    : prefs.mapStyle !== 'standard'
      ? STYLE_NAMES[prefs.mapStyle]
      : 'Layers';
  const openLayers = () => {
    setSheet('layers');
    dismissHint();
  };
  const lengthOptions: Option<number | null>[] = [
    { value: null, label: 'Any length' },
    ...LENGTH_FILTERS[sport].map((l, i) => ({ value: i, label: l.label })),
  ];
  const sheetHeights = [150, Math.round(screenH * 0.45), Math.round(screenH * 0.78)];
  const openRoute = (r: RouteSummary) => router.push({ pathname: '/route/[id]', params: { id: r.id } });

  return (
    <View style={styles.screen}>
      <MapsTabMap
        ref={mapRef}
        mapStyle={prefs.mapStyle}
        pois={prefs.pois}
        bikeLanesUrl={prefs.bikeLanes ? BIKE_LANES_URL : null}
        heatmapUrl={prefs.heatmap && tile ? heatmapTileUrl(prefs.heatmap, sport, tile.token) : null}
        routes={mode === 'routes' ? lines : []}
        activities={mode === 'routes' ? [] : activityLines}
        selectedStart={selected ? selected.start : null}
        onRoutePress={setSelectedId}
        onActivityPress={(id) => router.push({ pathname: '/activity/[id]', params: { id } })}
        onMapPress={() => setSelectedId(null)}
        onCenterChange={setMapCenter}
      />

      {/* Search pill and filter chips */}
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <View style={[styles.searchPill, { backgroundColor: colors.card }]}>
          <Pressable onPress={() => setSheet('sport')} style={styles.sportButton} accessibilityLabel="Choose a sport">
            <MaterialCommunityIcons name={CATEGORY_LOOKS[sport].icon} size={22} color={colors.accent} />
            <MaterialCommunityIcons name="chevron-down" size={16} color={colors.textSecondary} />
          </Pressable>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search a place"
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={searchPlace}
            returnKeyType="search"
          />
          <Pressable onPress={() => router.push('/routes/saved')} style={[styles.savedButton, { borderColor: colors.border }]}>
            <MaterialCommunityIcons name="bookmark-outline" size={18} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>Saved</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip icon="layers-outline" label={layersLabel} active={layersOn > 0} dropdown onPress={openLayers} />
          <Chip label={mode === 'routes' ? 'Routes' : 'My Activities'} active dropdown onPress={() => setSheet('mode')} />
          {mode === 'routes' && (
            <>
              <Chip label={lengthIdx == null ? 'Length' : LENGTH_FILTERS[sport][lengthIdx].label} active={lengthIdx != null}
                dropdown onPress={() => setSheet('length')} />
              <Chip label={elevation ? cap(elevation) : 'Elevation'} active={!!elevation} dropdown onPress={() => setSheet('elevation')} />
              <Chip label={difficulty ? DIFFICULTY_LOOK[difficulty].label : 'Difficulty'} active={!!difficulty} dropdown
                onPress={() => setSheet('difficulty')} />
            </>
          )}
        </ScrollView>
        {showLayersHint && (
          <Pressable style={[styles.hint, { backgroundColor: colors.brand }]} onPress={openLayers}>
            <View style={[styles.hintArrow, { borderBottomColor: colors.brand }]} />
            <MaterialCommunityIcons name="layers-triple-outline" size={20} color={INK} />
            <Text style={styles.hintText}>New: satellite view and heatmaps. Tap Layers to try them.</Text>
            <Pressable hitSlop={10} onPress={dismissHint} accessibilityLabel="Dismiss">
              <MaterialCommunityIcons name="close" size={18} color={INK} />
            </Pressable>
          </Pressable>
        )}
        {showSearchHere && (
          <Pressable style={[styles.searchHere, { backgroundColor: colors.brand }]} onPress={() => mapCenter && load(mapCenter, filters)}>
            <Text style={{ color: INK, fontWeight: '700' }}>Search Here</Text>
          </Pressable>
        )}
      </View>

      {/* Map buttons */}
      <View style={[styles.mapButtons, { top: insets.top + 130 }]}>
        <MapButton icon="layers-outline" label="Map layers" badge={layersOn} onPress={openLayers} />
        <MapButton text="3D" label="Tilt the map" active={pitched} onPress={toggle3d} />
        <MapButton icon="crosshairs-gps" label="Go to my location" onPress={async () => {
          const here = await locateMe();
          if (here) goTo(here, 0.02);
        }} />
        <MapButton icon="map-marker-path" label="Create a route" onPress={() => router.push('/routes/create')} />
      </View>

      {/* The route you tapped, floating over the map */}
      {selected && (
        <Pressable onPress={() => openRoute(selected)}
          style={[styles.selectedCard, { backgroundColor: colors.card, bottom: sheetHeights[0] + 12 }]}>
          <View style={styles.selectedText}>
            <Text style={[styles.selectedName, { color: colors.text }]} numberOfLines={1}>{selected.name}</Text>
            <View style={styles.selectedMeta}>
              <DifficultyTag difficulty={selected.difficulty} />
              <Text style={{ color: colors.textSecondary }}>
                {formatDistance(selected.distanceMeters)} · {Math.round(selected.elevationGainMeters)} m
              </Text>
            </View>
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>{routeSourceLabel(selected)}</Text>
          </View>
          <Pressable hitSlop={10} onPress={() => toggleSaved(selected, savedCopies[selected.id]).catch(() => {})}
            accessibilityLabel="Save route">
            <MaterialCommunityIcons name={savedCopies[selected.id] || selected.source === 'saved' ? 'bookmark' : 'bookmark-outline'}
              size={24} color={colors.accent} />
          </Pressable>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSecondary} />
        </Pressable>
      )}

      <BottomSheet
        heights={sheetHeights}
        initialIndex={0}
        header={
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              {mode === 'routes' ? `${ACTIVITY_LABELS[sport]} routes${place ? ` near ${place}` : ''}` : `Your ${AROUND_HERE[sport].toLowerCase()}`}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              {mode === 'routes'
                ? loading ? 'Finding routes…' : `${allRoutes.length} ${allRoutes.length === 1 ? 'route' : 'routes'} · drag up to see them`
                : `${activityLines.length} recorded · tap one on the map to open it`}
            </Text>
          </View>
        }>
        <ScrollView contentContainerStyle={styles.sheetBody}>
          {mode === 'activities' ? (
            activityLines.length ? activityLines.map(({ activity }) => (
              <Pressable key={activity.id} style={[styles.activityRow, { borderColor: colors.border }]}
                onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}>
                <MaterialCommunityIcons name={CATEGORY_LOOKS[activity.type].icon} size={22} color={colors.text} />
                <View style={styles.selectedText}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{activity.title}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {formatDistance(activity.distanceMeters)} · {new Date(activity.startedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </Text>
                </View>
              </Pressable>
            )) : <Text style={{ color: colors.textSecondary }}>Record a {ACTIVITY_LABELS[sport].toLowerCase()} and its route shows up here.</Text>
          ) : (
            <>
              {locationDenied && !searchCenter && (
                <Text style={{ color: colors.textSecondary }}>
                  Turn on location for Stride in Settings to see routes around you, or search for a place above.
                </Text>
              )}
              <Text style={[styles.section, { color: colors.text }]}>From your location</Text>
              {loading ? (
                <Skeletons />
              ) : error && shownSuggested.length === 0 ? (
                <Text style={{ color: colors.textSecondary }}>{error}</Text>
              ) : shownSuggested.length === 0 && searchCenter ? (
                <Text style={{ color: colors.textSecondary }}>No routes match these filters. Try another length or difficulty.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
                  {shownSuggested.map((r) => (
                    <RouteCard key={r.id} route={r} place={place ? `${place} · Made for you` : 'Made for you'}
                      saved={!!savedCopies[r.id]} onPress={() => { setSelectedId(r.id); openRoute(r); }}
                      onToggleSave={() => toggleSaved(r, savedCopies[r.id]).catch(() => {})} />
                  ))}
                </ScrollView>
              )}
              {searchCenter && !loading && (
                <Pressable style={[styles.moreButton, { borderColor: colors.border }]}
                  onPress={() => { const v = variant + 1; setVariant(v); load(searchCenter, { ...filters, variant: v }); }}>
                  <MaterialCommunityIcons name="refresh" size={18} color={colors.text} />
                  <Text style={{ color: colors.text, fontWeight: '700' }}>Show different routes</Text>
                </Pressable>
              )}

              <Text style={[styles.section, { color: colors.text }]}>{AROUND_HERE[sport]} around here</Text>
              {shownNearby.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
                  {shownNearby.map((r) => (
                    <RouteCard key={r.id} route={r} onPress={() => { setSelectedId(r.id); openRoute(r); }}
                      saved={r.source === 'saved'} onToggleSave={r.source === 'saved' ? undefined : () => toggleSaved(r, savedCopies[r.id]).catch(() => {})} />
                  ))}
                </ScrollView>
              ) : (
                <Text style={{ color: colors.textSecondary }}>
                  Routes you save and {ACTIVITY_LABELS[sport].toLowerCase()}s you record near here will show up here.
                </Text>
              )}

              <Pressable style={[styles.createCard, { backgroundColor: colors.raised }]} onPress={() => router.push('/routes/create')}>
                <MaterialCommunityIcons name="map-marker-path" size={28} color={colors.accent} />
                <View style={styles.selectedText}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Create a Route</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Tap the map to plan your own, following roads and paths.</Text>
                </View>
              </Pressable>
              <Text style={[styles.credit, { color: colors.textSecondary }]}>
                Routes: © OpenStreetMap contributors, FOSSGIS routing, Open-Meteo elevation
              </Text>
            </>
          )}
        </ScrollView>
      </BottomSheet>

      <SportSheet visible={sheet === 'sport'} selected={sport} onSelect={changeSport}
        onClose={() => setSheet(null)} />
      <MapLayersSheet visible={sheet === 'layers'} sport={sport} onClose={() => setSheet(null)} />
      <OptionSheet visible={sheet === 'mode'} title="Show" value={mode} onSelect={setMode} onClose={() => setSheet(null)}
        options={[
          { value: 'routes', label: 'Routes', description: 'Suggested and saved routes around the map' },
          { value: 'activities', label: 'My Activities', description: `Every ${ACTIVITY_LABELS[sport].toLowerCase()} you've recorded` },
        ]} />
      <OptionSheet visible={sheet === 'length'} title="Length" value={lengthIdx} options={lengthOptions}
        onSelect={changeLength} onClose={() => setSheet(null)} />
      <OptionSheet visible={sheet === 'elevation'} title="Elevation" value={elevation} onSelect={setElevation} onClose={() => setSheet(null)}
        options={[
          { value: null, label: 'Any' },
          { value: 'flat', label: 'Flat', description: 'Under 5 m of climbing per km' },
          { value: 'rolling', label: 'Rolling', description: '5 to 15 m per km' },
          { value: 'hilly', label: 'Hilly', description: 'Over 15 m per km' },
        ]} />
      <OptionSheet visible={sheet === 'difficulty'} title="Difficulty" value={difficulty} onSelect={setDifficulty} onClose={() => setSheet(null)}
        options={[
          { value: null, label: 'Any' },
          { value: 'easy', label: 'Easy' },
          { value: 'moderate', label: 'Moderate' },
          { value: 'hard', label: 'Hard' },
        ]} />
    </View>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const LAYERS_HINT_KEY = 'seen_layers_hint';
const STYLE_NAMES: Record<MapStyle, string> = { standard: 'Standard', satellite: 'Satellite', hybrid: 'Hybrid', mutedStandard: 'Muted' };

function Chip({ label, active, dropdown, icon, onPress }: {
  label: string; active: boolean; dropdown?: boolean; icon?: IconName; onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress}
      style={[styles.chip, { backgroundColor: colors.card, borderColor: active ? colors.accent : colors.border }]}>
      {icon && <MaterialCommunityIcons name={icon} size={16} color={active ? colors.accent : colors.text} />}
      <Text style={{ color: active ? colors.accent : colors.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
      {dropdown && <MaterialCommunityIcons name="chevron-down" size={16} color={active ? colors.accent : colors.textSecondary} />}
    </Pressable>
  );
}

function MapButton({ icon, text, label, badge, active, onPress }: {
  icon?: IconName; text?: string; label: string; badge?: number; active?: boolean; onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label}
      style={[styles.mapButton, { backgroundColor: active ? colors.brand : colors.card }]}>
      {icon ? (
        <MaterialCommunityIcons name={icon} size={22} color={active ? INK : colors.text} />
      ) : (
        <Text style={{ color: active ? INK : colors.text, fontWeight: '700' }}>{text}</Text>
      )}
      {!!badge && (
        <View style={[styles.badge, { backgroundColor: colors.brand }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

// Grey placeholders while routes load.
function Skeletons() {
  const colors = useColors();
  return (
    <View style={styles.cards}>
      {[0, 1].map((i) => (
        <View key={i} style={styles.skeleton}>
          <View style={[styles.skeletonMap, { backgroundColor: colors.border }]}>
            {i === 0 && <ActivityIndicator color={colors.accent} />}
          </View>
          <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: 140 }]} />
          <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: 90 }]} />
        </View>
      ))}
    </View>
  );
}

const shadow = { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } } as const;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { position: 'absolute', left: 0, right: 0, gap: 8 },
  searchPill: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, borderRadius: 999, paddingLeft: 12, paddingRight: 6, height: 50, ...shadow },
  sportButton: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  searchInput: { flex: 1, fontSize: 15, paddingHorizontal: 6, height: '100%' },
  savedButton: { flexDirection: 'row', alignItems: 'center', gap: 4, borderLeftWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, height: 34 },
  chips: { gap: 8, paddingHorizontal: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, ...shadow },
  searchHere: { alignSelf: 'center', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4, ...shadow },
  mapButtons: { position: 'absolute', right: 12, gap: 10 },
  hint: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 4, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, alignSelf: 'flex-start', maxWidth: 330, ...shadow,
  },
  // Little triangle pointing up at the Layers chip.
  hintArrow: {
    position: 'absolute', top: -7, left: 22, width: 0, height: 0,
    borderLeftWidth: 7, borderRightWidth: 7, borderBottomWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
  hintText: { color: INK, fontWeight: '700', fontSize: 13, flexShrink: 1 },
  mapButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', ...shadow },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: INK, fontSize: 11, fontWeight: '700' },
  selectedCard: { position: 'absolute', left: 12, right: 12, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, ...shadow },
  selectedText: { flex: 1, gap: 3 },
  selectedName: { fontSize: 17, fontWeight: '700' },
  selectedMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetHeader: { paddingHorizontal: 16, gap: 2 },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  sheetBody: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  section: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  cards: { flexDirection: 'row', gap: 12 },
  moreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 10 },
  createCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, marginTop: 8 },
  credit: { fontSize: 11, textAlign: 'center', marginTop: 4 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  skeleton: { width: 250, gap: 8 },
  skeletonMap: { height: 150, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  skeletonLine: { height: 12, borderRadius: 6 },
});
