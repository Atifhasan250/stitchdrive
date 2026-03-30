"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
        credentials: "include",
      });
      if (res.ok) {
        router.push("/dashboard");
      } else {
        setError("Invalid PIN. Please try again.");
      }
    } catch {
      setError("Connection error. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sd-bg px-4">
      {/* Background elements */}
      <div className="dot-bg pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-sd-accent/5 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 h-64 w-64 rounded-full bg-sd-accent2/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-up">
        {/* Outer glow */}
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-sd-accent/20 to-transparent pointer-events-none" />

        <div className="relative rounded-2xl border border-sd-border bg-sd-s1 p-8 shadow-card">
          {/* Top accent line */}
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-sd-accent/60 to-transparent" />

          <div className="mb-8 text-center">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-6 group">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden transition group-hover:scale-105">
                <div className="absolute inset-0 bg-gradient-accent" />
                <svg className="relative h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="9" cy="10" r="3.5" strokeLinecap="round" />
                  <circle cx="15" cy="14" r="3.5" strokeLinecap="round" />
                  <path d="M11.5 7.5 L12.5 16.5" strokeLinecap="round" strokeOpacity={0.5} />
                </svg>
              </div>
              <span className="text-sm font-semibold tracking-tight text-sd-text">StitchDrive</span>
            </Link>

            <h1 className="font-display text-2xl text-sd-text">Welcome back</h1>
            <p className="mt-1.5 text-sm text-sd-text2">Enter your PIN to unlock your drive</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type="password"
                placeholder="••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
                className="w-full rounded-xl border border-sd-border bg-sd-bg px-4 py-3.5 text-center text-xl tracking-[0.6em] text-sd-text placeholder-sd-text3 outline-none transition focus:border-sd-accent/50 focus:ring-2 focus:ring-sd-accent/10 font-mono"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-3">
                <svg className="h-4 w-4 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !pin}
              className="btn-primary w-full rounded-xl py-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verifying…
                </span>
              ) : "Unlock Dashboard"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-sd-text3">
            <Link href="/" className="hover:text-sd-text transition">← Back to home</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
