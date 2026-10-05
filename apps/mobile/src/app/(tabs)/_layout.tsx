import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../../constants/theme";

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brand,
        tabBarInactiveTintColor: theme.colors.subtle,
        tabBarStyle: { backgroundColor: "#0B1510", borderTopColor: theme.colors.lineSoft, height: 64 + insets.bottom, paddingTop: 8, paddingBottom: 8 + insets.bottom },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginTop: 1 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Discover", tabBarIcon: ({ color }) => <TabGlyph glyph="⌕" color={color} /> }} />
      <Tabs.Screen name="news" options={{ title: "News", tabBarIcon: ({ color }) => <TabGlyph glyph="✦" color={color} /> }} />
      <Tabs.Screen name="post" options={{ title: "Report", tabBarIcon: ({ color }) => <TabGlyph glyph="＋" color={color} /> }} />
      <Tabs.Screen name="inbox" options={{ title: "Messages", tabBarIcon: ({ color }) => <TabGlyph glyph="◌" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Me", tabBarIcon: ({ color }) => <TabGlyph glyph="◉" color={color} /> }} />
    </Tabs>
  );
}

function TabGlyph({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 25, fontWeight: "500", lineHeight: 27 }}>{glyph}</Text>;
}
