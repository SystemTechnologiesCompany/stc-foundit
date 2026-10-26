import { supabase } from "./supabase";

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/** Show Android's native Google account chooser and sign into Supabase with its ID token. */
export async function startGoogleAuth() {
  if (!webClientId) {
    throw new Error("Google sign-in needs the Web OAuth client ID. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to apps/mobile/.env and the Expo preview environment.");
  }

  const { GoogleSignin, isSuccessResponse } = await import("@react-native-google-signin/google-signin");
  GoogleSignin.configure({ webClientId, offlineAccess: false });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  // Clear the Google Sign-In SDK's remembered account so Android shows the
  // account chooser instead of silently reusing the previous selection.
  try {
    await GoogleSignin.signOut();
  } catch {
    // There may not be a cached Google account on the first sign-in.
  }
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return false;

  const idToken = response.data.idToken;
  if (!idToken) {
    throw new Error("Google didn’t return an ID token. Check that the configured client ID is a Web OAuth client ID.");
  }

  const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
  if (error) throw error;

  const googleName = response.data.user.name?.trim();
  if (data.user && googleName) {
    await supabase.from("profiles").update({ display_name: googleName }).eq("id", data.user.id).eq("display_name", "New user");
  }
  return true;
}
