// Phones with wrong time settings (a wrong time zone with the time typed in by hand) stamp
// their GPS points hours off. Uploads say what the phone's clock read when sent (`deviceNow`);
// the difference from the server's clock is how far to move the activity's times.

// Small differences are normal (the upload takes time, clocks drift a little): leave those alone.
const TOLERANCE_MS = 2 * 60_000;

// Milliseconds to add to the phone's times to get real times (0 when the phone is right).
export function clockCorrection(deviceNow: number | undefined, serverNow = Date.now()): number {
  if (deviceNow === undefined) return 0;
  const shift = serverNow - deviceNow;
  return Math.abs(shift) > TOLERANCE_MS ? Math.round(shift / 1000) * 1000 : 0;
}
