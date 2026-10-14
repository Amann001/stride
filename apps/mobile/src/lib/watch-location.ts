import * as Location from 'expo-location';

// Follow the phone's GPS. On iPhone and Android this is expo-location, as before;
// watch-location.web.ts is the web app's version.

export interface Reading {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  timestamp: number;
}

export async function watchLocation(
  options: { distanceInterval: number; timeInterval?: number },
  onReading: (r: Reading) => void,
): Promise<{ remove: () => void }> {
  return Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, ...options }, (loc) =>
    onReading({ ...loc.coords, timestamp: loc.timestamp }),
  );
}
