import { useState } from "react";
import { Link, router } from "expo-router";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { I18nText as Text } from "../../components/LocalizedText";
import { LanguageDropdown } from "../../components/LanguageDropdown";
import * as Linking from "expo-linking";
import { BrandLockup, Button, Eyebrow, MessageBanner, Panel, Screen, TextField } from "../../components/ui";
import { theme } from "../../constants/theme";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setBusy(true); setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (authError) {
      setError(authError.message.includes("Email not confirmed") ? "Confirm your email from the link we sent, then come back here." : authError.message);
      return;
    }
    router.replace("/(tabs)");
  }

  async function forgotPassword() {
    if (!email.trim()) {
      Alert.alert("Enter your email", "Add your account email above first and we’ll send a reset code.");
      return;
    }
    if (!isSupabaseConfigured) {
      Alert.alert("Supabase isn’t connected", "The app can’t send a password reset code until its Supabase settings are configured.");
      return;
    }

    setResetBusy(true);
    try {
      const cleanEmail = email.trim();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: Linking.createURL("auth/reset"),
      });
      if (resetError) {
        Alert.alert("Couldn’t send a reset code", resetError.message);
      } else {
        router.push({ pathname: "/auth/reset", params: { email: cleanEmail } });
      }
    } catch (resetError) {
      Alert.alert(
        "Couldn’t send a reset code",
        resetError instanceof Error ? resetError.message : "Check your internet connection and try again."
      );
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} showsVerticalScrollIndicator={false}>
          <View style={styles.brandRow}><BrandLockup /><LanguageDropdown /></View>
          <View style={styles.heading}>
            <Eyebrow>GOOD TO HAVE YOU BACK</Eyebrow>
            <Text style={styles.title}>Your campus{`\n`}community is here.</Text>
            <Text style={styles.subtitle}>Sign in to find what’s missing—and help an item get home.</Text>
            <Text style={styles.nameChangeNote}>You can change your account name in Profile settings once every 7 days.</Text>
          </View>
          <Panel style={styles.formPanel}>
            {!isSupabaseConfigured ? <MessageBanner tone="info">Connect the app to Supabase first: copy apps/mobile/.env.example to apps/mobile/.env, add your project URL and public key, then restart Expo.</MessageBanner> : null}
            <TextField label="Email address" placeholder="you@university.edu" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <TextField label="Password" placeholder="Your password" secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} onSubmitEditing={signIn} />
            <Pressable onPress={forgotPassword} disabled={resetBusy} style={styles.forgot}><Text style={styles.forgotText}>{resetBusy ? "Sending reset link…" : "Forgot password?"}</Text></Pressable>
            {error ? <MessageBanner>{error}</MessageBanner> : null}
            <Button label="Sign in" onPress={signIn} loading={busy} disabled={!isSupabaseConfigured} icon="→" />
          </Panel>
          <View style={styles.joinRow}>
            <Text style={styles.joinText}>New to FoundIt?</Text>
            <Link href="/(auth)/signup" asChild><Pressable><Text style={styles.joinLink}>Create an account</Text></Pressable></Link>
          </View>
          <Text style={styles.footnote}>Only verified campus members can browse or post.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 30, justifyContent: "center", gap: 28 },
  brandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  heading: { gap: 12, marginTop: 6 },
  title: { color: theme.colors.text, fontSize: 36, lineHeight: 40, fontWeight: "900", letterSpacing: -1.3 },
  subtitle: { color: theme.colors.muted, fontSize: 14, lineHeight: 21, maxWidth: 310 },
  nameChangeNote: { color: theme.colors.brand, fontSize: 11, lineHeight: 16, maxWidth: 310 },
  formPanel: { gap: 17, padding: 18 },
  forgot: { alignSelf: "flex-end", marginTop: -7 },
  forgotText: { color: theme.colors.brand, fontSize: 12, fontWeight: "700" },
  joinRow: { flexDirection: "row", gap: 6, justifyContent: "center" },
  joinText: { color: theme.colors.muted, fontSize: 13 },
  joinLink: { color: theme.colors.brand, fontSize: 13, fontWeight: "800" },
  footnote: { color: theme.colors.subtle, textAlign: "center", fontSize: 10, marginTop: -14 },
});
