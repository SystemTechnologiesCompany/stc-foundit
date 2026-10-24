import { Pressable, StyleSheet, View } from "react-native";
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
      <View style={styles.mark}><Text style={styles.googleG}>G</Text></View>
      <Text style={styles.label}>{loading ? "Connecting to Google…" : "Continue with Google"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 11, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.panel, paddingHorizontal: 16 },
  mark: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  googleG: { color: "#4285F4", fontSize: 17, fontWeight: "900" },
  label: { color: theme.colors.text, fontSize: 13, fontWeight: "800" },
  pressed: { borderColor: theme.colors.brand, backgroundColor: theme.colors.brandDeep },
  disabled: { opacity: 0.55 },
});
