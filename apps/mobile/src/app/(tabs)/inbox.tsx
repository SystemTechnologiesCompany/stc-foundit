import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Animated, Easing, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { EmptyState, Eyebrow, MessageBanner, Screen } from "../../components/ui";
import { formatAge } from "../../components/ReportCard";
import { theme } from "../../constants/theme";
import { friendlyError } from "../../lib/reports";
import { supabase } from "../../lib/supabase";

type Thread = { id: string; title: string; reportId: string; preview: string; time: string; unread?: boolean };

async function removeConversationImages(conversationId: string) {
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

export default function InboxScreen() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmThread, setConfirmThread] = useState<Thread | null>(null);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const closing = useRef(false);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true); else setLoading(true);
    setError("");
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) { setLoading(false); setRefreshing(false); return; }
    const { data, error: queryError } = await supabase.from("conversation_members")
      .select("conversation_id, last_read_at, conversations(id, report_id, created_at, reports(title))")
      .eq("user_id", authData.user.id);
    if (queryError) { setError(friendlyError(queryError.message)); setLoading(false); setRefreshing(false); return; }
    const memberships = (data ?? []) as unknown as { conversation_id: string; last_read_at?: string; conversations: { id: string; report_id: string; created_at: string; reports?: { title?: string } | null } | null }[];
    const built = await Promise.all(memberships.filter((item) => item.conversations?.id).map(async (item) => {
      const convo = item.conversations!;
      const { data: messages } = await supabase.from("messages").select("content, sender_id, created_at")
        .eq("conversation_id", convo.id).order("created_at", { ascending: false }).limit(1);
      const latest = messages?.[0];
      return { id: convo.id, reportId: convo.report_id, title: convo.reports?.title ?? "FoundIt conversation", preview: latest?.content ?? "Say hello and start the conversation", time: latest?.created_at ?? convo.created_at, unread: Boolean(latest && latest.sender_id !== authData.user!.id && latest.created_at > (item.last_read_at ?? "")) };
    }));
    setThreads(built.sort((a, b) => b.time.localeCompare(a.time)));
    setLoading(false); setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function confirmRemove(thread: Thread) {
    closing.current = false;
    backdropOpacity.setValue(0);
    cardScale.setValue(0.92);
    setConfirmThread(thread);
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 190, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, damping: 17, stiffness: 210, mass: 0.8, useNativeDriver: true }),
    ]).start();
  }

  function dismissConfirm(deleteFor: "me" | "everyone" | null = null) {
    if (!confirmThread || closing.current) return;
    closing.current = true;
    const conversationId = confirmThread.id;
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 140, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 0.96, duration: 140, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setConfirmThread(null);
      closing.current = false;
      if (deleteFor) void removeConversation(conversationId, deleteFor === "everyone");
    });
  }

  async function removeConversation(conversationId: string, forEveryone = false) {
    if (deletingId) return;
    setDeletingId(conversationId);
    setError("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setError("Please sign in again to delete this conversation.");
      setDeletingId(null);
      return;
    }
    if (forEveryone) {
      const imageError = await removeConversationImages(conversationId);
      if (imageError) {
        setError(`Could not remove the conversation photos: ${imageError.message}`);
        setDeletingId(null);
        return;
      }
    }
    const result = forEveryone
      ? await supabase.rpc("delete_conversation_for_everyone", { p_conversation_id: conversationId })
      : await supabase.from("conversation_members").delete().eq("conversation_id", conversationId).eq("user_id", authData.user.id);
    const deleteError = result.error;
    if (deleteError) {
      setError(friendlyError(deleteError.message));
      setDeletingId(null);
      return;
    }
    setThreads((current) => current.filter((thread) => thread.id !== conversationId));
    setDeletingId(null);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.colors.brand} colors={[theme.colors.brand]} />} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}><Eyebrow>A LITTLE CONNECTION GOES A LONG WAY</Eyebrow><Text style={styles.title}>Messages</Text><Text style={styles.subtitle}>Private conversations about getting things home.</Text></View>
        <View style={styles.secureNote}><Text style={styles.lock}>◇</Text><Text style={styles.secureText}>Only you and the other member can read these chats.</Text></View>
        {error ? <MessageBanner>{error}</MessageBanner> : null}
        {loading && threads.length === 0 ? <View style={styles.emptyLoading}><Text style={styles.muted}>Loading your conversations…</Text></View> : null}
        {!loading && !error && threads.length === 0 ? <EmptyState icon="◌" title="Your inbox is a clean slate" body="Found someone’s item? Open their report and say hello. We’ll keep the conversation private." /> : null}
        <View style={styles.list}>
          {threads.map((thread) => (
            <View key={thread.id} style={styles.thread}>
              <Pressable onPress={() => router.push(`/messages/${thread.id}`)} style={({ pressed }) => [styles.threadMain, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Open conversation about ${thread.title}`}>
                <View style={styles.avatar}><Text style={styles.avatarGlyph}>✉</Text></View>
                <View style={styles.threadBody}>
                  <View style={styles.threadTop}><Text style={styles.threadTitle} numberOfLines={1}>{thread.title}</Text><Text style={styles.time}>{formatAge(thread.time)}</Text></View>
                  <Text style={styles.preview} numberOfLines={1}>{thread.preview}</Text>
                  <Text style={styles.context}>ABOUT A CAMPUS REPORT</Text>
                </View>
                {thread.unread ? <View style={styles.unreadDot} /> : <Text style={styles.arrow}>›</Text>}
              </Pressable>
              <Pressable onPress={() => confirmRemove(thread)} disabled={deletingId === thread.id} style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed, deletingId === thread.id && styles.deleteDisabled]} accessibilityRole="button" accessibilityLabel={`Delete conversation about ${thread.title}`}>
                <Text style={styles.deleteGlyph}>{deletingId === thread.id ? "…" : "×"}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
      <Modal visible={confirmThread !== null} transparent animationType="none" statusBarTranslucent onRequestClose={() => dismissConfirm()}>
        <View style={styles.modalRoot}>
          <Animated.View pointerEvents="none" style={[styles.modalBackdrop, { opacity: backdropOpacity }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => dismissConfirm()} accessibilityRole="button" accessibilityLabel="Close delete confirmation" />
          <Animated.View style={[styles.confirmCard, { opacity: backdropOpacity, transform: [{ scale: cardScale }] }]}>
            <View style={styles.confirmTop}>
              <View style={styles.confirmIcon}><Text style={styles.confirmIconText}>×</Text></View>
              <View style={styles.confirmEyebrow}><View style={styles.confirmDot} /><Text style={styles.confirmEyebrowText}>INBOX CONTROL</Text></View>
            </View>
            <Text style={styles.confirmTitle}>Delete conversation</Text>
            <Text style={styles.confirmCopy}>Choose how you want to remove “{confirmThread?.title ?? "FoundIt conversation"}”.</Text>
            <View style={styles.confirmNote}><Text style={styles.confirmNoteGlyph}>◇</Text><Text style={styles.confirmNoteText}>Delete for me removes it from your inbox. Delete for everyone permanently erases the conversation and its messages for both people.</Text></View>
            <Pressable onPress={() => dismissConfirm("me")} style={({ pressed }) => [styles.cancelAction, { flex: 0, width: "100%", minHeight: 53, alignItems: "flex-start", paddingHorizontal: 15, borderColor: "#593332", backgroundColor: "#211918" }, pressed && styles.actionPressed]} accessibilityRole="button"><Text style={[styles.cancelActionText, { color: "#F0A69B" }]}>Delete for me</Text><Text style={{ color: theme.colors.muted, fontSize: 9, marginTop: 3 }}>The other person keeps their copy</Text></Pressable>
            <Pressable onPress={() => dismissConfirm("everyone")} style={({ pressed }) => [styles.deleteAction, { flex: 0, width: "100%" }, pressed && styles.actionPressed]} accessibilityRole="button"><Text style={styles.deleteActionText}>Delete for everyone</Text></Pressable>
            <Pressable onPress={() => dismissConfirm()} style={({ pressed }) => [styles.cancelAction, { flex: 0, width: "100%" }, pressed && styles.actionPressed]} accessibilityRole="button"><Text style={styles.cancelActionText}>Keep conversation</Text></Pressable>
          </Animated.View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { padding: 21, paddingTop: 17, paddingBottom: 30, gap: 18 }, heading: { gap: 7 }, title: { color: theme.colors.text, fontSize: 29, fontWeight: "900", letterSpacing: -0.8 }, subtitle: { color: theme.colors.muted, fontSize: 12 }, secureNote: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#111D15", borderRadius: 13, borderWidth: 1, borderColor: theme.colors.lineSoft, padding: 12 }, lock: { color: theme.colors.brand, fontSize: 17 }, secureText: { color: theme.colors.muted, fontSize: 10, fontWeight: "600", flex: 1 }, emptyLoading: { padding: 35, alignItems: "center" }, muted: { color: theme.colors.muted, fontSize: 12 }, list: { gap: 9 }, thread: { flexDirection: "row", gap: 5, alignItems: "center", borderRadius: 18, borderWidth: 1, borderColor: theme.colors.lineSoft, backgroundColor: theme.colors.panel, padding: 7 }, threadMain: { flex: 1, flexDirection: "row", gap: 10, alignItems: "center", padding: 7 }, avatar: { width: 45, height: 45, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brandDeep }, avatarGlyph: { color: theme.colors.brand, fontSize: 19 }, threadBody: { flex: 1, gap: 5 }, threadTop: { flexDirection: "row", justifyContent: "space-between", gap: 7, alignItems: "center" }, threadTitle: { color: theme.colors.text, fontSize: 13, fontWeight: "800", flex: 1 }, time: { color: theme.colors.subtle, fontSize: 9 }, preview: { color: theme.colors.muted, fontSize: 11 }, context: { color: theme.colors.subtle, fontSize: 8, fontWeight: "800", letterSpacing: 0.8 }, unreadDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: theme.colors.brand }, arrow: { color: theme.colors.subtle, fontSize: 21 }, deleteButton: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#2A1918", borderWidth: 1, borderColor: "#593332" }, deleteGlyph: { color: "#F0A69B", fontSize: 23, lineHeight: 25, fontWeight: "700" }, deleteDisabled: { opacity: 0.5 }, pressed: { opacity: 0.76 }, modalRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }, modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(2, 8, 5, 0.78)" }, confirmCard: { width: "100%", maxWidth: 390, borderRadius: 26, padding: 22, backgroundColor: "#101B14", borderWidth: 1, borderColor: "#344936", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 18, gap: 13 }, confirmTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, confirmIcon: { width: 47, height: 47, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#2A1918", borderWidth: 1, borderColor: "#593332" }, confirmIconText: { color: "#F0A69B", fontSize: 30, lineHeight: 33, fontWeight: "500" }, confirmEyebrow: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, backgroundColor: "#19271B" }, confirmDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: theme.colors.brand }, confirmEyebrowText: { color: theme.colors.brand, fontSize: 8, fontWeight: "900", letterSpacing: 1.1 }, confirmTitle: { color: theme.colors.text, fontSize: 21, fontWeight: "900", letterSpacing: -0.5, marginTop: 2 }, confirmCopy: { color: theme.colors.muted, fontSize: 13, lineHeight: 19 }, confirmNote: { flexDirection: "row", gap: 9, alignItems: "center", padding: 12, borderRadius: 15, backgroundColor: "#151F18", borderWidth: 1, borderColor: theme.colors.lineSoft }, confirmNoteGlyph: { color: theme.colors.brand, fontSize: 18 }, confirmNoteText: { color: "#AEBBA9", fontSize: 10, lineHeight: 15, flex: 1 }, confirmActions: { flexDirection: "row", gap: 10, marginTop: 3 }, cancelAction: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 15, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: "#152019" }, cancelActionText: { color: theme.colors.text, fontSize: 12, fontWeight: "800" }, deleteAction: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 15, borderWidth: 1, borderColor: "#75433B", backgroundColor: "#432521" }, deleteActionText: { color: "#FFB9AD", fontSize: 12, fontWeight: "900" }, actionPressed: { opacity: 0.78, transform: [{ scale: 0.98 }] } });
