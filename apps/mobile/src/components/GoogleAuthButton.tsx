import { Image, Pressable, StyleSheet } from "react-native";
import { I18nText as Text } from "./LocalizedText";
import { theme } from "../constants/theme";

export function GoogleAuthButton({ onPress, loading, disabled = false }: { onPress: () => void; loading: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      onPress={onPress}
      disabled={loading || disabled}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, (loading || disabled) && styles.disabled]}
    >
      <Image source={require("../../assets/google.png")} style={styles.googleLogo} resizeMode="contain" accessibilityLabel="Google" />
      <Text style={styles.label}>{loading ? "Connecting to Google…" : "Continue with Google"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 11, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.panel, paddingHorizontal: 16 },
  googleLogo: { width: 23, height: 23 },
  label: { color: theme.colors.text, fontSize: 13, fontWeight: "800" },
  pressed: { borderColor: theme.colors.brand, backgroundColor: theme.colors.brandDeep },
  disabled: { opacity: 0.55 },
});
