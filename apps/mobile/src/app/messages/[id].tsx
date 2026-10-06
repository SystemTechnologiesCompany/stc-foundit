import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { I18nText as Text, I18nTextInput as TextInput } from "../../components/LocalizedText";
import type { Message } from "@stc-foundit/shared";
import { AppIcon, Eyebrow, MessageBanner, Screen } from "../../components/ui";
import { theme } from "../../constants/theme";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../providers/AuthProvider";

type ChatMessage = Message & { attachment_path?: string | null; imageUrl?: string | null };
type PendingPhoto = { uri: string; mime: string; extension: string; size?: number | null };
const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024;

async function addSignedImage(message: ChatMessage): Promise<ChatMessage> {
  if (!message.attachment_path) return message;
  const { data, error } = await supabase.storage.from("message-images").createSignedUrl(message.attachment_path, 15 * 60);
  return { ...message, imageUrl: error ? null : data.signedUrl };
}

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const activeUserId = user?.id ?? null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [title, setTitle] = useState("FoundIt conversation");
  const [isAdminThread, setIsAdminThread] = useState(false);
  const [content, setContent] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    if (!id || !activeUserId) return;
    const userId = activeUserId;
    let alive = true;
    async function load() {
      const [{ data: convo }, { data: rows, error: queryError }, { data: viewerProfile }] = await Promise.all([
        supabase.from("conversations").select("report_id, admin_recipient_id, reports(title)").eq("id", id).single(),
        supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true }),
        supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle(),
      ]);
      if (!alive) return;
      const linked = convo as unknown as { admin_recipient_id?: string | null; reports?: { title?: string } } | null;
      const supportThread = Boolean(linked?.admin_recipient_id);
      setIsAdminThread(supportThread);
      if (supportThread) {
        if (linked?.admin_recipient_id === userId) setTitle("FoundIt Admin");
        else if (viewerProfile?.is_admin && linked?.admin_recipient_id) {
          const { data: recipient } = await supabase.from("profiles").select("display_name").eq("id", linked.admin_recipient_id).maybeSingle();
          setTitle(`Chat with ${recipient?.display_name ?? "member"}`);
        } else setTitle("FoundIt Admin");
      } else setTitle(linked?.reports?.title ?? "FoundIt conversation");
      if (queryError) setError(queryError.message);
      const withImages = await Promise.all(((rows ?? []) as ChatMessage[]).map(addSignedImage));
      if (!alive) return;
      setMessages(withImages);
      setLoading(false);
      void supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", id).eq("user_id", userId);
    }
    void load();
    const channel = supabase.channel(`mobile-messages:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` }, (payload) => {
        const message = payload.new as ChatMessage;
        void addSignedImage(message).then((messageWithImage) => {
          setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, messageWithImage]);
        });
        if (message.sender_id !== userId) void supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", id).eq("user_id", userId);
      }).subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [id, activeUserId]);

  useEffect(() => { if (messages.length) scroll.current?.scrollToEnd({ animated: true }); }, [messages.length]);

  async function pickPhoto() {
    if (sending) return;
    setError("");
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: false, quality: 0.82 });
    } catch {
      setError("Could not open your photo library. Check the app’s photo permission and try again.");
      return;
    }
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const mime = (asset.mimeType ?? "image/jpeg").toLowerCase();
    const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    if (!extensions[mime]) { setError("Choose a JPG, PNG, or WebP image."); return; }
    if ((asset.fileSize ?? 0) > MAX_CHAT_IMAGE_BYTES) { setError("Choose an image smaller than 5 MB."); return; }
    setPendingPhoto({ uri: asset.uri, mime, extension: extensions[mime], size: asset.fileSize });
  }

  async function send() {
    const trimmed = content.trim();
    if ((!trimmed && !pendingPhoto) || !user || sending) return;
    setSending(true); setError("");
    let attachmentPath: string | null = null;
    if (pendingPhoto) {
      attachmentPath = `${id}/${user.id}/${Date.now()}.${pendingPhoto.extension}`;
      try {
        const bytes = await new File(pendingPhoto.uri).arrayBuffer();
        const { error: uploadError } = await supabase.storage.from("message-images").upload(attachmentPath, bytes, { contentType: pendingPhoto.mime, upsert: false });
        if (uploadError) throw uploadError;
      } catch (cause) {
        setSending(false);
        setError(cause instanceof Error ? cause.message : "The photo could not be uploaded. Try again.");
        return;
      }
    }
    const { data: inserted, error: sendError } = await supabase.from("messages").insert({ conversation_id: id, sender_id: user.id, content: trimmed || "Photo", attachment_path: attachmentPath }).select("*").single();
    if (sendError || !inserted) {
      if (attachmentPath) void supabase.storage.from("message-images").remove([attachmentPath]);
      setSending(false);
      setError(sendError?.message ?? "Your message could not be sent.");
      return;
    }
    const sentMessage = await addSignedImage(inserted as ChatMessage);
    setMessages((current) => current.some((item) => item.id === sentMessage.id) ? current : [...current, sentMessage]);
    setSending(false);
    setContent("");
    setPendingPhoto(null);
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={5}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable>
          <View style={styles.headAvatar}><AppIcon name="messages" size={20} /></View>
          <View style={styles.headCopy}><Text style={styles.title} numberOfLines={1}>{title}</Text><View style={styles.privateRow}><View style={styles.privateDot} /><Text style={styles.privateText}>PRIVATE CAMPUS CHAT</Text></View></View>
          <Pressable onPress={() => router.push("/(tabs)/inbox")} style={styles.more}><Text style={styles.moreGlyph}>···</Text></Pressable>
        </View>
        <View style={styles.notice}><Text style={styles.noticeGlyph}>◇</Text><Text style={styles.noticeText}>{isAdminThread ? "Private chat with the FoundIt admin team. Reply here if you need help or want to respond to a warning." : "Confirm one detail that wasn’t included in the report. Keep personal contact details private."}</Text></View>
        <ScrollView ref={scroll} contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.day}><View style={styles.dayLine} /><Eyebrow>YOUR CONVERSATION</Eyebrow><View style={styles.dayLine} /></View>
          {loading ? <Text style={styles.emptyText}>Loading your private chat…</Text> : null}
          {!loading && messages.length === 0 ? <View style={styles.firstMessage}><View style={styles.firstIcon}><AppIcon name="messages" size={23} /></View><Text style={styles.firstTitle}>Start with a kind hello.</Text><Text style={styles.firstCopy}>Share the report detail you’re asking about and take it from there.</Text></View> : null}
          {messages.map((message) => {
            const mine = message.sender_id === user?.id;
            return <View key={message.id} style={[styles.messageRow, mine ? styles.mineRow : styles.theirsRow]}><View style={[styles.bubble, mine ? styles.mineBubble : styles.theirsBubble]}>{message.imageUrl ? <Image source={{ uri: message.imageUrl }} style={photoStyles.messageImage} accessibilityLabel="Photo shared in this conversation" /> : null}{message.content !== "Photo" || !message.attachment_path ? <Text style={[styles.bubbleText, mine && styles.mineText]}>{message.content}</Text> : null}<Text style={[styles.messageTime, mine && styles.mineTime]}>{new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text></View></View>;
          })}
          {error ? <MessageBanner>{error}</MessageBanner> : null}
        </ScrollView>
        <View style={styles.composerArea}>
          {pendingPhoto ? <View style={photoStyles.pendingPhoto}><Image source={{ uri: pendingPhoto.uri }} style={photoStyles.pendingImage} /><View style={photoStyles.pendingCopy}><Text style={photoStyles.pendingTitle}>Photo ready to send</Text><Text style={photoStyles.pendingHint}>{pendingPhoto.size ? `${(pendingPhoto.size / (1024 * 1024)).toFixed(1)} MB` : "Image attachment"}</Text></View><Pressable onPress={() => setPendingPhoto(null)} style={photoStyles.removePhoto} accessibilityRole="button" accessibilityLabel="Remove selected photo"><Text style={photoStyles.removePhotoGlyph}>×</Text></Pressable></View> : null}
          <View style={styles.composer}>
            <Pressable onPress={pickPhoto} disabled={sending} style={({ pressed }) => [photoStyles.photoButton, pressed && photoStyles.pressed, sending && photoStyles.disabled]} accessibilityRole="button" accessibilityLabel="Choose a photo"><Text style={photoStyles.photoGlyph}><Image
  source={require("../../../assets/photo-icon.png")}
  style={{ width: 22, height: 22 }}
  resizeMode="contain"
/></Text></Pressable>
            <TextInput value={content} onChangeText={setContent} placeholder="Write a thoughtful message…" placeholderTextColor={theme.colors.subtle} multiline maxLength={2000} style={styles.input} onSubmitEditing={send} />
            <Pressable onPress={send} disabled={(!content.trim() && !pendingPhoto) || sending} style={[styles.send, ((!content.trim() && !pendingPhoto) || sending) && styles.sendDisabled]}><Text style={styles.sendGlyph}>{sending ? "…" : "↑"}</Text></Pressable>
          </View>
          <Text style={styles.composerHint}>Keep it kind. Meet somewhere public on campus.</Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft }, back: { width: 29 }, backGlyph: { color: theme.colors.brand, fontSize: 31 }, headAvatar: { width: 41, height: 41, borderRadius: 15, backgroundColor: theme.colors.brandDeep, borderWidth: 1, borderColor: "#31533A", alignItems: "center", justifyContent: "center" }, headAvatarGlyph: { color: theme.colors.brand, fontSize: 18 }, headCopy: { flex: 1, gap: 5 }, title: { color: theme.colors.text, fontSize: 12, fontWeight: "900" }, privateRow: { flexDirection: "row", alignItems: "center", gap: 5 }, privateDot: { width: 5, height: 5, borderRadius: 4, backgroundColor: theme.colors.brand }, privateText: { color: theme.colors.subtle, fontSize: 8, letterSpacing: 1, fontWeight: "800" }, more: { width: 27, alignItems: "center" }, moreGlyph: { color: theme.colors.muted, fontSize: 19 }, notice: { flexDirection: "row", gap: 9, alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#111D15", borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft }, noticeGlyph: { color: theme.colors.brand, fontSize: 17 }, noticeText: { color: theme.colors.muted, fontSize: 9, lineHeight: 14, flex: 1 }, messages: { padding: 18, paddingBottom: 20, gap: 13, flexGrow: 1, justifyContent: "flex-end" }, day: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 9 }, dayLine: { width: 34, height: 1, backgroundColor: theme.colors.line }, messageRow: { flexDirection: "row" }, mineRow: { justifyContent: "flex-end" }, theirsRow: { justifyContent: "flex-start" }, bubble: { maxWidth: "84%", paddingHorizontal: 14, paddingTop: 11, paddingBottom: 8, borderRadius: 18, gap: 5 }, mineBubble: { backgroundColor: theme.colors.brand, borderBottomRightRadius: 5 }, theirsBubble: { backgroundColor: theme.colors.panel, borderWidth: 1, borderColor: theme.colors.lineSoft, borderBottomLeftRadius: 5 }, bubbleText: { color: theme.colors.text, fontSize: 13, lineHeight: 19 }, mineText: { color: theme.colors.bg }, messageTime: { color: theme.colors.subtle, fontSize: 8, textAlign: "right" }, mineTime: { color: "#526249" }, emptyText: { color: theme.colors.muted, textAlign: "center", paddingVertical: 20, fontSize: 12 }, firstMessage: { alignItems: "center", paddingHorizontal: 24, paddingVertical: 18, gap: 8 }, firstIcon: { width: 51, height: 51, borderRadius: 19, backgroundColor: theme.colors.panel, alignItems: "center", justifyContent: "center", marginBottom: 5 }, firstIconGlyph: { color: theme.colors.brand, fontSize: 21 }, firstTitle: { color: theme.colors.text, fontSize: 15, fontWeight: "900" }, firstCopy: { color: theme.colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center" }, composerArea: { padding: 13, paddingBottom: 7, borderTopWidth: 1, borderTopColor: theme.colors.lineSoft }, composer: { minHeight: 48, borderRadius: 17, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.bgRaised, flexDirection: "row", alignItems: "center", paddingLeft: 14, paddingRight: 7 }, input: { color: theme.colors.text, flex: 1, maxHeight: 110, minHeight: 38, fontSize: 12, paddingTop: 10, paddingBottom: 8 }, send: { width: 35, height: 35, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brand }, sendDisabled: { opacity: 0.38 }, sendGlyph: { color: theme.colors.bg, fontSize: 20, fontWeight: "900", lineHeight: 23 }, composerHint: { color: theme.colors.subtle, fontSize: 8, textAlign: "center", marginTop: 7 } });

const photoStyles = StyleSheet.create({ photoButton: { width: 35, height: 35, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brandDeep }, photoGlyph: { color: theme.colors.brand, fontSize: 21, lineHeight: 24, fontWeight: "700" }, pendingPhoto: { flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "flex-start", maxWidth: "100%", marginBottom: 9, padding: 8, paddingRight: 12, borderRadius: 15, backgroundColor: theme.colors.panel, borderWidth: 1, borderColor: theme.colors.lineSoft }, pendingImage: { width: 42, height: 42, borderRadius: 10, backgroundColor: theme.colors.panelRaised }, pendingCopy: { gap: 3 }, pendingTitle: { color: theme.colors.text, fontSize: 10, fontWeight: "800" }, pendingHint: { color: theme.colors.subtle, fontSize: 9 }, removePhoto: { width: 25, height: 25, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#2A1918", borderWidth: 1, borderColor: "#593332", marginLeft: 3 }, removePhotoGlyph: { color: "#F0A69B", fontSize: 18, lineHeight: 20 }, messageImage: { width: 210, height: 190, borderRadius: 13, backgroundColor: theme.colors.panelRaised, resizeMode: "cover" }, pressed: { opacity: 0.76 }, disabled: { opacity: 0.5 } });
