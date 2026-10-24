import { useCallback, useMemo, useState } from "react";
import { Dimensions, Easing, PanResponder, StyleSheet, View, type ColorValue, type View as NativeView } from "react-native";
import type { RefObject } from "react";
import { BlurView } from "expo-blur";
import { Tabs, router, useSegments } from "expo-router";
import { I18nText as Text } from "../../components/LocalizedText";
import { TabBarBlurContext } from "../../components/TabBarBlurContext";
import { AppIcon } from "../../components/ui";
import { theme } from "../../constants/theme";
import { useLanguage } from "../../providers/LanguageProvider";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_NAMES = ["index", "news", "post", "inbox", "profile"] as const;
const TAB_PATHS = ["/(tabs)", "/(tabs)/news", "/(tabs)/post", "/(tabs)/inbox", "/(tabs)/profile"] as const;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const segments = useSegments();
  const [blurTarget, setBlurTarget] = useState<RefObject<NativeView | null> | null>(null);
  const registerBlurTarget = useCallback((target: RefObject<NativeView | null>) => setBlurTarget(target), []);
  const clearBlurTarget = useCallback((target: RefObject<NativeView | null>) => {
    setBlurTarget((current) => current === target ? null : current);
  }, []);

  const currentName = String(segments[segments.length - 1] ?? "index");
  const currentIndex = Math.max(0, TAB_NAMES.indexOf(currentName as (typeof TAB_NAMES)[number]));
  const swipeResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) =>
      Math.abs(gesture.dx) > 36 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.3,
    onPanResponderRelease: (_event, gesture) => {
      if (Math.abs(gesture.dx) < 72 || Math.abs(gesture.dx) < Math.abs(gesture.dy) * 1.3) return;
      const nextIndex = Math.max(0, Math.min(TAB_PATHS.length - 1, currentIndex + (gesture.dx < 0 ? 1 : -1)));
      if (nextIndex !== currentIndex) router.navigate(TAB_PATHS[nextIndex] as never);
    },
  }), [currentIndex]);

  const screenWidth = Dimensions.get("window").width;
  const providerValue = useMemo(
    () => ({ target: blurTarget, registerTarget: registerBlurTarget, clearTarget: clearBlurTarget }),
    [blurTarget, registerBlurTarget, clearBlurTarget],
  );

  return (
    <TabBarBlurContext.Provider value={providerValue}>
      <View style={styles.root} {...swipeResponder.panHandlers}>
        <Tabs
          screenOptions={{
            headerShown: false,
            animation: "shift",
            transitionSpec: {
              animation: "timing",
              config: { duration: 320, easing: Easing.out(Easing.cubic) },
            },
            sceneStyleInterpolator: ({ current }) => ({
              sceneStyle: {
                transform: [{
                  translateX: current.progress.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [-screenWidth, 0, screenWidth],
                  }),
                }],
              },
            }),
            tabBarActiveTintColor: theme.colors.bg,
            tabBarInactiveTintColor: theme.colors.subtle,
            tabBarHideOnKeyboard: true,
            sceneStyle: { paddingBottom: 104 + insets.bottom, backgroundColor: theme.colors.bg },
            tabBarStyle: {
              position: "absolute",
              left: 18,
              right: 18,
              bottom: insets.bottom + 14,
              height: 72,
              paddingTop: 6,
              paddingBottom: 6,
              paddingHorizontal: 5,
              borderTopWidth: 0,
              borderWidth: 1,
              borderRadius: 30,
              borderColor: "rgba(176, 238, 145, 0.42)",
              backgroundColor: "transparent",
              shadowColor: "#000000",
              shadowOpacity: 0.38,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 9 },
              elevation: 18,
            },
            tabBarBackground: () => (
              <View style={styles.glassShell}>
                <BlurView
                  blurTarget={blurTarget ?? undefined}
                  blurMethod={blurTarget ? "dimezisBlurView" : "none"}
                  intensity={50}
                  blurReductionFactor={1}
                  tint="regular"
                  style={StyleSheet.absoluteFill}
                />
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.greenGlassTint]} />
                <View pointerEvents="none" style={styles.topGlassReflection} />
              </View>
            ),
            tabBarItemStyle: { borderRadius: 24, marginHorizontal: 2, marginVertical: 3 },
            tabBarActiveBackgroundColor: theme.colors.brand,
            tabBarLabelStyle: { fontSize: 10, fontWeight: "800", marginTop: 1 },
          }}
        >
          <Tabs.Screen name="index" options={{ title: t("Discover"), tabBarIcon: ({ color }) => <TabGlyph glyph="⌕" color={color} /> }} />
          <Tabs.Screen name="news" options={{ title: t("News"), tabBarIcon: ({ color }) => <AppIcon name="news" color={color} size={24} /> }} />
          <Tabs.Screen name="post" options={{ title: t("Report"), tabBarIcon: ({ color }) => <TabGlyph glyph="＋" color={color} /> }} />
          <Tabs.Screen name="inbox" options={{ title: t("Messages"), tabBarIcon: ({ color }) => <AppIcon name="messages" color={color} size={24} /> }} />
          <Tabs.Screen name="profile" options={{ title: t("Me"), tabBarIcon: ({ color }) => <AppIcon name="account" color={color} size={24} /> }} />
        </Tabs>
      </View>
    </TabBarBlurContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  glassShell: {
    ...StyleSheet.absoluteFill,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "rgba(48, 86, 52, 0.14)",
  },
  greenGlassTint: { backgroundColor: "rgba(72, 126, 66, 0.20)" },
  topGlassReflection: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: "rgba(220, 255, 226, 0.44)",
  },
});

function TabGlyph({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 25, fontWeight: "500", lineHeight: 27 }}>{glyph}</Text>;
}
