import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { categoryEmoji, categoryLabels, theme } from "../constants/theme";
import type { Report } from "@stc-foundit/shared";

export type MobileReport = Report & { photoUrl?: string | null; ownerName?: string | null };

export function ReportCard({ report, compact = false }: { report: MobileReport; compact?: boolean }) {
  const isLost = report.type === "lost";
  const tint = isLost ? theme.colors.orange : theme.colors.brand;
  const badge = isLost ? "LOST ITEM" : "FOUND ITEM";
  return (
    <Pressable
      onPress={() => router.push(`/reports/${report.id}`)}
      style={({ pressed }) => [styles.card, compact && styles.compact, pressed && styles.pressed]}
    >
      {report.photoUrl ? (
        <Image source={{ uri: report.photoUrl }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.photoFallback]}>
          <Text style={styles.photoEmoji}>{categoryEmoji[report.category] ?? "✦"}</Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.cardTop}>
          <View style={[styles.badge, { backgroundColor: isLost ? "#34271A" : "#1A3020" }]}>
            <View style={[styles.badgeDot, { backgroundColor: tint }]} />
            <Text style={[styles.badgeText, { color: tint }]}>{badge}</Text>
          </View>
          <Text style={styles.date}>{formatAge(report.created_at)}</Text>
        </View>
        <Text style={styles.title} numberOfLines={1}>{report.title}</Text>
        <Text style={styles.description} numberOfLines={2}>{report.description}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{categoryLabels[report.category] ?? "Other"}</Text>
          {report.location ? <Text style={styles.metaLocation} numberOfLines={1}>⌖  {report.location}</Text> : null}
        </View>
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

export function formatAge(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", gap: 13, padding: 12, borderRadius: 20, backgroundColor: theme.colors.panel, borderColor: theme.colors.lineSoft, borderWidth: 1, alignItems: "center" },
  compact: { padding: 10 },
  photo: { width: 80, height: 86, borderRadius: 15, backgroundColor: theme.colors.panelRaised },
  photoFallback: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.lineSoft },
  photoEmoji: { color: theme.colors.brand, fontSize: 25, fontWeight: "600" },
  body: { flex: 1, minWidth: 0, gap: 6 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20 },
  badgeDot: { width: 5, height: 5, borderRadius: 5 },
  badgeText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.65 },
  date: { color: theme.colors.subtle, fontSize: 9, fontWeight: "600" },
  title: { color: theme.colors.text, fontSize: 14, fontWeight: "800", letterSpacing: -0.15 },
  description: { color: theme.colors.muted, fontSize: 11, lineHeight: 16 },
  metaRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  metaText: { color: theme.colors.subtle, fontSize: 10, fontWeight: "600" },
  metaLocation: { color: theme.colors.subtle, fontSize: 10, flexShrink: 1 },
  arrow: { color: theme.colors.subtle, fontSize: 24, paddingHorizontal: 1 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
