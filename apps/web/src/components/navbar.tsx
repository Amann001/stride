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
          <Image src="/stride-logo-on-dark.svg" alt="Stride" width={110} height={30} priority />
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
          <Link href="/login" className="text-sm font-semibold text-brand hover:underline">
            Log in
          </Link>
        )}
      </nav>
    </header>
  );
}
