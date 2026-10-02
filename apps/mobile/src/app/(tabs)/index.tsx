import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BrandLockup, Button, EmptyState, Eyebrow, MessageBanner, Pill, Screen } from "../../components/ui";
import { ReportCard, type MobileReport } from "../../components/ReportCard";
import { categoryLabels, theme } from "../../constants/theme";
import { friendlyError, loadReports } from "../../lib/reports";
import { useAuth } from "../../providers/AuthProvider";

const filters = ["All", "Lost", "Found"] as const;
const categories = ["all", "electronics", "documents", "keys", "bags", "clothing", "accessories", "other"];

export default function DiscoverScreen() {
  const { user } = useAuth();
  const [reports, setReports] = useState<MobileReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [type, setType] = useState<(typeof filters)[number]>("All");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true); else setLoading(true);
    setError("");
    try { setReports(await loadReports()); }
    catch (cause) { setError(friendlyError(cause instanceof Error ? cause.message : "Could not load reports.")); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const shown = reports.filter((report) => {
    const typeMatch = type === "All" || report.type === type.toLowerCase();
    const categoryMatch = category === "all" || report.category === category;
    const haystack = `${report.title} ${report.description} ${report.location ?? ""}`.toLowerCase();
    return typeMatch && categoryMatch && haystack.includes(search.toLowerCase().trim());
  });
  const firstName = user?.user_metadata?.display_name?.split(" ")[0] ?? "there";

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh(true)} tintColor={theme.colors.brand} colors={[theme.colors.brand]} />} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <BrandLockup compact />
          <Pressable onPress={() => router.push("/(tabs)/profile")} style={styles.avatar}><Text style={styles.avatarText}>{firstName.slice(0, 1).toUpperCase()}</Text></Pressable>
        </View>

        <View style={styles.greeting}>
          <Eyebrow>YOUR CAMPUS, CONNECTED</Eyebrow>
          <Text style={styles.hello}>Hey, {firstName} <Text style={styles.wave}>🟢</Text></Text>
          <Text style={styles.intro}>Good things find their way back, Trust me they do</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <View style={styles.heroTag}><View style={styles.liveDot} /><Text style={styles.heroTagText}>THE CAMPUS LOST & FOUND</Text></View>
            <Text style={styles.heroSpark}>⁑⁑</Text>
          </View>
          <Text style={styles.heroTitle}>Lost something?{`\n`}Let’s bring it <Text style={styles.heroAccent}>home!</Text></Text>
          <Text style={styles.heroCopy}>A small community can make a big difference.</Text>
          <View style={styles.heroActions}>
            <Pressable onPress={() => router.push({ pathname: "/report/new", params: { type: "lost" } })} style={styles.lostButton}><Text style={styles.lostIcon}>−</Text><Text style={styles.lostText}>I lost something</Text></Pressable>
            <Pressable onPress={() => router.push({ pathname: "/report/new", params: { type: "found" } })} style={styles.foundButton}><Text style={styles.foundText}>I found something</Text><Text style={styles.foundIcon}>↗</Text></Pressable>
          </View>
          <View style={styles.heroFooter}><Text style={styles.footerIcon}>⁂</Text><Text style={styles.footerText}>Made for your campus, By STC Team</Text><Text style={styles.footerHeart}>💚</Text></View>
        </View>

        <View style={styles.feedHeader}>
          <View><Eyebrow>COMMUNITY BOARD</Eyebrow><Text style={styles.feedTitle}>Recently reported</Text></View>
          <View style={styles.countPill}><Text style={styles.count}>{reports.length}</Text><Text style={styles.countLabel}> active</Text></View>
        </View>

        <View style={styles.searchBox}><Text style={styles.searchGlyph}>⌕</Text><TextInput placeholder="Search item, place, or detail…" placeholderTextColor={theme.colors.subtle} value={search} onChangeText={setSearch} style={styles.searchInput} returnKeyType="search" /><Text style={styles.searchHint}>↵</Text></View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((item) => <Pill key={item} label={item === "All" ? "Everything" : item} selected={type === item} tone={item === "Lost" ? "orange" : "green"} onPress={() => setType(item)} />)}
        </ScrollView>
        <View style={styles.categoryRow}>
          {categories.map((item) => <Pill key={item} label={item === "all" ? "All categories" : categoryLabels[item]} selected={category === item} onPress={() => setCategory(item)} />)}
        </View>

        {error ? <MessageBanner>{error}</MessageBanner> : null}
        <View style={styles.reportList}>
          {loading && reports.length === 0 ? <View style={styles.loadingLine}><View style={styles.loadingDot} /><Text style={styles.loadingText}>Finding the latest updates…</Text></View> : null}
          {!loading && shown.length === 0 && !error ? <EmptyState icon="⌕" title="Nothing in this corner yet" body="Try a different search or filter. New reports show up here as soon as someone shares them." /> : null}
          {shown.map((report) => <ReportCard report={report} key={report.id} />)}
          {error ? <Button label="Try again" onPress={() => refresh()} kind="secondary" /> : null}
        </View>

        <View style={styles.trustNote}><View style={styles.trustIcon}><Text style={styles.trustIconText}>◇</Text></View><View style={{ flex: 1 }}><Text style={styles.trustTitle}>A safer way to reconnect</Text><Text style={styles.trustCopy}>Your details stay private. Get in touch through secure in-app messages.</Text></View></View>
        <Text style={styles.legal}>Extra Hint : Meet in a public campus spot.</Text>
        <Text style={styles.legal}> STC The Way to Greatness </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 19, paddingTop: 10, paddingBottom: 32, gap: 21 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, avatar: { width: 39, height: 39, borderRadius: 15, backgroundColor: theme.colors.panelRaised, borderWidth: 1, borderColor: theme.colors.line, alignItems: "center", justifyContent: "center" }, avatarText: { color: theme.colors.brand, fontSize: 15, fontWeight: "900" },
  greeting: { gap: 6, paddingTop: 3 }, hello: { color: theme.colors.text, fontSize: 29, fontWeight: "900", letterSpacing: -0.9 }, wave: { color: theme.colors.brand, fontSize: 22 }, intro: { color: theme.colors.muted, fontSize: 13 },
  hero: { padding: 19, borderRadius: 24, overflow: "hidden", backgroundColor: "#142319", borderWidth: 1, borderColor: "#324A35", gap: 12 }, heroGlow: { position: "absolute", width: 210, height: 210, borderRadius: 110, top: -120, right: -48, backgroundColor: "#324F2A", opacity: 0.42 }, heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, heroTag: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 20, backgroundColor: "#1D3321" }, liveDot: { width: 6, height: 6, borderRadius: 5, backgroundColor: theme.colors.brand }, heroTagText: { color: theme.colors.brand, fontSize: 8, fontWeight: "900", letterSpacing: 1 }, heroSpark: { color: "#8FC363", fontSize: 23 },
  heroTitle: { color: theme.colors.text, fontSize: 25, lineHeight: 29, fontWeight: "900", letterSpacing: -0.8 }, heroAccent: { color: theme.colors.brand }, heroCopy: { color: "#B5C2B1", fontSize: 11 }, heroActions: { flexDirection: "row", gap: 9, marginTop: 3 }, lostButton: { minHeight: 44, flex: 1, borderRadius: 13, backgroundColor: theme.colors.brand, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 8 }, lostText: { color: theme.colors.bg, fontSize: 11, fontWeight: "900" }, lostIcon: { color: theme.colors.bg, fontSize: 18, fontWeight: "900" }, foundButton: { minHeight: 44, flex: 1, borderRadius: 13, borderWidth: 1, borderColor: "#4D694B", backgroundColor: "#1A2A1E", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 8 }, foundText: { color: theme.colors.text, fontSize: 11, fontWeight: "800" }, foundIcon: { color: theme.colors.brand, fontSize: 15, fontWeight: "900" }, heroFooter: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 }, footerIcon: { color: theme.colors.brand, fontSize: 12 }, footerText: { color: "#91A28F", fontSize: 9, flex: 1 }, footerHeart: { color: "#E8A286", fontSize: 11 },
  feedHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 1 }, feedTitle: { color: theme.colors.text, fontSize: 19, fontWeight: "900", marginTop: 4 }, countPill: { flexDirection: "row", backgroundColor: theme.colors.panel, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.lineSoft }, count: { color: theme.colors.brand, fontSize: 11, fontWeight: "900" }, countLabel: { color: theme.colors.muted, fontSize: 10 },
  searchBox: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 15, paddingHorizontal: 14, backgroundColor: theme.colors.bgRaised, borderWidth: 1, borderColor: theme.colors.line }, searchGlyph: { color: theme.colors.brand, fontSize: 23 }, searchInput: { flex: 1, color: theme.colors.text, fontSize: 12, paddingVertical: 10 }, searchHint: { color: theme.colors.subtle, fontSize: 11 },
  filterRow: { gap: 8, paddingRight: 20 }, categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: -12 }, reportList: { gap: 10, marginTop: -10 }, loadingLine: { minHeight: 90, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" }, loadingDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: theme.colors.brand }, loadingText: { color: theme.colors.muted, fontSize: 12 },
  trustNote: { padding: 15, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#101D15", borderWidth: 1, borderColor: theme.colors.lineSoft }, trustIcon: { width: 37, height: 37, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brandDeep }, trustIconText: { color: theme.colors.brand, fontSize: 20 }, trustTitle: { color: theme.colors.text, fontSize: 11, fontWeight: "800" }, trustCopy: { color: theme.colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 }, legal: { color: theme.colors.subtle, textAlign: "center", fontSize: 9, paddingHorizontal: 20 },
});
