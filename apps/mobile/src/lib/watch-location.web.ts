import type { Reading } from '@/lib/watch-location';

// Web app version of watchLocation. expo-location's web version doesn't ask the browser for
// high accuracy when watching, so phones answer with rough Wi-Fi/cell positions that the
// recorder rightly throws away. This asks for real GPS accuracy and fresh readings.

export async function watchLocation(
  options: { distanceInterval: number; timeInterval?: number },
  onReading: (r: Reading) => void,
): Promise<{ remove: () => void }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return { remove: () => {} };
  const id = navigator.geolocation.watchPosition(
    (pos) =>
      onReading({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        altitude: pos.coords.altitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      }),
    () => {},
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
  );
  return { remove: () => navigator.geolocation.clearWatch(id) };
}
