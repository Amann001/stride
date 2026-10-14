"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Hero } from "@/components/landing/hero";
import s from "@/components/landing/landing.module.css";
import { RunTracker } from "@/components/landing/run-tracker";
import { CleanGps, Film, Finish, Footer, Privacy, Screens } from "@/components/landing/sections";
import { useAuth } from "@/lib/auth";

// The landing page is one run: the hero draws a real route, and as you read down the page a
// tracker records it, kilometre by kilometre, until the run is saved at the end.
// Logged-in users go straight to their dashboard.
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  return (
    <main className={s.page}>
      <Hero />
      <Film />
      <CleanGps />
      <Screens />
      <Privacy />
      <Finish />
      <Footer />
      <RunTracker />
    </main>
  );
}
