"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/lib/auth";

// Log in and sign up on one page, like the mobile app.
export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await signIn(email.trim(), password);
      else await signUp(name.trim(), email.trim(), password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const input =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-accent dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="mb-6 text-3xl font-bold">{mode === "login" ? "Log in" : "Create account"}</h1>
      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && (
          <input className={input} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        )}
        <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <input className={input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-brand py-2.5 font-semibold text-brand-ink hover:opacity-90 disabled:opacity-60">
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        {mode === "login" ? "Don't have an account? " : "Already have an account? "}
        <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }} className="font-semibold text-accent hover:underline">
          {mode === "login" ? "Sign up" : "Log in"}
        </button>
      </p>
    </div>
  );
}
