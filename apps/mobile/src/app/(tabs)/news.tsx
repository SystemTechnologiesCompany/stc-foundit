import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Alert, Animated, Easing, Image, KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, View } from "react-native";
import { I18nText as Text, I18nTextInput as TextInput } from "../../components/LocalizedText";
import { Eyebrow, MessageBanner, Screen } from "../../components/ui";
import { theme } from "../../constants/theme";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../providers/AuthProvider";

type PickedMedia = { uri: string; mime: string; extension: string; kind: "image" | "video"; size?: number | null };
type Profile = { display_name: string; avatar_path: string | null; avatarUrl?: string | null };
type PollResult = { option_index: number; vote_count: number | null; percentage: number };
type NewsPost = { id: string; author_id: string; body: string; media_path: string | null; media_type: "image" | "video" | null; post_type?: "standard" | "poll"; poll_options?: string[] | null; created_at: string; author?: Profile; mediaUrl?: string | null; likeCount: number; commentCount: number; liked: boolean; votedOption?: number | null; pollResults?: PollResult[] };
type NewsComment = { id: string; post_id: string; content: string; created_at: string; is_anonymous: boolean; is_mine: boolean; display_name: string; avatar_path: string | null; profile?: Profile; revealedName?: string };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MEDIA_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

async function signedUrl(bucket: string, path: string | null | undefined) {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 30 * 60);
  return data?.signedUrl ?? null;
}

export default function NewsScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [composerMode, setComposerMode] = useState<"standard" | "poll">("standard");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [votingPost, setVotingPost] = useState<string | null>(null);
  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [cosmicOrbX] = useState(() => new Animated.Value(0));
  const mediaTapRef = useRef<{ postId: string | null; time: number; timer: ReturnType<typeof setTimeout> | null }>({ postId: null, time: 0, timer: null });

  useEffect(() => {
    const animation = Animated.spring(cosmicOrbX, { toValue: commentAnonymous ? 24 : 0, useNativeDriver: true, speed: 22, bounciness: 7 });
    animation.start();
    return () => animation.stop();
  }, [commentAnonymous, cosmicOrbX]);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    setError("");
    if (!user) { setRefreshing(false); return; }
    const [{ data: profile }, { data: rows, error: postError }] = await Promise.all([
      supabase.from("profiles").select("display_name, avatar_path, is_admin").eq("id", user.id).maybeSingle(),
      supabase.from("news_posts").select("*").order("created_at", { ascending: false }).limit(40),
    ]);
    if (postError) { setError(postError.message); setRefreshing(false); return; }
    const postRows = rows ?? [];
    const ids = postRows.map((post) => post.id);
    const profileIds = [...new Set([...postRows.map((post) => post.author_id), user.id])];
    const [{ data: profiles }, { data: likes }, { data: commentRows }, { data: ownVotes }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, avatar_path").in("id", profileIds),
      ids.length ? supabase.from("news_likes").select("post_id, user_id").in("post_id", ids) : Promise.resolve({ data: [] as { post_id: string; user_id: string }[] }),
      ids.length ? supabase.rpc("get_news_comment_counts", { p_post_ids: ids }) : Promise.resolve({ data: [] as { post_id: string; comment_count: number }[] }),
      ids.length ? supabase.from("news_poll_votes").select("post_id,user_id,option_index").in("post_id", ids).eq("user_id", user.id) : Promise.resolve({ data: [] as { post_id: string; user_id: string; option_index: number }[] }),
    ]);
    const profileMap = new Map<string, Profile>();
    await Promise.all((profiles ?? []).map(async (item) => profileMap.set(item.id, { display_name: item.display_name, avatar_path: item.avatar_path, avatarUrl: await signedUrl("profile-photos", item.avatar_path) })));
    const allLikes = likes ?? [];
    const allComments = (commentRows ?? []) as { post_id: string; comment_count: number }[];
    const hydrated: NewsPost[] = await Promise.all(postRows.map(async (post) => {
      const vote = (ownVotes ?? []).find((item) => item.post_id === post.id);
      const { data: pollRows } = post.post_type === "poll" ? await supabase.rpc("get_news_poll_results", { p_post_id: post.id }) : { data: [] };
      return {
        ...post,
        mediaUrl: await signedUrl("community-media", post.media_path),
        author: profileMap.get(post.author_id),
        likeCount: allLikes.filter((like) => like.post_id === post.id).length,
        commentCount: Number(allComments.find((comment) => comment.post_id === post.id)?.comment_count ?? 0),
        liked: allLikes.some((like) => like.post_id === post.id && like.user_id === user.id),
        votedOption: vote?.option_index ?? null,
        pollResults: (pollRows ?? []) as PollResult[],
      };
    }));
    setIsAdmin(Boolean(profile?.is_admin));
    setPosts(hydrated);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function chooseMedia() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], allowsMultipleSelection: false, quality: 0.84 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const mime = (asset.mimeType ?? "image/jpeg").toLowerCase();
    if (!MEDIA_TYPES[mime]) { setError("Choose a JPG, PNG, WebP, MP4, WebM, or MOV file."); return; }
    const kind = mime.startsWith("video/") ? "video" : "image";
    if ((asset.fileSize ?? 0) > (kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) { setError(kind === "video" ? "Choose a video smaller than 50 MB." : "Choose an image smaller than 5 MB."); return; }
    setMedia({ uri: asset.uri, mime, extension: MEDIA_TYPES[mime], kind, size: asset.fileSize });
    setError("");
  }

  async function publish() {
    const normalizedOptions = pollOptions.map((option) => option.trim());
    if (!user || !isAdmin || busy || (composerMode === "standard" && !body.trim() && !media) || (composerMode === "poll" && !body.trim())) return;
    if (composerMode === "poll" && (body.trim().length > 300 || normalizedOptions.length < 2 || normalizedOptions.length > 10 || normalizedOptions.some((option) => !option || option.length > 80))) {
      setError("Polls need a question and 2–10 choices. Each choice can be up to 80 characters."); return;
    }
    setBusy(true); setError("");
    const { data: post, error: insertError } = await supabase.from("news_posts").insert({ author_id: user.id, body: body.trim(), post_type: composerMode, poll_options: composerMode === "poll" ? normalizedOptions : null, is_published: false }).select("id").single();
    if (insertError || !post) { setError(insertError?.message ?? "Could not create the post."); setBusy(false); return; }
    if (composerMode === "standard" && media) {
      const path = `${post.id}/${user.id}/${Date.now()}.${media.extension}`;
      let uploaded = false;
      try {
        const bytes = await new File(media.uri).arrayBuffer();
        const { error: uploadError } = await supabase.storage.from("community-media").upload(path, bytes, { contentType: media.mime, upsert: false });
        if (uploadError) throw uploadError;
        uploaded = true;
        const { error: updateError } = await supabase.from("news_posts").update({ media_path: path, media_type: media.kind, is_published: true }).eq("id", post.id);
        if (updateError) throw updateError;
      } catch (cause) {
        if (uploaded) await supabase.storage.from("community-media").remove([path]);
        await supabase.from("news_posts").delete().eq("id", post.id);
        setError(cause instanceof Error ? cause.message : "Could not upload the post media."); setBusy(false); return;
      }
    } else {
      const { error: publishError } = await supabase.from("news_posts").update({ is_published: true }).eq("id", post.id);
      if (publishError) { await supabase.from("news_posts").delete().eq("id", post.id); setError(publishError.message); setBusy(false); return; }
    }
    setBody(""); setMedia(null); setComposerMode("standard"); setPollOptions(["", ""]); setBusy(false); await load();
  }

  async function vote(post: NewsPost, optionIndex: number) {
    if (!user || votingPost || post.votedOption === optionIndex || (!isAdmin && post.votedOption != null)) return;
    setVotingPost(post.id);
    setPosts((current) => current.map((item) => item.id === post.id ? { ...item, votedOption: optionIndex } : item));
    const result = post.votedOption == null
      ? await supabase.from("news_poll_votes").insert({ post_id: post.id, user_id: user.id, option_index: optionIndex })
      : await supabase.from("news_poll_votes").update({ option_index: optionIndex }).eq("post_id", post.id).eq("user_id", user.id);
    if (result.error) setError(result.error.message);
    await load();
    setVotingPost(null);
  }

  async function toggleLike(post: NewsPost) {
    if (!user) return;
    setPosts((current) => current.map((item) => item.id === post.id ? { ...item, liked: !item.liked, likeCount: item.likeCount + (item.liked ? -1 : 1) } : item));
    const result = post.liked
      ? await supabase.from("news_likes").delete().eq("post_id", post.id).eq("user_id", user.id)
      : await supabase.from("news_likes").insert({ post_id: post.id, user_id: user.id });
    if (result.error) { setError(result.error.message); await load(); }
  }

  function handleMediaTap(post: NewsPost, isVideo = false) {
    const now = Date.now();
    const previous = mediaTapRef.current;
    if (previous.postId === post.id && now - previous.time < 320) {
      if (previous.timer) clearTimeout(previous.timer);
      mediaTapRef.current = { postId: null, time: 0, timer: null };
      if (!post.liked) void toggleLike(post);
      return;
    }
    if (previous.timer) clearTimeout(previous.timer);
    const next = { postId: post.id, time: now, timer: null as ReturnType<typeof setTimeout> | null };
    if (isVideo) next.timer = setTimeout(() => { if (mediaTapRef.current.time === now) void Linking.openURL(post.mediaUrl!); }, 320);
    mediaTapRef.current = next;
  }

  async function sharePost(post: NewsPost) {
    const url = `https://stcfoundit.netlify.app/news#post-${post.id}`;
    const title = post.body.trim().slice(0, 90) || "FoundIt community post";
    await Share.share({ title, message: `${title}\n${url}`, url });
  }

  async function openComments(post: NewsPost) {
    if (expandedComments === post.id) { setExpandedComments(null); return; }
    setExpandedComments(post.id);
    const { data, error: commentError } = await supabase.rpc("get_news_comments", { p_post_id: post.id });
    if (commentError) { setError(commentError.message); return; }
    const rows = (data ?? []) as NewsComment[];
    const decorated = await Promise.all(rows.map(async (row) => ({ ...row, profile: { display_name: row.display_name, avatar_path: row.avatar_path, avatarUrl: await signedUrl("profile-photos", row.avatar_path) } })));
    setComments(decorated);
  }

  async function addComment(postId: string) {
    if (!user || !commentDraft.trim() || commentBusy) return;
    setCommentBusy(true);
    const { error: insertError } = await supabase.from("news_comments").insert({ post_id: postId, user_id: user.id, content: commentDraft.trim(), is_anonymous: commentAnonymous });
    setCommentBusy(false);
    if (insertError) { setError(insertError.message); return; }
    setCommentDraft("");
    setCommentAnonymous(false);
    const post = posts.find((item) => item.id === postId);
    if (post) await openCommentsAgain(post);
    setPosts((current) => current.map((item) => item.id === postId ? { ...item, commentCount: item.commentCount + 1 } : item));
  }

  async function openCommentsAgain(post: NewsPost) {
    const { data } = await supabase.rpc("get_news_comments", { p_post_id: post.id });
    const rows = (data ?? []) as NewsComment[];
    setComments(await Promise.all(rows.map(async (row) => ({ ...row, profile: { display_name: row.display_name, avatar_path: row.avatar_path, avatarUrl: await signedUrl("profile-photos", row.avatar_path) } }))));
  }

  async function revealCommentAuthor(comment: NewsComment) {
    const { data, error: revealError } = await supabase.rpc("reveal_news_comment_author", { p_comment_id: comment.id });
    if (revealError || !data?.[0]?.account_name) { setError(revealError?.message ?? "Could not reveal this commenter."); return; }
    setComments((current) => current.map((item) => item.id === comment.id ? { ...item, revealedName: data[0].account_name } : item));
  }

  async function deleteComment(comment: NewsComment) {
    Alert.alert("Delete this comment?", "This comment will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { void (async () => {
        const { error: deleteError } = await supabase.from("news_comments").delete().eq("id", comment.id);
        if (deleteError) { setError(deleteError.message); return; }
        setComments((current) => current.filter((item) => item.id !== comment.id));
        setPosts((current) => current.map((item) => item.id === comment.post_id ? { ...item, commentCount: Math.max(0, item.commentCount - 1) } : item));
      })(); } },
    ]);
  }

  async function deletePost(post: NewsPost) {
    if (!isAdmin) return;
    Alert.alert("Delete this post?", "The post and its comments will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { void (async () => {
        if (post.media_path) {
          const { error: storageError } = await supabase.storage.from("community-media").remove([post.media_path]);
          if (storageError) { setError(storageError.message); return; }
        }
        const { error: delError } = await supabase.from("news_posts").delete().eq("id", post.id);
        if (delError) setError(delError.message); else setPosts((current) => current.filter((item) => item.id !== post.id));
      })(); } },
    ]);
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.colors.brand} />} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}>
        <View style={styles.heading}><Eyebrow>THE CAMPUS COMMUNITY</Eyebrow><Text style={styles.title}>News</Text><Text style={styles.subtitle}>Updates and moments shared by the FoundIt team.</Text></View>
        {isAdmin ? <View style={styles.composer}>
          <View style={styles.composerHead}><Text style={styles.adminBadge}>✓  ADMIN</Text><Text style={styles.composerLabel}>Share with the community</Text></View>
          <View style={styles.modePicker}><Pressable onPress={() => setComposerMode("standard")} style={[styles.modeButton, composerMode === "standard" && styles.modeButtonSelected]}><Text style={[styles.modeText, composerMode === "standard" && styles.modeTextSelected]}>Post</Text></Pressable><Pressable onPress={() => { setComposerMode("poll"); setMedia(null); }} style={[styles.modeButton, composerMode === "poll" && styles.modeButtonSelected]}><Text style={[styles.modeText, composerMode === "poll" && styles.modeTextSelected]}>Poll</Text></Pressable></View>
          <TextInput value={body} onChangeText={setBody} placeholder={composerMode === "poll" ? "Ask the community a question…" : "What’s happening on campus?"} placeholderTextColor={theme.colors.subtle} multiline maxLength={composerMode === "poll" ? 300 : 5000} style={styles.composerInput} />
          {composerMode === "poll" ? <View style={styles.pollComposerOptions}>{pollOptions.map((option, index) => <View key={index} style={styles.pollComposerRow}><TextInput value={option} onChangeText={(value) => setPollOptions((current) => current.map((item, row) => row === index ? value : item))} placeholder={`Choice ${index + 1}`} placeholderTextColor={theme.colors.subtle} maxLength={80} style={styles.pollComposerInput} />{index >= 2 && <Pressable accessibilityLabel="Remove choice" onPress={() => setPollOptions((current) => current.filter((_, row) => row !== index))}><Text style={styles.pollRemove}>×</Text></Pressable>}</View>)}{pollOptions.length < 10 && <Pressable onPress={() => setPollOptions((current) => [...current, ""])} style={styles.addChoice}><Text style={styles.addChoiceText}>＋ Add choice</Text></Pressable>}</View> : null}
          {composerMode === "standard" && media ? <View style={styles.mediaPreview}>{media.kind === "image" ? <Image source={{ uri: media.uri }} style={styles.previewImage} /> : <Text style={styles.previewVideo}>▶  Video ready · {media.size ? `${(media.size / 1048576).toFixed(1)} MB` : "selected"}</Text>}<Pressable onPress={() => setMedia(null)} style={styles.removeMedia}><Text style={styles.removeMediaText}>×</Text></Pressable></View> : null}
          <View style={styles.composerActions}>{composerMode === "standard" ? <Pressable onPress={chooseMedia} style={styles.attachButton}><Text style={styles.attachGlyph}>＋</Text><Text style={styles.attachText}>Photo or video</Text></Pressable> : <Text style={styles.composerLabel}>2–10 choices · one vote per member</Text>}<Pressable disabled={busy || (composerMode === "poll" ? !body.trim() || pollOptions.some((option) => !option.trim()) : !body.trim() && !media)} onPress={publish} style={[styles.publishButton, (busy || (composerMode === "poll" ? !body.trim() || pollOptions.some((option) => !option.trim()) : !body.trim() && !media)) && styles.disabled]}><Text style={styles.publishText}>{busy ? "Publishing…" : "Publish"}</Text></Pressable></View>
        </View> : null}
        {error ? <MessageBanner>{error}</MessageBanner> : null}
        {!posts.length ? <View style={styles.empty}><Text style={styles.emptyGlyph}>🥲</Text><Text style={styles.emptyTitle}>The community board is quiet</Text><Text style={styles.emptyCopy}>Official updates from the FoundIt team will show up here.</Text></View> : null}
        {posts.map((post) => <View key={post.id} style={styles.post}>
          <View style={styles.postHead}><View style={styles.authorAvatar}>{post.author?.avatarUrl ? <Image source={{ uri: post.author.avatarUrl }} style={styles.authorPhoto} /> : <Text style={styles.authorInitial}>{(post.author?.display_name ?? "F").slice(0, 1).toUpperCase()}</Text>}</View><View style={styles.authorCopy}><Text style={styles.authorName}>{post.author?.display_name ?? "FoundIt Admin"}</Text><Text style={styles.postTime}>{new Date(post.created_at).toLocaleString()}</Text></View>{post.post_type === "poll" && <Text style={styles.pollBadge}>POLL</Text>}<Text style={styles.adminBadge}>ADMIN</Text>{isAdmin ? <Pressable accessibilityLabel="Delete post" onPress={() => void deletePost(post)}><Text style={styles.deleteGlyph}>×</Text></Pressable> : null}</View>
          {post.body ? <Text style={styles.postBody}>{post.body}</Text> : null}
          {post.post_type === "poll" && <PollCard post={post} isAdmin={isAdmin} voting={votingPost === post.id} onVote={(index) => void vote(post, index)} />}
          {post.mediaUrl && post.media_type === "image" ? <Pressable accessibilityLabel="Double tap to like this post" onPress={() => handleMediaTap(post)}><Image source={{ uri: post.mediaUrl }} style={styles.postImage} resizeMode="cover" /></Pressable> : null}
          {post.mediaUrl && post.media_type === "video" ? <Pressable style={styles.videoTile} onPress={() => handleMediaTap(post, true)}><Text style={styles.videoPlay}>▶</Text><Text style={styles.videoLabel}>Tap to play · double tap to like</Text></Pressable> : null}
          {post.post_type !== "poll" ? <><View style={styles.postStats}><Text style={styles.statText}>{post.likeCount} {post.likeCount === 1 ? "like" : "likes"}</Text><Pressable onPress={() => void openComments(post)}><Text style={styles.statText}>{post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}</Text></Pressable></View>
          <View style={styles.postActions}><Pressable accessibilityLabel={post.liked ? "Unlike post" : "Like post"} onPress={() => void toggleLike(post)} style={styles.postAction}><Image source={post.liked ? require("../../../assets/news-like-filled.png") : require("../../../assets/news-like.png")} style={[styles.postActionIcon, { tintColor: post.liked ? theme.colors.brand : theme.colors.muted }]} /><Text style={[styles.actionLabel, post.liked && styles.actionLiked]}>{post.liked ? "Liked" : "Like"}</Text></Pressable><Pressable onPress={() => void openComments(post)} style={styles.postAction}><Image source={require("../../../assets/news-comment.png")} style={[styles.postActionIcon, { tintColor: theme.colors.brand }]} /><Text style={styles.actionLabel}>Comment</Text></Pressable><Pressable accessibilityLabel="Share post" onPress={() => void sharePost(post)} style={styles.postAction}><Image source={require("../../../assets/news-share.png")} style={[styles.postActionIcon, { tintColor: theme.colors.brand }]} /><Text style={styles.actionLabel}>Share</Text></Pressable></View>
          {expandedComments === post.id ? <View style={styles.commentArea}>
            {comments.map((comment) => <View key={comment.id} style={styles.commentRow}><View style={[styles.commentAvatar, comment.is_anonymous && { backgroundColor: theme.colors.brand }]}>{comment.is_anonymous ? <Image source={require("../../../assets/Anonymous-PIC.png")} style={styles.commentPhoto} resizeMode="cover" /> : comment.profile?.avatarUrl ? <Image source={{ uri: comment.profile.avatarUrl }} style={styles.commentPhoto} /> : <Text style={styles.commentInitial}>{comment.display_name.slice(0, 1).toUpperCase()}</Text>}</View><View style={styles.commentBubble}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5 }}><Text style={styles.commentName}>{comment.revealedName ?? comment.display_name}</Text>{isAdmin && comment.is_anonymous ? <Pressable onPress={() => void revealCommentAuthor(comment)}><Text style={{ color: theme.colors.brand, fontSize: 8, fontWeight: "800" }}>{comment.revealedName ? "Revealed" : "Reveal"}</Text></Pressable> : null}</View><Text style={styles.commentText}>{comment.content}</Text>{isAdmin && comment.revealedName ? <Text style={{ color: theme.colors.subtle, fontSize: 8 }}>Only visible to admins</Text> : null}</View>{(comment.is_mine || isAdmin) ? <Pressable accessibilityLabel="Delete comment" onPress={() => void deleteComment(comment)}><Text style={styles.commentDelete}>×</Text></Pressable> : null}</View>)}
            <View style={styles.anonymousSetting}><Text style={{ color: theme.colors.subtle, fontSize: 9 }}>Members won’t see your name and account.</Text><View style={styles.anonymousToggleRow}><Pressable accessibilityRole="switch" accessibilityLabel="Post anonymously" accessibilityState={{ checked: commentAnonymous }} onPress={() => setCommentAnonymous((value) => !value)} style={[styles.cosmicToggle, { backgroundColor: commentAnonymous ? "#18351F" : "#101B14", borderColor: commentAnonymous ? theme.colors.brand : "#294032" }]}><View style={styles.cosmicStars}><View style={[styles.cosmicStar, { top: 6, left: 11 }]} /><View style={[styles.cosmicStar, { top: 16, left: 31 }]} /><View style={[styles.cosmicStar, { top: 8, left: 43 }]} /></View>{commentAnonymous ? <View pointerEvents="none" style={styles.cosmicEnergy}><View style={[styles.cosmicEnergyLine, { width: 18, top: 6 }]} /><View style={[styles.cosmicEnergyLine, { width: 14, top: 12 }]} /><View style={[styles.cosmicEnergyLine, { width: 18, top: 18 }]} /></View> : null}<Animated.View style={[styles.cosmicOrb, { transform: [{ translateX: cosmicOrbX }] }]}><View style={styles.cosmicOrbInner} /><View style={styles.cosmicOrbRing} /></Animated.View></Pressable><Text style={{ color: commentAnonymous ? theme.colors.brand : theme.colors.muted, fontSize: 9, fontWeight: "800" }}>{commentAnonymous ? "Anonymous · On" : "Anonymous · Off"}</Text></View></View>
            <View style={styles.commentComposer}><TextInput value={commentDraft} onChangeText={setCommentDraft} placeholder="Write a comment…" placeholderTextColor={theme.colors.subtle} maxLength={2000} style={styles.commentInput} /><Pressable disabled={!commentDraft.trim() || commentBusy} onPress={() => void addComment(post.id)} style={styles.commentSend}><Text style={styles.commentSendText}>{commentBusy ? "…" : "Send"}</Text></Pressable></View>
          </View> : null}</> : null}
        </View>)}
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function PollCard({ post, isAdmin, voting, onVote }: { post: NewsPost; isAdmin: boolean; voting: boolean; onVote: (index: number) => void }) {
  const options = Array.isArray(post.poll_options) ? post.poll_options : [];
  const showResults = isAdmin || post.votedOption != null;
  const totalVotes = isAdmin ? (post.pollResults ?? []).reduce((sum, result) => sum + (result.vote_count ?? 0), 0) : null;
  return <View style={styles.pollCard}>
    <Text style={styles.pollHint}>{showResults ? (isAdmin ? `${totalVotes} ${totalVotes === 1 ? "vote" : "votes"}` : "Vote submitted · members can only vote once") : "Choose one option to see the results"}</Text>
    {options.map((label, index) => {
      const result = post.pollResults?.find((row) => row.option_index === index);
      const percentage = showResults ? Number(result?.percentage ?? 0) : 0;
      return <PollChoice key={`${post.id}-${index}`} label={label} percentage={percentage} voteCount={isAdmin ? result?.vote_count ?? 0 : null} showResults={showResults} selected={post.votedOption === index} disabled={voting || (!isAdmin && post.votedOption != null) || post.votedOption === index} onPress={() => onVote(index)} />;
    })}
  </View>;
}

function PollChoice({ label, percentage, voteCount, showResults, selected, disabled, onPress }: { label: string; percentage: number; voteCount: number | null; showResults: boolean; selected: boolean; disabled: boolean; onPress: () => void }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: showResults ? percentage : 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [percentage, progress, showResults]);
  const width = progress.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[styles.pollOption, selected && styles.pollOptionSelected, disabled && !selected && styles.pollOptionDisabled]}>
    {showResults && <Animated.View pointerEvents="none" style={[styles.pollFill, { width }]} />}
    <View style={styles.pollOptionTextRow}><Text style={styles.pollOptionText}>{label}</Text>{showResults && <Text style={styles.pollPercent}>{percentage}%{voteCount == null ? "" : ` · ${voteCount}`}</Text>}</View>
  </Pressable>;
}

const styles = StyleSheet.create({ content: { padding: 20, paddingTop: 16, paddingBottom: 30, gap: 16 }, heading: { gap: 6 }, title: { color: theme.colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -0.8 }, subtitle: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 }, composer: { backgroundColor: theme.colors.panel, borderWidth: 1, borderColor: theme.colors.lineSoft, borderRadius: 20, padding: 15, gap: 12 }, composerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, composerLabel: { color: theme.colors.muted, fontSize: 10, fontWeight: "700" }, modePicker: { flexDirection: "row", alignSelf: "flex-start", padding: 3, borderRadius: 12, backgroundColor: theme.colors.bgRaised }, modeButton: { minWidth: 76, alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9 }, modeButtonSelected: { backgroundColor: theme.colors.brand }, modeText: { color: theme.colors.muted, fontSize: 11, fontWeight: "800" }, modeTextSelected: { color: theme.colors.bg }, pollComposerOptions: { gap: 8 }, pollComposerRow: { flexDirection: "row", alignItems: "center", gap: 8 }, pollComposerInput: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: theme.colors.line, borderRadius: 12, paddingHorizontal: 11, color: theme.colors.text, backgroundColor: theme.colors.bgRaised, fontSize: 12 }, pollRemove: { color: theme.colors.red, fontSize: 22, paddingHorizontal: 6 }, addChoice: { alignSelf: "flex-start", paddingVertical: 7, paddingHorizontal: 5 }, addChoiceText: { color: theme.colors.brand, fontSize: 11, fontWeight: "800" }, pollBadge: { color: theme.colors.brand, backgroundColor: theme.colors.brandDeep, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 8, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 }, pollCard: { gap: 8, paddingTop: 2, paddingBottom: 3 }, pollHint: { color: theme.colors.muted, fontSize: 10, fontWeight: "700", marginBottom: 2 }, pollOption: { minHeight: 44, justifyContent: "center", overflow: "hidden", position: "relative", borderWidth: 1, borderColor: theme.colors.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.colors.bgRaised }, pollOptionSelected: { borderColor: theme.colors.brand }, pollOptionDisabled: { opacity: 0.65 }, pollFill: { position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: 10, backgroundColor: theme.colors.brandDeep }, pollOptionTextRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, pollOptionText: { flex: 1, color: theme.colors.text, fontSize: 11, fontWeight: "700" }, pollPercent: { color: theme.colors.brand, fontSize: 10, fontWeight: "900" }, adminBadge: { color: theme.colors.brand, backgroundColor: theme.colors.brandDeep, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 8, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 }, composerInput: { minHeight: 72, maxHeight: 170, color: theme.colors.text, fontSize: 13, lineHeight: 19, textAlignVertical: "top" }, composerActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, attachButton: { flexDirection: "row", alignItems: "center", gap: 7 }, attachGlyph: { color: theme.colors.brand, fontSize: 18 }, attachText: { color: theme.colors.muted, fontSize: 10, fontWeight: "700" }, publishButton: { backgroundColor: theme.colors.brand, paddingHorizontal: 17, paddingVertical: 9, borderRadius: 13 }, publishText: { color: theme.colors.bg, fontSize: 11, fontWeight: "900" }, disabled: { opacity: 0.5 }, mediaPreview: { position: "relative" }, previewImage: { height: 150, borderRadius: 14, backgroundColor: theme.colors.bgRaised }, previewVideo: { padding: 16, color: theme.colors.brand, backgroundColor: theme.colors.bgRaised, borderRadius: 14, fontSize: 12, fontWeight: "700" }, removeMedia: { position: "absolute", top: 7, right: 7, width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bg }, removeMediaText: { color: theme.colors.text, fontSize: 19 }, empty: { padding: 27, alignItems: "center", gap: 8, borderWidth: 1, borderColor: theme.colors.lineSoft, backgroundColor: theme.colors.panel, borderRadius: 20 }, emptyGlyph: { color: theme.colors.brand, fontSize: 24 }, emptyTitle: { color: theme.colors.text, fontSize: 15, fontWeight: "900" }, emptyCopy: { color: theme.colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center" }, post: { backgroundColor: theme.colors.panel, borderWidth: 1, borderColor: theme.colors.lineSoft, borderRadius: 20, padding: 14, gap: 12 }, postHead: { flexDirection: "row", alignItems: "center", gap: 9 }, authorAvatar: { width: 39, height: 39, borderRadius: 14, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: theme.colors.brandDeep }, authorPhoto: { width: 39, height: 39 }, authorInitial: { color: theme.colors.brand, fontWeight: "900", fontSize: 15 }, authorCopy: { flex: 1, gap: 3 }, authorName: { color: theme.colors.text, fontWeight: "800", fontSize: 11 }, postTime: { color: theme.colors.subtle, fontSize: 8 }, postBody: { color: theme.colors.text, fontSize: 13, lineHeight: 20 }, postImage: { width: "100%", height: 250, borderRadius: 15, backgroundColor: theme.colors.bgRaised }, videoTile: { height: 190, alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 15, backgroundColor: "#0A120D", borderWidth: 1, borderColor: theme.colors.line }, videoPlay: { color: theme.colors.brand, fontSize: 36 }, videoLabel: { color: theme.colors.muted, fontSize: 11, fontWeight: "700" }, postStats: { flexDirection: "row", justifyContent: "space-between" }, statText: { color: theme.colors.subtle, fontSize: 9 }, postActions: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.lineSoft, paddingVertical: 9, justifyContent: "space-around" }, postAction: { flexDirection: "row", alignItems: "center", gap: 5, padding: 3 }, postActionIcon: { width: 18, height: 18 }, heart: { fontSize: 18, color: theme.colors.muted }, heartLiked: { color: theme.colors.red }, actionLabel: { color: theme.colors.muted, fontSize: 9, fontWeight: "700" }, actionLiked: { color: theme.colors.red }, commentGlyph: { color: theme.colors.brand, fontSize: 15 }, shareGlyph: { color: theme.colors.brand, fontSize: 18, fontWeight: "900", lineHeight: 19 }, deleteGlyph: { color: theme.colors.red, fontSize: 19 }, deleteText: { color: theme.colors.red, fontSize: 9, fontWeight: "700" }, commentArea: { gap: 10 }, anonymousSetting: { gap: 7 }, anonymousToggleRow: { flexDirection: "row", alignItems: "center", gap: 8 }, cosmicToggle: { position: "relative", width: 54, height: 30, borderRadius: 16, borderWidth: 1, overflow: "hidden", justifyContent: "center" }, cosmicStars: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }, cosmicStar: { position: "absolute", width: 2, height: 2, borderRadius: 1, backgroundColor: "#D5FFAD", opacity: 0.75 }, cosmicEnergy: { position: "absolute", top: 0, right: 0, bottom: 0, left: 19 }, cosmicEnergyLine: { position: "absolute", height: 1, borderRadius: 1, backgroundColor: "#B8F27C", opacity: 0.8 }, cosmicOrb: { position: "absolute", left: 3, top: 3, width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: "#B8F27C", backgroundColor: "#263B2A", alignItems: "center", justifyContent: "center", shadowColor: "#B8F27C", shadowOpacity: 0.25, shadowRadius: 5, elevation: 3 }, cosmicOrbInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#B8F27C" }, cosmicOrbRing: { position: "absolute", top: 3, right: 3, bottom: 3, left: 3, borderRadius: 9, borderWidth: 1, borderColor: "rgba(184,242,124,0.35)" }, commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 7 }, commentAvatar: { width: 27, height: 27, borderRadius: 10, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brandDeep }, commentPhoto: { width: 27, height: 27 }, commentInitial: { color: theme.colors.brand, fontSize: 10, fontWeight: "900" }, commentBubble: { flex: 1, backgroundColor: theme.colors.bgRaised, borderRadius: 12, padding: 9, gap: 3 }, commentName: { color: theme.colors.text, fontSize: 9, fontWeight: "900" }, commentText: { color: theme.colors.muted, fontSize: 10, lineHeight: 15 }, commentDelete: { color: theme.colors.red, fontSize: 18, paddingHorizontal: 3 }, commentComposer: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.bgRaised, borderRadius: 13, paddingLeft: 11, paddingRight: 5 }, commentInput: { flex: 1, minHeight: 39, color: theme.colors.text, fontSize: 10 }, commentSend: { backgroundColor: theme.colors.brand, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10 }, commentSendText: { color: theme.colors.bg, fontSize: 9, fontWeight: "900" } });
