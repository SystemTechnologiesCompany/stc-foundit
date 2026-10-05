import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Eyebrow, MessageBanner, Screen } from "../../components/ui";
import { theme } from "../../constants/theme";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../providers/AuthProvider";

type PickedMedia = { uri: string; mime: string; extension: string; kind: "image" | "video"; size?: number | null };
type Profile = { display_name: string; avatar_path: string | null; avatarUrl?: string | null };
type NewsPost = { id: string; author_id: string; body: string; media_path: string | null; media_type: "image" | "video" | null; created_at: string; author?: Profile; mediaUrl?: string | null; likeCount: number; commentCount: number; liked: boolean };
type NewsComment = { id: string; post_id: string; user_id: string; content: string; created_at: string; profile?: Profile };

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
  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);

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
    const [{ data: profiles }, { data: likes }, { data: commentRows }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, avatar_path").in("id", profileIds),
      ids.length ? supabase.from("news_likes").select("post_id, user_id").in("post_id", ids) : Promise.resolve({ data: [] as { post_id: string; user_id: string }[] }),
      ids.length ? supabase.from("news_comments").select("post_id").in("post_id", ids) : Promise.resolve({ data: [] as { post_id: string }[] }),
    ]);
    const profileMap = new Map<string, Profile>();
    await Promise.all((profiles ?? []).map(async (item) => profileMap.set(item.id, { display_name: item.display_name, avatar_path: item.avatar_path, avatarUrl: await signedUrl("profile-photos", item.avatar_path) })));
    const allLikes = likes ?? [];
    const allComments = commentRows ?? [];
    const hydrated: NewsPost[] = await Promise.all(postRows.map(async (post) => ({
      ...post,
      mediaUrl: await signedUrl("community-media", post.media_path),
      author: profileMap.get(post.author_id),
      likeCount: allLikes.filter((like) => like.post_id === post.id).length,
      commentCount: allComments.filter((comment) => comment.post_id === post.id).length,
      liked: allLikes.some((like) => like.post_id === post.id && like.user_id === user.id),
    })));
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
    if (!user || !isAdmin || busy || (!body.trim() && !media)) return;
    setBusy(true); setError("");
    const { data: post, error: insertError } = await supabase.from("news_posts").insert({ author_id: user.id, body: body.trim(), is_published: false }).select("id").single();
    if (insertError || !post) { setError(insertError?.message ?? "Could not create the post."); setBusy(false); return; }
    if (media) {
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
    setBody(""); setMedia(null); setBusy(false); await load();
  }

  async function toggleLike(post: NewsPost) {
    if (!user) return;
    setPosts((current) => current.map((item) => item.id === post.id ? { ...item, liked: !item.liked, likeCount: item.likeCount + (item.liked ? -1 : 1) } : item));
    const result = post.liked
      ? await supabase.from("news_likes").delete().eq("post_id", post.id).eq("user_id", user.id)
      : await supabase.from("news_likes").insert({ post_id: post.id, user_id: user.id });
    if (result.error) { setError(result.error.message); await load(); }
  }

  async function openComments(post: NewsPost) {
    if (expandedComments === post.id) { setExpandedComments(null); return; }
    setExpandedComments(post.id);
    const { data, error: commentError } = await supabase.from("news_comments").select("*, profiles(display_name, avatar_path)").eq("post_id", post.id).order("created_at", { ascending: true });
    if (commentError) { setError(commentError.message); return; }
    const rows = (data ?? []) as unknown as (NewsComment & { profiles?: Profile })[];
    const decorated = await Promise.all(rows.map(async (row) => ({ ...row, profile: row.profiles ? { ...row.profiles, avatarUrl: await signedUrl("profile-photos", row.profiles.avatar_path) } : undefined })));
    setComments(decorated);
  }

  async function addComment(postId: string) {
    if (!user || !commentDraft.trim() || commentBusy) return;
    setCommentBusy(true);
    const { error: insertError } = await supabase.from("news_comments").insert({ post_id: postId, user_id: user.id, content: commentDraft.trim() });
    setCommentBusy(false);
    if (insertError) { setError(insertError.message); return; }
    setCommentDraft("");
    const post = posts.find((item) => item.id === postId);
    if (post) await openCommentsAgain(post);
    setPosts((current) => current.map((item) => item.id === postId ? { ...item, commentCount: item.commentCount + 1 } : item));
  }

  async function openCommentsAgain(post: NewsPost) {
    const { data } = await supabase.from("news_comments").select("*, profiles(display_name, avatar_path)").eq("post_id", post.id).order("created_at", { ascending: true });
    const rows = (data ?? []) as unknown as (NewsComment & { profiles?: Profile })[];
    setComments(await Promise.all(rows.map(async (row) => ({ ...row, profile: row.profiles ? { ...row.profiles, avatarUrl: await signedUrl("profile-photos", row.profiles.avatar_path) } : undefined }))));
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
          <TextInput value={body} onChangeText={setBody} placeholder="What’s happening on campus?" placeholderTextColor={theme.colors.subtle} multiline maxLength={5000} style={styles.composerInput} />
          {media ? <View style={styles.mediaPreview}>{media.kind === "image" ? <Image source={{ uri: media.uri }} style={styles.previewImage} /> : <Text style={styles.previewVideo}>▶  Video ready · {media.size ? `${(media.size / 1048576).toFixed(1)} MB` : "selected"}</Text>}<Pressable onPress={() => setMedia(null)} style={styles.removeMedia}><Text style={styles.removeMediaText}>×</Text></Pressable></View> : null}
          <View style={styles.composerActions}><Pressable onPress={chooseMedia} style={styles.attachButton}><Text style={styles.attachGlyph}>＋</Text><Text style={styles.attachText}>Photo or video</Text></Pressable><Pressable disabled={busy || (!body.trim() && !media)} onPress={publish} style={[styles.publishButton, (busy || (!body.trim() && !media)) && styles.disabled]}><Text style={styles.publishText}>{busy ? "Publishing…" : "Publish"}</Text></Pressable></View>
        </View> : null}
        {error ? <MessageBanner>{error}</MessageBanner> : null}
        {!posts.length ? <View style={styles.empty}><Text style={styles.emptyGlyph}>🥲</Text><Text style={styles.emptyTitle}>The community board is quiet</Text><Text style={styles.emptyCopy}>Official updates from the FoundIt team will show up here.</Text></View> : null}
        {posts.map((post) => <View key={post.id} style={styles.post}>
          <View style={styles.postHead}><View style={styles.authorAvatar}>{post.author?.avatarUrl ? <Image source={{ uri: post.author.avatarUrl }} style={styles.authorPhoto} /> : <Text style={styles.authorInitial}>{(post.author?.display_name ?? "F").slice(0, 1).toUpperCase()}</Text>}</View><View style={styles.authorCopy}><Text style={styles.authorName}>{post.author?.display_name ?? "FoundIt Admin"}</Text><Text style={styles.postTime}>{new Date(post.created_at).toLocaleString()}</Text></View><Text style={styles.adminBadge}>ADMIN</Text></View>
          {post.body ? <Text style={styles.postBody}>{post.body}</Text> : null}
          {post.mediaUrl && post.media_type === "image" ? <Image source={{ uri: post.mediaUrl }} style={styles.postImage} resizeMode="cover" /> : null}
          {post.mediaUrl && post.media_type === "video" ? <Pressable style={styles.videoTile} onPress={() => { void Linking.openURL(post.mediaUrl!); }}><Text style={styles.videoPlay}>▶</Text><Text style={styles.videoLabel}>Play community video</Text></Pressable> : null}
          <View style={styles.postStats}><Text style={styles.statText}>{post.likeCount} {post.likeCount === 1 ? "like" : "likes"}</Text><Pressable onPress={() => void openComments(post)}><Text style={styles.statText}>{post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}</Text></Pressable></View>
          <View style={styles.postActions}><Pressable onPress={() => void toggleLike(post)} style={styles.postAction}><Text style={[styles.heart, post.liked && styles.heartLiked]}>{post.liked ? "♥" : "♡"}</Text><Text style={[styles.actionLabel, post.liked && styles.actionLiked]}>{post.liked ? "Liked" : "Like"}</Text></Pressable><Pressable onPress={() => void openComments(post)} style={styles.postAction}><Text style={styles.commentGlyph}>◌</Text><Text style={styles.actionLabel}>Comment</Text></Pressable>{isAdmin ? <Pressable onPress={() => void deletePost(post)} style={styles.postAction}><Text style={styles.deleteGlyph}>×</Text><Text style={styles.deleteText}>Delete post</Text></Pressable> : null}</View>
          {expandedComments === post.id ? <View style={styles.commentArea}>
            {comments.map((comment) => <View key={comment.id} style={styles.commentRow}><View style={styles.commentAvatar}>{comment.profile?.avatarUrl ? <Image source={{ uri: comment.profile.avatarUrl }} style={styles.commentPhoto} /> : <Text style={styles.commentInitial}>{(comment.profile?.display_name ?? "M").slice(0, 1).toUpperCase()}</Text>}</View><View style={styles.commentBubble}><Text style={styles.commentName}>{comment.profile?.display_name ?? "Member"}</Text><Text style={styles.commentText}>{comment.content}</Text></View>{(comment.user_id === user?.id || isAdmin) ? <Pressable accessibilityLabel="Delete comment" onPress={() => void deleteComment(comment)}><Text style={styles.commentDelete}>×</Text></Pressable> : null}</View>)}
            <View style={styles.commentComposer}><TextInput value={commentDraft} onChangeText={setCommentDraft} placeholder="Write a comment…" placeholderTextColor={theme.colors.subtle} maxLength={2000} style={styles.commentInput} /><Pressable disabled={!commentDraft.trim() || commentBusy} onPress={() => void addComment(post.id)} style={styles.commentSend}><Text style={styles.commentSendText}>{commentBusy ? "…" : "Send"}</Text></Pressable></View>
          </View> : null}
        </View>)}
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { padding: 20, paddingTop: 16, paddingBottom: 30, gap: 16 }, heading: { gap: 6 }, title: { color: theme.colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -0.8 }, subtitle: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 }, composer: { backgroundColor: theme.colors.panel, borderWidth: 1, borderColor: theme.colors.lineSoft, borderRadius: 20, padding: 15, gap: 12 }, composerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, composerLabel: { color: theme.colors.muted, fontSize: 10, fontWeight: "700" }, adminBadge: { color: theme.colors.brand, backgroundColor: theme.colors.brandDeep, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 8, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 }, composerInput: { minHeight: 72, maxHeight: 170, color: theme.colors.text, fontSize: 13, lineHeight: 19, textAlignVertical: "top" }, composerActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, attachButton: { flexDirection: "row", alignItems: "center", gap: 7 }, attachGlyph: { color: theme.colors.brand, fontSize: 18 }, attachText: { color: theme.colors.muted, fontSize: 10, fontWeight: "700" }, publishButton: { backgroundColor: theme.colors.brand, paddingHorizontal: 17, paddingVertical: 9, borderRadius: 13 }, publishText: { color: theme.colors.bg, fontSize: 11, fontWeight: "900" }, disabled: { opacity: 0.5 }, mediaPreview: { position: "relative" }, previewImage: { height: 150, borderRadius: 14, backgroundColor: theme.colors.bgRaised }, previewVideo: { padding: 16, color: theme.colors.brand, backgroundColor: theme.colors.bgRaised, borderRadius: 14, fontSize: 12, fontWeight: "700" }, removeMedia: { position: "absolute", top: 7, right: 7, width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bg }, removeMediaText: { color: theme.colors.text, fontSize: 19 }, empty: { padding: 27, alignItems: "center", gap: 8, borderWidth: 1, borderColor: theme.colors.lineSoft, backgroundColor: theme.colors.panel, borderRadius: 20 }, emptyGlyph: { color: theme.colors.brand, fontSize: 24 }, emptyTitle: { color: theme.colors.text, fontSize: 15, fontWeight: "900" }, emptyCopy: { color: theme.colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center" }, post: { backgroundColor: theme.colors.panel, borderWidth: 1, borderColor: theme.colors.lineSoft, borderRadius: 20, padding: 14, gap: 12 }, postHead: { flexDirection: "row", alignItems: "center", gap: 9 }, authorAvatar: { width: 39, height: 39, borderRadius: 14, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: theme.colors.brandDeep }, authorPhoto: { width: 39, height: 39 }, authorInitial: { color: theme.colors.brand, fontWeight: "900", fontSize: 15 }, authorCopy: { flex: 1, gap: 3 }, authorName: { color: theme.colors.text, fontWeight: "800", fontSize: 11 }, postTime: { color: theme.colors.subtle, fontSize: 8 }, postBody: { color: theme.colors.text, fontSize: 13, lineHeight: 20 }, postImage: { width: "100%", height: 250, borderRadius: 15, backgroundColor: theme.colors.bgRaised }, videoTile: { height: 190, alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 15, backgroundColor: "#0A120D", borderWidth: 1, borderColor: theme.colors.line }, videoPlay: { color: theme.colors.brand, fontSize: 36 }, videoLabel: { color: theme.colors.muted, fontSize: 11, fontWeight: "700" }, postStats: { flexDirection: "row", justifyContent: "space-between" }, statText: { color: theme.colors.subtle, fontSize: 9 }, postActions: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.lineSoft, paddingVertical: 9, justifyContent: "space-around" }, postAction: { flexDirection: "row", alignItems: "center", gap: 5, padding: 3 }, heart: { fontSize: 18, color: theme.colors.muted }, heartLiked: { color: theme.colors.red }, actionLabel: { color: theme.colors.muted, fontSize: 9, fontWeight: "700" }, actionLiked: { color: theme.colors.red }, commentGlyph: { color: theme.colors.brand, fontSize: 15 }, deleteGlyph: { color: theme.colors.red, fontSize: 19 }, deleteText: { color: theme.colors.red, fontSize: 9, fontWeight: "700" }, commentArea: { gap: 10 }, commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 7 }, commentAvatar: { width: 27, height: 27, borderRadius: 10, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brandDeep }, commentPhoto: { width: 27, height: 27 }, commentInitial: { color: theme.colors.brand, fontSize: 10, fontWeight: "900" }, commentBubble: { flex: 1, backgroundColor: theme.colors.bgRaised, borderRadius: 12, padding: 9, gap: 3 }, commentName: { color: theme.colors.text, fontSize: 9, fontWeight: "900" }, commentText: { color: theme.colors.muted, fontSize: 10, lineHeight: 15 }, commentDelete: { color: theme.colors.red, fontSize: 18, paddingHorizontal: 3 }, commentComposer: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.bgRaised, borderRadius: 13, paddingLeft: 11, paddingRight: 5 }, commentInput: { flex: 1, minHeight: 39, color: theme.colors.text, fontSize: 10 }, commentSend: { backgroundColor: theme.colors.brand, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10 }, commentSendText: { color: theme.colors.bg, fontSize: 9, fontWeight: "900" } });
