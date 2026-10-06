import { useState } from "react";
import { Link, router } from "expo-router";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { I18nText as Text } from "../../components/LocalizedText";
import { LanguageDropdown } from "../../components/LanguageDropdown";
import * as Linking from "expo-linking";
import { BrandLockup, Button, Eyebrow, MessageBanner, Panel, Screen, TextField } from "../../components/ui";
import { theme } from "../../constants/theme";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

export default function SignupScreen() {
  const [name, setName] = useState("");
  const [university, setUniversity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function createAccount() {
    if (!name.trim() || !university.trim() || !email.trim() || password.length < 8) {
      setError("Add your name, campus, email, and a password of at least 8 characters.");
      return;
    }
    setBusy(true); setError("");
    const { data, error: signupError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: Linking.createURL("auth/confirm"),
        data: { display_name: name.trim(), university: university.trim() },
      },
    });
    setBusy(false);
    if (signupError) { setError(signupError.message); return; }
    if (data.session?.user.email_confirmed_at) router.replace("/(tabs)");
    else setSent(true);
  }

  if (sent) return (
    <Screen>
      <View style={styles.sentWrap}>
        <BrandLockup />
        <View style={styles.mailOrb}><Text style={styles.mailIcon}>✉</Text><View style={styles.spark} /></View>
        <Eyebrow>ONE LAST STEP</Eyebrow>
        <Text style={styles.sentTitle}>Check your{`\n`}email.</Text>
        <Text style={styles.sentBody}>We sent a confirmation link to <Text style={styles.email}>{email}</Text>. Tap it to verify your account, then come back to sign in.</Text>
        <MessageBanner tone="info">Can’t see it? Check your spam folder. The link may take a minute to arrive.</MessageBanner>
        <Button label="Back to sign in" onPress={() => router.replace("/(auth)/login")} />
      </View>
    </Screen>
  );

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} showsVerticalScrollIndicator={false}>
          <View style={styles.brandRow}><BrandLockup /><LanguageDropdown /></View>
          <View style={styles.heading}>
            <Eyebrow>JOIN YOUR CAMPUS COMMUNITY</Eyebrow>
            <Text style={styles.title}>Let’s get{`\n`}you connected.</Text>
            <Text style={styles.subtitle}>One campus. A few good people. A lot fewer lost things.</Text>
          </View>
          <Panel style={styles.panel}>
            {!isSupabaseConfigured ? <MessageBanner tone="info">Connect the app to Supabase first: copy apps/mobile/.env.example to apps/mobile/.env, add your project URL and public key, then restart Expo.</MessageBanner> : null}
            <TextField label="Full name" placeholder="How should we call you?" autoComplete="name" value={name} onChangeText={setName} />
            <TextField label="University" placeholder="Your campus or university" value={university} onChangeText={setUniversity} />
            <TextField label="University email" placeholder="you@university.edu" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <TextField label="Password" placeholder="At least 8 characters" secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword} />
            {error ? <MessageBanner>{error}</MessageBanner> : null}
            <Button label="Create my account" onPress={createAccount} loading={busy} disabled={!isSupabaseConfigured} icon="→" />
            <Text style={styles.privacy}>Your email stays private. Messages happen inside FoundIt.</Text>
          </Panel>
          <View style={styles.joinRow}>
            <Text style={styles.joinText}>Already part of FoundIt?</Text>
            <Link href="/(auth)/login" asChild><Pressable><Text style={styles.joinLink}>Sign in</Text></Pressable></Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 30, justifyContent: "center", gap: 22 }, brandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  heading: { gap: 10, marginTop: 4 }, title: { color: theme.colors.text, fontSize: 35, lineHeight: 39, fontWeight: "900", letterSpacing: -1.25 }, subtitle: { color: theme.colors.muted, fontSize: 13, lineHeight: 20 },
  panel: { gap: 14, padding: 17 }, privacy: { color: theme.colors.subtle, textAlign: "center", fontSize: 10, lineHeight: 15 },
  joinRow: { flexDirection: "row", gap: 6, justifyContent: "center" }, joinText: { color: theme.colors.muted, fontSize: 13 }, joinLink: { color: theme.colors.brand, fontSize: 13, fontWeight: "800" },
  sentWrap: { flex: 1, justifyContent: "center", padding: 24, gap: 18 }, mailOrb: { width: 84, height: 84, borderRadius: 32, backgroundColor: theme.colors.brandDeep, alignItems: "center", justifyContent: "center", borderColor: "#34533B", borderWidth: 1, marginTop: 14 }, mailIcon: { color: theme.colors.brand, fontSize: 34 }, spark: { position: "absolute", width: 9, height: 9, borderRadius: 5, right: 12, top: 12, backgroundColor: theme.colors.orange },
  sentTitle: { color: theme.colors.text, fontSize: 40, lineHeight: 43, fontWeight: "900", letterSpacing: -1.3 }, sentBody: { color: theme.colors.muted, fontSize: 14, lineHeight: 22 }, email: { color: theme.colors.text, fontWeight: "800" },
});
