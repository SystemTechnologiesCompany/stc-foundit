import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Eyebrow, MessageBanner, Screen, TextField } from "../../components/ui";
import { theme } from "../../constants/theme";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{
    code?: string;
    token_hash?: string;
    type?: string;
    email?: string;
    access_token?: string;
    refresh_token?: string;
    error_description?: string;
  }>();
  const incomingUrl = Linking.useURL();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const handledLink = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function establish() {
      const urlParams = new URLSearchParams();
      let hashParams = new URLSearchParams();
      if (incomingUrl) {
        try {
          const parsedUrl = new URL(incomingUrl);
          parsedUrl.searchParams.forEach((value, key) => urlParams.set(key, value));
          hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ""));
        } catch {
          // Expo Router parameters below are still available if the URL is malformed.
        }
      }

      const getValue = (key: string) => {
        const routeValue = params[key as keyof typeof params];
        return (typeof routeValue === "string" ? routeValue : undefined)
          ?? urlParams.get(key)
          ?? hashParams.get(key)
          ?? undefined;
      };
      const linkCode = getValue("code");
      const tokenHash = getValue("token_hash");
      const tokenType = getValue("type");
      const accessToken = getValue("access_token");
      const refreshToken = getValue("refresh_token");
      const linkError = getValue("error_description") ?? getValue("error");
      const linkKey = linkCode ?? tokenHash ?? (accessToken && refreshToken ? `${accessToken}:${refreshToken}` : "");

      if (linkError) {
        if (alive) setError(linkError.replace(/\+/g, " "));
        return;
      }
      if (linkKey && handledLink.current === linkKey) return;
      if (linkKey) handledLink.current = linkKey;

      let authError: { message: string } | null = null;
      if (linkCode) {
        ({ error: authError } = await supabase.auth.exchangeCodeForSession(linkCode));
      } else if (tokenHash && tokenType === "recovery") {
        ({ error: authError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" }));
      } else if (accessToken && refreshToken) {
        ({ error: authError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }));
      }

      if (linkKey) {
        if (alive) {
          setError(authError?.message ?? "");
          setReady(!authError);
        }
        return;
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (alive) {
        setReady(Boolean(data.session));
        if (sessionError) setError(sessionError.message);
        else if (params.email || email) setEmail(String(params.email ?? email));
      }
    }
    void establish();
    return () => { alive = false; };
  }, [incomingUrl, params.code, params.token_hash, params.type, params.access_token, params.refresh_token, params.error_description, params.email]);

  async function verifyRecoveryCode() {
    if (!email.trim() || !recoveryCode.trim()) {
      setError("Enter the account email and the code from the password reset email.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: recoveryCode.trim(),
      type: "recovery",
    });
    setBusy(false);
    if (verifyError) setError(verifyError.message);
    else { setReady(true); setRecoveryCode(""); }
  }

  async function updatePassword() {
    if (password.length < 8 || password !== confirm) { setError(password !== confirm ? "Those passwords don’t match." : "Use at least 8 characters."); return; }
    setBusy(true); setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) setError(updateError.message); else setDone(true);
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}><Eyebrow>ACCOUNT RECOVERY</Eyebrow><Text style={styles.title}>{done ? "You’re back in control." : "Choose a new password."}</Text><Text style={styles.copy}>{done ? "Your password has been updated. Keep it somewhere safe." : "Use a new password you haven’t used on another site."}</Text></View>
          {!ready && !done ? <>
            <MessageBanner>{error || "If the email link failed, enter the code from your reset email below."}</MessageBanner>
            <TextField label="Account email" placeholder="you@university.edu" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <TextField label="Reset code" placeholder="Code from your email" keyboardType="number-pad" value={recoveryCode} onChangeText={setRecoveryCode} />
            <Button label="Verify code" onPress={verifyRecoveryCode} loading={busy} />
          </> : null}
          {ready && !done ? <><TextField label="New password" placeholder="At least 8 characters" secureTextEntry value={password} onChangeText={setPassword} /><TextField label="Confirm password" placeholder="Type it one more time" secureTextEntry value={confirm} onChangeText={setConfirm} />{error ? <MessageBanner>{error}</MessageBanner> : null}<Button label="Update password" onPress={updatePassword} loading={busy} /></> : null}
          {done ? <Button label="Back to sign in" onPress={() => router.replace("/(auth)/login")} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { flexGrow: 1, padding: 24, justifyContent: "center", gap: 17 }, hero: { gap: 11, marginBottom: 10 }, title: { color: theme.colors.text, fontSize: 33, lineHeight: 38, fontWeight: "900", letterSpacing: -1 }, copy: { color: theme.colors.muted, fontSize: 13, lineHeight: 20 } });
