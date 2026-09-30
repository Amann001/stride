import { distanceBetween, isGpsJump, type ActivityType, type TrackPoint } from '@repo/shared';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

// The heart of the app: listens to GPS while you record and keeps a live
// timer and distance. Pausing stops the timer and ignores GPS until you resume.

export type RecorderStatus = 'idle' | 'recording' | 'paused';

// Readings less accurate than this (in meters) are skipped, since they make the route jumpy.
const MAX_ACCURACY_M = 20;
// Ask for a new reading after every meter moved, so the line and distance update about
// once a second while walking (at 3 m a real walk only updated every ~3 seconds).
const DISTANCE_INTERVAL_M = 1;

export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const subscription = useRef<Location.LocationSubscription | null>(null);
  const lastPoint = useRef<TrackPoint | null>(null);
  const activityType = useRef<ActivityType>('run');
  // Timer bookkeeping: time from finished stretches plus when the current stretch began.
  const accumulatedMs = useRef(0);
  const stretchStart = useRef<number | null>(null);

  const stopWatching = useCallback(() => {
    subscription.current?.remove();
    subscription.current = null;
  }, []);

  const startWatching = useCallback(async () => {
    subscription.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: DISTANCE_INTERVAL_M },
      (loc) => {
        if (loc.coords.accuracy != null && loc.coords.accuracy > MAX_ACCURACY_M) return;
        const point: TrackPoint = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          alt: loc.coords.altitude,
          t: Math.round(loc.timestamp),
        };
        const prev = lastPoint.current;
        // Skip GPS glitches, e.g. a point that would mean walking at 25 km/h.
        if (prev && isGpsJump(prev, point, activityType.current)) return;
        if (prev) setDistance((d) => d + distanceBetween(prev, point));
        lastPoint.current = point;
        setPoints((p) => [...p, point]);
      },
    );
  }, []);

  // Ticks the on-screen timer once a second while recording.
  useEffect(() => {
    if (status !== 'recording') return;
    const id = setInterval(() => {
      const running = stretchStart.current ? Date.now() - stretchStart.current : 0;
      setElapsed(Math.floor((accumulatedMs.current + running) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  // Stop GPS if the screen is closed mid-recording.
  useEffect(() => stopWatching, [stopWatching]);

  const start = useCallback(async (type: ActivityType) => {
    setError(null);
    activityType.current = type;
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) {
      setError('Location permission is needed to record. Turn it on in Settings > Privacy > Location Services.');
      return;
    }
    setPoints([]);
    setDistance(0);
    setElapsed(0);
    lastPoint.current = null;
    accumulatedMs.current = 0;
    stretchStart.current = Date.now();
    await startWatching();
    setStatus('recording');
  }, [startWatching]);

  const pause = useCallback(() => {
    stopWatching();
    if (stretchStart.current) accumulatedMs.current += Date.now() - stretchStart.current;
    stretchStart.current = null;
    setStatus('paused');
  }, [stopWatching]);

  const resume = useCallback(async () => {
    stretchStart.current = Date.now();
    // Note: if you moved while paused, the route joins that gap with a straight line
    // (the server's stats do the same). Splitting a track into laps is a later feature.
    await startWatching();
    setStatus('recording');
  }, [startWatching]);

  // Ends the recording and hands back the collected points.
  const finish = useCallback((): TrackPoint[] => {
    stopWatching();
    setStatus('idle');
    return points;
  }, [points, stopWatching]);

  const discard = useCallback(() => {
    stopWatching();
    setStatus('idle');
    setPoints([]);
    setDistance(0);
    setElapsed(0);
  }, [stopWatching]);

  return { status, points, distance, elapsed, error, start, pause, resume, finish, discard };
}
