import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/UI";
import { fonts } from "../theme";
import { login, ApiError, forgotPassword } from "../api";
import { saveSession } from "../session";
import { AppRole } from "../types";

const HERO_BG = "#1c3d22";
const ACCENT = "#2E7D32";
const GOLD = "#FFB300";
const ALLOWED_ROLES: AppRole[] = [AppRole.CITIZEN, AppRole.LINE_MANAGER];

export function UnifiedLoginScreen({
  onLoginSuccess,
  onCreateAccount,
}: {
  onLoginSuccess: (role: AppRole) => void;
  onCreateAccount?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotContact, setForgotContact] = useState("");
  const [forgotMethod, setForgotMethod] = useState<"EMAIL" | "SMS">("EMAIL");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const handleForgotPassword = async () => {
    if (!forgotContact.trim()) {
      Alert.alert("Missing Info", "Please enter your email or phone number.");
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
      Alert.alert("Error", err instanceof ApiError ? err.message : "Failed to send reset instructions.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    try {
      setLoading(true);
      const result = await login({ email: email.trim().toLowerCase(), password });
      const role = result.user.role;
      if (!ALLOWED_ROLES.includes(role)) {
        setError("Access denied. This app is for Site Managers and Affected Citizens only.");
        return;
      }
      const accessToken = result.access_token?.trim();
      if (!accessToken) {
        setError("Login succeeded but no access token was returned.");
        return;
      }
      await saveSession({
        accessToken,
        expiresIn: result.expiresIn,
        user: { ...result.user, authUserId: result.user.id },
      });
      onLoginSuccess(role);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll={false} style={{ backgroundColor: HERO_BG }}>
      {/* ── Decorative background shapes ─────────────── */}
      <View style={s.blobTopRight} pointerEvents="none" />
      <View style={s.blobBottomLeft} pointerEvents="none" />
      <View style={s.blobGoldHint} pointerEvents="none" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.scrollContent}
        >
        {/* ── Logo Header ─────────────────────────────── */}
        <View style={s.logoHeader}>
          <View style={s.logoRing}>
            <Image
              source={require("../../assets/damayan-logo.png")}
              style={s.logoImg}
              resizeMode="contain"
            />
          </View>
          <Text style={s.logoName}>DAMAYAN</Text>
          <View style={s.logoDivider} />
          <Text style={s.logoTagline}>Emergency Response Platform</Text>
        </View>

        {/* ── Form Panel ─────────────────────────────── */}
        <View style={s.formPanel}>
          <View style={s.card}>
            {/* Gold accent strip at top of card */}
            <View style={s.cardAccentStrip} />

            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Welcome Back</Text>
              <Text style={s.cardSub}>Sign in to access your portal.</Text>
            </View>

            {/* Email */}
            <View style={s.field}>
              <Text style={s.fieldLabel}>Email Address</Text>
              <View style={[s.inputWrap, emailFocused && s.inputWrapFocused]}>
                <Ionicons name="mail-outline" size={18} color={emailFocused ? ACCENT : "#8fa88f"} style={s.inputIcon} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@gmail.com"
                  placeholderTextColor="#a3b3a3"
                  style={s.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>
            </View>

            {/* Password */}
            <View style={s.field}>
              <View style={s.fieldRow}>
                <Text style={s.fieldLabel}>Password</Text>
                <TouchableOpacity onPress={() => { setForgotContact(""); setForgotSuccess(false); setForgotOpen(true); }}>
                  <Text style={s.forgotLink}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <View style={[s.inputWrap, passwordFocused && s.inputWrapFocused]}>
                <Ionicons name="lock-closed-outline" size={18} color={passwordFocused ? ACCENT : "#8fa88f"} style={s.inputIcon} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="#a3b3a3"
                  style={[s.input, { paddingRight: 52 }]}
                  secureTextEntry={!passwordVisible}
                  autoComplete="password"
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <TouchableOpacity onPress={() => setPasswordVisible((v) => !v)} style={s.showBtn}>
                  <Text style={s.showBtnText}>{passwordVisible ? "Hide" : "Show"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Error */}
            {error ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#dc2626" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={[s.submitBtn, loading && { opacity: 0.65 }]}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={s.submitText}>SIGN IN</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            {/* Footer */}
            {onCreateAccount ? (
              <View style={s.cardFooter}>
                <Text style={s.footerText}>Don't have an account yet?</Text>
                <TouchableOpacity onPress={onCreateAccount} style={s.registerBtn}>
                  <Ionicons name="person-add-outline" size={15} color={ACCENT} />
                  <Text style={s.registerBtnText}>Create an Account</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal visible={forgotOpen} transparent animationType="slide" onRequestClose={() => setForgotOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Recover Password</Text>
              <TouchableOpacity onPress={() => setForgotOpen(false)} style={s.modalClose}>
                <Ionicons name="close" size={20} color="#5f6b5e" />
              </TouchableOpacity>
            </View>

            {forgotSuccess ? (
              <View style={s.successWrap}>
                <View style={s.successIcon}>
                  <Ionicons name="checkmark-circle" size={44} color={ACCENT} />
                </View>
                <Text style={s.successTitle}>Recovery Link Sent!</Text>
                <Text style={s.successSub}>
                  If an account is associated with {forgotContact}, you'll receive reset instructions shortly.
                </Text>
                <TouchableOpacity onPress={() => setForgotOpen(false)} style={s.submitBtn}>
                  <Text style={s.submitText}>BACK TO LOGIN</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={s.modalSub}>
                  Enter your email or mobile number and we'll send you reset instructions.
                </Text>
                <View style={s.methodRow}>
                  {(["EMAIL", "SMS"] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setForgotMethod(m)}
                      style={[s.methodTab, forgotMethod === m && s.methodTabActive]}
                    >
                      <Text style={[s.methodTabText, forgotMethod === m && { color: ACCENT }]}>
                        {m === "EMAIL" ? "Email" : "Phone"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={[s.inputWrap, { marginBottom: 24 }]}>
                  <Ionicons
                    name={forgotMethod === "EMAIL" ? "mail-outline" : "call-outline"}
                    size={18}
                    color="#8fa88f"
                    style={s.inputIcon}
                  />
                  <TextInput
                    value={forgotContact}
                    onChangeText={setForgotContact}
                    placeholder={forgotMethod === "EMAIL" ? "you@example.com" : "+639123456789"}
                    placeholderTextColor="#a3b3a3"
                    style={s.input}
                    autoCapitalize="none"
                    keyboardType={forgotMethod === "EMAIL" ? "email-address" : "phone-pad"}
                  />
                </View>
                <TouchableOpacity
                  onPress={handleForgotPassword}
                  disabled={forgotLoading}
                  style={[s.submitBtn, forgotLoading && { opacity: 0.65 }]}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={s.submitText}>SEND RESET LINK</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  // ── Background decorations ────────────────────────
  blobTopRight: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: "rgba(46,125,50,0.32)",
    top: -160,
    right: -110,
  },
  blobBottomLeft: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(46,125,50,0.18)",
    bottom: -90,
    left: -90,
  },
  blobGoldHint: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,179,0,0.06)",
    top: "28%",
    left: "15%",
  },

  // ── Scroll ────────────────────────────────────────
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 52,
  },

  // ── Logo Header ───────────────────────────────────
  logoHeader: {
    alignItems: "center",
    marginBottom: 36,
    gap: 10,
  },
  logoRing: {
    width: 100,
    height: 100,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    marginBottom: 4,
  },
  logoImg: {
    width: 72,
    height: 72,
  },
  logoName: {
    fontSize: 30,
    letterSpacing: 4,
    color: GOLD,
    ...fonts.black,
  },
  logoDivider: {
    width: 44,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,179,0,0.45)",
  },
  logoTagline: {
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.45)",
    ...fonts.semibold,
  },

  // ── Form Panel ────────────────────────────────────
  formPanel: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 28,
    padding: 28,
    paddingTop: 36,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 14,
  },
  cardAccentStrip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: GOLD,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  cardHeader: {
    alignItems: "center",
    marginBottom: 28,
    gap: 6,
  },
  cardTitle: {
    fontSize: 24,
    letterSpacing: -0.5,
    color: "#1a1c19",
    ...fonts.black,
  },
  cardSub: {
    fontSize: 13,
    color: "#7a8a79",
    textAlign: "center",
    lineHeight: 19,
    ...fonts.medium,
  },

  // ── Fields ────────────────────────────────────────
  field: {
    marginBottom: 18,
    gap: 7,
  },
  fieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fieldLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#3d4a3c",
    ...fonts.bold,
  },
  forgotLink: {
    fontSize: 12,
    color: ACCENT,
    ...fonts.semibold,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f7f4",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#dde5dd",
    paddingHorizontal: 14,
    height: 54,
  },
  inputWrapFocused: {
    borderColor: ACCENT,
    backgroundColor: "#fff",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#1a1c19",
    ...fonts.medium,
  },
  showBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  showBtnText: {
    fontSize: 12,
    color: "#5f6b5e",
    ...fonts.bold,
  },

  // ── Error ─────────────────────────────────────────
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 12,
    marginBottom: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: "#dc2626",
    ...fonts.medium,
  },

  // ── Submit ────────────────────────────────────────
  submitBtn: {
    height: 58,
    borderRadius: 16,
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 6,
    shadowColor: ACCENT,
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  submitText: {
    fontSize: 14,
    color: "#fff",
    letterSpacing: 1.5,
    ...fonts.black,
  },

  // ── Card Footer ───────────────────────────────────
  cardFooter: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#e8ede8",
    alignItems: "center",
    gap: 12,
  },
  footerText: {
    fontSize: 13,
    color: "#6b7b6a",
    ...fonts.medium,
  },
  registerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: ACCENT,
    backgroundColor: "transparent",
  },
  registerBtnText: {
    fontSize: 13,
    color: ACCENT,
    ...fonts.bold,
  },

  // ── Modal ─────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 28,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e0e0e0",
    alignSelf: "center",
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    color: "#1a1c19",
    ...fonts.black,
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSub: {
    fontSize: 13,
    color: "#6b7b6a",
    lineHeight: 19,
    marginBottom: 20,
    ...fonts.medium,
  },
  methodRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  methodTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 10,
  },
  methodTabActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  methodTabText: {
    fontSize: 12,
    color: "#8fa88f",
    ...fonts.bold,
  },
  successWrap: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 12,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(46,125,50,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 18,
    color: "#1a1c19",
    ...fonts.black,
  },
  successSub: {
    fontSize: 13,
    color: "#6b7b6a",
    textAlign: "center",
    lineHeight: 19,
    ...fonts.medium,
  },
});
