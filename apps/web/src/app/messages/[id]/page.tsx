"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { RadarLoader } from "@/components/RadarLoader";
import type { Message } from "@stc-foundit/shared";

type ChatMessage = Message & { attachment_path?: string | null; imageUrl?: string | null };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function withSignedImage(supabase: ReturnType<typeof createClient>, message: ChatMessage): Promise<ChatMessage> {
  if (!message.attachment_path) return message;
  const { data, error } = await supabase.storage.from("message-images").createSignedUrl(message.attachment_path, 15 * 60);
  return { ...message, imageUrl: error ? null : data.signedUrl };
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [reportTitle, setReportTitle] = useState("Conversation");
  const [isAdminThread, setIsAdminThread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [chatHeight, setChatHeight] = useState<number | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id ?? null;
      if (!active) return;
      setUserId(currentUserId);
      if (!currentUserId) { setLoading(false); return; }

      const [{ data: convo }, { data: rows, error: messageError }, { data: viewerProfile }] = await Promise.all([
        supabase.from("conversations").select("report_id, admin_recipient_id, reports(title)").eq("id", id).single(),
        supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true }),
        supabase.from("profiles").select("is_admin").eq("id", currentUserId).maybeSingle(),
      ]);
      if (!active) return;
      const joined = convo as unknown as { admin_recipient_id?: string | null; reports?: { title?: string } } | null;
      const supportThread = Boolean(joined?.admin_recipient_id);
      setIsAdminThread(supportThread);
      if (supportThread) {
        if (viewerProfile?.is_admin && joined?.admin_recipient_id) {
          const { data: recipient } = await supabase.from("profiles").select("display_name").eq("id", joined.admin_recipient_id).maybeSingle();
          setReportTitle(`Chat with ${recipient?.display_name ?? "member"}`);
        } else setReportTitle("FoundIt Admin");
      } else setReportTitle(joined?.reports?.title ?? "Conversation");
      if (messageError) setError(messageError.message);
      const hydrated = await Promise.all(((rows ?? []) as ChatMessage[]).map((message) => withSignedImage(supabase, message)));
      if (!active) return;
      setMessages(hydrated);
      setLoading(false);
      await markAsRead(currentUserId);

      const channel = supabase.channel(`messages:${id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` }, (payload) => {
          const incoming = payload.new as ChatMessage;
          void withSignedImage(supabase, incoming).then((message) => {
            if (active) setMessages((current) => current.some((item) => item.id === incoming.id) ? current : [...current, message]);
          });
          if (active) void markAsRead(currentUserId);
        }).subscribe();
      channelRef.current = channel;
    }
    void load();
    return () => {
      active = false;
      if (channelRef.current) void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [id]);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  async function markAsRead(currentUserId: string) {
    await supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", id).eq("user_id", currentUserId);
    window.dispatchEvent(new Event("foundit:messages-read"));
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!pendingPhoto) { setPhotoPreview(null); return; }
    const url = URL.createObjectURL(pendingPhoto);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingPhoto]);

  useEffect(() => {
    const updateHeight = () => {
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
      const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
      setChatHeight(Math.max(180, Math.floor(viewportBottom - Math.max(viewportTop, headerBottom))));
    };
    const viewport = window.visualViewport;
    const header = document.querySelector("header");
    const observer = header && typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateHeight) : null;
    if (header) observer?.observe(header);
    updateHeight();
    window.addEventListener("resize", updateHeight);
    viewport?.addEventListener("resize", updateHeight);
    viewport?.addEventListener("scroll", updateHeight);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateHeight);
      viewport?.removeEventListener("resize", updateHeight);
      viewport?.removeEventListener("scroll", updateHeight);
    };
  }, []);

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setError("");
    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) { setError("Choose a JPG, PNG, or WebP image."); return; }
    if (file.size > MAX_IMAGE_BYTES) { setError("Choose an image smaller than 5 MB."); return; }
    setPendingPhoto(file);
  }

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = content.trim();
    if ((!trimmed && !pendingPhoto) || !userId || sending) return;
    setSending(true);
    setError("");
    let attachmentPath: string | null = null;
    try {
      if (pendingPhoto) {
        const extension = pendingPhoto.type === "image/png" ? "png" : pendingPhoto.type === "image/webp" ? "webp" : "jpg";
        attachmentPath = `${id}/${userId}/${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("message-images").upload(attachmentPath, pendingPhoto, { contentType: pendingPhoto.type, upsert: false });
        if (uploadError) throw uploadError;
      }
      const { data, error: sendError } = await supabase.from("messages").insert({ conversation_id: id, sender_id: userId, content: trimmed || "Photo", attachment_path: attachmentPath }).select("*").single();
      if (sendError || !data) throw sendError ?? new Error("Your message could not be sent.");
      const sentMessage = await withSignedImage(supabase, data as ChatMessage);
      setMessages((current) => current.some((item) => item.id === sentMessage.id) ? current : [...current, sentMessage]);
      setContent("");
      setPendingPhoto(null);
    } catch (cause) {
      if (attachmentPath) void supabase.storage.from("message-images").remove([attachmentPath]);
      setError(cause instanceof Error ? cause.message : "Your message could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="stc-loading-state stc-loading-state-centered"><RadarLoader label="Loading private chat" /><span>Loading your private chat…</span></div>;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-3 sm:px-4" style={{ height: chatHeight ? `${chatHeight}px` : "calc(100dvh - 5rem)" }}>
      <div className="shrink-0 border-b border-border py-3 sm:py-4">
        <Link href="/messages" className="text-sm text-muted nav-link-glow">← All conversations</Link>
        <h1 className="mt-1 truncate text-lg font-bold">{reportTitle}</h1>
        <p className="mt-1 text-[0.62rem] font-bold tracking-[0.15em] text-muted">{isAdminThread ? "PRIVATE FOUNDIT SUPPORT CHAT" : "PRIVATE CAMPUS CHAT"}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-4" aria-live="polite">
        <p className="mb-4 text-center text-[0.62rem] font-bold tracking-[0.15em] text-muted">YOUR CONVERSATION</p>
        {messages.length === 0 && <p className="mx-auto max-w-sm rounded-2xl border border-border bg-surface p-5 text-center text-sm leading-6 text-muted">No messages yet. Say hello and describe a detail only the real owner would know.</p>}
        {messages.map((message) => {
          const mine = message.sender_id === userId;
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[84%] space-y-1.5 rounded-[1.2rem] px-3.5 py-2.5 text-sm ${mine ? "rounded-br-sm bg-brand text-black" : "rounded-bl-sm border border-border bg-surface"}`}>
                {message.imageUrl && <a href={message.imageUrl} target="_blank" rel="noreferrer"><img src={message.imageUrl} alt="Photo shared in this conversation" className="max-h-80 w-full min-w-36 rounded-xl object-cover" /></a>}
                {(message.content !== "Photo" || !message.attachment_path) && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
                <p className={`text-right text-[0.62rem] ${mine ? "text-black/60" : "text-muted"}`}>{new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p role="alert" className="mb-2 shrink-0 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">{error}</p>}
      {pendingPhoto && photoPreview && <div className="mb-2 flex shrink-0 items-center gap-3 self-start rounded-2xl border border-border bg-surface p-2.5"><img src={photoPreview} alt="Selected photo preview" className="h-12 w-12 rounded-xl object-cover" /><div className="min-w-0"><p className="text-xs font-bold">Photo ready to send</p><p className="text-[0.65rem] text-muted">{(pendingPhoto.size / (1024 * 1024)).toFixed(1)} MB</p></div><button type="button" onClick={() => setPendingPhoto(null)} aria-label="Remove selected photo" className="ml-2 grid h-8 w-8 place-items-center rounded-xl bg-danger/10 text-xl text-danger">×</button></div>}

      <form onSubmit={handleSend} className="flex shrink-0 items-end gap-2 border-t border-border bg-background/95 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="sr-only" aria-label="Choose a photo to send" />
        <button type="button" onClick={() => imageInput.current?.click()} disabled={sending} aria-label="Choose a photo" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-brand bg-brand text-xl text-black transition hover:bg-brand-hover disabled:opacity-50"><img src="/photo-icon.png" alt="" className="h-7 w-7 object-contain" /></button>
        <input value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write a thoughtful message…" maxLength={2000} autoComplete="off" className="min-w-0 flex-1 rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none placeholder:text-muted/80 focus:border-brand" />
        <button type="submit" disabled={sending || (!content.trim() && !pendingPhoto)} className="h-11 shrink-0 rounded-2xl bg-brand px-4 font-bold text-black transition hover:bg-brand-hover disabled:opacity-40">{sending ? "…" : "Send"}</button>
      </form>
    </div>
  );
}
