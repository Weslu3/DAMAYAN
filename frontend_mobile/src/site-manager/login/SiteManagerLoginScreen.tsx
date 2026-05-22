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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../components/UI";
import { roleColors, theme, fonts } from "../../theme";
import { styles } from "./SiteManagerLoginScreen.styles";
import { login, getProfile, ApiError } from "../../api";
import { saveSession } from "../../session";
import { AppRole } from "../../types";

export function SiteManagerLoginScreen({
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
  const accent = roleColors.site_manager;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Missing credentials", "Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log("[Login] Step 1: Calling login API...");
      const result = await login({
        email: username.trim(),
        password: password.trim(),
        requiredRole: AppRole.LINE_MANAGER,
      });
      console.log("[Login] Step 2: Login success, role =", result.user.role);

      if (result.user.role !== AppRole.LINE_MANAGER) {
        Alert.alert("Access Denied", "This account does not have site manager access.");
        return;
      }

      const accessToken = result.access_token?.trim();
      if (!accessToken) {
        Alert.alert("Error", "Login succeeded but no access token was returned.");
        return;
      }

      console.log("[Login] Step 3: Fetching profile...");
      const profile = await getProfile(accessToken);
      console.log("[Login] Step 4: Profile fetched:", profile.user?.email);

      console.log("[Login] Step 5: Saving session...");
      await saveSession({
        accessToken,
        expiresIn: result.expiresIn,
        user: profile.user,
      });
      console.log("[Login] Step 6: Session saved. Navigating...");

      onSubmit();
    } catch (caughtError) {
      console.error("[Login] ERROR:", caughtError);
      const message = caughtError instanceof Error ? caughtError.message : "Unable to sign in. Please try again.";
      setError(message);
      Alert.alert("Login Failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={{ backgroundColor: theme.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
              <Text style={styles.roleTag}>SITE MANAGER</Text>
              <View style={styles.avatarIcon}>
                <Ionicons name="business" size={22} color={accent} />
              </View>
            </View>
          </View>

          <View style={styles.editorialPanel}>
            <Text style={[styles.gatewayLabel, { color: accent }]}>OPERATIONAL AUTHORITY</Text>
            <Text style={styles.editorialTitle}>
              Global Operational{"\n"}
              <Text style={[styles.editorialAccent, { color: accent }]}>Control</Text>
            </Text>
            <Text style={styles.editorialText}>
              Access real-time intake tracking, local distribution logs, and shelter capacity monitoring in our optimized mobile workflow.
            </Text>

            <View style={styles.imageCardContainer}>
              <ImageBackground
                source={{ uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuB7mK6Wlk5tpcz_jg-y_FNS8PaNwyml1WkYUcFxvzRckiijTcFHZ86PvgEvRj5z91SeFpO35w95Xf15h9Te72zdNO_c_pH-SUPMX4S6vwvPbl8QmMKDbrRL0QEyIjDbUkei6wxoM5mR4tV1mIUpd3l_eiEyNBIID90mRxapOumpUbprXPaH5UFcCDYK9tjGxos2cuTC8Enx25m3LklOoLtJ3_jBY0PMnIW53zyJbubc1XMeyAhFTjngNmNce8IUw9kWG3_Iw1rge8vN" }}
                imageStyle={{ borderRadius: 32 }}
                style={styles.imageCard}
              >
                <View style={styles.imageOverlay} />
              </ImageBackground>
              <View style={styles.imageFooter}>
                <Ionicons name="checkmark-circle" size={20} color={accent} />
                <Text style={styles.imageFooterText}>
                  Operational Authority Verified
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.loginCard}>
            <View style={styles.loginIntro}>
              <Text style={styles.loginTitle}>Welcome back</Text>
              <Text style={styles.loginSubtitle}>
                Authenticate your credentials to enter the manager dashboard.
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Username</Text>
              <View style={styles.fieldWrap}>
                <Ionicons name="mail-outline" size={20} color={theme.textLight} style={{ marginRight: 12 }} />
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter username"
                  placeholderTextColor="#a0a7a0"
                  style={styles.fieldInput}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Password</Text>
                <TouchableOpacity>
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
                    <Text style={styles.primaryActionText}>ENTER MANAGER DASHBOARD</Text>
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
    </Screen>
  );
}
