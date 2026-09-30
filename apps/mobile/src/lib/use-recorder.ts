import { CATEGORIES, distanceBetween, isGpsJump, type ActivityType, type TrackPoint } from '@repo/shared';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';

// The heart of the app: listens to GPS while you record and keeps a live
// timer and distance. Pausing stops the timer and ignores GPS until you resume.
// For runs, walks and hikes it also counts steps with the phone's motion sensor.

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
  // Clock time of the latest timer tick, for "how fast am I going right now".
  const [clock, setClock] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Null when not counting (rides), or if the phone has no step counter or said no.
  const [steps, setSteps] = useState<number | null>(null);

  const subscription = useRef<Location.LocationSubscription | null>(null);
  const lastPoint = useRef<TrackPoint | null>(null);
  const activityType = useRef<ActivityType>('run');
  // Timer bookkeeping: time from finished stretches plus when the current stretch began.
  const accumulatedMs = useRef(0);
  const stretchStart = useRef<number | null>(null);
  // Step bookkeeping: the step counter restarts from 0 on every resume, so we add
  // each stretch's count onto the steps from earlier stretches.
  const stepSubscription = useRef<{ remove: () => void } | null>(null);
  const stepsBefore = useRef(0);
  const stepsNow = useRef(0);
  const countingSteps = useRef(false);

  const stopWatching = useCallback(() => {
    subscription.current?.remove();
    subscription.current = null;
    stepSubscription.current?.remove();
    stepSubscription.current = null;
    stepsBefore.current = stepsNow.current;
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
    if (countingSteps.current) {
      const before = stepsBefore.current;
      stepSubscription.current = Pedometer.watchStepCount((result) => {
        stepsNow.current = before + result.steps;
        setSteps(stepsNow.current);
      });
    }
  }, []);

  // Ticks the on-screen timer once a second while recording.
  useEffect(() => {
    if (status !== 'recording') return;
    const id = setInterval(() => {
      const now = Date.now();
      const running = stretchStart.current ? now - stretchStart.current : 0;
      setElapsed(Math.floor((accumulatedMs.current + running) / 1000));
      setClock(now);
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
    // Steps are a bonus: if the phone can't count them or you say no, we record without them.
    countingSteps.current =
      CATEGORIES[type].countsSteps &&
      (await Pedometer.isAvailableAsync().catch(() => false)) &&
      (await Pedometer.requestPermissionsAsync().catch(() => ({ granted: false }))).granted;
    stepsBefore.current = 0;
    stepsNow.current = 0;
    setSteps(countingSteps.current ? 0 : null);
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

  // Ends the recording and hands back the collected points and step count.
  const finish = useCallback((): { points: TrackPoint[]; steps: number | null } => {
    stopWatching();
    setStatus('idle');
    return { points, steps: countingSteps.current ? stepsNow.current : null };
  }, [points, stopWatching]);

  const discard = useCallback(() => {
    stopWatching();
    setStatus('idle');
    setPoints([]);
    setDistance(0);
    setElapsed(0);
    setSteps(null);
  }, [stopWatching]);

  return { status, points, distance, elapsed, clock, steps, error, start, pause, resume, finish, discard };
}
