import Constants from "expo-constants";
import { isRunningInExpoGo } from "expo";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { supabase } from "./supabase";

const permissionPromptKey = "foundit.notifications.permission-prompted.v1";
const disabledForUserKey = (userId: string) => `foundit.notifications.disabled.${userId}`;
let firstLaunchPermissionRequest: Promise<boolean> | null = null;

export function requestNotificationPermissionOnFirstLaunch() {
  if (!firstLaunchPermissionRequest) {
    firstLaunchPermissionRequest = requestFirstLaunchPermission();
  }
  return firstLaunchPermissionRequest;
}

async function requestFirstLaunchPermission() {
  if (Platform.OS !== "android" || isRunningInExpoGo() || !Device.isDevice) return false;

  try {
    if (await AsyncStorage.getItem(permissionPromptKey)) return false;

    const Notifications = await import("expo-notifications");
    await Notifications.setNotificationChannelAsync("foundit-updates", {
      name: "FoundIt updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: "#A9D77C",
    });

    const current = await Notifications.getPermissionsAsync();
    const permission = current.status === "granted"
      ? current
      : await Notifications.requestPermissionsAsync();
    await AsyncStorage.setItem(permissionPromptKey, "true");
    return permission.status === "granted";
  } catch {
    return false;
  }
}

export async function enablePushNotifications(userId: string, options: { requestPermission?: boolean } = {}) {
  if (Platform.OS === "android" && isRunningInExpoGo()) {
    return { ok: false, message: "Push alerts need the installed FoundIt app. Expo Go on Android does not support remote push notifications." };
  }
  if (!Device.isDevice) return { ok: false, message: "Push alerts need to be enabled from an installed app on a real phone." };
  if (Platform.OS !== "android") return { ok: false, message: "Push alerts are currently set up for the Android app." };

  if (options.requestPermission === false && await AsyncStorage.getItem(disabledForUserKey(userId))) {
    return { ok: false, message: "Push alerts are turned off for this account." };
  }
  if (options.requestPermission !== false) await AsyncStorage.removeItem(disabledForUserKey(userId));

  const Notifications = await import("expo-notifications");

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("foundit-updates", {
      name: "FoundIt updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: "#A9D77C",
    });
  }

  const permission = await Notifications.getPermissionsAsync();
  let status = permission.status;
  if (status !== "granted" && options.requestPermission !== false) status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return { ok: false, message: "Notification permission is off. Turn it on in your phone’s app settings and try again." };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { ok: false, message: "This app build is not linked to an Expo project yet. Link the project and build the app again to enable push alerts." };

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { error } = await supabase.from("push_tokens").upsert({
      token,
      user_id: userId,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    }, { onConflict: "token" });
    if (error) throw error;
    return { ok: true, message: "Push alerts are on. We’ll let you know about new messages and possible item matches." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not register this phone for push alerts." };
  }
}

export async function disablePushNotifications(userId: string) {
  await AsyncStorage.setItem(disabledForUserKey(userId), "true");
  await removeThisDevicePushToken(userId);
}

export async function removeThisDevicePushToken(userId: string) {
  if (Platform.OS === "android" && isRunningInExpoGo()) return;
  try {
    const Notifications = await import("expo-notifications");
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await supabase.from("push_tokens").delete().eq("token", token).eq("user_id", userId);
  } catch {
    // Signing out should still work if the device is offline or token lookup fails.
  }
}
