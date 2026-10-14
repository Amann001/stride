import type { Metadata } from "next";
import Link from "next/link";

import { ANDROID_APP } from "@/lib/android-app";
import { API_URL } from "@/lib/api";

export const metadata: Metadata = {
  title: "Get Stride for Android",
  description: "Download the Stride app for Android: record runs, rides, walks and hikes, and follow friends.",
};

// The web app (/app) works on any phone: added to the Home Screen it opens full screen with
// its own icon, like an installed app.
const WEB_APP_STEPS = [
  { title: "Open the web app in Safari", text: "Go to stride-amanswamy.vercel.app/app and log in or sign up." },
  { title: "Tap Share, then “Add to Home Screen”", text: "On Android in Chrome: tap ⋮, then “Add to Home screen” or “Install app”." },
  { title: "Open Stride from your Home Screen", text: "It opens full screen with its own icon. Keep it open with the screen on while you record." },
];

const STEPS = [
  {
    title: "Tap Download",
    text: "Chrome may say “File might be harmful”. Tap Download anyway. Android shows this for every app that isn’t from the Play Store.",
  },
  {
    title: "Open the file",
    text: "When it finishes, tap Open. If asked, allow your browser to install unknown apps (Settings opens; switch it on, then go back).",
  },
  {
    title: "Install and log in",
    text: "Tap Install, open Stride, and log in or create an account. Allow notifications to hear about kudos, comments and invites.",
  },
];

// "Get the app": the Android download, how to install it, and why it's safe.
export default function DownloadPage() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <section className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">
          Get <span className="text-accent">Stride</span> for Android
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-zinc-500">
          Record runs, rides, walks and hikes with GPS, follow friends, join challenges, and see it all here on the
          website too.
        </p>
        <a
          href="/download/android"
          className="mt-8 inline-flex flex-col items-center rounded-xl bg-brand px-8 py-4 text-brand-ink hover:opacity-90"
        >
          <span className="text-lg font-bold">Download for Android</span>
          <span className="text-sm opacity-75">
            Version {ANDROID_APP.version} · {ANDROID_APP.sizeMb} MB · {ANDROID_APP.released}
          </span>
        </a>
        <p className="mt-3 text-sm text-zinc-500">Already have Stride? Install this over it. Your account and activities stay.</p>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-bold">How to install</h2>
        <ol className="mt-4 space-y-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-brand-ink">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{step.title}</p>
                <p className="text-zinc-500">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14 rounded-xl border border-zinc-300 p-6 dark:border-zinc-800">
        <h2 className="text-xl font-bold">Why does Android warn me?</h2>
        <p className="mt-2 text-zinc-500">
          Stride isn’t on the Play Store yet, and Android warns about every app installed from outside it, whatever the
          app is. The warning is about where the file comes from, not about anything found in it.
        </p>
        <ul className="mt-4 space-y-2 text-zinc-500">
          <li>
            <span className="font-semibold text-foreground">Location</span> is used only while you record an activity or
            look at the map, never in the background.
          </li>
          <li>
            <span className="font-semibold text-foreground">Camera</span> is used only to scan a friend’s QR code.
            Contacts, only if you choose to invite friends; they’re never uploaded.
          </li>
          <li>
            <span className="font-semibold text-foreground">No ads, no trackers,</span> and we never sell your data.
            Activities are visible to your followers by default, and you can make any of them private.
          </li>
        </ul>
        <p className="mt-4 text-sm text-zinc-500">
          Read the{" "}
          <a href={`${API_URL}/privacy`} className="font-semibold text-accent hover:underline">
            Privacy Policy
          </a>{" "}
          and{" "}
          <a href={`${API_URL}/terms`} className="font-semibold text-accent hover:underline">
            Terms
          </a>
          .
        </p>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-bold">On an iPhone? Add Stride to your Home Screen</h2>
        <p className="mt-2 text-zinc-500">
          The full Stride app also runs in your browser: record, maps, friends, challenges and clubs, with the same account.
          Nothing to download.
        </p>
        <ol className="mt-4 space-y-4">
          {WEB_APP_STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-brand-ink">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{step.title}</p>
                <p className="text-zinc-500">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <a
          href="/app"
          className="mt-6 inline-block rounded-lg bg-brand px-6 py-3 font-semibold text-brand-ink hover:opacity-90"
        >
          Open the web app
        </a>
      </section>

      <section className="mt-14 text-center text-zinc-500">
        <p>
          On a computer? Use the{" "}
          <a href="/app" className="font-semibold text-accent hover:underline">
            web app
          </a>
          , or{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            log in here
          </Link>{" "}
          to see your activities, routes and stats on a bigger screen.
        </p>
      </section>
    </div>
  );
}
