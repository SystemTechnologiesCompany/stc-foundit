import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type ColorValue,
  type View as NativeView,
} from "react-native";
import type { RefObject } from "react";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
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

  const providerValue = useMemo(
    () => ({ target: blurTarget, registerTarget: registerBlurTarget, clearTarget: clearBlurTarget }),
    [blurTarget, registerBlurTarget, clearBlurTarget],
  );

  return (
    <TabBarBlurContext.Provider value={providerValue}>
      <View style={styles.root} {...swipeResponder.panHandlers}>
        <Tabs
          tabBar={(props) => <FloatingTabBar {...props} blurTarget={blurTarget} bottomInset={insets.bottom} />}
          screenOptions={{
            headerShown: false,
            animation: "shift",
            transitionSpec: {
              animation: "timing",
              config: { duration: 320, easing: Easing.out(Easing.cubic) },
            },
            sceneStyleInterpolator: ({ current }) => {
              const width = Dimensions.get("window").width;
              return {
                sceneStyle: {
                  transform: [{
                    translateX: current.progress.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: [-width, 0, width],
                    }),
                  }],
                },
              };
            },
            sceneStyle: { paddingBottom: 104 + insets.bottom, backgroundColor: theme.colors.bg },
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

function FloatingTabBar({
  state,
  descriptors,
  navigation,
  blurTarget,
  bottomInset,
}: BottomTabBarProps & {
  blurTarget: RefObject<NativeView | null> | null;
  bottomInset: number;
}) {
  const width = Dimensions.get("window").width;
  const barWidth = Math.min(width - 32, 540);
  const itemWidth = barWidth / state.routes.length;
  const [indicatorIndex] = useState(() => new Animated.Value(state.index));
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    Animated.timing(indicatorIndex, {
      toValue: state.index,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [indicatorIndex, state.index]);

  if (keyboardVisible) return null;

  const indicatorX = indicatorIndex.interpolate({
    inputRange: state.routes.map((_, index) => index),
    outputRange: state.routes.map((_, index) => index * itemWidth),
  });

  return (
    <View pointerEvents="box-none" style={[styles.barPosition, { bottom: bottomInset + 12, width: barWidth }]}>
      <View style={styles.bar}>
        <View pointerEvents="none" style={styles.glassLayer}>
          <BlurView
            blurTarget={blurTarget ?? undefined}
            blurMethod={blurTarget ? "dimezisBlurView" : "none"}
            intensity={68}
            blurReductionFactor={1}
            tint="systemThinMaterialDark"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.reflection} />
        </View>
        <Animated.View
          pointerEvents="none"
          style={[styles.activePill, { width: itemWidth - 8, transform: [{ translateX: indicatorX }] }]}
        />
        <View style={styles.tabRow}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const options = descriptors[route.key].options;
            const color = focused ? "#F5F7F5" : "rgba(245, 247, 245, 0.68)";
            const label = typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : options.title ?? route.name;
            const icon = options.tabBarIcon?.({ focused, color, size: 23 });

            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                testID={options.tabBarButtonTestID}
                onPress={() => {
                  const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
                }}
                onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
                android_ripple={{ color: "rgba(169, 215, 124, 0.16)", borderless: false }}
                style={styles.tabButton}
              >
                {icon}
                <Text numberOfLines={1} style={[styles.tabLabel, { color }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  barPosition: { position: "absolute", alignSelf: "center", zIndex: 20 },
  bar: {
    height: 72,
    width: "100%",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(238, 242, 240, 0.16)",
    backgroundColor: "transparent",
    shadowColor: "#000000",
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 18,
  },
  glassLayer: {
    ...StyleSheet.absoluteFill,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  reflection: {
    position: "absolute",
    top: 0,
    left: 28,
    right: 28,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.20)",
  },
  activePill: {
    position: "absolute",
    left: 4,
    top: 6,
    bottom: 6,
    borderRadius: 23,
    backgroundColor: "rgba(235, 240, 238, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
  },
  tabRow: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  tabButton: {
    flex: 1,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 2,
  },
  tabLabel: { fontSize: 10, fontWeight: "800", lineHeight: 13 },
});

function TabGlyph({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 25, fontWeight: "500", lineHeight: 27 }}>{glyph}</Text>;
}
