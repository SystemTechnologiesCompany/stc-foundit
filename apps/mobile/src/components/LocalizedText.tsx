import { Children } from "react";
import type { PropsWithChildren } from "react";
import { Text as NativeText, TextInput as NativeTextInput, type TextInputProps, type TextProps } from "react-native";
import { translateText } from "@stc-foundit/shared";
import { useLanguage } from "../providers/LanguageProvider";

export function I18nText({ children, style, ...props }: PropsWithChildren<TextProps>) {
  const { language } = useLanguage();
  const localized = Children.map(children, (child) => typeof child === "string" ? translateText(child, language) : child);
  return <NativeText {...props} style={[style, language === "ar" && { writingDirection: "rtl" }]}>{localized}</NativeText>;
}

export function I18nTextInput({ placeholder, accessibilityLabel, style, keyboardType, secureTextEntry, autoComplete, ...props }: TextInputProps) {
  const { language } = useLanguage();
  const forceLtr = secureTextEntry || autoComplete?.includes("password") || keyboardType === "email-address" || keyboardType === "phone-pad" || keyboardType === "numeric" || keyboardType === "number-pad";
  return <NativeTextInput {...props} autoComplete={autoComplete} placeholder={placeholder ? translateText(placeholder, language) : placeholder} accessibilityLabel={accessibilityLabel ? translateText(accessibilityLabel, language) : accessibilityLabel} keyboardType={keyboardType} secureTextEntry={secureTextEntry} style={[style, language === "ar" && { writingDirection: forceLtr ? "ltr" : "rtl", textAlign: forceLtr ? "left" : "right" }]} />;
}
