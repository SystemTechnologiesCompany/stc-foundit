import { Stack, router } from "expo-router";
import { useEffect } from "react";
import { isRunningInExpoGo } from "expo";
import { Platform, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type * as Notifications from "expo-notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../providers/AuthProvider";
import { AppGate } from "../components/AppGate";
import { theme } from "../constants/theme";

export default function RootLayout() {
  useEffect(() => {
    // Android Expo Go no longer includes remote push notification support.
    // Keep its unsupported notification APIs out of app startup so the rest
    // of the app remains testable there; installed builds still enable push.
    if (Platform.OS === "android" && isRunningInExpoGo()) return;

    let cancelled = false;
    let subscription: Notifications.EventSubscription | undefined;

    void (async () => {
      const Notifications = await import("expo-notifications");
      if (cancelled) return;

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      function openNotification(notification: Notifications.Notification) {
        const path = notification.request.content.data?.url;
        if (typeof path === "string" && path.startsWith("/")) router.push(path as never);
      }
      const initial = Notifications.getLastNotificationResponse();
      if (initial?.notification) openNotification(initial.notification);
      subscription = Notifications.addNotificationResponseReceivedListener((response) => openNotification(response.notification));
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
          <StatusBar style="light" />
          <AppGate />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg }, animation: "fade_from_bottom" }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="verify" />
            <Stack.Screen name="suspended" />
            <Stack.Screen name="auth/confirm" />
            <Stack.Screen name="auth/reset" />
            <Stack.Screen name="report/new" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
            <Stack.Screen name="reports/[id]" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="messages/[id]" options={{ animation: "slide_from_right" }} />
          </Stack>
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
