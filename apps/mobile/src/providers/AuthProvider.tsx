import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "../lib/supabase";
import { enablePushNotifications, requestNotificationPermissionOnFirstLaunch } from "../lib/pushNotifications";

type AuthValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = session?.user.id;
  const emailConfirmed = Boolean(session?.user.email_confirmed_at);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    if (AppState.currentState === "active") supabase.auth.startAutoRefresh();
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
      appState.remove();
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    let alive = true;
    void (async () => {
      try {
        await requestNotificationPermissionOnFirstLaunch();
        if (alive && userId && emailConfirmed) {
          await enablePushNotifications(userId, { requestPermission: false });
        }
      } catch {
        // Keep app startup available if notification setup is unavailable.
      }
    })();
    return () => { alive = false; };
  }, [loading, userId, emailConfirmed]);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
