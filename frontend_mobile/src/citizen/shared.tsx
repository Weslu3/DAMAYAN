import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, fonts } from "../theme";

const heroImageUri =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuB7mK6Wlk5tpcz_jg-y_FNS8PaNwyml1WkYUcFxvzRckiijTcFHZ86PvgEvRj5z91SeFpO35w95Xf15h9Te72zdNO_c_pH-SUPMX4S6vwvPbl8QmMKDbrRL0QEyIjDbUkei6wxoM5mR4tV1mIUpd3l_eiEyNBIID90mRxapOumpUbprXPaH5UFcCDYK9tjGxos2cuTC8Enx25m3LklOoLtJ3_jBY0PMnIW53zyJbubc1XMeyAhFTjngNmNce8IUw9kWG3_Iw1rge8vN";

export function CitizenPreparednessTopBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={citizenStyles.beforeTopBar}>
      <View style={citizenStyles.beforeTopBarRow}>
        <View style={citizenStyles.beforeTitleBlock}>
          <Text style={citizenStyles.beforeTitle}>Preparedness Center</Text>
        </View>
        <Pressable style={citizenStyles.topIconButtonAlt}>
          <Ionicons name="notifications" size={22} color={theme.primary} />
          <View style={citizenStyles.notifDot} />
        </Pressable>
      </View>
    </View>
  );
}

export function PreparednessHero({
  stepLabel,
  title,
  copy,
}: {
  stepLabel: string;
  title: string;
  copy: string;
}) {
  return (
    <View style={citizenStyles.beforeHeroSection}>
      <View style={citizenStyles.stepBadgeRow}>
        <View style={citizenStyles.stepBadge}>
          <Text style={citizenStyles.stepBadgeText}>{stepLabel}</Text>
        </View>
      </View>
      <Text style={citizenStyles.beforeHeroTitle}>{title}</Text>
      <Text style={citizenStyles.beforeHeroCopy}>{copy}</Text>

      <View style={citizenStyles.heroImageWrap}>
        <Image source={{ uri: heroImageUri }} style={citizenStyles.heroImage} />
        <View style={citizenStyles.heroImageTint} />
        <View style={citizenStyles.heroImageLabel}>
           <Text style={citizenStyles.heroImageLabelText}>READY FOR RESPONSE</Text>
        </View>
      </View>
    </View>
  );
}

export const citizenStyles = StyleSheet.create({
  beforeTopBar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  beforeTopBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  beforeTitleBlock: {
    flex: 1,
  },
  beforeTitle: {
    color: theme.text,
    fontSize: 22,
    ...fonts.black,
    letterSpacing: -1,
  },
  topIconButtonAlt: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.primarySoft,
  },
  notifDot: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.secondary,
    borderWidth: 2,
    borderColor: theme.bg,
  },
  beforeHeroSection: {
    gap: 16,
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  stepBadgeRow: {
    flexDirection: "row",
  },
  stepBadge: {
    backgroundColor: theme.secondarySoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  stepBadgeText: {
    color: theme.secondaryDark,
    fontSize: 12,
    ...fonts.bold,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  beforeHeroTitle: {
    color: theme.text,
    fontSize: 42,
    lineHeight: 48,
    ...fonts.black,
    letterSpacing: -1.8,
  },
  beforeHeroCopy: {
    color: theme.textMuted,
    fontSize: 16,
    lineHeight: 26,
    ...fonts.medium,
  },
  heroImageWrap: {
    position: "relative",
    height: 300,
    borderRadius: 40,
    overflow: "hidden",
    backgroundColor: theme.surfaceAlt,
    marginTop: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroImageTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  heroImageLabel: {
    position: "absolute",
    bottom: 24,
    left: 24,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  heroImageLabelText: {
    color: "#fff",
    fontSize: 11,
    ...fonts.black,
    letterSpacing: 1.5,
  },
  selectionGrid: {
    gap: 24,
    paddingHorizontal: 24,
  },
  selectionCard: {
    minHeight: 300,
    borderRadius: 40,
    padding: 28,
    justifyContent: "space-between",
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  selectionCardPrimary: {
    minHeight: 300,
    borderRadius: 40,
    padding: 28,
    justifyContent: "space-between",
    backgroundColor: theme.primary,
    overflow: "hidden",
    shadowColor: theme.primary,
    shadowOpacity: 0.25,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 15 },
    elevation: 10,
  },
  selectionGlow: {
    position: "absolute",
    right: -60,
    top: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  selectionIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  selectionIconBoxPrimary: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  selectionTitle: {
    color: theme.text,
    fontSize: 28,
    lineHeight: 32,
    ...fonts.black,
    marginBottom: 12,
    letterSpacing: -1,
  },
  selectionTitlePrimary: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 32,
    ...fonts.black,
    marginBottom: 12,
    letterSpacing: -1,
  },
  selectionCopy: {
    color: theme.textMuted,
    fontSize: 16,
    lineHeight: 24,
    ...fonts.medium,
  },
  selectionCopyPrimary: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
    lineHeight: 24,
    ...fonts.medium,
  },
  selectionFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 24,
  },
  selectionFooterText: {
    color: theme.primary,
    fontSize: 13,
    ...fonts.black,
    letterSpacing: 1,
  },
  selectionFooterTextPrimary: {
    color: "#fff",
    fontSize: 15,
    ...fonts.bold,
  },
  recommendedBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 99,
    backgroundColor: theme.secondary,
    shadowColor: theme.secondary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  recommendedText: {
    color: theme.text,
    fontSize: 12,
    ...fonts.black,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 32,
    ...fonts.black,
    marginBottom: 8,
    letterSpacing: -1.5,
  },
  greenHero: {
    backgroundColor: theme.primary,
    padding: 32,
    borderRadius: 40,
    gap: 16,
    shadowColor: theme.primary,
    shadowOpacity: 0.3,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 15 },
  },
  heroTitle: {
    color: "#fff",
    fontSize: 36,
    lineHeight: 42,
    ...fonts.black,
    letterSpacing: -1.5,
  },
  heroBody: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
    lineHeight: 26,
    ...fonts.medium,
  },
  uploadBox: {
    minHeight: 180,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: theme.lineMedium,
    borderStyle: "dashed",
    backgroundColor: "rgba(46, 125, 50, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginVertical: 24,
  },
  uploadTitle: {
    color: theme.primary,
    ...fonts.black,
    fontSize: 18,
  },
  uploadHint: {
    color: theme.textLight,
    fontSize: 13,
    ...fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
});

export function CitizenBottomNav({ active }: { active: "home" | "relief" | "qr" | "profile" }) {
  const tabs: Array<{ id: "home" | "relief" | "qr" | "profile"; label: string; icon: string }> = [
    { id: "home", label: "Home", icon: "home" },
    { id: "relief", label: "Relief", icon: "cube" },
    { id: "qr", label: "QR", icon: "qr-code" },
    { id: "profile", label: "Profile", icon: "person" },
  ];

  return (
    <View
      style={{
        marginTop: 18,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.line,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Pressable key={tab.id} style={{ alignItems: "center", gap: 4, opacity: isActive ? 1 : 0.7 }}>
            <Ionicons name={(isActive ? tab.icon : `${tab.icon}-outline`) as any} size={18} color={isActive ? theme.primary : theme.textLight} />
            <Text style={{ fontSize: 10, ...fonts.bold, color: isActive ? theme.primary : theme.textLight }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
