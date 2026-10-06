"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { LanguageSelect } from "@/components/LanguageProvider";

export default function NavBar() {
  const supabase = createClient();
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href={displayName ? "/reports" : "/"} className="flex items-center gap-2 font-semibold text-lg">
          <img src="/logo.png" alt="STC" className="h-10 w-10 object-contain" />
          <span className="text-gradient-brand">STC FoundIt</span>
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm">
          <LanguageSelect />
          {!checked ? null : displayName ? (
            <>
              <Link href="/reports" className="text-muted nav-link-glow">Browse</Link>
              <Link href="/news" className="text-muted nav-link-glow">News</Link>
              <Link href="/report/lost" className="text-muted nav-link-glow">Report lost</Link>
              <Link href="/report/found" className="text-muted nav-link-glow">Report found</Link>
              <div className="flex items-center gap-3 border-l border-border pl-4">
              <Link
                href="/messages"
                className="relative text-muted nav-link-glow"
              >
                Messages
                {unreadCount > 0 && (
                  <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
              <span className="text-muted">Hi, {displayName}</span>
              <Link href="/account" className="text-muted nav-link-glow">Profile</Link>
              <button
                onClick={handleSignOut}
                className="rounded-md border border-border px-3 py-1.5 font-medium hover:bg-surface"
              >
                Sign out
              </button>
              </div>
            </>
          ) : (
            <>
              <span className="hidden text-muted sm:inline">A safer way to find what’s missing</span>
              <Link href="/login" className="rounded-lg border border-border px-3.5 py-2 font-medium hover:bg-surface">Sign in</Link>
              <Link href="/signup" className="rounded-lg bg-brand px-3.5 py-2 font-semibold text-black hover:bg-brand-hover">Create account</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
