import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { theme } from "../constants/theme";
import { useLanguage } from "../providers/LanguageProvider";
import { I18nText as Text } from "./LocalizedText";

export function LanguageDropdown() {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.root}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Choose language")} onPress={() => setOpen((current) => !current)} style={styles.trigger}>
        <Text style={styles.label}>{t("Language")}: {language === "ar" ? "العربية" : "English"}</Text>
        <Text style={styles.chevron}>{open ? "⌃" : "⌄"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.menu}>
          <Pressable accessibilityRole="button" onPress={() => { setLanguage("en"); setOpen(false); }} style={styles.option}>
            <Text style={[styles.optionText, language === "en" && styles.selected]}>English</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setLanguage("ar"); setOpen(false); }} style={styles.option}>
            <Text style={[styles.optionText, language === "ar" && styles.selected]}>العربية</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: "flex-start", zIndex: 10 },
  trigger: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.bgRaised },
  label: { color: theme.colors.text, fontSize: 11, fontWeight: "700" },
  chevron: { color: theme.colors.brand, fontSize: 15, fontWeight: "900" },
  menu: { position: "absolute", top: 44, left: 0, minWidth: 150, padding: 5, borderRadius: 13, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.panel, elevation: 10, zIndex: 20 },
  option: { minHeight: 38, justifyContent: "center", paddingHorizontal: 10, borderRadius: 9 },
  optionText: { color: theme.colors.muted, fontSize: 11, fontWeight: "700" },
  selected: { color: theme.colors.brand },
});
