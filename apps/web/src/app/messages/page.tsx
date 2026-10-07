"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { RadarLoader } from "@/components/RadarLoader";

interface ConversationRow {
  id: string;
  report_title: string;
  is_admin_thread: boolean;
}

async function removeConversationImages(supabase: ReturnType<typeof createClient>, conversationId: string) {
  const bucket = supabase.storage.from("message-images");
  const folders: string[] = [];
  const paths: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await bucket.list(conversationId, { limit: 100, offset });
    if (error) return error;
    for (const item of data ?? []) {
      if (item.id) paths.push(`${conversationId}/${item.name}`);
      else folders.push(`${conversationId}/${item.name}`);
    }
    if ((data?.length ?? 0) < 100) break;
    offset += 100;
  }
  for (const folder of folders) {
    offset = 0;
    while (true) {
      const { data, error } = await bucket.list(folder, { limit: 100, offset });
      if (error) return error;
      paths.push(...(data ?? []).filter((item) => Boolean(item.id)).map((item) => `${folder}/${item.name}`));
      if ((data?.length ?? 0) < 100) break;
      offset += 100;
    }
  }
  if (!paths.length) return null;
  const { error } = await bucket.remove(paths);
  return error;
}

export default function MessagesInboxPage() {
  const supabase = createClient();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<ConversationRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { if (active) setLoading(false); return; }
      const { data: viewerProfile } = await supabase.from("profiles").select("is_admin").eq("id", userData.user.id).maybeSingle();
      const { data, error: queryError } = await supabase
        .from("conversation_members")
        .select("conversation_id, conversations(id, report_id, admin_recipient_id, reports(title))")
        .eq("user_id", userData.user.id);
      if (!active) return;
      if (queryError) { setError(queryError.message); setLoading(false); return; }
      const rawRows = (data ?? []).map((row) => {
        const convo = row as unknown as { conversations?: { id: string; report_id: string | null; admin_recipient_id: string | null; reports?: { title?: string } } };
        return { id: convo.conversations?.id ?? "", report_title: convo.conversations?.reports?.title ?? "Conversation", admin_recipient_id: convo.conversations?.admin_recipient_id ?? null };
      });
      const recipientIds = viewerProfile?.is_admin ? [...new Set(rawRows.map((row) => row.admin_recipient_id).filter((id): id is string => Boolean(id)))] : [];
      const { data: recipients } = recipientIds.length ? await supabase.from("profiles").select("id, display_name").in("id", recipientIds) : { data: [] as { id: string; display_name: string }[] };
      const recipientNames = new Map((recipients ?? []).map((profile) => [profile.id, profile.display_name]));
      const rows: ConversationRow[] = rawRows.map((row) => ({
        id: row.id,
        is_admin_thread: Boolean(row.admin_recipient_id),
        report_title: row.admin_recipient_id ? (viewerProfile?.is_admin ? recipientNames.get(row.admin_recipient_id) ?? "Member conversation" : "FoundIt Admin") : row.report_title,
      }));
      setConversations(rows.filter((row) => row.id));
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  async function deleteConversation(forEveryone: boolean) {
    if (!confirm || busy) return;
    setBusy(true);
    setError("");
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) { setError("Please sign in again to delete this conversation."); setBusy(false); return; }
    if (forEveryone) {
      const imageError = await removeConversationImages(supabase, confirm.id);
      if (imageError) { setError(`Could not remove conversation photos: ${imageError.message}`); setBusy(false); return; }
    }
    const result = forEveryone
      ? await supabase.rpc("delete_conversation_for_everyone", { p_conversation_id: confirm.id })
      : await supabase.from("conversation_members").delete().eq("conversation_id", confirm.id).eq("user_id", userData.user.id);
    if (result.error) { setError(result.error.message); setBusy(false); return; }
    setConversations((current) => current.filter((conversation) => conversation.id !== confirm.id));
    setConfirm(null);
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
      <p className="eyebrow">A LITTLE CONNECTION GOES A LONG WAY</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight">Messages</h1>
      <p className="mt-2 text-sm text-muted">Private conversations about getting things home.</p>
      {error && !confirm && <p role="alert" className="mt-5 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      <div className="mt-7 space-y-3">
        {loading && <div className="stc-loading-state"><RadarLoader size="small" label="Loading conversations" /><span>Loading your conversations…</span></div>}
        {!loading && conversations.length === 0 && <div className="rounded-2xl border border-border bg-surface p-7 text-center"><p className="font-semibold">Your inbox is a clean slate</p><p className="mt-2 text-sm text-muted">Open a report and start a private conversation.</p></div>}
        {conversations.map((conversation) => (
          <div key={conversation.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:border-brand/50">
            <Link href={`/messages/${conversation.id}`} className="min-w-0 flex-1 rounded-xl p-2 focus-visible:outline-brand">
              <span className="block truncate font-semibold">{conversation.report_title}</span>
              <span className="mt-1 block text-xs text-muted">{conversation.is_admin_thread ? "Private FoundIt support chat · Open chat →" : "Private conversation · Open chat →"}</span>
            </Link>
            <button type="button" onClick={() => { setError(""); setConfirm(conversation); }} aria-label={`Delete conversation about ${conversation.report_title}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-danger/25 bg-danger/10 text-xl text-danger transition hover:bg-danger/20">×</button>
          </div>
        ))}
      </div>

      {confirm && (
        <div className="stc-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setConfirm(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-conversation-title" className="stc-dialog-card w-[min(100%,26rem)] rounded-[1.6rem] border border-[#344936] bg-[#101b14] p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[#593332] bg-[#2a1918] text-3xl leading-none text-[#f0a69b]">×</div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#19271b] px-3 py-2 text-[0.62rem] font-black tracking-[0.14em] text-brand"><span className="h-1.5 w-1.5 rounded-full bg-brand" />INBOX CONTROL</span>
            </div>
            <h2 id="delete-conversation-title" className="mt-5 text-xl font-black tracking-tight">Delete conversation</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Choose how to remove “{confirm.report_title}”.</p>
            <div className="mt-4 flex gap-3 rounded-2xl border border-border bg-[#151f18] p-3 text-xs leading-5 text-muted"><span className="text-lg text-brand">◇</span><p>Delete for me hides it from your inbox. Delete for everyone permanently removes the conversation and its messages and photos for both people.</p></div>
            {error && <p role="alert" className="mt-3 text-xs leading-5 text-danger">{error}</p>}
            <div className="mt-5 space-y-2.5">
              <button type="button" disabled={busy} onClick={() => void deleteConversation(false)} className="w-full rounded-2xl border border-[#593332] bg-[#211918] px-4 py-3 text-left transition hover:bg-[#2a1918] disabled:opacity-50"><span className="block text-sm font-bold text-[#f0a69b]">Delete for me</span><span className="mt-1 block text-xs text-muted">The other person keeps their copy</span></button>
              <button type="button" disabled={busy} onClick={() => void deleteConversation(true)} className="w-full rounded-2xl border border-[#75433b] bg-[#432521] px-4 py-3 text-sm font-black text-[#ffb9ad] transition hover:bg-[#532c26] disabled:opacity-50">{busy ? "Deleting…" : "Delete for everyone"}</button>
              <button type="button" disabled={busy} onClick={() => setConfirm(null)} className="w-full rounded-2xl border border-border bg-[#152019] px-4 py-3 text-sm font-bold transition hover:bg-surface disabled:opacity-50">Keep conversation</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
