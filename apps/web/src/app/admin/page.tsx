"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RadarLoader } from "@/components/RadarLoader";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Report } from "@stc-foundit/shared";

interface AdminReport extends Report {
  profiles?: { display_name: string } | null;
}

interface AdminProfile {
  id: string;
  display_name: string;
  university: string | null;
  is_admin: boolean;
  is_banned: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const supabase = createClient();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [users, setUsers] = useState<AdminProfile[]>([]);
  const [tab, setTab] = useState<"reports" | "users">("reports");
  const [messageTarget, setMessageTarget] = useState<AdminProfile | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [messageBusy, setMessageBusy] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [broadcastDraft, setBroadcastDraft] = useState("");
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setChecking(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userData.user.id)
        .single();

      const admin = profile?.is_admin ?? false;
      setIsAdmin(admin);
      setChecking(false);

      if (admin) {
        loadReports();
        loadUsers();
      }
    }
    load();
  }, []);

  async function loadReports() {
    const { data } = await supabase
      .from("reports")
      .select("*, profiles(display_name)")
      .order("created_at", { ascending: false });
    setReports((data as AdminReport[] | null) ?? []);
  }

  async function loadUsers() {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, university, is_admin, is_banned")
      .order("display_name");
    setUsers((data as AdminProfile[] | null) ?? []);
  }

  async function deleteReport(id: string) {
    if (!confirm("Delete this report permanently? This can't be undone.")) return;
    await supabase.from("reports").delete().eq("id", id);
    loadReports();
  }

  async function toggleBan(userId: string, currentlyBanned: boolean) {
    const label = currentlyBanned ? "unban" : "ban";
    if (!confirm(`Are you sure you want to ${label} this user?`)) return;
    await supabase
      .from("profiles")
      .update({ is_banned: !currentlyBanned })
      .eq("id", userId);
    loadUsers();
  }

  async function sendDirectMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!messageTarget || !messageDraft.trim() || messageBusy) return;
    setMessageBusy(true);
    setMessageError("");
    const { data: conversationId, error: sendError } = await supabase.rpc("send_admin_message", {
      p_user_id: messageTarget.id,
      p_content: messageDraft.trim(),
    });
    setMessageBusy(false);
    if (sendError || !conversationId) {
      setMessageError(sendError?.message ?? "The message could not be sent.");
      return;
    }
    setMessageTarget(null);
    setMessageDraft("");
    router.push(`/messages/${conversationId}`);
  }

  async function sendBroadcast(event: React.FormEvent) {
    event.preventDefault();
    if (!broadcastDraft.trim() || broadcastBusy) return;
    if (!confirm("Send this message in a private chat to every active member?")) return;
    setBroadcastBusy(true);
    setNotice("");
    const { data: recipientCount, error: sendError } = await supabase.rpc("broadcast_admin_message", {
      p_content: broadcastDraft.trim(),
    });
    setBroadcastBusy(false);
    if (sendError) {
      setNotice(`Message not sent: ${sendError.message}`);
      return;
    }
    setBroadcastDraft("");
    setNotice(`Sent privately to ${recipientCount ?? 0} active members.`);
  }

  if (checking) {
    return <div className="stc-loading-state stc-loading-state-centered"><RadarLoader label="Loading admin tools" /><span>Loading...</span></div>;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-muted">You don&apos;t have access to this page.</p>
        <Link href="/" className="text-brand">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <div className="mt-4 flex gap-2 border-b border-border">
        <button
          onClick={() => setTab("reports")}
          className={`px-3 py-2 text-sm font-medium ${
            tab === "reports"
              ? "border-b-2 border-brand text-foreground"
              : "text-muted"
          }`}
        >
          Reports ({reports.length})
        </button>
        <button
          onClick={() => setTab("users")}
          className={`px-3 py-2 text-sm font-medium ${
            tab === "users" ? "border-b-2 border-brand text-foreground" : "text-muted"
          }`}
        >
          Users ({users.length})
        </button>
      </div>

      {tab === "reports" && (
        <div className="mt-6 space-y-2">
          {reports.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/reports/${r.id}`} className="font-medium hover:text-brand">
                    {r.title}
                  </Link>
                  <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted">
                    {r.type}
                  </span>
                  <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted">
                    {r.status}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted">
                  by {r.profiles?.display_name ?? "Unknown"} · {r.category}
                </p>
              </div>
              <button
                onClick={() => deleteReport(r.id)}
                className="shrink-0 rounded-md border border-danger px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
              >
                Delete
              </button>
            </div>
          ))}
          {reports.length === 0 && <p className="text-muted">No reports yet.</p>}
        </div>
      )}

      {tab === "users" && (
        <div className="mt-6 space-y-5">
          <form onSubmit={sendBroadcast} className="space-y-3 rounded-2xl border border-brand/20 bg-surface p-4 sm:p-5">
            <div>
              <h2 className="font-semibold">Message all active members</h2>
              <p className="mt-1 text-xs leading-5 text-muted">Each person receives a private message in FoundIt and can reply. Suspended accounts and admins are excluded.</p>
            </div>
            <textarea required maxLength={2000} value={broadcastDraft} onChange={(event) => setBroadcastDraft(event.target.value)} rows={4} placeholder="Write an announcement or important warning…" className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted/70 focus:border-brand" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted">{broadcastDraft.length}/2000</span>
              <button type="submit" disabled={broadcastBusy || !broadcastDraft.trim()} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-black transition hover:bg-brand-hover disabled:opacity-50">{broadcastBusy ? "Sending…" : "Send to all active members"}</button>
            </div>
            {notice && <p role="status" className="text-sm text-brand">{notice}</p>}
          </form>
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface p-4"
            >
              <div>
                <div className="flex items-center gap-2 font-medium">
                  {u.display_name}
                  {u.is_admin && (
                    <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs text-brand">
                      admin
                    </span>
                  )}
                  {u.is_banned && (
                    <span className="rounded-full bg-danger/15 px-2 py-0.5 text-xs text-danger">
                      banned
                    </span>
                  )}
                </div>
                {u.university && (
                  <p className="text-xs text-muted">{u.university}</p>
                )}
              </div>
              {!u.is_admin && (
                <div className="flex shrink-0 gap-2">
                  <button
                    disabled={u.is_banned}
                    onClick={() => { setMessageError(""); setMessageDraft(""); setMessageTarget(u); }}
                    className="rounded-md border border-brand/40 px-3 py-1.5 text-sm text-brand hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Message
                  </button>
                  <button
                    onClick={() => toggleBan(u.id, u.is_banned)}
                    className={`rounded-md border px-3 py-1.5 text-sm ${
                      u.is_banned
                        ? "border-border hover:bg-background"
                        : "border-danger text-danger hover:bg-danger/10"
                    }`}
                  >
                    {u.is_banned ? "Unban" : "Ban"}
                  </button>
                </div>
              )}
            </div>
          ))}
          {users.length === 0 && <p className="text-muted">No users yet.</p>}
        </div>
      )}

      {messageTarget && (
        <div className="stc-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !messageBusy) setMessageTarget(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="admin-message-title" className="stc-dialog-card w-[min(100%,30rem)] rounded-[1.6rem] border border-[#344936] bg-[#101b14] p-5 shadow-2xl sm:p-6">
            <p className="eyebrow">PRIVATE MEMBER MESSAGE</p>
            <h2 id="admin-message-title" className="mt-2 text-xl font-black">Message {messageTarget.display_name}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">They’ll receive this in their FoundIt Messages inbox and can reply to you.</p>
            <form onSubmit={sendDirectMessage} className="mt-4 space-y-3">
              <textarea required autoFocus maxLength={2000} value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} rows={5} placeholder="Write a warning or message…" className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted/70 focus:border-brand" />
              <div className="flex justify-between text-xs text-muted"><span>{messageError ? <span role="alert" className="text-danger">{messageError}</span> : "Private conversation · replies go to Messages"}</span><span>{messageDraft.length}/2000</span></div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" disabled={messageBusy} onClick={() => setMessageTarget(null)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted hover:bg-background disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={messageBusy || !messageDraft.trim()} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-black hover:bg-brand-hover disabled:opacity-50">{messageBusy ? "Sending…" : "Send message"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
