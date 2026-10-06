"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UniversitySelect } from "@/components/UniversitySelect";
import { createClient } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [university, setUniversity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (university !== "Kasdi Merbah University" && university !== "Other University") {
      setError("Choose a university to continue.");
      return;
    }
    setLoading(true);
    setError(null);

    // The profile row is created automatically by a DB trigger (see
    // supabase/migrations/0003_profile_trigger.sql) once auth.users gets
    // this row -- passing display_name/university as metadata here is how
    // the trigger picks them up. We do NOT insert into profiles from the
    // client: there's no session yet if email confirmation is required,
    // so an RLS insert here would fail.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: new URL("/auth/confirm", window.location.origin).toString(),
        data: { display_name: name, university },
      },
    });

    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (!data.session) {
      // Email confirmation is required -- no session yet, so don't redirect
      // into pages that need one.
      setConfirmSent(true);
      return;
    }

    router.push("/reports");
  }

  if (confirmSent) {
    return (
      <div className="auth-shell px-4 py-12">
      <div className="auth-card text-center">
        <p className="eyebrow">ONE LAST STEP</p>
        <h1 className="mt-3 text-3xl font-semibold">Check your email</h1>
        <p className="mt-3 text-muted">
          We sent a confirmation link to {email}. Click it, then come back
          and sign in. CHECK YOUR SPAM FOLDER if you don&apos;t see it in your inbox.
        </p>
        <Link href="/login" className="mt-6 inline-flex rounded-lg bg-brand px-5 py-2.5 font-semibold text-black hover:bg-brand-hover">Go to sign in</Link>
      </div>
      </div>
    );
  }

  return (
    <div className="auth-shell px-4 py-12 sm:py-16">
      <div className="auth-card">
      <p className="eyebrow">JOIN YOUR CAMPUS COMMUNITY</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-2 text-sm text-muted">Sign up to browse, post, and connect securely.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Full name">
          <input
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-brand"
          />
        </Field>
        <div className="block">
          <span className="mb-1 block text-sm text-muted">University</span>
          <UniversitySelect value={university} onChange={(value) => { setUniversity(value); setError(null); }} />
        </div>
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
            autoComplete="new-password"
            required
            minLength={6}
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
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">Already registered? <Link href="/login" className="text-brand hover:underline">Sign in</Link></p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}
