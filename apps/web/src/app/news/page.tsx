"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Profile = { display_name: string; avatar_path: string | null; avatarUrl?: string | null };
type Post = { id: string; author_id: string; body: string; media_path: string | null; media_type: "image" | "video" | null; created_at: string; author?: Profile; mediaUrl?: string | null; likeCount: number; commentCount: number; liked: boolean };
type Comment = { id: string; post_id: string; user_id: string; content: string; created_at: string; profile?: Profile };
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;
const MEDIA_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
const supabase = createClient();

export default function NewsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const currentUser = auth.user;
    setUserId(currentUser?.id ?? null);
    if (!currentUser) { setPosts([]); return; }
    const [{ data: profile }, { data: rows, error: postError }] = await Promise.all([
      supabase.from("profiles").select("is_admin").eq("id", currentUser.id).maybeSingle(),
      supabase.from("news_posts").select("*").order("created_at", { ascending: false }).limit(40),
    ]);
    if (postError) { setError(postError.message); return; }
    setIsAdmin(Boolean(profile?.is_admin));
    const ids = (rows ?? []).map((post) => post.id);
    const profileIds = [...new Set([...(rows ?? []).map((post) => post.author_id), currentUser.id])];
    const [{ data: profiles }, { data: likes }, { data: commentRows }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, avatar_path").in("id", profileIds),
      ids.length ? supabase.from("news_likes").select("post_id,user_id").in("post_id", ids) : Promise.resolve({ data: [] as { post_id: string; user_id: string }[] }),
      ids.length ? supabase.from("news_comments").select("post_id").in("post_id", ids) : Promise.resolve({ data: [] as { post_id: string }[] }),
    ]);
    const profileMap = new Map<string, Profile>();
    await Promise.all((profiles ?? []).map(async (p) => {
      const signed = p.avatar_path ? await supabase.storage.from("profile-photos").createSignedUrl(p.avatar_path, 30 * 60) : null;
      profileMap.set(p.id, { display_name: p.display_name, avatar_path: p.avatar_path, avatarUrl: signed?.data?.signedUrl ?? null });
    }));
    setPosts(await Promise.all((rows ?? []).map(async (post) => {
      const signed = post.media_path ? await supabase.storage.from("community-media").createSignedUrl(post.media_path, 30 * 60) : null;
      return { ...post, author: profileMap.get(post.author_id), mediaUrl: signed?.data?.signedUrl ?? null,
        likeCount: (likes ?? []).filter((like) => like.post_id === post.id).length,
        commentCount: (commentRows ?? []).filter((comment) => comment.post_id === post.id).length,
        liked: (likes ?? []).some((like) => like.post_id === post.id && like.user_id === currentUser.id) };
    })));
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function publish() {
    if (!userId || !isAdmin || busy || (!body.trim() && !file)) return;
    setBusy(true); setError("");
    const { data: post, error: insertError } = await supabase.from("news_posts").insert({ author_id: userId, body: body.trim(), is_published: false }).select("id").single();
    if (insertError || !post) { setError(insertError?.message ?? "Could not create post."); setBusy(false); return; }
    if (file) {
      const kind = file.type.startsWith("video/") ? "video" : "image";
      const path = `${post.id}/${userId}/${Date.now()}.${MEDIA_TYPES[file.type]}`;
      const { error: uploadError } = await supabase.storage.from("community-media").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) { await supabase.from("news_posts").delete().eq("id", post.id); setError(uploadError.message); setBusy(false); return; }
      const { error: updateError } = await supabase.from("news_posts").update({ media_path: path, media_type: kind, is_published: true }).eq("id", post.id);
      if (updateError) { await supabase.storage.from("community-media").remove([path]); await supabase.from("news_posts").delete().eq("id", post.id); setError(updateError.message); setBusy(false); return; }
    } else {
      const { error: publishError } = await supabase.from("news_posts").update({ is_published: true }).eq("id", post.id);
      if (publishError) { await supabase.from("news_posts").delete().eq("id", post.id); setError(publishError.message); setBusy(false); return; }
    }
    setBody(""); setFile(null); await load(); setBusy(false);
  }

  async function toggleLike(post: Post) {
    if (!userId) return;
    setPosts((current) => current.map((row) => row.id === post.id ? { ...row, liked: !row.liked, likeCount: row.likeCount + (row.liked ? -1 : 1) } : row));
    const result = post.liked ? await supabase.from("news_likes").delete().eq("post_id", post.id).eq("user_id", userId) : await supabase.from("news_likes").insert({ post_id: post.id, user_id: userId });
    if (result.error) { setError(result.error.message); await load(); }
  }

  async function showComments(post: Post) {
    if (expanded === post.id) { setExpanded(null); return; }
    setExpanded(post.id); await loadComments(post.id);
  }
  async function loadComments(postId: string) {
    const { data, error: queryError } = await supabase.from("news_comments").select("*, profiles(display_name,avatar_path)").eq("post_id", postId).order("created_at", { ascending: true });
    if (queryError) { setError(queryError.message); return; }
    const rows = (data ?? []) as unknown as (Comment & { profiles?: Profile })[];
    setComments(await Promise.all(rows.map(async (row) => {
      const signed = row.profiles?.avatar_path ? await supabase.storage.from("profile-photos").createSignedUrl(row.profiles.avatar_path, 30 * 60) : null;
      return { ...row, profile: row.profiles ? { ...row.profiles, avatarUrl: signed?.data?.signedUrl ?? null } : undefined };
    })));
  }
  async function addComment(post: Post) {
    if (!userId || !draft.trim()) return;
    const { error: insertError } = await supabase.from("news_comments").insert({ post_id: post.id, user_id: userId, content: draft.trim() });
    if (insertError) { setError(insertError.message); return; }
    setDraft(""); await loadComments(post.id);
    setPosts((current) => current.map((row) => row.id === post.id ? { ...row, commentCount: row.commentCount + 1 } : row));
  }
  async function deleteComment(comment: Comment) {
    if (!window.confirm("Delete this comment? This cannot be undone.")) return;
    const { error: deleteError } = await supabase.from("news_comments").delete().eq("id", comment.id);
    if (deleteError) { setError(deleteError.message); return; }
    setComments((current) => current.filter((row) => row.id !== comment.id));
    setPosts((current) => current.map((post) => post.id === comment.post_id ? { ...post, commentCount: Math.max(0, post.commentCount - 1) } : post));
  }
  async function deletePost(post: Post) {
    if (!isAdmin) return;
    if (!window.confirm("Delete this post and all its comments? This cannot be undone.")) return;
    if (post.media_path) { const { error: fileError } = await supabase.storage.from("community-media").remove([post.media_path]); if (fileError) { setError(fileError.message); return; } }
    const { error: deleteError } = await supabase.from("news_posts").delete().eq("id", post.id);
    if (deleteError) { setError(deleteError.message); return; }
    setPosts((current) => current.filter((row) => row.id !== post.id));
  }

  return <div className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
    <p className="eyebrow">THE CAMPUS COMMUNITY</p><h1 className="mt-2 text-3xl font-black tracking-tight">News</h1><p className="mt-2 text-sm text-muted">Updates and moments shared by the FoundIt team.</p>
    {isAdmin && <section className="mt-6 rounded-3xl border border-border bg-surface p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-brand/10 px-3 py-1.5 text-[0.62rem] font-black tracking-widest text-brand">✓ ADMIN</span><span className="text-xs font-semibold text-muted">Share with the community</span></div><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={5000} placeholder="What’s happening on campus?" className="mt-4 min-h-24 w-full resize-y rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:border-brand" />
      {preview && file && <div className="relative mt-3">{file.type.startsWith("video/") ? <video src={preview} controls className="max-h-64 w-full rounded-2xl bg-background" /> : <img src={preview} alt="Post preview" className="max-h-64 w-full rounded-2xl object-cover" />}<button type="button" onClick={() => setFile(null)} className="absolute right-2 top-2 rounded-full bg-background px-2 py-1 text-lg">×</button></div>}
      <div className="mt-3 flex items-center justify-between"><label className="cursor-pointer text-sm font-semibold text-brand">＋ Photo or video<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(event) => { const selected = event.target.files?.[0] ?? null; event.target.value = ""; if (!selected) return; const limit = selected.type.startsWith("video/") ? MAX_VIDEO : MAX_IMAGE; if (!MEDIA_TYPES[selected.type] || selected.size > limit) { setError(selected.size > limit ? "Photo max 5 MB; video max 50 MB." : "Choose JPG, PNG, WebP, MP4, WebM, or MOV."); return; } setFile(selected); setError(""); }} /></label><button type="button" disabled={busy || (!body.trim() && !file)} onClick={() => void publish()} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-black text-black disabled:opacity-40">{busy ? "Publishing…" : "Publish"}</button></div>
    </section>}
    {error && <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
    <div className="mt-6 space-y-4">
      {!posts.length && <div className="rounded-3xl border border-border bg-surface p-8 text-center"><span className="text-2xl text-brand">🥲</span><h2 className="mt-3 font-bold">The community board is quiet</h2><p className="mt-2 text-sm text-muted">Official updates from the FoundIt team will appear here.</p></div>}
      {posts.map((post) => <article key={post.id} className="overflow-hidden rounded-3xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex items-center gap-3"><Avatar profile={post.author} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{post.author?.display_name ?? "FoundIt Admin"}</p><p className="text-[0.65rem] text-muted">{new Date(post.created_at).toLocaleString()}</p></div><span className="rounded-full bg-brand/10 px-2.5 py-1 text-[0.6rem] font-black tracking-widest text-brand">ADMIN</span></div>
        {post.body && <p className="whitespace-pre-wrap break-words py-4 text-sm leading-6">{post.body}</p>}
        {post.mediaUrl && post.media_type === "image" && <img src={post.mediaUrl} alt="Community post" className="max-h-[34rem] w-full rounded-2xl object-cover" />}
        {post.mediaUrl && post.media_type === "video" && <video src={post.mediaUrl} controls playsInline preload="metadata" className="max-h-[34rem] w-full rounded-2xl bg-background" />}
        <div className="flex justify-between pt-3 text-xs text-muted"><span>{post.likeCount} {post.likeCount === 1 ? "like" : "likes"}</span><button type="button" onClick={() => void showComments(post)}>{post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}</button></div>
        <div className="mt-3 flex items-center justify-around border-y border-border py-2"><button type="button" onClick={() => void toggleLike(post)} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-semibold ${post.liked ? "text-danger" : "text-muted"}`}><span className="text-xl">{post.liked ? "♥" : "♡"}</span>{post.liked ? "Liked" : "Like"}</button><button type="button" onClick={() => void showComments(post)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-muted"><span className="text-brand">◌</span>Comment</button>{isAdmin && <button type="button" onClick={() => void deletePost(post)} className="px-3 py-1.5 text-sm font-semibold text-danger">Delete post</button>}</div>
        {expanded === post.id && <div className="space-y-3 pt-4">{comments.map((comment) => <div key={comment.id} className="flex items-start gap-2"><Avatar profile={comment.profile} small /><div className="min-w-0 flex-1 rounded-2xl bg-background px-3 py-2"><p className="text-xs font-bold">{comment.profile?.display_name ?? "Member"}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{comment.content}</p></div>{(comment.user_id === userId || isAdmin) && <button type="button" aria-label="Delete comment" onClick={() => void deleteComment(comment)} className="px-1 text-lg text-danger">×</button>}</div>)}
          <form onSubmit={(event) => { event.preventDefault(); void addComment(post); }} className="flex gap-2"><input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} placeholder="Write a comment…" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand" /><button disabled={!draft.trim()} className="rounded-xl bg-brand px-4 text-sm font-bold text-black disabled:opacity-40">Send</button></form>
        </div>}
      </article>)}
    </div>
  </div>;
}

function Avatar({ profile, small = false }: { profile?: Profile; small?: boolean }) {
  const size = small ? "h-8 w-8 rounded-xl" : "h-10 w-10 rounded-2xl";
  return <div className={`${size} grid shrink-0 place-items-center overflow-hidden bg-brand/10 font-black text-brand`}>{profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : (profile?.display_name ?? "F").slice(0, 1).toUpperCase()}</div>;
}
