import { Redirect } from "expo-router";
import { LoadingView } from "../components/ui";
import { useAuth } from "../providers/AuthProvider";

export default function IndexRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingView label="Opening your campus…" />;
  return <Redirect href={user ? "/(tabs)" : "/(auth)/login"} />;
}
