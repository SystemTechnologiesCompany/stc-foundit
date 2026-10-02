import { useEffect, useState } from "react";
import { useRouter, useSegments } from "expo-router";
import { StyleSheet, View } from "react-native";
import { LoadingView } from "./ui";
import { theme } from "../constants/theme";
import { useAuth } from "../providers/AuthProvider";
import { supabase } from "../lib/supabase";

export function AppGate() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const segments = useSegments();
  const router = useRouter();
  const [account, setAccount] = useState<{ id: string | null; banned: boolean; checking: boolean }>({ id: null, banned: false, checking: false });

  useEffect(() => {
    let alive = true;
    if (!userId) return () => { alive = false; };
    supabase.from("profiles").select("is_banned").eq("id", userId).maybeSingle().then(({ data }) => {
      if (alive) setAccount({ id: userId, banned: Boolean(data?.is_banned), checking: false });
    });
    return () => { alive = false; };
  }, [userId]);

  useEffect(() => {
    if (loading || account.checking || (user && account.id !== user.id)) return;
    const first = segments[0];
    const inAuth = first === "(auth)";
    const isConfirm = first === "auth";
    const confirmed = Boolean(user?.email_confirmed_at);

    if (!user && !inAuth && !isConfirm) router.replace("/(auth)/login");
    else if (user && account.banned && first !== "suspended") router.replace("/suspended");
    else if (user && !account.banned && !confirmed && first !== "verify" && !isConfirm) router.replace("/verify");
    else if (user && confirmed && !account.banned && (inAuth || first === "verify" || first === "suspended")) router.replace("/(tabs)");
  }, [user, loading, account, segments, router]);

  if (loading || account.checking || (user && account.id !== user.id)) {
    return <View style={[StyleSheet.absoluteFill, styles.overlay]}><LoadingView label="Opening your campus…" /></View>;
  }
  return null;
}

const styles = StyleSheet.create({ overlay: { zIndex: 20, elevation: 20, backgroundColor: theme.colors.bg } });
