import { CATEGORIES } from './categories';
import type { ActivityType, TrackPoint } from './schemas';

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
export const MOVING_SPEED_THRESHOLD = 0.5;

// Phone GPS altitude wobbles by several meters even on flat ground. We average it over
// ±20 seconds, then only count a climb once it rises at least 5 m. Tested on a real flat
// campus walk: raw counting said 18 m of climbing, this says 5 m.
const ELEVATION_SMOOTHING_SEC = 20;
const ELEVATION_NOISE_M = 5;

// True if going from `prev` to `next` would need an impossible speed for this activity
// (see `maxSpeedKmh` in categories.ts). Such a point is a GPS glitch and gets dropped.
export function isGpsJump(prev: TrackPoint, next: TrackPoint, type: ActivityType): boolean {
  const dt = (next.t - prev.t) / 1000;
  if (dt <= 0) return true;
  return (distanceBetween(prev, next) / dt) * 3.6 > CATEGORIES[type].maxSpeedKmh;
}

// Removes GPS glitches from a track, keeping points in time order.
export function cleanTrack(points: TrackPoint[], type: ActivityType): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (const p of [...points].sort((a, b) => a.t - b.t)) {
    const last = out[out.length - 1];
    if (!last || !isGpsJump(last, p, type)) out.push(p);
  }
  return out;
}

// Total climbing in meters, from smoothed altitude readings.
export function elevationGain(points: TrackPoint[]): number {
  const alts = points.filter((p): p is TrackPoint & { alt: number } => p.alt != null);
  if (alts.length < 2) return 0;
  // Moving average over a time window, using two pointers so long tracks stay fast.
  const smooth: number[] = [];
  let lo = 0;
  let hi = 0;
  let sum = 0;
  const win = ELEVATION_SMOOTHING_SEC * 1000;
  for (const p of alts) {
    while (hi < alts.length && alts[hi].t <= p.t + win) sum += alts[hi++].alt;
    while (alts[lo].t < p.t - win) sum -= alts[lo++].alt;
    smooth.push(sum / (hi - lo));
  }
  let gain = 0;
  let ref = smooth[0];
  for (const a of smooth) {
    if (a - ref >= ELEVATION_NOISE_M) {
      gain += a - ref;
      ref = a;
    } else if (ref - a >= ELEVATION_NOISE_M) {
      ref = a;
    }
  }
  return gain;
}

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

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const d = distanceBetween(prev, cur);
    const dt = (cur.t - prev.t) / 1000;
    distance += d;
    if (dt > 0 && d / dt > MOVING_SPEED_THRESHOLD) moving += dt;
  }

  const gain = elevationGain(points);
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
// `precision` is decimal places kept: 5 (about 1 m) is the standard; routing servers
// often send 6.
export function encodePolyline(coords: { lat: number; lng: number }[], precision = 5): string {
  const factor = 10 ** precision;
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
    const lat = Math.round(c.lat * factor);
    const lng = Math.round(c.lng * factor);
    encodeValue(lat - prevLat);
    encodeValue(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
}

export function decodePolyline(str: string, precision = 5): { lat: number; lng: number }[] {
  const factor = 10 ** precision;
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
    coords.push({ lat: lat / factor, lng: lng / factor });
  }
  return coords;
}
