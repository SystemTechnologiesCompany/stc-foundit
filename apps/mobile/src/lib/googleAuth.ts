import * as Linking from "expo-linking";
import { supabase } from "./supabase";

/** Start Supabase's Google OAuth flow and return to the app's confirmation route. */
export async function startGoogleAuth() {
  const redirectTo = `${Linking.createURL("auth/confirm")}?flow=google`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });

  if (error) throw error;
  if (!data.url) throw new Error("Google sign-in could not be started. Try again.");
  await Linking.openURL(data.url);
}
