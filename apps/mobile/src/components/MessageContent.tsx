import { Linking, Text, type StyleProp, type TextStyle } from "react-native";

const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

export function MessageContent({ content, style }: { content: string; style?: StyleProp<TextStyle> }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = LINK_PATTERN.exec(content)) !== null) {
    const [, label, url] = match;
    if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index));
    parts.push(
      <Text
        key={`link-${match.index}`}
        style={{ textDecorationLine: "underline", fontWeight: "700" }}
        onPress={() => { void Linking.openURL(url); }}
      >
        {label}
      </Text>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  return <Text style={style}>{parts.length ? parts : content}</Text>;
}
