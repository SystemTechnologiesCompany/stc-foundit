export const theme = {
  colors: {
    bg: "#08110D",
    bgRaised: "#0C1711",
    panel: "#111E16",
    panelRaised: "#17261C",
    line: "#26382B",
    lineSoft: "#1C2B21",
    text: "#F3F6EF",
    muted: "#A2B19F",
    subtle: "#718173",
    brand: "#B8F27C",
    brandDeep: "#173820",
    orange: "#F0B66A",
    red: "#FF8B7A",
    blue: "#8CB8F6",
    white: "#FFFFFF",
  },
  radius: { sm: 12, md: 18, lg: 26, pill: 999 },
  space: { xs: 6, sm: 10, md: 16, lg: 22, xl: 30 },
};

export type Tone = "green" | "orange" | "blue" | "neutral";

export const categoryLabels: Record<string, string> = {
  electronics: "Electronics",
  documents: "Documents",
  keys: "Keys",
  bags: "Bags",
  clothing: "Clothing",
  accessories: "Accessories",
  other: "Other",
};

export const categoryEmoji: Record<string, string> = {
  electronics: "⌁",
  documents: "▤",
  keys: "⚿",
  bags: "▱",
  clothing: "◌",
  accessories: "✦",
  other: "＋",
};
