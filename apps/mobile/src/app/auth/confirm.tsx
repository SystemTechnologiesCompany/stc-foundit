import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button, Eyebrow, MessageBanner, Screen } from "../../components/ui";
import { theme } from "../../constants/theme";
import { supabase } from "../../lib/supabase";

export default function ConfirmEmailScreen() {
  const params = useLocalSearchParams<{ code?: string; token_hash?: string; type?: string }>();
  const [status, setStatus] = useState<"checking" | "ready" | "error">("checking");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function confirm() {
      let result: { error: { message: string } | null } = { error: null };
      if (params.code) result = await supabase.auth.exchangeCodeForSession(params.code);
      else if (params.token_hash && params.type) result = await supabase.auth.verifyOtp({ token_hash: params.token_hash, type: params.type as "signup" | "email" | "recovery" | "invite" | "magiclink" | "email_change" });
      else result = { error: { message: "This confirmation link is incomplete or has expired. Request a fresh email and try again." } };
      if (!alive) return;
      if (result.error) { setError(result.error.message); setStatus("error"); }
      else { setStatus("ready"); }
    }
    confirm();
    return () => { alive = false; };
  }, [params.code, params.token_hash, params.type]);

  return (
    <Screen>
      <View style={styles.body}>
        <View style={styles.iconCircle}><Text style={styles.icon}>{status === "ready" ? "✓" : "✉"}</Text></View>
        <Eyebrow>STC FOUNDIT · EMAIL CHECK</Eyebrow>
        <Text style={styles.title}>{status === "checking" ? "Checking your link…" : status === "ready" ? "You’re verified." : "That link didn’t work."}</Text>
        <Text style={styles.copy}>{status === "checking" ? "One moment while we finish setting up your account." : status === "ready" ? "Your campus community is ready when you are." : "The link may have expired or already been used."}</Text>
        {status === "error" ? <MessageBanner>{error}</MessageBanner> : null}
        {status === "ready" ? <Button label="Continue to FoundIt" onPress={() => router.replace("/(tabs)")} /> : null}
        {status === "error" ? <Button label="Back to sign in" onPress={() => router.replace("/(auth)/login")} kind="secondary" /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { flex: 1, padding: 25, justifyContent: "center", gap: 18 }, iconCircle: { width: 70, height: 70, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brandDeep, borderWidth: 1, borderColor: "#34533B" }, icon: { color: theme.colors.brand, fontSize: 30, fontWeight: "900" }, title: { color: theme.colors.text, fontSize: 31, fontWeight: "900", letterSpacing: -1 }, copy: { color: theme.colors.muted, fontSize: 14, lineHeight: 22 } });
