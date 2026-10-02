import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ReportCategory, ReportType } from "@stc-foundit/shared";
import { createReportSchema } from "@stc-foundit/shared";
import { Button, Eyebrow, MessageBanner, Pill, Screen, TextField } from "../../components/ui";
import { categoryEmoji, categoryLabels, theme } from "../../constants/theme";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../providers/AuthProvider";

const categories: ReportCategory[] = ["electronics", "documents", "keys", "bags", "clothing", "accessories", "other"];
const MAX_BYTES = 5 * 1024 * 1024;
type Picked = { uri: string; name: string; mime: string; size?: number };

export default function NewReportScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const type: ReportType = params.type === "found" ? "found" : "lost";
  const isLost = type === "lost";
  const { user } = useAuth();
  const [category, setCategory] = useState<ReportCategory>("other");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  async function pickPhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 4, quality: 0.84, orderedSelection: true });
    if (result.canceled) return;
    const chosen = result.assets.slice(0, 4).map((asset, index) => ({ uri: asset.uri, name: asset.fileName ?? `campus-item-${Date.now()}-${index}.jpg`, mime: asset.mimeType ?? "image/jpeg", size: asset.fileSize }));
    if (chosen.some((photo) => (photo.size ?? 0) > MAX_BYTES)) { setError("Each photo must be under 5 MB. Choose a smaller image and try again."); return; }
    setError("");
    setPhotos(chosen);
  }

  async function submit() {
    setError("");
    const parsed = createReportSchema.safeParse({ type, category, title: title.trim(), description: description.trim(), location: location.trim() || undefined, incident_date: incidentDate.trim() || undefined });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the report details and try again."); return; }
    if (!user) { setError("Sign in to create a report."); return; }
    setBusy(true);
    const { data: inserted, error: insertError } = await supabase.from("reports").insert({ ...parsed.data, user_id: user.id }).select("id").single();
    if (insertError || !inserted) { setBusy(false); setError(insertError?.message ?? "Your report could not be saved."); return; }

    const uploadFailures: string[] = [];
    for (let index = 0; index < photos.length; index++) {
      const photo = photos[index];
      setProgress(`Adding photo ${index + 1} of ${photos.length}…`);
      try {
        const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${inserted.id}/${Date.now()}-${index}-${safeName}`;
        const bytes = await new File(photo.uri).arrayBuffer();
        const { error: storageError } = await supabase.storage.from("report-images").upload(path, bytes, { contentType: photo.mime, upsert: false });
        if (storageError) throw storageError;
        const { error: imageRowError } = await supabase.from("report_images").insert({ report_id: inserted.id, storage_path: path });
        if (imageRowError) uploadFailures.push(imageRowError.message);
      } catch (cause) {
        uploadFailures.push(cause instanceof Error ? cause.message : "Photo upload failed.");
      }
    }
    setProgress("Looking for a possible match…");
    await supabase.rpc("generate_matches_for_report", { new_report_id: inserted.id });
    setBusy(false);
    setProgress("");
    if (uploadFailures.length) Alert.alert("Your report is live", "One or more photos couldn’t upload. You can still view your report.");
    router.replace(`/reports/${inserted.id}`);
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backArrow}>‹</Text><Text style={styles.backText}>Back</Text><View style={styles.typePill}><View style={[styles.typeDot, { backgroundColor: isLost ? theme.colors.orange : theme.colors.brand }]} /><Text style={[styles.typeText, { color: isLost ? theme.colors.orange : theme.colors.brand }]}>{isLost ? "LOST ITEM" : "FOUND ITEM"}</Text></View></Pressable>
          <View style={styles.heading}><Eyebrow>HELP IT FIND ITS WAY</Eyebrow><Text style={styles.title}>{isLost ? "What did you lose?" : "What did you find?"}</Text><Text style={styles.subtitle}>Share the useful details. Leave one small clue back for a safe ownership check.</Text></View>

          <View style={styles.group}>
            <Text style={styles.label}>WHAT KIND OF ITEM?</Text>
            <View style={styles.categoryGrid}>{categories.map((item) => <Pill key={item} label={`${categoryEmoji[item]}  ${categoryLabels[item]}`} selected={category === item} onPress={() => setCategory(item)} />)}</View>
          </View>
          <TextField label="A short, clear title" placeholder={isLost ? "e.g. Navy laptop sleeve" : "e.g. Silver keyring"} maxLength={80} value={title} onChangeText={setTitle} />
          <TextField label="What should people look for?" placeholder="Color, brand, marks, what was inside… Avoid details only the owner should know." multiline maxLength={1000} value={description} onChangeText={setDescription} />
          <TextField label="Where on campus?" placeholder="Building, room, courtyard, or nearby landmark" maxLength={120} value={location} onChangeText={setLocation} />
          <TextField label={isLost ? "Date lost · optional" : "Date found · optional"} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} value={incidentDate} onChangeText={setIncidentDate} />

          <View style={styles.group}>
            <View style={styles.photoHeading}><Text style={styles.label}>ADD A PHOTO <Text style={styles.optional}>· OPTIONAL</Text></Text><Text style={styles.photoCount}>{photos.length}/4</Text></View>
            <Text style={styles.photoCopy}>A photo can help—but leave identifying details out.</Text>
            <Pressable onPress={pickPhotos} style={({ pressed }) => [styles.photoPicker, pressed && { opacity: 0.75 }]}>
              <View style={styles.photoAdd}><Text style={styles.plus}>＋</Text></View><View style={styles.photoText}><Text style={styles.photoTitle}>{photos.length ? "Choose different photos" : "Add from your gallery"}</Text><Text style={styles.photoHint}>Up to 4 photos · 5 MB each</Text></View><Text style={styles.addArrow}>↗</Text>
            </Pressable>
            {photos.length ? <ScrollView horizontal contentContainerStyle={styles.previewRow} showsHorizontalScrollIndicator={false}>{photos.map((photo, i) => <View key={`${photo.uri}-${i}`} style={styles.previewWrap}><Image source={{ uri: photo.uri }} style={styles.preview} /><Pressable accessibilityLabel="Remove photo" onPress={() => setPhotos((old) => old.filter((_, index) => index !== i))} style={styles.removePhoto}><Text style={styles.removeText}>×</Text></Pressable></View>)}</ScrollView> : null}
          </View>
          {error ? <MessageBanner>{error}</MessageBanner> : null}
          {progress ? <MessageBanner tone="info">{progress}</MessageBanner> : null}
          <View style={styles.safety}><Text style={styles.safetyIcon}>◇</Text><Text style={styles.safetyText}>Keep a serial number or unique detail private. You can use it later to check ownership in a private message.</Text></View>
          <Button label={isLost ? "Post lost item" : "Post found item"} onPress={submit} loading={busy} disabled={!title.trim() || !description.trim()} icon="↗" />
          <Text style={styles.footnote}>Your report is only visible to signed-in, verified campus members.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, content: { padding: 21, paddingTop: 10, paddingBottom: 35, gap: 17 }, back: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 34 }, backArrow: { color: theme.colors.brand, fontSize: 27, lineHeight: 30 }, backText: { color: theme.colors.muted, fontSize: 12, fontWeight: "700" }, typePill: { marginLeft: "auto", flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: theme.colors.panel, paddingVertical: 7, paddingHorizontal: 9, borderRadius: 20 }, typeDot: { width: 6, height: 6, borderRadius: 5 }, typeText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.8 }, heading: { gap: 8, marginTop: 2, marginBottom: 4 }, title: { color: theme.colors.text, fontSize: 29, fontWeight: "900", letterSpacing: -0.9 }, subtitle: { color: theme.colors.muted, fontSize: 12, lineHeight: 19 }, group: { gap: 10 }, label: { color: theme.colors.text, fontSize: 11, fontWeight: "800", letterSpacing: 0.6 }, categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, photoHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, optional: { color: theme.colors.subtle, fontWeight: "600", letterSpacing: 0 }, photoCount: { color: theme.colors.subtle, fontSize: 10 }, photoCopy: { color: theme.colors.muted, fontSize: 11 }, photoPicker: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.colors.bgRaised, borderColor: theme.colors.line, borderWidth: 1, borderStyle: "dashed", padding: 12, borderRadius: 16 }, photoAdd: { width: 42, height: 42, borderRadius: 14, backgroundColor: theme.colors.brandDeep, alignItems: "center", justifyContent: "center" }, plus: { color: theme.colors.brand, fontSize: 23 }, photoText: { flex: 1, gap: 3 }, photoTitle: { color: theme.colors.text, fontSize: 12, fontWeight: "800" }, photoHint: { color: theme.colors.subtle, fontSize: 10 }, addArrow: { color: theme.colors.brand, fontSize: 16 }, previewRow: { gap: 9, paddingVertical: 2 }, previewWrap: { position: "relative" }, preview: { width: 76, height: 76, borderRadius: 14, backgroundColor: theme.colors.panelRaised }, removePhoto: { position: "absolute", right: -5, top: -5, width: 23, height: 23, borderRadius: 12, backgroundColor: theme.colors.bg, borderWidth: 1, borderColor: theme.colors.line, alignItems: "center", justifyContent: "center" }, removeText: { color: theme.colors.text, fontSize: 16, lineHeight: 17, fontWeight: "700" }, safety: { flexDirection: "row", gap: 9, padding: 13, borderRadius: 14, backgroundColor: "#131E16", borderWidth: 1, borderColor: theme.colors.lineSoft }, safetyIcon: { color: theme.colors.brand, fontSize: 16 }, safetyText: { color: theme.colors.muted, fontSize: 10, lineHeight: 16, flex: 1 }, footnote: { color: theme.colors.subtle, fontSize: 9, textAlign: "center", marginTop: -7 } });
