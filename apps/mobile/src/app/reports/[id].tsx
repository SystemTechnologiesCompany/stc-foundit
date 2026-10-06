import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Image, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { I18nText as Text } from "../../components/LocalizedText";
import { Button, Eyebrow, MessageBanner, Pill, Screen } from "../../components/ui";
import { categoryEmoji, categoryLabels, theme } from "../../constants/theme";
import { friendlyError } from "../../lib/reports";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../providers/AuthProvider";

type Detail = { id: string; user_id: string; type: "lost" | "found"; category: string; title: string; description: string; location: string | null; incident_date: string | null; status: string; created_at: string; report_images?: { storage_path: string }[]; profiles?: { display_name?: string; university?: string | null } };

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [report, setReport] = useState<Detail | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true); setError("");
      const { data, error: queryError } = await supabase.from("reports").select("*, report_images(storage_path), profiles(display_name, university)").eq("id", id).single();
      if (!alive) return;
      if (queryError) { setError(friendlyError(queryError.message)); setLoading(false); return; }
      const result = data as unknown as Detail;
      setReport(result);
      const paths = result.report_images?.map((image) => image.storage_path) ?? [];
      if (paths.length) {
        const { data: signed } = await supabase.storage.from("report-images").createSignedUrls(paths, 60 * 30);
        if (alive) setPhotoUrls((signed ?? []).map((item) => item.signedUrl).filter((value): value is string => Boolean(value)));
      }
      if (alive) setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [id]);

  async function contact() {
    if (!report || !user) return;
    setBusy(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("start_conversation", { target_report_id: report.id });
    setBusy(false);
    if (rpcError) { setError(friendlyError(rpcError.message)); return; }
    router.push(`/messages/${data}`);
  }

  async function markReturned() {
    if (!report) return;
    setBusy(true);
    const { error: updateError } = await supabase.from("reports").update({ status: "returned" }).eq("id", report.id);
    setBusy(false);
    if (updateError) { setError(updateError.message); return; }
    setReport({ ...report, status: "returned" });
  }

  if (loading) return <Screen><View style={styles.center}><Text style={styles.muted}>Opening this report…</Text></View></Screen>;
  if (!report) return (
    <Screen><View style={styles.errorPage}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹  Back</Text></Pressable><MessageBanner>{error || "We couldn’t find that report."}</MessageBanner><Button label="Browse reports" onPress={() => router.replace("/(tabs)")} kind="secondary" /></View></Screen>
  );

  const ownReport = user?.id === report.user_id;
  const isLost = report.type === "lost";
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.top}><Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backGlyph}>‹</Text><Text style={styles.backLabel}>Back</Text></Pressable><Pressable onPress={() => Share.share({ message: `FoundIt campus report: ${report.title}` })} style={styles.share}><Text style={styles.shareGlyph}>↗</Text></Pressable></View>
        {photoUrls.length ? <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.photoStrip}>{photoUrls.map((uri, index) => <Image key={`${uri}-${index}`} source={{ uri }} style={styles.photo} />)}</ScrollView> : <View style={styles.cover}><View style={styles.coverOrbit} /><Text style={styles.coverGlyph}>{categoryEmoji[report.category] ?? "✦"}</Text><Text style={styles.coverCaption}>A CAMPUS COMMUNITY REPORT</Text></View>}
        <View style={styles.badges}><Pill label={isLost ? "Lost item" : "Found item"} selected tone={isLost ? "orange" : "green"} /><Pill label={categoryLabels[report.category] ?? "Other"} /></View>
        <View style={styles.titleBlock}><Eyebrow>{isLost ? "HELP SOMEONE FIND THEIR WAY BACK" : "SOMEONE DID A KIND THING"}</Eyebrow><Text style={styles.title}>{report.title}</Text><Text style={styles.subtitle}>{report.description}</Text></View>
        <View style={styles.detailCard}>
          <DetailRow icon="⌖" label="Last seen / found" value={report.location || "Campus location not added"} />
          <View style={styles.rule} />
          <DetailRow icon="◷" label={isLost ? "Date lost" : "Date found"} value={report.incident_date ? new Date(`${report.incident_date}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "Date not shared"} />
          <View style={styles.rule} />
          <DetailRow icon="◉" label="Shared by" value={report.profiles?.display_name ?? "Campus member"} hint={report.profiles?.university ?? undefined} />
        </View>
        <View style={styles.privacyNote}><Text style={styles.privacyIcon}>◇</Text><Text style={styles.privacyCopy}>Chat stays private. If there’s a match, compare one detail that isn’t in this post.</Text></View>
        {error ? <MessageBanner>{error}</MessageBanner> : null}
        {ownReport ? report.status === "active" ? <Button label="Mark this item returned" onPress={markReturned} loading={busy} kind="secondary" icon="✓" /> : <View style={styles.done}><Text style={styles.doneText}>✓  This report is marked {report.status}.</Text></View> : <Button label={isLost ? "I may have found it" : "Contact the finder"} onPress={contact} loading={busy} icon="↗" />}
        <Text style={styles.safety}>Meet at a public campus spot. Never share passwords, codes, or payment info.</Text>
      </ScrollView>
    </Screen>
  );
}

function DetailRow({ icon, label, value, hint }: { icon: string; label: string; value: string; hint?: string }) {
  return <View style={styles.detailRow}><View style={styles.detailIcon}><Text style={styles.detailIconText}>{icon}</Text></View><View style={styles.detailText}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text>{hint ? <Text style={styles.detailHint}>{hint}</Text> : null}</View></View>;
}

const styles = StyleSheet.create({ content: { padding: 20, paddingTop: 9, paddingBottom: 32, gap: 17 }, top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, backButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 }, backGlyph: { color: theme.colors.brand, fontSize: 27 }, backLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: "700" }, share: { width: 38, height: 38, borderRadius: 14, backgroundColor: theme.colors.panel, borderWidth: 1, borderColor: theme.colors.line, alignItems: "center", justifyContent: "center" }, shareGlyph: { color: theme.colors.brand, fontSize: 17 }, cover: { height: 195, borderRadius: 24, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#15251A", borderWidth: 1, borderColor: "#2D4532", gap: 11 }, coverOrbit: { position: "absolute", width: 185, height: 185, borderRadius: 100, borderColor: "#314D34", borderWidth: 1, backgroundColor: "#1A2A1E" }, coverGlyph: { color: theme.colors.brand, fontSize: 54, fontWeight: "600" }, coverCaption: { color: "#8EA08A", fontSize: 8, fontWeight: "800", letterSpacing: 1.5 }, photoStrip: { height: 235, borderRadius: 24 }, photo: { width: 340, height: 235, borderRadius: 24, marginRight: 8, backgroundColor: theme.colors.panel }, badges: { flexDirection: "row", gap: 8, marginTop: 1 }, titleBlock: { gap: 9 }, title: { color: theme.colors.text, fontSize: 29, lineHeight: 34, fontWeight: "900", letterSpacing: -0.8 }, subtitle: { color: theme.colors.muted, fontSize: 13, lineHeight: 21 }, detailCard: { borderRadius: 19, borderWidth: 1, borderColor: theme.colors.lineSoft, backgroundColor: theme.colors.panel, paddingHorizontal: 14 }, detailRow: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 14 }, detailIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: theme.colors.brandDeep, alignItems: "center", justifyContent: "center" }, detailIconText: { color: theme.colors.brand, fontSize: 17 }, detailText: { gap: 3, flex: 1 }, detailLabel: { color: theme.colors.subtle, fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7 }, detailValue: { color: theme.colors.text, fontSize: 12, fontWeight: "700" }, detailHint: { color: theme.colors.muted, fontSize: 10 }, rule: { height: 1, backgroundColor: theme.colors.lineSoft }, privacyNote: { flexDirection: "row", gap: 9, padding: 13, backgroundColor: "#111D15", borderRadius: 14, borderWidth: 1, borderColor: theme.colors.lineSoft }, privacyIcon: { color: theme.colors.brand, fontSize: 17 }, privacyCopy: { flex: 1, color: theme.colors.muted, fontSize: 10, lineHeight: 16 }, safety: { color: theme.colors.subtle, fontSize: 9, textAlign: "center", lineHeight: 14, paddingHorizontal: 12 }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, muted: { color: theme.colors.muted, fontSize: 12 }, errorPage: { flex: 1, padding: 22, justifyContent: "center", gap: 16 }, back: { color: theme.colors.brand, fontSize: 14, fontWeight: "800" }, done: { minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: "#31533A", backgroundColor: "#14261A", justifyContent: "center", alignItems: "center" }, doneText: { color: theme.colors.brand, fontWeight: "800", fontSize: 12 } });
