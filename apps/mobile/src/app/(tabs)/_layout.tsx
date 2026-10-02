import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";
import { theme } from "../../constants/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brand,
        tabBarInactiveTintColor: theme.colors.subtle,
        tabBarStyle: { backgroundColor: "#0B1510", borderTopColor: theme.colors.lineSoft, height: 72, paddingTop: 9, paddingBottom: 9 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginTop: 1 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Discover", tabBarIcon: ({ color }) => <TabGlyph glyph="⌕" color={color} /> }} />
      <Tabs.Screen name="post" options={{ title: "Report", tabBarIcon: ({ color }) => <TabGlyph glyph="＋" color={color} /> }} />
      <Tabs.Screen name="inbox" options={{ title: "Messages", tabBarIcon: ({ color }) => <TabGlyph glyph="◌" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "You", tabBarIcon: ({ color }) => <TabGlyph glyph="◉" color={color} /> }} />
    </Tabs>
  );
}

function TabGlyph({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 25, fontWeight: "500", lineHeight: 27 }}>{glyph}</Text>;
}
