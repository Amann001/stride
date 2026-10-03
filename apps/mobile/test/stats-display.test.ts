import type { ActivitySummary, ActivityType } from '@repo/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { cardStats, detailStats } from '@/lib/activity-stats';
import { shortTime } from '@/lib/short-time';

const activity = (type: ActivityType, extra: Partial<ActivitySummary> = {}): ActivitySummary => ({
  id: 'a', userId: 'u', type, title: 't', description: null, startedAt: '2026-10-05T06:00:00Z',
  elapsedSeconds: 1900, movingSeconds: 1800, distanceMeters: 6000, elevationGainMeters: 120, maxSpeedMps: 9,
  steps: 5400, bestEfforts: [], achievements: [], visibility: 'followers', polyline: '', createdAt: '2026-10-05T06:40:00Z',
  athlete: { id: 'u', name: 'Asha' }, kudosCount: 0, commentCount: 0, hasKudoed: false, ...extra,
});

describe('the numbers each kind of activity leads with', () => {
  it('runs show pace, rides speed, walks steps, hikes climbing', () => {
    expect(cardStats(activity('run')).map((s) => s.label)).toEqual(['Distance', 'Pace', 'Time']);
    expect(cardStats(activity('ride')).map((s) => s.label)).toEqual(['Distance', 'Speed', 'Elev gain']);
    expect(cardStats(activity('walk')).map((s) => s.label)).toEqual(['Distance', 'Steps', 'Time']);
    expect(cardStats(activity('hike')).map((s) => s.label)).toEqual(['Distance', 'Elev gain', 'Time']);
  });

  it('shows the right values', () => {
    expect(cardStats(activity('run'))).toEqual([
      { label: 'Distance', value: '6.00 km' },
      { label: 'Pace', value: '5:00 /km' },
      { label: 'Time', value: '30m 0s' },
    ]);
  });

  it('a walk without step counts shows pace instead', () => {
    expect(cardStats(activity('walk', { steps: null }))[1].label).toBe('Pace');
  });

  it('works out running cadence (steps per minute) on the activity screen', () => {
    expect(detailStats(activity('run'), null).find((s) => s.label === 'Cadence')?.value).toBe('180 spm');
    expect(detailStats(activity('run', { steps: null }), null).some((s) => s.label === 'Cadence')).toBe(false);
  });

  it('shows the highest point for hikes when there is altitude', () => {
    expect(detailStats(activity('hike'), 1450).find((s) => s.label === 'Highest point')?.value).toBe('1450 m');
    expect(detailStats(activity('hike'), null).some((s) => s.label === 'Highest point')).toBe(false);
  });
});

describe('short times for chats and comments', () => {
  afterEach(() => vi.useRealTimers());

  it('says now, minutes, hours, then the day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T12:00:00Z'));
    expect(shortTime('2026-10-05T11:59:50Z')).toBe('now');
    expect(shortTime('2026-10-05T11:55:00Z')).toBe('5m');
    expect(shortTime('2026-10-05T09:00:00Z')).toBe('3h');
    expect(shortTime('2026-09-01T09:00:00Z')).toMatch(/Sep/);
  });
});
