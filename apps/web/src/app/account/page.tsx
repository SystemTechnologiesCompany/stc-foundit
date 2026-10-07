"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const supabase = createClient();
const INVITE_URL = "https://stcfoundit.netlify.app/signup?source=classmate-invite";
const INVITE_QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(INVITE_URL)}`;

export default function AccountPage() {
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("Campus member");
  const [nameDraft, setNameDraft] = useState("");
  const [nameChangedAt, setNameChangedAt] = useState<string | null>(null);
  const [nameBusy, setNameBusy] = useState(false);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const nextNameChange = nameChangedAt ? new Date(Date.parse(nameChangedAt) + 7 * 24 * 60 * 60 * 1000) : null;
  const nameLocked = Boolean(nextNameChange && nextNameChange.getTime() > Date.now());

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace("/login"); return; }
      const { data } = await supabase.from("profiles").select("display_name, avatar_path, display_name_changed_at").eq("id", auth.user.id).maybeSingle();
      if (!active) return;
      const currentName = data?.display_name ?? auth.user.email ?? "Campus member";
      setUserId(auth.user.id); setName(currentName); setNameDraft(currentName); setNameChangedAt(data?.display_name_changed_at ?? null); setAvatarPath(data?.avatar_path ?? null);
      if (data?.avatar_path) {
        const { data: signed } = await supabase.storage.from("profile-photos").createSignedUrl(data.avatar_path, 30 * 60);
        if (active) setAvatarUrl(signed?.signedUrl ?? null);
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  async function saveName() {
    if (!userId || nameBusy || nameLocked) return;
    const nextName = nameDraft.trim();
    if (!nextName || nextName.length > 50) { setError("Account name must be between 1 and 50 characters."); return; }
    if (nextName === name) return;
    setNameBusy(true); setError("");
    const { data, error: saveError } = await supabase.from("profiles").update({ display_name: nextName }).eq("id", userId).select("display_name, display_name_changed_at").single();
    if (saveError) { setError(saveError.message); setNameBusy(false); return; }
    setName(data.display_name); setNameDraft(data.display_name); setNameChangedAt(data.display_name_changed_at);
    await supabase.auth.updateUser({ data: { display_name: data.display_name } });
    setNameBusy(false);
  }

  async function savePhoto(file: File | undefined) {
    if (!file || !userId || busy) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type.toLowerCase()) || file.size > 5 * 1024 * 1024) { setError("Choose a JPG, PNG, or WebP photo under 5 MB."); return; }
    setBusy(true);
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const newPath = `${userId}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("profile-photos").upload(newPath, file, { contentType: file.type, upsert: false });
    if (uploadError) { setError(uploadError.message); setBusy(false); return; }
    const { error: saveError } = await supabase.from("profiles").update({ avatar_path: newPath }).eq("id", userId);
    if (saveError) { await supabase.storage.from("profile-photos").remove([newPath]); setError(saveError.message); setBusy(false); return; }
    const { data } = await supabase.storage.from("profile-photos").createSignedUrl(newPath, 30 * 60);
    setAvatarPath(newPath); setAvatarUrl(data?.signedUrl ?? null);
    if (avatarPath) void supabase.storage.from("profile-photos").remove([avatarPath]);
    setBusy(false);
  }

  async function removePhoto() {
    if (!userId || !avatarPath || busy) return;
    setBusy(true); setError("");
    const { error: saveError } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", userId);
    if (saveError) { setError(saveError.message); setBusy(false); return; }
    await supabase.storage.from("profile-photos").remove([avatarPath]);
    setAvatarPath(null); setAvatarUrl(null); setBusy(false);
  }

  async function shareInvite() {
    setInviteStatus("");
    try {
      if (navigator.share) await navigator.share({ title: "Join FoundIt", text: "Join the FoundIt campus community:", url: INVITE_URL });
      else { await navigator.clipboard.writeText(INVITE_URL); setInviteStatus("Invite link copied."); }
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === "AbortError") return;
      setInviteStatus("Could not share the invite link. Copy it from the link below.");
    }
  }

  async function copyInvite() {
    try { await navigator.clipboard.writeText(INVITE_URL); setInviteStatus("Invite link copied."); }
    catch { setInviteStatus("Could not copy the link. Select and copy it below."); }
  }

  return <div className="mx-auto max-w-xl px-4 py-10">
    <p className="eyebrow">YOUR SPACE</p><h1 className="mt-2 text-3xl font-black">Profile settings</h1><p className="mt-2 text-sm text-muted">Choose a photo other FoundIt members will see beside your comments.</p>
    <section className="mt-7 rounded-3xl border border-border bg-surface p-6 text-center">
      <div className="mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-[2rem] border border-brand/20 bg-brand/10 text-3xl font-black text-brand">{avatarUrl ? <img src={avatarUrl} alt={`${name} profile`} className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}</div>
      <h2 className="mt-4 font-bold">{name}</h2>
      <div className="mx-auto mt-6 max-w-sm text-left">
        <label htmlFor="account-name" className="mb-2 block text-sm font-semibold">Account name</label>
        <input id="account-name" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} maxLength={50} disabled={nameLocked || nameBusy} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-brand disabled:opacity-60" />
        <p className="mt-2 text-xs text-muted">{nameLocked && nextNameChange ? `You can change your name again on ${nextNameChange.toLocaleDateString()}.` : "You can change your account name once every 7 days."}</p>
        {!nameLocked && <button type="button" onClick={() => void saveName()} disabled={nameBusy || nameDraft.trim() === name} className="mt-3 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40">{nameBusy ? "Saving…" : "Save account name"}</button>}
      </div>
      <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void savePhoto(file); }} />
      <div className="mt-5 flex flex-wrap justify-center gap-3"><button type="button" disabled={busy} onClick={() => picker.current?.click()} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50">{busy ? "Saving…" : avatarUrl ? "Choose another photo" : "Choose profile photo"}</button>{avatarUrl && <button type="button" disabled={busy} onClick={() => void removePhoto()} className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-muted disabled:opacity-50">Remove photo</button>}</div>
      <p className="mt-4 text-xs text-muted">JPG, PNG or WebP · up to 5 MB</p>
      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
    </section>
    <section className="mt-5 rounded-3xl border border-border bg-surface p-6 text-center">
      <p className="eyebrow">GROW YOUR CAMPUS COMMUNITY</p><h2 className="mt-2 text-lg font-black">Invite classmates</h2><p className="mx-auto mt-2 max-w-sm text-sm text-muted">Share FoundIt with your campus so more lost items can find their way home.</p>
      <div className="mx-auto mt-5 w-fit rounded-2xl bg-white p-2"><img src={INVITE_QR_URL} alt="QR code to join FoundIt" width={180} height={180} /></div>
      <p className="mx-auto mt-4 max-w-sm break-all rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted">{INVITE_URL}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2"><button type="button" onClick={() => void shareInvite()} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-black">Share invite link</button><button type="button" onClick={() => void copyInvite()} className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-muted hover:border-brand/60">Copy link</button></div>
      {inviteStatus && <p role="status" className="mt-3 text-xs text-brand">{inviteStatus}</p>}
    </section>
  </div>;
}
