"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: new URL("/auth/confirm", window.location.origin).toString(), queryParams: { prompt: "select_account" } },
      });
      if (oauthError) setError(oauthError.message);
    } catch (oauthError) {
      setError(oauthError instanceof Error ? oauthError.message : "Could not connect to Google. Try again.");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    const requestedPath = new URLSearchParams(window.location.search).get("next");
    const nextPath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
      ? requestedPath
      : "/reports";
    router.push(nextPath);
  }

  return (
    <div className="auth-shell px-4 py-12 sm:py-20">
      <div className="auth-card">
      <p className="eyebrow">STC FoundIt · Campus community</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-muted">Sign in to browse reports and reconnect items with their owners.</p>
      <p className="mt-3 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-brand">You can change your account name in Profile settings once every 7 days.</p>
      <button type="button" onClick={() => void handleGoogleSignIn()} disabled={googleLoading} className="mt-6 flex w-full items-center justify-center gap-3 rounded-md border border-border bg-surface py-2.5 font-medium transition hover:border-brand/50 hover:bg-brand/5 disabled:opacity-50">
        <GoogleMark />{googleLoading ? "Connecting to Google…" : "Continue with Google"}
      </button>
      <div className="my-4 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-border" />or use email<span className="h-px flex-1 bg-border" /></div>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Email">
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-brand"
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-brand"
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand py-2.5 font-medium text-black hover:bg-brand-hover disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        No account?{" "}
        <Link href="/signup" className="text-brand">
          Sign up
        </Link>
      </p>
      </div>
    </div>
  );
}

function GoogleMark() {
  return <Image src="/google.svg" width={20} height={20} alt="" aria-hidden="true" />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}
