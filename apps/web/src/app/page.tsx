import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-20">
      <section className="hero-panel relative overflow-hidden rounded-3xl px-6 py-12 text-center sm:px-12 sm:py-20">
        <p className="eyebrow">KASDI MERBAH UNIVERSITY · CAMPUS COMMUNITY</p>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Lost something? <span className="text-gradient-brand">Let’s find it</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
          A simple, trusted place for students to report lost belongings, share found items, and help them find their way home
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href="/signup"
          className="rounded-xl bg-brand px-6 py-3 font-semibold text-black shadow-lg shadow-brand/15 hover:bg-brand-hover"
        >
          Join the campus community
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-border bg-surface/70 px-6 py-3 font-medium hover:border-brand/50 hover:bg-surface"
        >
          I already have an account
        </Link>
        <a
          href="https://github.com/SystemTechnologiesCompany/stc-foundit/releases/download/v1.0/STC.FoundIt.apk"
          className="group inline-flex items-center justify-center gap-3 rounded-xl border border-brand/40 bg-gradient-to-r from-brand/15 via-surface to-brand/10 px-6 py-3 text-left shadow-lg shadow-brand/10 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-brand/20"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 shrink-0 fill-brand transition group-hover:scale-110">
            <path d="M17.6 9.48 19.44 6.3a.5.5 0 0 0-.87-.5l-1.87 3.23a11.2 11.2 0 0 0-9.4 0L5.43 5.8a.5.5 0 1 0-.87.5L6.4 9.48A9.6 9.6 0 0 0 2 17h20a9.6 9.6 0 0 0-4.4-7.52ZM7.5 13.25a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm9 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM3 18h18v1a2 2 0 0 1-2 2h-1v1.5a1 1 0 0 1-2 0V21H8v1.5a1 1 0 0 1-2 0V21H5a2 2 0 0 1-2-2v-1Z" />
          </svg>
          <span>
            <span className="block font-semibold text-foreground">Download Android App</span>
            <span className="mt-0.5 block text-xs text-muted">Free APK · Android</span>
          </span>
        </a>
      </div>
      <p className="mt-5 text-xs text-muted">Sign in to browse reports or post a lost or found item</p>
      </section>

      <div className="mt-8 grid gap-4 text-left sm:grid-cols-3">
        <Feature
          number="Firstly"
          title="Tell us what’s missing"
          body="Share a few helpful details and where you last saw it"
        />
        <Feature
          number="Secondly"
          title="Find a possible match"
          body="We compare category, campus location, and date to surface likely matches"
        />
        <Feature
          number="Thirdly"
          title="Reconnect safely"
          body="Use private conversations to confirm details and arrange a return"
        />
      </div>
      <p className="mt-10 text-center text-xs text-muted">Built for the Kasdi Merbah University community </p>
      <p className="mt-11 text-center text-xs text-muted">STC The Way to Greatness </p>
    </div>
  );
}

function Feature({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className="feature-card rounded-2xl border border-border bg-surface p-6 sm:p-7">
      <span className="text-xs font-semibold tracking-[0.2em] text-brand">{number}</span>
      <h3 className="mt-5 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}
