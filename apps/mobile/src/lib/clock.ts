// How far the phone's clock is from real time.
//
// Some phones have the wrong time zone with the time typed in by hand: the clock on the screen
// looks right, but the phone's idea of "now" is hours off (a phone set to California time, its
// clock moved to show India's time, is 12½ hours ahead). Every answer from the server carries
// the real time (its Date header), so the app learns the difference and:
// - sends the phone's "now" with each upload, so the server can put the activity's times right;
// - shows times from the server the way the phone's own clock would, so they match its screen.

// Ignore small differences: the server's clock has 1-second steps and requests take time.
const IGNORE_MS = 2 * 60_000;

let skewMs = 0;

// Called with the Date header of a server answer, and the phone's clock before and after the request.
export function noteServerTime(dateHeader: string | null, sentAt: number, receivedAt: number) {
  const server = dateHeader ? Date.parse(dateHeader) : NaN;
  if (!Number.isFinite(server)) return;
  const skew = (sentAt + receivedAt) / 2 - server;
  skewMs = Math.abs(skew) > IGNORE_MS ? Math.round(skew / 1000) * 1000 : 0;
}

// Phone clock minus real time, in milliseconds (0 when the phone is right).
export function clockSkew(): number {
  return skewMs;
}

// A time from the server (ISO text) as the phone's own clock would show it.
export function toPhoneTime(iso: string): Date {
  return new Date(Date.parse(iso) + skewMs);
}
