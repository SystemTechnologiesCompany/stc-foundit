"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { LanguageSelect } from "@/components/LanguageProvider";

export default function NavBar() {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  async function refreshUnreadCount() {
    const { data, error } = await supabase.rpc("unread_message_count");
    if (!error && typeof data === "number") setUnreadCount(data);
  }

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", data.user.id)
          .single();
        setDisplayName(profile?.display_name ?? data.user.email ?? "Account");
        refreshUnreadCount();
      } else {
        setDisplayName(null);
        setUnreadCount(0);
      }
      setChecked(true);
    }
    loadUser();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    // Any new message in a conversation this user belongs to (Realtime is
    // already RLS-scoped, so this only fires for their own conversations)
    // means the unread count may have changed -- refetch it.
    const channel = supabase
      .channel("navbar-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => refreshUnreadCount()
      )
      .subscribe();

    // The conversation page dispatches this after marking messages read.
    function onMessagesRead() {
      refreshUnreadCount();
    }
    window.addEventListener("foundit:messages-read", onMessagesRead);

    return () => {
      sub.subscription.unsubscribe();
      supabase.removeChannel(channel);
      window.removeEventListener("foundit:messages-read", onMessagesRead);
    };
  }, []);

  async function handleSignOut() {
    setMobileOpen(false);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto max-w-6xl px-4 py-2.5 sm:px-6 lg:py-3">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <Link href={displayName ? "/reports" : "/"} className="flex min-w-0 shrink items-center gap-2 font-semibold text-lg">
            <img src="/logo.png" alt="STC" className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10" />
            <span className="truncate text-gradient-brand">STC FoundIt</span>
          </Link>

          <div className="hidden shrink-0 items-center gap-3 text-sm lg:flex xl:gap-4">
            {checked && displayName ? <>
              <Link href="/reports" className="whitespace-nowrap text-muted nav-link-glow">Browse</Link>
              <Link href="/news" className="whitespace-nowrap text-muted nav-link-glow">News</Link>
              <Link href="/report/lost" className="whitespace-nowrap text-muted nav-link-glow">Report lost</Link>
              <Link href="/report/found" className="whitespace-nowrap text-muted nav-link-glow">Report found</Link>
              <Link href="/messages" className="relative whitespace-nowrap text-muted nav-link-glow">Messages{unreadCount > 0 && <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}</Link>
              <span className="max-w-36 truncate text-muted">Hi, {displayName}</span>
              <Link href="/account" className="whitespace-nowrap text-muted nav-link-glow">Profile</Link>
              <button onClick={handleSignOut} className="whitespace-nowrap rounded-lg border border-border px-3 py-2 font-medium transition hover:border-brand/50 hover:bg-surface">Sign out</button>
            </> : checked && <>
              <span className="whitespace-nowrap text-muted">A safer way to find what’s missing</span>
              <Link href="/login" className="whitespace-nowrap rounded-lg border border-border px-3.5 py-2 font-medium hover:bg-surface">Sign in</Link>
              <Link href="/signup" className="whitespace-nowrap rounded-lg bg-brand px-3.5 py-2 font-semibold text-black hover:bg-brand-hover">Create account</Link>
            </>}
            <LanguageSelect />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:hidden">
            <LanguageSelect />
            {checked && <button type="button" aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileOpen} aria-controls="mobile-site-menu" onClick={() => setMobileOpen((open) => !open)} className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface text-foreground transition hover:border-brand/60" >
              {mobileOpen ? <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>}
            </button>}
          </div>
        </div>

        {mobileOpen && <div id="mobile-site-menu" className="mt-3 space-y-4 rounded-2xl border border-border bg-surface p-3 shadow-xl shadow-black/20 lg:hidden">
          {displayName ? <>
            <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2.5">
              <div className="min-w-0"><p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-brand">Signed in</p><p className="truncate text-sm font-semibold">{displayName}</p></div>
              {unreadCount > 0 && <span className="shrink-0 rounded-full bg-danger px-2 py-1 text-[0.65rem] font-bold text-white">{unreadCount > 99 ? "99+" : unreadCount} unread</span>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/reports" onClick={() => setMobileOpen(false)} className="mobile-nav-link">Browse reports</Link>
              <Link href="/news" onClick={() => setMobileOpen(false)} className="mobile-nav-link">News</Link>
              <Link href="/report/lost" onClick={() => setMobileOpen(false)} className="mobile-nav-link">Report lost</Link>
              <Link href="/report/found" onClick={() => setMobileOpen(false)} className="mobile-nav-link">Report found</Link>
              <Link href="/messages" onClick={() => setMobileOpen(false)} className="mobile-nav-link">Messages{unreadCount > 0 && <span className="ml-auto rounded-full bg-danger px-1.5 py-0.5 text-[0.6rem] font-bold text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}</Link>
              <Link href="/account" onClick={() => setMobileOpen(false)} className="mobile-nav-link">Profile settings</Link>
            </div>
            <button onClick={handleSignOut} className="w-full rounded-xl border border-border px-3 py-2.5 text-left text-sm font-semibold text-muted transition hover:border-brand/50 hover:text-foreground">Sign out</button>
          </> : <div className="grid grid-cols-2 gap-2">
            <Link href="/login" onClick={() => setMobileOpen(false)} className="mobile-nav-link justify-center">Sign in</Link>
            <Link href="/signup" onClick={() => setMobileOpen(false)} className="mobile-nav-link justify-center border-brand bg-brand font-bold text-black hover:bg-brand-hover">Create account</Link>
          </div>}
        </div>}
      </nav>
    </header>
  );
}
