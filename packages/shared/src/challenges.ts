import { z } from 'zod';

import { formatDistance } from './format';
import { activityTypeSchema, type ActivityType } from './schemas';
import type { AthleteRef } from './social';

// Monthly challenges, like "October 50K Run". Every month gets a fresh set made from these
// templates. Progress is worked out from your activities in that month, so nothing needs
// to be entered by hand: join, go out, and watch the bar fill up.
// People can also create their own challenge with any dates and invite friends to it.

export const CHALLENGE_METRICS = ['distance', 'time', 'elevation', 'activeDays', 'longest'] as const;
export type ChallengeMetric = (typeof CHALLENGE_METRICS)[number];

export interface ChallengeTemplate {
  key: string;
  // Which activities count. Null means every kind counts.
  sport: ActivityType | null;
  metric: ChallengeMetric;
  // Meters for distance, elevation and longest; seconds for time; days for activeDays.
  goal: number;
  // "{month}" is replaced with the month's name, e.g. "October".
  title: string;
  description: string;
}

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  { key: 'run-5k', sport: 'run', metric: 'longest', goal: 5000, title: '{month} 5K',
    description: 'Complete a single run of at least 5 km in {month}.' },
  { key: 'run-50k', sport: 'run', metric: 'distance', goal: 50_000, title: '{month} 50K Run',
    description: 'Run a total of 50 km in {month}.' },
  { key: 'ride-200k', sport: 'ride', metric: 'distance', goal: 200_000, title: '{month} 200K Ride',
    description: 'Ride a total of 200 km in {month}.' },
  { key: 'walk-30k', sport: 'walk', metric: 'distance', goal: 30_000, title: '{month} Walking Challenge',
    description: 'Walk a total of 30 km in {month}.' },
  { key: 'hike-1000m', sport: 'hike', metric: 'elevation', goal: 1000, title: '{month} 1,000 m Climb',
    description: 'Climb a total of 1,000 m on hikes in {month}.' },
  { key: 'any-400min', sport: null, metric: 'time', goal: 400 * 60, title: '{month} 400-Minute Challenge',
    description: 'Log 400 minutes of activity in {month}. Every sport counts.' },
  { key: 'any-10days', sport: null, metric: 'activeDays', goal: 10, title: '{month} 10 Active Days',
    description: 'Be active on 10 different days in {month}. Every sport counts.' },
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];

// "2026-10" -> "October"
export function monthName(month: string): string {
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? month;
}

// Challenge ids look like "2026-10:run-50k": the month it runs in, then the template.
export const challengeIdSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2]):[a-z0-9-]+$/)
  .refine((id) => CHALLENGE_TEMPLATES.some((t) => t.key === id.slice(8)), 'Unknown challenge');

export function challengeId(month: string, key: string): string {
  return `${month}:${key}`;
}

export function parseChallengeId(id: string): { month: string; template: ChallengeTemplate } | null {
  const template = CHALLENGE_TEMPLATES.find((t) => t.key === id.slice(8));
  return template && /^\d{4}-\d{2}$/.test(id.slice(0, 7)) ? { month: id.slice(0, 7), template } : null;
}

export interface Challenge {
  id: string;
  month: string;
  sport: ActivityType | null;
  metric: ChallengeMetric;
  goal: number;
  title: string;
  description: string;
  joined: boolean;
  progress: number;
  completed: boolean;
  // How many Stride athletes have joined.
  participants: number;
  // Set for a challenge someone created; null for the monthly ones.
  custom: CustomChallengeInfo | null;
}

export interface CustomChallengeInfo {
  // First and last day it counts (YYYY-MM-DD), both included.
  startDate: string;
  endDate: string;
  creator: AthleteRef;
  // You've been invited and haven't answered yet.
  invited: boolean;
  status: 'upcoming' | 'active' | 'ended';
}

export interface ChallengeLeader {
  athlete: AthleteRef;
  progress: number;
  completed: boolean;
}

// A created challenge's own page.
export interface CustomChallengeDetail extends Challenge {
  custom: CustomChallengeInfo;
  isCreator: boolean;
  // Everyone who joined, furthest along first.
  leaderboard: ChallengeLeader[];
  // Invited people who haven't answered yet.
  invited: AthleteRef[];
}

// ---------- Creating your own challenge ----------

export const CHALLENGE_METRIC_LABELS: Record<ChallengeMetric, string> = {
  distance: 'Total distance',
  time: 'Total time',
  elevation: 'Total climb',
  activeDays: 'Active days',
  longest: 'One long activity',
};

export const CUSTOM_CHALLENGE_MAX_DAYS = 92;
export const CUSTOM_CHALLENGE_MAX_MEMBERS = 50;

// The biggest goal allowed for each kind (same units as `goal`).
const MAX_GOAL: Record<ChallengeMetric, number> = {
  distance: 10_000_000,
  time: 1000 * 3600,
  elevation: 200_000,
  activeDays: CUSTOM_CHALLENGE_MAX_DAYS,
  longest: 1_000_000,
};

// How many days from `start` to `end` (YYYY-MM-DD), counting both.
export function challengeDays(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

export const createCustomChallengeSchema = z
  .object({
    title: z.string().trim().min(3, 'Give your challenge a name').max(60),
    // Null means every sport counts.
    sport: activityTypeSchema.nullable(),
    metric: z.enum(CHALLENGE_METRICS),
    goal: z.number().positive('Set a goal'),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    inviteIds: z.array(z.uuid()).max(CUSTOM_CHALLENGE_MAX_MEMBERS - 1).default([]),
  })
  .superRefine((c, ctx) => {
    const days = challengeDays(c.startDate, c.endDate);
    if (days < 1) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'The end date must be on or after the start date' });
    if (days > CUSTOM_CHALLENGE_MAX_DAYS) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'A challenge can last up to 3 months' });
    if (c.goal > MAX_GOAL[c.metric]) ctx.addIssue({ code: 'custom', path: ['goal'], message: 'That goal is too big' });
    if (c.metric === 'activeDays' && (!Number.isInteger(c.goal) || c.goal > days)) {
      ctx.addIssue({ code: 'custom', path: ['goal'], message: `Pick a whole number of days, up to ${Math.max(days, 1)}` });
    }
  });

export const inviteToChallengeSchema = z.object({ ids: z.array(z.uuid()).min(1).max(CUSTOM_CHALLENGE_MAX_MEMBERS - 1) });

export type CreateCustomChallengeInput = z.infer<typeof createCustomChallengeSchema>;

const SPORT_WORDS: Record<ActivityType, { verb: string; noun: string }> = {
  run: { verb: 'Run', noun: 'run' },
  ride: { verb: 'Ride', noun: 'ride' },
  walk: { verb: 'Walk', noun: 'walk' },
  hike: { verb: 'Hike', noun: 'hike' },
};
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-10-05" -> "5 Oct"
export function formatChallengeDate(isoDate: string): string {
  return `${Number(isoDate.slice(8, 10))} ${SHORT_MONTHS[Number(isoDate.slice(5, 7)) - 1] ?? ''}`;
}

// What a created challenge asks, e.g. "Run a total of 100 km from 5 Oct to 31 Oct."
export function describeCustomChallenge(c: {
  sport: ActivityType | null; metric: ChallengeMetric; goal: number; startDate: string; endDate: string;
}): string {
  const words = c.sport ? SPORT_WORDS[c.sport] : null;
  const goal = formatChallengeValue(c.metric, c.goal);
  const what = {
    distance: words ? `${words.verb} a total of ${goal}` : `Cover a total of ${goal} (any sport)`,
    time: `Log ${goal} of ${words ? `${words.noun}s` : 'activity'}`,
    elevation: `Climb a total of ${goal}${words ? ` on ${words.noun}s` : ''}`,
    activeDays: words ? `${words.verb} on ${goal}` : `Be active on ${goal}`,
    longest: `Complete a single ${words?.noun ?? 'activity'} of at least ${goal}`,
  }[c.metric];
  return `${what} from ${formatChallengeDate(c.startDate)} to ${formatChallengeDate(c.endDate)}.`;
}

// Progress or goal as text: "12.30 km", "250 min", "4 days", "320 m".
export function formatChallengeValue(metric: ChallengeMetric, value: number): string {
  switch (metric) {
    case 'distance':
    case 'longest':
      return formatDistance(value);
    case 'time':
      return `${Math.floor(value / 60)} min`;
    case 'elevation':
      return `${Math.round(value).toLocaleString('en-US')} m`;
    case 'activeDays':
      return `${value} ${value === 1 ? 'day' : 'days'}`;
  }
}

// ---------- Weekly goals and manual activities ----------

export const weeklyGoalSchema = z.object({
  // 0 removes the goal.
  targetMeters: z.number().min(0).max(2_000_000),
});

// An activity typed in by hand (e.g. a treadmill run), with no GPS track.
export const manualActivitySchema = z.object({
  type: activityTypeSchema,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  startedAt: z.iso.datetime(),
  elapsedSeconds: z.number().int().min(1).max(7 * 86_400),
  distanceMeters: z.number().min(0).max(1_000_000),
  elevationGainMeters: z.number().min(0).max(20_000).default(0),
  // The phone's clock (ms) when it sent this. If it's off from real time (wrong time settings),
  // the server shifts the activity's times by the difference. Older app versions leave it out.
  deviceNow: z.number().int().positive().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  // Empty text clears these.
  bio: z.string().trim().max(300).optional(),
  location: z.string().trim().max(80).optional(),
});

export type WeeklyGoalInput = z.infer<typeof weeklyGoalSchema>;
export type ManualActivityInput = z.infer<typeof manualActivitySchema>;
