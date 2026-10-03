import { describe, expect, it } from 'vitest';

import {
  challengeDays,
  createActivitySchema,
  createCustomChallengeSchema,
  defaultActivityTitle,
  describeCustomChallenge,
  formatChallengeDate,
  formatChallengeValue,
  formatDistance,
  formatDuration,
  formatDurationShort,
  formatPace,
  formatPaceOrSpeed,
  registerSchema,
  speakDuration,
} from '../src';

describe('formatting numbers for people', () => {
  it('formats distances, durations, pace and speed', () => {
    expect(formatDistance(5234)).toBe('5.23 km');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(185)).toBe('3:05');
    expect(formatDurationShort(3725)).toBe('1h 2m');
    expect(formatPace(330)).toBe('5:30 /km');
    expect(formatPace(Infinity)).toBe('--:-- /km');
    expect(formatPaceOrSpeed('run', 5000, 1500)).toBe('5:00 /km');
    expect(formatPaceOrSpeed('ride', 20000, 2400)).toBe('30.0 km/h');
    expect(formatPaceOrSpeed('run', 0, 60)).toBe('--:-- /km');
  });

  it('speaks durations naturally for voice updates', () => {
    expect(speakDuration(330)).toBe('5 minutes 30 seconds');
    expect(speakDuration(61)).toBe('1 minute 1 second');
    expect(speakDuration(3600)).toBe('1 hour');
    expect(speakDuration(0)).toBe('0 seconds');
  });

  it('suggests a title from the time of day', () => {
    expect(defaultActivityTitle('run', new Date(2026, 9, 5, 6, 30))).toBe('Morning Run');
    expect(defaultActivityTitle('ride', new Date(2026, 9, 5, 18, 0))).toBe('Evening Ride');
    expect(defaultActivityTitle('walk', new Date(2026, 9, 5, 23, 0))).toBe('Night Walk');
  });

  it('formats challenge goals in their own units', () => {
    expect(formatChallengeValue('distance', 50_000)).toBe('50.00 km');
    expect(formatChallengeValue('time', 400 * 60)).toBe('400 min');
    expect(formatChallengeValue('elevation', 1000)).toBe('1,000 m');
    expect(formatChallengeValue('activeDays', 1)).toBe('1 day');
    expect(formatChallengeValue('activeDays', 10)).toBe('10 days');
  });
});

describe('sign-up form', () => {
  it('lowercases the email and needs an 8-character password', () => {
    expect(registerSchema.parse({ name: ' Asha ', email: 'Asha@Example.COM', password: '12345678' })).toEqual({
      name: 'Asha', email: 'asha@example.com', password: '12345678',
    });
    expect(registerSchema.safeParse({ name: 'A', email: 'a@b.co', password: 'short' }).success).toBe(false);
    expect(registerSchema.safeParse({ name: '', email: 'a@b.co', password: '12345678' }).success).toBe(false);
  });

  it('needs at least 2 GPS points to save an activity', () => {
    const point = { lat: 1, lng: 1, alt: null, t: 1 };
    expect(createActivitySchema.safeParse({ type: 'run', title: 'x', points: [point] }).success).toBe(false);
    expect(createActivitySchema.safeParse({ type: 'run', title: 'x', points: [point, { ...point, t: 2 }] }).success).toBe(true);
    expect(createActivitySchema.safeParse({ type: 'swim', title: 'x', points: [point, point] }).success).toBe(false);
  });
});

describe('creating a challenge', () => {
  const valid = { title: 'Diwali 100K', sport: 'run', metric: 'distance', goal: 100_000, startDate: '2026-10-05', endDate: '2026-10-31' };
  const error = (input: object) => {
    const r = createCustomChallengeSchema.safeParse({ ...valid, ...input });
    return r.success ? null : r.error.issues[0].message;
  };

  it('accepts a normal challenge and adds an empty invite list', () => {
    expect(createCustomChallengeSchema.parse(valid).inviteIds).toEqual([]);
  });

  it('catches every mistake with a message people understand', () => {
    expect(error({ title: 'Hi' })).toBe('Give your challenge a name');
    expect(error({ endDate: '2026-10-01' })).toBe('The end date must be on or after the start date');
    expect(error({ endDate: '2027-02-01' })).toBe('A challenge can last up to 3 months');
    expect(error({ goal: 0 })).toBe('Set a goal');
    expect(error({ goal: 20_000_000 })).toBe('That goal is too big');
    expect(error({ metric: 'activeDays', goal: 30, endDate: '2026-10-10' })).toBe('Pick a whole number of days, up to 6');
    expect(error({ metric: 'activeDays', goal: 2.5 })).toMatch(/whole number/);
  });

  it('counts days with both ends included', () => {
    expect(challengeDays('2026-10-05', '2026-10-05')).toBe(1);
    expect(challengeDays('2026-10-05', '2026-10-31')).toBe(27);
    expect(challengeDays('2026-12-30', '2027-01-02')).toBe(4);
  });

  it('writes the description for every kind of goal', () => {
    const d = (input: object) => describeCustomChallenge({ ...valid, ...input } as Parameters<typeof describeCustomChallenge>[0]);
    expect(d({})).toBe('Run a total of 100.00 km from 5 Oct to 31 Oct.');
    expect(d({ sport: null })).toBe('Cover a total of 100.00 km (any sport) from 5 Oct to 31 Oct.');
    expect(d({ sport: 'ride', metric: 'time', goal: 600 * 60 })).toBe('Log 600 min of rides from 5 Oct to 31 Oct.');
    expect(d({ sport: 'hike', metric: 'elevation', goal: 2000 })).toBe('Climb a total of 2,000 m on hikes from 5 Oct to 31 Oct.');
    expect(d({ sport: null, metric: 'activeDays', goal: 15 })).toBe('Be active on 15 days from 5 Oct to 31 Oct.');
    expect(d({ metric: 'longest', goal: 21_097.5 })).toBe('Complete a single run of at least 21.10 km from 5 Oct to 31 Oct.');
    expect(formatChallengeDate('2027-01-09')).toBe('9 Jan');
  });
});
