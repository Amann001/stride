import type { ActivityType } from './schemas';

// What makes each kind of activity different. The API uses this to analyse tracks and
// award achievements; the apps use it to pick which stats to show and when to speak.

export interface CategoryConfig {
  label: string;
  // Runners, walkers and hikers think in pace (min/km), cyclists in speed (km/h).
  metric: 'pace' | 'speed';
  // Length of one split (and one voice update while recording), in meters.
  splitMeters: number;
  // Fastest believable speed in km/h. GPS points implying more than this are glitches.
  maxSpeedKmh: number;
  // Distances we track your fastest time over, in meters (e.g. your best 5K).
  bestEffortDistances: number[];
  // Whether we count steps with the phone's motion sensor while recording.
  countsSteps: boolean;
}

export const CATEGORIES: Record<ActivityType, CategoryConfig> = {
  run: {
    label: 'Run',
    metric: 'pace',
    splitMeters: 1000,
    maxSpeedKmh: 40,
    bestEffortDistances: [400, 1000, 1609.34, 5000, 10000, 21097.5, 42195],
    countsSteps: true,
  },
  ride: {
    label: 'Ride',
    metric: 'speed',
    splitMeters: 5000,
    maxSpeedKmh: 100,
    bestEffortDistances: [5000, 10000, 20000, 40000, 100000],
    countsSteps: false,
  },
  walk: {
    label: 'Walk',
    metric: 'pace',
    splitMeters: 1000,
    maxSpeedKmh: 15,
    bestEffortDistances: [1000, 5000, 10000],
    countsSteps: true,
  },
  hike: {
    label: 'Hike',
    metric: 'pace',
    splitMeters: 1000,
    maxSpeedKmh: 15,
    // Hikes are about the climb, not the clock, so no timed efforts.
    bestEffortDistances: [],
    countsSteps: true,
  },
};

// 5000 -> "5K", 1609.34 -> "1 mile", 21097.5 -> "Half marathon"
export function effortName(meters: number): string {
  if (Math.abs(meters - 1609.34) < 1) return '1 mile';
  if (Math.abs(meters - 21097.5) < 1) return 'Half marathon';
  if (Math.abs(meters - 42195) < 1) return 'Marathon';
  return meters < 1000 ? `${meters}m` : `${meters / 1000}K`;
}
