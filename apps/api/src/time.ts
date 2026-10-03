import { z } from 'zod';

// Weeks and months follow the user's own time zone. The phone sends it (e.g.
// "Asia/Kolkata"); anything we don't recognise falls back to UTC.

export const tzQuery = z.object({ tz: z.string().max(64).optional() });

export function safeTimeZone(tz: string | undefined): string {
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

// The current month in that time zone, as "2026-10".
export function currentMonth(tz: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).format(new Date());
}

// Today's date in that time zone, as "2026-10-05".
export function todayIn(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const DAY_MS = 86_400_000;

// "2026-10-05" plus a number of days, as another "YYYY-MM-DD".
export function addDays(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
