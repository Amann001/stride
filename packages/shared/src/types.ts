import type { Achievement, BestEffort } from './analysis';
import type { ActivityType, TrackPoint } from './schemas';

// The shapes the API sends back. Both apps import these so they always agree.

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// What an activity looks like in a list (no GPS points, to keep it small).
export interface ActivitySummary {
  id: string;
  userId: string;
  type: ActivityType;
  title: string;
  description: string | null;
  startedAt: string;
  elapsedSeconds: number;
  movingSeconds: number;
  distanceMeters: number;
  elevationGainMeters: number;
  // Highest speed held for 10+ seconds, in meters per second.
  maxSpeedMps: number;
  // Null for rides, or if the phone had no step counter.
  steps: number | null;
  bestEfforts: BestEffort[];
  // Worked out when the activity was saved, compared with your earlier ones.
  achievements: Achievement[];
  // Encoded route line (Google polyline format), enough to draw a small map.
  polyline: string;
  createdAt: string;
}

// A single activity with all its GPS points.
export interface ActivityDetail extends ActivitySummary {
  points: TrackPoint[];
}

export interface Totals {
  count: number;
  distanceMeters: number;
  movingSeconds: number;
  elevationGainMeters: number;
}

// Your all-time best for something, and which activity it came from.
export interface PersonalRecord {
  activityId: string;
  startedAt: string;
  value: number;
}

export interface CategoryStats {
  thisWeek: Totals;
  allTime: Totals;
  // Fastest time (seconds) for each best-effort distance, keyed by meters.
  bestEfforts: (PersonalRecord & { distanceMeters: number })[];
  longest: PersonalRecord | null;
  biggestClimb: PersonalRecord | null;
}

export interface UserStats {
  // Weeks in a row (Monday to Sunday) with at least one activity. This week counts
  // once you've logged something; until then the streak from last week stays alive.
  streakWeeks: number;
  // Which days of this week (Monday first) have an activity.
  activeDays: boolean[];
  thisWeek: Totals;
  byType: Record<ActivityType, CategoryStats>;
}
