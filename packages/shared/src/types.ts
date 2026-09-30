import type { Achievement, BestEffort } from './analysis';
import type { Challenge } from './challenges';
import type { ActivityType, TrackPoint, Visibility } from './schemas';

// The shapes the API sends back. Both apps import these so they always agree.

export interface User {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  location: string | null;
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
  visibility: Visibility;
  // Encoded route line (Google polyline format), enough to draw a small map.
  polyline: string;
  createdAt: string;
  // Who did it, and the social bits shown on feed cards.
  athlete: { id: string; name: string };
  kudosCount: number;
  commentCount: number;
  hasKudoed: boolean;
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

// Totals for one Monday-to-Sunday week.
export interface WeekTotals extends Totals {
  weekStart: string; // YYYY-MM-DD, a Monday
}

export interface CategoryStats {
  thisWeek: Totals;
  thisYear: Totals;
  allTime: Totals;
  // The last 12 weeks, oldest first, ending with this week.
  weeks: WeekTotals[];
  // Your fastest and second-fastest time (seconds) for each best-effort distance.
  bestEfforts: (PersonalRecord & { distanceMeters: number; rank: 1 | 2 })[];
  longest: PersonalRecord | null;
  biggestClimb: PersonalRecord | null;
  // Weekly distance goal in meters, or null if you haven't set one.
  weeklyGoalMeters: number | null;
}

export interface UserStats {
  // Weeks in a row (Monday to Sunday) with at least one activity. This week counts
  // once you've logged something; until then the streak from last week stays alive.
  streakWeeks: number;
  // Which days of this week (Monday first) have an activity.
  activeDays: boolean[];
  // Every day (YYYY-MM-DD, your time zone) with an activity, from the start of last month.
  activeDates: string[];
  activityCount: number;
  thisWeek: Totals;
  weeks: WeekTotals[];
  byType: Record<ActivityType, CategoryStats>;
}

export interface ChallengesResponse {
  // This month's challenges.
  current: Challenge[];
  // Challenges you joined and finished, any month. These go in your trophy case.
  completed: Challenge[];
}
