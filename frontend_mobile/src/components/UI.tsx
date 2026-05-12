import React from "react";
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
  Platform,
} from "react-native";
import { theme, fonts } from "../theme";

export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const content = <View style={styles.screenInner}>{children}</View>;

  if (!scroll) {
    return <View style={[styles.screen, style]}>{content}</View>;
  }

  return (
    <ScrollView
      style={[styles.screen, style]}
      contentContainerStyle={styles.scrollContent}
    >
      {content}
    </ScrollView>
  );
}

export function SectionCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  tone = "primary",
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === "primary" && styles.buttonPrimary,
        tone === "secondary" && styles.buttonSecondary,
        tone === "ghost" && styles.buttonGhost,
        tone === "danger" && styles.buttonDanger,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          tone === "ghost" && styles.buttonTextGhost,
          tone === "secondary" && styles.buttonTextSecondary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Input({
  label,
  placeholder,
  secureTextEntry,
  onChangeText,
}: {
  label?: string;
  placeholder: string;
  secureTextEntry?: boolean;
  onChangeText?: (text: string) => void;
}) {
  return (
    <View style={styles.inputWrap}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={theme.textLight}
        secureTextEntry={secureTextEntry}
        onChangeText={onChangeText}
        style={styles.input}
      />
    </View>
  );
}

export function Pill({
  label,
  tone = "default",
}: {
  label: string;
  tone?:
    | "default"
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "danger"
    | "info";
}) {
  return (
    <View
      style={[
        styles.pill,
        tone === "primary" && { backgroundColor: theme.primaryLight },
        tone === "secondary" && { backgroundColor: theme.secondaryLight },
        tone === "success" && { backgroundColor: theme.successLight },
        tone === "warning" && { backgroundColor: theme.warningLight },
        tone === "danger" && { backgroundColor: theme.dangerLight },
        tone === "info" && { backgroundColor: theme.infoLight },
      ]}
    >
      <Text
        style={[
          styles.pillText,
          tone === "primary" && { color: theme.primary },
          tone === "secondary" && { color: "#8f5d00" },
          tone === "success" && { color: theme.success },
          tone === "warning" && { color: theme.warning },
          tone === "danger" && { color: theme.danger },
          tone === "info" && { color: theme.info },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
    ...Platform.select({
      web: {
        minHeight: "100%",
        display: "flex",
      } as any,
    }),
  },
  scrollContent: {
    paddingBottom: 130,
  },
  screenInner: {
    padding: 24,
    gap: 20,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.line,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  button: {
    minHeight: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    ...fonts.bold,
  },
  buttonPrimary: {
    backgroundColor: theme.primary,
    shadowColor: theme.primary,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  buttonSecondary: {
    backgroundColor: theme.secondary,
  },
  buttonGhost: {
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1.5,
    borderColor: theme.line,
  },
  buttonDanger: {
    backgroundColor: theme.danger,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    ...fonts.black,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  buttonTextGhost: {
    color: theme.text,
  },
  buttonTextSecondary: {
    color: theme.text,
  },
  inputWrap: {
    gap: 10,
  },
  inputLabel: {
    fontSize: 12,
    ...fonts.bold,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: theme.text,
    marginLeft: 4,
  },
  input: {
    minHeight: 60,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.line,
    backgroundColor: theme.surface,
    paddingHorizontal: 20,
    paddingVertical: 14,
    color: theme.text,
    fontSize: 16,
    ...fonts.semibold,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  pillText: {
    color: theme.text,
    fontSize: 11,
    ...fonts.bold,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
