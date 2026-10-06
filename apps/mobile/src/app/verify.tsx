import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { I18nText as Text } from "../components/LocalizedText";
import { Button, Eyebrow, MessageBanner, Screen } from "../components/ui";
import { theme } from "../constants/theme";
import { useAuth } from "../providers/AuthProvider";
import { supabase } from "../lib/supabase";

export default function VerifyScreen() {
  const { user, signOut } = useAuth();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function resend() {
    if (!user?.email) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
    setBusy(false);
    setSent(!error);
  }

  return (
    <Screen>
      <View style={styles.body}>
        <View style={styles.iconCircle}><Text style={styles.icon}>✓</Text></View>
        <Eyebrow>JUST ONE MORE THING</Eyebrow>
        <Text style={styles.title}>Verify your{`\n`}email to get in.</Text>
        <Text style={styles.copy}>We need to know it’s really you before you can browse campus reports. Open the message we sent to:</Text>
        <View style={styles.emailCard}><Text style={styles.email}>{user?.email ?? "your email"}</Text></View>
        {sent ? <MessageBanner tone="info">A fresh verification link is on its way.</MessageBanner> : null}
        <Button label="Resend verification email" onPress={resend} loading={busy} />
        <Pressable onPress={async () => { await signOut(); router.replace("/(auth)/login"); }}><Text style={styles.signOut}>Use a different account</Text></Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { flex: 1, justifyContent: "center", padding: 25, gap: 17 }, iconCircle: { width: 66, height: 66, borderRadius: 24, backgroundColor: theme.colors.brandDeep, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#34533B", marginBottom: 8 }, icon: { color: theme.colors.brand, fontSize: 30, fontWeight: "800" }, title: { color: theme.colors.text, fontSize: 37, lineHeight: 41, fontWeight: "900", letterSpacing: -1.2 }, copy: { color: theme.colors.muted, fontSize: 14, lineHeight: 22 }, emailCard: { padding: 16, backgroundColor: theme.colors.panel, borderRadius: 15, borderWidth: 1, borderColor: theme.colors.line }, email: { color: theme.colors.text, fontSize: 14, fontWeight: "800", textAlign: "center" }, signOut: { color: theme.colors.muted, textAlign: "center", padding: 12, fontSize: 13, fontWeight: "700" } });
