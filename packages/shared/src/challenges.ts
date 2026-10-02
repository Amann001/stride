import { z } from 'zod';

import { formatDistance } from './format';
import { activityTypeSchema, type ActivityType } from './schemas';

// Monthly challenges, like "October 50K Run". Every month gets a fresh set made from these
// templates. Progress is worked out from your activities in that month, so nothing needs
// to be entered by hand: join, go out, and watch the bar fill up.

export type ChallengeMetric = 'distance' | 'time' | 'elevation' | 'activeDays' | 'longest';

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
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  // Empty text clears these.
  bio: z.string().trim().max(300).optional(),
  location: z.string().trim().max(80).optional(),
});

export type WeeklyGoalInput = z.infer<typeof weeklyGoalSchema>;
export type ManualActivityInput = z.infer<typeof manualActivitySchema>;
