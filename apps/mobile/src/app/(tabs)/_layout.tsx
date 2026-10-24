import { useMemo } from "react";
import { PanResponder, StyleSheet, View, type ColorValue } from "react-native";
import { BlurView } from "expo-blur";
import { Tabs, router, useSegments } from "expo-router";
import { I18nText as Text } from "../../components/LocalizedText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "../../components/ui";
import { theme } from "../../constants/theme";
import { useLanguage } from "../../providers/LanguageProvider";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const segments = useSegments();
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
    <View style={{ flex: 1 }} {...swipeResponder.panHandlers}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.brand,
          tabBarInactiveTintColor: theme.colors.subtle,
          tabBarHideOnKeyboard: true,
          sceneStyle: { paddingBottom: 88 + insets.bottom },
          tabBarStyle: {
            position: "absolute",
            left: 15,
            right: 15,
            bottom: insets.bottom + 9,
            height: 68,
            paddingTop: 6,
            paddingBottom: 6,
            paddingHorizontal: 5,
            borderTopWidth: 1,
            borderWidth: 1,
            borderRadius: 27,
            borderColor: "rgba(218, 255, 226, 0.25)",
            backgroundColor: "rgba(10, 20, 14, 0.72)",
            overflow: "hidden",
            shadowColor: "#000000",
            shadowOpacity: 0.34,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
            elevation: 14,
          },
          tabBarBackground: () => <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />,
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
  );
}

function TabGlyph({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 25, fontWeight: "500", lineHeight: 27 }}>{glyph}</Text>;
}
