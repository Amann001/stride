"use client";

import {
  ACTIVITY_LABELS,
  formatDistance,
  formatDuration,
  formatPaceOrSpeed,
  paceOrSpeedLabel,
  type ActivityDetail,
} from "@repo/shared";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Stat } from "@/components/stat";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const RouteMap = dynamic(() => import("@/components/route-map"), {
  ssr: false,
  loading: () => <div className="h-80 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />,
});

// One activity: map of the route and all its stats.
export default function ActivityPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    api.getActivity(id).then(setActivity, (err) => setError(err.message));
  }, [id, user, loading, router]);

  const remove = async () => {
    if (!confirm("Delete this activity? This cannot be undone.")) return;
    await api.deleteActivity(id);
    router.push("/dashboard");
  };

  if (error) return <p className="text-red-600">{error}</p>;
  if (!activity) return <p className="text-zinc-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-zinc-500">
          {ACTIVITY_LABELS[activity.type]} · {new Date(activity.startedAt).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
        </div>
        <h1 className="text-3xl font-bold">{activity.title}</h1>
        {activity.description && <p className="mt-2">{activity.description}</p>}
      </div>

      <RouteMap coords={activity.points} />

      <div className="grid grid-cols-2 gap-6 rounded-lg bg-white p-5 sm:grid-cols-3 dark:bg-zinc-900">
        <Stat label="Distance" value={formatDistance(activity.distanceMeters)} />
        <Stat label={paceOrSpeedLabel(activity.type)} value={formatPaceOrSpeed(activity.type, activity.distanceMeters, activity.movingSeconds)} />
        <Stat label="Moving time" value={formatDuration(activity.movingSeconds)} />
        <Stat label="Elapsed time" value={formatDuration(activity.elapsedSeconds)} />
        <Stat label="Elevation gain" value={`${activity.elevationGainMeters} m`} />
        <Stat label="GPS points" value={String(activity.points.length)} />
      </div>

      <button onClick={remove} className="text-sm font-semibold text-red-600 hover:underline">
        Delete activity
      </button>
    </div>
  );
}
