"use client";

import Image from "next/image";
import Link from "next/link";

import { useAuth } from "@/lib/auth";

// The top bar is always black, so the lime logo looks the same in light and dark mode.
export function Navbar() {
  const { user, signOut } = useAuth();
  return (
    <header className="bg-brand-ink">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
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
