import { CATEGORIES, effortName } from './categories';
import { formatDistance, formatDuration, formatSteps } from './format';
import { distanceBetween, MOVING_SPEED_THRESHOLD } from './geo';
import type { ActivityType, TrackPoint } from './schemas';

// Deeper looks at a recorded track: splits, fastest efforts, top speed, the elevation
// profile, and which achievements an activity earned compared with your earlier ones.

// Running totals along a track: meters covered and seconds spent moving up to each point.
function cumulative(points: TrackPoint[]) {
  const dist = [0];
  const moving = [0];
  for (let i = 1; i < points.length; i++) {
    const d = distanceBetween(points[i - 1], points[i]);
    const dt = (points[i].t - points[i - 1].t) / 1000;
    dist.push(dist[i - 1] + d);
    moving.push(moving[i - 1] + (dt > 0 && d / dt > MOVING_SPEED_THRESHOLD ? dt : 0));
  }
  return { dist, moving };
}

const lerp = (a: number | null, b: number | null, f: number) => (a == null || b == null ? null : a + (b - a) * f);

export interface Split {
  distanceMeters: number;
  movingSeconds: number;
  // Altitude at the end of the split minus at the start. Null if the phone gave no altitude.
  elevationChangeMeters: number | null;
}

// Cuts the track into equal pieces (e.g. every 1 km) and times each one. A last piece
// shorter than a full split is included once it's at least 50 m long.
export function computeSplits(points: TrackPoint[], splitMeters: number): Split[] {
  if (points.length < 2) return [];
  const { dist, moving } = cumulative(points);
  const splits: Split[] = [];
  let prevTime = 0;
  let prevAlt = points[0].alt;
  let boundary = splitMeters;

  for (let i = 1; i < points.length; i++) {
    // One GPS step can cross several boundaries on a fast ride, hence `while`.
    while (dist[i] >= boundary) {
      const f = (boundary - dist[i - 1]) / (dist[i] - dist[i - 1]);
      const time = moving[i - 1] + (moving[i] - moving[i - 1]) * f;
      const alt = lerp(points[i - 1].alt, points[i].alt, f);
      splits.push({
        distanceMeters: splitMeters,
        movingSeconds: time - prevTime,
        elevationChangeMeters: alt != null && prevAlt != null ? Math.round(alt - prevAlt) : null,
      });
      prevTime = time;
      prevAlt = alt;
      boundary += splitMeters;
    }
  }

  const last = points.length - 1;
  const rest = dist[last] - (boundary - splitMeters);
  if (rest >= 50) {
    const endAlt = points[last].alt;
    splits.push({
      distanceMeters: rest,
      movingSeconds: moving[last] - prevTime,
      elevationChangeMeters: endAlt != null && prevAlt != null ? Math.round(endAlt - prevAlt) : null,
    });
  }
  return splits;
}

export interface BestEffort {
  distanceMeters: number;
  seconds: number;
}

// Your fastest time over each distance anywhere inside this track, e.g. the quickest
// 1K in the middle of a 5K run. Uses moving time, so waiting at a crossing doesn't count.
export function bestEfforts(points: TrackPoint[], distances: number[]): BestEffort[] {
  if (points.length < 2) return [];
  const { dist, moving } = cumulative(points);
  const out: BestEffort[] = [];
  for (const target of distances) {
    let best = Infinity;
    let i = 0;
    for (let j = 1; j < points.length; j++) {
      // Slide the start forward as long as the stretch stays at least `target` long.
      while (i + 1 < j && dist[j] - dist[i + 1] >= target) i++;
      const span = dist[j] - dist[i];
      // Scale the stretch's time down to exactly `target` meters.
      if (span >= target) best = Math.min(best, ((moving[j] - moving[i]) * target) / span);
    }
    if (Number.isFinite(best) && best > 0) out.push({ distanceMeters: target, seconds: Math.round(best) });
  }
  return out;
}

// Top speed must be held this long to count, so a single GPS wobble can't set it.
const MAX_SPEED_WINDOW_SEC = 10;

// Highest speed held for at least 10 seconds, in meters per second.
export function maxSpeed(points: TrackPoint[]): number {
  if (points.length < 2) return 0;
  const { dist } = cumulative(points);
  let best = 0;
  let i = 0;
  for (let j = 1; j < points.length; j++) {
    while (i + 1 < j && (points[j].t - points[i + 1].t) / 1000 >= MAX_SPEED_WINDOW_SEC) i++;
    const dt = (points[j].t - points[i].t) / 1000;
    if (dt >= MAX_SPEED_WINDOW_SEC) best = Math.max(best, (dist[j] - dist[i]) / dt);
  }
  return Math.round(best * 100) / 100;
}

// Current speed while recording: distance over the 10 seconds before `now`, in meters per
// second. Pass the clock time as `now`: when you stop, GPS sends no new points, and
// measuring up to the last point would keep showing your old speed.
export function recentSpeed(points: TrackPoint[], now: number): number {
  const windowStart = now - MAX_SPEED_WINDOW_SEC * 1000;
  let i = points.length - 1;
  if (i < 1 || points[i].t < windowStart) return 0;
  let d = 0;
  while (i > 0 && points[i - 1].t >= windowStart) {
    d += distanceBetween(points[i - 1], points[i]);
    i--;
  }
  const dt = (now - points[i].t) / 1000;
  return dt > 0 ? d / dt : 0;
}

export interface ProfilePoint {
  distanceMeters: number;
  altitude: number;
}

// Average altitude in evenly spaced slices along the route, for drawing a hill chart.
// Empty if the phone didn't give altitude readings.
export function elevationProfile(points: TrackPoint[], slices = 60): ProfilePoint[] {
  if (points.length < 2) return [];
  const { dist } = cumulative(points);
  const total = dist[dist.length - 1];
  if (total <= 0) return [];
  const sums = new Array<number>(slices).fill(0);
  const counts = new Array<number>(slices).fill(0);
  points.forEach((p, i) => {
    if (p.alt == null) return;
    const k = Math.min(slices - 1, Math.floor((dist[i] / total) * slices));
    sums[k] += p.alt;
    counts[k]++;
  });
  const out: ProfilePoint[] = [];
  for (let k = 0; k < slices; k++) {
    if (counts[k]) out.push({ distanceMeters: ((k + 0.5) / slices) * total, altitude: sums[k] / counts[k] });
  }
  return out.length >= 2 ? out : [];
}

// ---------- Achievements ----------

export interface Achievement {
  kind: 'first' | 'effort' | 'longest' | 'climb' | 'steps';
  // 1 = gold (a PR or a new best), 2 = silver, 3 = bronze.
  rank: 1 | 2 | 3;
  title: string;
  detail?: string;
}

// The facts about an activity that achievements are judged on.
export interface ActivityFacts {
  distanceMeters: number;
  elevationGainMeters: number;
  steps: number | null;
  bestEfforts: BestEffort[];
}

const sameDistance = (a: number, b: number) => Math.abs(a - b) < 1;

// Compares a new activity against your earlier activities of the same type.
// Order matters: the first achievement is the one shown as the headline on the feed.
export function computeAchievements(type: ActivityType, current: ActivityFacts, previous: ActivityFacts[]): Achievement[] {
  const label = CATEGORIES[type].label.toLowerCase();
  const out: Achievement[] = [];

  if (previous.length === 0) out.push({ kind: 'first', rank: 1, title: `Your first ${label}!` });

  // Longer efforts first, since a 10K PR is a bigger deal than a 400m one.
  const efforts = [...current.bestEfforts].sort((a, b) => b.distanceMeters - a.distanceMeters);
  for (const effort of efforts) {
    const fasterBefore = previous.filter((p) =>
      p.bestEfforts.some((e) => sameDistance(e.distanceMeters, effort.distanceMeters) && e.seconds < effort.seconds),
    ).length;
    const rank = fasterBefore + 1;
    if (rank > 3) continue;
    const name = effortName(effort.distanceMeters);
    out.push({
      kind: 'effort',
      rank: rank as 1 | 2 | 3,
      title: rank === 1 ? `PR: ${name}` : `${rank === 2 ? '2nd' : '3rd'} fastest ${name}`,
      detail: formatDuration(effort.seconds),
    });
  }

  if (previous.length > 0) {
    if (current.distanceMeters > Math.max(...previous.map((p) => p.distanceMeters))) {
      out.push({ kind: 'longest', rank: 1, title: `Longest ${label} yet`, detail: formatDistance(current.distanceMeters) });
    }
    // Ignore tiny climbs so a flat walk with 2 m of GPS noise doesn't earn a medal.
    if (
      current.elevationGainMeters >= 10 &&
      current.elevationGainMeters > Math.max(...previous.map((p) => p.elevationGainMeters))
    ) {
      out.push({ kind: 'climb', rank: 1, title: 'Biggest climb yet', detail: `${Math.round(current.elevationGainMeters)} m` });
    }
    if (current.steps && current.steps > Math.max(...previous.map((p) => p.steps ?? 0))) {
      out.push({ kind: 'steps', rank: 1, title: `Most steps in a ${label}`, detail: `${formatSteps(current.steps)} steps` });
    }
  }
  return out;
}
