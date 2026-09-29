import type { TrackPoint } from './schemas';

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

// Straight-line distance in meters between two lat/lng points (haversine formula).
export function distanceBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Below this speed (m/s) we treat you as standing still, e.g. waiting at a traffic light.
const MOVING_SPEED_THRESHOLD = 0.5;
// Ignore altitude wiggles smaller than this, since phone GPS altitude is noisy.
const ELEVATION_NOISE_M = 3;

export interface TrackStats {
  distanceMeters: number;
  elapsedSeconds: number;
  movingSeconds: number;
  elevationGainMeters: number;
}

// Turns a list of GPS points into the numbers shown on an activity.
export function computeStats(points: TrackPoint[]): TrackStats {
  let distance = 0;
  let moving = 0;
  let gain = 0;
  let lastAlt: number | null = null;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const d = distanceBetween(prev, cur);
    const dt = (cur.t - prev.t) / 1000;
    distance += d;
    if (dt > 0 && d / dt > MOVING_SPEED_THRESHOLD) moving += dt;
  }

  for (const p of points) {
    if (p.alt == null) continue;
    if (lastAlt == null) {
      lastAlt = p.alt;
    } else if (Math.abs(p.alt - lastAlt) >= ELEVATION_NOISE_M) {
      if (p.alt > lastAlt) gain += p.alt - lastAlt;
      lastAlt = p.alt;
    }
  }

  const elapsed = points.length > 1 ? (points[points.length - 1].t - points[0].t) / 1000 : 0;
  return {
    distanceMeters: Math.round(distance * 10) / 10,
    elapsedSeconds: Math.round(elapsed),
    movingSeconds: Math.round(moving),
    elevationGainMeters: Math.round(gain),
  };
}

// Google's polyline encoding squeezes a route into a short string.
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm
export function encodePolyline(coords: { lat: number; lng: number }[]): string {
  let out = '';
  let prevLat = 0;
  let prevLng = 0;
  const encodeValue = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    while (n >= 0x20) {
      out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    out += String.fromCharCode(n + 63);
  };
  for (const c of coords) {
    const lat = Math.round(c.lat * 1e5);
    const lng = Math.round(c.lng * 1e5);
    encodeValue(lat - prevLat);
    encodeValue(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
}

export function decodePolyline(str: string): { lat: number; lng: number }[] {
  const coords: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const decodeValue = () => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < str.length) {
    lat += decodeValue();
    lng += decodeValue();
    coords.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return coords;
}
