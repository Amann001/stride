import { afterAll, describe, expect, it, vi } from 'vitest';

// The phone's settings, faked: an Indian phone.
vi.mock('expo-localization', () => ({ getCalendars: () => [{ timeZone: 'Asia/Kolkata' }] }));

// Run these as if the phone's clock is set to India time.
const originalTz = process.env.TZ;
process.env.TZ = 'Asia/Kolkata';
afterAll(() => {
  process.env.TZ = originalTz;
});

const dates = await import('@/lib/dates');

// The follow from the bug report: saved by the server at 08:59 UTC, which is 2:29 pm in India.
const FOLLOW = '2026-10-04T08:59:04.840Z';

describe('dates and times in the phone\'s own time zone', () => {
  it('shows the follow at 2:29 pm, not 1:59 am', () => {
    expect(dates.formatTime(FOLLOW)).toBe('2:29 pm');
    expect(dates.formatDateTime(FOLLOW)).toBe('4 Oct 2026, 2:29 pm');
  });

  it('has every style the app uses', () => {
    expect(dates.formatDate(FOLLOW)).toBe('4 Oct 2026');
    expect(dates.formatLongDateTime(FOLLOW)).toBe('4 October 2026 at 2:29 pm');
    expect(dates.formatFullDateTime(FOLLOW)).toBe('Sunday, 4 October 2026 at 2:29 pm');
    expect(dates.formatWeekdayTime(FOLLOW)).toBe('Sun 2:29 pm');
    expect(dates.formatDayMonth(FOLLOW)).toBe('4 Oct');
    expect(dates.monthName(FOLLOW)).toBe('October');
  });

  it('gets midnight, noon and the date change right', () => {
    expect(dates.formatTime('2026-10-04T18:30:00Z')).toBe('12:00 am'); // midnight in India
    expect(dates.formatDate('2026-10-04T18:30:00Z')).toBe('5 Oct 2026'); // already the next day there
    expect(dates.formatTime('2026-10-04T06:30:00Z')).toBe('12:00 pm');
    expect(dates.formatTime('2026-10-04T03:35:00Z')).toBe('9:05 am');
  });

  it("sends the server the phone's real time zone", () => {
    expect(dates.deviceTimeZone()).toBe('Asia/Kolkata');
  });
});

describe('a phone with wrong time settings', () => {
  it("shows server times the way the phone's own clock would", async () => {
    const clock = await import('@/lib/clock');
    // The phone reads 12½ hours ahead of the server's real time.
    const real = Date.parse('2026-10-04T09:00:00Z');
    clock.noteServerTime(new Date(real).toUTCString(), real + 12.5 * 3600_000 - 300, real + 12.5 * 3600_000 + 300);
    expect(clock.clockSkew()).toBe(12.5 * 3600_000);
    // In India time 08:59 UTC is 2:29 pm; this phone shows it 12½ hours later on its own clock.
    expect(dates.formatTime(FOLLOW)).toBe('2:59 am');
    // A phone that's right (within 2 minutes) is left alone.
    clock.noteServerTime(new Date(real).toUTCString(), real + 60_000, real + 61_000);
    expect(clock.clockSkew()).toBe(0);
    expect(dates.formatTime(FOLLOW)).toBe('2:29 pm');
  });
});
