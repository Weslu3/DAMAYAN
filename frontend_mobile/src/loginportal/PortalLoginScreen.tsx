import React, { useState } from "react";
import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MobileHeader } from "../components/MobileShell";
import { Button, Input, Pill, Screen, SectionCard } from "../components/UI";
import { roleColors, theme, fonts } from "../theme";
import { PortalRole } from "../types";
import { styles } from "./PortalLoginScreen.styles";

const roleContent: Record<
  PortalRole,
  {
    title: string;
    subtitle: string;
    loginLabel: string;
    accent: string;
    action: string;
    editorialTitle?: string;
    editorialAccent?: string;
    editorialText?: string;
    editorialImage?: string;
    gatewayLabel?: string;
  }
> = {
  site_manager: {
    title: "Site Manager Login",
    subtitle: "Manage shelter readiness, intake, and local distribution.",
    loginLabel: "Site Manager",
    accent: roleColors.site_manager,
    action: "Enter Manager Dashboard",
    gatewayLabel: "Operational Authority",
    editorialTitle: "Global Operational",
    editorialAccent: "Control",
    editorialText: "Access real-time intake tracking, local distribution logs, and shelter capacity monitoring in our optimized mobile workflow.",
    editorialImage: "https://lh3.googleusercontent.com/aida-public/AB6AXuB7mK6Wlk5tpcz_jg-y_FNS8PaNwyml1WkYUcFxvzRckiijTcFHZ86PvgEvRj5z91SeFpO35w95Xf15h9Te72zdNO_c_pH-SUPMX4S6vwvPbl8QmMKDbrRL0QEyIjDbUkei6wxoM5mR4tV1mIUpd3l_eiEyNBIID90mRxapOumpUbprXPaH5UFcCDYK9tjGxos2cuTC8Enx25m3LklOoLtJ3_jBY0PMnIW53zyJbubc1XMeyAhFTjngNmNce8IUw9kWG3_Iw1rge8vN",
  },
  citizen: {
    title: "Citizen Login",
    subtitle: "Sign in for alerts, preparedness info, and relief access.",
    loginLabel: "Citizen",
    accent: roleColors.citizen,
    action: "Access My Portal",
    gatewayLabel: "Secure Access Gateway",
    editorialTitle: "The Resilient",
    editorialAccent: "Sanctuary",
    editorialText: "Access humanitarian relief protocols, emergency status updates, and personal identification records within our secure environment.",
    editorialImage: "https://lh3.googleusercontent.com/aida-public/AB6AXuDUeDgaq6XCJNBqX0uYoHRejovD-YsgRj9XE5F62qvcrVmANmWRhPjGJdgTgag5gYg96TXaegniq89lq04L0wXvg92nzJmruiEnOyI5oGwyTJzc1503PTnFrS3awvyIO9d95iNTsSSrhrgEqGFrBrR-FuVdXiiqR3Nam6VzDypJIhvd4WOqXhGk_AJtsZpPol5lAkW0P5xFhTUrrykrvIrbQq5cSzalGjM0TO7Y_or_zzhXBQ-9zEQWV2QatioCFDhS4cotqpRETjxM",
  },
};

export function PortalLoginScreen({
  role,
  onBack,
  onSubmit,
  onSecondary,
  secondaryLabel,
  loading,
  error,
}: {
  role: PortalRole;
  onBack: () => void;
  onSubmit: (payload: { email: string; password: string }) => void;
  onSecondary?: () => void;
  secondaryLabel?: string;
  loading?: boolean;
  error?: string | null;
}) {
  const content = roleContent[role];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <Screen style={{ backgroundColor: theme.bg }}>
      <View style={styles.citizenShell}>
        {/* Background Blobs */}
        <View style={[styles.orb, styles.orb1, { backgroundColor: content.accent }]} />
        <View style={[styles.orb, styles.orb2]} />

        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <Pressable onPress={onBack} style={styles.menuButton}>
              <Text style={styles.menuButtonText}>←</Text>
            </Pressable>
            <Text style={styles.brandText}>DAMAYAN</Text>
          </View>

          <View style={styles.roleBadgeRow}>
            <Text style={styles.roleTag}>{content.loginLabel}</Text>
            <View style={styles.avatarIcon}>
              <Text style={{ fontSize: 18 }}>{role === "citizen" ? "👤" : "🛡️"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.editorialPanel}>
          <Text style={[styles.gatewayLabel, { color: content.accent }]}>{content.gatewayLabel}</Text>
          <Text style={styles.editorialTitle}>
            {content.editorialTitle}{"\n"}
            <Text style={[styles.editorialAccent, { color: content.accent }]}>{content.editorialAccent}</Text>
          </Text>
          <Text style={styles.editorialText}>
            {content.editorialText}
          </Text>

          <ImageBackground
            source={{
              uri: content.editorialImage,
            }}
            imageStyle={{ borderRadius: 28 }}
            style={styles.imageCard}
          >
            <View style={styles.imageOverlay} />
            <View style={styles.imageFooter}>
              <Text style={[styles.verifiedIcon, { color: content.accent }]}>✓</Text>
              <Text style={[styles.imageFooterText, { color: theme.textMuted }]}>
                {role === "citizen" ? "Identity Protected System" : "Operational Authority Verified"}
              </Text>
            </View>
          </ImageBackground>
        </View>

        <View style={styles.loginCard}>
          <View style={styles.glowOrb} />
          <View style={styles.loginCardInner}>
            <View style={styles.loginIntro}>
              <Text style={styles.loginTitle}>Welcome back</Text>
              <Text style={styles.loginSubtitle}>
                Please authenticate your credentials to enter the {content.loginLabel.toLowerCase()} dashboard.
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldIcon}>▣</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={role === "citizen" ? "juan@email.com" : "Enter your email"}
                  placeholderTextColor="#8f978f"
                  style={styles.fieldInput}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Password</Text>
                <Pressable>
                  <Text style={[styles.helpLink, { color: content.accent }]}>Forgot Password?</Text>
                </Pressable>
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldIcon}>◌</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••••••"
                  placeholderTextColor="#8f978f"
                  style={styles.fieldInput}
                  secureTextEntry={!passwordVisible}
                />
                <Pressable onPress={() => setPasswordVisible((value) => !value)}>
                  <Text style={styles.visibilityToggle}>
                    {passwordVisible ? "Hide" : "Show"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {error ? (
              <Text style={{ color: "#dc2626", fontWeight: "700", textAlign: "center" }}>{error}</Text>
            ) : null}

            <View style={styles.actionStack}>
              <Pressable onPress={() => onSubmit({ email, password })} style={[styles.primaryAction, { backgroundColor: content.accent, opacity: loading ? 0.7 : 1 }]}>
                <View style={styles.primaryGradient}>
                  <Text style={styles.primaryActionText}>{loading ? "Signing In..." : content.action}</Text>
                  <Text style={styles.primaryActionArrow}>→</Text>
                </View>
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Need Another Portal?</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable onPress={onBack} style={styles.secondaryAction}>
                <Text style={styles.secondaryActionText}>Open Role Selector</Text>
              </Pressable>

              {onSecondary && secondaryLabel ? (
                <Pressable onPress={onSecondary} style={{ marginTop: 8, alignItems: "center" }}>
                  <Text style={{ color: content.accent, ...fonts.bold }}>{secondaryLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerLinks}>
            {["Privacy Policy", "Crisis Support", "Accessibility"].map(link => (
              <Pressable key={link}>
                <Text style={styles.footerLink}>{link}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.footerNote}>
            © 2024 DAMAYAN Humanitarian Platform. Connecting responders and citizens during disaster response.
          </Text>
        </View>
      </View>
    </Screen>
  );
}


