import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { MAX_ACCURACY_M } from '@/lib/use-recorder';

export type GpsSignal = 'searching' | 'ready' | 'denied';

// Before you press Start: is the GPS accurate enough to record yet? Listens only while
// `enabled` (the Record screen is open and not recording), to save battery.
export function useGpsSignal(enabled: boolean): GpsSignal {
  const [signal, setSignal] = useState<GpsSignal>('searching');

  useEffect(() => {
    if (!enabled) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (!granted) {
        setSignal('denied');
        return;
      }
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        (loc) => setSignal(loc.coords.accuracy != null && loc.coords.accuracy <= MAX_ACCURACY_M ? 'ready' : 'searching'),
      );
      if (cancelled) sub.remove();
      else subscription = sub;
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);

  return signal;
}
