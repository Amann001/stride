"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth";

// What the app looks like, from real screens with sample people and activities.
const SCREENS = [
  { src: "/showcase/progress.webp", caption: "Your progress: weekly totals, a 12-week chart and your streak" },
  { src: "/showcase/challenges.webp", caption: "Monthly challenges, and your own with invites" },
  { src: "/showcase/leaderboard.webp", caption: "A challenge leaderboard with friends" },
  { src: "/showcase/notifications.webp", caption: "Kudos, comments, follows and invites" },
  { src: "/showcase/club.webp", caption: "Clubs with a weekly leaderboard" },
];

const FEATURES = [
  {
    title: "Record with GPS",
    text: "Runs, rides, walks and hikes, with live pace, voice updates, splits, elevation and personal records. Runs recorded offline upload later.",
  },
  {
    title: "Friends",
    text: "Follow people, see their activities in your feed, give kudos, comment and chat. Find friends by name or QR code.",
  },
  {
    title: "Challenges",
    text: "New challenges every month, or create your own with any goal and dates and invite friends, free.",
  },
  {
    title: "Clubs",
    text: "Groups for a sport and a place, with a weekly distance leaderboard and members' activities.",
  },
  {
    title: "Maps and heatmaps",
    text: "Your routes, suggested routes, routes you draw, and heatmaps of where people go. Standard, Dark and Satellite maps.",
  },
  {
    title: "Private by default",
    text: "Activities start as Followers only, the first and last 200 m of every route stay hidden, and there are no ads or trackers.",
  },
];

const NUMBERS = [
  { value: "147", label: "automated tests on every change" },
  { value: "~75", label: "API endpoints" },
  { value: "22", label: "database tables" },
  { value: "₹0", label: "to run, all on free services" },
];

const STACK = ["React Native", "Expo", "TypeScript", "Node.js", "Fastify", "PostgreSQL", "Next.js", "Tailwind CSS", "Vitest", "GitHub Actions"];

// Landing page for visitors: what Stride is, what it looks like, and how it's built.
// Logged-in users go straight to their dashboard.
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  return (
    <div className="pb-8">
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
          {/* The full app in the browser (a plain link: /app is the web app, not a page of this site). */}
          <a href="/app" className="rounded-lg border border-zinc-400 px-6 py-3 font-semibold hover:border-accent dark:border-zinc-700">
            Open the web app
          </a>
          <Link href="/download" className="rounded-lg border border-zinc-400 px-6 py-3 font-semibold hover:border-accent dark:border-zinc-700">
            Get the Android app
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold">Inside the app</h2>
        <p className="mt-1 text-zinc-500">Real screens from the Android app, shown with sample people and activities.</p>
        {/* Scrolls sideways on phones; on wider screens the five sit side by side. */}
        <div className="mt-6 -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
          {SCREENS.map((s) => (
            <figure key={s.src} className="w-44 shrink-0 snap-start sm:w-auto">
              <Image
                src={s.src}
                alt={s.caption}
                width={560}
                height={1212}
                className="h-auto w-full rounded-2xl border border-zinc-300 dark:border-zinc-800"
              />
              <figcaption className="mt-2 text-sm text-zinc-500">{s.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold">What it does</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-zinc-300 p-5 dark:border-zinc-800">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-zinc-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold">How it&rsquo;s built</h2>
        <p className="mt-1 max-w-2xl text-zinc-500">
          An Android and iPhone app, this website and a server that share one package of rules. The server checks every
          request and works out distance, pace, splits and records from the raw GPS itself.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {NUMBERS.map((n) => (
            <div key={n.label} className="rounded-xl bg-white p-5 dark:bg-zinc-900">
              <div className="text-3xl font-extrabold text-accent">{n.value}</div>
              <div className="mt-1 text-sm text-zinc-500">{n.label}</div>
            </div>
          ))}
        </div>
        <ul className="mt-6 flex flex-wrap gap-2">
          {STACK.map((t) => (
            <li key={t} className="rounded-full border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700">
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16 rounded-2xl bg-brand-ink p-8 text-center text-white">
        <h2 className="text-2xl font-bold">Try Stride</h2>
        <p className="mt-2 text-zinc-400">
          Free, with no ads. Install it on Android, or open the web app in Safari or Chrome on any phone or computer.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href="/app" className="rounded-lg bg-brand px-6 py-3 font-semibold text-brand-ink hover:opacity-90">
            Open the web app
          </a>
          <Link href="/download" className="rounded-lg border border-zinc-600 px-6 py-3 font-semibold hover:border-brand">
            Get the Android app
          </Link>
          <Link href="/login" className="rounded-lg border border-zinc-600 px-6 py-3 font-semibold hover:border-brand">
            Log in or sign up
          </Link>
        </div>
      </section>
    </div>
  );
}
