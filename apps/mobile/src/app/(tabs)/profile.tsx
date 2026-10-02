import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BrandLockup, Button, Divider, Eyebrow, MessageBanner, Screen } from "../../components/ui";
import { theme } from "../../constants/theme";
import { supabase } from "../../lib/supabase";
import { disablePushNotifications, enablePushNotifications, removeThisDevicePushToken } from "../../lib/pushNotifications";
import { useAuth } from "../../providers/AuthProvider";

export default function ProfileScreen() {
  const { user } = useAuth();
  const [university, setUniversity] = useState("");
  const [reportCount, setReportCount] = useState(0);
  const [error, setError] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const name = user?.user_metadata?.display_name ?? "Campus member";

  useFocusEffect(useCallback(() => {
    let alive = true;
    async function load() {
      if (!user) return;
      const [{ data: profile }, { count }, { count: tokenCount }] = await Promise.all([
        supabase.from("profiles").select("university").eq("id", user.id).maybeSingle(),
        supabase.from("reports").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "active"),
        supabase.from("push_tokens").select("token", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      if (alive) { setUniversity(profile?.university ?? user.user_metadata?.university ?? ""); setReportCount(count ?? 0); setPushEnabled((tokenCount ?? 0) > 0); }
    }
    load();
    return () => { alive = false; };
  }, [user]));

  async function togglePushNotifications() {
    if (!user || pushBusy) return;
    if (pushEnabled) {
      Alert.alert("Turn off push alerts?", "You can turn them back on here any time.", [
        { text: "Keep on", style: "cancel" },
        { text: "Turn off", style: "destructive", onPress: async () => { setPushBusy(true); await disablePushNotifications(user.id); setPushEnabled(false); setPushBusy(false); } },
      ]);
      return;
    }
    setPushBusy(true);
    const result = await enablePushNotifications(user.id);
    setPushBusy(false);
    if (result.ok) setPushEnabled(true);
    Alert.alert(result.ok ? "You’re all set" : "Push alerts not enabled", result.message);
  }

  async function confirmSignOut() {
    Alert.alert("Sign out of FoundIt?", "You can sign back in any time.", [
      { text: "Stay here", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: async () => { if (user) await removeThisDevicePushToken(user.id); const { error: signoutError } = await supabase.auth.signOut(); if (signoutError) setError(signoutError.message); else router.replace("/(auth)/login"); } },
    ]);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.top}><BrandLockup compact /><Eyebrow>YOUR SPACE</Eyebrow></View>
        <View style={styles.profileHero}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text></View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {university ? <View style={styles.schoolPill}><Text style={styles.schoolText}>⌖  {university}</Text></View> : null}
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statValue}>{reportCount}</Text><Text style={styles.statLabel}>YOUR REPORTS</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.stat}><Text style={styles.statValue}>✓</Text><Text style={styles.statLabel}>EMAIL VERIFIED</Text></View>
        </View>
        {error ? <MessageBanner>{error}</MessageBanner> : null}
        <View style={styles.section}>
          <Eyebrow>ACCOUNT</Eyebrow>
          <View style={styles.settingsCard}>
            <Pressable onPress={() => router.push("/(tabs)/inbox")} style={styles.row}><View style={styles.rowIcon}><Text style={styles.rowIconText}>◌</Text></View><View style={styles.rowBody}><Text style={styles.rowTitle}>Messages</Text><Text style={styles.rowHint}>Your private conversations</Text></View><Text style={styles.arrow}>›</Text></Pressable>
            <Divider />
            <Pressable onPress={togglePushNotifications} disabled={pushBusy} style={styles.row}><View style={styles.rowIcon}><Text style={styles.rowIconText}>♧</Text></View><View style={styles.rowBody}><Text style={styles.rowTitle}>Push notifications</Text><Text style={styles.rowHint}>{pushBusy ? "Updating alerts…" : pushEnabled ? "On · messages and possible matches" : "Get alerts for messages and possible matches"}</Text></View><Text style={styles.pushAction}>{pushEnabled ? "TURN OFF" : "ENABLE"}</Text></Pressable>
            <Divider />
            <Pressable onPress={() => router.push("/my-reports")} style={styles.row}><View style={styles.rowIcon}><Text style={styles.rowIconText}>＋</Text></View><View style={styles.rowBody}><Text style={styles.rowTitle}>Your reports</Text><Text style={styles.rowHint}>You have {reportCount} active report{reportCount === 1 ? "" : "s"}</Text></View><Text style={styles.arrow}>›</Text></Pressable>
          </View>
        </View>
        <View style={styles.privacy}><Text style={styles.privacyGlyph}>◇</Text><View style={{ flex: 1 }}><Text style={styles.privacyTitle}>Your details are yours</Text><Text style={styles.privacyText}>Your email isn’t shown to other members. Conversations stay between the people involved.</Text></View></View>
        <Button label="Sign out" onPress={confirmSignOut} kind="secondary" icon="↗" />
        <Text style={styles.version}>STC FOUNDIT  ·  PILOT EDITION</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { padding: 21, paddingTop: 16, paddingBottom: 30, gap: 20 }, top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, profileHero: { alignItems: "center", paddingVertical: 15, gap: 8 }, avatar: { width: 78, height: 78, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brandDeep, borderWidth: 1, borderColor: "#3B5A42", marginBottom: 5 }, avatarText: { color: theme.colors.brand, fontSize: 31, fontWeight: "900" }, name: { color: theme.colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 }, email: { color: theme.colors.muted, fontSize: 12 }, schoolPill: { borderRadius: 30, backgroundColor: theme.colors.panel, paddingVertical: 7, paddingHorizontal: 12, marginTop: 3 }, schoolText: { color: theme.colors.brand, fontSize: 10, fontWeight: "700" }, stats: { flexDirection: "row", backgroundColor: theme.colors.panel, borderWidth: 1, borderColor: theme.colors.lineSoft, borderRadius: 18, padding: 15 }, stat: { flex: 1, alignItems: "center", gap: 4 }, statValue: { color: theme.colors.brand, fontSize: 22, fontWeight: "900" }, statLabel: { color: theme.colors.subtle, fontSize: 8, letterSpacing: 1, fontWeight: "800" }, statDivider: { width: 1, backgroundColor: theme.colors.line, marginVertical: 4 }, section: { gap: 10 }, settingsCard: { backgroundColor: theme.colors.panel, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.lineSoft, paddingHorizontal: 14 }, row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 12 }, rowIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: theme.colors.brandDeep, alignItems: "center", justifyContent: "center" }, rowIconText: { color: theme.colors.brand, fontSize: 18 }, rowBody: { flex: 1, gap: 3 }, rowTitle: { color: theme.colors.text, fontSize: 12, fontWeight: "800" }, rowHint: { color: theme.colors.muted, fontSize: 10 }, arrow: { color: theme.colors.subtle, fontSize: 22 }, pushAction: { color: theme.colors.brand, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 }, privacy: { flexDirection: "row", gap: 11, alignItems: "center", padding: 15, borderRadius: 17, backgroundColor: "#111D15", borderWidth: 1, borderColor: theme.colors.lineSoft }, privacyGlyph: { color: theme.colors.brand, fontSize: 20 }, privacyTitle: { color: theme.colors.text, fontSize: 11, fontWeight: "800" }, privacyText: { color: theme.colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 }, version: { color: theme.colors.subtle, textAlign: "center", fontSize: 8, letterSpacing: 1.4, fontWeight: "800" } });
