import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { I18nText as Text } from "../../components/LocalizedText";
import { Button, Eyebrow, Panel, Screen } from "../../components/ui";
import { theme } from "../../constants/theme";

export default function PostChoiceScreen() {
  return (
    <Screen>
      <View style={styles.page}>
        <Eyebrow>MAKE A DIFFERENCE TODAY</Eyebrow>
        <Text style={styles.title}>What’s the{`\n`}story?</Text>
        <Text style={styles.copy}>A few details can help a classmate find what they’ve been missing.</Text>
        <Panel style={styles.choice}>
          <View style={[styles.iconBox, styles.lostBox]}><Text style={styles.lostIcon}>−</Text></View>
          <View style={styles.choiceText}><Text style={styles.choiceTitle}>I lost something</Text><Text style={styles.choiceCopy}>Tell your campus what you’re looking for.</Text></View>
          <Button label="Create report" onPress={() => router.push({ pathname: "/report/new", params: { type: "lost" } })} icon="→" />
        </Panel>
        <Panel style={styles.choice}>
          <View style={[styles.iconBox, styles.foundBox]}><Text style={styles.foundIcon}>✦</Text></View>
          <View style={styles.choiceText}><Text style={styles.choiceTitle}>I found something</Text><Text style={styles.choiceCopy}>Help a lost item make its way home.</Text></View>
          <Button label="Create report" onPress={() => router.push({ pathname: "/report/new", params: { type: "found" } })} kind="secondary" icon="→" />
        </Panel>
        <View style={styles.tip}><Text style={styles.tipIcon}>✧</Text><Text style={styles.tipText}>A clear description and a campus landmark make matching easier. Keep serial numbers or private details back—use them to confirm ownership in chat.</Text></View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ page: { padding: 23, paddingTop: 28, gap: 17 }, title: { color: theme.colors.text, fontSize: 36, lineHeight: 40, fontWeight: "900", letterSpacing: -1.3 }, copy: { color: theme.colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 6 }, choice: { gap: 14, padding: 16 }, iconBox: { width: 45, height: 45, alignItems: "center", justifyContent: "center", borderRadius: 15 }, lostBox: { backgroundColor: "#34271A" }, foundBox: { backgroundColor: "#1A3020" }, lostIcon: { color: theme.colors.orange, fontSize: 25, fontWeight: "700" }, foundIcon: { color: theme.colors.brand, fontSize: 21 }, choiceText: { gap: 5 }, choiceTitle: { color: theme.colors.text, fontWeight: "900", fontSize: 16 }, choiceCopy: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 }, tip: { flexDirection: "row", gap: 11, marginTop: 3, padding: 15, backgroundColor: theme.colors.bgRaised, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.lineSoft }, tipIcon: { color: theme.colors.brand, fontSize: 20 }, tipText: { color: theme.colors.muted, fontSize: 11, lineHeight: 17, flex: 1 } });
