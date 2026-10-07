"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createClient } from "@/lib/supabase";

type Profile = { display_name: string; avatar_path: string | null; avatarUrl?: string | null };
type PollResult = { option_index: number; vote_count: number | null; percentage: number };
type Post = { id: string; author_id: string; body: string; media_path: string | null; media_type: "image" | "video" | null; post_type?: "standard" | "poll"; poll_options?: string[] | null; created_at: string; author?: Profile; mediaUrl?: string | null; likeCount: number; commentCount: number; liked: boolean; votedOption?: number | null; pollResults?: PollResult[] };
type Comment = { id: string; post_id: string; content: string; created_at: string; is_anonymous: boolean; is_mine: boolean; display_name: string; avatar_path: string | null; profile?: Profile; revealedName?: string };
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;
const MEDIA_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
const supabase = createClient();

export default function NewsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [body, setBody] = useState("");
  const [composerMode, setComposerMode] = useState<"standard" | "poll">("standard");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [votingPost, setVotingPost] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  const [shareCopiedPost, setShareCopiedPost] = useState<string | null>(null);
  const mediaTapRef = useRef<{ postId: string | null; time: number }>({ postId: null, time: 0 });

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
    const [{ data: profiles }, { data: likes }, { data: commentRows }, { data: ownVotes }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, avatar_path").in("id", profileIds),
      ids.length ? supabase.from("news_likes").select("post_id,user_id").in("post_id", ids) : Promise.resolve({ data: [] as { post_id: string; user_id: string }[] }),
      ids.length ? supabase.rpc("get_news_comment_counts", { p_post_ids: ids }) : Promise.resolve({ data: [] as { post_id: string; comment_count: number }[] }),
      ids.length ? supabase.from("news_poll_votes").select("post_id,user_id,option_index").in("post_id", ids).eq("user_id", currentUser.id) : Promise.resolve({ data: [] as { post_id: string; user_id: string; option_index: number }[] }),
    ]);
    const profileMap = new Map<string, Profile>();
    await Promise.all((profiles ?? []).map(async (p) => {
      const signed = p.avatar_path ? await supabase.storage.from("profile-photos").createSignedUrl(p.avatar_path, 30 * 60) : null;
      profileMap.set(p.id, { display_name: p.display_name, avatar_path: p.avatar_path, avatarUrl: signed?.data?.signedUrl ?? null });
    }));
    setPosts(await Promise.all((rows ?? []).map(async (post) => {
      const signed = post.media_path ? await supabase.storage.from("community-media").createSignedUrl(post.media_path, 30 * 60) : null;
      const vote = (ownVotes ?? []).find((item) => item.post_id === post.id);
      const { data: pollRows } = post.post_type === "poll" ? await supabase.rpc("get_news_poll_results", { p_post_id: post.id }) : { data: [] };
      return { ...post, author: profileMap.get(post.author_id), mediaUrl: signed?.data?.signedUrl ?? null,
        likeCount: (likes ?? []).filter((like) => like.post_id === post.id).length,
        commentCount: Number(((commentRows ?? []) as { post_id: string; comment_count: number }[]).find((comment) => comment.post_id === post.id)?.comment_count ?? 0),
        liked: (likes ?? []).some((like) => like.post_id === post.id && like.user_id === currentUser.id),
        votedOption: vote?.option_index ?? null,
        pollResults: (pollRows ?? []) as PollResult[] };
    })));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) return load(); });
    return () => { cancelled = true; };
  }, [load]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function publish() {
    const normalizedOptions = pollOptions.map((option) => option.trim());
    if (!userId || !isAdmin || busy || (composerMode === "standard" && !body.trim() && !file) || (composerMode === "poll" && !body.trim())) return;
    if (composerMode === "poll" && (body.trim().length > 300 || normalizedOptions.length < 2 || normalizedOptions.length > 10 || normalizedOptions.some((option) => !option || option.length > 80))) {
      setError("Polls need a question and 2–10 choices. Each choice can be up to 80 characters."); return;
    }
    setBusy(true); setError("");
    const { data: post, error: insertError } = await supabase.from("news_posts").insert({ author_id: userId, body: body.trim(), post_type: composerMode, poll_options: composerMode === "poll" ? normalizedOptions : null, is_published: false }).select("id").single();
    if (insertError || !post) { setError(insertError?.message ?? "Could not create post."); setBusy(false); return; }
    if (composerMode === "standard" && file) {
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
    setBody(""); setFile(null); setPreview(null); setComposerMode("standard"); setPollOptions(["", ""]); await load(); setBusy(false);
  }

  async function vote(post: Post, optionIndex: number) {
    if (!userId || votingPost || post.votedOption === optionIndex || (!isAdmin && post.votedOption != null)) return;
    setVotingPost(post.id);
    setPosts((current) => current.map((item) => item.id === post.id ? { ...item, votedOption: optionIndex } : item));
    const result = post.votedOption == null
      ? await supabase.from("news_poll_votes").insert({ post_id: post.id, user_id: userId, option_index: optionIndex })
      : await supabase.from("news_poll_votes").update({ option_index: optionIndex }).eq("post_id", post.id).eq("user_id", userId);
    if (result.error) setError(result.error.message);
    await load();
    setVotingPost(null);
  }

  async function toggleLike(post: Post) {
    if (!userId) return;
    setPosts((current) => current.map((row) => row.id === post.id ? { ...row, liked: !row.liked, likeCount: row.likeCount + (row.liked ? -1 : 1) } : row));
    const result = post.liked ? await supabase.from("news_likes").delete().eq("post_id", post.id).eq("user_id", userId) : await supabase.from("news_likes").insert({ post_id: post.id, user_id: userId });
    if (result.error) { setError(result.error.message); await load(); }
  }

  function handleMediaTap(post: Post) {
    const now = Date.now();
    const previous = mediaTapRef.current;
    if (previous.postId === post.id && now - previous.time < 320) {
      mediaTapRef.current = { postId: null, time: 0 };
      if (!post.liked) void toggleLike(post);
    } else {
      mediaTapRef.current = { postId: post.id, time: now };
    }
  }

  async function sharePost(post: Post) {
    const url = `${window.location.origin}/news#post-${post.id}`;
    const title = post.body.trim().slice(0, 90) || "FoundIt community post";
    const shareData = { title, text: `Check out this FoundIt community post: ${title}`, url };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopiedPost(post.id);
      window.setTimeout(() => setShareCopiedPost((current) => current === post.id ? null : current), 2200);
    } catch {
      window.prompt("Copy this link to share the post:", url);
    }
  }

  async function showComments(post: Post) {
    if (expanded === post.id) { setExpanded(null); return; }
    setExpanded(post.id); await loadComments(post.id);
  }
  async function loadComments(postId: string) {
    const { data, error: queryError } = await supabase.rpc("get_news_comments", { p_post_id: postId });
    if (queryError) { setError(queryError.message); return; }
    const rows = (data ?? []) as Comment[];
    setComments(await Promise.all(rows.map(async (row) => {
      const signed = !row.is_anonymous && row.avatar_path ? await supabase.storage.from("profile-photos").createSignedUrl(row.avatar_path, 30 * 60) : null;
      return { ...row, profile: row.is_anonymous ? undefined : { display_name: row.display_name, avatar_path: row.avatar_path, avatarUrl: signed?.data?.signedUrl ?? null } };
    })));
  }
  async function addComment(post: Post) {
    if (!userId || !draft.trim()) return;
    const { error: insertError } = await supabase.from("news_comments").insert({ post_id: post.id, user_id: userId, content: draft.trim(), is_anonymous: commentAnonymous });
    if (insertError) { setError(insertError.message); return; }
    setDraft(""); setCommentAnonymous(false); await loadComments(post.id);
    setPosts((current) => current.map((row) => row.id === post.id ? { ...row, commentCount: row.commentCount + 1 } : row));
  }
  async function revealCommentAuthor(comment: Comment) {
    const { data, error: revealError } = await supabase.rpc("reveal_news_comment_author", { p_comment_id: comment.id });
    if (revealError || !data?.[0]?.account_name) { setError(revealError?.message ?? "Could not reveal this commenter."); return; }
    setComments((current) => current.map((row) => row.id === comment.id ? { ...row, revealedName: data[0].account_name } : row));
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
    {isAdmin && <section className="mt-6 rounded-3xl border border-border bg-surface p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-brand/10 px-3 py-1.5 text-[0.62rem] font-black tracking-widest text-brand">✓ ADMIN</span><span className="text-xs font-semibold text-muted">Share with the community</span></div>
      <div className="mt-4 inline-flex rounded-xl border border-border bg-background p-1"><button type="button" onClick={() => setComposerMode("standard")} className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${composerMode === "standard" ? "bg-brand text-black" : "text-muted"}`}>Post</button><button type="button" onClick={() => { setComposerMode("poll"); setFile(null); setPreview(null); }} className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${composerMode === "poll" ? "bg-brand text-black" : "text-muted"}`}>Poll</button></div>
      <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={composerMode === "poll" ? 300 : 5000} placeholder={composerMode === "poll" ? "Ask the community a question…" : "What’s happening on campus?"} className="mt-4 min-h-24 w-full resize-y rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:border-brand" />
      {composerMode === "poll" ? <div className="mt-3 space-y-2">{pollOptions.map((option, index) => <div key={index} className="flex items-center gap-2"><input value={option} onChange={(event) => setPollOptions((current) => current.map((value, row) => row === index ? event.target.value : value))} maxLength={80} placeholder={`Choice ${index + 1}`} className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-brand" />{index >= 2 && <button type="button" aria-label="Remove choice" onClick={() => setPollOptions((current) => current.filter((_, row) => row !== index))} className="rounded-lg px-3 py-2 text-lg text-danger">×</button>}</div>)}{pollOptions.length < 10 && <button type="button" onClick={() => setPollOptions((current) => [...current, ""])} className="rounded-lg px-2 py-2 text-sm font-bold text-brand transition-colors hover:bg-brand/10">＋ Add choice</button>}</div> : null}
      {composerMode === "standard" && preview && file && <div className="relative mt-3">{file.type.startsWith("video/") ? <video src={preview} controls className="max-h-64 w-full rounded-2xl bg-background" /> : <img src={preview} alt="Post preview" className="max-h-64 w-full rounded-2xl object-cover" />}<button type="button" onClick={() => { setFile(null); setPreview(null); }} className="absolute right-2 top-2 rounded-full bg-background px-2 py-1 text-lg">×</button></div>}
      <div className="mt-3 flex items-center justify-between">{composerMode === "standard" ? <label className="cursor-pointer text-sm font-semibold text-brand">＋ Photo or video<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(event) => { const selected = event.target.files?.[0] ?? null; event.target.value = ""; if (!selected) return; const limit = selected.type.startsWith("video/") ? MAX_VIDEO : MAX_IMAGE; if (!MEDIA_TYPES[selected.type] || selected.size > limit) { setError(selected.size > limit ? "Photo max 5 MB; video max 50 MB." : "Choose JPG, PNG, WebP, MP4, WebM, or MOV."); return; } setFile(selected); setPreview(URL.createObjectURL(selected)); setError(""); }} /></label> : <span className="text-xs text-muted">2–10 choices · one vote per member</span>}<button type="button" disabled={busy || (composerMode === "poll" ? !body.trim() || pollOptions.some((option) => !option.trim()) : !body.trim() && !file)} onClick={() => void publish()} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-black text-black disabled:opacity-40">{busy ? "Publishing…" : "Publish"}</button></div>
    </section>}
    {error && <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
    <div className="mt-6 space-y-4">
      {!posts.length && <div className="rounded-3xl border border-border bg-surface p-8 text-center"><span className="text-2xl text-brand">🥲</span><h2 className="mt-3 font-bold">The community board is quiet</h2><p className="mt-2 text-sm text-muted">Official updates from the FoundIt team will appear here.</p></div>}
      {posts.map((post) => <article key={post.id} id={`post-${post.id}`} className="overflow-hidden rounded-3xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex items-center gap-3"><Avatar profile={post.author} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{post.author?.display_name ?? "FoundIt Admin"}</p><p className="text-[0.65rem] text-muted">{new Date(post.created_at).toLocaleString()}</p></div>{post.post_type === "poll" && <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[0.6rem] font-black tracking-widest text-brand">POLL</span>}<span className="rounded-full bg-brand/10 px-2.5 py-1 text-[0.6rem] font-black tracking-widest text-brand">ADMIN</span>{isAdmin && <button type="button" aria-label="Delete post" onClick={() => void deletePost(post)} className="rounded-lg px-2 py-1 text-lg text-danger">×</button>}</div>
        {post.body && <p className="whitespace-pre-wrap break-words py-4 text-sm leading-6">{post.body}</p>}
        {post.post_type === "poll" && <PollCard post={post} isAdmin={isAdmin} voting={votingPost === post.id} onVote={(index) => void vote(post, index)} />}
        {post.mediaUrl && post.media_type === "image" && <img src={post.mediaUrl} alt="Community post · double tap to like" onClick={() => handleMediaTap(post)} className="max-h-[34rem] w-full cursor-pointer select-none rounded-2xl object-cover" />}
        {post.mediaUrl && post.media_type === "video" && <video src={post.mediaUrl} controls playsInline preload="metadata" onClick={() => handleMediaTap(post)} className="max-h-[34rem] w-full rounded-2xl bg-background" />}
        {post.post_type !== "poll" && <><div className="flex justify-between pt-3 text-xs text-muted"><span>{post.likeCount} {post.likeCount === 1 ? "like" : "likes"}</span><button type="button" onClick={() => void showComments(post)}>{post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}</button></div>
        <div className="mt-3 flex items-center justify-around border-y border-border py-2"><button type="button" aria-label={post.liked ? "Unlike post" : "Like post"} onClick={() => void toggleLike(post)} className={`flex items-center gap-2 px-3 py-1.5 text-sm font-semibold ${post.liked ? "text-brand" : "text-muted"}`}><img src={post.liked ? "/news-like-filled.png" : "/news-like.png"} alt="" className="h-5 w-5 object-contain" />{post.liked ? "Liked" : "Like"}</button><button type="button" onClick={() => void showComments(post)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-muted"><img src="/news-comment.png" alt="" className="h-5 w-5 object-contain" />Comment</button><button type="button" onClick={() => void sharePost(post)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-muted" aria-label="Share post"><span className="news-share-icon" aria-hidden="true" />{shareCopiedPost === post.id ? "Link copied" : "Share"}</button></div>
        {expanded === post.id && <div className="space-y-3 pt-4">{comments.map((comment) => <div key={comment.id} className="flex items-start gap-2"><Avatar profile={comment.profile} small anonymous={comment.is_anonymous} /><div className="min-w-0 flex-1 rounded-2xl bg-background px-3 py-2"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold">{comment.revealedName ?? comment.display_name}</p>{isAdmin && comment.is_anonymous && <button type="button" onClick={() => void revealCommentAuthor(comment)} className="shrink-0 text-[0.65rem] font-bold text-brand">{comment.revealedName ? "Revealed" : "Reveal identity"}</button>}</div><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{comment.content}</p>{isAdmin && comment.revealedName && <p className="mt-1 text-[0.65rem] text-muted">Only visible to admins.</p>}</div>{(comment.is_mine || isAdmin) && <button type="button" aria-label="Delete comment" onClick={() => void deleteComment(comment)} className="px-1 text-lg text-danger">×</button>}</div>)}
          <div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted">Members won’t see your name and account.</p><div className="flex items-center gap-2"><span className={`text-xs font-bold ${commentAnonymous ? "text-brand" : "text-muted"}`} aria-live="polite">{commentAnonymous ? "Anonymous On" : "Anonymous Off"}</span><label className="cosmic-toggle" aria-label="Post anonymously"><input className="cosmic-toggle-input" type="checkbox" role="switch" checked={commentAnonymous} onChange={(event) => setCommentAnonymous(event.target.checked)} /><span className="cosmic-toggle-slider" aria-hidden="true"><span className="cosmic-toggle-cosmos" /><span className="cosmic-toggle-energy" /><span className="cosmic-toggle-energy" /><span className="cosmic-toggle-energy" /><span className="cosmic-toggle-orb"><span className="cosmic-toggle-inner" /><span className="cosmic-toggle-ring" /></span><span className="cosmic-toggle-particles">{[30, 60, 90, 120, 150, 180].map((angle) => <span key={angle} className="cosmic-toggle-particle" style={{ "--angle": `${angle}deg` } as CSSProperties} />)}</span></span><span className="sr-only">{commentAnonymous ? "Anonymous comments on" : "Anonymous comments off"}</span></label></div></div><form onSubmit={(event) => { event.preventDefault(); void addComment(post); }} className="flex gap-2"><input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} placeholder="Write a comment…" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand" /><button disabled={!draft.trim()} className="rounded-xl bg-brand px-4 text-sm font-bold text-black disabled:opacity-40">Send</button></form></div>
        </div>}</>}
      </article>)}
    </div>
  </div>;
}

function Avatar({ profile, small = false, anonymous = false }: { profile?: Profile; small?: boolean; anonymous?: boolean }) {
  const size = small ? "h-8 w-8 rounded-xl" : "h-10 w-10 rounded-2xl";
  return <div className={`${size} grid shrink-0 place-items-center overflow-hidden ${anonymous ? "bg-brand" : "bg-brand/10"} font-black text-brand`}>{anonymous ? <img src="/Anonymous-PIC.png" alt="Anonymous member" className="h-full w-full object-cover" /> : profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : (profile?.display_name ?? "F").slice(0, 1).toUpperCase()}</div>;
}

function PollCard({ post, isAdmin, voting, onVote }: { post: Post; isAdmin: boolean; voting: boolean; onVote: (index: number) => void }) {
  const options = Array.isArray(post.poll_options) ? post.poll_options : [];
  const showResults = isAdmin || post.votedOption != null;
  const totalVotes = isAdmin ? (post.pollResults ?? []).reduce((sum, result) => sum + (result.vote_count ?? 0), 0) : null;
  return <section className="space-y-2 pb-2" aria-label="Community poll">
    <p className="mb-3 text-xs font-semibold text-muted">{showResults ? (isAdmin ? `${totalVotes} ${totalVotes === 1 ? "vote" : "votes"}` : "Vote submitted · members can only vote once") : "Choose one option to see the results"}</p>
    {options.map((label, index) => {
      const result = post.pollResults?.find((row) => row.option_index === index);
      const percentage = showResults ? Number(result?.percentage ?? 0) : 0;
      return <button key={`${post.id}-${index}`} type="button" disabled={voting || (!isAdmin && post.votedOption != null)} onClick={() => onVote(index)} className={`relative isolate w-full overflow-hidden rounded-xl border px-3 py-3 text-left transition-all duration-300 ${post.votedOption === index ? "border-brand bg-brand/10" : "border-border bg-background hover:border-brand/60"}`}>
        {showResults && <span className="absolute inset-y-0 left-0 -z-10 rounded-r-lg bg-brand/20 transition-[width] duration-500 ease-out" style={{ width: `${percentage}%` }} />}
        <span className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold">{label}</span><span className="shrink-0 font-black text-brand">{showResults ? `${percentage}%${isAdmin ? ` · ${result?.vote_count ?? 0}` : ""}` : ""}</span></span>
      </button>;
    })}
  </section>;
}
