import React, { useState } from "react";
import {
  ImageBackground,
  ScrollView,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../components/UI";
import { roleColors, theme, fonts } from "../../theme";
import { styles } from "./CitizenLoginScreen.styles";
import { login, getProfile, ApiError, forgotPassword } from "../../api";
import { saveSession } from "../../session";
import { AppRole } from "../../types";

export function CitizenLoginScreen({
  onBack,
  onSubmit,
  onSecondary,
  secondaryLabel = "Create An Account",
}: {
  onBack: () => void;
  onSubmit: () => void;
  onSecondary?: () => void;
  secondaryLabel?: string;
}) {
  const accent = roleColors.citizen;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot password states
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotContact, setForgotContact] = useState("");
  const [forgotMethod, setForgotMethod] = useState<"EMAIL" | "SMS">("EMAIL");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const handleForgotPassword = async () => {
    if (!forgotContact.trim()) {
      Alert.alert("Missing Contact Info", "Please enter your email or phone number.");
      return;
    }
    try {
      setForgotLoading(true);
      await forgotPassword({
        contact: forgotContact.trim(),
        method: forgotMethod,
        email: forgotMethod === "EMAIL" ? forgotContact.trim().toLowerCase() : undefined,
        phone: forgotMethod === "SMS" ? forgotContact.trim() : undefined,
      });
      setForgotSuccess(true);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to initiate password reset.";
      Alert.alert("Error", message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Missing credentials", "Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const formattedEmail = username.includes("@")
        ? username.trim().toLowerCase()
        : `${username.trim().toLowerCase()}@damayan.org`;

      const result = await login({
        email: formattedEmail,
        password,
        requiredRole: AppRole.CITIZEN,
      });

      if (result.user.role !== AppRole.CITIZEN) {
        Alert.alert("Access Denied", "This account does not have citizen access.");
        return;
      }

      const accessToken = result.access_token?.trim();
      if (!accessToken) {
        Alert.alert("Error", "Login succeeded but no access token was returned.");
        return;
      }

      const profile = await getProfile(accessToken);

      await saveSession({
        accessToken,
        expiresIn: result.expiresIn,
        user: profile.user,
      });

      onSubmit();
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiError
          ? caughtError.message
          : "Unable to sign in. Please try again.";
      setError(message);
      Alert.alert("Login Failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={{ backgroundColor: theme.bg }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.citizenShell}>
          {/* Background Blobs */}
          <View style={[styles.orb, styles.orb1, { backgroundColor: accent }]} />
          <View style={[styles.orb, styles.orb2]} />

          <View style={styles.topBar}>
            <View style={styles.brandRow}>
              <TouchableOpacity onPress={onBack} style={styles.menuButton}>
                <Ionicons name="arrow-back" size={24} color={theme.primary} />
              </TouchableOpacity>
              <Text style={styles.brandText}>DAMAYAN</Text>
            </View>

            <View style={styles.roleBadgeRow}>
              <Text style={styles.roleTag}>AFFECTED CITIZEN</Text>
              <View style={styles.avatarIcon}>
                <Ionicons name="person" size={22} color={accent} />
              </View>
            </View>
          </View>

          <View style={styles.editorialPanel}>
            <Text style={[styles.gatewayLabel, { color: accent }]}>SECURE ACCESS GATEWAY</Text>
            <Text style={styles.editorialTitle}>
              The Resilient{"\n"}
              <Text style={[styles.editorialAccent, { color: accent }]}>Sanctuary</Text>
            </Text>
            <Text style={styles.editorialText}>
              Access humanitarian relief protocols, emergency status updates, and personal identification records within our secure environment.
            </Text>

            <View style={styles.imageCardContainer}>
              <ImageBackground
                source={{ uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuDUeDgaq6XCJNBqX0uYoHRejovD-YsgRj9XE5F62qvcrVmANmWRhPjGJdgTgag5gYg96TXaegniq89lq04L0wXvg92nzJmruiEnOyI5oGwyTJzc1503PTnFrS3awvyIO9d95iNTsSSrhrgEqGFrBrR-FuVdXiiqR3Nam6VzDypJIhvd4WOqXhGk_AJtsZpPol5lAkW0P5xFhTUrrykrvIrbQq5cSzalGjM0TO7Y_or_zzhXBQ-9zEQWV2QatioCFDhS4cotqpRETjxM" }}
                imageStyle={{ borderRadius: 32 }}
                style={styles.imageCard}
              >
                <View style={styles.imageOverlay} />
              </ImageBackground>
            </View>
          </View>

          <View style={styles.loginCard}>
            <View style={styles.loginIntro}>
              <Text style={styles.loginTitle}>Welcome back</Text>
              <Text style={styles.loginSubtitle}>
                Authenticate your credentials to enter the affected citizen dashboard.
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Username</Text>
              <View style={styles.fieldWrap}>
                <Ionicons name="mail-outline" size={20} color={theme.textLight} style={{ marginRight: 12 }} />
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="e.g. samuel.aristha"
                  placeholderTextColor="#a0a7a0"
                  style={styles.fieldInput}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Password</Text>
                <TouchableOpacity onPress={() => { setForgotContact(""); setForgotSuccess(false); setForgotOpen(true); }}>
                  <Text style={[styles.helpLink, { color: accent }]}>Forgot?</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.fieldWrap}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.textLight} style={{ marginRight: 12 }} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••••••"
                  placeholderTextColor="#a0a7a0"
                  style={styles.fieldInput}
                  secureTextEntry={!passwordVisible}
                />
                <TouchableOpacity onPress={() => setPasswordVisible((v) => !v)}>
                  <Ionicons 
                    name={passwordVisible ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={theme.textLight} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.actionStack}>
              <TouchableOpacity 
                onPress={handleLogin} 
                disabled={loading}
                style={[styles.primaryAction, { backgroundColor: accent, opacity: loading ? 0.6 : 1 }]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primaryActionText}>ACCESS MY PORTAL</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>

              {onSecondary && secondaryLabel ? (
                <TouchableOpacity onPress={onSecondary} style={[styles.secondaryAction, { borderColor: accent + "40" }]}>
                  <Text style={[styles.secondaryActionText, { color: accent }]}>{secondaryLabel.toUpperCase()}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>Portal Control</Text>
                  <View style={styles.dividerLine} />
                </View>
              )}

              <TouchableOpacity onPress={onBack} style={styles.tertiaryAction}>
                <Text style={styles.tertiaryActionText}>SWITCH PORTAL ACCESS</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerLinks}>
              {["Privacy", "Support", "Terms"].map(link => (
                <TouchableOpacity key={link}>
                  <Text style={styles.footerLink}>{link}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.footerNote}>
              © 2024 DAMAYAN Platform. Crisis response and humanitarian coordination systems.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* 🔐 Beautiful Premium Forgot Password Modal */}
      <Modal visible={forgotOpen} transparent animationType="slide" onRequestClose={() => setForgotOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: theme.bg || "#fff", borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 32, paddingBottom: 48, borderTopWidth: 1, borderColor: "rgba(0,0,0,0.05)" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
              <Text style={{ fontSize: 24, ...fonts.black, color: theme.text || "#1A1C1A" }}>Recover Password</Text>
              <TouchableOpacity onPress={() => setForgotOpen(false)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.03)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={20} color={theme.textLight || "#7e887e"} />
              </TouchableOpacity>
            </View>

            {forgotSuccess ? (
              <View style={{ alignItems: "center", paddingVertical: 24 }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#E8F5E9", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <Ionicons name="checkmark-circle" size={44} color="#2E7D32" />
                </View>
                <Text style={{ fontSize: 18, ...fonts.black, color: theme.text || "#1A1C1A", marginBottom: 8 }}>Recovery Link Sent!</Text>
                <Text style={{ fontSize: 14, ...fonts.medium, color: theme.textLight || "#7e887e", textAlign: "center", lineHeight: 20, paddingHorizontal: 16 }}>
                  If an account is associated with {forgotContact}, you will receive password recovery instructions shortly.
                </Text>
                <TouchableOpacity 
                  onPress={() => setForgotOpen(false)}
                  style={{ backgroundColor: accent, height: 56, borderRadius: 16, width: "100%", alignItems: "center", justifyContent: "center", marginTop: 32 }}
                >
                  <Text style={{ color: "#fff", fontSize: 13, ...fonts.black, letterSpacing: 1 }}>RETURN TO LOGIN</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={{ fontSize: 14, ...fonts.medium, color: theme.textLight || "#7e887e", lineHeight: 20, marginBottom: 28 }}>
                  Enter your email address or mobile number below, and we'll send you instructions to securely reset your password.
                </Text>

                {/* Method selector */}
                <View style={{ flexDirection: "row", backgroundColor: "rgba(0,0,0,0.03)", borderRadius: 16, padding: 4, marginBottom: 24 }}>
                  <TouchableOpacity 
                    onPress={() => setForgotMethod("EMAIL")}
                    style={{ flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 12, backgroundColor: forgotMethod === "EMAIL" ? "#fff" : "transparent", shadowColor: "#000", shadowOpacity: forgotMethod === "EMAIL" ? 0.05 : 0, shadowRadius: 4, elevation: forgotMethod === "EMAIL" ? 2 : 0 }}
                  >
                    <Text style={{ fontSize: 12, ...fonts.black, color: forgotMethod === "EMAIL" ? accent : theme.textLight || "#7e887e" }}>EMAIL ADDRESS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setForgotMethod("SMS")}
                    style={{ flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 12, backgroundColor: forgotMethod === "SMS" ? "#fff" : "transparent", shadowColor: "#000", shadowOpacity: forgotMethod === "SMS" ? 0.05 : 0, shadowRadius: 4, elevation: forgotMethod === "SMS" ? 2 : 0 }}
                  >
                    <Text style={{ fontSize: 12, ...fonts.black, color: forgotMethod === "SMS" ? accent : theme.textLight || "#7e887e" }}>MOBILE PHONE</Text>
                  </TouchableOpacity>
                </View>

                {/* Input Field */}
                <View style={{ marginBottom: 32 }}>
                  <Text style={{ fontSize: 11, ...fonts.bold, color: theme.textLight || "#7e887e", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                    {forgotMethod === "EMAIL" ? "Email Address" : "Phone Number"}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.02)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.05)", height: 56, paddingHorizontal: 16 }}>
                    <Ionicons 
                      name={forgotMethod === "EMAIL" ? "mail-outline" : "call-outline"} 
                      size={20} 
                      color={theme.textLight || "#7e887e"} 
                      style={{ marginRight: 12 }} 
                    />
                    <TextInput
                      value={forgotContact}
                      onChangeText={setForgotContact}
                      placeholder={forgotMethod === "EMAIL" ? "citizen@example.com" : "+639123456789"}
                      placeholderTextColor="#a0a7a0"
                      style={{ flex: 1, ...fonts.medium, color: theme.text || "#1A1C1A", fontSize: 15 }}
                      autoCapitalize="none"
                      keyboardType={forgotMethod === "EMAIL" ? "email-address" : "phone-pad"}
                    />
                  </View>
                </View>

                {/* Action button */}
                <TouchableOpacity 
                  onPress={handleForgotPassword}
                  disabled={forgotLoading}
                  style={{ backgroundColor: accent, height: 60, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: forgotLoading ? 0.6 : 1 }}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={{ color: "#fff", fontSize: 13, ...fonts.black, letterSpacing: 1 }}>SEND RESET PROTOCOL</Text>
                      <Ionicons name="paper-plane" size={18} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
