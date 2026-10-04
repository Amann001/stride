"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth";

// Landing page for visitors. Logged-in users go straight to their dashboard.
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  return (
    <section className="flex flex-col items-center py-20 text-center">
      <h1 className="text-5xl font-extrabold tracking-tight">
        Record every run. <span className="text-accent">See every mile.</span>
      </h1>
      <p className="mt-4 max-w-xl text-lg text-zinc-500">
        Track your activities with the Stride app, then look back at your routes and stats here.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/login" className="rounded-lg bg-brand px-6 py-3 font-semibold text-brand-ink hover:opacity-90">
          Get started
        </Link>
        <Link href="/download" className="rounded-lg border border-zinc-400 px-6 py-3 font-semibold hover:border-accent dark:border-zinc-700">
          Get the Android app
        </Link>
      </div>
    </section>
  );
}
