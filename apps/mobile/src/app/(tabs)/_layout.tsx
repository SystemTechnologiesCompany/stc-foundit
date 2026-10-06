import { Tabs } from "expo-router";
import { type ColorValue } from "react-native";
import { I18nText as Text } from "../../components/LocalizedText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "../../components/ui";
import { theme } from "../../constants/theme";
import { useLanguage } from "../../providers/LanguageProvider";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

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
      <Tabs.Screen name="index" options={{ title: t("Discover"), tabBarIcon: ({ color }) => <TabGlyph glyph="⌕" color={color} /> }} />
      <Tabs.Screen name="news" options={{ title: t("News"), tabBarIcon: ({ color }) => <AppIcon name="news" color={color} size={24} /> }} />
      <Tabs.Screen name="post" options={{ title: t("Report"), tabBarIcon: ({ color }) => <TabGlyph glyph="＋" color={color} /> }} />
      <Tabs.Screen name="inbox" options={{ title: t("Messages"), tabBarIcon: ({ color }) => <AppIcon name="messages" color={color} size={24} /> }} />
      <Tabs.Screen name="profile" options={{ title: t("Me"), tabBarIcon: ({ color }) => <AppIcon name="account" color={color} size={24} /> }} />
    </Tabs>
  );
}

function TabGlyph({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 25, fontWeight: "500", lineHeight: 27 }}>{glyph}</Text>;
}
