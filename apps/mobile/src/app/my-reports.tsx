import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, EmptyState, Eyebrow, MessageBanner, Screen } from "../components/ui";
import { ReportCard, type MobileReport } from "../components/ReportCard";
import { theme } from "../constants/theme";
import { withPhotoUrls } from "../lib/reports";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";

export default function MyReportsScreen() {
  const { user } = useAuth();
  const [reports, setReports] = useState<MobileReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (pull = false) => {
    if (!user) return;
    if (pull) setRefreshing(true); else setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase.from("reports").select("*, report_images(storage_path)").eq("user_id", user.id).order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setReports((await withPhotoUrls((data ?? []) as (MobileReport & { report_images?: { storage_path: string }[] })[])) as MobileReport[]);
    setLoading(false); setRefreshing(false);
  }, [user]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.colors.brand} colors={[theme.colors.brand]} />} showsVerticalScrollIndicator={false}>
        <Button label="‹  Back to your profile" onPress={() => router.back()} kind="quiet" />
        <View style={styles.heading}><Eyebrow>YOUR CAMPUS FOOTPRINT</Eyebrow><Text style={styles.title}>Your reports</Text><Text style={styles.subtitle}>Follow the posts you’ve shared with your campus.</Text></View>
        {error ? <MessageBanner>{error}</MessageBanner> : null}
        {loading && !reports.length ? <Text style={styles.emptyText}>Loading your reports…</Text> : null}
        {!loading && !reports.length && !error ? <EmptyState icon="＋" title="Your first report starts here" body="Share what you lost or found. Your campus community will see it." action={<Button label="Create a report" onPress={() => router.push("/(tabs)/post")} />} /> : null}
        <View style={styles.list}>{reports.map((report) => <View key={report.id} style={styles.report}><ReportCard report={report} /><Text style={[styles.status, report.status !== "active" && styles.statusDone]}>{report.status === "active" ? "●  ACTIVE" : `✓  ${report.status.toUpperCase()}`}</Text></View>)}</View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { padding: 21, paddingTop: 16, paddingBottom: 32, gap: 18 }, heading: { gap: 7 }, title: { color: theme.colors.text, fontSize: 29, fontWeight: "900", letterSpacing: -0.8 }, subtitle: { color: theme.colors.muted, fontSize: 12 }, emptyText: { color: theme.colors.muted, textAlign: "center", padding: 35, fontSize: 12 }, list: { gap: 14 }, report: { gap: 7 }, status: { color: theme.colors.brand, alignSelf: "flex-end", fontSize: 8, letterSpacing: 0.8, fontWeight: "900", marginRight: 8 }, statusDone: { color: theme.colors.subtle } });
