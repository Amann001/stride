"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/lib/auth";

// The top bar is always black, so the lime logo looks the same in light and dark mode.
// On the landing page it floats over the hero map instead, as wide as the page.
export function Navbar() {
  const { user, signOut } = useAuth();
  const landing = usePathname() === "/";
  return (
    <header
      className={
        landing
          ? "absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-brand-ink/90 to-transparent"
          : "bg-brand-ink"
      }
    >
      <nav
        className={`mx-auto flex items-center justify-between py-3 ${
          landing ? "max-w-[82rem] px-[clamp(1.25rem,5vw,4rem)] py-5" : "max-w-4xl px-4"
        }`}
      >
        <Link href={user ? "/dashboard" : "/"} aria-label="Stride home">
          {/* width/height 0 + auto width lets the SVG keep its own proportions at 28px tall. */}
          <Image src="/stride-logo-on-dark.svg" alt="Stride" width={0} height={0} style={{ height: 28, width: "auto" }} priority />
        </Link>
        {user ? (
          <div className="flex items-center gap-4 text-sm text-zinc-300">
            <Link href="/dashboard" className="hover:text-white">
              Dashboard
            </Link>
            <span className="text-zinc-500">{user.name}</span>
            <button onClick={signOut} className="text-red-400 hover:underline">
              Log out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-5 text-sm">
            {/* A plain link: /app is the web app itself, not a page of this site. */}
            <a href="/app" className="hidden text-zinc-300 hover:text-white sm:inline">
              Web app
            </a>
            <Link href="/download" className="text-zinc-300 hover:text-white">
              Get the app
            </Link>
            <Link href="/login" className="font-semibold text-brand hover:underline">
              Log in
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
