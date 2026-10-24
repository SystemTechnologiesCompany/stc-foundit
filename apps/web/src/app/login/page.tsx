"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  return <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5"><path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15Z"/><path fill="#FF3D00" d="M24 44c5.5 0 10.2-1.8 13.6-4.9l-6.7-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.7v5.3A20 20 0 0 0 24 44Z"/><path fill="#4CAF50" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.7a20 20 0 0 0 0 17.8l6.9-5.3Z"/><path fill="#1976D2" d="M24 12c3 0 5.7 1 7.8 3.1l5.9-5.9A19.7 19.7 0 0 0 24 4 20 20 0 0 0 5.7 15.1l6.9 5.3C14.2 15.6 18.7 12 24 12Z"/></svg>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}
