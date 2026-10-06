import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { theme } from "../constants/theme";
import { I18nText as Text } from "./LocalizedText";

const universities = ["Kasdi Merbah University", "Other University"] as const;

export function UniversityDropdown({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.root}>
      <Text style={styles.label}>University</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Choose university" accessibilityState={{ expanded: open }} onPress={() => setOpen((current) => !current)} style={[styles.trigger, open && styles.triggerOpen]}>
        <Text style={[styles.value, !value && styles.placeholder]}>{value || "Select a university"}</Text>
        <Text style={styles.chevron}>{open ? "⌃" : "⌄"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.menu}>
          {universities.map((university) => (
            <Pressable key={university} accessibilityRole="button" accessibilityState={{ selected: value === university }} onPress={() => { onChange(university); setOpen(false); }} style={[styles.option, value === university && styles.optionSelected]}>
              <Text style={[styles.optionText, value === university && styles.optionTextSelected]}>{university}</Text>
              {value === university ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 7, zIndex: 12 },
  label: { color: theme.colors.muted, fontSize: 12, fontWeight: "700" },
  trigger: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.bgRaised },
  triggerOpen: { borderColor: theme.colors.brand },
  value: { flex: 1, color: theme.colors.text, fontSize: 14, fontWeight: "600" },
  placeholder: { color: theme.colors.subtle, fontWeight: "400" },
  chevron: { color: theme.colors.brand, fontSize: 17, fontWeight: "900" },
  menu: { padding: 5, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.panel, gap: 4, elevation: 9 },
  option: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 11, borderRadius: 10 },
  optionSelected: { borderWidth: 1, borderColor: "#34533B", backgroundColor: theme.colors.brandDeep },
  optionText: { color: theme.colors.text, fontSize: 13, fontWeight: "600" },
  optionTextSelected: { color: theme.colors.brand },
  check: { color: theme.colors.brand, fontWeight: "900" },
});
