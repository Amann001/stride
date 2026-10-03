import type { ActivityType, ChallengeMetric } from '@repo/shared';

// Someone's totals for one kind of activity over a challenge's dates.
export interface TotalsRow {
  type: ActivityType;
  distance: number;
  moving: number;
  elev: number;
  longest: number;
  days: string[];
}

// The SQL columns that make a TotalsRow, for activities `a`, with days in time zone `tz`.
export const TOTALS_COLUMNS = (tz: string) => `a.type,
  sum(a.distance_meters)::float AS distance,
  sum(a.moving_seconds)::float AS moving,
  sum(a.elevation_gain_meters)::float AS elev,
  max(a.distance_meters)::float AS longest,
  array_agg(DISTINCT to_char(a.started_at AT TIME ZONE ${tz}, 'YYYY-MM-DD')) AS days`;

// How far along a challenge is, in its own units (meters, seconds or days).
export function progressFor(challenge: { sport: ActivityType | null; metric: ChallengeMetric }, rows: TotalsRow[]): number {
  const counted = rows.filter((r) => challenge.sport === null || r.type === challenge.sport);
  const sum = (f: (r: TotalsRow) => number) => counted.reduce((n, r) => n + f(r), 0);
  switch (challenge.metric) {
    case 'distance':
      return sum((r) => r.distance);
    case 'time':
      return sum((r) => r.moving);
    case 'elevation':
      return sum((r) => r.elev);
    case 'longest':
      return Math.max(0, ...counted.map((r) => r.longest));
    case 'activeDays':
      return new Set(counted.flatMap((r) => r.days)).size;
  }
}
