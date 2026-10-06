import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { I18nText as Text } from "../components/LocalizedText";
import { Button, Eyebrow, Screen } from "../components/ui";
import { theme } from "../constants/theme";
import { supabase } from "../lib/supabase";

export default function SuspendedScreen() {
  const [busy, setBusy] = useState(false);
  async function leave() {
    setBusy(true);
    await supabase.auth.signOut();
    setBusy(false);
    router.replace("/(auth)/login");
  }
  return (
    <Screen>
      <View style={styles.body}>
        <View style={styles.icon}><Text style={styles.iconText}>!</Text></View>
        <Eyebrow>ACCOUNT STATUS</Eyebrow>
        <Text style={styles.title}>Your account is paused.</Text>
        <Text style={styles.copy}>This account can’t browse, post, or message right now. If you think this is a mistake, contact your campus FoundIt administrator.</Text>
        <Button label="Sign out" onPress={leave} loading={busy} kind="secondary" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { flex: 1, justifyContent: "center", padding: 25, gap: 16 }, icon: { width: 61, height: 61, borderRadius: 21, backgroundColor: "#3A211D", borderWidth: 1, borderColor: "#694038", alignItems: "center", justifyContent: "center" }, iconText: { color: theme.colors.red, fontSize: 28, fontWeight: "900" }, title: { color: theme.colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -0.8 }, copy: { color: theme.colors.muted, fontSize: 13, lineHeight: 20 } });
