import {
  decodePolyline,
  distanceBetween,
  encodePolyline,
  type ActivityType,
  type LatLng,
  type ProfileSample,
} from '@repo/shared';

// Turns points on a map into real routes along roads and paths, and looks up how hilly
// they are. Uses two free services built on OpenStreetMap data:
// - Routing: FOSSGIS OSRM servers (https://routing.openstreetmap.de), foot and bike profiles.
// - Elevation: Open-Meteo (https://open-meteo.com/en/docs/elevation-api).
// Both ask for light, fair use, so results are cached. Before a public launch, run our
// own OSRM server instead.

const USER_AGENT = 'Stride/0.1 (personal fitness app; https://github.com/Amann001/stride)';
const PROFILE: Record<ActivityType, 'foot' | 'bike'> = { run: 'foot', walk: 'foot', hike: 'foot', ride: 'bike' };

export class RoutingError extends Error {}

// A small cache that forgets entries after `ttlMs` and keeps at most `max` of them.
export class TtlCache<V> {
  private map = new Map<string, { value: V; expires: number }>();
  constructor(private max: number, private ttlMs: number) {}
  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit || hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Move to the end so the least recently used entry is dropped first.
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }
  set(key: string, value: V) {
    this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
  }
}

// Fetches JSON from a map service. Busy free services sometimes turn a request away
// ("too many requests" or a server error), so wait and try again, a little longer each time.
const RETRY_WAITS_MS = [1200, 3500];

async function getJson<T>(url: string, attempt = 0): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    if (attempt < RETRY_WAITS_MS.length) return retryAfterPause(url, attempt);
    throw new RoutingError(`Map service unreachable: ${(err as Error).message}`);
  }
  if ((res.status === 429 || res.status >= 500) && attempt < RETRY_WAITS_MS.length) return retryAfterPause(url, attempt);
  if (!res.ok) throw new RoutingError(`Map service replied ${res.status}`);
  return (await res.json()) as T;
}

async function retryAfterPause<T>(url: string, attempt: number): Promise<T> {
  await new Promise((r) => setTimeout(r, RETRY_WAITS_MS[attempt]));
  return getJson<T>(url, attempt + 1);
}

// The elevation service allows only a few requests per second, and one route suggestion
// asks for three at once. Send them one at a time, a short moment apart.
let elevationQueue: Promise<unknown> = Promise.resolve();
const ELEVATION_GAP_MS = 250;

function queueElevation<T>(task: () => Promise<T>): Promise<T> {
  const run = elevationQueue.then(task, task);
  elevationQueue = run.then(
    () => new Promise((r) => setTimeout(r, ELEVATION_GAP_MS)),
    () => new Promise((r) => setTimeout(r, ELEVATION_GAP_MS)),
  );
  return run;
}

const routeCache = new TtlCache<{ coords: LatLng[]; distanceMeters: number }>(500, 24 * 3600_000);

// The best route along roads and paths through `points`, in order.
export async function routeThrough(sport: ActivityType, points: LatLng[]): Promise<{ coords: LatLng[]; distanceMeters: number }> {
  const list = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const key = `${PROFILE[sport]}|${list}`;
  const cached = routeCache.get(key);
  if (cached) return cached;
  const data = await getJson<{ code: string; routes?: { geometry: string; distance: number }[] }>(
    `https://routing.openstreetmap.de/routed-${PROFILE[sport]}/route/v1/driving/${list}` +
      '?overview=full&geometries=polyline6&continue_straight=false',
  );
  const route = data.routes?.[0];
  if (data.code !== 'Ok' || !route) throw new RoutingError('No route found between those points');
  const result = { coords: decodePolyline(route.geometry, 6), distanceMeters: route.distance };
  routeCache.set(key, result);
  return result;
}

// Straight lines between points, for "don't follow roads" mode.
export function straightLine(points: LatLng[]): { coords: LatLng[]; distanceMeters: number } {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += distanceBetween(points[i - 1], points[i]);
  return { coords: points, distanceMeters: d };
}

const EARTH_RADIUS_M = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

// The point `meters` away from `from` in compass direction `bearing` (degrees).
export function destination(from: LatLng, bearing: number, meters: number): LatLng {
  const δ = meters / EARTH_RADIUS_M;
  const θ = rad(bearing);
  const φ1 = rad(from.lat);
  const λ1 = rad(from.lng);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: deg(φ2), lng: ((deg(λ2) + 540) % 360) - 180 };
}

// Makes a loop of about `targetMeters` that starts and ends at `start`, heading out in
// direction `bearing`. It routes through three points on a circle that passes through the
// start, then resizes the circle (up to twice) if the real route came out too long or short.
export async function loopRoute(sport: ActivityType, start: LatLng, targetMeters: number, bearing: number) {
  // Roads wind, so a route is usually ~30% longer than the circle it follows.
  let radius = targetMeters / (2 * Math.PI) / 1.3;
  let best: { coords: LatLng[]; distanceMeters: number } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const center = destination(start, bearing, radius);
    const around = [90, 180, 270].map((a) => destination(center, (bearing + 180 + a) % 360, radius));
    const route = await routeThrough(sport, [start, ...around, start]);
    if (!best || Math.abs(route.distanceMeters - targetMeters) < Math.abs(best.distanceMeters - targetMeters)) best = route;
    const ratio = route.distanceMeters / targetMeters;
    if (ratio > 0.8 && ratio < 1.25) break;
    radius *= targetMeters / route.distanceMeters;
  }
  return best!;
}

const elevationCache = new TtlCache<number[]>(2000, 7 * 24 * 3600_000);
const MAX_SAMPLES = 100; // Open-Meteo takes up to 100 points per request

// Altitude along a route, sampled at up to 100 evenly spaced points, plus total climbing.
export async function elevationAlong(coords: LatLng[]): Promise<{ profile: ProfileSample[]; gainMeters: number }> {
  if (coords.length < 2) return { profile: [], gainMeters: 0 };
  const cumulative = [0];
  for (let i = 1; i < coords.length; i++) cumulative.push(cumulative[i - 1] + distanceBetween(coords[i - 1], coords[i]));
  const total = cumulative[cumulative.length - 1];
  const count = Math.min(MAX_SAMPLES, Math.max(2, Math.ceil(total / 25)));
  const samples: { d: number; p: LatLng }[] = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const d = (k / (count - 1)) * total;
    while (j < coords.length - 2 && cumulative[j + 1] < d) j++;
    const seg = cumulative[j + 1] - cumulative[j] || 1;
    const f = Math.min(1, Math.max(0, (d - cumulative[j]) / seg));
    samples.push({
      d,
      p: { lat: coords[j].lat + (coords[j + 1].lat - coords[j].lat) * f, lng: coords[j].lng + (coords[j + 1].lng - coords[j].lng) * f },
    });
  }
  const lats = samples.map((s) => s.p.lat.toFixed(5)).join(',');
  const lngs = samples.map((s) => s.p.lng.toFixed(5)).join(',');
  const key = `${lats}|${lngs}`;
  let alts = elevationCache.get(key);
  if (!alts) {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;
    const data = await queueElevation(() => getJson<{ elevation?: number[] }>(url));
    alts = data.elevation ?? [];
    elevationCache.set(key, alts);
  }
  const profile = samples.map((s, i) => ({ distanceMeters: Math.round(s.d), altitude: alts![i] ?? 0 }));
  // Count climbs of at least 1 m, so tiny ups and downs in the terrain data don't add up.
  let gain = 0;
  let ref = profile[0]?.altitude ?? 0;
  for (const s of profile) {
    if (s.altitude - ref >= 1) {
      gain += s.altitude - ref;
      ref = s.altitude;
    } else if (s.altitude < ref) {
      ref = s.altitude;
    }
  }
  return { profile, gainMeters: Math.round(gain) };
}

// Standard 5-decimal polyline for storing and sending to the app.
export const toPolyline = (coords: LatLng[]) => encodePolyline(coords, 5);
