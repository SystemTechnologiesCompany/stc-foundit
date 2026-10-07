import { useEffect, useState, type PropsWithChildren, type ReactNode } from "react";
import { Animated, Image, Pressable, ScrollView, StyleSheet, type TextInputProps, type ColorValue, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { I18nText as Text, I18nTextInput as TextInput } from "./LocalizedText";
import { useLanguage } from "../providers/LanguageProvider";
import { theme, type Tone } from "../constants/theme";

export function Screen({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const { language } = useLanguage();
  return (
    <SafeAreaView style={[styles.safe, { direction: language === "ar" ? "rtl" : "ltr" }, style]} edges={["top", "left", "right"]}>
      {children}
    </SafeAreaView>
  );
}

export function ScrollScreen({ children, contentStyle }: PropsWithChildren<{ contentStyle?: ViewStyle }>) {
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </Screen>
  );
}

export function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <Image
      source={require("../../assets/My-logo.png")}
      style={[styles.brandMark, small && styles.brandMarkSmall]}
      resizeMode="contain"
    />
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.lockup}>
      <BrandMark small={compact} />
      <View>
        <Text style={[styles.lockupTitle, compact && styles.lockupTitleCompact]}>FoundIt</Text>
        {!compact && <Text style={styles.lockupCaption}>STC · CAMPUS COMMUNITY</Text>}
      </View>
    </View>
  );
}

const appIconSources = {
  messages: require("../../assets/nav-messages.png"),
  news: require("../../assets/nav-news.png"),
  account: require("../../assets/nav-you.png"),
  notifications: require("../../assets/nav-notifications.png"),
};

export function AppIcon({ name, color = theme.colors.brand, size = 20 }: {
  name: keyof typeof appIconSources;
  color?: ColorValue;
  size?: number;
}) {
  return <Image source={appIconSources[name]} resizeMode="contain" style={{ width: size, height: size, tintColor: color }} />;
}

export function Eyebrow({ children, color }: PropsWithChildren<{ color?: string }>) {
  return <Text style={[styles.eyebrow, color ? { color } : null]}>{children}</Text>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function Panel({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function Pill({ label, selected = false, tone = "neutral", onPress }: {
  label: string;
  selected?: boolean;
  tone?: Tone;
  onPress?: () => void;
}) {
  const toneColor = tone === "orange" ? theme.colors.orange : tone === "blue" ? theme.colors.blue : theme.colors.brand;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.pill,
        selected ? { backgroundColor: toneColor, borderColor: toneColor } : styles.pillIdle,
        pressed && onPress ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.pillText, selected ? styles.pillTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

export function Button({ label, onPress, kind = "primary", loading = false, disabled = false, icon }: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "quiet" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
}) {
  const primary = kind === "primary";
  const danger = kind === "danger";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : danger ? styles.buttonDanger : kind === "secondary" ? styles.buttonSecondary : styles.buttonQuiet,
        (disabled || loading) && styles.disabled,
        pressed && !(disabled || loading) && styles.pressed,
      ]}
    >
      {loading ? <RadarLoader size={24} color={primary ? theme.colors.bg : theme.colors.brand} /> : null}
      {!loading && icon ? <Text style={[styles.buttonIcon, primary && styles.buttonIconPrimary]}>{icon}</Text> : null}
      {!loading ? <Text style={[styles.buttonText, primary && styles.buttonTextPrimary, danger && styles.buttonTextDanger]}>{label}</Text> : null}
    </Pressable>
  );
}

export function RadarLoader({ size = 88, color = theme.colors.brand }: { size?: number; color?: string }) {
  const [rotation] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 2000, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, [rotation]);
  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const inset = size * 0.14;
  const core = size * 0.34;
  return (
    <View accessibilityRole="progressbar" style={{ width: size, height: size, alignItems: "center", justifyContent: "center", borderRadius: size / 2, borderWidth: 1, borderColor: `${color}55`, backgroundColor: "#0B140F", overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: size * 0.16, elevation: 5 }}>
      <View style={{ position: "absolute", top: inset, right: inset, bottom: inset, left: inset, borderRadius: size / 2, borderWidth: 1, borderStyle: "dashed", borderColor: `${color}55` }} />
      <View style={{ width: core, height: core, borderRadius: core / 2, borderWidth: 1, borderStyle: "dashed", borderColor: `${color}55`, backgroundColor: "#0E1A12" }} />
      <Animated.View pointerEvents="none" style={{ position: "absolute", width: size, height: size, transform: [{ rotate: spin }] }}><View style={{ position: "absolute", top: 0, left: size / 2, width: 1, height: size / 2, backgroundColor: color, opacity: 0.9 }} /></Animated.View>
      <View style={{ position: "absolute", top: size * 0.22, left: size * 0.25, width: 3, height: 3, borderRadius: 2, backgroundColor: color, opacity: 0.9 }} />
      <View style={{ position: "absolute", right: size * 0.23, bottom: size * 0.28, width: 2, height: 2, borderRadius: 2, backgroundColor: color, opacity: 0.7 }} />
    </View>
  );
}

export function TextField({ label, error, multiline, style, showPasswordToggle = false, secureTextEntry, ...props }: TextInputProps & { label?: string; error?: string; showPasswordToggle?: boolean }) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {showPasswordToggle ? (
        <View style={styles.passwordInputShell}>
          <TextInput
            placeholderTextColor={theme.colors.subtle}
            selectionColor={theme.colors.brand}
            multiline={multiline}
            secureTextEntry={Boolean(secureTextEntry) && !passwordVisible}
            style={[styles.passwordInput, style]}
            {...props}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
            accessibilityState={{ selected: passwordVisible }}
            hitSlop={8}
            onPress={() => setPasswordVisible((visible) => !visible)}
            style={({ pressed }) => [styles.passwordVisibilityButton, pressed && styles.pressed]}
          >
            <Image
              source={passwordVisible ? require("../../assets/password-visible.png") : require("../../assets/password-hidden.png")}
              resizeMode="contain"
              style={styles.passwordVisibilityIcon}
            />
          </Pressable>
        </View>
      ) : (
        <TextInput
          placeholderTextColor={theme.colors.subtle}
          selectionColor={theme.colors.brand}
          multiline={multiline}
          secureTextEntry={secureTextEntry}
          style={[styles.input, multiline && styles.inputMultiline, style]}
          {...props}
        />
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function MessageBanner({ children, tone = "error" }: PropsWithChildren<{ tone?: "error" | "info" }>) {
  return (
    <View style={[styles.banner, tone === "info" ? styles.bannerInfo : styles.bannerError]}>
      <Text style={[styles.bannerText, tone === "info" ? styles.bannerInfoText : styles.bannerErrorText]}>{children}</Text>
    </View>
  );
}

export function LoadingView({ label = "Getting things ready…" }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <BrandMark />
      <RadarLoader />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>{typeof icon === "string" ? <Text style={styles.emptyIconText}>{icon}</Text> : icon}</View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scrollContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 34, gap: 20 },
  brandMark: { width: 48, height: 48, borderRadius: 16, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center", position: "relative" },
  brandMarkSmall: { width: 38, height: 38, borderRadius: 13 },
  brandMarkText: { color: theme.colors.bg, fontSize: 38, fontWeight: "900", lineHeight: 43, marginTop: -7, fontStyle: "italic" },
  brandMarkTextSmall: { fontSize: 30, lineHeight: 34, marginTop: -5 },
  brandMarkDot: { position: "absolute", width: 5, height: 5, borderRadius: 5, backgroundColor: theme.colors.bg, right: 8, top: 8 },
  lockup: { flexDirection: "row", alignItems: "center", gap: 11 },
  lockupTitle: { color: theme.colors.text, fontSize: 19, fontWeight: "800", letterSpacing: -0.5 },
  lockupTitleCompact: { fontSize: 16 },
  lockupCaption: { color: theme.colors.subtle, fontSize: 8, letterSpacing: 1.6, fontWeight: "700", marginTop: 3 },
  eyebrow: { color: theme.colors.brand, fontSize: 10, letterSpacing: 1.8, fontWeight: "800" },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: theme.colors.text, fontSize: 19, fontWeight: "800", letterSpacing: -0.35 },
  panel: { backgroundColor: theme.colors.panel, borderColor: theme.colors.lineSoft, borderWidth: 1, borderRadius: theme.radius.md, padding: 16 },
  pill: { borderRadius: theme.radius.pill, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 14, minHeight: 36, alignItems: "center", justifyContent: "center" },
  pillIdle: { backgroundColor: theme.colors.bgRaised, borderColor: theme.colors.line },
  pillText: { color: theme.colors.muted, fontSize: 12, fontWeight: "700" },
  pillTextSelected: { color: theme.colors.bg, fontWeight: "800" },
  button: { minHeight: 52, paddingHorizontal: 18, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  buttonPrimary: { backgroundColor: theme.colors.brand },
  buttonSecondary: { backgroundColor: theme.colors.panelRaised, borderWidth: 1, borderColor: theme.colors.line },
  buttonQuiet: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.colors.line },
  buttonDanger: { backgroundColor: "#3A211D", borderWidth: 1, borderColor: "#694038" },
  buttonText: { color: theme.colors.text, fontSize: 14, fontWeight: "800" },
  buttonTextPrimary: { color: theme.colors.bg },
  buttonTextDanger: { color: theme.colors.red },
  buttonIcon: { color: theme.colors.brand, fontSize: 18, fontWeight: "700" },
  buttonIconPrimary: { color: theme.colors.bg },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  fieldWrap: { gap: 8 },
  fieldLabel: { color: theme.colors.text, fontSize: 12, fontWeight: "700", letterSpacing: 0.1 },
  input: { color: theme.colors.text, backgroundColor: theme.colors.bgRaised, borderColor: theme.colors.line, borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, minHeight: 52, fontSize: 14 },
  passwordInputShell: { flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.bgRaised, borderColor: theme.colors.line, borderWidth: 1, borderRadius: 14, minHeight: 52, paddingLeft: 15, paddingRight: 6 },
  passwordInput: { flex: 1, color: theme.colors.text, minHeight: 50, fontSize: 14, paddingHorizontal: 0, paddingVertical: 0 },
  passwordVisibilityButton: { width: 42, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  passwordVisibilityIcon: { width: 21, height: 21, tintColor: theme.colors.muted },
  inputMultiline: { minHeight: 124, textAlignVertical: "top", paddingTop: 14 },
  errorText: { color: theme.colors.red, fontSize: 12, lineHeight: 18 },
  banner: { padding: 13, borderRadius: 14, borderWidth: 1 },
  bannerError: { backgroundColor: "#351E1B", borderColor: "#61362F" },
  bannerInfo: { backgroundColor: "#14261A", borderColor: "#31533A" },
  bannerText: { fontSize: 12, lineHeight: 18, fontWeight: "600" },
  bannerErrorText: { color: "#FFC0B4" },
  bannerInfoText: { color: theme.colors.brand },
  loading: { flex: 1, backgroundColor: theme.colors.bg, alignItems: "center", justifyContent: "center", gap: 16 },
  loadingLabel: { color: theme.colors.muted, fontSize: 13, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 36, paddingHorizontal: 22, backgroundColor: theme.colors.bgRaised, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.lineSoft },
  emptyIcon: { width: 54, height: 54, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.panelRaised, marginBottom: 16 },
  emptyIconText: { color: theme.colors.brand, fontSize: 23, fontWeight: "700" },
  emptyTitle: { color: theme.colors.text, fontWeight: "800", fontSize: 17, textAlign: "center" },
  emptyBody: { color: theme.colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 8 },
  emptyAction: { marginTop: 18, width: "100%" },
  divider: { height: 1, backgroundColor: theme.colors.lineSoft },
});
