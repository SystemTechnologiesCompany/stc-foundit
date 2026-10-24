import { useCallback, useMemo, useState } from "react";
import { PanResponder, StyleSheet, View, type ColorValue } from "react-native";
import type { RefObject } from "react";
import type { View as NativeView } from "react-native";
import { BlurView } from "expo-blur";
import { Tabs, router, useSegments } from "expo-router";
import { I18nText as Text } from "../../components/LocalizedText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "../../components/ui";
import { theme } from "../../constants/theme";
import { useLanguage } from "../../providers/LanguageProvider";
import { TabBarBlurContext } from "../../components/TabBarBlurContext";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const segments = useSegments();
  const [blurTarget, setBlurTarget] = useState<RefObject<NativeView | null> | null>(null);
  const registerBlurTarget = useCallback((target: RefObject<NativeView | null>) => setBlurTarget(target), []);
  const clearBlurTarget = useCallback((target: RefObject<NativeView | null>) => {
    setBlurTarget((current) => current === target ? null : current);
  }, []);
  const tabNames = ["index", "news", "post", "inbox", "profile"];
  const tabPaths = ["/(tabs)", "/(tabs)/news", "/(tabs)/post", "/(tabs)/inbox", "/(tabs)/profile"];
  const currentName = segments[segments.length - 1] ?? "index";
  const currentIndex = Math.max(0, tabNames.indexOf(currentName));
  const swipeResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 28 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25,
    onPanResponderRelease: (_event, gesture) => {
      if (Math.abs(gesture.dx) < 70 || Math.abs(gesture.dx) < Math.abs(gesture.dy) * 1.25) return;
      const nextIndex = Math.max(0, Math.min(tabPaths.length - 1, currentIndex + (gesture.dx < 0 ? 1 : -1)));
      if (nextIndex !== currentIndex) router.navigate(tabPaths[nextIndex] as never);
    },
  }), [currentIndex]);

  return (
    <TabBarBlurContext.Provider value={{ target: blurTarget, registerTarget: registerBlurTarget, clearTarget: clearBlurTarget }}>
      <View style={{ flex: 1, backgroundColor: theme.colors.bg }} {...swipeResponder.panHandlers}>
        <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.brand,
          tabBarInactiveTintColor: theme.colors.subtle,
          tabBarHideOnKeyboard: true,
          sceneStyle: { paddingBottom: 88 + insets.bottom, backgroundColor: theme.colors.bg },
          tabBarStyle: {
            position: "absolute",
            left: 18,
            right: 18,
            bottom: insets.bottom + 13,
            height: 72,
            paddingTop: 6,
            paddingBottom: 6,
            paddingHorizontal: 5,
            borderTopWidth: 1,
            borderWidth: 1,
            borderRadius: 30,
            borderColor: "rgba(218, 255, 226, 0.25)",
            backgroundColor: "rgba(8, 17, 13, 0.30)",
            shadowColor: "#000000",
            shadowOpacity: 0.42,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 10 },
            elevation: 20,
          },
          tabBarBackground: () => (
            <View style={[StyleSheet.absoluteFill, styles.glassBackground]}>
              <BlurView
                blurTarget={blurTarget}
                blurMethod={blurTarget ? "dimezisBlurView" : "none"}
                intensity={72}
                blurReductionFactor={2}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glassTint]} />
              <View pointerEvents="none" style={styles.glassHighlight} />
            </View>
          ),
          tabBarItemStyle: { borderRadius: 19, marginHorizontal: 2, marginVertical: 3 },
          tabBarActiveBackgroundColor: "rgba(169, 215, 124, 0.12)",
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
  glassBackground: {
    backgroundColor: "rgba(8, 17, 13, 0.24)",
    borderRadius: 30,
    overflow: "hidden",
  },
  glassTint: {
    backgroundColor: "rgba(11, 24, 16, 0.38)",
  },
  glassHighlight: {
    position: "absolute",
    top: 0,
    left: 22,
    right: 22,
    height: 1,
    backgroundColor: "rgba(219, 255, 227, 0.32)",
  },
});

function TabGlyph({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 25, fontWeight: "500", lineHeight: 27 }}>{glyph}</Text>;
}
