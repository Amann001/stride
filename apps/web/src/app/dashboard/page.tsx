"use client";

import {
  ACTIVITY_LABELS,
  formatDistance,
  formatDuration,
  formatPaceOrSpeed,
  paceOrSpeedLabel,
  type ActivitySummary,
} from "@repo/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Stat } from "@/components/stat";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// Your activities, newest first, with totals at the top.
export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activities, setActivities] = useState<ActivitySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    api.listActivities().then(setActivities, (err) => setError(err.message));
  }, [user, loading, router]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!activities) return <p className="text-zinc-500">Loading…</p>;

  const totalDistance = activities.reduce((sum, a) => sum + a.distanceMeters, 0);
  const totalTime = activities.reduce((sum, a) => sum + a.movingSeconds, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Hi, {user?.name}</h1>
        <div className="mt-4 flex gap-10 rounded-lg bg-white p-5 dark:bg-zinc-900">
          <Stat label="Activities" value={String(activities.length)} />
          <Stat label="Total distance" value={formatDistance(totalDistance)} />
          <Stat label="Total time" value={formatDuration(totalTime)} />
        </div>
      </div>

      {activities.length === 0 ? (
        <p className="text-zinc-500">No activities yet. Record one with the iPhone app and it will show up here.</p>
      ) : (
        <ul className="space-y-3">
          {activities.map((a) => (
            <li key={a.id}>
              <Link href={`/activities/${a.id}`} className="block rounded-lg bg-white p-5 hover:ring-2 hover:ring-brand dark:bg-zinc-900">
                <div className="text-sm text-zinc-500">
                  {ACTIVITY_LABELS[a.type]} · {new Date(a.startedAt).toLocaleString()}
                </div>
                <div className="mt-1 mb-3 text-lg font-bold">{a.title}</div>
                <div className="flex gap-10">
                  <Stat label="Distance" value={formatDistance(a.distanceMeters)} />
                  <Stat label={paceOrSpeedLabel(a.type)} value={formatPaceOrSpeed(a.type, a.distanceMeters, a.movingSeconds)} />
                  <Stat label="Time" value={formatDuration(a.movingSeconds)} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
