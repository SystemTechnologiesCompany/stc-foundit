import { createContext } from "react";
import type { RefObject } from "react";
import type { View } from "react-native";

export type TabBarBlurContextValue = {
  target: RefObject<View | null> | null;
  registerTarget: (target: RefObject<View | null>) => void;
  clearTarget: (target: RefObject<View | null>) => void;
};

export const TabBarBlurContext = createContext<TabBarBlurContextValue | null>(null);
